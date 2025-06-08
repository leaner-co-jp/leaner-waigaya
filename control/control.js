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

  setupSlackListeners() {
    // Slackメッセージ受信リスナー
    ipcRenderer.on("slack-message-received", (event, messageData) => {
      console.log("📨 コントロール画面でSlackメッセージ受信:", messageData)
      console.log("🔄 textQueueオブジェクト:", typeof textQueue, textQueue)

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

          // Slackメッセージは自動再生開始
          if (!window.textQueue.isPlaying) {
            console.log("🚀 Slackメッセージで自動再生を開始")
            window.textQueue.startQueue()
          }
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
          this.updateStatus("保存された設定で自動接続中...", "")
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
        if (this.watchedChannels.length > 0) {
          this.updateStatus(`接続成功`, "connected")
          console.log("✅ 接続成功 - 監視開始:", this.watchedChannels)
        } else {
          this.updateStatus(
            "接続成功 - チャンネル一覧を取得してください",
            "connected"
          )
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
      this.watchedChannels = []
      this.availableChannels = [] // チャンネル一覧もクリア
      this.watchedChannelData = {} // チャンネルデータもクリア
      this.updateStatus("切断しました", "")
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
    select.innerHTML = ""
    const channelsToShow = filteredChannels || this.availableChannels
    if (channelsToShow.length === 0) {
      const option = document.createElement("option")
      option.value = ""
      if (!this.isConnected) {
        option.textContent = "まずSlackに接続してください"
      } else if (this.availableChannels.length === 0) {
        option.textContent = "チャンネル一覧を取得してください"
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
    if (select)
      select.disabled = !this.isConnected || this.availableChannels.length === 0
    if (searchInput)
      searchInput.disabled =
        !this.isConnected || this.availableChannels.length === 0
    if (loadBtn) loadBtn.disabled = !this.isConnected
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

  async addChannel() {
    const select = document.getElementById("channelSelect")
    const channelId = select.value

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
    await this.updateUI()
    // チャンネル追加時に設定を保存
    await this.saveConfig()
  }

  async removeChannel(channelId) {
    this.watchedChannels = this.watchedChannels.filter((id) => id !== channelId)
    delete this.watchedChannelData[channelId] // チャンネルデータも削除
    ipcRenderer.send("slack-remove-channel", channelId)
    await this.updateUI()
    // チャンネル削除時に設定を保存
    await this.saveConfig()
  }

  async updateUI(dialogRoot = document) {
    this.updateChannelSelect(undefined, dialogRoot)
    // 監視中チャンネル数の表示を更新
    const channelCountEl = dialogRoot.getElementById
      ? dialogRoot.getElementById("channelCount")
      : dialogRoot.querySelector("#channelCount")
    if (channelCountEl) {
      channelCountEl.textContent = this.watchedChannels.length
    }
    // 監視中チャンネル名リストの表示を更新
    const channelListEl = dialogRoot.getElementById
      ? dialogRoot.getElementById("watchedChannelList")
      : dialogRoot.querySelector("#watchedChannelList")
    if (channelListEl) {
      if (this.watchedChannels.length === 0) {
        channelListEl.innerHTML =
          '<span style="color:#888">（監視チャンネルなし）</span>'
      } else {
        channelListEl.innerHTML = this.watchedChannels
          .map((id) => {
            const name =
              this.watchedChannelData &&
              this.watchedChannelData[id] &&
              this.watchedChannelData[id].name
                ? this.watchedChannelData[id].name
                : id
            return `<span class="channel-item">#${name}</span>`
          })
          .join(" ")
      }
    }
    // トークン欄も反映
    this.reflectStateToUI(dialogRoot)
  }

  /**
   * Slack状態表示を更新する（#slackStatus要素のテキストとクラスを切り替え）
   * @param {string} message - 表示するメッセージ
   * @param {string} status - 状態クラス（"connected" | "error" | ""）
   */
  updateStatus(message, status = "") {
    const statusEl = document.getElementById("slackStatus")
    if (!statusEl) return
    statusEl.textContent = message
    statusEl.classList.remove("connected", "error")
    if (status === "connected") {
      statusEl.classList.add("connected")
    } else if (status === "error") {
      statusEl.classList.add("error")
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
    this.updateUI()
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

function showSlackSettings() {
  // 既存ダイアログがあれば削除
  const oldDialog = document.getElementById("slackSettingsDialog")
  if (oldDialog) oldDialog.remove()

  // テンプレートからダイアログ生成
  const tmpl = document.getElementById("slackSettingsDialogTemplate")
  if (!tmpl) return
  const dialog = document.createElement("div")
  dialog.id = "slackSettingsDialog"
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
  dialog.appendChild(inner)
  document.body.appendChild(dialog)

  // 閉じるボタン
  const closeBtn = dialog.querySelector(".close-dialog-btn")
  if (closeBtn) closeBtn.onclick = () => dialog.remove()

  // 各種UI要素の初期化・イベントリスナー再設定
  if (window.slackIntegration) {
    window.slackIntegration.updateUI(dialog)
    window.slackIntegration.setupChannelSearch()
  }
  // Slack接続・チャンネル追加・クリア等のボタンも再度イベント登録が必要
  const connectBtn = dialog.querySelector("#connectSlackBtn")
  if (connectBtn)
    connectBtn.onclick = async () => {
      await window.slackIntegration.connect(dialog)
    }
  const addChannelBtn = dialog.querySelector("#addChannelBtn")
  if (addChannelBtn)
    addChannelBtn.onclick = async () => {
      await window.slackIntegration.addChannel()
    }
  const loadChannelsBtn = dialog.querySelector("#loadChannelsBtn")
  if (loadChannelsBtn)
    loadChannelsBtn.onclick = async () => {
      await window.slackIntegration.loadChannels()
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
            await window.slackIntegration.updateUI(dialog)
            alert("設定をクリアしました")
          }
        } catch (error) {
          console.error("設定クリアエラー:", error)
          alert("設定のクリアに失敗しました")
        }
      }
    }
}

function toggleSlackSettings() {
  const content = document.getElementById("slackContent")
  const collapseBtn = document.getElementById("slackCollapseBtn")

  if (content.classList.contains("collapsed")) {
    content.classList.remove("collapsed")
    collapseBtn.classList.remove("collapsed")
    collapseBtn.textContent = "▼"
  } else {
    content.classList.add("collapsed")
    collapseBtn.classList.add("collapsed")
    collapseBtn.textContent = "▶"
  }
}

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
