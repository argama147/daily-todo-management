import { NextResponse } from "next/server";
import { auth } from "auth";
import { google } from "googleapis";
import { fetchTodayTasks, fetchExpiredTasks } from "@/lib/tasks";

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [todayTasks, expiredTasks] = await Promise.all([
      fetchTodayTasks(session.accessToken as string),
      fetchExpiredTasks(session.accessToken as string),
    ]);
    return NextResponse.json({ todayTasks, expiredTasks });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Google Tasks API error:", message);
    return NextResponse.json(
      { error: "Failed to fetch tasks", detail: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId, listId, status = "completed" } = await request.json();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  try {
    const requestBody: { status: string; completed?: null } = { status };
    
    // When uncompleting a task, we need to clear the completed date
    if (status === "needsAction") {
      requestBody.completed = null;
    }

    await tasksApi.tasks.patch({
      tasklist: listId,
      task: taskId,
      requestBody,
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
