export const dynamic = "force-dynamic";

import { auth } from "auth";
import { redirect } from "next/navigation";
import { fetchTodayTasks, fetchExpiredTasks, fetchTodayCompletedTasks } from "@/lib/tasks";
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

  const [tasks, expiredTasks, completedTasks] = await Promise.all([
    fetchTodayTasks(session.accessToken as string),
    fetchExpiredTasks(session.accessToken as string),
    fetchTodayCompletedTasks(session.accessToken as string),
  ]);

  return <TaskList initialTasks={tasks} initialExpiredTasks={expiredTasks} initialCompletedTasks={completedTasks} />;
}
