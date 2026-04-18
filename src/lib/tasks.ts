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

/** 全タスクリストの items を一括取得する */
async function fetchAllTaskItems(
  tasksApi: TasksApi,
  options: { showCompleted?: boolean; showHidden?: boolean } = {}
): Promise<Array<{ list: RawList; items: RawTask[] }>> {
  const listsRes = await tasksApi.tasklists.list({ maxResults: 100 });
  const lists = listsRes.data.items ?? [];
  return Promise.all(
    lists.map((list) =>
      tasksApi.tasks
        .list({
          tasklist: list.id!,
          maxResults: 100,
          showCompleted: options.showCompleted ?? false,
          ...(options.showHidden ? { showHidden: true } : {}),
        })
        .then((res) => ({ list: list as RawList, items: (res.data.items ?? []) as RawTask[] }))
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

export async function fetchTodayTasks(accessToken: string): Promise<Task[]> {
  const tasksApi = createTasksApi(accessToken);
  const allTasksResults = await fetchAllTaskItems(tasksApi);
  const todayStr = getTodayJST();
  const result: Task[] = [];
  for (const { list, items } of allTasksResults) {
    for (const task of items) {
      if (task.due?.slice(0, 10) === todayStr) {
        result.push(toTask(task, list));
      }
    }
  }
  return result;
}

export async function fetchExpiredTasks(accessToken: string): Promise<Task[]> {
  const tasksApi = createTasksApi(accessToken);
  const allTasksResults = await fetchAllTaskItems(tasksApi);
  const todayStr = getTodayJST();
  const result: Task[] = [];
  for (const { list, items } of allTasksResults) {
    for (const task of items) {
      if (task.due && task.due.slice(0, 10) < todayStr) {
        result.push(toTask(task, list));
      }
    }
  }
  return result;
}

export async function fetchTomorrowTasks(accessToken: string): Promise<Task[]> {
  const tasksApi = createTasksApi(accessToken);
  const allTasksResults = await fetchAllTaskItems(tasksApi);
  const todayStr = getTodayJST();
  const tomorrowStr = new Date(new Date(todayStr).getTime() + 86400000).toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });
  const result: Task[] = [];
  for (const { list, items } of allTasksResults) {
    for (const task of items) {
      if (task.due?.slice(0, 10) === tomorrowStr) {
        result.push(toTask(task, list));
      }
    }
  }
  return result;
}

export async function fetchFutureTasks(accessToken: string): Promise<{
  withinWeek: Task[];
  withinMonth: Task[];
  noDeadline: Task[];
}> {
  const tasksApi = createTasksApi(accessToken);
  const allTasksResults = await fetchAllTaskItems(tasksApi);
  const todayStr = getTodayJST();
  const today = new Date(todayStr);
  const tomorrow = new Date(today.getTime() + 86400000);
  const oneWeekFromNow = new Date(today.getTime() + 7 * 86400000);

  const withinWeek: Task[] = [];
  const withinMonth: Task[] = [];
  const noDeadline: Task[] = [];

  for (const { list, items } of allTasksResults) {
    for (const task of items) {
      if (task.due && task.status !== "completed") {
        const taskDate = new Date(task.due.slice(0, 10));
        if (taskDate > today) {
          const taskObj = toTask(task, list);
          if (taskDate > tomorrow && taskDate <= oneWeekFromNow) {
            withinWeek.push(taskObj);
          } else {
            withinMonth.push(taskObj);
          }
        }
      } else if (task.status !== "completed") {
        noDeadline.push(toTask(task, list, ""));
      }
    }
  }

  const byDue = (a: Task, b: Task) => new Date(a.due).getTime() - new Date(b.due).getTime();
  return {
    withinWeek: withinWeek.sort(byDue),
    withinMonth: withinMonth.sort(byDue),
    noDeadline,
  };
}

export async function fetchTodayCompletedTasks(accessToken: string): Promise<Task[]> {
  const tasksApi = createTasksApi(accessToken);
  const allTasksResults = await fetchAllTaskItems(tasksApi, { showCompleted: true, showHidden: true });
  const todayStr = getTodayJST();
  const result: Task[] = [];
  for (const { list, items } of allTasksResults) {
    for (const task of items) {
      if (task.status === "completed" && task.completed) {
        const completedDate = new Date(task.completed).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
        if (completedDate === todayStr) {
          result.push(toTask(task, list, ""));
        }
      }
    }
  }
  return result;
}
