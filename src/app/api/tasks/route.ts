import { NextResponse } from "next/server";
import { auth } from "auth";
import { google } from "googleapis";
import { fetchTodayTasks, fetchExpiredTasks, fetchTodayCompletedTasks, fetchFutureTasks } from "@/lib/tasks";

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [todayTasks, expiredTasks, completedTasks, futureTasks] = await Promise.all([
      fetchTodayTasks(session.accessToken as string),
      fetchExpiredTasks(session.accessToken as string),
      fetchTodayCompletedTasks(session.accessToken as string),
      fetchFutureTasks(session.accessToken as string),
    ]);
    return NextResponse.json({ todayTasks, expiredTasks, completedTasks, futureTasks });
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

  const { taskId, listId, status, due, title, notes } = await request.json();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  try {
    const requestBody: { 
      status?: string; 
      completed?: null; 
      due?: string;
      title?: string;
      notes?: string;
    } = {};
    
    // Handle status change
    if (status !== undefined) {
      requestBody.status = status;
      // When uncompleting a task, we need to clear the completed date
      if (status === "needsAction") {
        requestBody.completed = null;
      }
    }
    
    // Handle due date change
    if (due !== undefined) {
      requestBody.due = due;
    }

    // Handle title change
    if (title !== undefined) {
      requestBody.title = title;
    }

    // Handle notes change
    if (notes !== undefined) {
      requestBody.notes = notes;
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

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { listId, title, notes, due } = await request.json();

  if (!title || !listId) {
    return NextResponse.json({ error: "Title and listId are required" }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  try {
    const requestBody: { 
      title: string; 
      notes?: string;
      due?: string;
    } = { title };
    
    if (notes) {
      requestBody.notes = notes;
    }

    if (due) {
      requestBody.due = due;
    }

    const result = await tasksApi.tasks.insert({
      tasklist: listId,
      requestBody,
    });

    return NextResponse.json({ success: true, taskId: result.data.id });
  } catch (err) {
    console.error("Google Tasks API error:", err);
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { taskId, listId } = await request.json();

  if (!taskId || !listId) {
    return NextResponse.json({ error: "TaskId and listId are required" }, { status: 400 });
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: session.accessToken });

  const tasksApi = google.tasks({ version: "v1", auth: oauth2Client });

  try {
    await tasksApi.tasks.delete({
      tasklist: listId,
      task: taskId,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Google Tasks API error:", err);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
