const { WebClient } = require("@slack/web-api")
const { SocketModeClient } = require("@slack/socket-mode")

class SlackWatcher {
  constructor() {
    this.webClient = null
    this.socketClient = null
    this.isConnected = false
    this.watchedChannels = new Set()
    this.messageCallback = null
    this.config = {
      botToken: "",
      appToken: "",
      channels: [],
    }
    this.userCache = {}
  }

  // 設定を更新
  async updateConfig(config) {
    this.config = { ...this.config, ...config }
    this.webClient = new WebClient(this.config.botToken)
    // ユーザー情報を一括取得
    await this.fetchAllUsers()

    // 監視チャンネルを復元
    if (config.channels && Array.isArray(config.channels)) {
      console.log("🔄 SlackWatcher: 監視チャンネルを復元:", config.channels)
      this.watchedChannels.clear()
      config.channels.forEach((channelId) => {
        this.watchedChannels.add(channelId)
      })
      console.log(
        "✅ SlackWatcher: 復元完了:",
        Array.from(this.watchedChannels)
      )
    }
  }

  // メッセージ受信時のコールバック設定
  onMessage(callback) {
    this.messageCallback = callback
  }

  // Slackに接続
  async connect() {
    if (!this.config.botToken || !this.config.appToken) {
      throw new Error("Bot Token と App Token が必要です")
    }

    try {
      // 既存の接続を切断
      if (this.socketClient) {
        console.log("🧹 既存接続をクリーンアップ中...")
        await this.disconnect()
      }

      // まず接続テストを実行
      console.log("🔍 事前接続テスト実行中...")
      const testResult = await this.testConnection()
      if (!testResult.success) {
        throw new Error(`接続テスト失敗: ${testResult.error}`)
      }
      console.log("✅ 事前接続テスト成功")

      // Socket Mode接続（タイムアウト設定）
      console.log("🔌 Socket Mode接続開始...")
      console.log("📋 接続設定:", {
        appToken: this.config.appToken?.substring(0, 20) + "...",
        botToken: this.config.botToken?.substring(0, 20) + "...",
      })

      // Socket Mode クライアントを新しく作成
      const { SocketModeClient } = require("@slack/socket-mode")
      this.socketClient = new SocketModeClient({
        appToken: this.config.appToken,
        logLevel: "debug",
      })

      // WebClientも更新（Socket Modeと同じトークンで統一）
      this.webClient = new WebClient(this.config.botToken)

      // エラーハンドリング
      this.socketClient.on("error", (error) => {
        console.error("🚨 Socket接続エラー:", error)
      })

      this.socketClient.on("close", (code, reason) => {
        console.log("🔌 Socket接続クローズ:", { code, reason })
        this.isConnected = false
      })

      this.socketClient.on("ready", () => {
        console.log("🚀 Socket接続準備完了")
      })

      this.socketClient.on("slack_event", (event) => {
        console.log("🎉 最初のSlack Event受信 - 接続確立完了")
      })

      this.socketClient.on("connecting", () => {
        console.log("🔄 Socket接続中...")
      })

      this.socketClient.on("authenticated", () => {
        console.log("🔐 Socket認証完了")
      })

      // Socket Modeで受信する全イベントをキャッチ
      this.socketClient.on("slack_event", (event) => {
        console.log("🔔 Slack Event受信:", JSON.stringify(event, null, 2))
        this.handleSocketEvent(event)
      })

      this.socketClient.on("message", (event) => {
        console.log("📨 Socket Message受信:", JSON.stringify(event, null, 2))
        this.handleSocketEvent(event)
      })

      // 生のWebSocketメッセージもログ出力
      this.socketClient.on("websocket_message", (data) => {
        console.log("🌐 WebSocket Raw Message:", data)
      })

      // Socket Modeからの全てのメッセージ
      this.socketClient.on("message", (message) => {
        console.log(
          "📩 Socket Mode全メッセージ:",
          JSON.stringify(message, null, 2)
        )
      })

      // Slackイベント専用
      this.socketClient.on("slack_event", (event) => {
        console.log("🎯 Slack Event専用:", JSON.stringify(event, null, 2))
      })

      let timeoutId
      const connectPromise = this.socketClient.start()
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          console.error("❌ Socket接続がタイムアウトしました")
          reject(new Error("接続タイムアウト (30秒)"))
        }, 30000)
      })

      try {
        await Promise.race([connectPromise, timeoutPromise])
        // タイムアウトタイマーをクリア
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        this.isConnected = true
        console.log("✅ Socket Mode接続完了")
      } catch (error) {
        console.error("❌ Socket Mode接続失敗:", error)
        // タイムアウトタイマーをクリア
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        // 接続失敗時はクライアントを破棄
        if (this.socketClient) {
          try {
            await this.socketClient.disconnect()
          } catch (disconnectError) {
            console.error("切断エラー:", disconnectError)
          }
        }
        throw error
      }

      console.log("✅ Slack接続成功")
      console.log("👀 監視対象チャンネル:", Array.from(this.watchedChannels))

      // 接続テスト用のpingを送信
      setTimeout(() => {
        if (this.socketClient && this.isConnected) {
          console.log("🏓 Socket Mode接続テスト中...")
          try {
            // Socket Mode接続が有効か確認
            console.log("🔍 Socket Mode接続状態:", {
              isConnected: this.isConnected,
              hasSocketClient: !!this.socketClient,
              watchedChannels: Array.from(this.watchedChannels),
            })
          } catch (error) {
            console.error("❌ Socket Modeテストエラー:", error)
          }
        }
      }, 2000)

      return true
    } catch (error) {
      console.error("❌ Slack接続エラー:", {
        message: error.message,
        code: error.code,
        data: error.data,
        stack: error.stack,
      })
      this.isConnected = false
      throw error
    }
  }

  // 接続を切断
  async disconnect() {
    console.log("🔌 Slack切断開始...")

    if (this.socketClient) {
      try {
        this.socketClient.removeAllListeners()
        if (this.isConnected) {
          await this.socketClient.disconnect()
        }
        console.log("✅ Socket Mode切断完了")
      } catch (error) {
        console.error("❌ Socket切断エラー:", error)
      }
      this.socketClient = null
    }

    this.isConnected = false
    this.watchedChannels.clear()
    this.config.channels = []
    console.log("✅ Slack接続を切断しました")
  }

  // 監視するチャンネルを追加
  async addWatchChannel(channelId) {
    console.log("🔍 チャンネル監視追加:", {
      channelId,
      現在の監視チャンネル: Array.from(this.watchedChannels),
    })

    // チャンネルにボットが参加しているかチェック
    try {
      const channelInfo = await this.getChannelInfo(channelId)
      console.log("📋 監視対象チャンネル情報:", {
        id: channelInfo.id,
        name: channelInfo.name,
        is_member: channelInfo.is_member,
        is_private: channelInfo.is_private,
      })

      if (!channelInfo.is_member) {
        console.warn(
          "⚠️ ボットがチャンネルに参加していません:",
          channelInfo.name
        )
        console.warn(
          "💡 チャンネルにボットを招待してください: /invite @" +
            (await this.webClient.auth.test()).user
        )
      }
    } catch (error) {
      console.error("❌ チャンネル情報取得エラー:", error)
    }

    this.watchedChannels.add(channelId)
    if (!this.config.channels.includes(channelId)) {
      this.config.channels.push(channelId)
    }

    console.log("✅ チャンネル監視追加完了:", {
      追加されたチャンネル: channelId,
      現在の監視チャンネル: Array.from(this.watchedChannels),
    })
  }

  // 監視チャンネルを削除
  removeWatchChannel(channelId) {
    this.watchedChannels.delete(channelId)
    this.config.channels = this.config.channels.filter((id) => id !== channelId)
  }

  // Socket Modeイベントを処理
  async handleSocketEvent(event) {
    try {
      console.log("🔍 handleSocketEvent開始:", {
        eventType: event.type,
        envelope_id: event.envelope_id,
        hasBody: !!event.body,
        hasPayload: !!event.payload,
      })

      // イベントタイプ別処理
      if (event.type === "events_api") {
        // 実際の構造では event.body に入っている
        const slackEvent = event.body?.event || event.payload?.event
        if (!slackEvent) {
          console.error("❌ Slackイベントデータが見つかりません:", event)
          return
        }

        console.log("📬 Events API受信:", {
          type: slackEvent.type,
          channel: slackEvent.channel,
          user: slackEvent.user,
          text: slackEvent.text,
          bot_id: slackEvent.bot_id,
          ts: slackEvent.ts,
        })

        // メッセージイベントのみ処理
        if (slackEvent.type === "message") {
          await this.processMessage(slackEvent, event)
        } else {
          console.log("⚠️ messageイベントではないため無視:", slackEvent.type)
        }
      } else if (event.type === "hello") {
        console.log("👋 Hello受信 - Socket Mode接続確立")
      } else if (event.type === "disconnect") {
        console.log("🔌 切断イベント受信")
      } else {
        console.log("📨 その他のSocket Event:", {
          type: event.type,
          envelope_id: event.envelope_id,
        })
      }

      // ACK送信
      if (event.ack) {
        console.log("📨 ACK送信:", event.envelope_id)
        event.ack()
      }
    } catch (error) {
      console.error("❌ handleSocketEventエラー:", error)
      console.error("❌ エラー時のイベント:", JSON.stringify(event, null, 2))

      // エラーが発生してもACKは送信
      if (event.ack) {
        event.ack()
      }
    }
  }

  // メッセージを処理
  async processMessage(slackEvent, originalEvent) {
    console.log("🔍 processMessage開始:", {
      channel: slackEvent.channel,
      user: slackEvent.user,
      text: slackEvent.text,
      bot_id: slackEvent.bot_id,
    })

    // ボット自身のメッセージは無視
    if (slackEvent.bot_id) {
      console.log("🤖 Botメッセージのため無視:", slackEvent.bot_id)
      return
    }

    console.log("🎯 監視チャンネルチェック:", {
      messageChannel: slackEvent.channel,
      watchedChannels: Array.from(this.watchedChannels),
      isWatched: this.watchedChannels.has(slackEvent.channel),
    })

    // 監視対象チャンネルのみ処理
    if (!this.watchedChannels.has(slackEvent.channel)) {
      console.log("⚠️ 監視対象外チャンネル:", slackEvent.channel)
      return
    }

    try {
      console.log("✅ メッセージ処理開始...")

      // ユーザー情報を取得
      const userInfo = await this.getUserInfo(slackEvent.user)
      console.log("👤 ユーザー情報:", userInfo)

      // メッセージデータを整形
      const messageData = {
        text: slackEvent.text,
        user: userInfo.display_name || userInfo.real_name || userInfo.name,
        userIcon:
          userInfo.image_48 || userInfo.image_32 || userInfo.image_24 || null,
        timestamp: new Date(parseFloat(slackEvent.ts) * 1000),
        raw: slackEvent,
      }

      console.log("📤 送信するメッセージデータ:", messageData)

      // コールバック呼び出し
      if (this.messageCallback) {
        console.log("🚀 コールバック実行中...")
        this.messageCallback(messageData)
        console.log("✅ コールバック完了")
      } else {
        console.log("⚠️ messageCallbackが設定されていません")
      }
    } catch (error) {
      console.error("❌ メッセージ処理エラー:", error)
    }
  }

  // ユーザー情報を取得
  async getUserInfo(userId) {
    // キャッシュから取得
    if (this.userCache[userId]) {
      return this.userCache[userId]
    } else {
      return { name: "unknown" }
    }
  }

  // チャンネル一覧を取得（全ページを取得）
  async getChannelList() {
    try {
      let allChannels = []
      let cursor = undefined

      do {
        const result = await this.webClient.conversations.list({
          types: "public_channel,private_channel",
          exclude_archived: true,
          limit: 1000, // 最大取得数
          cursor: cursor,
        })

        allChannels = allChannels.concat(result.channels)
        cursor = result.response_metadata?.next_cursor

        console.log(`チャンネル取得中: ${allChannels.length}個`)
      } while (cursor)

      console.log(`全チャンネル取得完了: ${allChannels.length}個`)

      return allChannels
        .filter((channel) => !channel.is_archived) // 念のため再度フィルタ
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          isPrivate: channel.is_private,
          memberCount: channel.num_members || 0,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)) // アルファベット順でソート
    } catch (error) {
      console.error("チャンネル一覧取得エラー:", error)
      return []
    }
  }

  // 接続テスト
  async testConnection() {
    try {
      console.log("🔍 Slack接続テスト開始...")
      const result = await this.webClient.auth.test()
      console.log("✅ 接続テスト成功:", result)

      // アプリの権限も確認
      try {
        const authResponse = await this.webClient.auth.test()
        console.log("🔐 Bot権限情報:", {
          botId: authResponse.bot_id,
          userId: authResponse.user_id,
          teamId: authResponse.team_id,
          isBot: authResponse.is_bot,
        })
      } catch (authError) {
        console.warn("⚠️ 権限情報取得エラー:", authError)
      }

      return {
        success: true,
        teamName: result.team,
        botName: result.user,
        details: result,
      }
    } catch (error) {
      console.error("❌ 接続テストエラー:", {
        message: error.message,
        code: error.code,
        data: error.data,
      })
      return {
        success: false,
        error: error.message,
        code: error.code,
        data: error.data,
      }
    }
  }

  // 設定の取得
  getConfig() {
    return this.config
  }

  // 接続状態の取得
  getConnectionStatus() {
    return this.isConnected
  }

  async fetchAllUsers() {
    try {
      const result = await this.webClient.users.list()
      if (result.members && Array.isArray(result.members)) {
        result.members.forEach((user) => {
          this.userCache[user.id] = user.profile
        })
        console.log(`✅ ユーザー情報を一括取得: ${result.members.length}件`)
      } else {
        console.warn("⚠️ ユーザー情報が取得できませんでした")
      }
    } catch (error) {
      console.error("❌ ユーザー一覧取得エラー:", error)
    }
  }
}

module.exports = SlackWatcher
