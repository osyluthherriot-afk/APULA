import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawn } from "node:child_process";

const ROOT = process.cwd();
const PROMO_DIR = path.join(ROOT, "documentation", "promo");
const BASE_URL = process.env.APULA_URL || "http://127.0.0.1:3000";

const VIEWPORT_WIDTH = 1600;
const VIEWPORT_HEIGHT = 900;
const DEVICE_SCALE_FACTOR = 1.5;
const TARGET_FPS = 18;
const TOTAL_FRAMES = 90;

const FFMPEG_CANDIDATES = [
  process.env.FFMPEG_PATH,
  "C:\\Program Files\\Krita (x64)\\bin\\ffmpeg.exe",
  "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
].filter(Boolean);

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  path.join(
    os.homedir(),
    "AppData",
    "Local",
    "ms-playwright",
    "chromium-1248",
    "chrome-win64",
    "chrome.exe",
  ),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform === "win32" && child.pid) {
      execFileSync("taskkill", ["/F", "/T", "/PID", String(child.pid)], {
        stdio: "ignore",
      });
    } else {
      child.kill("SIGKILL");
    }
  } catch {
    // ignore if already exited
  }
}

function resolveExecutable(candidates, label) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`${label} not found. Checked: ${candidates.join(", ")}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

async function isServerAlive(url) {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await isServerAlive(BASE_URL)) {
    return { owned: false, stop: async () => {} };
  }
  const parsed = new URL(BASE_URL);
  const port = parsed.port || "3000";
  const nextBin = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", port], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.unref();

  let stderrBuf = "";
  child.stderr.on("data", (d) => {
    stderrBuf += d.toString();
  });

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next server exited (${child.exitCode}): ${stderrBuf}`);
    }
    if (await isServerAlive(BASE_URL)) {
      return {
        owned: true,
        stop: async () => {
          killTree(child);
          try {
            child.stderr?.destroy();
          } catch {}
        },
      };
    }
    await sleep(250);
  }
  killTree(child);
  throw new Error(`Timed out waiting for ${BASE_URL}`);
}

class CdpClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve());
      this.ws.addEventListener("error", (err) => reject(err));
    });
    this.ws.addEventListener("message", (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(`CDP ${msg.error.code}: ${msg.error.message}`));
        } else {
          resolve(msg.result);
        }
      }
    });
  }

  async connect() {
    await this.ready;
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      const desc =
        res.exceptionDetails.exception?.description ||
        res.exceptionDetails.text ||
        "Evaluation error";
      throw new Error(desc);
    }
    return res.result?.value;
  }

  async pressEscape() {
    await this.send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
    await this.send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
    });
  }

  async moveMouse(x, y) {
    await this.send("Input.dispatchMouseEvent", {
      type: "mouseMoved",
      x,
      y,
      button: "none",
      pointerType: "mouse",
    });
  }

  async waitRaf(frames = 2) {
    await this.evaluate(`
      new Promise((resolve) => {
        let count = ${frames};
        const step = () => {
          if (--count <= 0) resolve();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      })
    `);
  }

  close() {
    this.ws.close();
  }
}

async function launchBrowser() {
  const chromeExe = resolveExecutable(CHROME_CANDIDATES, "Chromium");
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "apula-demo5s-"));
  const port = 9444 + Math.floor(Math.random() * 350);

  const args = [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    `--window-size=${VIEWPORT_WIDTH},${VIEWPORT_HEIGHT}`,
    `--force-device-scale-factor=${DEVICE_SCALE_FACTOR}`,
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--use-gl=angle",
    "--use-angle=swiftshader-webgl",
    "--enable-unsafe-swiftshader",
    "--no-first-run",
    "--no-default-browser-check",
    "--no-sandbox",
    "--disable-gpu-sandbox",
    "about:blank",
  ];

  const proc = spawn(chromeExe, args, {
    cwd: ROOT,
    stdio: "ignore",
  });
  proc.unref();

  let pageWsUrl = null;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`Chromium exited prematurely (${proc.exitCode})`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const targets = await res.json();
        const page = targets.find(
          (t) => t.type === "page" && t.webSocketDebuggerUrl,
        );
        if (page) {
          pageWsUrl = page.webSocketDebuggerUrl;
          break;
        }
      }
    } catch {
      // retry
    }
    await sleep(200);
  }

  if (!pageWsUrl) {
    killTree(proc);
    throw new Error("Timed out waiting for Chromium CDP endpoint");
  }

  const cdp = new CdpClient(pageWsUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    mobile: false,
  });

  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      try {
        window.localStorage.setItem("apula.onboardingSeen", "1");
        window.localStorage.setItem("apula-ui-theme", "clarity");
        window.localStorage.setItem("apula-compact-width", "false");
        window.localStorage.setItem("apula.reducedMotion", "false");
      } catch {}
    `,
  });

  return {
    cdp,
    stop: async () => {
      try {
        cdp.close();
      } catch {}
      killTree(proc);
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {}
    },
  };
}

async function nukeOverlaysBeforeShot(cdp) {
  await cdp.pressEscape();
  await sleep(100);
  await cdp.evaluate(`(() => {
    window.localStorage.setItem("apula.onboardingSeen", "1");

    document.querySelectorAll("dialog[open]").forEach((dlg) => {
      const btns = Array.from(dlg.querySelectorAll("button"));
      for (const b of btns) {
        const label = ((b.getAttribute("aria-label") || "") + " " + (b.textContent || "")).trim();
        if (/close|skip|jump straight|exit|dismiss/i.test(label)) {
          b.click();
        }
      }
      try { dlg.close(); } catch {}
      dlg.removeAttribute("open");
    });

    const tourSkip = Array.from(document.querySelectorAll("button"))
      .find((b) => /Skip Tour/i.test(b.textContent || ""));
    if (tourSkip) tourSkip.click();

    document.querySelectorAll("[popover]").forEach((el) => {
      try {
        if (el.matches(":popover-open") && typeof el.hidePopover === "function") {
          el.hidePopover();
        }
      } catch {}
    });

    // Only hide blocking full-screen/modal backdrops — preserve header, canvases,
    // native [popover] breakdown popovers, pinned telemetry HUD, and our promo HUD pill.
    document.querySelectorAll("body *").forEach((el) => {
      if (
        el.tagName === "HEADER" ||
        el.closest("header") ||
        el.tagName === "CANVAS" ||
        el.hasAttribute("popover") ||
        el.closest("[popover]") ||
        el.getAttribute("aria-label") === "Pinned Floating Telemetry HUD" ||
        el.closest('[aria-label="Pinned Floating Telemetry HUD"]') ||
        el.id === "apula-demo5s-hud" ||
        el.closest("#apula-demo5s-hud")
      ) {
        return;
      }
      const cs = window.getComputedStyle(el);
      const z = Number.parseInt(cs.zIndex, 10);
      if (cs.position === "fixed" && Number.isFinite(z) && z >= 150) {
        el.style.display = "none";
        el.style.pointerEvents = "none";
      }
    });
  })()`);
}

async function waitForReady(cdp) {
  await cdp.evaluate(`
    new Promise((resolve) => {
      const tick = () => {
        const headerImg = document.querySelector("header img");
        const canvas = document.querySelector('[data-tour="chamber"] canvas');
        if (document.readyState === "complete" && headerImg && canvas) {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        } else {
          setTimeout(tick, 80);
        }
      };
      tick();
    })
  `);
}

async function setClarityTheme(cdp) {
  await cdp.evaluate(`(() => {
    window.localStorage.setItem("apula-ui-theme", "clarity");
    document.documentElement.dataset.theme = "clarity";
    const btn = Array.from(document.querySelectorAll("header button"))
      .find((b) => /Studio Clarity/i.test(b.textContent || ""));
    if (btn) btn.click();
  })()`);
  await nukeOverlaysBeforeShot(cdp);
  await sleep(300);
}

async function ensureClarityHud(cdp) {
  await cdp.evaluate(`(() => {
    document.getElementById("apula-demo5s-hud")?.remove();
    const wrap = document.createElement("div");
    wrap.id = "apula-demo5s-hud";
    wrap.style.cssText = [
      "position: fixed",
      "top: 68px",
      "left: 50%",
      "transform: translateX(-50%)",
      "z-index: 2147483647",
      "display: inline-flex",
      "align-items: center",
      "gap: 10px",
      "padding: 6px 15px 6px 8px",
      "border-radius: 9999px",
      "background: rgba(255, 255, 255, 0.94)",
      "backdrop-filter: blur(16px)",
      "-webkit-backdrop-filter: blur(16px)",
      "border: 1px solid #D2D2D7",
      "box-shadow: 0 8px 28px rgba(0, 0, 0, 0.10), 0 1px 3px rgba(0, 0, 0, 0.06)",
      "pointer-events: none",
      "font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      "white-space: nowrap",
    ].join(";");

    const step = document.createElement("span");
    step.id = "apula-demo5s-step";
    step.textContent = "1/4";
    step.style.cssText = [
      "display: inline-flex",
      "align-items: center",
      "justify-content: center",
      "padding: 2px 9px",
      "border-radius: 9999px",
      "background: #0071E3",
      "color: #FFFFFF",
      "font-family: 'JetBrains Mono', ui-monospace, monospace",
      "font-size: 11px",
      "font-weight: 700",
      "letter-spacing: 0.03em",
    ].join(";");

    const label = document.createElement("span");
    label.id = "apula-demo5s-label";
    label.textContent = "Live 60 FPS Microgravity Physics & 3D Geometry";
    label.style.cssText = [
      "color: #1D1D1F",
      "font-size: 13px",
      "font-weight: 700",
      "letter-spacing: -0.015em",
    ].join(";");

    const meta = document.createElement("span");
    meta.id = "apula-demo5s-meta";
    meta.textContent = "";
    meta.style.cssText = [
      "color: #0071E3",
      "font-family: 'JetBrains Mono', ui-monospace, monospace",
      "font-size: 11px",
      "font-weight: 600",
      "padding-left: 8px",
      "border-left: 1px solid #D2D2D7",
      "display: none",
    ].join(";");

    wrap.appendChild(step);
    wrap.appendChild(label);
    wrap.appendChild(meta);
    document.body.appendChild(wrap);
  })()`);
}

async function setHudPill(cdp, stepText, labelText, metaText = "") {
  await cdp.evaluate(`(() => {
    const step = document.getElementById("apula-demo5s-step");
    const label = document.getElementById("apula-demo5s-label");
    const meta = document.getElementById("apula-demo5s-meta");
    if (step) step.textContent = ${JSON.stringify(stepText)};
    if (label) label.textContent = ${JSON.stringify(labelText)};
    if (meta) {
      meta.textContent = ${JSON.stringify(metaText)};
      meta.style.display = ${metaText ? "'inline-block'" : "'none'"};
    }
  })()`);
}

async function captureFrame(cdp, frameDir, index) {
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const file = path.join(frameDir, `frame_${String(index).padStart(4, "0")}.png`);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
}

function encodeDemoMedia(ffmpegExe, frameDir) {
  const inputPattern = path.join(frameDir, "frame_%04d.png");
  const stem = "GIF_3_Full_Site_5s_Feature_Demo__clarity";
  const gifPath = path.join(PROMO_DIR, `${stem}.gif`);
  const mp4Path = path.join(PROMO_DIR, `${stem}.mp4`);

  execFileSync(
    ffmpegExe,
    [
      "-y",
      "-framerate",
      String(TARGET_FPS),
      "-i",
      inputPattern,
      "-vf",
      `fps=${TARGET_FPS},scale=1280:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`,
      "-loop",
      "0",
      gifPath,
    ],
    { stdio: "pipe" },
  );

  execFileSync(
    ffmpegExe,
    [
      "-y",
      "-framerate",
      String(TARGET_FPS),
      "-i",
      inputPattern,
      "-vf",
      `fps=${TARGET_FPS},scale=1280:-2:flags=lanczos`,
      "-c:v",
      "libopenh264",
      "-b:v",
      "2600k",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4Path,
    ],
    { stdio: "pipe" },
  );

  return { gifPath, mp4Path };
}

async function record5SecDemo(cdp, ffmpegExe, tempRoot) {
  const frameDir = path.join(tempRoot, "demo5s");
  fs.mkdirSync(frameDir, { recursive: true });

  await setClarityTheme(cdp);
  await ensureClarityHud(cdp);

  // Configure initial Beat 1 physics: PMMA_SLAB_3MM + Cylindrical Rod [D/4]
  // Starting at O2=12.5%, Airflow=2.0 cm/s (LOI=13.34%, Margin=-0.84%, NO_IGNITION_QUENCHED)
  await cdp.evaluate(`(() => {
    window.scrollTo({ top: 0, behavior: "instant" });

    const matSelect = document.getElementById("ctrl-material");
    if (!matSelect) throw new Error("Material select #ctrl-material not found");
    const selectSetter = Object.getOwnPropertyDescriptor(
      window.HTMLSelectElement.prototype,
      "value",
    ).set;
    selectSetter.call(matSelect, "PMMA_SLAB_3MM");
    matSelect.dispatchEvent(new Event("change", { bubbles: true }));

    const rodBtn = Array.from(document.querySelectorAll('[data-tour="controls"] button'))
      .find((b) => /Cylindrical Rod/i.test(b.textContent || ""));
    if (!rodBtn) throw new Error("Cylindrical Rod [D/4] button not found");
    rodBtn.click();

    function setSlider(id, val) {
      const el = document.getElementById(id);
      if (!el) throw new Error("Slider not found: " + id);
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      setter.call(el, String(val));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }

    setSlider("ctrl-o2", 12.5);
    setSlider("ctrl-pressure", 14.7);
    setSlider("ctrl-airflow", 2.0);
    setSlider("ctrl-gravity", 0);
    setSlider("ctrl-efield", 0);
    setSlider("ctrl-co2", 0);

    // Pin the live floating Telemetry HUD at the bottom so Beat 1 at scrollY=0 shows
    // full live regime / LOI / Margin / Spread Rate / v_eff alongside the 3D WebGL chamber
    const pinBtn = Array.from(document.querySelectorAll('[data-tour="telemetry"] button'))
      .find((b) => /Pin Floating Telemetry HUD/i.test(b.textContent || ""));
    if (pinBtn) pinBtn.click();

    const collapseBtn = document.querySelector('button[aria-label="Collapse formula X-ray"]');
    if (collapseBtn) collapseBtn.click();
  })()`);

  await sleep(240);
  await cdp.waitRaf(3);

  const initialStateCheck = await cdp.evaluate(`(() => {
    const tText = document.querySelector('[data-tour="telemetry"]')?.textContent || "";
    const hudText = document.querySelector('[aria-label="Pinned Floating Telemetry HUD"]')?.textContent || "";
    return {
      isQuenched: /QUENCHED/i.test(tText) && /NO_IGNITION_QUENCHED/i.test(hudText),
      hudText: hudText.slice(0, 120),
    };
  })()`);
  console.log("Beat 1 initial quenched verification:", JSON.stringify(initialStateCheck));

  let frameIndex = 0;

  // =====================================================================
  // BEAT 1 (Frames 1–25, 0.0s – 1.4s): Live 3D Chamber + Slider Ignition
  // =====================================================================
  await setHudPill(
    cdp,
    "1/4",
    "Live 60 FPS Microgravity Physics & 3D Geometry",
    "O2 12.5% | 2.0 cm/s",
  );

  // 4 frames holding initial NO_IGNITION_QUENCHED state
  for (let i = 0; i < 4; i++) {
    await sleep(45);
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // 20 frames sweeping O2 12.5% -> 22.0% and Airflow 2.0 -> 14.0 cm/s
  for (let i = 1; i <= 20; i++) {
    const t = easeInOutCubic(i / 20);
    const o2 = Math.round((12.5 + (22.0 - 12.5) * t) * 2) / 2;
    const flow = Math.round((2.0 + (14.0 - 2.0) * t) * 2) / 2;

    await cdp.evaluate(`(() => {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set;
      const elO2 = document.getElementById("ctrl-o2");
      const elFlow = document.getElementById("ctrl-airflow");
      if (elO2) {
        setter.call(elO2, String(${o2}));
        elO2.dispatchEvent(new Event("input", { bubbles: true }));
        elO2.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (elFlow) {
        setter.call(elFlow, String(${flow}));
        elFlow.dispatchEvent(new Event("input", { bubbles: true }));
        elFlow.dispatchEvent(new Event("change", { bubbles: true }));
      }
    })()`);

    await setHudPill(
      cdp,
      "1/4",
      "Live 60 FPS Microgravity Physics & 3D Geometry",
      `O2 ${o2.toFixed(1)}% | ${flow.toFixed(1)} cm/s`,
    );

    await cdp.waitRaf(2);
    await sleep(45);
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // 1 frame holding peak IGNITED plume (Total Beat 1 = 25 frames)
  await sleep(45);
  await captureFrame(cdp, frameDir, frameIndex++);

  // =====================================================================
  // BEAT 2 (Frames 26–47, 1.4s – 2.6s): Provenance & Live Formula X-Ray
  // =====================================================================
  await setHudPill(cdp, "2/4", "Source Provenance & Live Equation X-Ray");

  // Unpin bottom HUD so Beat 2 spotlights the native Telemetry Dock & LOI Popover cleanly
  const beat2ScrollInfo = await cdp.evaluate(`(() => {
    const unpinBtn = Array.from(document.querySelectorAll('[aria-label="Pinned Floating Telemetry HUD"] button'))
      .find((b) => /Unpin HUD/i.test(b.textContent || ""));
    if (unpinBtn) unpinBtn.click();

    const telemetry = document.querySelector('[data-tour="telemetry"]');
    if (!telemetry) throw new Error("Telemetry dock missing");
    const startY = window.scrollY;
    const absTop = startY + telemetry.getBoundingClientRect().top;
    // Frame Telemetry Dock + Controls + Equation X-Ray cleanly below HUD pill
    const targetY = Math.max(0, Math.round(absTop - 135));
    return { startY, targetY };
  })()`);

  // 4 frames fast ease-out scroll to frame Live Combustion Telemetry & Sliders
  for (let s = 1; s <= 4; s++) {
    const t = easeOutCubic(s / 4);
    const y = Math.round(
      beat2ScrollInfo.startY + (beat2ScrollInfo.targetY - beat2ScrollInfo.startY) * t,
    );
    await cdp.evaluate(`window.scrollTo({ top: ${y}, behavior: "instant" })`);
    await cdp.waitRaf(2);
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // Trigger LOI % tile (inline activeXRay) + ? Popover (Formula & Provenance Breakdown)
  const beat2Trigger = await cdp.evaluate(`(() => {
    const telemetry = document.querySelector('[data-tour="telemetry"]');
    const loiArticle = Array.from(telemetry.querySelectorAll("article"))
      .find((a) => /Limiting O2/i.test(a.textContent || ""));
    if (!loiArticle) throw new Error("Limiting O2 tile article missing");
    loiArticle.id = "apula-demo5s-loi-card";

    const tileBtn = Array.from(loiArticle.querySelectorAll("button"))
      .find((b) => b.hasAttribute("aria-expanded") && /LOI/i.test(b.textContent || ""));
    if (tileBtn) tileBtn.click();

    const qBtn = Array.from(loiArticle.querySelectorAll("button"))
      .find((b) => /Inspect formula and provenance/i.test(b.getAttribute("aria-label") || ""));
    if (qBtn) qBtn.click();

    return { hasTileBtn: !!tileBtn, hasQBtn: !!qBtn };
  })()`);

  await cdp.waitRaf(3);

  const popState = await cdp.evaluate(`(() => {
    const pop = document.querySelector("[popover]:popover-open");
    if (!pop) return { open: false };
    const card = document.getElementById("apula-demo5s-loi-card")?.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    // Place the Formula & Provenance Breakdown popover cleanly beside the right edge of LOI card
    // or directly to the right inside the 2nd column gap so it does not cover the LOI tile
    if (card) {
      const desiredLeft = Math.min(window.innerWidth - popRect.width - 24, Math.round(card.right + 16));
      const desiredTop = Math.max(122, Math.min(window.innerHeight - popRect.height - 20, Math.round(card.top - 10)));
      pop.style.left = desiredLeft + "px";
      pop.style.top = desiredTop + "px";
    }
    const finalRect = pop.getBoundingClientRect();
    return {
      open: true,
      top: Math.round(finalRect.top),
      left: Math.round(finalRect.left),
      bottom: Math.round(finalRect.bottom),
      textLen: (pop.textContent || "").length,
    };
  })()`);
  console.log("Beat 2 Popover & X-Ray:", JSON.stringify({ ...beat2Trigger, popState }));

  // 18 hold frames with subtle #0071E3 focus ring pulse (Total Beat 2 = 4 + 18 = 22 frames)
  for (let i = 0; i < 18; i++) {
    const pulse = 0.5 + 0.5 * Math.sin((i / 17) * Math.PI * 3);
    const alpha = (0.50 + 0.45 * pulse).toFixed(2);
    const spread = (3 + 4 * pulse).toFixed(1);

    await cdp.evaluate(`(() => {
      const card = document.getElementById("apula-demo5s-loi-card");
      if (card) {
        card.style.boxShadow = "0 0 0 ${spread}px rgba(0, 113, 227, ${alpha})";
      }
      const pop = document.querySelector("[popover]:popover-open");
      if (pop) {
        pop.style.boxShadow = "0 20px 50px rgba(0, 0, 0, 0.16), 0 0 0 2px rgba(0, 113, 227, ${alpha})";
      }
    })()`);

    await sleep(45);
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // =====================================================================
  // BEAT 3 (Frames 48–68, 2.6s – 3.8s): Phase-Space U-Curves (0g/0.16g/0.38g)
  // =====================================================================
  await setHudPill(cdp, "3/4", "Partial-Gravity Phase Envelopes & U-Curves");

  const phaseScrollInfo = await cdp.evaluate(`(() => {
    const card = document.getElementById("apula-demo5s-loi-card");
    if (card) card.style.boxShadow = "";

    const closePopBtn = document.querySelector('button[aria-label="Close annotation"]');
    if (closePopBtn) closePopBtn.click();
    document.querySelectorAll("[popover]").forEach((el) => {
      try {
        if (el.matches(":popover-open") && typeof el.hidePopover === "function") {
          el.hidePopover();
        }
      } catch {}
    });

    const collapseBtn = document.querySelector('button[aria-label="Collapse formula X-ray"]');
    if (collapseBtn) collapseBtn.click();

    const phaseSection = document.getElementById("phase-charts");
    if (!phaseSection) throw new Error("#phase-charts section not found");

    const pinsBtn = Array.from(phaseSection.querySelectorAll("button"))
      .find((b) => /Show Empirical Pins/i.test(b.textContent || ""));
    if (pinsBtn) pinsBtn.click();

    const startY = window.scrollY;
    const grid = phaseSection.querySelector(".grid.grid-cols-1.lg\\\\:grid-cols-2");
    const targetEl = grid || phaseSection;
    const absTop = startY + targetEl.getBoundingClientRect().top;
    // Scroll cleanly so top of Charts 3A/3B headings sit ~128px below viewport top (below HUD pill)
    const targetY = Math.max(0, Math.round(absTop - 130));
    return { startY, targetY };
  })()`);

  // 9 frames smooth ease-out scroll to Section 3
  for (let s = 1; s <= 9; s++) {
    const t = easeOutCubic(s / 9);
    const y = Math.round(
      phaseScrollInfo.startY + (phaseScrollInfo.targetY - phaseScrollInfo.startY) * t,
    );
    await cdp.evaluate(`window.scrollTo({ top: ${y}, behavior: "instant" })`);
    await cdp.waitRaf(2);
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // Locate and hover a clustered BASS-II flight test pin inside Chart 3A or 3B
  const pinCenters = await cdp.evaluate(`(() => {
    const svgs = Array.from(document.querySelectorAll("#phase-charts svg"));
    const candidates = [];
    for (let sIdx = 0; sIdx < svgs.length; sIdx++) {
      const groups = Array.from(svgs[sIdx].querySelectorAll("g.cursor-pointer"));
      for (const g of groups) {
        const circle = g.querySelector("circle");
        const txt = g.querySelector("text");
        if (!circle) continue;
        const r = circle.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const count = txt ? Number.parseInt(txt.textContent || "1", 10) || 1 : 1;
        candidates.push({
          sIdx,
          count,
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2),
        });
      }
    }
    candidates.sort((a, b) => b.count - a.count);
    return candidates.slice(0, 24);
  })()`);

  let hoveredPinInfo = null;
  for (const cand of pinCenters) {
    await cdp.moveMouse(cand.x, cand.y);
    await sleep(30);
    const panelText = await cdp.evaluate(`(() => {
      const p = document.querySelector("#phase-charts .ap-hud-panel");
      return p ? p.textContent.trim() : null;
    })()`);
    if (panelText && /Campaigns:\s*BASS-II/i.test(panelText)) {
      hoveredPinInfo = { cand, panelText };
      break;
    }
    if (panelText && /BASS-II/i.test(panelText) && (!hoveredPinInfo || !/BASS-II/i.test(hoveredPinInfo.panelText))) {
      hoveredPinInfo = { cand, panelText };
    }
    if (panelText && !hoveredPinInfo) {
      hoveredPinInfo = { cand, panelText };
    }
  }
  if (hoveredPinInfo) {
    await cdp.moveMouse(hoveredPinInfo.cand.x, hoveredPinInfo.cand.y);
    console.log("Beat 3 Hovered Cluster Tooltip:", JSON.stringify(hoveredPinInfo));
  } else {
    console.warn("Beat 3 warning: no cluster tooltip opened from candidates");
  }

  // 12 hold frames showing U-Curves + BASS-II Cluster Tooltip (Total Beat 3 = 9 + 12 = 21 frames)
  for (let h = 0; h < 12; h++) {
    await sleep(45);
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // =====================================================================
  // BEAT 4 (Frames 69–90, 3.8s – 5.0s): 654-Run NASA ISS Empirical Matcher
  // =====================================================================
  await setHudPill(cdp, "4/4", "654 NASA ISS Flight Tests Cross-Checked Live");
  await cdp.moveMouse(10, 10);

  const sec6Info = await cdp.evaluate(`(() => {
    const tblRegion = document.querySelector('[aria-label="Closest NASA Flight Test Runs Table"]');
    if (!tblRegion) throw new Error("Closest NASA Flight Test Runs table missing");
    const sec = tblRegion.closest("section");
    const startY = window.scrollY;
    const absTop = startY + (sec || tblRegion).getBoundingClientRect().top;
    // Align Section 6 top border cleanly right below header + HUD pill so Section 5 does not peek behind HUD
    const targetY = Math.max(0, Math.round(absTop - 88));
    return { startY, targetY };
  })()`);

  // 8 frames smooth ease-out scroll down to Section 6
  for (let s = 1; s <= 8; s++) {
    const t = easeOutCubic(s / 8);
    const y = Math.round(sec6Info.startY + (sec6Info.targetY - sec6Info.startY) * t);
    await cdp.evaluate(`window.scrollTo({ top: ${y}, behavior: "instant" })`);
    await cdp.waitRaf(2);
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // 14 frames scanning NASA campaigns (BASS-II -> SAFFIRE-3) (Total Beat 4 = 8 + 14 = 22 frames)
  const campaigns = ["BASS-II", "SAFFIRE-3"];
  for (let cIdx = 0; cIdx < campaigns.length; cIdx++) {
    const cid = campaigns[cIdx];
    const framesForCamp = 7;

    await cdp.evaluate(`(() => {
      const tblRegion = document.querySelector('[aria-label="Closest NASA Flight Test Runs Table"]');
      const sec = tblRegion?.closest("section") || document;
      const btn = Array.from(sec.querySelectorAll("button"))
        .find((b) => (b.textContent || "").trim().startsWith(${JSON.stringify(cid)} + " ("));
      if (btn) btn.click();
    })()`);
    await cdp.waitRaf(2);

    for (let step = 0; step < framesForCamp; step++) {
      const fillFrac = Math.min(1, (step + 2) / 5);
      await cdp.evaluate(`(() => {
        const rows = Array.from(document.querySelectorAll('[aria-label="Closest NASA Flight Test Runs Table"] tbody tr'));
        const activeRowIdx = Math.min(
          Math.max(0, rows.length - 1),
          Math.floor((${step} / Math.max(1, ${framesForCamp - 1})) * Math.min(3, Math.max(1, rows.length))),
        );
        rows.forEach((tr, idx) => {
          const isActive = idx === activeRowIdx;
          tr.classList.toggle("ap-scanner-row-active", isActive);
          tr.querySelectorAll(".ap-prov-measured, .ap-prov-inferred, .ap-prov-defaulted").forEach((badge) => {
            badge.style.boxShadow = isActive ? "0 0 0 2px #0071E3, 0 0 10px rgba(0, 113, 227, 0.45)" : "";
            badge.style.transform = isActive ? "scale(1.04)" : "";
          });
        });

        document.querySelectorAll(".ap-matcher-bar").forEach((bar) => {
          const target = Number(bar.dataset.targetPct || "85");
          bar.style.transition = "width 180ms cubic-bezier(0.22, 1, 0.36, 1)";
          bar.style.width = Math.max(10, Math.round(target * ${fillFrac})) + "%";
        });
      })()`);
      await setHudPill(
        cdp,
        "4/4",
        "654 NASA ISS Flight Tests Cross-Checked Live",
        `MATCH SCAN: ${cid}`,
      );
      await sleep(45);
      await captureFrame(cdp, frameDir, frameIndex++);
    }
  }

  await cdp.evaluate(`(() => {
    document.querySelectorAll('[aria-label="Closest NASA Flight Test Runs Table"] tbody tr')
      .forEach((tr) => tr.classList.remove("ap-scanner-row-active"));
    document.getElementById("apula-demo5s-hud")?.remove();
  })()`);

  if (frameIndex !== TOTAL_FRAMES) {
    throw new Error(`Expected exact ${TOTAL_FRAMES} frames, captured ${frameIndex}`);
  }

  const out = encodeDemoMedia(ffmpegExe, frameDir);
  return { ...out, frameCount: frameIndex };
}

async function main() {
  fs.mkdirSync(PROMO_DIR, { recursive: true });
  const ffmpegExe = resolveExecutable(FFMPEG_CANDIDATES, "FFmpeg");
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "apula-demo5s-frames-"));
  const server = await ensureServer();
  const browser = await launchBrowser();
  const { cdp } = browser;

  try {
    await cdp.send("Page.navigate", { url: BASE_URL });
    await waitForReady(cdp);
    await nukeOverlaysBeforeShot(cdp);

    const result = await record5SecDemo(cdp, ffmpegExe, tempRoot);

    console.log("\n=== 5-SECOND PROMOTIONAL DEMO REEL SUMMARY ===");
    console.log(
      `Captured Frames : ${result.frameCount} @ ${TARGET_FPS} FPS (${(result.frameCount / TARGET_FPS).toFixed(2)}s)`,
    );
    for (const file of [result.gifPath, result.mp4Path]) {
      const stat = fs.statSync(file);
      if (stat.size <= 0) throw new Error(`Empty output file: ${file}`);
      console.log(
        `${path.basename(file).padEnd(48)} | ${(stat.size / 1024).toFixed(1)} KB`,
      );
    }
  } finally {
    await browser.stop();
    await server.stop();
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {}
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
