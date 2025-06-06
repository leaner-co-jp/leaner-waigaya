const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")

let mainWindow
let controlWindow

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

  mainWindow.loadFile("display.html")

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 500,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  controlWindow.loadFile("control.html")

  controlWindow.on("closed", () => {
    controlWindow = null
  })
}

app.whenReady().then(() => {
  createMainWindow()
  createControlWindow()
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

// IPC通信の設定
ipcMain.on("display-text", (event, text) => {
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(
      `updateDisplayText('${text.replace(/'/g, "\\'")}');`
    )
  }
})
