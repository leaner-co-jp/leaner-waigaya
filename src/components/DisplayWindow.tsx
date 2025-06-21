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

  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI) return

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
      }
    )

    const cleanupSettingsListener = window.electronAPI.onDisplaySettingsUpdate(
      () => {
        setMessages((prev) => [...prev])
      }
    )

    return () => {
      cleanupMessageListener()
      cleanupEmojiListener()
      cleanupSettingsListener()
    }
  }, [])

  return (
    <div className="m-0 p-0 bg-transparent h-screen border rounded-2xl border-gray-500 text-black overflow-hidden">
      <div className="w-full bg-white/10 text-white px-2 py-1 text-xs">
        waigaya
      </div>
      <div className="flex flex-col gap-2 m-2 overflow-hidden">
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
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
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
