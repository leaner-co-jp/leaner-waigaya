import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SlackMessage } from "../lib/types"
import { getDisplaySettings, DisplaySettings } from "./DisplaySettings"
import { emojiConverter } from "../lib/emoji-converter"

interface DisplayMessage extends SlackMessage {
  id: string
}

export const DisplayWindow: React.FC = () => {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [channelName, setChannelName] = useState("waigaya")

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return

    // 初期チャンネル名を取得
    window.electronAPI.getCurrentChannelName().then(setChannelName)

    const handleMessage = (message: SlackMessage) => {
      const displayMessage: DisplayMessage = {
        ...message,
        id: `msg-${Date.now()}-${Math.random()}`,
      }
      setMessages((prev) => [displayMessage, ...prev.slice(0, 19)])
    }

    const cleanupMessageListener =
      window.electronAPI.onDisplaySlackMessage(handleMessage)

    const cleanupEmojiListener = window.electronAPI.onCustomEmojisData(
      (data: any) => {
        emojiConverter.updateCustomEmojis(data)
      },
    )

    const cleanupSettingsListener = window.electronAPI.onDisplaySettingsUpdate(
      () => {
        setMessages((prev) => [...prev])
      },
    )

    const cleanupChannelListener = window.electronAPI.onChannelUpdated(
      (name) => {
        setChannelName(name)
      },
    )

    return () => {
      cleanupMessageListener()
      cleanupEmojiListener()
      cleanupSettingsListener()
      cleanupChannelListener()
    }
  }, [])

  return (
    <div className="m-0 p-0 bg-transparent h-screen border rounded-2xl border-gray-500 text-black overflow-hidden">
      <div
        data-tauri-drag-region
        className="w-full bg-black text-white px-2 py-1 text-xs cursor-move"
      >
        #{channelName}
      </div>
      <div className="flex flex-col overflow-hidden">
        <AnimatePresence>
          {messages.map((message) => (
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
  const [displaySettings, setDisplaySettings] =
    useState<DisplaySettings>(getDisplaySettings())

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
    displaySettings.opacity,
  )

  if (!message.text) {
    return null
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{
        backgroundColor: bgColorWithAlpha,
        color: displaySettings.textColor,
        overflowWrap: "break-word",
      }}
      className="px-2 py-2 h-max"
    >
      {message.replyToUser && message.replyToText && (
        <div className="mb-1 pl-2 " style={{ opacity: 0.7 }}>
          <div
            className="text-xs truncate"
            style={{ color: displaySettings.textColor, maxWidth: "100%" }}
          >
            <span className="text-xs">↩</span>「{message.replyToText}」
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <img
          src={message.userIcon}
          className="w-9 h-9 rounded-lg flex-shrink-0"
          alt={message.user}
        />
        <div className="flex flex-col">
          <div
            className="text-[15px] font-bold leading-snug"
            style={{ color: displaySettings.textColor }}
          >
            {message.user}
          </div>
          <div
            style={{
              fontSize: `${displaySettings.fontSize}px`,
              color: displaySettings.textColor,
            }}
            className="font-normal leading-[1.375] tracking-tight"
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
