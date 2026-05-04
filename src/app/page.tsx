export const dynamic = "force-dynamic";

import { auth } from "auth";
import { redirect } from "next/navigation";
import { fetchAllCategorizedTasks } from "@/lib/tasks";
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

  let categorized;
  try {
    categorized = await fetchAllCategorizedTasks(session.accessToken as string);
  } catch (err: unknown) {
    const status = (err as { status?: number; code?: number })?.status ?? (err as { status?: number; code?: number })?.code;
    if (status === 403) {
      // スコープ不足 → 再認証（consent画面を強制表示）
      redirect("/api/auth/signin?provider=google");
    }
    throw err;
  }

  const { todayTasks, expiredTasks, completedTasks, futureTasks, tomorrowTasks } = categorized;
  return <TaskList initialTasks={todayTasks} initialExpiredTasks={expiredTasks} initialCompletedTasks={completedTasks} initialFutureTasks={futureTasks} initialTomorrowTasks={tomorrowTasks} user={session.user} />;
}
