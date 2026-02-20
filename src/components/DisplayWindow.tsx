import React, { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { SlackMessage, ReactionData, SlackReactionEvent } from "../lib/types"
import { tauriAPI } from "../lib/tauri-api"
import { getDisplaySettings, DisplaySettings } from "./DisplaySettings"
import { emojiConverter } from "../lib/emoji-converter"

interface DisplayMessage extends SlackMessage {
  id: string
  reactions: ReactionData[]
}

export const DisplayWindow: React.FC = () => {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [channelName, setChannelName] = useState("waigaya")

  useEffect(() => {
    // 初期チャンネル名を取得
    tauriAPI.getCurrentChannelName().then(setChannelName)

    const handleMessage = (message: SlackMessage) => {
      const displayMessage: DisplayMessage = {
        ...message,
        id: `msg-${Date.now()}-${Math.random()}`,
        reactions: [],
      }
      setMessages((prev) => [displayMessage, ...prev.slice(0, 19)])
    }

    const handleReaction = (event: SlackReactionEvent) => {
      setMessages((prev) => {
        const idx = prev.findIndex(
          (m) => m.channel === event.channel && m.timestamp === event.message_ts,
        )
        if (idx === -1) return prev

        const updated = [...prev]
        const msg = { ...updated[idx], reactions: [...updated[idx].reactions] }

        if (event.action === "added") {
          const existing = msg.reactions.findIndex((r) => r.name === event.reaction)
          if (existing >= 0) {
            msg.reactions[existing] = {
              ...msg.reactions[existing],
              count: msg.reactions[existing].count + 1,
              users: [...msg.reactions[existing].users, event.user],
            }
          } else {
            msg.reactions.push({ name: event.reaction, count: 1, users: [event.user] })
          }
        } else if (event.action === "removed") {
          const existing = msg.reactions.findIndex((r) => r.name === event.reaction)
          if (existing >= 0) {
            const newCount = msg.reactions[existing].count - 1
            if (newCount <= 0) {
              msg.reactions.splice(existing, 1)
            } else {
              msg.reactions[existing] = {
                ...msg.reactions[existing],
                count: newCount,
                users: msg.reactions[existing].users.filter((u) => u !== event.user),
              }
            }
          }
        }

        updated[idx] = msg
        return updated
      })
    }

    const cleanupMessageListener =
      tauriAPI.onDisplaySlackMessage(handleMessage)

    const cleanupReactionListener =
      tauriAPI.onSlackReaction(handleReaction)

    const cleanupEmojiListener = tauriAPI.onCustomEmojisData(
      (data: any) => {
        emojiConverter.updateCustomEmojis(data)
      },
    )

    const cleanupSettingsListener = tauriAPI.onDisplaySettingsUpdate(
      () => {
        setMessages((prev) => [...prev])
      },
    )

    const cleanupChannelListener = tauriAPI.onChannelUpdated(
      (name) => {
        setChannelName(name)
      },
    )

    return () => {
      cleanupMessageListener()
      cleanupReactionListener()
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

  const hasText = !!message.text
  const hasImages = message.images && message.images.length > 0
  if (!hasText && !hasImages) {
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
            <span className="text-xs">↩</span>「<span dangerouslySetInnerHTML={{ __html: emojiConverter.convertEmojisToReact(message.replyToText!) }} />」
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <img
          src={message.userIcon}
          className="w-9 h-9 rounded-lg shrink-0"
          alt={message.user}
        />
        <div className="flex flex-col">
          <div
            className="text-[15px] font-bold leading-snug"
            style={{ color: displaySettings.textColor }}
          >
            {message.user}
          </div>
          {hasText && (
            <div
              style={{
                fontSize: `${displaySettings.fontSize}px`,
                color: displaySettings.textColor,
              }}
              className="font-normal leading-snug tracking-tight"
              dangerouslySetInnerHTML={{
                __html: emojiConverter.convertEmojisToReact(message.text),
              }}
            />
          )}
          {hasImages && (
            <div className="flex flex-wrap gap-1 mt-1">
              {message.images!.map((img, idx) => (
                <img
                  key={idx}
                  src={img.dataUrl}
                  alt={img.name || "image"}
                  className="rounded-sm max-h-48 max-w-full object-contain"
                  style={{ maxWidth: "360px" }}
                />
              ))}
            </div>
          )}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {message.reactions.map((r) => (
                <span
                  key={r.name}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.15)",
                    color: displaySettings.textColor,
                  }}
                >
                  <span
                    dangerouslySetInnerHTML={{
                      __html: emojiConverter.convertEmojisToReact(`:${r.name}:`),
                    }}
                  />
                  {r.count >= 2 && (
                    <span className="ml-0.5 text-[11px]">{r.count}</span>
                  )}
                </span>
              ))}
            </div>
          )}
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
