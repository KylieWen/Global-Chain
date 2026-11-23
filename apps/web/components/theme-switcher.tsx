"use client";

import { useThemePreference } from "./theme-preference";

export function ThemeSwitcher() {
  const { resolved, toggleResolved } = useThemePreference();
  const dark = resolved === "dark";
  return (
    <button
      type="button"
      className="theme-switcher"
      onClick={toggleResolved}
      aria-label={dark ? "切换到浅色主题" : "切换到深色主题"}
      aria-pressed={!dark}
      title={dark ? "当前深色主题，点击切换浅色" : "当前浅色主题，点击切换深色"}
    >
      <span aria-hidden="true">{dark ? "◑" : "◐"}</span>
      <span className="theme-switcher-label">{dark ? "浅色" : "深色"}</span>
    </button>
  );
}
