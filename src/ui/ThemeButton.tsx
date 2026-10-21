import { useState } from 'react';
import { applyTheme, loadTheme, nextTheme, saveTheme, THEME_LABELS, type ThemeChoice } from './theme';

/** Cycles Auto, Day, Night. The label always says the current theme. */
export function ThemeButton() {
  const [theme, setTheme] = useState<ThemeChoice>(loadTheme);
  const next = nextTheme(theme);
  return (
    <button
      type="button"
      className="button"
      aria-label={`Colour theme: ${THEME_LABELS[theme]}. Switch to ${THEME_LABELS[next]}`}
      onClick={() => {
        setTheme(next);
        saveTheme(next);
        applyTheme(next);
      }}
    >
      Theme: {THEME_LABELS[theme]}
    </button>
  );
}
