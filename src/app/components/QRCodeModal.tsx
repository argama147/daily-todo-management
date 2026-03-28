"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRCodeModalProps {
  isOpen: boolean;
  url: string;
  onClose: () => void;
}

export default function QRCodeModal({ isOpen, url, onClose }: QRCodeModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg max-w-sm w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">別のデバイスと設定を同期</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          AndroidのカメラでQRコードを読み取ると、現在の設定が同期されます。
        </p>

        <div className="flex justify-center mb-4">
          <QRCodeSVG value={url} size={240} level="M" />
        </div>

        <div className="flex gap-2 mb-4">
          <input
            readOnly
            value={url}
            className="flex-1 text-xs text-gray-500 border border-gray-200 rounded px-2 py-1.5 truncate bg-gray-50"
          />
          <button
            onClick={handleCopy}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded border border-gray-200 whitespace-nowrap"
          >
            {copied ? "コピー済" : "コピー"}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
