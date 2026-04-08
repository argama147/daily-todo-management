export const dynamic = "force-dynamic";

import { auth } from "auth";
import { redirect } from "next/navigation";
import { fetchTodayTasks, fetchExpiredTasks, fetchTodayCompletedTasks, fetchFutureTasks, fetchTomorrowTasks } from "@/lib/tasks";
import TaskList from "@/app/components/TaskList";
import LoginButton from "@/app/components/LoginButton";

export default async function Home() {
  const session = await auth();

  if (!session) {
    return <LoginButton />;
  }

  if (session.error === "RefreshTokenError") {
    redirect("/api/auth/signin?provider=google");
  }

  let tasks, expiredTasks, completedTasks, futureTasks, tomorrowTasks;
  try {
    [tasks, expiredTasks, completedTasks, futureTasks, tomorrowTasks] = await Promise.all([
      fetchTodayTasks(session.accessToken as string),
      fetchExpiredTasks(session.accessToken as string),
      fetchTodayCompletedTasks(session.accessToken as string),
      fetchFutureTasks(session.accessToken as string),
      fetchTomorrowTasks(session.accessToken as string),
    ]);
  } catch (err: unknown) {
    const status = (err as { status?: number; code?: number })?.status ?? (err as { status?: number; code?: number })?.code;
    if (status === 403) {
      // スコープ不足 → 再認証（consent画面を強制表示）
      redirect("/api/auth/signin?provider=google");
    }
    throw err;
  }

  return <TaskList initialTasks={tasks} initialExpiredTasks={expiredTasks} initialCompletedTasks={completedTasks} initialFutureTasks={futureTasks} initialTomorrowTasks={tomorrowTasks} user={session.user} />;
}
