import React from "react";

// Sync saved apula-ui-theme, width mode, and motion flags before first paint.
const THEME_INIT_SCRIPT = `(function () {
  try {
    var rawTheme = window.localStorage.getItem("apula-ui-theme");
    var theme = rawTheme === "clarity" || rawTheme === "glass" || rawTheme === "barebones" ? rawTheme : "clarity";
    var compact = window.localStorage.getItem("apula-compact-width") === "true";
    var rawMotion = window.localStorage.getItem("apula.reducedMotion");
    var reduced = rawMotion === "true"
      ? true
      : rawMotion === "false"
        ? false
        : !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.compactWidth = String(compact);
    document.documentElement.dataset.reducedMotion = String(reduced);
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute("content", theme === "clarity" ? "light" : "dark");
    }
  } catch (e) {
    document.documentElement.dataset.theme = "clarity";
    document.documentElement.dataset.compactWidth = "false";
    document.documentElement.dataset.reducedMotion = "false";
  }
})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />;
}
