"use client";

import { useEffect, useRef } from "react";

interface DateChangeDetectorProps {
  onDateChange: () => void;
  isEnabled: boolean;
}

export default function DateChangeDetector({ onDateChange, isEnabled }: DateChangeDetectorProps) {
  const lastKnownDate = useRef<string | null>(null);

  useEffect(() => {
    if (!isEnabled) return;

    // 現在の日付を取得（日本時間）
    const getCurrentDate = () => {
      return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
    };

    // 初期値設定
    lastKnownDate.current = getCurrentDate();

    const checkDateChange = () => {
      const currentDate = getCurrentDate();
      
      if (lastKnownDate.current && lastKnownDate.current !== currentDate) {
        lastKnownDate.current = currentDate;
        onDateChange();
      } else if (!lastKnownDate.current) {
        lastKnownDate.current = currentDate;
      }
    };

    // 1分間隔でチェック
    const interval = setInterval(checkDateChange, 60000);

    // Page Visibility APIでタブがアクティブになった際にもチェック
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkDateChange();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [onDateChange, isEnabled]);

  // このコンポーネントは何もレンダリングしない
  return null;
}