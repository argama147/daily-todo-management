export interface TaskFilterSet {
  id: string;
  name: string;
  categories: Record<string, boolean>;
  isDefault: boolean;
}

export interface AppSettings {
  showUserName: boolean;
  visibleLists: {
    expired: boolean;
    today: boolean;
    completed: boolean;
    tomorrow: boolean;
    dayAfterTomorrow: boolean;
    withinWeek: boolean;
    withinMonth: boolean;
    longTerm: boolean;
    noDeadline: boolean;
  };
  visibleCategories: Record<string, boolean>;
  taskFilterSets: TaskFilterSet[];
  selectedFilterSetId: string;
}

const DEFAULT_FILTER_SET: TaskFilterSet = {
  id: 'default',
  name: 'ALL',
  categories: {},
  isDefault: true,
};

const DEFAULT_SETTINGS: AppSettings = {
  showUserName: true,
  visibleLists: {
    expired: true,
    today: true,
    completed: true,
    tomorrow: true,
    dayAfterTomorrow: true,
    withinWeek: true,
    withinMonth: true,
    longTerm: true,
    noDeadline: true,
  },
  visibleCategories: {},
  taskFilterSets: [DEFAULT_FILTER_SET],
  selectedFilterSetId: 'default',
};

// 設定は localStorage に保存する（容量 約5〜10MB）。
// 旧バージョンでは同名の Cookie に保存していたため、初回読み込み時に移行する。
const SETTINGS_STORAGE_KEY = "todo-app-settings";

export function getSettings(): AppSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = readStoredSettings();
    if (stored) {
      const parsed = JSON.parse(stored);
      // visibleLists を深くマージすることで、新しいキーがデフォルト値で自動的に補完される
      const settings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        visibleLists: { ...DEFAULT_SETTINGS.visibleLists, ...(parsed.visibleLists ?? {}) },
      };

      // フィルターセットが存在しない場合は初期化
      if (!settings.taskFilterSets || settings.taskFilterSets.length === 0) {
        settings.taskFilterSets = [DEFAULT_FILTER_SET];
        settings.selectedFilterSetId = 'default';
      }
      
      return settings;
    }
  } catch (error) {
    console.warn("設定の読み込みに失敗しました:", error);
  }

  return DEFAULT_SETTINGS;
}

/**
 * 設定を localStorage に保存する。
 * 書き込み後に読み戻して照合し、容量超過（QuotaExceededError）などの
 * 失敗を検知できるよう、成否を boolean で返す。
 */
export function saveSettings(settings: AppSettings): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const value = JSON.stringify(settings);
    localStorage.setItem(SETTINGS_STORAGE_KEY, value);
    // 保存検証: 書き込んだ値が実際に読み戻せるか確認する
    if (localStorage.getItem(SETTINGS_STORAGE_KEY) !== value) {
      console.error("設定の保存検証に失敗しました（保存値と読み戻し値が不一致）");
      return false;
    }
    return true;
  } catch (error) {
    console.error("設定の保存に失敗しました:", error);
    return false;
  }
}

export function updateCategoriesFromTasks(tasks: { listTitle: string }[]): void {
  if (typeof window === "undefined") {
    return;
  }

  const settings = getSettings();
  let needsUpdate = false;

  // 新しいカテゴリーを自動的に有効化（既存の visibleCategories 用）
  tasks.forEach(task => {
    if (task.listTitle && !(task.listTitle in settings.visibleCategories)) {
      settings.visibleCategories[task.listTitle] = true;
      needsUpdate = true;
    }
  });

  // フィルターセットにも新しいカテゴリーを追加
  settings.taskFilterSets.forEach(filterSet => {
    tasks.forEach(task => {
      if (task.listTitle && !(task.listTitle in filterSet.categories)) {
        filterSet.categories[task.listTitle] = true;
        needsUpdate = true;
      }
    });
  });

  if (needsUpdate) {
    saveSettings(settings);
  }
}

/**
 * 設定の生文字列を取得する。localStorage を正とし、
 * localStorage が空で旧 Cookie が残っている場合のみ、一度だけ localStorage へ移行する。
 */
function readStoredSettings(): string | null {
  let value: string | null = null;
  try {
    value = localStorage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    value = null;
  }
  if (value !== null) {
    return value;
  }

  // 旧バージョンの Cookie から移行（生 JSON 文字列として保存されている）
  const legacy = getLegacyCookie(SETTINGS_STORAGE_KEY);
  if (legacy !== null) {
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, legacy);
    } catch {
      // 容量超過などで移行できなくても、今回読み込む値としては legacy を使う
    }
    deleteLegacyCookie(SETTINGS_STORAGE_KEY);
    return legacy;
  }

  return null;
}

function getLegacyCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
}

function deleteLegacyCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
}

// フィルターセット管理のヘルパー関数
export function getActiveFilterSet(settings: AppSettings): TaskFilterSet {
  const activeSet = settings.taskFilterSets.find(set => set.id === settings.selectedFilterSetId);
  return activeSet || settings.taskFilterSets[0] || DEFAULT_FILTER_SET;
}

export function createTaskFilterSet(name: string, categories: Record<string, boolean>): TaskFilterSet {
  return {
    id: `set_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name.slice(0, 10), // 全角10文字まで
    categories: { ...categories },
    isDefault: false,
  };
}

export function saveSelectedFilterSetId(filterSetId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const settings = getSettings();
  settings.selectedFilterSetId = filterSetId;
  saveSettings(settings);
}