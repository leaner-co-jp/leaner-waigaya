// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit()
}

const { app, BrowserWindow, ipcMain, safeStorage } = require("electron")
const path = require("path")
const fs = require("fs")
const SlackWatcher = require("./control/slack-client")

let mainWindow
let controlWindow
let slackWatcher

// 設定ファイルのパス
const configPath = path.join(app.getPath("userData"), "slack-config.json")

// 設定を保存
function saveConfig(config) {
  try {
    const configToSave = { ...config }

    // トークンを暗号化して保存
    if (safeStorage.isEncryptionAvailable()) {
      if (config.botToken) {
        configToSave.botToken = safeStorage
          .encryptString(config.botToken)
          .toString("base64")
        configToSave._botTokenEncrypted = true
      }
      if (config.appToken) {
        configToSave.appToken = safeStorage
          .encryptString(config.appToken)
          .toString("base64")
        configToSave._appTokenEncrypted = true
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2))
    console.log("📁 設定を保存しました:", configPath)
    return true
  } catch (error) {
    console.error("❌ 設定保存エラー:", error)
    return false
  }
}

// 設定を読み込み
function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"))

      // 暗号化されたトークンを復号化
      if (safeStorage.isEncryptionAvailable()) {
        if (config._botTokenEncrypted && config.botToken) {
          try {
            config.botToken = safeStorage.decryptString(
              Buffer.from(config.botToken, "base64")
            )
            delete config._botTokenEncrypted
          } catch (error) {
            console.error("Bot Token復号化エラー:", error)
            config.botToken = ""
          }
        }
        if (config._appTokenEncrypted && config.appToken) {
          try {
            config.appToken = safeStorage.decryptString(
              Buffer.from(config.appToken, "base64")
            )
            delete config._appTokenEncrypted
          } catch (error) {
            console.error("App Token復号化エラー:", error)
            config.appToken = ""
          }
        }
      }

      console.log("📁 設定を読み込みました:", {
        ...config,
        botToken: config.botToken ? "***LOADED***" : "",
        appToken: config.appToken ? "***LOADED***" : "",
      })
      return config
    }
  } catch (error) {
    console.error("❌ 設定読み込みエラー:", error)
  }
  return null
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  // 開発環境とプロダクション環境の判定
  const isDev = process.env.NODE_ENV === "development"

  if (isDev) {
    // 開発環境: Viteサーバーから読み込み
    mainWindow.loadURL("http://localhost:5173/display/display.html")
  } else {
    // プロダクション環境: ビルドされたファイルから読み込み
    mainWindow.loadFile(path.join(__dirname, "dist/display/display.html"))
  }

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 800,
    height: 1200,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  // 開発環境とプロダクション環境の判定
  const isDev = process.env.NODE_ENV === "development"

  if (isDev) {
    // 開発環境: Viteサーバーから読み込み
    controlWindow.loadURL("http://localhost:5173/control/control.html")
  } else {
    // プロダクション環境: ビルドされたファイルから読み込み
    controlWindow.loadFile(path.join(__dirname, "dist/control/control.html"))
  }

  controlWindow.on("closed", () => {
    controlWindow = null
  })
}

app.whenReady().then(() => {
  createMainWindow()
  createControlWindow()

  // Slack Watcher初期化
  slackWatcher = new SlackWatcher()

  // 保存された設定があれば読み込み
  const savedConfig = loadConfig()
  if (savedConfig) {
    console.log("🔧 初期化時に保存設定を読み込み")
    slackWatcher.updateConfig(savedConfig)
  }

  // Slackメッセージ受信時の処理
  slackWatcher.onMessage((messageData) => {
    console.log("🎯 メインプロセスでSlackメッセージ受信:", messageData)
    if (controlWindow) {
      console.log("📤 コントロールウィンドウに送信中...")
      controlWindow.webContents.send("slack-message-received", messageData)
      console.log("✅ コントロールウィンドウに送信完了")
    } else {
      console.log("⚠️ コントロールウィンドウが見つかりません")
    }
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
    createControlWindow()
  }
})

// 最前面表示の状態管理
let isAlwaysOnTopManuallySet = false

// IPC通信の設定
ipcMain.on("display-text", (event, text) => {
  if (mainWindow) {
    if (text && text.trim()) {
      // テキストがある場合は最前面に表示（手動設定されていない場合のみ）
      if (!isAlwaysOnTopManuallySet) {
        mainWindow.setAlwaysOnTop(true, "screen-saver")
      }
    } else {
      // テキストが空の場合は最前面から外す（手動設定されていない場合のみ）
      if (!isAlwaysOnTopManuallySet) {
        mainWindow.setAlwaysOnTop(false)
      }
    }

    // データをレンダラープロセスに送信
    mainWindow.webContents.send("display-text-data", text)
  }
})

// 最前面表示の制御
ipcMain.on("set-always-on-top", (event, alwaysOnTop) => {
  if (mainWindow) {
    console.log(`🔧 最前面表示を手動設定: ${alwaysOnTop}`)
    mainWindow.setAlwaysOnTop(alwaysOnTop)
    isAlwaysOnTopManuallySet = true

    // 一定時間後に手動設定フラグをリセット（次のメッセージで自動制御を再開）
    setTimeout(() => {
      isAlwaysOnTopManuallySet = false
      console.log("🔧 最前面表示の手動設定をリセット")
    }, 5000) // 5秒後にリセット
  }
})

// Slackメッセージ表示
ipcMain.on("display-slack-message", (event, data) => {
  if (mainWindow) {
    // Slackメッセージの場合は最前面に表示（手動設定されていない場合のみ）
    if (!isAlwaysOnTopManuallySet) {
      mainWindow.setAlwaysOnTop(true, "screen-saver")
    }

    // データをレンダラープロセスに送信
    mainWindow.webContents.send("display-slack-message-data", data)
  }
})

// Slack関連のIPC
ipcMain.handle("slack-connect", async (event, config) => {
  try {
    // 保存された設定も含めて読み込み
    const savedConfig = loadConfig()
    const mergedConfig = {
      ...config,
      channels: savedConfig?.channels || [],
    }

    console.log("🔧 Slack接続設定:", {
      ...mergedConfig,
      botToken: mergedConfig.botToken ? "***" : "",
      appToken: mergedConfig.appToken ? "***" : "",
    })

    slackWatcher.updateConfig(mergedConfig)
    await slackWatcher.connect()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("slack-disconnect", async () => {
  try {
    await slackWatcher.disconnect()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("slack-test-connection", async (event, config) => {
  try {
    const tempWatcher = new SlackWatcher()
    tempWatcher.updateConfig(config)
    return await tempWatcher.testConnection()
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("slack-get-channels", async () => {
  try {
    return await slackWatcher.getChannelList()
  } catch (error) {
    return []
  }
})

ipcMain.on("slack-add-channel", async (event, channelId) => {
  await slackWatcher.addWatchChannel(channelId)
})

ipcMain.on("slack-remove-channel", (event, channelId) => {
  slackWatcher.removeWatchChannel(channelId)
})

ipcMain.handle("slack-get-status", () => {
  return {
    connected: slackWatcher.getConnectionStatus(),
    config: slackWatcher.getConfig(),
  }
})

// チャンネル情報を取得
ipcMain.handle("slack-get-channel-info", async (event, channelId) => {
  try {
    return await slackWatcher.getChannelInfo(channelId)
  } catch (error) {
    return { name: channelId, error: error.message }
  }
})

// 設定保存
ipcMain.handle("save-config", (event, config) => {
  try {
    return { success: saveConfig(config) }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// 設定読み込み
ipcMain.handle("load-config", () => {
  try {
    const config = loadConfig()
    return { success: true, config }
  } catch (error) {
    return { success: false, error: error.message, config: null }
  }
})
