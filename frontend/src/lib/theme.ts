/**
 * Color mode, persisted. The inline script in index.html applies the stored
 * value before first paint; this module is what changes it afterwards.
 *
 * "system" means no stored preference — the OS decides, and keeps deciding if
 * the user changes it while the page is open.
 */
export type Mode = "light" | "dark" | "system";

const KEY = "theme";

const prefersDark = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches;

/** The stored preference, or "system" when there is none. */
export function getMode(): Mode {
  const stored = localStorage.getItem(KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** Whether `mode` renders dark right now. */
export function isDark(mode: Mode): boolean {
  return mode === "dark" || (mode === "system" && prefersDark());
}

/** Persist a mode and apply it. "system" clears the stored override. */
export function setMode(mode: Mode): void {
  if (mode === "system") localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, mode);
  document.documentElement.classList.toggle("dark", isDark(mode));
}

/**
 * Re-apply on OS changes, and on changes made in another tab. Returns an
 * unsubscribe function — call it from your framework's cleanup hook.
 *
 * The OS listener re-reads the mode rather than closing over it, so it stays
 * correct after the user picks an explicit light/dark and then goes back to
 * system.
 */
export function watchMode(onChange: (mode: Mode) => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    const mode = getMode();
    document.documentElement.classList.toggle("dark", isDark(mode));
    onChange(mode);
  };
  media.addEventListener("change", apply);
  window.addEventListener("storage", apply);
  return () => {
    media.removeEventListener("change", apply);
    window.removeEventListener("storage", apply);
  };
}
