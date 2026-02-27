import React from "react"
import { LogEntry, LogLevel } from "../hooks/useLogger"

interface LogViewerProps {
  logs: LogEntry[]
  onClear: () => void
}

const levelStyle: Record<LogLevel, string> = {
  info: "bg-gray-100 text-gray-600",
  warn: "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-700",
}

const categoryStyle: Record<string, string> = {
  メッセージ: "bg-blue-100 text-blue-700",
  接続: "bg-green-100 text-green-700",
  設定: "bg-purple-100 text-purple-700",
  ユーザー: "bg-indigo-100 text-indigo-700",
  チャンネル: "bg-teal-100 text-teal-700",
  絵文字: "bg-orange-100 text-orange-700",
  リアクション: "bg-pink-100 text-pink-700",
}

const formatTime = (date: Date) =>
  date.toTimeString().slice(0, 8)

export const LogViewer: React.FC<LogViewerProps> = ({ logs, onClear }) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-lg">📋 ログ</h3>
        <button
          onClick={onClear}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-300 hover:bg-gray-50"
        >
          クリア
        </button>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          ログはまだありません
        </p>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-1 font-mono text-xs">
          {logs.map((entry) => (
            <div
              key={entry.id}
              className={`flex items-start gap-1.5 px-2 py-1 rounded ${levelStyle[entry.level]}`}
            >
              <span className="shrink-0 text-gray-400">
                {formatTime(entry.timestamp)}
              </span>
              <span
                className={`shrink-0 px-1 rounded text-[10px] font-semibold ${
                  categoryStyle[entry.category] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {entry.category}
              </span>
              <span className="break-all">{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
