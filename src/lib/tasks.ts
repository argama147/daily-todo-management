import { google } from "googleapis";
import { getTodayJST } from "./dateUtils";

export type Task = {
  id: string;
  title: string;
  due: string;
  status: string;
  listId: string;
  listTitle: string;
  notes?: string;
};

type RawList = { id?: string | null; title?: string | null };
type RawTask = {
  id?: string | null;
  title?: string | null;
  due?: string | null;
  status?: string | null;
  notes?: string | null;
  completed?: string | null;
};

/** Google Tasks API クライアントを生成する */
export function createTasksApi(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.tasks({ version: "v1", auth: oauth2Client });
}

type TasksApi = ReturnType<typeof createTasksApi>;

/** 与えられたタスクリスト群について tasks.list を並列発行する */
async function fetchListItemsForLists(
  tasksApi: TasksApi,
  lists: RawList[],
  options: { showCompleted?: boolean; showHidden?: boolean } = {}
): Promise<Array<{ list: RawList; items: RawTask[] }>> {
  return Promise.all(
    lists.map((list) =>
      tasksApi.tasks
        .list({
          tasklist: list.id!,
          maxResults: 100,
          showCompleted: options.showCompleted ?? false,
          ...(options.showHidden ? { showHidden: true } : {}),
        })
        .then((res) => ({ list, items: (res.data.items ?? []) as RawTask[] }))
    )
  );
}

/** Google API のタスクオブジェクトを Task 型に変換する */
function toTask(task: RawTask, list: RawList, dueFallback = ""): Task {
  return {
    id: task.id ?? "",
    title: task.title ?? "(タイトルなし)",
    due: task.due ?? dueFallback,
    status: task.status ?? "needsAction",
    listId: list.id ?? "",
    listTitle: list.title ?? "(リストなし)",
    notes: task.notes ?? undefined,
  };
}

export type CategorizedTasks = {
  todayTasks: Task[];
  expiredTasks: Task[];
  completedTasks: Task[];
  tomorrowTasks: Task[];
  futureTasks: {
    withinWeek: Task[];
    withinMonth: Task[];
    noDeadline: Task[];
  };
};

/**
 * 1 回のタスクリスト一覧取得 + 2 セット（未完了 / 当日完了向け）の tasks.list で
 * 全カテゴリのタスクをまとめて取得・分類する。
 *
 * 旧実装は分類ごとに fetchAllTaskItems を 5 回呼んでおり、リスト数 N に対し
 * `5 + 5N` 件の Google Tasks API 並列呼び出しが発生してレート制限に
 * ぶつかりやすかった。本関数は `1 + 2N` 件まで削減する。
 */
export async function fetchAllCategorizedTasks(accessToken: string): Promise<CategorizedTasks> {
  const tasksApi = createTasksApi(accessToken);
  const listsRes = await tasksApi.tasklists.list({ maxResults: 100 });
  const lists = (listsRes.data.items ?? []) as RawList[];

  const [activeResults, completedResults] = await Promise.all([
    fetchListItemsForLists(tasksApi, lists, { showCompleted: false }),
    fetchListItemsForLists(tasksApi, lists, { showCompleted: true, showHidden: true }),
  ]);

  const todayStr = getTodayJST();
  const today = new Date(todayStr);
  const tomorrow = new Date(today.getTime() + 86400000);
  const tomorrowStr = tomorrow.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
  const oneWeekFromNow = new Date(today.getTime() + 7 * 86400000);

  const todayTasks: Task[] = [];
  const expiredTasks: Task[] = [];
  const tomorrowTasks: Task[] = [];
  const withinWeek: Task[] = [];
  const withinMonth: Task[] = [];
  const noDeadline: Task[] = [];

  for (const { list, items } of activeResults) {
    for (const t of items) {
      if (t.status === "completed") continue;
      const dueDay = t.due?.slice(0, 10);
      if (!dueDay) {
        noDeadline.push(toTask(t, list, ""));
      } else if (dueDay < todayStr) {
        expiredTasks.push(toTask(t, list));
      } else if (dueDay === todayStr) {
        todayTasks.push(toTask(t, list));
      } else if (dueDay === tomorrowStr) {
        tomorrowTasks.push(toTask(t, list));
      } else {
        const taskDate = new Date(dueDay);
        if (taskDate > tomorrow) {
          const taskObj = toTask(t, list);
          if (taskDate <= oneWeekFromNow) {
            withinWeek.push(taskObj);
          } else {
            withinMonth.push(taskObj);
          }
        }
      }
    }
  }

  const completedTasks: Task[] = [];
  for (const { list, items } of completedResults) {
    for (const t of items) {
      if (t.status === "completed" && t.completed) {
        const completedDate = new Date(t.completed).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
        if (completedDate === todayStr) {
          completedTasks.push(toTask(t, list, ""));
        }
      }
    }
  }

  const byDue = (a: Task, b: Task) => new Date(a.due).getTime() - new Date(b.due).getTime();

  return {
    todayTasks,
    expiredTasks,
    completedTasks,
    tomorrowTasks,
    futureTasks: {
      withinWeek: withinWeek.sort(byDue),
      withinMonth: withinMonth.sort(byDue),
      noDeadline,
    },
  };
}
