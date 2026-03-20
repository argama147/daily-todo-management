import { NextResponse } from "next/server";
import { auth } from "auth";
import { google } from "googleapis";

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  try {
    // Get all task lists
    const listsRes = await tasksApi.tasklists.list({ maxResults: 100 });
    const lists = listsRes.data.items ?? [];

    // Google Tasks の due は UTC 午前0時で保存されるため、日付文字列で比較する
    const todayStr = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Tokyo",
    }); // "2026-03-20" 形式

    type TaskItem = {
      id: string;
      title: string;
      due: string;
      status: string;
      listId: string;
      listTitle: string;
    };

    const todayTasks: TaskItem[] = [];

    for (const list of lists) {
      const tasksRes = await tasksApi.tasks.list({
        tasklist: list.id!,
        maxResults: 100,
        showCompleted: false,
      });

      const tasks = tasksRes.data.items ?? [];
      for (const task of tasks) {
        if (task.due) {
          // due は "2026-03-20T00:00:00.000Z" 形式。先頭10文字が日付
          const taskDate = task.due.slice(0, 10);
          if (taskDate === todayStr) {
            todayTasks.push({
              id: task.id!,
              title: task.title ?? "(タイトルなし)",
              due: task.due,
              status: task.status ?? "needsAction",
              listId: list.id!,
              listTitle: list.title ?? "(リストなし)",
            });
          }
        }
      }
    }

    return NextResponse.json({ tasks: todayTasks });
  } catch (err) {
    console.error("Google Tasks API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId, listId } = await request.json();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  try {
    await tasksApi.tasks.patch({
      tasklist: listId,
      task: taskId,
      requestBody: { status: "completed" },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Google Tasks API error:", err);
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}
