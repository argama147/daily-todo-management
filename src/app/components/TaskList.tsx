"use client";

import { signOut } from "next-auth/react";
import { useState, useCallback } from "react";
import type { Task } from "@/lib/tasks";
import type { User } from "next-auth";

type Props = {
  initialTasks: Task[];
  initialExpiredTasks: Task[];
  initialCompletedTasks?: Task[];
  user?: User;
};

export default function TaskList({ initialTasks, initialExpiredTasks, initialCompletedTasks, user }: Props) {
  const [incompleteTasks, setIncompleteTasks] = useState<Task[]>(initialTasks);
  const [expiredTasks, setExpiredTasks] = useState<Task[]>(initialExpiredTasks);
  const [completedTasks, setCompletedTasks] = useState<Task[]>(initialCompletedTasks ?? []);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [newlyCompleted, setNewlyCompleted] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ?? "タスクの取得に失敗しました");
      }
      const data = await res.json();
      setIncompleteTasks(data.todayTasks ?? []);
      setExpiredTasks(data.expiredTasks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  const completeTask = async (task: Task) => {
    setCompleting((prev) => new Set(prev).add(task.id));

    const patchPromise = fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, listId: task.listId }),
    });

    setTimeout(() => {
      setCompleting((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setIncompleteTasks((prev) => prev.filter((t) => t.id !== task.id));
      setExpiredTasks((prev) => prev.filter((t) => t.id !== task.id));
      setCompletedTasks((prev) => [task, ...prev]);
      setNewlyCompleted((prev) => new Set(prev).add(task.id));

      setTimeout(() => {
        setNewlyCompleted((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }, 400);
    }, 300);

    try {
      const res = await patchPromise;
      if (!res.ok) throw new Error("更新に失敗しました");

      const syncRes = await fetch("/api/tasks");
      if (syncRes.ok) {
        const data = await syncRes.json();
        setIncompleteTasks(data.todayTasks);
        setExpiredTasks(data.expiredTasks);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setCompletedTasks((prev) => prev.filter((t) => t.id !== task.id));
      const isExpired = new Date(task.due).toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }) < new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
      if (isExpired) {
        setExpiredTasks((prev) => [task, ...prev]);
      } else {
        setIncompleteTasks((prev) => [task, ...prev]);
      }
    }
  };

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">今日のタスク</h1>
            <p className="text-sm text-gray-500">{today}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchTasks}
              disabled={loading}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              {loading ? "更新中..." : "更新"}
            </button>
            {user && (
              <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded-lg">
                {user.image && (
                  <img
                    src={user.image}
                    alt={user.name || "ユーザー"}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700 font-medium">
                  {user.name || user.email}
                </span>
              </div>
            )}
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading && incompleteTasks.length === 0 && expiredTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">タスクを取得中...</div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* 期限切れカラム */}
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wide mb-3">
                期限切れ{" "}
                <span className="font-normal text-red-400">
                  ({expiredTasks.length}件)
                </span>
              </h2>
              {expiredTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                  期限切れタスクがここに表示されます
                </div>
              ) : (
                <div className="space-y-2">
                  {expiredTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 shadow-sm"
                      style={
                        completing.has(task.id)
                          ? { animation: "fadeOut 300ms forwards" }
                          : undefined
                      }
                    >
                      <button
                        onClick={() => completeTask(task)}
                        disabled={completing.has(task.id)}
                        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-red-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="完了にする"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-red-800 font-medium leading-snug">
                          {task.title}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="text-xs text-red-500 bg-red-100 rounded px-2 py-0.5">
                            {task.listTitle}
                          </span>
                          <span className="text-xs text-red-600 bg-red-200 rounded px-2 py-0.5 font-medium">
                            期限: {new Date(task.due).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                            ({(() => {
                              const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
                              const taskDate = task.due.slice(0, 10);
                              const diffTime = new Date(today).getTime() - new Date(taskDate).getTime();
                              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                              return `${diffDays}日経過`;
                            })()})
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 未完了カラム */}
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                未完了{" "}
                <span className="font-normal text-gray-400">
                  ({incompleteTasks.length}件)
                </span>
              </h2>
              {incompleteTasks.length === 0 && expiredTasks.length === 0 && completedTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="text-gray-500">今日期限のタスクはありません</p>
                </div>
              ) : incompleteTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  すべて完了しました！
                </div>
              ) : (
                <div className="space-y-2">
                  {incompleteTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm"
                      style={
                        completing.has(task.id)
                          ? { animation: "fadeOut 300ms forwards" }
                          : undefined
                      }
                    >
                      <button
                        onClick={() => completeTask(task)}
                        disabled={completing.has(task.id)}
                        className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="完了にする"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-800 font-medium leading-snug">
                          {task.title}
                        </p>
                        <span className="inline-block mt-1 text-xs text-gray-400 bg-gray-100 rounded px-2 py-0.5">
                          {task.listTitle}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 完了カラム */}
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                完了{" "}
                <span className="font-normal text-gray-400">
                  ({completedTasks.length}件)
                </span>
              </h2>
              {completedTasks.length === 0 ? (
                <div className="text-center py-12 text-gray-300 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                  完了したタスクがここに表示されます
                </div>
              ) : (
                <div className="space-y-2">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3 shadow-sm opacity-80"
                      style={
                        newlyCompleted.has(task.id)
                          ? { animation: "slideInFromTop 300ms ease-out" }
                          : undefined
                      }
                    >
                      <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-500 font-medium leading-snug line-through">
                          {task.title}
                        </p>
                        <span className="inline-block mt-1 text-xs text-gray-400 bg-green-100 rounded px-2 py-0.5">
                          {task.listTitle}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
