export type Theme = "light" | "dark";
export type Density = "compact" | "cozy" | "relaxed";

export const THEME_KEY = "tn:theme";
export const DENSITY_KEY = "tn:density";

export const DEFAULT_THEME: Theme = "light";
export const DEFAULT_DENSITY: Density = "cozy";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const v = window.localStorage.getItem(THEME_KEY);
  return v === "dark" || v === "light" ? v : DEFAULT_THEME;
}

export function setStoredTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function getStoredDensity(): Density {
  if (typeof window === "undefined") return DEFAULT_DENSITY;
  const v = window.localStorage.getItem(DENSITY_KEY);
  return v === "compact" || v === "cozy" || v === "relaxed" ? v : DEFAULT_DENSITY;
}

export function setStoredDensity(density: Density): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DENSITY_KEY, density);
  const cl = document.documentElement.classList;
  cl.toggle("density-compact", density === "compact");
  cl.toggle("density-cozy", density === "cozy");
  cl.toggle("density-relaxed", density === "relaxed");
}
