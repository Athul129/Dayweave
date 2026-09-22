export type Preferences = {
  defaultTaskMinutes: number;
};

const PREFERENCES_KEY = "dayweave-preferences";
const DEFAULT_PREFERENCES: Preferences = { defaultTaskMinutes: 30 };
const isValidTaskDuration = (minutes: unknown): minutes is number => (
  typeof minutes === "number" && Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 && minutes % 5 === 0
);

function normalizePreferences(value: unknown): Preferences {
  if (typeof value !== "object" || value === null || !("defaultTaskMinutes" in value)) {
    return { ...DEFAULT_PREFERENCES };
  }

  const minutes = value.defaultTaskMinutes;
  return {
    defaultTaskMinutes: isValidTaskDuration(minutes)
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
