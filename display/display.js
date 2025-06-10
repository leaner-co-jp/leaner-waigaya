/**
 * 透過背景テキスト表示機能
 */

class DisplayManager {
  constructor() {
    this.textContainer = document.getElementById("text-container")
    this.displayedTexts = []
    this.textIdCounter = 0
    this.maxTexts = 10 // 最大表示数

    this.initializeIPC()
    this.clearTestDisplay()
  }

  /**
   * Slackメッセージを表示
   * @param {string} text - メッセージテキスト
   * @param {Object} metadata - ユーザー情報等のメタデータ
   */
  displaySlackMessage(text, metadata) {
    try {
      const safeData = this.sanitizeSlackData(text, metadata)

      if (!safeData.text) {
        console.warn("空のSlackメッセージを受信:", { text, metadata })
        return
      }

      console.log("Slackメッセージ表示開始:", {
        text: safeData.text,
        user: safeData.user,
      })

      const messageItem = this.createSlackMessageElement(safeData)
      this.addToContainer(messageItem)
      this.startFadeInAnimation(messageItem)
      this.trackDisplayedText(messageItem)
      this.enforceMaxTexts()

      // 表示時に最前面ON
      if (typeof require !== "undefined") {
        const { ipcRenderer } = require("electron")
        ipcRenderer.send("set-always-on-top", true)
      }

      // 個別に指定時間後にフェードアウト・削除
      const displayTime = 3000 // ms
      const fadeTime = 1000 // ms
      setTimeout(() => {
        messageItem.classList.add("fade-out")
        setTimeout(() => {
          if (messageItem.parentNode) {
            messageItem.parentNode.removeChild(messageItem)
          }
          // 全て消えたら最前面OFF
          if (this.textContainer.childElementCount === 0) {
            if (typeof require !== "undefined") {
              const { ipcRenderer } = require("electron")
              ipcRenderer.send("set-always-on-top", false)
            }
          }
          // 高さ再設定
          // setTimeout(() => {
          //   this.updateWindowSize()
          // }, 50)
        }, fadeTime)
      }, displayTime)

      console.log("Slackメッセージ表示完了")

      // setTimeout(() => this.updateWindowSize(), 100)
    } catch (error) {
      this.handleSlackDisplayError(error, text, metadata)
    }
  }

  /**
   * 全てのテキストをクリア
   */
  clearAllTexts() {
    this.displayedTexts.forEach((item) => {
      item.element.classList.add("fade-out")
      setTimeout(() => {
        if (item.element.parentNode) {
          item.element.parentNode.removeChild(item.element)
        }
      }, 500)
    })
    this.displayedTexts = []

    // 全てのテキストがクリアされた時に最前面表示を解除
    if (typeof require !== "undefined") {
      const { ipcRenderer } = require("electron")
      console.log("🔧 全テキストクリア: 最前面表示を解除")
      ipcRenderer.send("set-always-on-top", false)
    }

    // ウィンドウサイズを最小に更新
    // setTimeout(() => this.updateWindowSize(), 100)
  }

  // プライベートメソッド

  /**
   * テキスト要素を作成
   * @param {string} text - テキスト内容
   * @param {string} className - CSSクラス名
   * @returns {HTMLElement} 作成された要素
   */
  createTextElement(text, className) {
    const textItem = document.createElement("div")
    // Tailwindクラスでスタイリング
    textItem.className =
      "whitespace-pre-wrap break-words transition-opacity transition-transform duration-500 ease-in-out opacity-100 translate-y-0 mb-1.5 p-2.5 rounded-lg bg-black/30 backdrop-blur-sm min-h-[40px] flex items-center" +
      (className.includes("fade-in") ? " opacity-0 -translate-y-5" : "") +
      (className.includes("fade-out") ? " opacity-0 translate-y-5" : "") +
      (className.includes("removing")
        ? " transition-all duration-300 opacity-0 -translate-y-12 scale-90 mb-[-60px]"
        : "")
    textItem.textContent = text
    textItem.id = `text-${++this.textIdCounter}`
    return textItem
  }

  /**
   * Slackメッセージ要素を作成
   * @param {Object} safeData - サニタイズされたデータ
   * @returns {HTMLElement} 作成された要素
   */
  createSlackMessageElement(safeData) {
    const messageItem = document.createElement("div")
    messageItem.className =
      "whitespace-pre-wrap break-words transition-opacity transition-transform duration-500 ease-in-out opacity-100 translate-y-0 mb-1.5 min-h-[40px] flex items-start gap-2.5 p-3 rounded-xl bg-black/60 backdrop-blur-md" +
      " fade-in opacity-0 -translate-y-5"
    messageItem.id = `text-${++this.textIdCounter}`

    // アバター画像
    const avatar = this.createAvatarElement(safeData.userIcon)

    // コンテンツエリア
    const content = this.createSlackContentElement(safeData)

    messageItem.appendChild(avatar)
    messageItem.appendChild(content)

    return messageItem
  }

  /**
   * アバター画像要素を作成
   * @param {string} userIcon - ユーザーアイコンURL
   * @returns {HTMLElement} アバター要素
   */
  createAvatarElement(userIcon) {
    const avatar = document.createElement("img")
    avatar.className = "w-8 h-8 rounded-md flex-shrink-0 mt-0.5"
    avatar.src = userIcon
    avatar.onerror = function () {
      this.src =
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23ccc"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="14">👤</text></svg>'
    }
    return avatar
  }

  /**
   * Slackコンテンツエリアを作成
   * @param {Object} safeData - サニタイズされたデータ
   * @returns {HTMLElement} コンテンツ要素
   */
  createSlackContentElement(safeData) {
    const content = document.createElement("div")
    content.className = "flex-1 min-w-0"

    // ユーザー名
    const userDiv = document.createElement("div")
    userDiv.className =
      "text-sm text-[#00d4aa] font-semibold mb-1 drop-shadow-[1px_1px_2px_rgba(0,0,0,0.8)]"
    userDiv.textContent = safeData.user

    // メッセージテキスト
    const textDiv = document.createElement("div")
    textDiv.className =
      "text-lg text-white leading-snug drop-shadow-[2px_2px_4px_rgba(0,0,0,0.8)]"
    textDiv.textContent = safeData.text

    content.appendChild(userDiv)
    content.appendChild(textDiv)

    return content
  }

  /**
   * Slackデータをサニタイズ
   * @param {string} text - テキスト
   * @param {Object} metadata - メタデータ
   * @returns {Object} サニタイズされたデータ
   */
  sanitizeSlackData(text, metadata) {
    return {
      text: text ? String(text).trim() : "",
      user: metadata?.user ? String(metadata.user).trim() : "Unknown",
      userIcon:
        metadata?.userIcon ||
        'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23ccc"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="14">👤</text></svg>',
    }
  }

  /**
   * 要素をコンテナに追加
   * @param {HTMLElement} element - 追加する要素
   */
  addToContainer(element) {
    this.textContainer.insertBefore(element, this.textContainer.firstChild)
  }

  /**
   * フェードインアニメーションを開始
   * @param {HTMLElement} element - アニメーションする要素
   */
  startFadeInAnimation(element) {
    setTimeout(() => {
      element.classList.remove("fade-in")
    }, 10)
  }

  /**
   * 表示中のテキストを追跡
   * @param {HTMLElement} element - 追跡する要素
   */
  trackDisplayedText(element) {
    this.displayedTexts.unshift({
      id: element.id,
      element: element,
      timestamp: Date.now(),
    })
  }

  /**
   * 最大表示数を超えた場合の古いテキスト削除
   */
  enforceMaxTexts() {
    while (this.displayedTexts.length > this.maxTexts) {
      this.removeOldestText()
    }
  }

  /**
   * 最も古いテキストを削除
   */
  removeOldestText() {
    if (this.displayedTexts.length === 0) return

    const oldest = this.displayedTexts.pop()
    oldest.element.classList.add("removing")

    setTimeout(() => {
      if (oldest.element.parentNode) {
        oldest.element.parentNode.removeChild(oldest.element)
      }
      // 要素削除後にウィンドウサイズを更新
      // this.updateWindowSize()
    }, 300)
  }

  /**
   * Slack表示エラーハンドリング
   * @param {Error} error - エラーオブジェクト
   * @param {string} text - 元のテキスト
   * @param {Object} metadata - 元のメタデータ
   */
  handleSlackDisplayError(error, text, metadata) {
    console.error("Slackメッセージ表示エラー:", error)
    console.error("エラー詳細:", { text, metadata, stack: error.stack })

    // フォールバック: Slackメッセージとして表示
    try {
      const fallbackText = `${metadata?.user || "Unknown"}: ${text || "エラー"}`
      this.displaySlackMessage(fallbackText, metadata)
    } catch (fallbackError) {
      console.error("フォールバック表示もエラー:", fallbackError)
    }
  }

  /**
   * IPCメッセージリスナーを初期化
   */
  initializeIPC() {
    if (typeof require !== "undefined") {
      const { ipcRenderer } = require("electron")

      // Slackメッセージデータを受信
      ipcRenderer.on("display-slack-message-data", (event, data) => {
        const { text, metadata } = data
        this.displaySlackMessage(text, metadata)
      })

      // 通常テキストデータを受信
      ipcRenderer.on("display-text-data", (event, text) => {
        this.updateDisplayText(text)
      })
    }
  }

  /**
   * ウィンドウサイズを更新
   */
  updateWindowSize() {
    if (typeof require !== "undefined") {
      const { ipcRenderer } = require("electron")

      const hasContent = this.displayedTexts.length > 0

      if (hasContent) {
        setTimeout(() => {
          const minHeight = 150
          const maxHeightLimit = 800
          const scrollHeight = this.textContainer.scrollHeight + 60

          const contentHeight = Math.max(
            minHeight,
            Math.min(maxHeightLimit, scrollHeight)
          )

          console.log(
            `🔧 ウィンドウサイズ更新: x${contentHeight} (スクロール: x${scrollHeight})`
          )
          ipcRenderer.send("update-window-size", {
            height: Math.ceil(contentHeight),
          })
        }, 50)
      } else {
        console.log("🔧 ウィンドウサイズ更新: デフォルトサイズ")
        ipcRenderer.send("update-window-size", { height: 150 })
      }
    }
  }

  /**
   * テスト用の初期表示をクリア
   */
  clearTestDisplay() {
    setTimeout(() => {
      this.clearAllTexts()
    }, 1000)
  }
}

// 初期化
document.addEventListener("DOMContentLoaded", () => {
  displayManager = new DisplayManager()
})
