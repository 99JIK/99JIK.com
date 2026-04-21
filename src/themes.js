// Theme system + Tweaks. Four themes, CSS custom properties applied on :root.

window.THEMES = {
  dark: {
    name: "Dark", label_ko: "진한 다크",
    bg: "#0c0c0d", panel: "#111114", titlebar: "#1a1a1c", border: "#232327",
    fg: "#e6e6e3", muted: "#6b7280", faint: "rgba(230,230,227,0.32)",
    green: "#6ee7a8", cyan: "#7dd3fc", yellow: "#fcd34d", magenta: "#f0abfc", red: "#fb7185",
    accent: "#7dd3fc",
    chipBg: "#17171a", chipBorder: "#28282d", chipHover: "#1f1f23",
  },
  light: {
    name: "Light", label_ko: "라이트",
    bg: "#f5f3ec", panel: "#ffffff", titlebar: "#e9e5d9", border: "#d8d1bd",
    fg: "#1a1917", muted: "#6d665a", faint: "rgba(26,25,23,0.38)",
    green: "#1f7a3a", cyan: "#1e5f8a", yellow: "#8a6d1a", magenta: "#8a1f7a", red: "#a83232",
    accent: "#7a1f1f",
    chipBg: "#efeadc", chipBorder: "#d8d1bd", chipHover: "#e5dfcb",
  },
  solarized: {
    name: "Solarized", label_ko: "솔라라이즈드",
    bg: "#002b36", panel: "#073642", titlebar: "#04313d", border: "#0f4654",
    fg: "#93a1a1", muted: "#657b83", faint: "rgba(147,161,161,0.38)",
    green: "#859900", cyan: "#2aa198", yellow: "#b58900", magenta: "#d33682", red: "#dc322f",
    accent: "#2aa198",
    chipBg: "#083642", chipBorder: "#0f4654", chipHover: "#0c4152",
  },
  phosphor: {
    name: "Phosphor", label_ko: "그린 포스퍼",
    bg: "#020a03", panel: "#051408", titlebar: "#0a1f0e", border: "#143019",
    fg: "#7eff9a", muted: "#3f9a55", faint: "rgba(126,255,154,0.28)",
    green: "#c8ff8a", cyan: "#8affd6", yellow: "#f0ff7a", magenta: "#e4a0ff", red: "#ff8a8a",
    accent: "#c8ff8a",
    chipBg: "#081f10", chipBorder: "#143019", chipHover: "#0e2a17",
  },
};

window.applyTheme = function applyTheme(key) {
  const t = window.THEMES[key] || window.THEMES.dark;
  const r = document.documentElement.style;
  Object.entries(t).forEach(([k, v]) => {
    if (typeof v === "string") r.setProperty("--t-" + k, v);
  });
  r.setProperty("--t-key", key);
  document.documentElement.setAttribute("data-theme", key);
};
