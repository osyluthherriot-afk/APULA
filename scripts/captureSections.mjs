import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const PROMO_DIR = path.join(ROOT, "documentation", "promo");
const BASE_URL = process.env.APULA_URL || "http://127.0.0.1:3000";
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
  path.join(
    os.homedir(),
    "AppData",
    "Local",
    "ms-playwright",
    "chromium-1248",
    "chrome-win",
    "chrome.exe",
  ),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

function findBrowserExecutable() {
  for (const candidate of CHROME_CANDIDATES) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    `No Chromium/Chrome executable found. Checked: ${CHROME_CANDIDATES.join(", ")}`,
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readPngDimensions(buffer) {
  if (buffer.length < 24 || buffer.toString("ascii", 1, 4) !== "PNG") {
    return { width: 0, height: 0 };
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
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
      throw new Error(
        `Next server exited prematurely (${child.exitCode}): ${stderrBuf}`,
      );
    }
    if (await isServerAlive(BASE_URL)) {
      return {
        owned: true,
        stop: async () => {
          child.kill("SIGTERM");
          await sleep(400);
          if (child.exitCode === null) child.kill("SIGKILL");
        },
      };
    }
    await sleep(300);
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
  const exe = findBrowserExecutable();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "apula-cdp-"));
  const port = 9333 + Math.floor(Math.random() * 400);

  const args = [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--window-size=1920,1080",
    "--force-device-scale-factor=2",
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

  const proc = spawn(exe, args, {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const cdpVersionUrl = `http://127.0.0.1:${port}/json/list`;
  let pageWsUrl = null;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) {
      throw new Error(`Chromium exited prematurely (${proc.exitCode})`);
    }
    try {
      const res = await fetch(cdpVersionUrl);
      if (res.ok) {
        const targets = await res.json();
        const page = targets.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
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
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 2,
    mobile: false,
  });

  // Rule 1: Pre-seed localStorage before ANY React / ThemeScript code executes
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
      } catch {
        // ignore
      }
      proc.kill("SIGTERM");
      await sleep(300);
      if (proc.exitCode === null) proc.kill("SIGKILL");
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        // ignore temp cleanup failure
      }
    },
  };
}

async function waitForPageReady(cdp) {
  await cdp.evaluate(`
    new Promise((resolve) => {
      const check = () => {
        const loaded = document.readyState === "complete";
        const root = document.querySelector("header img");
        if (loaded && root) {
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    })
  `);
}

// Rule 2: Programmatically dismiss every modal, tour overlay, or open popover unless allowed
async function forceClearModalsAndOverlays(cdp, keepPopoverSelector = null) {
  await cdp.pressEscape();
  await sleep(120);

  await cdp.evaluate(`(() => {
    window.localStorage.setItem("apula.onboardingSeen", "1");

    // 1. Click visible close / skip / jump-straight buttons in open dialogs or tour
    const dialogButtons = Array.from(document.querySelectorAll("dialog[open] button"));
    for (const btn of dialogButtons) {
      const txt = ((btn.getAttribute("aria-label") || "") + " " + (btn.textContent || "")).trim();
      if (/close|skip|jump straight|exit|dismiss/i.test(txt)) {
        btn.click();
      }
    }

    const tourSkip = Array.from(document.querySelectorAll("button"))
      .find((b) => /Skip Tour/i.test(b.textContent || ""));
    if (tourSkip) tourSkip.click();

    // 2. Close any remaining native dialogs via .close()
    document.querySelectorAll("dialog[open]").forEach((dlg) => {
      try { dlg.close(); } catch {}
      dlg.removeAttribute("open");
    });

    // 3. Close any open popovers unless preserved for Section 2 X-Ray shot
    const keepEl = ${keepPopoverSelector ? `document.querySelector(${JSON.stringify(keepPopoverSelector)})` : "null"};
    document.querySelectorAll("[popover]").forEach((el) => {
      if (keepEl && (el === keepEl || el.contains(keepEl))) return;
      try {
        if (el.matches(":popover-open") && typeof el.hidePopover === "function") {
          el.hidePopover();
        }
      } catch {}
    });

    // 4. Hard DOM fallback: hide any fixed overlay (z >= 150) blocking viewport
    // while strictly sparing the shader <canvas>, sticky <header>, and preserved popover
    document.querySelectorAll("body *").forEach((el) => {
      if (el.tagName === "HEADER" || el.closest("header") || el.tagName === "CANVAS") return;
      if (keepEl && (el === keepEl || el.contains(keepEl))) return;
      if (el.getAttribute("aria-label") === "Pinned Floating Telemetry HUD") return;
      const cs = window.getComputedStyle(el);
      const z = Number.parseInt(cs.zIndex, 10);
      if (cs.position === "fixed" && Number.isFinite(z) && z >= 150) {
        el.style.display = "none";
        el.style.pointerEvents = "none";
      }
    });
  })()`);

  await sleep(200);
}

async function setTheme(cdp, theme) {
  const themeLabelMap = {
    clarity: "Studio Clarity",
    glass: "Cosmic Nebula Glass",
    barebones: "Tactical Engineering Dark",
  };
  const targetLabel = themeLabelMap[theme];
  const current = await cdp.evaluate(`document.documentElement.dataset.theme`);
  if (current === theme) {
    await forceClearModalsAndOverlays(cdp);
    await sleep(300);
    return;
  }

  await forceClearModalsAndOverlays(cdp);

  // Use the real UI Settings option, and never double-toggle it back open afterward
  await cdp.evaluate(`(() => {
    const settingsBtn = Array.from(document.querySelectorAll("header button"))
      .find((b) => /settings/i.test((b.getAttribute("aria-label") || b.textContent || "")));
    if (!settingsBtn) return;
    if (settingsBtn.getAttribute("aria-expanded") !== "true") {
      settingsBtn.click();
    }
  })()`);
  await sleep(180);

  await cdp.evaluate(`(() => {
    const opts = Array.from(document.querySelectorAll("[popover] button, [role='radio']"))
      .filter((el) => (el.textContent || "").includes(${JSON.stringify(targetLabel)}));
    if (opts.length > 0) {
      opts[0].click();
    } else {
      window.localStorage.setItem("apula-ui-theme", ${JSON.stringify(theme)});
      document.documentElement.dataset.theme = ${JSON.stringify(theme)};
    }
  })()`);

  await sleep(150);
  // Ensure Settings popover is closed (never click toggle blindly; call hidePopover if still open)
  await forceClearModalsAndOverlays(cdp);
  await cdp.evaluate(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  await sleep(1500);
}

async function settleAndRenderFrames(cdp, waitMs = 1500) {
  await sleep(waitMs);
  await cdp.evaluate(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))`);
}

async function clickInlineHabitatPreset(cdp, presetName) {
  const clicked = await cdp.evaluate(`(() => {
    const controls = document.querySelector('[data-tour="controls"]');
    if (!controls) return false;
    const btn = Array.from(controls.querySelectorAll("button"))
      .find((b) => {
        const firstLine = (b.querySelector("div")?.textContent || b.textContent || "").trim();
        return firstLine === ${JSON.stringify(presetName)};
      });
    if (!btn) return false;
    btn.click();
    return true;
  })()`);
  if (!clicked) {
    throw new Error(`Inline habitat preset "${presetName}" not found`);
  }
  await sleep(350);
}

async function setProbesVisible(cdp, visible) {
  await cdp.evaluate(`(() => {
    const chamber = document.querySelector('[data-tour="chamber"]');
    if (!chamber) return;
    const btn = Array.from(chamber.querySelectorAll("button"))
      .find((b) => /Sensor Probes/i.test(b.textContent || ""));
    if (!btn) return;
    const isCurrentlyVisible = /Hide Sensor Probes/i.test(btn.textContent || "");
    if (Boolean(isCurrentlyVisible) !== Boolean(${visible})) {
      btn.click();
    }
  })()`);
  await sleep(300);
}

async function scrollToAndVerifySection(
  cdp,
  spec,
  { offsetFromTop = 76, centerInViewport = false, keepPopoverSelector = null } = {},
) {
  const info = await cdp.evaluate(`(() => {
    const spec = ${JSON.stringify(spec)};
    let targetEl = null;
    if (spec.topOfPage) {
      window.scrollTo({ top: 0, behavior: "instant" });
      targetEl = document.querySelector("h1");
    } else if (spec.selector) {
      targetEl = document.querySelector(spec.selector);
    } else if (spec.headingContains) {
      const headings = Array.from(document.querySelectorAll("h1, h2, h3"));
      const match = headings.find((h) => (h.textContent || "").includes(spec.headingContains));
      targetEl = match ? (match.closest("section") || match) : null;
    }
    if (!targetEl) return { found: false, reason: "element missing" };

    if (!spec.topOfPage) {
      if (${centerInViewport}) {
        targetEl.scrollIntoView({ behavior: "instant", block: "center" });
      } else {
        targetEl.scrollIntoView({ behavior: "instant", block: "start" });
        if (${offsetFromTop} > 0) {
          window.scrollBy({ top: -${offsetFromTop}, behavior: "instant" });
        }
      }
    }

    // Also identify an unobstructed probe element (heading or targetEl itself)
    const probeTarget =
      targetEl.querySelector("h1, h2, h3") ||
      targetEl;
    const rect = probeTarget.getBoundingClientRect();
    const probeX = Math.min(window.innerWidth - 10, Math.max(10, Math.round(rect.left + Math.min(rect.width * 0.25, 160))));
    const probeY = Math.min(window.innerHeight - 10, Math.max(70, Math.round(rect.top + rect.height / 2)));
    const hitEl = document.elementFromPoint(probeX, probeY);

    const openDialogs = document.querySelectorAll("dialog[open]").length;
    const openPopovers = Array.from(document.querySelectorAll("[popover]"))
      .filter((p) => {
        try { return p.matches(":popover-open"); } catch { return false; }
      });
    const keepEl = ${keepPopoverSelector ? `document.querySelector(${JSON.stringify(keepPopoverSelector)})` : "null"};
    const unexpectedPopovers = openPopovers.filter((p) => !keepEl || (p !== keepEl && !p.contains(keepEl))).length;

    const hitInsideTargetOrSameSection =
      Boolean(hitEl) &&
      (targetEl.contains(hitEl) ||
        probeTarget.contains(hitEl) ||
        (hitEl.closest("section") && targetEl.closest("section") === hitEl.closest("section")));

    return {
      found: true,
      openDialogs,
      unexpectedPopovers,
      probeText: (probeTarget.textContent || "").trim().slice(0, 60),
      hitTag: hitEl?.tagName || "NONE",
      hitText: (hitEl?.textContent || "").trim().slice(0, 60),
      hitInsideTarget: hitInsideTargetOrSameSection,
      rectTop: Math.round(rect.top),
      rectBottom: Math.round(rect.bottom),
      scrollY: Math.round(window.scrollY),
    };
  })()`);

  if (!info?.found) {
    throw new Error(`Target missing for ${JSON.stringify(spec)}`);
  }
  if (info.openDialogs > 0 || info.unexpectedPopovers > 0) {
    throw new Error(
      `Modal/popover still open before capture! openDialogs=${info.openDialogs}, unexpectedPopovers=${info.unexpectedPopovers}`,
    );
  }
  if (!info.hitInsideTarget) {
    throw new Error(
      `Section "${info.probeText}" occluded at viewport (${info.rectTop}px)! Hit instead: <${info.hitTag}> "${info.hitText}"`,
    );
  }
  return info;
}

async function openLoiPopoverAndXray(cdp) {
  const openedSelector = await cdp.evaluate(`(() => {
    const box = document.querySelector('[data-tour="telemetry"]');
    if (!box) return null;
    const tileBtn = Array.from(box.querySelectorAll("button"))
      .find((b) => (b.textContent || "").includes("% LOI"));
    if (tileBtn) tileBtn.click();

    const qBtn = Array.from(box.querySelectorAll("button"))
      .find((b) => /Limiting O2/i.test(b.getAttribute("aria-label") || ""));
    if (!qBtn) return null;
    qBtn.click();
    const popId = qBtn.getAttribute("aria-controls");
    return popId ? "#" + CSS.escape(popId) : "[popover]:popover-open";
  })()`);
  await sleep(300);
  return openedSelector;
}

async function verifyWebGLCanvases(cdp, requireShaderCanvas) {
  const stats = await cdp.evaluate(`(() => {
    const shader = document.querySelector('canvas[data-cosmic-shader="active"]');
    const allCanvases = Array.from(document.querySelectorAll("canvas")).map((c) => ({
      width: c.width,
      height: c.height,
      clientWidth: c.clientWidth,
      clientHeight: c.clientHeight,
      isShader: c.dataset.cosmicShader === "active",
    }));
    return { hasShader: Boolean(shader), allCanvases };
  })()`);

  if (requireShaderCanvas && !stats.hasShader) {
    throw new Error("Expected CosmicNebulaShader canvas active in glass theme");
  }
  for (const c of stats.allCanvases) {
    if (c.width === 0 || c.height === 0) {
      throw new Error(`Found zero-sized canvas: ${JSON.stringify(c)}`);
    }
  }
}

async function capturePng(cdp, filename, sectionLabel, theme) {
  const outPath = path.join(PROMO_DIR, filename);
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
  });
  const buf = Buffer.from(data, "base64");
  fs.writeFileSync(outPath, buf);
  const dims = readPngDimensions(buf);
  const sizeKb = Number((buf.length / 1024).toFixed(1));
  return {
    filename,
    sectionLabel,
    theme,
    resolution: `${dims.width}x${dims.height}`,
    sizeKb,
  };
}

async function main() {
  fs.mkdirSync(PROMO_DIR, { recursive: true });
  const server = await ensureServer();
  const browser = await launchBrowser();
  const { cdp } = browser;
  const results = [];

  try {
    await cdp.send("Page.navigate", { url: BASE_URL });
    await waitForPageReady(cdp);
    await forceClearModalsAndOverlays(cdp);
    await settleAndRenderFrames(cdp, 1500);

    // 1. SECTION 0 — Clarity
    await setTheme(cdp, "clarity");
    await scrollToAndVerifySection(cdp, { topOfPage: true });
    await settleAndRenderFrames(cdp, 1500);
    await verifyWebGLCanvases(cdp, false);
    results.push(
      await capturePng(
        cdp,
        "SECTION_0_Executive_Mission_Banner__clarity.png",
        "SECTION 0",
        "clarity",
      ),
    );

    // 2. SECTION 0 — Glass
    await setTheme(cdp, "glass");
    await scrollToAndVerifySection(cdp, { topOfPage: true });
    await settleAndRenderFrames(cdp, 1500);
    await verifyWebGLCanvases(cdp, true);
    results.push(
      await capturePng(
        cdp,
        "SECTION_0_Executive_Mission_Banner__glass.png",
        "SECTION 0",
        "glass",
      ),
    );

    // 3. SECTION 1 — Habitat Presets & 7 Physics Sliders (Clarity, Lunar Base active inline)
    await setTheme(cdp, "clarity");
    await clickInlineHabitatPreset(cdp, "Lunar Base");
    await scrollToAndVerifySection(
      cdp,
      { selector: '[data-tour="controls"]' },
      { centerInViewport: true },
    );
    await settleAndRenderFrames(cdp, 1500);
    results.push(
      await capturePng(
        cdp,
        "SECTION_1_Habitat_Presets_And_7_Physics_Sliders__clarity.png",
        "SECTION 1",
        "clarity",
      ),
    );

    // 4. SECTION 1 — Glass (Lunar Base active inline)
    await setTheme(cdp, "glass");
    await scrollToAndVerifySection(
      cdp,
      { selector: '[data-tour="controls"]' },
      { centerInViewport: true },
    );
    await settleAndRenderFrames(cdp, 1500);
    await verifyWebGLCanvases(cdp, true);
    results.push(
      await capturePng(
        cdp,
        "SECTION_1_Habitat_Presets_And_7_Physics_Sliders__glass.png",
        "SECTION 1",
        "glass",
      ),
    );

    // 5. SECTION 2 — Live Physics Readout & LOI % Equation Popover (Barebones)
    await setTheme(cdp, "barebones");
    await scrollToAndVerifySection(
      cdp,
      { selector: '[data-tour="telemetry"]' },
      { offsetFromTop: 84 },
    );
    const barebonesLoiPop = await openLoiPopoverAndXray(cdp);
    await scrollToAndVerifySection(
      cdp,
      { selector: '[data-tour="telemetry"]' },
      { offsetFromTop: 84, keepPopoverSelector: barebonesLoiPop },
    );
    await settleAndRenderFrames(cdp, 1500);
    results.push(
      await capturePng(
        cdp,
        "SECTION_2_Live_Physics_Readout_And_SVG_Wireframe__barebones.png",
        "SECTION 2",
        "barebones",
      ),
    );

    // 6. SECTION 2 — Live Physics Readout & LOI % Equation Popover (Clarity)
    await forceClearModalsAndOverlays(cdp);
    await setTheme(cdp, "clarity");
    await scrollToAndVerifySection(
      cdp,
      { selector: '[data-tour="telemetry"]' },
      { offsetFromTop: 84 },
    );
    const clarityLoiPop = await openLoiPopoverAndXray(cdp);
    await scrollToAndVerifySection(
      cdp,
      { selector: '[data-tour="telemetry"]' },
      { offsetFromTop: 84, keepPopoverSelector: clarityLoiPop },
    );
    await settleAndRenderFrames(cdp, 1500);
    results.push(
      await capturePng(
        cdp,
        "SECTION_2_Live_Physics_Readout_And_SVG_Wireframe__clarity.png",
        "SECTION 2",
        "clarity",
      ),
    );

    // Collapse inline X-Ray and close popover before Section 2C
    await forceClearModalsAndOverlays(cdp);
    await cdp.evaluate(`(() => {
      const xBtn = document.querySelector('button[aria-label="Collapse formula X-ray"]');
      if (xBtn) xBtn.click();
    })()`);

    // 7. SECTION 2C — 3D Three.js Microgravity Flame Chamber with Sensor Probes ON (Glass)
    await setTheme(cdp, "glass");
    await clickInlineHabitatPreset(cdp, "Lunar Base");
    await setProbesVisible(cdp, true);
    await scrollToAndVerifySection(
      cdp,
      { selector: '[data-tour="chamber"]' },
      { centerInViewport: true },
    );
    await settleAndRenderFrames(cdp, 1500);
    await verifyWebGLCanvases(cdp, true);
    results.push(
      await capturePng(
        cdp,
        "SECTION_2C_3D_ThreeJS_Microgravity_Flame_Chamber__glass.png",
        "SECTION 2C",
        "glass",
      ),
    );
    await setProbesVisible(cdp, false);

    // 8. SECTION 3 — Phase-Space Flammability Matrices (Clarity)
    await setTheme(cdp, "clarity");
    await scrollToAndVerifySection(
      cdp,
      { selector: "#phase-charts" },
      { offsetFromTop: 76 },
    );
    await settleAndRenderFrames(cdp, 1500);
    results.push(
      await capturePng(
        cdp,
        "SECTION_3_Phase_Space_Flammability_Matrices__clarity.png",
        "SECTION 3",
        "clarity",
      ),
    );

    // 9. SECTION 3 — Phase-Space Flammability Matrices (Glass)
    await setTheme(cdp, "glass");
    await scrollToAndVerifySection(
      cdp,
      { selector: "#phase-charts" },
      { offsetFromTop: 76 },
    );
    await settleAndRenderFrames(cdp, 1500);
    await verifyWebGLCanvases(cdp, true);
    results.push(
      await capturePng(
        cdp,
        "SECTION_3_Phase_Space_Flammability_Matrices__glass.png",
        "SECTION 3",
        "glass",
      ),
    );

    // 10. SECTION 4 — Dynamic PSI Investigation Ranker (Glass)
    await setTheme(cdp, "glass");
    await scrollToAndVerifySection(
      cdp,
      { headingContains: "NASA PSI Investigation Ranker" },
      { offsetFromTop: 76 },
    );
    await settleAndRenderFrames(cdp, 1500);
    await verifyWebGLCanvases(cdp, true);
    results.push(
      await capturePng(
        cdp,
        "SECTION_4_Dynamic_PSI_Investigation_Ranker__glass.png",
        "SECTION 4",
        "glass",
      ),
    );

    // 11. SECTION 5 — Intra- vs. Inter-Investigation Comparison Matrix (Barebones)
    await setTheme(cdp, "barebones");
    await scrollToAndVerifySection(
      cdp,
      { headingContains: "Intra- vs. Inter-Investigation Comparison Matrix" },
      { offsetFromTop: 76 },
    );
    await settleAndRenderFrames(cdp, 1500);
    results.push(
      await capturePng(
        cdp,
        "SECTION_5_Intra_Vs_Inter_Investigation_Comparison_Matrix__barebones.png",
        "SECTION 5",
        "barebones",
      ),
    );

    // 12. SECTION 6 — Empirical NASA Flight Test Matcher (Clarity)
    await setTheme(cdp, "clarity");
    await scrollToAndVerifySection(
      cdp,
      { headingContains: "Closest NASA Flight Test Runs" },
      { offsetFromTop: 76 },
    );
    await settleAndRenderFrames(cdp, 1500);
    results.push(
      await capturePng(
        cdp,
        "SECTION_6_Empirical_NASA_Flight_Test_Matcher__clarity.png",
        "SECTION 6",
        "clarity",
      ),
    );

    console.log("\n=== PROMOTIONAL SCREENSHOT CAPTURE SUMMARY (documentation/promo/) ===");
    console.log(
      `${"Filename".padEnd(74)} | ${"Section".padEnd(10)} | ${"Theme".padEnd(9)} | ${"Resolution".padEnd(11)} | Size`,
    );
    console.log("-".repeat(122));
    for (const r of results) {
      console.log(
        `${r.filename.padEnd(74)} | ${r.sectionLabel.padEnd(10)} | ${r.theme.padEnd(9)} | ${r.resolution.padEnd(11)} | ${r.sizeKb} KB`,
      );
    }
    console.log(`TOTAL CAPTURED: ${results.length} PNG files in ${PROMO_DIR}`);
  } finally {
    await browser.stop();
    await server.stop();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
