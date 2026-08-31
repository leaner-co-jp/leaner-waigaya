import React, { useState, useEffect, useCallback, useRef } from "react"
import { check } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import { SlackConnection } from "./components/SlackConnection"

type UpdateState =
  | { phase: "idle" }
  | { phase: "installing"; version: string; percent: number | null }
  | { phase: "failed"; message: string }

export const ControlApp: React.FC = () => {
  const [updateState, setUpdateState] = useState<UpdateState>({ phase: "idle" })
  // 起動時チェックの二重実行ガード（Strict Mode でのマウント2回に備える）
  const startedRef = useRef(false)

  // 起動時に更新を確認し、あれば同意を求めずそのまま適用して再起動する。
  // 古いバージョンが残ると多重起動の警告など新しい診断が効かないため、常に最新に揃える。
  const runUpdate = useCallback(async () => {
    try {
      const update = await check()
      if (!update?.available) return

      setUpdateState({ phase: "installing", version: update.version, percent: null })

      let contentLength = 0
      let downloaded = 0
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            contentLength = event.data.contentLength ?? 0
            break
          case "Progress":
            downloaded += event.data.chunkLength
            if (contentLength > 0) {
              setUpdateState({
                phase: "installing",
                version: update.version,
                percent: Math.min(100, Math.round((downloaded / contentLength) * 100)),
              })
            }
            break
          case "Finished":
            setUpdateState({ phase: "installing", version: update.version, percent: 100 })
            break
        }
      })

      await relaunch()
    } catch (e) {
      // 更新に失敗しても起動は止めない。次回起動時に再試行される
      console.error("アップデートに失敗:", e)
      setUpdateState({ phase: "failed", message: String(e) })
    }
  }, [])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    runUpdate()
  }, [runUpdate])

  if (updateState.phase === "installing") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center px-8">
        <div className="w-full max-w-sm rounded-lg bg-white px-6 py-8 shadow-lg text-center">
          <div className="text-base font-semibold text-gray-800">
            v{updateState.version} に更新しています
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full bg-blue-600 transition-[width] duration-200 ${
                updateState.percent === null ? "w-1/3 animate-pulse" : ""
              }`}
              style={updateState.percent === null ? undefined : { width: `${updateState.percent}%` }}
            />
          </div>
          <div className="mt-3 text-xs text-gray-500">
            {updateState.percent === null
              ? "ダウンロードを準備しています..."
              : `${updateState.percent}%`}
          </div>
          <div className="mt-4 text-xs text-gray-500 leading-relaxed">
            完了すると自動で再起動します。そのままお待ちください。
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      {updateState.phase === "failed" && (
        <div className="mx-4 mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-sm text-amber-800">
            自動更新に失敗しました（{updateState.message}）
          </span>
          <button
            onClick={() => {
              setUpdateState({ phase: "idle" })
              runUpdate()
            }}
            className="shrink-0 rounded-sm bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700"
          >
            再試行
          </button>
        </div>
      )}
      <SlackConnection />
    </div>
  )
}
