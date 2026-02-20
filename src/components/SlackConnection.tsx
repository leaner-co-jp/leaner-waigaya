import React, { useState, useEffect } from "react"
import { SlackConfig, SlackMessage } from "../lib/types"
import { tauriAPI } from "../lib/tauri-api"
import { ChannelManager } from "./ChannelManager"
import { DisplaySettingsComponent, DisplaySettings } from "./DisplaySettings"
import { EmojiManager } from "./EmojiManager"
import { UserManager } from "./UserManager"
import { textQueue } from "../lib/TextQueue"

export const SlackConnection: React.FC = () => {
  const [config, setConfig] = useState<SlackConfig>({
    botToken: "",
    appToken: "",
  })
  const [isConnected, setIsConnected] = useState(false)
  const [status, setStatus] = useState("未接続")
  const [isLoading, setIsLoading] = useState(false)
  const [showConnectionDialog, setShowConnectionDialog] = useState(false)
  const [showDisplaySettings, setShowDisplaySettings] = useState(false)
  const [showEmojiManager, setShowEmojiManager] = useState(false)
  const [showChannelManager, setShowChannelManager] = useState(false)

  // 初期化時に保存された設定を読み込み
  useEffect(() => {
    loadSavedConfig()

    // TextQueueのコールバックを設定
    textQueue.setMessageCallback((message: SlackMessage) => {
      console.log("📤 TextQueueからメッセージ送信:", message)
      console.log("📤 TextQueue -> DisplayWindow経由でメッセージ送信:", {
        text: message.text?.substring(0, 50),
        user: message.user,
        hasIcon: !!message.userIcon,
      })
      tauriAPI.displaySlackMessage(message)
    })

    // SlackメッセージをTextQueueに追加する要求を受信
    tauriAPI.onAddToTextQueue((message: SlackMessage) => {
      console.log(
        "📨 SlackメッセージをTextQueueに追加:",
        message.text?.substring(0, 50) || "テキストなし"
      )
      console.log("📨 受信メッセージ詳細:", {
        text: message.text,
        user: message.user,
        userIcon: message.userIcon,
        _queueAction: message._queueAction,
      })
      // _queueActionフラグを削除してTextQueueに追加
      const cleanMessage = { ...message }
      delete cleanMessage._queueAction
      console.log("📨 TextQueue追加前のメッセージ:", cleanMessage)
      textQueue.addSlackMessage(cleanMessage)
    })

    return () => {
      // クリーンアップ
      textQueue.clear()
    }
  }, [])

  const loadSavedConfig = async () => {
    try {
      const result = await tauriAPI.loadConfig()
      if (result.success && result.config) {
        setConfig(result.config)
        // 設定が読み込まれた場合は接続テストを実行
        if (result.config.botToken && result.config.appToken) {
          testConnection(result.config)
        }
      }
    } catch (error) {
      console.error("設定読み込みエラー:", error)
    }
  }

  const testConnection = async (testConfig: SlackConfig = config) => {
    if (!testConfig.botToken || !testConfig.appToken) {
      setStatus("Bot Token と App Token が必要です")
      setIsConnected(false)
      return
    }

    setIsLoading(true)
    setStatus("接続テスト中... (最大30秒)")

    try {
      console.log("🔍 フロントエンド: 接続テスト開始")
      const result = await tauriAPI.slackTestConnection(testConfig)
      console.log("🔍 フロントエンド: 接続テスト結果:", result)

      if (result.success) {
        setStatus("✅ 接続テスト成功")

        // 🚀 現行システムと同じ動作: 接続テスト成功後、自動的に実際の接続を実行
        console.log("🚀 保存されたトークンで自動接続を開始します")
        setStatus("保存された設定で自動接続中...")

        try {
          // 設定を保存
          const saveResult = await tauriAPI.saveConfig(testConfig)
          if (!saveResult.success) {
            setStatus(`❌ 設定保存失敗: ${saveResult.error}`)
            return
          }

          // 実際のSlack接続を自動実行
          const connectResult = await tauriAPI.slackConnect(
            testConfig
          )
          if (connectResult.success) {
            setStatus("✅ Slack自動接続成功")
            setIsConnected(true)
            console.log("🎯 現行システムと同じ動作: 自動接続完了")

            // 🚀 現行システムと同じ動作: 接続成功後にローカルデータを自動読み込み
            await loadLocalData()

            // 🚀 現行システムと同じ動作: 接続成功後にユーザー一覧を自動取得
            console.log("📥 ユーザー一覧を自動取得開始...")
            try {
              const usersResult = await tauriAPI.slackReloadUsers()
              if (usersResult.success) {
                console.log(
                  `✅ ユーザー一覧自動取得完了: ${usersResult.count}件`
                )
              } else {
                console.warn("⚠️ ユーザー一覧自動取得失敗:", usersResult.error)
              }
            } catch (error) {
              console.error("❌ ユーザー一覧自動取得エラー:", error)
            }
          } else {
            setStatus(
              `❌ Slack自動接続失敗: ${connectResult.error || "不明なエラー"}`
            )
            setIsConnected(false)
          }
        } catch (connectError) {
          setStatus(`❌ 自動接続エラー: ${connectError}`)
          setIsConnected(false)
        }
      } else {
        setStatus(`❌ 接続失敗: ${result.error || "不明なエラー"}`)
        setIsConnected(false)

        // Socket Mode関連のエラーの場合、詳細な説明を表示
        if (result.error?.includes("Socket Mode")) {
          alert(`Socket Mode接続に失敗しました。

考えられる原因:
1. SlackアプリでSocket Modeが有効化されていない
2. App TokenにSocket Mode権限が設定されていない
3. Event Subscriptionsが設定されていない

現在でも以下の機能は利用できます:
- チャンネル一覧取得
- チャンネル管理
- サンプルメッセージ表示

リアルタイムメッセージ受信には、Slackアプリの設定でSocket Modeを有効化してください。`)
        }
      }
    } catch (error) {
      console.error("🔍 フロントエンド: 接続テストエラー:", error)
      setStatus(`❌ 接続エラー: ${error}`)
      setIsConnected(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleConnect = async () => {
    setIsLoading(true)

    try {
      // 設定を保存
      const saveResult = await tauriAPI.saveConfig(config)
      if (!saveResult.success) {
        setStatus(`❌ 設定保存失敗: ${saveResult.error}`)
        return
      }

      // 接続実行
      const connectResult = await tauriAPI.slackConnect(config)
      if (connectResult.success) {
        setStatus("✅ Slack接続成功")
        setIsConnected(true)
        setShowConnectionDialog(false)

        // 手動接続成功時もローカルデータを自動読み込み
        await loadLocalData()

        // 手動接続成功時もユーザー一覧を自動取得
        console.log("📥 手動接続: ユーザー一覧を自動取得開始...")
        try {
          const usersResult = await tauriAPI.slackReloadUsers()
          if (usersResult.success) {
            console.log(
              `✅ 手動接続: ユーザー一覧自動取得完了: ${usersResult.count}件`
            )
          } else {
            console.warn(
              "⚠️ 手動接続: ユーザー一覧自動取得失敗:",
              usersResult.error
            )
          }
        } catch (error) {
          console.error("❌ 手動接続: ユーザー一覧自動取得エラー:", error)
        }
      } else {
        setStatus(`❌ Slack接続失敗: ${connectResult.error || "不明なエラー"}`)
        setIsConnected(false)
      }
    } catch (error) {
      setStatus(`❌ 接続エラー: ${error}`)
      setIsConnected(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClearConfig = () => {
    setConfig({ botToken: "", appToken: "" })
    setIsConnected(false)
    setStatus("設定をクリアしました")
  }

  // ローカルデータ自動読み込み（現行 control.js:loadLocalData()と同等）
  const loadLocalData = async () => {
    try {
      console.log("📁 ローカルデータ自動読み込み開始...")

      // 1. ユーザーデータをローカルから読み込み
      const usersResult = await tauriAPI.setLocalUsersData()
      if (usersResult.success) {
        console.log("📁 ローカルユーザーデータをSlackWatcherに設定しました")
      } else {
        console.log("📁 有効なローカルユーザーデータが見つかりません")
      }

      // 2. カスタム絵文字データをローカルから読み込み
      const emojisResult = await tauriAPI.setLocalEmojisData()
      if (emojisResult.success) {
        console.log(
          "📁 ローカルカスタム絵文字データをSlackWatcherに設定しました"
        )
      } else {
        console.log("📁 有効なローカルカスタム絵文字データが見つかりません")
      }

      console.log("✅ ローカルデータ自動読み込み完了")

      // 3. カスタム絵文字の更新チェック（1週間以上経過していたら自動取得）
      await refreshEmojisIfStale()
    } catch (error) {
      console.error("❌ ローカルデータ読み込みエラー:", error)
    }
  }

  // カスタム絵文字が古い場合（1週間以上）に自動取得
  const refreshEmojisIfStale = async () => {
    const ONE_WEEK_SECONDS = 7 * 24 * 60 * 60

    try {
      const lastUpdated = await tauriAPI.getEmojisLastUpdated()
      const nowSeconds = Math.floor(Date.now() / 1000)

      if (lastUpdated === null || nowSeconds - lastUpdated >= ONE_WEEK_SECONDS) {
        const reason = lastUpdated === null ? "データなし" : "1週間以上経過"
        console.log(`📙 カスタム絵文字自動取得開始（${reason}）`)
        const result = await tauriAPI.getCustomEmojis()
        if (result.success && result.emojis) {
          console.log(`📙 カスタム絵文字自動取得完了: ${result.emojis.length}個`)
        } else {
          console.warn("⚠️ カスタム絵文字自動取得失敗:", result.error)
        }
      } else {
        const daysAgo = Math.floor((nowSeconds - lastUpdated) / 86400)
        console.log(`📙 カスタム絵文字は最新です（${daysAgo}日前に取得済み）`)
      }
    } catch (error) {
      console.error("❌ カスタム絵文字更新チェックエラー:", error)
    }
  }

  const addSampleMessage = () => {
    // ランダムなユーザー名とメッセージ（元のcontrol.jsから移植）
    const users = [
      { name: "Taro", icon: "https://randomuser.me/api/portraits/men/1.jpg" },
      {
        name: "Hanako",
        icon: "https://randomuser.me/api/portraits/women/2.jpg",
      },
      { name: "Bot", icon: "https://randomuser.me/api/portraits/lego/1.jpg" },
      { name: "Yusuke", icon: "https://randomuser.me/api/portraits/men/3.jpg" },
      { name: "Miku", icon: "https://randomuser.me/api/portraits/women/4.jpg" },
    ]

    const messages = [
      "こんにちは！Slack連携テストです。",
      "サンプルメッセージを表示します。",
      "AIからの自動投稿です。",
      "本番環境でも動作しますか？",
      "これはダミーメッセージです。",
      "お疲れ様です！",
      "新しいお知らせがあります。",
      "テスト投稿です。",
      "Slack連携が成功しました！",
      "メッセージの表示テスト中です。",
    ]

    const user = users[Math.floor(Math.random() * users.length)]
    const text = messages[Math.floor(Math.random() * messages.length)]

    const sampleMessage: SlackMessage = {
      text,
      user: user.name,
      userIcon: user.icon,
    }

    console.log("🎯 サンプルメッセージをTextQueueに追加:", sampleMessage)
    // 現行システムと同じ動作：TextQueueに追加して3秒間隔で表示
    textQueue.addSlackMessage(sampleMessage)
  }

  const handleDisplaySettingsChange = (settings: DisplaySettings) => {
    console.log("🎨 表示設定が変更されました:", settings)
    // 透過表示ウィンドウに設定変更を通知
    // この機能は後で実装
  }

  return (
    <div className="container max-w-xl mx-auto bg-white p-5 rounded-lg shadow-lg">
      <h1 className="text-gray-800 mb-5 text-xl font-bold">
        Waigaya - Slack接続設定
      </h1>

      {/* Slack接続状況 */}
      <div className="slack-card bg-white p-5 rounded-xl shadow-md mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">💬 Slack連携</h3>
        </div>

        <div
          className={`status-section mb-4 border-l-4 pl-3 ${
            isConnected ? "border-green-500" : "border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <div className="status-icon w-4 h-4 flex items-center justify-center rounded-full bg-gray-100 text-xs">
                {isConnected ? "🟢" : "🔴"}
              </div>
              <div className="ml-2">
                <div className="font-medium">接続状況</div>
                <div className="text-sm text-gray-600">{status}</div>
              </div>
            </div>
            <button
              className="small-btn bg-blue-600 text-white px-3 py-1 rounded-sm text-sm hover:bg-blue-700 disabled:opacity-50"
              onClick={() => setShowConnectionDialog(true)}
              disabled={isLoading}
            >
              🔌 接続設定
            </button>
          </div>
        </div>

        {/* ユーザー一覧管理機能（現行システムと同等） */}
        <UserManager isConnected={isConnected} />

        {/* チャンネル管理機能 */}
        <ChannelManager isConnected={isConnected} />
      </div>

      {/* サンプルメッセージ機能 */}
      <div className="mb-5">
        <div className="bg-white p-4 rounded-xl shadow-md">
          <h3 className="font-semibold text-lg mb-3">🧪 テスト機能</h3>
          <button
            onClick={addSampleMessage}
            className="bg-blue-600 text-white px-4 py-2 rounded-sm hover:bg-blue-800 mr-2 mb-2"
          >
            サンプルメッセージを追加
          </button>
          <button
            onClick={() => setShowDisplaySettings(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-sm hover:bg-purple-800 mr-2 mb-2"
          >
            🎨 表示設定
          </button>
          <button
            onClick={() => setShowEmojiManager(true)}
            className="bg-yellow-600 text-white px-4 py-2 rounded-sm hover:bg-yellow-800 mr-2 mb-2"
            disabled={!isConnected}
          >
            📙 絵文字管理
          </button>
          <p className="text-sm text-gray-600 mt-2">
            ランダムなサンプルメッセージを生成してテスト表示します。表示設定でフォント・色・透明度を調整できます。
          </p>
        </div>
      </div>

      {/* 接続設定ダイアログ */}
      {showConnectionDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">🔌 Slack接続設定</h2>
              <button
                className="bg-gray-300 text-gray-800 rounded-sm px-3 py-1 hover:bg-gray-400"
                onClick={() => setShowConnectionDialog(false)}
              >
                閉じる
              </button>
            </div>

            <div className="slack-config">
              <div className="mb-4">
                <label htmlFor="botToken" className="block mb-1 font-semibold">
                  Bot Token (xoxb-):
                </label>
                <input
                  type="password"
                  id="botToken"
                  placeholder="xoxb-your-bot-token"
                  value={config.botToken}
                  onChange={(e) =>
                    setConfig({ ...config, botToken: e.target.value })
                  }
                  className="border rounded-sm px-3 py-2 mb-2 w-full focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="appToken" className="block mb-1 font-semibold">
                  App Token (xapp-):
                </label>
                <input
                  type="password"
                  id="appToken"
                  placeholder="xapp-your-app-token"
                  value={config.appToken}
                  onChange={(e) =>
                    setConfig({ ...config, appToken: e.target.value })
                  }
                  className="border rounded-sm px-3 py-2 mb-2 w-full focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="controls mb-4 flex gap-2">
                <button
                  onClick={() => testConnection()}
                  disabled={isLoading || !config.botToken || !config.appToken}
                  className="bg-green-600 text-white rounded-sm px-4 py-2 hover:bg-green-800 disabled:opacity-50"
                >
                  {isLoading ? "接続テスト中..." : "接続テスト"}
                </button>
                <button
                  onClick={handleConnect}
                  disabled={isLoading || !config.botToken || !config.appToken}
                  className="bg-blue-600 text-white rounded-sm px-4 py-2 hover:bg-blue-800 disabled:opacity-50"
                >
                  {isLoading ? "接続中..." : "Slack接続"}
                </button>
                <button
                  onClick={handleClearConfig}
                  className="bg-red-600 text-white rounded-sm px-4 py-2 hover:bg-red-800"
                >
                  設定クリア
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 表示設定ダイアログ */}
      <DisplaySettingsComponent
        isOpen={showDisplaySettings}
        onClose={() => setShowDisplaySettings(false)}
        onSettingsChange={handleDisplaySettingsChange}
      />

      {/* 絵文字管理ダイアログ */}
      <EmojiManager
        isOpen={showEmojiManager}
        onClose={() => setShowEmojiManager(false)}
        isConnected={isConnected}
      />
    </div>
  )
}
