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
    withinWeek: true,
    withinMonth: true,
    longTerm: true,
    noDeadline: true,
  },
  visibleCategories: {},
  taskFilterSets: [DEFAULT_FILTER_SET],
  selectedFilterSetId: 'default',
};

const SETTINGS_COOKIE_NAME = "todo-app-settings";
const SELECTED_TAB_COOKIE_NAME = "todo-app-selected-tab";

export function getSettings(): AppSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const stored = getCookie(SETTINGS_COOKIE_NAME);
    if (stored) {
      const parsed = JSON.parse(stored);
      const settings = { ...DEFAULT_SETTINGS, ...parsed };
      
      // 新しい設定項目の初期化
      if (!settings.visibleLists.hasOwnProperty('tomorrow')) {
        settings.visibleLists.tomorrow = true;
      }
      
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