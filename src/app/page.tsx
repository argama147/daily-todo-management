"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState, useCallback } from "react";

type Task = {
  id: string;
  title: string;
  due: string;
  status: string;
  listId: string;
  listTitle: string;
};

export default function Home() {
  const { data: session, status } = useSession();
  const [incompleteTasks, setIncompleteTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
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
      setIncompleteTasks(data.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.error === "RefreshTokenError") {
      signIn("google");
      return;
    }
    if (session) {
      fetchTasks();
    }
  }, [session, fetchTasks]);

  const completeTask = async (task: Task) => {
    // 1. フェードアウト開始
    setCompleting((prev) => new Set(prev).add(task.id));

    // PATCHは並行して開始
    const patchPromise = fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId: task.id, listId: task.listId }),
    });

    // 2. 300ms後に画面を更新（楽観的更新）
    setTimeout(() => {
      setCompleting((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
      setIncompleteTasks((prev) => prev.filter((t) => t.id !== task.id));
      setCompletedTasks((prev) => [task, ...prev]);
      setNewlyCompleted((prev) => new Set(prev).add(task.id));

      // スライドインアニメーション終了後にnewlyCompletedから除去
      setTimeout(() => {
        setNewlyCompleted((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }, 400);
    }, 300);

    // 3. PATCH結果を処理
    try {
      const res = await patchPromise;
      if (!res.ok) throw new Error("更新に失敗しました");

      // 成功後: GETで同期検証
      const syncRes = await fetch("/api/tasks");
      if (syncRes.ok) {
        const data = await syncRes.json();
        setIncompleteTasks(data.tasks);
      }
    } catch (e) {
      // 失敗: ロールバック
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setCompletedTasks((prev) => prev.filter((t) => t.id !== task.id));
      setIncompleteTasks((prev) => [task, ...prev]);
    }
  };

  const today = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-lg">読み込み中...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            今日のタスク
          </h1>
          <p className="text-gray-500">
            Google Tasks と連携して今日の期限タスクを確認しましょう
          </p>
        </div>
        <button
          onClick={() => signIn("google")}
          className="flex items-center gap-3 px-6 py-3 bg-white border border-gray-300 rounded-lg shadow-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Google でログイン
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading && incompleteTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            タスクを取得中...
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6">
            {/* 未完了カラム */}
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                未完了{" "}
                <span className="font-normal text-gray-400">
                  ({incompleteTasks.length}件)
                </span>
              </h2>
              {incompleteTasks.length === 0 && completedTasks.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🎉</div>
                  <p className="text-gray-500">
                    今日期限のタスクはありません
                  </p>
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
