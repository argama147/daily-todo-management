export interface AppSettings {
  showUserName: boolean;
  visibleLists: {
    expired: boolean;
    today: boolean;
    completed: boolean;
    withinWeek: boolean;
    withinMonth: boolean;
    longTerm: boolean;
    noDeadline: boolean;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  showUserName: true,
  visibleLists: {
    expired: true,
    today: true,
    completed: true,
    withinWeek: true,
    withinMonth: true,
    longTerm: true,
    noDeadline: true,
  },
};

const SETTINGS_COOKIE_NAME = "todo-app-settings";

export function getSettings(): AppSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = getCookie(SETTINGS_COOKIE_NAME);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.warn("設定の読み込みに失敗しました:", error);
  }

  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const value = JSON.stringify(settings);
    setCookie(SETTINGS_COOKIE_NAME, value, 365);
  } catch (error) {
    console.error("設定の保存に失敗しました:", error);
  }
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

function setCookie(name: string, value: string, days: number): void {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
}