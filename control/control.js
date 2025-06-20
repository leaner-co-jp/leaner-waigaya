const { ipcRenderer } = require("electron")

class SlackIntegration {
  constructor() {
    this.isConnected = false
    this.botToken = ""
    this.appToken = ""
    this.watchedChannels = [] // チャンネルIDの配列（後方互換性のため保持）
    this.watchedChannelData = {} // { channelId: { name: 'channel-name', id: 'channelId' } }
    this.availableChannels = []
    this.debugVisible = false
    this.usersLoaded = false // ユーザー一覧読み込み状態を追加
    this.channelsLoaded = false // チャンネル一覧読み込み状態を追加
    this.emojisLoaded = false // カスタム絵文字読み込み状態を追加

    this.setupSlackListeners()
    this.setupDebugLogging()
  }

  setupDebugLogging() {
    // コンソールログをUI上にも表示
    const originalLog = console.log
    const originalError = console.error

    console.log = (...args) => {
      originalLog.apply(console, args)
      this.addDebugLog("LOG", args.join(" "))
    }

    console.error = (...args) => {
      originalError.apply(console, args)
      this.addDebugLog("ERROR", args.join(" "))
    }
  }

  addDebugLog(level, message) {
    const debugLog = document.getElementById("debugLog")
    if (debugLog) {
      const timestamp = new Date().toLocaleTimeString()
      const logEntry = `[${timestamp}] ${level}: ${message}\n`
      debugLog.textContent += logEntry
      debugLog.scrollTop = debugLog.scrollHeight
    }
  }
  
  // カスタム絵文字を取得
  async loadCustomEmojis() {
    if (!this.isConnected) {
      this.updateEmojisStatus("先にSlackに接続してください", "error")
      return
    }

    try {
      this.updateEmojisStatus("カスタム絵文字を取得中...", "warning")
      const loadBtn = document.getElementById("loadEmojisBtn")
      if (loadBtn) {
        loadBtn.disabled = true
        loadBtn.textContent = "取得中..."
      }

      const emojiResult = await ipcRenderer.invoke("slack-get-custom-emojis")
      if (emojiResult.success) {
        this.emojisLoaded = true
        // カスタム絵文字をdisplay側に送信
        this.sendCustomEmojisToDisplay(emojiResult.emojis)
        this.updateEmojisStatus(
          `最新データ取得済み (${Object.keys(emojiResult.emojis).length}個)`,
          "connected"
        )
        console.log(`🎨 カスタム絵文字取得完了: ${Object.keys(emojiResult.emojis).length}個`)
      } else {
        this.updateEmojisStatus("取得失敗: " + (emojiResult.error || "不明なエラー"), "error")
      }

      if (loadBtn) {
        loadBtn.disabled = false
        loadBtn.textContent = "取得"
      }
    } catch (error) {
      console.error("カスタム絵文字取得エラー:", error)
      this.updateEmojisStatus("取得エラー: " + error.message, "error")

      const loadBtn = document.getElementById("loadEmojisBtn")
      if (loadBtn) {
        loadBtn.disabled = false
        loadBtn.textContent = "取得"
      }
    }
  }
  
  // ローカルデータを読み込み
  async loadLocalData() {
    try {
      // ユーザーデータをローカルから読み込み
      const usersResult = await ipcRenderer.invoke('set-local-users-data')
      if (usersResult.success) {
        this.usersLoaded = true
        console.log('📁 ローカルユーザーデータをSlackWatcherに設定しました')
      }
      
      // カスタム絵文字データをローカルから読み込み
      const emojisResult = await ipcRenderer.invoke('set-local-emojis-data')
      if (emojisResult.success && emojisResult.data) {
        this.emojisLoaded = true
        // ローカルデータをdisplay側に送信
        this.sendCustomEmojisToDisplay(emojisResult.data)
        console.log('📁 ローカルカスタム絵文字データをSlackWatcherに設定しました')
      }
    } catch (error) {
      console.error('ローカルデータ読み込みエラー:', error)
    }
  }
  
  // カスタム絵文字をdisplay側に送信
  sendCustomEmojisToDisplay(customEmojis) {
    try {
      ipcRenderer.send("send-custom-emojis-to-display", customEmojis)
    } catch (error) {
      console.error("カスタム絵文字送信エラー:", error)
    }
  }

  setupSlackListeners() {
    console.log("setupSlackListeners called")
    ipcRenderer.removeAllListeners("slack-message-received")
    ipcRenderer.on("slack-message-received", (event, messageData) => {
      console.log("slack-message-received", messageData)
      // 常に自動追加ON
      {
        // チャンネル名を削除し、ユーザー名とテキストのみを表示
        const displayData = {
          text: messageData.text,
          user: messageData.user,
          userIcon: messageData.userIcon,
        }
        console.log("✅ テキストキューに追加しようとしています:", displayData)

        // textQueueが存在するかチェック
        if (
          window.textQueue &&
          typeof window.textQueue.addSlackMessage === "function"
        ) {
          window.textQueue.addSlackMessage(displayData)
          console.log("✅ テキストキューに正常に追加されました")
        } else {
          console.error(
            "❌ textQueueが利用できません:",
            typeof window.textQueue
          )

          // 代替案: 直接DOMを操作してテキストエリアに追加
          const textarea = document.getElementById("newText")
          if (textarea) {
            textarea.value = `${displayData.user}: ${displayData.text}`
            console.log("🔄 代替案として入力フィールドに設定しました")
          }
        }
      }
    })
  }

  async loadSlackStatus() {
    try {
      const status = await ipcRenderer.invoke("slack-get-status")
      this.isConnected = status.connected
      this.watchedChannels = status.config.channels || []

      // 保存された設定を読み込み
      await this.loadSavedConfig()

      this.updateUI()
    } catch (error) {
      console.error("Slackステータス取得エラー:", error)
    }
  }

  async loadSavedConfig() {
    try {
      const result = await ipcRenderer.invoke("load-config")
      if (result.success && result.config) {
        const config = result.config
        console.log("📁 設定読み込み内容:", config)
        // 状態オブジェクトに復元
        this.botToken = config.botToken || ""
        this.appToken = config.appToken || ""
        if (config.channels && Array.isArray(config.channels)) {
          this.watchedChannels = [...config.channels]
          console.log("🔍 復元された監視チャンネル:", this.watchedChannels)
        }
        if (
          config.watchedChannelData &&
          typeof config.watchedChannelData === "object"
        ) {
          this.watchedChannelData = { ...config.watchedChannelData }
          this.watchedChannels = Object.keys(this.watchedChannelData)
          console.log(
            "🔍 復元された監視チャンネルデータ:",
            this.watchedChannelData
          )
        }
        console.log("📁 保存された設定を復元しました")
        // トークンが両方揃っていれば自動接続
        if (this.botToken && this.appToken) {
          console.log("🚀 保存されたトークンで自動接続を開始します")
          this.updateStatus("保存された設定で自動接続中...", "warning")
          try {
            await this.connect()
          } catch (error) {
            console.error("自動接続エラー:", error)
            this.updateStatus("自動接続に失敗しました", "error")
          }
        }
      }
    } catch (error) {
      console.error("設定読み込みエラー:", error)
    }
  }

  async saveConfig() {
    try {
      const config = {
        botToken: this.botToken,
        appToken: this.appToken,
        channels: this.watchedChannels, // 後方互換性のため保持
        watchedChannelData: this.watchedChannelData, // チャンネル名付きデータ
      }
      const result = await ipcRenderer.invoke("save-config", config)
      if (result.success) {
        console.log("📁 設定を保存しました")
      } else {
        console.error("設定保存エラー:", result.error)
      }
    } catch (error) {
      console.error("設定保存エラー:", error)
    }
  }

  async connect(dialogRoot = document) {
    this.updateStateFromUI(dialogRoot)
    const botToken = this.botToken
    const appToken = this.appToken
    if (!botToken || !appToken) {
      this.updateStatus("Bot TokenとApp Tokenを入力してください", "error")
      return
    }
    if (!botToken.startsWith("xoxb-")) {
      this.updateStatus("Bot Tokenは xoxb- で始まる必要があります", "error")
      return
    }
    if (!appToken.startsWith("xapp-")) {
      this.updateStatus("App Tokenは xapp- で始まる必要があります", "error")
      return
    }
    this.updateStatus("接続テスト中...", "")
    try {
      const testResult = await ipcRenderer.invoke("slack-test-connection", {
        botToken,
        appToken,
      })
      if (!testResult.success) {
        let errorMsg = `接続テストエラー: ${testResult.error}`
        if (testResult.code === "slack_webapi_platform_error") {
          if (testResult.data?.error === "invalid_auth") {
            errorMsg =
              "トークンが無効です。正しいBot TokenとApp Tokenを確認してください"
          } else if (testResult.data?.error === "missing_scope") {
            errorMsg = `権限不足: ${testResult.data.needed} が必要です`
          }
        }
        this.updateStatus(errorMsg, "error")
        return
      }
      this.updateStatus("Socket Mode接続中...", "")
      const result = await ipcRenderer.invoke("slack-connect", {
        botToken,
        appToken,
        channels: this.watchedChannels,
      })
      if (result.success) {
        this.isConnected = true
        this.updateStatus("接続済み", "connected")
        
        // ローカルデータを読み込んで初期化
        await this.loadLocalData()
        
        // ユーザー一覧の状態を更新
        if (!this.usersLoaded) {
          this.updateUsersStatus("未取得 - リロードしてください", "warning")
        } else {
          this.updateUsersStatus("キャッシュあり", "connected")
        }
        
        // カスタム絵文字の初期状態を設定
        if (!this.emojisLoaded) {
          this.updateEmojisStatus("未取得 - 取得ボタンを押してください", "warning")
        } else {
          this.updateEmojisStatus("キャッシュあり", "connected")
        }
        
        // チャンネル監視状態を更新
        if (this.watchedChannels.length > 0) {
          this.updateChannelsStatus(`${this.watchedChannels.length}チャンネル監視中`, "connected")
          console.log("✅ 接続成功 - 監視開始:", this.watchedChannels)
        } else {
          this.updateChannelsStatus("0チャンネル監視中", "warning")
          console.log("✅ 接続成功 - 監視チャンネルなし")
        }
        
        await this.updateUI()
        await this.saveConfig()
      } else {
        this.updateStatus(`接続エラー: ${result.error}`, "error")
      }
    } catch (error) {
      console.error("接続エラー詳細:", error)
      this.updateStatus(`接続エラー: ${error.message}`, "error")
    }
  }

  async disconnect() {
    try {
      await ipcRenderer.invoke("slack-disconnect")
      this.isConnected = false
      this.usersLoaded = false
      this.channelsLoaded = false
      this.emojisLoaded = false
      this.watchedChannels = []
      this.availableChannels = [] // チャンネル一覧もクリア
      this.watchedChannelData = {} // チャンネルデータもクリア
      this.updateStatus("切断しました", "")
      this.updateUsersStatus("未取得", "")
      this.updateEmojisStatus("未取得", "")
      this.updateChannelsStatus("0チャンネル監視中", "")
      await this.updateUI()
    } catch (error) {
      this.updateStatus(`切断エラー: ${error.message}`, "error")
    }
  }

  async loadChannels() {
    if (!this.isConnected) {
      this.updateStatus("先にSlackに接続してください", "error")
      return
    }

    try {
      this.updateStatus("チャンネル一覧を取得中...", "connected")
      const loadBtn = document.getElementById("loadChannelsBtn")
      loadBtn.disabled = true
      loadBtn.textContent = "取得中..."

      this.availableChannels = await ipcRenderer.invoke("slack-get-channels")
      this.channelsLoaded = true
      this.updateChannelSelect()
      this.updateStatus(
        `チャンネル一覧取得完了 (${this.availableChannels.length}チャンネル)`,
        "connected"
      )

      loadBtn.disabled = false
      loadBtn.textContent = "チャンネル一覧取得"
    } catch (error) {
      console.error("チャンネル取得エラー:", error)
      this.updateStatus("チャンネル取得エラー", "error")
      this.channelsLoaded = false

      const loadBtn = document.getElementById("loadChannelsBtn")
      loadBtn.disabled = false
      loadBtn.textContent = "チャンネル一覧取得"
    }
  }

  updateChannelSelect(filteredChannels = null, dialogRoot = document) {
    const select = dialogRoot.getElementById
      ? dialogRoot.getElementById("channelSelect")
      : dialogRoot.querySelector("#channelSelect")
    if (!select) return
    const searchInput = dialogRoot.getElementById
      ? dialogRoot.getElementById("channelSearch")
      : dialogRoot.querySelector("#channelSearch")
    const loadBtn = dialogRoot.getElementById
      ? dialogRoot.getElementById("loadChannelsBtn")
      : dialogRoot.querySelector("#loadChannelsBtn")
    const addBtn = dialogRoot.getElementById
      ? dialogRoot.getElementById("addChannelBtn")
      : dialogRoot.querySelector("#addChannelBtn")
      
    select.innerHTML = ""
    const channelsToShow = filteredChannels || this.availableChannels
    if (channelsToShow.length === 0) {
      const option = document.createElement("option")
      option.value = ""
      if (!this.isConnected) {
        option.textContent = "まずSlackに接続してください"
      } else if (this.availableChannels.length === 0) {
        option.textContent = "先にチャンネル一覧を取得してください"
      } else {
        option.textContent = filteredChannels
          ? "検索結果なし"
          : "チャンネルがありません"
      }
      select.appendChild(option)
    } else {
      channelsToShow.forEach((channel) => {
        const option = document.createElement("option")
        option.value = channel.id
        option.textContent = `#${channel.name}${
          channel.isPrivate ? " (プライベート)" : ""
        } (${channel.memberCount}人)`
        select.appendChild(option)
      })
    }
    
    // ボタンの有効/無効化
    const hasChannels = this.isConnected && this.availableChannels.length > 0
    if (select)
      select.disabled = !hasChannels
    if (searchInput)
      searchInput.disabled = !hasChannels
    if (loadBtn) loadBtn.disabled = !this.isConnected
    if (addBtn) addBtn.disabled = !hasChannels
  }

  setupChannelSearch() {
    const searchInput = document.getElementById("channelSearch")
    if (!searchInput) return
    searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase()
      if (searchTerm === "") {
        this.updateChannelSelect()
      } else {
        const filteredChannels = this.availableChannels.filter((channel) =>
          channel.name.toLowerCase().includes(searchTerm)
        )
        this.updateChannelSelect(filteredChannels)
      }
    })
  }

  async addChannel(dialogRoot = document) {
    // ダイアログコンテキスト対応の要素取得
    const select = dialogRoot.querySelector ? dialogRoot.querySelector("#channelSelect") : document.getElementById("channelSelect")
    
    if (!select) {
      console.error("channelSelect要素が見つかりません")
      alert("チャンネル選択ボックスが見つかりません")
      return
    }
    
    const channelId = select.value
    console.log("選択されたチャンネルID:", channelId)

    if (!channelId) {
      alert("チャンネルを選択してください")
      return
    }

    if (this.watchedChannels.includes(channelId)) {
      alert("既に監視中のチャンネルです")
      return
    }

    // チャンネル名を取得
    const channel = this.availableChannels.find((ch) => ch.id === channelId)
    const channelName = channel ? channel.name : channelId

    this.watchedChannels.push(channelId)
    this.watchedChannelData[channelId] = {
      id: channelId,
      name: channelName,
    }

    ipcRenderer.send("slack-add-channel", channelId)
    
    // チャンネル監視状態を更新
    this.updateChannelsStatus(`${this.watchedChannels.length}チャンネル監視中`, "connected")
    
    console.log(`✅ チャンネル追加完了: #${channelName} (${channelId})`)
    
    await this.updateUI()
    // チャンネル追加時に設定を保存
    await this.saveConfig()
    
    // 選択をクリア
    select.value = ""
  }

  async removeChannel(channelId) {
    this.watchedChannels = this.watchedChannels.filter((id) => id !== channelId)
    delete this.watchedChannelData[channelId] // チャンネルデータも削除
    ipcRenderer.send("slack-remove-channel", channelId)
    
    // チャンネル監視状態を更新
    if (this.watchedChannels.length > 0) {
      this.updateChannelsStatus(`${this.watchedChannels.length}チャンネル監視中`, "connected")
    } else {
      this.updateChannelsStatus("0チャンネル監視中", "warning")
    }
    
    await this.updateUI()
    // チャンネル削除時に設定を保存
    await this.saveConfig()
  }

  async updateUI(dialogRoot = document) {
    this.updateChannelSelect(undefined, dialogRoot)
    
    // 接続状態の初期化
    if (!this.isConnected) {
      this.updateStatus("未接続", "")
      this.updateUsersStatus("未取得", "")
      this.updateEmojisStatus("未取得", "")
      this.updateChannelsStatus("0チャンネル監視中", "")
    }
    
    // 監視中チャンネル数の表示を更新
    const channelCountEl = dialogRoot.getElementById
      ? dialogRoot.getElementById("channelCount")
      : dialogRoot.querySelector("#channelCount")
    if (channelCountEl) {
      channelCountEl.textContent = this.watchedChannels.length
    }
    
    // チャンネル監視状態の更新
    if (this.isConnected) {
      if (this.watchedChannels.length > 0) {
        this.updateChannelsStatus(`${this.watchedChannels.length}チャンネル監視中`, "connected")
      } else {
        this.updateChannelsStatus("0チャンネル監視中", "warning")
      }
    }
    
    // 監視中チャンネル名リストの表示を更新
    const channelListEl = dialogRoot.getElementById
      ? dialogRoot.getElementById("watchedChannelList")
      : dialogRoot.querySelector("#watchedChannelList")
    if (channelListEl) {
      if (this.watchedChannels.length === 0) {
        channelListEl.innerHTML =
          '<div class="text-xs text-gray-500">（監視チャンネルなし）</div>'
      } else {
        channelListEl.innerHTML = this.watchedChannels
          .map((id) => {
            const name =
              this.watchedChannelData &&
              this.watchedChannelData[id] &&
              this.watchedChannelData[id].name
                ? this.watchedChannelData[id].name
                : id
            return `
              <div class="flex items-center justify-between mb-1">
                <span class="channel-item active flex-1">#${name}</span>
                <button 
                  onclick="window.slackIntegration.removeChannel('${id}')"
                  class="text-red-500 hover:text-red-700 text-xs ml-2 px-1"
                  title="監視を停止"
                >
                  ×
                </button>
              </div>
            `
          })
          .join("")
      }
    }
    
    // ユーザーリロードボタンの状態更新
    const reloadUsersBtn = dialogRoot.getElementById
      ? dialogRoot.getElementById("reloadUsersBtn")
      : dialogRoot.querySelector("#reloadUsersBtn")
    if (reloadUsersBtn) {
      reloadUsersBtn.disabled = !this.isConnected
    }
    
    // カスタム絵文字取得ボタンの状態更新
    const loadEmojisBtn = dialogRoot.getElementById
      ? dialogRoot.getElementById("loadEmojisBtn")
      : dialogRoot.querySelector("#loadEmojisBtn")
    if (loadEmojisBtn) {
      loadEmojisBtn.disabled = !this.isConnected
    }
    
    // チャンネル管理ボタンの状態更新
    const manageChannelsBtn = dialogRoot.getElementById
      ? dialogRoot.getElementById("manageChannelsBtn")
      : dialogRoot.querySelector("#manageChannelsBtn")
    if (manageChannelsBtn) {
      manageChannelsBtn.disabled = !this.isConnected
    }
    
    // トークン欄も反映
    this.reflectStateToUI(dialogRoot)
  }

  /**
   * Slack状態表示を更新する（新しいUI要素に対応）
   * @param {string} message - 表示するメッセージ
   * @param {string} status - 状態クラス（"connected" | "error" | "warning" | ""）
   */
  updateStatus(message, status = "") {
    const statusEl = document.getElementById("slackStatus")
    const iconEl = document.getElementById("slackConnectionIcon")
    const sectionEl = statusEl?.closest('.status-section')
    
    if (statusEl) {
      statusEl.textContent = message
    }
    
    if (sectionEl) {
      sectionEl.classList.remove("connected", "error", "warning")
      if (status) {
        sectionEl.classList.add(status)
      }
    }
    
    if (iconEl) {
      if (status === "connected") {
        iconEl.textContent = "🟢"
      } else if (status === "error") {
        iconEl.textContent = "🔴"
      } else if (status === "warning") {
        iconEl.textContent = "🟡"
      } else {
        iconEl.textContent = "⚪"
      }
    }
  }
  
  /**
   * ユーザー一覧の状態を更新する
   * @param {string} message - 表示するメッセージ
   * @param {string} status - 状態クラス（"connected" | "error" | "warning" | ""）
   */
  updateUsersStatus(message, status = "") {
    const statusEl = document.getElementById("usersStatus")
    const iconEl = document.getElementById("usersStatusIcon")
    const sectionEl = statusEl?.closest('.status-section')
    
    if (statusEl) {
      statusEl.textContent = message
    }
    
    if (sectionEl) {
      sectionEl.classList.remove("connected", "error", "warning")
      if (status) {
        sectionEl.classList.add(status)
      }
    }
    
    if (iconEl) {
      if (status === "connected") {
        iconEl.textContent = "🟢"
      } else if (status === "error") {
        iconEl.textContent = "🔴"
      } else if (status === "warning") {
        iconEl.textContent = "🟡"
      } else {
        iconEl.textContent = "⚪"
      }
    }
  }
  
  /**
   * チャンネル監視の状態を更新する
   * @param {string} message - 表示するメッセージ
   * @param {string} status - 状態クラス（"connected" | "error" | "warning" | ""）
   */
  updateChannelsStatus(message, status = "") {
    const statusEl = document.getElementById("channelsStatus")
    const iconEl = document.getElementById("channelsStatusIcon")
    const sectionEl = statusEl?.closest('.status-section')
    
    if (sectionEl) {
      sectionEl.classList.remove("connected", "error", "warning")
      if (status) {
        sectionEl.classList.add(status)
      }
    }
    
    if (iconEl) {
      if (status === "connected") {
        iconEl.textContent = "🟢"
      } else if (status === "error") {
        iconEl.textContent = "🔴"
      } else if (status === "warning") {
        iconEl.textContent = "🟡"
      } else {
        iconEl.textContent = "⚪"
      }
    }
  }
  
  /**
   * カスタム絵文字の状態を更新する
   * @param {string} message - 表示するメッセージ
   * @param {string} status - 状態クラス（"connected" | "error" | "warning" | ""）
   */
  updateEmojisStatus(message, status = "") {
    const statusEl = document.getElementById("emojisStatus")
    const iconEl = document.getElementById("emojisStatusIcon")
    const sectionEl = statusEl?.closest('.status-section')
    
    if (statusEl) {
      statusEl.textContent = message
    }
    
    if (sectionEl) {
      sectionEl.classList.remove("connected", "error", "warning")
      if (status) {
        sectionEl.classList.add(status)
      }
    }
    
    if (iconEl) {
      if (status === "connected") {
        iconEl.textContent = "🟢"
      } else if (status === "error") {
        iconEl.textContent = "🔴"
      } else if (status === "warning") {
        iconEl.textContent = "🟡"
      } else {
        iconEl.textContent = "⚪"
      }
    }
  }

  // UIから状態へ: ダイアログ内のinputから状態を更新
  updateStateFromUI(dialogRoot = document) {
    const botTokenInput = dialogRoot.getElementById
      ? dialogRoot.getElementById("botToken")
      : dialogRoot.querySelector("#botToken")
    const appTokenInput = dialogRoot.getElementById
      ? dialogRoot.getElementById("appToken")
      : dialogRoot.querySelector("#appToken")
    if (botTokenInput) this.botToken = botTokenInput.value
    if (appTokenInput) this.appToken = appTokenInput.value
  }

  // UI反映用: ダイアログ内のinputに状態を反映
  reflectStateToUI(dialogRoot = document) {
    const botTokenInput = dialogRoot.getElementById
      ? dialogRoot.getElementById("botToken")
      : dialogRoot.querySelector("#botToken")
    const appTokenInput = dialogRoot.getElementById
      ? dialogRoot.getElementById("appToken")
      : dialogRoot.querySelector("#appToken")
    if (botTokenInput) botTokenInput.value = this.botToken
    if (appTokenInput) appTokenInput.value = this.appToken
  }
}

class TextQueue {
  constructor() {
    this.queue = []
    this.currentIndex = -1
    this.currentTimer = null
    this.displayTime = 3000 // ms
    this.fadeTime = 500 // ms
    // 表示設定の初期値
    this.fontSize = 26
    this.bgColor = "#000000"
    this.bgAlpha = 0.5
    this.fontColor = "#ffffff"
    this.loadDisplaySettings()
    this.updateUI()
  }

  // 表示設定をlocalStorageから復元
  loadDisplaySettings() {
    const saved = localStorage.getItem("waigayaDisplaySettings")
    if (saved) {
      try {
        const obj = JSON.parse(saved)
        if (obj.fontSize) this.fontSize = obj.fontSize
        if (obj.bgColor) this.bgColor = obj.bgColor
        if (typeof obj.bgAlpha === "number") this.bgAlpha = obj.bgAlpha
        if (obj.fontColor) this.fontColor = obj.fontColor
      } catch (e) {}
    }
    // UIに反映
    const fontSizeInput = document.getElementById("fontSize")
    if (fontSizeInput) fontSizeInput.value = this.fontSize
    const bgColorInput = document.getElementById("bgColor")
    if (bgColorInput) bgColorInput.value = this.bgColor
    const bgAlphaInput = document.getElementById("bgAlpha")
    if (bgAlphaInput) bgAlphaInput.value = this.bgAlpha
    const bgAlphaValue = document.getElementById("bgAlphaValue")
    if (bgAlphaValue) bgAlphaValue.textContent = Number(this.bgAlpha).toFixed(2)
    const fontColorInput = document.getElementById("fontColor")
    if (fontColorInput) fontColorInput.value = this.fontColor
  }

  // 表示設定をlocalStorageに保存
  saveDisplaySettings() {
    const obj = {
      fontSize: Number(document.getElementById("fontSize").value),
      bgColor: document.getElementById("bgColor").value,
      bgAlpha: Number(document.getElementById("bgAlpha").value),
      fontColor: document.getElementById("fontColor").value,
    }
    localStorage.setItem("waigayaDisplaySettings", JSON.stringify(obj))
  }

  addSlackMessage(messageData) {
    if (messageData.text && messageData.text.trim()) {
      this.queue.push({
        id: Date.now(),
        text: messageData.text.trim(),
        user: messageData.user,
        userIcon: messageData.userIcon,
        timestamp: new Date().toLocaleTimeString(),
        type: "slack",
      })
      this.updateUI()
      if (this.currentTimer) {
        clearTimeout(this.currentTimer)
        this.currentTimer = null
      }
      this.currentIndex = this.queue.length - 1
      this.playNext()
    }
  }

  startQueue() {
    if (this.queue.length === 0) {
      return
    }
    if (this.currentIndex === -1) {
      this.currentIndex = 0
    }
    this.playNext()
  }

  playNext() {
    if (this.currentIndex >= this.queue.length) {
      // 末尾まで再生したら何もしない
      return
    }
    const currentItem = this.queue[this.currentIndex]
    if (currentItem.type === "slack") {
      this.sendToDisplay(currentItem.text, {
        user: currentItem.user,
        userIcon: currentItem.userIcon,
        type: "slack",
      })
    } else {
      this.sendToDisplay(currentItem.text)
    }
    this.updateUI()
    this.currentTimer = setTimeout(() => {
      this.currentIndex++
      this.playNext()
    }, this.displayTime + this.fadeTime)
  }

  updateSettings() {
    const displayTimeInput = document.getElementById("displayTime")
    const fadeTimeInput = document.getElementById("fadeTime")
    this.displayTime = parseFloat(displayTimeInput.value) * 1000
    this.fadeTime = parseFloat(fadeTimeInput.value) * 1000
  }

  sendToDisplay(text, metadata = null) {
    try {
      if (metadata) {
        ipcRenderer.send("display-slack-message", { text, metadata })
      } else {
        ipcRenderer.send("display-text", text)
      }
    } catch (error) {
      console.log("IPC error:", error)
    }
  }

  updateUI() {
    const queueList = document.getElementById("queueList")
    if (this.queue.length === 0) {
      queueList.innerHTML = "キューは空です"
    } else {
      queueList.innerHTML = this.queue
        .map(
          (item, index) => `
        <div class="queue-item">
          <div>
            <strong>${index + 1}.</strong> ${item.text}
            <small style="color: #666; margin-left: 10px;">(${
              item.timestamp
            })</small>
          </div>
        </div>
      `
        )
        .join("")
    }
  }
}

// グローバルインスタンス
let textQueue
let slackIntegration

// ページ読み込み完了後にイベントリスナーを設定
document.addEventListener("DOMContentLoaded", () => {
  // グローバルインスタンスを初期化
  console.log("🚀 DOMContentLoaded: グローバルインスタンスを初期化中...")
  textQueue = new TextQueue()
  slackIntegration = new SlackIntegration()

  // windowオブジェクトにも登録してアクセスを確実にする
  window.textQueue = textQueue
  window.slackIntegration = slackIntegration

  console.log("✅ グローバルインスタンス初期化完了:", {
    textQueue,
    slackIntegration,
  })

  // DOM構築後にSlack設定をロード（自動接続もここで）
  slackIntegration.loadSlackStatus()

  // Slackボタンのイベントリスナー設定
  const connectBtn = document.getElementById("connectSlackBtn")
  if (connectBtn) {
    connectBtn.onclick = async () => {
      await slackIntegration.connect()
    }
  }

  const addChannelBtn = document.getElementById("addChannelBtn")
  if (addChannelBtn) {
    addChannelBtn.onclick = async () => {
      await slackIntegration.addChannel()
    }
  }

  const loadChannelsBtn = document.getElementById("loadChannelsBtn")
  if (loadChannelsBtn) {
    loadChannelsBtn.onclick = async () => {
      await slackIntegration.loadChannels()
    }
  }

  const clearConfigBtn = document.getElementById("clearConfigBtn")
  if (clearConfigBtn) {
    clearConfigBtn.onclick = async () => {
      if (confirm("保存された設定をすべてクリアしますか？")) {
        try {
          const result = await ipcRenderer.invoke("save-config", {
            botToken: "",
            appToken: "",
            channels: [],
            watchedChannelData: {},
          })

          if (result.success) {
            // UIをクリア
            document.getElementById("botToken").value = ""
            document.getElementById("appToken").value = ""
            slackIntegration.watchedChannels = []
            slackIntegration.watchedChannelData = {}
            await slackIntegration.updateUI()

            alert("設定をクリアしました")
          }
        } catch (error) {
          console.error("設定クリアエラー:", error)
          alert("設定のクリアに失敗しました")
        }
      }
    }
  }

  // サンプルメッセージ追加ボタン
  const addSampleMsgBtn = document.getElementById("addSampleMsgBtn")
  if (addSampleMsgBtn) {
    addSampleMsgBtn.onclick = () => {
      addSampleMessage()
    }
  }

  // 表示設定のイベントリスナー
  const fontSizeInput = document.getElementById("fontSize")
  const bgColorInput = document.getElementById("bgColor")
  const bgAlphaInput = document.getElementById("bgAlpha")
  const bgAlphaValue = document.getElementById("bgAlphaValue")
  const fontColorInput = document.getElementById("fontColor")
  function saveSettingsAndUpdateAlpha() {
    if (window.textQueue) window.textQueue.saveDisplaySettings()
    if (bgAlphaInput && bgAlphaValue)
      bgAlphaValue.textContent = Number(bgAlphaInput.value).toFixed(2)
  }
  if (fontSizeInput)
    fontSizeInput.addEventListener("input", saveSettingsAndUpdateAlpha)
  if (bgColorInput)
    bgColorInput.addEventListener("input", saveSettingsAndUpdateAlpha)
  if (bgAlphaInput)
    bgAlphaInput.addEventListener("input", saveSettingsAndUpdateAlpha)
  if (fontColorInput)
    fontColorInput.addEventListener("input", saveSettingsAndUpdateAlpha)

  const reloadUsersBtn = document.getElementById("reloadUsersBtn")
  if (reloadUsersBtn) {
    reloadUsersBtn.onclick = async () => {
      reloadUsersBtn.disabled = true
      reloadUsersBtn.textContent = "リロード中..."
      slackIntegration.updateUsersStatus("ユーザー一覧をリロード中...", "warning")
      
      try {
        const result = await ipcRenderer.invoke("slack-reload-users")
        if (result.success) {
          slackIntegration.usersLoaded = true
          slackIntegration.updateUsersStatus("最新データ取得済み", "connected")
          console.log("ユーザー一覧をリロードしました")
        } else {
          slackIntegration.updateUsersStatus("リロード失敗: " + (result.error || "不明なエラー"), "error")
        }
      } catch (e) {
        slackIntegration.updateUsersStatus("リロードエラー: " + e.message, "error")
      }
      
      reloadUsersBtn.disabled = false
      reloadUsersBtn.textContent = "リロード"
    }
  }
  
  const loadEmojisBtn = document.getElementById("loadEmojisBtn")
  if (loadEmojisBtn) {
    loadEmojisBtn.onclick = async () => {
      await slackIntegration.loadCustomEmojis()
    }
  }
})

// デバッグ用UI関数
function toggleDebug() {
  const debugInfo = document.getElementById("debugInfo")
  debugInfo.style.display =
    debugInfo.style.display === "none" ? "block" : "none"
}

function clearDebugLog() {
  const debugLog = document.getElementById("debugLog")
  if (debugLog) {
    debugLog.textContent = ""
  }
}

// セットアップ用の関数
function toggleSetupGuide() {
  const guideElement = document.querySelector(".usage-guide")
  if (guideElement.style.display === "none") {
    guideElement.style.display = "block"
  } else {
    guideElement.style.display = "none"
  }
}

function scrollToTokenInput() {
  const tokenInput = document.getElementById("botToken")
  tokenInput.scrollIntoView({ behavior: "smooth" })
  tokenInput.focus()
}

// Slack接続設定ダイアログを表示
function showSlackConnection() {
  // 既存ダイアログがあれば削除
  const oldDialog = document.getElementById("slackConnectionDialog")
  if (oldDialog) oldDialog.remove()

  // テンプレートからダイアログ生成
  const tmpl = document.getElementById("slackConnectionDialogTemplate")
  if (!tmpl) return
  const dialog = document.createElement("div")
  dialog.id = "slackConnectionDialog"
  dialog.style.position = "fixed"
  dialog.style.top = "0"
  dialog.style.left = "0"
  dialog.style.width = "100vw"
  dialog.style.height = "100vh"
  dialog.style.background = "rgba(0,0,0,0.4)"
  dialog.style.zIndex = "9999"
  dialog.style.display = "flex"
  dialog.style.alignItems = "center"
  dialog.style.justifyContent = "center"

  // テンプレート内容をクローン
  const inner = tmpl.content.cloneNode(true)
  // ダイアログ本体にスタイルを追加
  const innerRoot = inner.querySelector(".slack-dialog-inner")
  if (innerRoot) {
    innerRoot.style.background = "#fff"
    innerRoot.style.borderRadius = "16px"
    innerRoot.style.boxShadow = "0 4px 32px rgba(0,0,0,0.25)"
    innerRoot.style.padding = "32px"
    innerRoot.style.maxWidth = "480px"
    innerRoot.style.width = "100%"
    innerRoot.style.boxSizing = "border-box"
  }
  dialog.appendChild(inner)
  document.body.appendChild(dialog)

  // 閉じるボタン
  const closeBtn = dialog.querySelector(".close-dialog-btn")
  if (closeBtn) closeBtn.onclick = () => dialog.remove()

  // UIの初期化
  if (window.slackIntegration) {
    window.slackIntegration.reflectStateToUI(dialog)
  }
  
  // イベントリスナー設定
  const connectBtn = dialog.querySelector("#connectSlackBtn")
  if (connectBtn)
    connectBtn.onclick = async () => {
      await window.slackIntegration.connect(dialog)
    }
  
  const clearConfigBtn = dialog.querySelector("#clearConfigBtn")
  if (clearConfigBtn)
    clearConfigBtn.onclick = async () => {
      if (confirm("保存された設定をすべてクリアしますか？")) {
        try {
          const result = await ipcRenderer.invoke("save-config", {
            botToken: "",
            appToken: "",
            channels: [],
            watchedChannelData: {},
          })
          if (result.success) {
            window.slackIntegration.botToken = ""
            window.slackIntegration.appToken = ""
            window.slackIntegration.watchedChannels = []
            window.slackIntegration.watchedChannelData = {}
            await window.slackIntegration.updateUI()
            window.slackIntegration.reflectStateToUI(dialog)
            alert("設定をクリアしました")
          }
        } catch (error) {
          console.error("設定クリアエラー:", error)
          alert("設定のクリアに失敗しました")
        }
      }
    }
}

// チャンネル管理ダイアログを表示
function showChannelManagement() {
  // Slack接続状態をチェック
  if (!window.slackIntegration?.isConnected) {
    alert("先にSlackに接続してください")
    return
  }

  // 既存ダイアログがあれば削除
  const oldDialog = document.getElementById("channelManagementDialog")
  if (oldDialog) oldDialog.remove()

  // テンプレートからダイアログ生成
  const tmpl = document.getElementById("channelManagementDialogTemplate")
  if (!tmpl) return
  const dialog = document.createElement("div")
  dialog.id = "channelManagementDialog"
  dialog.style.position = "fixed"
  dialog.style.top = "0"
  dialog.style.left = "0"
  dialog.style.width = "100vw"
  dialog.style.height = "100vh"
  dialog.style.background = "rgba(0,0,0,0.4)"
  dialog.style.zIndex = "9999"
  dialog.style.display = "flex"
  dialog.style.alignItems = "center"
  dialog.style.justifyContent = "center"

  // テンプレート内容をクローン
  const inner = tmpl.content.cloneNode(true)
  // ダイアログ本体にスタイルを追加
  const innerRoot = inner.querySelector(".slack-dialog-inner")
  if (innerRoot) {
    innerRoot.style.background = "#fff"
    innerRoot.style.borderRadius = "16px"
    innerRoot.style.boxShadow = "0 4px 32px rgba(0,0,0,0.25)"
    innerRoot.style.padding = "32px"
    innerRoot.style.maxWidth = "600px"
    innerRoot.style.width = "100%"
    innerRoot.style.boxSizing = "border-box"
  }
  dialog.appendChild(inner)
  document.body.appendChild(dialog)

  // 閉じるボタン
  const closeBtn = dialog.querySelector(".close-dialog-btn")
  if (closeBtn) closeBtn.onclick = () => dialog.remove()

  // UIの初期化
  if (window.slackIntegration) {
    window.slackIntegration.updateUI(dialog)
    window.slackIntegration.setupChannelSearch()
    updateCurrentWatchedChannels(dialog)
  }
  
  // イベントリスナー設定
  const addChannelBtn = dialog.querySelector("#addChannelBtn")
  const channelSelect = dialog.querySelector("#channelSelect")
  
  if (addChannelBtn) {
    console.log("チャンネル追加ボタンのイベントリスナーを設定しました")
    addChannelBtn.onclick = async () => {
      console.log("チャンネル追加ボタンがクリックされました")
      await window.slackIntegration.addChannel(dialog)
      updateCurrentWatchedChannels(dialog)
    }
  } else {
    console.error("チャンネル追加ボタンが見つかりません")
  }
  
  // チャンネル選択時のボタン有効化
  if (channelSelect && addChannelBtn) {
    channelSelect.addEventListener('change', () => {
      const hasSelection = channelSelect.value && channelSelect.value !== ""
      addChannelBtn.disabled = !hasSelection
      console.log("チャンネル選択変更:", channelSelect.value, "ボタン有効:", hasSelection)
    })
  }
  
  const loadChannelsBtn = dialog.querySelector("#loadChannelsBtn")
  if (loadChannelsBtn)
    loadChannelsBtn.onclick = async () => {
      await window.slackIntegration.loadChannels()
      // チャンネル読み込み後にボタン状態を更新
      window.slackIntegration.updateChannelSelect(null, dialog)
    }
}

// 監視中チャンネルの表示を更新
function updateCurrentWatchedChannels(dialogRoot = document) {
  const container = dialogRoot.querySelector("#currentWatchedChannels")
  if (!container || !window.slackIntegration) return
  
  if (window.slackIntegration.watchedChannels.length === 0) {
    container.innerHTML = '<span class="text-gray-500">監視中のチャンネルはありません</span>'
  } else {
    container.innerHTML = window.slackIntegration.watchedChannels
      .map((id) => {
        const name =
          window.slackIntegration.watchedChannelData &&
          window.slackIntegration.watchedChannelData[id] &&
          window.slackIntegration.watchedChannelData[id].name
            ? window.slackIntegration.watchedChannelData[id].name
            : id
        return `
          <div class="flex items-center justify-between mb-2 p-2 bg-green-50 border border-green-200 rounded">
            <span class="font-medium">#${name}</span>
            <button 
              onclick="window.slackIntegration.removeChannel('${id}'); updateCurrentWatchedChannels(document.getElementById('channelManagementDialog'))"
              class="text-red-500 hover:text-red-700 text-sm px-2 py-1 hover:bg-red-50 rounded"
              title="監視を停止"
            >
              × 削除
            </button>
          </div>
        `
      })
      .join("")
  }
}

window.showSlackConnection = showSlackConnection
window.showChannelManagement = showChannelManagement
window.updateCurrentWatchedChannels = updateCurrentWatchedChannels
window.toggleDebug = toggleDebug
window.clearDebugLog = clearDebugLog
window.toggleSetupGuide = toggleSetupGuide
window.scrollToTokenInput = scrollToTokenInput

// 使用されていない関数を削除しました

// サンプルメッセージを追加する関数
function addSampleMessage() {
  // ランダムなユーザー名とメッセージ
  const users = [
    { name: "Taro", icon: "https://randomuser.me/api/portraits/men/1.jpg" },
    { name: "Hanako", icon: "https://randomuser.me/api/portraits/women/2.jpg" },
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
  // Slack風のデータで追加
  window.textQueue.addSlackMessage({
    text,
    user: user.name,
    userIcon: user.icon,
  })
}
