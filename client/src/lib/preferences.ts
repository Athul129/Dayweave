export type Preferences = {
  defaultTaskMinutes: number;
};

const PREFERENCES_KEY = "dayweave-preferences";
const DEFAULT_PREFERENCES: Preferences = { defaultTaskMinutes: 30 };
const ALLOWED_TASK_DURATIONS = new Set([15, 30, 45, 60]);

function normalizePreferences(value: unknown): Preferences {
  if (typeof value !== "object" || value === null || !("defaultTaskMinutes" in value)) {
    return { ...DEFAULT_PREFERENCES };
  }

  const minutes = value.defaultTaskMinutes;
  return {
    defaultTaskMinutes: typeof minutes === "number" && ALLOWED_TASK_DURATIONS.has(minutes)
      ? minutes
      : DEFAULT_PREFERENCES.defaultTaskMinutes,
  };
}

export function getPreferences(): Preferences {
  try {
    if (typeof window === "undefined") return { ...DEFAULT_PREFERENCES };
    const stored = window.localStorage.getItem(PREFERENCES_KEY);
    if (stored === null) return { ...DEFAULT_PREFERENCES };
    return normalizePreferences(JSON.parse(stored) as unknown);
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function setPreferences(preferences: Preferences): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(normalizePreferences(preferences)));
  } catch {
    // Ignore storage errors so preference failures do not interrupt task planning.
  }
}

export function getDefaultTaskMinutes(): number {
  return getPreferences().defaultTaskMinutes;
}

export function setDefaultTaskMinutes(minutes: number): void {
  setPreferences({ defaultTaskMinutes: minutes });
}
