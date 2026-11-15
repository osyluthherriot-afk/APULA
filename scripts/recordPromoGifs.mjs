import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawn } from "node:child_process";

const ROOT = process.cwd();
const PROMO_DIR = path.join(ROOT, "documentation", "promo");
const BASE_URL = process.env.APULA_URL || "http://127.0.0.1:3000";

const FFMPEG_GIF_MP4_CANDIDATES = [
  process.env.FFMPEG_PATH,
  "C:\\Program Files\\Krita (x64)\\bin\\ffmpeg.exe",
  "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
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
    // process may have exited already
  }
}

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

function resolveExecutable(candidates, label) {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`${label} not found. Checked: ${candidates.join(", ")}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    stdio: ["ignore", "pipe", "pipe"],
  });

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
        },
      };
    }
    await sleep(250);
  }
  child.kill("SIGKILL");
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

  close() {
    this.ws.close();
  }
}

async function launchBrowser() {
  const chromeExe = resolveExecutable(CHROME_CANDIDATES, "Chromium");
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "apula-gif-cdp-"));
  const port = 9444 + Math.floor(Math.random() * 350);

  const args = [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--window-size=1280,720",
    "--force-device-scale-factor=1",
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
    stdio: ["ignore", "pipe", "pipe"],
  });

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
    proc.kill("SIGKILL");
    throw new Error("Timed out waiting for Chromium CDP endpoint");
  }

  const cdp = new CdpClient(pageWsUrl);
  await cdp.connect();
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      try {
        window.localStorage.setItem("apula.onboardingSeen", "1");
        window.localStorage.setItem("apula-ui-theme", "glass");
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

    document.querySelectorAll("body *").forEach((el) => {
      if (
        el.tagName === "HEADER" ||
        el.closest("header") ||
        el.tagName === "CANVAS" ||
        el.id === "apula-promo-hud" ||
        el.closest("#apula-promo-hud")
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
        if (document.readyState === "complete" && document.querySelector("header img")) {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        } else {
          setTimeout(tick, 80);
        }
      };
      tick();
    })
  `);
}

async function setGlassTheme(cdp) {
  await cdp.evaluate(`(() => {
    window.localStorage.setItem("apula-ui-theme", "glass");
    document.documentElement.dataset.theme = "glass";
  })()`);
  await nukeOverlaysBeforeShot(cdp);
  await sleep(900);
}

async function captureFrame(cdp, frameDir, index) {
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const file = path.join(frameDir, `frame_${String(index).padStart(4, "0")}.png`);
  fs.writeFileSync(file, Buffer.from(data, "base64"));
}

function encodeMedia(ffmpegExe, _unusedWebm, frameDir, stem, widthScale = 1280) {
  const inputPattern = path.join(frameDir, "frame_%04d.png");
  const gifPath = path.join(PROMO_DIR, `${stem}.gif`);
  const mp4Path = path.join(PROMO_DIR, `${stem}.mp4`);
  const webmPath = path.join(PROMO_DIR, `${stem}.webm`);

  execFileSync(
    ffmpegExe,
    [
      "-y",
      "-framerate",
      "18",
      "-i",
      inputPattern,
      "-vf",
      `fps=18,scale=${widthScale}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`,
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
      "18",
      "-i",
      inputPattern,
      "-vf",
      `fps=18,scale=${widthScale}:-2:flags=lanczos`,
      "-c:v",
      "libopenh264",
      "-b:v",
      "2400k",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      mp4Path,
    ],
    { stdio: "pipe" },
  );

  execFileSync(
    ffmpegExe,
    [
      "-y",
      "-framerate",
      "18",
      "-i",
      inputPattern,
      "-vf",
      `fps=18,scale=${widthScale}:-2:flags=lanczos`,
      "-c:v",
      "libaom-av1",
      "-crf",
      "32",
      "-b:v",
      "0",
      "-cpu-used",
      "8",
      "-row-mt",
      "1",
      "-pix_fmt",
      "yuv420p",
      webmPath,
    ],
    { stdio: "pipe" },
  );

  return { gifPath, mp4Path, webmPath };
}

async function recordGif1(cdp, ffmpegGifMp4Exe, ffmpegWebmExe, tempRoot) {
  const frameDir = path.join(tempRoot, "gif1_frames");
  fs.mkdirSync(frameDir, { recursive: true });

  // Configure single-column centered viewport (< 1024px breakpoint) tall enough so header + full Telemetry Dock
  // + expanded LOI equation card fit unclipped while sliders remain cleanly off-screen below.
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1008,
    height: 780,
    deviceScaleFactor: 2,
    mobile: false,
  });
  await sleep(350);
  await nukeOverlaysBeforeShot(cdp);

  // Set baseline values silently via React range input events BEFORE locking camera
  await cdp.evaluate(`(() => {
    function setReactSliderOffscreen(sliderIndex, newValue) {
      const sliders = document.querySelectorAll('input[type="range"]');
      const input = sliders[sliderIndex];
      if (!input) return;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      ).set;
      nativeInputValueSetter.call(input, String(newValue));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setReactSliderOffscreen(0, 14.0); // O2
    setReactSliderOffscreen(1, 14.7); // Pressure
    setReactSliderOffscreen(2, 25.0); // Airflow
    setReactSliderOffscreen(3, 0.0);  // Gravity
    setReactSliderOffscreen(4, 0);    // E-Field
    setReactSliderOffscreen(5, 0);    // CO2

    // Open the inline Limiting O2 (LOI %) formula X-Ray box inside the Telemetry Dock
    const box = document.querySelector('[data-tour="telemetry"]');
    if (box) {
      const loiBtn = Array.from(box.querySelectorAll("button"))
        .find((b) => (b.textContent || "").includes("% LOI"));
      if (loiBtn && loiBtn.getAttribute("aria-expanded") !== "true") {
        loiBtn.click();
      }
    }
  })()`);
  await sleep(300);

  // Anchor Telemetry Dock cleanly below the sticky header so heading + all 6 tiles + equation card fit unclipped
  await cdp.evaluate(`(() => {
    const telemetry = document.querySelector('[data-tour="telemetry"]');
    if (!telemetry) throw new Error("Telemetry dock missing");
    const headerHeight = document.querySelector("header")?.getBoundingClientRect().height || 104;
    const targetY = Math.round(telemetry.getBoundingClientRect().top + window.scrollY - headerHeight - 18);
    window.scrollTo({ top: targetY, behavior: "instant" });
    window.__apulaGif1LockY = window.scrollY;

    // Install HUD corner overlay pill inside telemetry card container
    const headerRow = telemetry.firstElementChild;
    let hud = document.getElementById("apula-gif1-hud");
    if (!hud) {
      hud = document.createElement("div");
      hud.id = "apula-gif1-hud";
      hud.style.cssText = [
        "font-family: ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size: 11px",
        "font-weight: 600",
        "letter-spacing: 0.02em",
        "padding: 6px 11px",
        "border-radius: 9999px",
        "border: 1px solid rgba(56,189,248,0.48)",
        "background: rgba(8,14,32,0.82)",
        "color: #E0F2FE",
        "box-shadow: 0 4px 16px rgba(0,113,227,0.28)",
        "display: inline-flex",
        "align-items: center",
        "gap: 8px",
        "margin-top: 2px",
      ].join(";");
      telemetry.insertBefore(hud, headerRow.nextSibling);
    }
  })()`);

  const setSweepState = async (o2, airflow, efield, hudText) => {
    await cdp.evaluate(`(() => {
      function setReactSliderOffscreen(sliderIndex, newValue) {
        const sliders = document.querySelectorAll('input[type="range"]');
        const input = sliders[sliderIndex];
        if (!input) return;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        ).set;
        nativeInputValueSetter.call(input, String(newValue));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      setReactSliderOffscreen(0, ${o2});
      setReactSliderOffscreen(2, ${airflow});
      setReactSliderOffscreen(4, ${efield});
      window.scrollTo({ top: window.__apulaGif1LockY, behavior: "instant" });

      // Assert sliders remain cleanly outside viewport while Telemetry Dock is framed
      const hud = document.getElementById("apula-gif1-hud");
      if (hud) {
        hud.innerHTML = '<span style="display:inline-block;width:7px;height:7px;border-radius:9999px;background:#38BDF8;box-shadow:0 0 8px #38BDF8;"></span><span>' + ${JSON.stringify(hudText)} + '</span>';
      }
    })()`);
    await sleep(55);
  };

  let frameIndex = 1;

  // Verify modals are zero and controls are outside viewport once
  const framingCheck = await cdp.evaluate(`(() => {
    const tRect = document.querySelector('[data-tour="telemetry"]').getBoundingClientRect();
    const cRect = document.querySelector('[data-tour="controls"]').getBoundingClientRect();
    const dialogs = document.querySelectorAll("dialog[open]").length;
    return {
      telemetryTop: Math.round(tRect.top),
      telemetryBottom: Math.round(tRect.bottom),
      controlsTop: Math.round(cRect.top),
      viewportHeight: window.innerHeight,
      dialogs,
    };
  })()`);
  if (framingCheck.dialogs > 0) {
    throw new Error(`Modal still open before GIF 1: ${JSON.stringify(framingCheck)}`);
  }
  if (framingCheck.controlsTop < framingCheck.viewportHeight - 4) {
    throw new Error(`Controls visible during GIF 1: ${JSON.stringify(framingCheck)}`);
  }

  // Phase A (Frames 1–30): Oxygen Ignition Ramp 14.0% -> 24.0% @ 25 cm/s Airflow
  for (let i = 0; i < 30; i++) {
    const progress = i / 29;
    const rawO2 = 14.0 + progress * 10.0;
    const o2 = Math.round(rawO2 * 2) / 2; // match step=0.5
    const hudText = `LIVE PARAMETER SWEEP: O2 ${o2.toFixed(1)}% (14.0% → 24.0%) | AIRFLOW 25.0 cm/s | E-FIELD 0 V/cm`;
    await setSweepState(o2, 25.0, 0, hudText);
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // Phase B (Frames 31–60): Microgravity Fan Drawdown 25.0 -> 1.0 cm/s @ 24.0% O2
  for (let i = 0; i < 30; i++) {
    const progress = i / 29;
    const rawAir = 25.0 - progress * 24.0;
    const air = Math.round(rawAir * 2) / 2; // match step=0.5
    const hudText = `LIVE PARAMETER SWEEP: O2 24.0% | AIRFLOW ${air.toFixed(1)} cm/s (25.0 → 1.0) | E-FIELD 0 V/cm`;
    await setSweepState(24.0, air, 0, hudText);
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // Brief hold on spherical transition before E-Field boost (Frames 61–64)
  for (let i = 0; i < 4; i++) {
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // Phase C (Frames 65–88): ACME E-Field Boost 0 -> 1100 V/cm (0.00g -> 0.16g Lunar)
  for (let i = 0; i < 24; i++) {
    const progress = i / 23;
    const rawEf = progress * 1100;
    const efield = Math.round(rawEf / 25) * 25; // match step=25
    const hudText = `LIVE PARAMETER SWEEP: O2 24.0% | AIRFLOW 1.0 cm/s | ACME E-FIELD ${efield} V/cm (→ 0.16g Lunar)`;
    await setSweepState(24.0, 1.0, efield, hudText);
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // Brief hold on peak Lunar E-Field equivalence (Frames 89–94)
  for (let i = 0; i < 6; i++) {
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // Remove injected HUD element cleanly
  await cdp.evaluate(`document.getElementById("apula-gif1-hud")?.remove()`);

  return encodeMedia(
    ffmpegGifMp4Exe,
    ffmpegWebmExe,
    frameDir,
    "GIF_1_Live_Telemetry_Offscreen_Slider_Sweep",
    1280,
  );
}

async function recordGif2(cdp, ffmpegGifMp4Exe, ffmpegWebmExe, tempRoot) {
  const frameDir = path.join(tempRoot, "gif2_frames");
  fs.mkdirSync(frameDir, { recursive: true });

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(350);
  await nukeOverlaysBeforeShot(cdp);

  // Reset simulator sliders to Lunar/ISS Baseline via inline Lunar Base pill for rich campaign matching
  await cdp.evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('[data-tour="controls"] button'))
      .find((b) => (b.querySelector("div")?.textContent || b.textContent || "").trim() === "ISS");
    if (btn) btn.click();

    // Ensure "All Campaigns" filter is active initially
    const allBtn = Array.from(document.querySelectorAll("button"))
      .find((b) => /^All Campaigns/.test((b.textContent || "").trim()));
    if (allBtn) allBtn.click();
  })()`);
  await sleep(300);

  // Measure section anchors and inject floating Mission Control Broadcast HUD overlays
  const anchors = await cdp.evaluate(`(() => {
    const findSectionByHeading = (text) => {
      const h = Array.from(document.querySelectorAll("h2, h3")).find((el) =>
        (el.textContent || "").includes(text)
      );
      return h ? h.closest("section") : null;
    };
    const sec4 = findSectionByHeading("NASA PSI Investigation Ranker");
    const sec5 = findSectionByHeading("Intra- vs. Inter-Investigation Comparison Matrix");
    const sec6 = findSectionByHeading("Closest NASA Flight Test Runs");
    if (!sec4 || !sec5 || !sec6) throw new Error("Sections 4-6 missing");

    const topOf = (el, offset) =>
      Math.round(el.getBoundingClientRect().top + window.scrollY - offset);

    // Mount sleek dual-corner Mission Control Broadcast HUD along the bottom safe-zone ribbon
    let hud = document.getElementById("apula-promo-hud");
    if (!hud) {
      hud = document.createElement("div");
      hud.id = "apula-promo-hud";
      hud.innerHTML =
        '<div id="apula-promo-top-bar" style="position:fixed;bottom:14px;left:20px;z-index:260;padding:8px 14px;border-radius:12px;border:1px solid rgba(56,189,248,0.45);background:rgba(7,12,26,0.92);backdrop-filter:blur(12px);color:#F8FAFC;font-family:ui-monospace,monospace;font-size:11px;font-weight:700;letter-spacing:0.03em;box-shadow:0 8px 24px rgba(0,0,0,0.45);">654 NASA PSI FLIGHT RUNS | 8 ORBITAL CAMPAIGNS | 95.1%–100% CONCORDANCE</div>' +
        '<div id="apula-promo-scan-pill" style="position:fixed;bottom:14px;right:20px;z-index:260;display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:12px;border:1px solid rgba(0,113,227,0.65);background:rgba(7,12,26,0.92);backdrop-filter:blur(12px);color:#BAE6FD;font-family:ui-monospace,monospace;font-size:11px;font-weight:700;box-shadow:0 8px 24px rgba(0,113,227,0.32);">' +
        '<span style="width:8px;height:8px;border-radius:9999px;background:#38BDF8;box-shadow:0 0 10px #38BDF8;"></span>' +
        '<span id="apula-promo-scan-text">SCANNING ISS TELEMETRY: BASS-II → SAFFIRE-3 → FLEX</span></div>';
      document.body.appendChild(hud);
    }

    return {
      y4: topOf(sec4, 82),
      y5: topOf(sec5, 82),
      y6: topOf(sec6, 82),
    };
  })()`);

  const easeInOut = (t) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  let frameIndex = 1;

  // Phase A (Frames 1–36): Smooth ease-in-out scroll from Section 4 -> Section 5 -> Section 6
  const startY = anchors.y4;
  const endY = anchors.y6;
  const scrollFrames = 36;
  await cdp.evaluate(`window.scrollTo({ top: ${startY}, behavior: "instant" })`);
  await sleep(120);

  for (let i = 0; i < scrollFrames; i++) {
    const t = i / (scrollFrames - 1);
    const y = Math.round(startY + (endY - startY) * easeInOut(t));
    const phaseLabel =
      y < anchors.y5 - 120
        ? "SCANNING DYNAMIC PSI INVESTIGATION RANKER (SECTION 4)"
        : y < anchors.y6 - 140
          ? "CROSS-COMPARING HARDWARE & REGIMES (SECTION 5)"
          : "LOCKING ON EMPIRICAL NASA FLIGHT TEST MATCHER (SECTION 6)";

    await cdp.evaluate(`(() => {
      window.scrollTo({ top: ${y}, behavior: "instant" });
      const labelEl = document.getElementById("apula-promo-scan-text");
      if (labelEl) labelEl.textContent = ${JSON.stringify(phaseLabel)};
    })()`);
    await sleep(45);
    await captureFrame(cdp, frameDir, frameIndex++);
  }

  // Phase B (Frames 37–96): Campaign spotlight sweep (BASS -> BASS-II -> SAFFIRE-3 -> FLEX -> SAME -> DAFT)
  const campaigns = [
    { cid: "BASS", meta: "122 ISS RUNS · 95.08% MATCH" },
    { cid: "BASS-II", meta: "129 ISS RUNS · 98.45% MATCH" },
    { cid: "SAFFIRE-3", meta: "2 CYGNUS RUNS · 100% MATCH" },
    { cid: "FLEX", meta: "274 DROPLET RUNS · EXTINCTION LEDGER" },
    { cid: "SAME", meta: "8 AEROSOL RUNS · PIMS SMOKE SIZING" },
    { cid: "DAFT", meta: "2 DISCRIMINATION RUNS · DUST VS SMOKE" },
  ];

  for (const camp of campaigns) {
    // Click the actual campaign button inside Section 6
    await cdp.evaluate(`(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        (b.textContent || "").trim().startsWith(${JSON.stringify(camp.cid)} + " (")
      );
      if (btn) btn.click();

      // Re-anchor smoothly to keep table rows framed
      const table = document.querySelector('[aria-label="Closest NASA Flight Test Runs Table"]');
      if (table) {
        const sec6 = table.closest("section");
        if (sec6) {
          const targetY = Math.round(sec6.getBoundingClientRect().top + window.scrollY - 78);
          window.scrollTo({ top: targetY, behavior: "instant" });
        }
      }

      // Reset match bar widths briefly so each campaign cascade fills 0% -> target%
      document.querySelectorAll(".ap-matcher-bar").forEach((bar) => {
        bar.style.transition = "none";
        bar.style.width = "0%";
      });
    })()`);
    await sleep(35);

    const rowCount = await cdp.evaluate(`(() => {
      const rows = document.querySelectorAll('[aria-label="Closest NASA Flight Test Runs Table"] tbody tr');
      return rows.length;
    })()`);

    // 10 frames per campaign = 60 frames total: animate bar fill + cascade laser-scan highlight down rows
    for (let step = 0; step < 10; step++) {
      const activeRowIdx = Math.min(
        Math.max(0, rowCount - 1),
        Math.floor((step / 9) * Math.max(1, rowCount)),
      );
      const fillFrac = Math.min(1, (step + 1) / 4);

      await cdp.evaluate(`(() => {
        const labelEl = document.getElementById("apula-promo-scan-text");
        if (labelEl) {
          labelEl.textContent = ${JSON.stringify(`SCANNING ISS TELEMETRY: ${camp.cid} (${camp.meta})`)};
        }

        const rows = Array.from(document.querySelectorAll('[aria-label="Closest NASA Flight Test Runs Table"] tbody tr'));
        rows.forEach((tr, idx) => {
          const isActive = idx === ${activeRowIdx};
          tr.classList.toggle("ap-scanner-row-active", isActive);
          tr.querySelectorAll(".ap-prov-measured, .ap-prov-inferred, .ap-prov-defaulted").forEach((badge) => {
            badge.style.boxShadow = isActive ? "0 0 12px rgba(56,189,248,0.85)" : "";
            badge.style.transform = isActive ? "scale(1.04)" : "";
          });
        });

        document.querySelectorAll(".ap-matcher-bar").forEach((bar) => {
          const target = Number(bar.dataset.targetPct || "85");
          bar.style.transition = "width 180ms cubic-bezier(0.22, 1, 0.36, 1)";
          bar.style.width = Math.max(8, Math.round(target * ${fillFrac})) + "%";
        });
      })()`);
      await sleep(55);
      await captureFrame(cdp, frameDir, frameIndex++);
    }
  }

  await cdp.evaluate(`(() => {
    document.querySelectorAll('[aria-label="Closest NASA Flight Test Runs Table"] tbody tr')
      .forEach((tr) => tr.classList.remove("ap-scanner-row-active"));
    document.getElementById("apula-promo-hud")?.remove();
  })()`);

  return encodeMedia(
    ffmpegGifMp4Exe,
    ffmpegWebmExe,
    frameDir,
    "GIF_2_Spaceflight_Campaigns_Scroll_Showcase",
    1280,
  );
}

async function main() {
  fs.mkdirSync(PROMO_DIR, { recursive: true });
  const onlyGif2 = process.argv.includes("--only=gif2");
  const onlyGif1 = process.argv.includes("--only=gif1");
  const ffmpegGifMp4Exe = resolveExecutable(
    FFMPEG_GIF_MP4_CANDIDATES,
    "FFmpeg (GIF/MP4/WebM)",
  );
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "apula-gif-frames-"));
  const server = await ensureServer();
  const browser = await launchBrowser();
  const { cdp } = browser;

  try {
    await cdp.send("Page.navigate", { url: BASE_URL });
    await waitForReady(cdp);
    await nukeOverlaysBeforeShot(cdp);
    await setGlassTheme(cdp);

    const files = [];
    if (!onlyGif2) {
      const out1 = await recordGif1(cdp, ffmpegGifMp4Exe, ffmpegGifMp4Exe, tempRoot);
      files.push(out1.gifPath, out1.mp4Path, out1.webmPath);
    }
    if (!onlyGif1) {
      const out2 = await recordGif2(cdp, ffmpegGifMp4Exe, ffmpegGifMp4Exe, tempRoot);
      files.push(out2.gifPath, out2.mp4Path, out2.webmPath);
    }

    console.log("\n=== PROMOTIONAL MOTION CAPTURE SUMMARY (documentation/promo/) ===");
    for (const file of files) {
      const stat = fs.statSync(file);
      if (stat.size <= 0) throw new Error(`Empty output file: ${file}`);
      console.log(`${path.basename(file).padEnd(56)} | ${(stat.size / 1024).toFixed(1)} KB`);
    }
  } finally {
    await browser.stop();
    await server.stop();
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
