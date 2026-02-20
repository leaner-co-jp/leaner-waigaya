import React, { useState, useEffect } from "react"
import { CustomEmoji } from "../lib/types"
import { tauriAPI } from "../lib/tauri-api"

interface EmojiManagerProps {
  isOpen: boolean
  onClose: () => void
  isConnected: boolean
}

export const EmojiManager: React.FC<EmojiManagerProps> = ({
  isOpen,
  onClose,
  isConnected,
}) => {
  const [emojis, setEmojis] = useState<CustomEmoji[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedEmoji, setSelectedEmoji] = useState<CustomEmoji | null>(null)
  const [status, setStatus] = useState("未取得")
  const [statusType, setStatusType] = useState<
    "default" | "warning" | "connected" | "error"
  >("default")
  const [statusIcon, setStatusIcon] = useState("⚪")

  // 状態表示の更新（現行システムのupdateEmojisStatus()と同等）
  const updateEmojiStatus = (
    message: string,
    type: "default" | "warning" | "connected" | "error"
  ) => {
    setStatus(message)
    setStatusType(type)

    // 状態別アイコンを設定（現行システムと同じ）
    switch (type) {
      case "connected":
        setStatusIcon("🟢")
        break
      case "warning":
        setStatusIcon("🟡")
        break
      case "error":
        setStatusIcon("🔴")
        break
      default:
        setStatusIcon("⚪")
        break
    }
  }

  // 絵文字一覧を取得（現行 slack-client.js:fetchCustomEmojis()と同等）
  const loadEmojis = async () => {
    if (!isConnected) {
      updateEmojiStatus("未接続 - 先にSlackに接続してください", "error")
      return
    }

    setIsLoading(true)
    updateEmojiStatus("カスタム絵文字取得中...", "warning")

    try {
      const result = await tauriAPI.getCustomEmojis()
      if (result.success && result.emojis) {
        setEmojis(result.emojis)
        updateEmojiStatus(`取得完了 (${result.emojis.length}個)`, "connected")
        console.log(`📙 カスタム絵文字取得完了: ${result.emojis.length}個`)

        // ローカルファイルに保存
        try {
          const saveResult = await tauriAPI.saveEmojisData(
            result.emojis.reduce((acc, emoji) => {
              acc[emoji.name] = emoji.url
              return acc
            }, {} as any)
          )

          if (saveResult.success) {
            console.log("💾 カスタム絵文字データをローカルに保存しました")
          }
        } catch (saveError) {
          console.warn("⚠️ カスタム絵文字データの保存に失敗:", saveError)
        }
      } else {
        updateEmojiStatus(`取得失敗: ${result.error}`, "error")
      }
    } catch (error) {
      console.error("絵文字取得エラー:", error)
      updateEmojiStatus("取得中にエラーが発生しました", "error")
    } finally {
      setIsLoading(false)
    }
  }

  // ダイアログが開かれた時に絵文字を読み込み
  useEffect(() => {
    if (isOpen) {
      if (isConnected) {
        if (emojis.length === 0) {
          loadEmojis()
        } else {
          updateEmojiStatus(`キャッシュあり (${emojis.length}個)`, "connected")
        }
      } else {
        updateEmojiStatus("未接続", "default")
      }
    }
  }, [isOpen, isConnected])

  useEffect(() => {
    const cleanup = tauriAPI.onCustomEmojisData((data) => {
      console.log("🔄 EmojiManager: custom-emojis-data受信")
      if (typeof data === "object" && data !== null) {
        const emojiArray = Object.entries(data).map(([name, url]) => ({
          name,
          url: url as string,
        }))
        setEmojis(emojiArray)
        updateEmojiStatus(`更新完了 (${emojiArray.length}個)`, "connected")
      }
    })

    return () => {
      if (cleanup) {
        cleanup()
      }
    }
  }, [])

  // 絵文字検索フィルタリング
  const filteredEmojis = emojis.filter((emoji) =>
    emoji.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 絵文字コードをクリップボードにコピー
  const copyEmojiCode = (emojiName: string) => {
    const code = `:${emojiName}:`
    navigator.clipboard
      .writeText(code)
      .then(() => {
        alert(`絵文字コード "${code}" をクリップボードにコピーしました`)
      })
      .catch(() => {
        // フォールバック：テキストエリアを使用してコピー
        const textArea = document.createElement("textarea")
        textArea.value = code
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand("copy")
        document.body.removeChild(textArea)
        alert(`絵文字コード "${code}" をクリップボードにコピーしました`)
      })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">📙 カスタム絵文字管理</h2>
          <button
            className="bg-gray-300 text-gray-800 rounded-sm px-3 py-1 hover:bg-gray-400"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>

        {/* 状態表示（現行システムのUI状態管理と同等） */}
        <div
          className={`mb-4 border-l-4 pl-3 ${
            statusType === "connected"
              ? "border-green-500"
              : statusType === "warning"
              ? "border-yellow-500"
              : statusType === "error"
              ? "border-red-500"
              : "border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div className="status-icon w-4 h-4 flex items-center justify-center rounded-full bg-gray-100 text-xs">
                {statusIcon}
              </div>
              <div className="ml-2">
                <div className="font-medium">絵文字状態</div>
                <div
                  className={`text-sm ${
                    statusType === "connected"
                      ? "text-green-600"
                      : statusType === "warning"
                      ? "text-yellow-600"
                      : statusType === "error"
                      ? "text-red-600"
                      : "text-gray-600"
                  }`}
                >
                  {status}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* コントロール */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="絵文字名で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="border rounded-sm px-3 py-2 flex-1 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            disabled={!isConnected}
          />
          <button
            onClick={loadEmojis}
            disabled={!isConnected || isLoading}
            className="bg-blue-600 text-white rounded-sm px-4 py-2 hover:bg-blue-800 whitespace-nowrap disabled:opacity-50"
          >
            {isLoading ? "読み込み中..." : "🔄 更新"}
          </button>
        </div>

        {/* 統計 */}
        <div className="mb-4 text-sm text-gray-600">
          {filteredEmojis.length > 0 && (
            <span>
              {searchTerm
                ? `${filteredEmojis.length}件の検索結果`
                : `合計 ${emojis.length}個の絵文字`}
              {searchTerm && ` (全${emojis.length}個中)`}
            </span>
          )}
        </div>

        {/* 絵文字一覧 */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">読み込み中...</div>
            </div>
          ) : filteredEmojis.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">
                {emojis.length === 0
                  ? "カスタム絵文字が見つかりません。先にSlackに接続して「🔄 更新」ボタンをクリックしてください。"
                  : "検索条件に一致する絵文字が見つかりません。"}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {filteredEmojis.map((emoji) => (
                <div
                  key={emoji.name}
                  className="flex flex-col items-center p-2 border rounded-sm hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedEmoji(emoji)}
                  title={`:${emoji.name}:`}
                >
                  <img
                    src={emoji.url}
                    alt={emoji.name}
                    className="w-8 h-8 mb-1"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = "none"
                    }}
                  />
                  <span className="text-xs truncate w-full text-center">
                    {emoji.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 詳細表示・操作 */}
        {selectedEmoji && (
          <div className="mt-4 p-4 bg-gray-50 rounded-sm">
            <div className="flex items-center gap-4">
              <img
                src={selectedEmoji.url}
                alt={selectedEmoji.name}
                className="w-12 h-12"
              />
              <div className="flex-1">
                <div className="font-semibold">:{selectedEmoji.name}:</div>
                <div className="text-sm text-gray-600 break-all">
                  {selectedEmoji.url}
                </div>
              </div>
              <button
                onClick={() => copyEmojiCode(selectedEmoji.name)}
                className="bg-green-600 text-white rounded-sm px-3 py-1 hover:bg-green-700 text-sm"
              >
                📋 コピー
              </button>
            </div>
          </div>
        )}

        {/* ヘルプ */}
        <div className="mt-4 text-xs text-gray-500">
          💡 絵文字をクリックして詳細を表示し、「📋
          コピー」ボタンで絵文字コード（:name:）をクリップボードにコピーできます。
        </div>
      </div>
    </div>
  )
}
