import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { SlackWatcher } from './lib/slack-client';
import { SlackConfig, SlackMessage, ConfigSaveResult } from './lib/types';

declare const CONTROL_WINDOW_VITE_NAME: string;
declare const CONTROL_WINDOW_VITE_DEV_SERVER_URL: string;
declare const DISPLAY_WINDOW_VITE_NAME: string;
declare const DISPLAY_WINDOW_VITE_DEV_SERVER_URL: string;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Slack Watcher instance
let slackWatcher: SlackWatcher;

// Windows
let mainWindow: BrowserWindow | null = null; // コントロールウィンドウ
let displayWindow: BrowserWindow | null = null; // 透過表示ウィンドウ
let currentChannelName = "waigaya"; // 表示用のチャンネル名

// 設定ファイルのパス
const configPath = path.join(app.getPath("userData"), "slack-config.json");

// 設定を保存
function saveConfig(config: SlackConfig): ConfigSaveResult {
  try {
    const configToSave: any = { ...config };

    // トークンを暗号化して保存
    if (safeStorage.isEncryptionAvailable()) {
      if (config.botToken) {
        configToSave.botToken = safeStorage
          .encryptString(config.botToken)
          .toString("base64");
        configToSave._botTokenEncrypted = true;
      }
      if (config.appToken) {
        configToSave.appToken = safeStorage
          .encryptString(config.appToken)
          .toString("base64");
        configToSave._appTokenEncrypted = true;
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(configToSave, null, 2));
    console.log("📁 設定を保存しました:", configPath);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ 設定保存エラー:", error);
    return { success: false, error: errorMessage };
  }
}

// 設定を読み込み
function loadConfig(): SlackConfig | null {
  try {
    if (fs.existsSync(configPath)) {
      const config: any = JSON.parse(fs.readFileSync(configPath, "utf8"));

      // 暗号化されたトークンを復号化
      if (safeStorage.isEncryptionAvailable()) {
        if (config._botTokenEncrypted && config.botToken) {
          try {
            config.botToken = safeStorage.decryptString(
              Buffer.from(config.botToken, "base64")
            );
            delete config._botTokenEncrypted;
          } catch (error) {
            console.error("Bot Token復号化エラー:", error);
            config.botToken = "";
          }
        }
        if (config._appTokenEncrypted && config.appToken) {
          try {
            config.appToken = safeStorage.decryptString(
              Buffer.from(config.appToken, "base64")
            );
            delete config._appTokenEncrypted;
          } catch (error) {
            console.error("App Token復号化エラー:", error);
            config.appToken = "";
          }
        }
      }

      console.log("📁 設定を読み込みました:", {
        ...config,
        botToken: config.botToken ? "***LOADED***" : "",
        appToken: config.appToken ? "***LOADED***" : "",
      });
      return config;
    }
  } catch (error) {
    console.error("❌ 設定読み込みエラー:", error);
  }
  return null;
}

// コントロールウィンドウ（設定画面）を作成
const createControlWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 1200,
    title: 'Waigaya - コントロール',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  if (CONTROL_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(`${CONTROL_WINDOW_VITE_DEV_SERVER_URL}/control.html`);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${CONTROL_WINDOW_VITE_NAME}/control.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// 透過表示ウィンドウを作成
const createDisplayWindow = () => {
  displayWindow = new BrowserWindow({
    width: 500,
    height: 600,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    title: 'Waigaya - 表示',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 表示用のHTMLを読み込み（後で実装）
  if (DISPLAY_WINDOW_VITE_DEV_SERVER_URL) {
    displayWindow.loadURL(`${DISPLAY_WINDOW_VITE_DEV_SERVER_URL}/display.html`);
  } else {
    displayWindow.loadFile(path.join(__dirname, `../renderer/${DISPLAY_WINDOW_VITE_NAME}/display.html`));
  }

  displayWindow.on('closed', () => {
    displayWindow = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createControlWindow();
  createDisplayWindow();

  // Slack Watcher初期化
  slackWatcher = new SlackWatcher();

  // SlackメッセージをTextQueue統合用にコントロールウィンドウに送信
  slackWatcher.setMessageCallback((message: SlackMessage) => {
    console.log("📤 メインプロセス: Slackメッセージ受信 ->", message.text?.substring(0, 50) || 'テキストなし');

    if (message._queueAction === 'addToQueue') {
      // TextQueue追加要求をコントロールウィンドウに送信
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('add-to-text-queue', message);
        console.log("📤 メインプロセス: TextQueue追加要求送信完了");
      } else {
        console.log("⚠️ コントロールウィンドウが見つかりません");
      }
    } else {
      // 直接表示（従来の動作）
      if (displayWindow && !displayWindow.isDestroyed()) {
        displayWindow.webContents.send('display-slack-message-data', message);
        console.log("✅ 透過表示ウィンドウにメッセージ送信完了");
      } else {
        console.log("⚠️ 透過表示ウィンドウが見つかりません");
      }
    }
  });

  // チャンネル更新時のコールバック
  slackWatcher.setChannelUpdateCallback(async (channels) => {
    if (channels.length > 0) {
      // 最初のチャンネル情報を取得して更新
      const info = await slackWatcher.getChannelInfo(channels[0]);
      currentChannelName = info.name || "waigaya";
    } else {
      currentChannelName = "waigaya";
    }
    // 表示ウィンドウに通知
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.webContents.send('channel-updated', currentChannelName);
    }
  });

  // 設定保存時のコールバック設定
  slackWatcher.setConfigSaveCallback((config: SlackConfig) => {
    console.log("💾 メインプロセス: 設定保存要求受信");
    const result = saveConfig(config);
    if (result.success) {
      console.log("✅ チャンネル設定保存完了");
    } else {
      console.error("❌ チャンネル設定保存失敗:", result.error);
    }
  });

  // 保存された設定があれば読み込み
  const savedConfig = loadConfig();
  if (savedConfig) {
    console.log("🔧 初期化時に保存設定を読み込み:", {
      botToken: savedConfig.botToken ? "あり" : "なし",
      appToken: savedConfig.appToken ? "あり" : "なし",
      channels: savedConfig.channels || [],
      channelCount: savedConfig.channels?.length || 0,
    });
    slackWatcher.updateConfig(savedConfig);
  }

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createControlWindow();
      createDisplayWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers for Slack integration

// 表示ウィンドウに現在のチャンネル名を返す
ipcMain.handle('get-current-channel-name', () => {
  return currentChannelName;
});

// Slack接続
ipcMain.handle("slack-connect", async (_, config: SlackConfig) => {
  try {
    console.log("🔧 Slack接続設定:", {
      ...config,
      botToken: config.botToken ? "***" : "",
      appToken: config.appToken ? "***" : "",
    });

    await slackWatcher.updateConfig(config);
    return await slackWatcher.connect();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// Slack切断
ipcMain.handle("slack-disconnect", async () => {
  try {
    await slackWatcher.disconnect();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// Slack接続テスト
ipcMain.handle("slack-test-connection", async (_, config: SlackConfig) => {
  try {
    console.log("🔧 接続テスト設定:", {
      ...config,
      botToken: config.botToken ? "***" : "",
      appToken: config.appToken ? "***" : "",
    });
    await slackWatcher.updateConfig(config);
    return await slackWatcher.testConnection();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// チャンネルリスト取得
ipcMain.handle("slack-get-channels", async () => {
  return await slackWatcher.getChannelList();
});

// 監視チャンネル追加
ipcMain.handle("slack-add-channel", async (_, channelId) => {
  return await slackWatcher.addWatchChannel(channelId);
});

// 監視チャンネル削除
ipcMain.handle("slack-remove-channel", async (_, channelId) => {
  return await slackWatcher.removeWatchChannel(channelId);
});

// チャンネル情報を取得
ipcMain.handle('slack-get-channel-info', async (_, channelId: string) => {
  return await slackWatcher.getChannelInfo(channelId);
});

// 監視中チャンネル取得
ipcMain.handle("slack-get-watched-channels", () => {
  return slackWatcher.getWatchedChannels();
});

// ローカル設定の保存（チャンネル以外も含む）
ipcMain.handle("save-settings", (_, config: SlackConfig) => {
  return saveConfig(config);
});

// ローカル設定の読み込み
ipcMain.handle("load-settings", () => {
  try {
    const config = loadConfig();
    return { success: true, config };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, config: null, error: errorMessage };
  }
});

// IPC Handler for display window settings

ipcMain.on('set-display-window-size', (event, size) => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.setSize(size.width, size.height, true);
  }
});

ipcMain.on('set-display-window-position', (event, position) => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.setPosition(position.x, position.y, true);
  }
});

ipcMain.on('set-display-window-always-on-top', (event, flag) => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.setAlwaysOnTop(flag, 'screen-saver');
  }
});

ipcMain.handle('get-display-window-settings', () => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    const size = displayWindow.getSize();
    const position = displayWindow.getPosition();
    return {
      width: size[0],
      height: size[1],
      x: position[0],
      y: position[1],
      alwaysOnTop: displayWindow.isAlwaysOnTop(),
    };
  }
  return null;
});

// TextQueue からのメッセージ表示要求
ipcMain.on('display-slack-message-from-queue', (event, message) => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    console.log("📤 メインプロセス: TextQueueからメッセージ受信 ->", message.text?.substring(0, 50) || 'テキストなし');
    displayWindow.webContents.send('display-slack-message-data', message);
    console.log("✅ 透過表示ウィンドウにメッセージ送信完了（キュー経由）");
  } else {
    console.log("⚠️ 透過表示ウィンドウが見つかりません（キュー経由）");
  }
});

// コントロールパネルからのメッセージ表示要求を中継
ipcMain.on('display-slack-message', (_, message: SlackMessage) => {
  if (displayWindow && !displayWindow.isDestroyed()) {
    displayWindow.webContents.send('display-slack-message-data', message);
  }
});

// --- ユーザー、絵文字データ関連 (現行システム互換) ---

// ユーザーデータをファイルから読み込み
function loadUsersData(): any {
  const usersPath = path.join(app.getPath("userData"), "users.json");
  if (fs.existsSync(usersPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(usersPath, "utf8"));
      console.log(`📁 ユーザーデータを読み込み: ${Object.keys(data).length}件`);
      return data;
    } catch (error) {
      console.error("❌ ユーザーデータ読み込みエラー:", error);
    }
  }
  return {};
}

// 絵文字データをファイルから読み込み
function loadEmojisData(): any {
  const emojisPath = path.join(app.getPath("userData"), "emojis.json");
  if (fs.existsSync(emojisPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(emojisPath, "utf8"));
      console.log(`📁 絵文字データを読み込み: ${Object.keys(data).length}個`);
      return data;
    } catch (error) {
      console.error("❌ 絵文字データ読み込みエラー:", error);
    }
  }
  return {};
}

// ユーザーデータをファイルに保存
function saveUsersData(usersData: any): boolean {
  try {
    const usersPath = path.join(app.getPath("userData"), "users.json");
    fs.writeFileSync(usersPath, JSON.stringify(usersData, null, 2));
    console.log(`💾 ユーザーデータを保存: ${Object.keys(usersData).length}件`);
    return true;
  } catch (error) {
    console.error("❌ ユーザーデータ保存エラー:", error);
    return false;
  }
}

// 絵文字データをファイルに保存
function saveEmojisData(emojisData: any): boolean {
  try {
    const emojisPath = path.join(app.getPath("userData"), "emojis.json");
    fs.writeFileSync(emojisPath, JSON.stringify(emojisData, null, 2));
    console.log(`💾 絵文字データを保存: ${Object.keys(emojisData).length}個`);
    return true;
  } catch (error) {
    console.error("❌ 絵文字データ保存エラー:", error);
    return false;
  }
}

// 起動時にローカルデータを読み込み、SlackWatcherに設定
app.whenReady().then(() => {
  const users = loadUsersData();
  const emojis = loadEmojisData();

  if (slackWatcher) {
    slackWatcher.setLocalUsersData(users);
    slackWatcher.setLocalEmojisData(emojis);
    console.log("✅ SlackWatcherにローカルデータを設定完了");
  }
});

// ユーザー一覧をリロード
ipcMain.handle("slack-reload-users", async () => {
  try {
    if (slackWatcher) {
      const result = await slackWatcher.fetchAllUsers();
      if (result.success && result.users) {
        saveUsersData(result.users); // 取得したデータを保存
        return { success: true, count: result.count };
      }
      return { success: false, error: result.error || "ユーザー一覧の取得に失敗しました" };
    }
    return { success: false, error: "SlackWatcherが初期化されていません" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
});

// ユーザー数を取得
ipcMain.handle("get-users-count", () => {
  if (slackWatcher) {
    return { success: true, count: slackWatcher.getUsersCount() };
  }
  return { success: false, count: 0, error: "SlackWatcher not initialized." };
});

// カスタム絵文字をリロード
ipcMain.handle("slack-get-custom-emojis", async () => {
  if (!slackWatcher) {
    return { success: false, error: "SlackWatcher is not initialized" };
  }
  try {
    const result = await slackWatcher.getCustomEmojis();
    if (result.success && result.emojis) {
      // 取得した絵文字データを{name: url}の形式に変換
      const emojiData: { [key: string]: string } = {};
      result.emojis.forEach(emoji => {
        emojiData[emoji.name] = emoji.url;
      });

      // ファイルに保存
      saveEmojisData(emojiData);

      // UIに更新を通知
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('custom-emojis-data', emojiData);
      }
      if (displayWindow && !displayWindow.isDestroyed()) {
        displayWindow.webContents.send('custom-emojis-data', emojiData);
      }

      return { success: true, count: result.emojis.length };
    }
    return { success: false, error: result.error || "絵文字一覧の取得に失敗しました" };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ カスタム絵文字取得エラー(ipcMain):", errorMessage);
    return { success: false, error: errorMessage };
  }
});

// カスタム絵文字データを保存
ipcMain.handle('save-emojis-data', (_, emojisData: any) => {
  return { success: saveEmojisData(emojisData) };
});

// ローカルのユーザーデータをSlackWatcherに設定
ipcMain.handle('set-local-users-data', () => {
  const users = loadUsersData();
  if (users && Object.keys(users).length > 0) {
    slackWatcher.setLocalUsersData(users);
    return { success: true, data: users };
  }
  return { success: false, error: 'No local user data found.' };
});

// ローカルの絵文字データをSlackWatcherに設定
ipcMain.handle('set-local-emojis-data', () => {
  const emojis = loadEmojisData();
  if (emojis && Object.keys(emojis).length > 0) {
    slackWatcher.setLocalEmojisData(emojis);
    //
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('custom-emojis-data', emojis);
    }
    if (displayWindow && !displayWindow.isDestroyed()) {
      displayWindow.webContents.send('custom-emojis-data', emojis);
    }
    return { success: true, data: emojis };
  }
  return { success: false, error: 'No local emoji data found.' };
});

// キャッシュ状況を取得
ipcMain.handle('get-cache-status', () => {
  if (slackWatcher) {
    return slackWatcher.getCacheStatus();
  }
  return { users: 0, emojis: 0 };
});

// 絵文字URLを取得（変換用）
ipcMain.handle('get-emoji-url', (_, name: string) => {
  if (slackWatcher) {
    return slackWatcher.getCustomEmojiFromCache(name);
  }
  return null;
});
