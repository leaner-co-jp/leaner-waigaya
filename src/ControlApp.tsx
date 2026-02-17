import React, { useState, useEffect } from "react"
import { check, Update } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import { SlackConnection } from "./components/SlackConnection"

export const ControlApp: React.FC = () => {
  const [update, setUpdate] = useState<Update | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    check()
      .then((u) => {
        if (u?.available) {
          setUpdate(u)
        }
      })
      .catch((e) => {
        console.error("アップデートチェックに失敗:", e)
      })
  }, [])

  const handleUpdate = async () => {
    if (!update) return
    setUpdating(true)
    try {
      await update.downloadAndInstall()
      await relaunch()
    } catch (e) {
      console.error("アップデートに失敗:", e)
      setUpdating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {update && (
        <div className="mx-4 mb-4 flex items-center justify-between rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
          <span className="text-sm text-blue-800">
            v{update.version} が利用可能です
          </span>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="rounded-sm bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updating ? "更新中..." : "更新する"}
          </button>
        </div>
      )}
      <SlackConnection />
    </div>
  )
}
