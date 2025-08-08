import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SlackMessage } from "../lib/types"
import { getDisplaySettings, DisplaySettings } from "./DisplaySettings"
import { emojiConverter } from "../lib/emoji-converter"

interface DisplayMessage extends SlackMessage {
  id: string
  receivedAt: number
}

export const DisplayWindow: React.FC = () => {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [allMessages, setAllMessages] = useState<DisplayMessage[]>([])
  const [channelName, setChannelName] = useState("waigaya")
  const [isHistoryMode, setIsHistoryMode] = useState(false)
  const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const MAX_HISTORY = 1000

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return

    // 初期チャンネル名を取得
    window.electronAPI.getCurrentChannelName().then(setChannelName)

    const handleMessage = (message: SlackMessage) => {
      const displayMessage: DisplayMessage = {
        ...message,
        id: `msg-${Date.now()}-${Math.random()}`,
        receivedAt: Date.now(),
      }
      // 先頭に追加しつつ、20件を超えた分はタイマーをクリア
      setMessages((prev) => {
        const next = [displayMessage, ...prev.slice(0, 19)]
        const trimmed = prev.slice(19)
        trimmed.forEach((m) => {
          const t = timeoutsRef.current[m.id]
          if (t) {
            clearTimeout(t)
            delete timeoutsRef.current[m.id]
          }
        })
        return next
      })

      // 履歴に蓄積（末尾に追加、最大件数で古いものから削除）
      setAllMessages((prev) => {
        const next = [...prev, displayMessage]
        if (next.length > MAX_HISTORY) {
          // 超過分を先頭から落とす
          next.splice(0, next.length - MAX_HISTORY)
        }
        return next
      })

      // 表示期間（秒）後に自動的に削除
      const settings = getDisplaySettings()
      const durationSec = Math.max(
        1,
        Math.min(60, (settings as any).displayDurationSec ?? 5)
      )
      const timeoutId = setTimeout(() => {
        removeMessage(displayMessage.id)
      }, durationSec * 1000)
      timeoutsRef.current[displayMessage.id] = timeoutId
    }

    const cleanupMessageListener =
      window.electronAPI.onDisplaySlackMessage(handleMessage)

    const cleanupEmojiListener = window.electronAPI.onCustomEmojisData(
      (data: any) => {
        emojiConverter.updateCustomEmojis(data)
      }
    )

    const cleanupSettingsListener = window.electronAPI.onDisplaySettingsUpdate(
      () => {
        setMessages((prev) => [...prev])
      }
    )

    const cleanupChannelListener = window.electronAPI.onChannelUpdated(
      (name) => {
        setChannelName(name)
      }
    )

    return () => {
      if (typeof cleanupMessageListener === "function") cleanupMessageListener()
      if (typeof cleanupEmojiListener === "function") cleanupEmojiListener()
      if (typeof cleanupSettingsListener === "function")
        cleanupSettingsListener()
      if (typeof cleanupChannelListener === "function") cleanupChannelListener()
      // タイマーを全てクリア
      Object.values(timeoutsRef.current).forEach((t) => clearTimeout(t))
      timeoutsRef.current = {}
    }
  }, [])

  const removeMessage = (id: string) => {
    // タイマーをクリアしてから削除
    const t = timeoutsRef.current[id]
    if (t) {
      clearTimeout(t)
      delete timeoutsRef.current[id]
    }
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }

  return (
    <div className="m-0 p-0 bg-transparent h-screen border rounded-2xl border-gray-500 text-black overflow-hidden">
      <div
        className="w-full bg-black text-white px-2 py-1 text-xs flex items-center justify-between"
        style={{ WebkitAppRegion: "drag" } as any}
      >
        <span>#{channelName}</span>
        <label
          className="flex items-center gap-1 select-none cursor-pointer"
          style={{ WebkitAppRegion: "no-drag" } as any}
        >
          <input
            type="checkbox"
            checked={isHistoryMode}
            onChange={(e) => setIsHistoryMode(e.target.checked)}
          />
          <span>過去</span>
        </label>
      </div>
      <div
        className={`flex flex-col gap-2 m-2 ${
          isHistoryMode ? "overflow-auto" : "overflow-hidden"
        }`}
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <AnimatePresence>
          {(isHistoryMode
            ? [...allMessages].sort((a, b) => b.receivedAt - a.receivedAt)
            : messages
          ).map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

interface MessageItemProps {
  message: DisplayMessage
}

const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(
    getDisplaySettings()
  )

  useEffect(() => {
    const handleStorageChange = () => {
      setDisplaySettings(getDisplaySettings())
    }
    window.addEventListener("storage", handleStorageChange)
    const interval = setInterval(handleStorageChange, 1000)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  const bgColorWithAlpha = hexToRgba(
    displaySettings.backgroundColor,
    displaySettings.opacity
  )

  if (!message.text) {
    return null
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        transition: {
          duration: Math.max(0.1, Math.min(10, displaySettings.fadeTime)),
        },
      }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        backgroundColor: bgColorWithAlpha,
        color: displaySettings.textColor,
        borderRadius: `${displaySettings.borderRadius}px`,
        overflowWrap: "break-word",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}
      className="px-2 py-2"
    >
      <div className="flex items-start gap-2">
        <img
          src={message.userIcon}
          className="w-8 h-8 rounded-md"
          alt={message.user}
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src =
              'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="%23ccc"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="14">👤</text></svg>'
          }}
        />
        <div className="flex-1">
          <div
            className="font-bold text-sm"
            style={{ color: displaySettings.textColor }}
          >
            {message.user}
          </div>
          <div
            style={{
              fontSize: `${displaySettings.fontSize}px`,
              color: displaySettings.textColor,
            }}
            dangerouslySetInnerHTML={{
              __html: emojiConverter.convertEmojisToReact(message.text),
            }}
          />
        </div>
      </div>
    </motion.div>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace("#", "")
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
  }
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
