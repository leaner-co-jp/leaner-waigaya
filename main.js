const { app, BrowserWindow, ipcMain, safeStorage } = require("electron")
if (require("electron-squirrel-startup")) {
  app.quit()
}

const path = require("path")
const fs = require("fs")
const SlackWatcher = require("./control/slack-client")

let mainWindow
let controlWindow
let slackWatcher

// 設定ファイルのパス
const configPath = path.join(app.getPath("userData"), "slack-config.json")
const usersDataPath = path.join(app.getPath("userData"), "slack-users.json")
const emojisDataPath = path.join(app.getPath("userData"), "slack-emojis.json")

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

// ユーザーデータを保存
function saveUsersData(usersData) {
  try {
    const dataToSave = {
      users: usersData,
      timestamp: Date.now(),
      version: 1
    }
    fs.writeFileSync(usersDataPath, JSON.stringify(dataToSave, null, 2))
    console.log("📁 ユーザーデータを保存しました:", Object.keys(usersData).length + "件")
    return true
  } catch (error) {
    console.error("❌ ユーザーデータ保存エラー:", error)
    return false
  }
}

// ユーザーデータを読み込み
function loadUsersData() {
  try {
    if (fs.existsSync(usersDataPath)) {
      const data = JSON.parse(fs.readFileSync(usersDataPath, "utf8"))
      const dayInMs = 24 * 60 * 60 * 1000
      const isExpired = (Date.now() - data.timestamp) > (7 * dayInMs) // 7日で期限切れ
      
      if (isExpired) {
        console.log("⚠️ ユーザーデータが期限切れです (7日経過)")
        return null
      }
      
      console.log("📁 ユーザーデータを読み込みました:", Object.keys(data.users || {}).length + "件")
      return data.users || {}
    }
  } catch (error) {
    console.error("❌ ユーザーデータ読み込みエラー:", error)
  }
  return null
}

// カスタム絵文字データを保存
function saveEmojisData(emojisData) {
  try {
    const dataToSave = {
      emojis: emojisData,
      timestamp: Date.now(),
      version: 1
    }
    fs.writeFileSync(emojisDataPath, JSON.stringify(dataToSave, null, 2))
    console.log("📁 カスタム絵文字データを保存しました:", Object.keys(emojisData).length + "個")
    return true
  } catch (error) {
    console.error("❌ カスタム絵文字データ保存エラー:", error)
    return false
  }
}

// カスタム絵文字データを読み込み
function loadEmojisData() {
  try {
    if (fs.existsSync(emojisDataPath)) {
      const data = JSON.parse(fs.readFileSync(emojisDataPath, "utf8"))
      const dayInMs = 24 * 60 * 60 * 1000
      const isExpired = (Date.now() - data.timestamp) > (30 * dayInMs) // 30日で期限切れ
      
      if (isExpired) {
        console.log("⚠️ カスタム絵文字データが期限切れです (30日経過)")
        return null
      }
      
      console.log("📁 カスタム絵文字データを読み込みました:", Object.keys(data.emojis || {}).length + "個")
      return data.emojis || {}
    }
  } catch (error) {
    console.error("❌ カスタム絵文字データ読み込みエラー:", error)
  }
  return null
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 600,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
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
// let isAlwaysOnTopManuallySet = false

// IPC通信の設定
ipcMain.on("display-text", (event, text) => {
  if (mainWindow) {
    // if (text && text.trim()) {
    //   // テキストがある場合は最前面に表示（手動設定されていない場合のみ）
    //   if (!isAlwaysOnTopManuallySet) {
    //     mainWindow.setAlwaysOnTop(true, "screen-saver")
    //   }
    // } else {
    //   // テキストが空の場合は最前面から外す（手動設定されていない場合のみ）
    //   if (!isAlwaysOnTopManuallySet) {
    //     mainWindow.setAlwaysOnTop(false)
    //   }
    // }

    // データをレンダラープロセスに送信
    mainWindow.webContents.send("display-text-data", text)
  }
})

// 最前面表示の制御
// ipcMain.on("set-always-on-top", (event, alwaysOnTop) => {
//   if (mainWindow) {
//     console.log(`🔧 最前面表示を手動設定: ${alwaysOnTop}`)
//     mainWindow.setAlwaysOnTop(alwaysOnTop)
//     isAlwaysOnTopManuallySet = true

//     // 一定時間後に手動設定フラグをリセット（次のメッセージで自動制御を再開）
//     setTimeout(() => {
//       isAlwaysOnTopManuallySet = false
//       console.log("🔧 最前面表示の手動設定をリセット")
//     }, 5000) // 5秒後にリセット
//   }
// })

// ウィンドウサイズの更新
// ipcMain.on("update-window-size", (event, { height }) => {
//   if (mainWindow) {
//     // widthは変更せず、heightのみ動的に変更
//     console.log(`🔧 ウィンドウ高さのみ更新: height=${height}`)
//     mainWindow.setSize(600, height)
//     // 位置変更はset-display-positionのみで行う
//   }
// })

// Slackメッセージ表示
ipcMain.on("display-slack-message", (event, data) => {
  if (mainWindow) {
    // Slackメッセージの場合は最前面に表示（手動設定されていない場合のみ）
    // if (!isAlwaysOnTopManuallySet) {
    //   mainWindow.setAlwaysOnTop(true, "screen-saver")
    // }

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

ipcMain.handle("slack-reload-users", async () => {
  try {
    await slackWatcher.reloadUsers(saveUsersData)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// カスタム絵文字取得
ipcMain.handle("slack-get-custom-emojis", async () => {
  try {
    const customEmojis = await slackWatcher.fetchCustomEmojis(true, saveEmojisData)
    return { success: true, emojis: customEmojis }
  } catch (error) {
    return { success: false, error: error.message, emojis: {} }
  }
})

// カスタム絵文字をdisplay側に送信
ipcMain.on("send-custom-emojis-to-display", (event, customEmojis) => {
  if (mainWindow) {
    mainWindow.webContents.send("custom-emojis-data", customEmojis)
  }
})

// ユーザーデータ保存
ipcMain.handle("save-users-data", (event, usersData) => {
  try {
    return { success: saveUsersData(usersData) }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// ユーザーデータ読み込み
ipcMain.handle("load-users-data", () => {
  try {
    const usersData = loadUsersData()
    return { success: true, data: usersData }
  } catch (error) {
    return { success: false, error: error.message, data: null }
  }
})

// カスタム絵文字データ保存
ipcMain.handle("save-emojis-data", (event, emojisData) => {
  try {
    return { success: saveEmojisData(emojisData) }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// カスタム絵文字データ読み込み
ipcMain.handle("load-emojis-data", () => {
  try {
    const emojisData = loadEmojisData()
    return { success: true, data: emojisData }
  } catch (error) {
    return { success: false, error: error.message, data: null }
  }
})

// SlackWatcherにローカルユーザーデータを設定
ipcMain.handle("set-local-users-data", () => {
  try {
    if (slackWatcher) {
      const usersData = loadUsersData()
      if (usersData) {
        slackWatcher.setLocalUsersData(usersData)
        return { success: true }
      }
    }
    return { success: false, error: 'ユーザーデータが見つかりません' }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// SlackWatcherにローカルカスタム絵文字データを設定
ipcMain.handle("set-local-emojis-data", () => {
  try {
    if (slackWatcher) {
      const emojisData = loadEmojisData()
      if (emojisData) {
        slackWatcher.setLocalEmojisData(emojisData)
        return { success: true, data: emojisData }
      }
    }
    return { success: false, error: 'カスタム絵文字データが見つかりません' }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
