import { NextResponse } from "next/server";
import { auth } from "auth";
import { fetchTodayTasks, fetchExpiredTasks, fetchTodayCompletedTasks, fetchFutureTasks, fetchTomorrowTasks, createTasksApi } from "@/lib/tasks";

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [todayTasks, expiredTasks, completedTasks, futureTasks, tomorrowTasks] = await Promise.all([
      fetchTodayTasks(session.accessToken as string),
      fetchExpiredTasks(session.accessToken as string),
      fetchTodayCompletedTasks(session.accessToken as string),
      fetchFutureTasks(session.accessToken as string),
      fetchTomorrowTasks(session.accessToken as string),
    ]);
    return NextResponse.json({ todayTasks, expiredTasks, completedTasks, futureTasks, tomorrowTasks });
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

  const { taskId, listId, status, due, title, notes, newListId } = await request.json();

  const tasksApi = createTasksApi(session.accessToken as string);

  try {
    // Handle list change (move task to different list)
    // Google Tasks API does not support moving tasks between lists directly.
    // We must insert into the new list and delete from the old list.
    if (newListId !== undefined && newListId !== listId) {
      const existing = await tasksApi.tasks.get({ tasklist: listId, task: taskId });
      const existingData = existing.data;

      const insertBody: {
        title: string;
        notes?: string;
        due?: string;
        status?: string;
        completed?: string | null;
      } = {
        title: title ?? existingData.title ?? "",
      };
      if ((notes ?? existingData.notes) !== undefined) insertBody.notes = notes ?? existingData.notes ?? undefined;
      if ((due ?? existingData.due) !== undefined) insertBody.due = due ?? existingData.due ?? undefined;
      if (status !== undefined) {
        insertBody.status = status;
      } else if (existingData.status) {
        insertBody.status = existingData.status;
        if (existingData.completed) insertBody.completed = existingData.completed;
      }

      await tasksApi.tasks.insert({ tasklist: newListId, requestBody: insertBody });
      await tasksApi.tasks.delete({ tasklist: listId, task: taskId });

      return NextResponse.json({ success: true });
    }

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

    if (Object.keys(requestBody).length > 0) {
      await tasksApi.tasks.patch({
        tasklist: listId,
        task: taskId,
        requestBody,
      });
    }

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

  const tasksApi = createTasksApi(session.accessToken as string);

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

  const tasksApi = createTasksApi(session.accessToken as string);

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
