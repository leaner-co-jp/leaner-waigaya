import React, { useState, useEffect } from "react"

interface UserManagerProps {
  isConnected: boolean
}

export const UserManager: React.FC<UserManagerProps> = ({ isConnected }) => {
  const [usersStatus, setUsersStatus] = useState("未取得")
  const [statusType, setStatusType] = useState<
    "default" | "warning" | "connected" | "error"
  >("default")
  const [statusIcon, setStatusIcon] = useState("⚪")
  const [isLoading, setIsLoading] = useState(false)
  const [usersCount, setUsersCount] = useState(0)

  // 接続状態とイベントリスナーの管理
  useEffect(() => {
    if (isConnected) {
      // 接続時にまず一度キャッシュ状態を確認
      checkCacheStatus()

      // ユーザーデータ更新イベントのリスナーを登録
      window.electronAPI.onUserDataUpdated((count: number) => {
        console.log(`[EVENT] user-data-updated イベント受信: ${count}件`)
        setUsersCount(count)
        updateUsersStatus(`キャッシュあり (${count}件)`, "connected")
      })
    } else {
      // 切断時は未取得状態にリセット
      updateUsersStatus("未接続", "default")
      setUsersCount(0)
    }

    // コンポーネントのクリーンアップ
    return () => {
      if (window.electronAPI.clearUserDataUpdated) {
        window.electronAPI.clearUserDataUpdated()
      }
    }
  }, [isConnected])

  // キャッシュ状態を確認
  const checkCacheStatus = async () => {
    try {
      const result = await window.electronAPI.slackGetUsersCount()
      if (result.success && result.count > 0) {
        setUsersCount(result.count)
        updateUsersStatus(`キャッシュあり (${result.count}件)`, "connected")
      } else {
        updateUsersStatus("未取得 - リロードしてください", "warning")
      }
    } catch (error) {
      console.error("ユーザー数取得エラー:", error)
      updateUsersStatus("未取得 - リロードしてください", "warning")
    }
  }

  // ユーザー一覧の手動リロード
  const handleReloadUsers = async () => {
    if (!isConnected) {
      return
    }

    setIsLoading(true)
    updateUsersStatus("ユーザー一覧をリロード中...", "warning")

    try {
      console.log("📥 ユーザー一覧リロード開始...")
      const result = await window.electronAPI.slackReloadUsers()

      // UI更新は onUserDataUpdated イベント経由で行われるため、ここでは成功/失敗の表示のみ
      if (result.success) {
        // 成功時のメッセージはイベント側で出すので、ここではローディング解除のみ
        console.log("✅ ユーザー一覧のリロード要求が正常に完了しました")
      } else {
        updateUsersStatus(
          `リロード失敗: ${result.error || "不明なエラー"}`,
          "error"
        )
        console.error("❌ ユーザーリロード失敗:", result.error)
      }
    } catch (error) {
      updateUsersStatus(`リロードエラー: ${error}`, "error")
      console.error("❌ ユーザーリロードエラー:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // ステータス更新
  const updateUsersStatus = (
    message: string,
    status: "default" | "warning" | "connected" | "error"
  ) => {
    setUsersStatus(message)
    setStatusType(status)

    // アイコンを状態に応じて更新
    switch (status) {
      case "connected":
        setStatusIcon("🟢")
        break
      case "error":
        setStatusIcon("🔴")
        break
      case "warning":
        setStatusIcon("🟡")
        break
      default:
        setStatusIcon("⚪")
        break
    }
  }

  // 状態に応じたCSSクラスを取得
  const getSectionClass = () => {
    const baseClass = "status-section mb-4 border-l-4 pl-3"
    switch (statusType) {
      case "connected":
        return `${baseClass} border-green-500`
      case "error":
        return `${baseClass} border-red-500`
      case "warning":
        return `${baseClass} border-yellow-500`
      default:
        return `${baseClass} border-gray-300`
    }
  }

  return (
    <div className={getSectionClass()}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <div className="status-icon w-4 h-4 flex items-center justify-center rounded-full bg-gray-100 text-xs">
            {statusIcon}
          </div>
          <div className="ml-2">
            <div className="font-medium">ユーザー一覧</div>
            <div className="text-sm text-gray-600">{usersStatus}</div>
          </div>
        </div>
        <button
          onClick={handleReloadUsers}
          disabled={!isConnected || isLoading}
          className="bg-blue-600 text-white rounded-sm px-3 py-1 text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "リロード中..." : "リロード"}
        </button>
      </div>
    </div>
  )
}
