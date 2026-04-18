import { google } from "googleapis";

export type Task = {
  id: string;
  title: string;
  due: string;
  status: string;
  listId: string;
  listTitle: string;
  notes?: string;
};

export async function fetchTodayTasks(accessToken: string): Promise<Task[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  const listsRes = await tasksApi.tasklists.list({ maxResults: 100 });
  const lists = listsRes.data.items ?? [];

  const todayStr = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

  const allTasksResults = await Promise.all(
    lists.map((list) =>
      tasksApi.tasks
        .list({ tasklist: list.id!, maxResults: 100, showCompleted: false })
        .then((res) => ({ list, items: res.data.items ?? [] }))
    )
  );

  const todayTasks: Task[] = [];
  for (const { list, items } of allTasksResults) {
    for (const task of items) {
      if (task.due) {
        const taskDate = task.due.slice(0, 10);
        if (taskDate === todayStr) {
          todayTasks.push({
            id: task.id!,
            title: task.title ?? "(タイトルなし)",
            due: task.due,
            status: task.status ?? "needsAction",
            listId: list.id!,
            listTitle: list.title ?? "(リストなし)",
            notes: task.notes ?? undefined,
          });
        }
      }
    }
  }

  return todayTasks;
}

export async function fetchExpiredTasks(accessToken: string): Promise<Task[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  const listsRes = await tasksApi.tasklists.list({ maxResults: 100 });
  const lists = listsRes.data.items ?? [];

  const todayStr = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

  const allTasksResults = await Promise.all(
    lists.map((list) =>
      tasksApi.tasks
        .list({ tasklist: list.id!, maxResults: 100, showCompleted: false })
        .then((res) => ({ list, items: res.data.items ?? [] }))
    )
  );

  const expiredTasks: Task[] = [];
  for (const { list, items } of allTasksResults) {
    for (const task of items) {
      if (task.due) {
        const taskDate = task.due.slice(0, 10);
        if (taskDate < todayStr) {
          expiredTasks.push({
            id: task.id!,
            title: task.title ?? "(タイトルなし)",
            due: task.due,
            status: task.status ?? "needsAction",
            listId: list.id!,
            listTitle: list.title ?? "(リストなし)",
            notes: task.notes ?? undefined,
          });
        }
      }
    }
  }

  return expiredTasks;
}

export async function fetchTomorrowTasks(accessToken: string): Promise<Task[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  const listsRes = await tasksApi.tasklists.list({ maxResults: 100 });
  const lists = listsRes.data.items ?? [];

  const todayStr = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });
  const today = new Date(todayStr);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

  const allTasksResults = await Promise.all(
    lists.map((list) =>
      tasksApi.tasks
        .list({ tasklist: list.id!, maxResults: 100, showCompleted: false })
        .then((res) => ({ list, items: res.data.items ?? [] }))
    )
  );

  const tomorrowTasks: Task[] = [];
  for (const { list, items } of allTasksResults) {
    for (const task of items) {
      if (task.due) {
        const taskDate = task.due.slice(0, 10);
        if (taskDate === tomorrowStr) {
          tomorrowTasks.push({
            id: task.id!,
            title: task.title ?? "(タイトルなし)",
            due: task.due,
            status: task.status ?? "needsAction",
            listId: list.id!,
            listTitle: list.title ?? "(リストなし)",
            notes: task.notes ?? undefined,
          });
        }
      }
    }
  }

  return tomorrowTasks;
}

export async function fetchFutureTasks(accessToken: string): Promise<{
  withinWeek: Task[];
  withinMonth: Task[];
  noDeadline: Task[];
}> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  const listsRes = await tasksApi.tasklists.list({ maxResults: 100 });
  const lists = listsRes.data.items ?? [];

  const allTasksResults = await Promise.all(
    lists.map((list) =>
      tasksApi.tasks
        .list({ tasklist: list.id!, maxResults: 100, showCompleted: false })
        .then((res) => ({ list, items: res.data.items ?? [] }))
    )
  );

  const todayStr = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

  const today = new Date(todayStr);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const oneWeekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const withinWeek: Task[] = [];
  const withinMonth: Task[] = [];
  const noDeadline: Task[] = [];

  for (const { list, items } of allTasksResults) {
    for (const task of items) {
      if (task.due && task.status !== "completed") {
        const taskDate = new Date(task.due.slice(0, 10));

        if (taskDate > today) {
          const taskObj = {
            id: task.id!,
            title: task.title ?? "(タイトルなし)",
            due: task.due,
            status: task.status ?? "needsAction",
            listId: list.id!,
            listTitle: list.title ?? "(リストなし)",
            notes: task.notes ?? undefined,
          };

          if (taskDate > tomorrow && taskDate <= oneWeekFromNow) {
            withinWeek.push(taskObj);
          } else {
            withinMonth.push(taskObj);
          }
        }
      } else if (task.status !== "completed") {
        // 期限なしのタスク（完了済みは除外）
        noDeadline.push({
          id: task.id!,
          title: task.title ?? "(タイトルなし)",
          due: task.due ?? "",
          status: task.status ?? "needsAction",
          listId: list.id!,
          listTitle: list.title ?? "(リストなし)",
          notes: task.notes ?? undefined,
        });
      }
    }
  }

  return {
    withinWeek: withinWeek.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime()),
    withinMonth: withinMonth.sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime()),
    noDeadline,
  };
}

export async function fetchTodayCompletedTasks(accessToken: string): Promise<Task[]> {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  const listsRes = await tasksApi.tasklists.list({ maxResults: 100 });
  const lists = listsRes.data.items ?? [];

  const allTasksResults = await Promise.all(
    lists.map((list) =>
      tasksApi.tasks
        .list({ tasklist: list.id!, maxResults: 100, showCompleted: true, showHidden: true })
        .then((res) => ({ list, items: res.data.items ?? [] }))
    )
  );

  const todayStr = new Date().toLocaleDateString("sv-SE", {
    timeZone: "Asia/Tokyo",
  });

  const completedTasks: Task[] = [];
  for (const { list, items } of allTasksResults) {
    for (const task of items) {
      if (task.status === "completed" && task.completed) {
        const completedDate = new Date(task.completed).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
        const matches = completedDate === todayStr;
        if (matches) {
          completedTasks.push({
            id: task.id!,
            title: task.title ?? "(タイトルなし)",
            due: task.due ?? "",
            status: task.status,
            listId: list.id!,
            listTitle: list.title ?? "(リストなし)",
            notes: task.notes ?? undefined,
          });
        }
      }
    }
  }
  return completedTasks;
}
