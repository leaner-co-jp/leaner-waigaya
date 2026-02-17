import React, { useState, useEffect } from "react"
import { SlackChannel } from "../lib/types"

interface ChannelManagerProps {
  isConnected: boolean
}

export const ChannelManager: React.FC<ChannelManagerProps> = ({
  isConnected,
}) => {
  const [watchedChannels, setWatchedChannels] = useState<string[]>([])
  const [watchedChannelData, setWatchedChannelData] = useState<{
    [key: string]: SlackChannel
  }>({})
  const [showChannelDialog, setShowChannelDialog] = useState(false)
  const [availableChannels, setAvailableChannels] = useState<SlackChannel[]>([])
  const [channelSearch, setChannelSearch] = useState("")
  const [selectedChannel, setSelectedChannel] = useState("")
  const [isLoadingChannels, setIsLoadingChannels] = useState(false)

  // 監視中のチャンネル一覧を取得
  const loadWatchedChannels = async () => {
    try {
      const result = await window.electronAPI.getWatchedChannels()
      setWatchedChannels(result.ids)
      setWatchedChannelData(result.data)
    } catch (error) {
      console.error("監視チャンネル取得エラー:", error)
    }
  }

  // チャンネル一覧を取得
  const loadChannelList = async () => {
    if (!isConnected) {
      alert("先にSlackに接続してください")
      return
    }

    setIsLoadingChannels(true)
    try {
      const result = await window.electronAPI.slackGetChannels()
      if (result.success && result.channels) {
        setAvailableChannels(result.channels)
        console.log(
          `チャンネル一覧取得完了: ${result.channels.length}チャンネル`
        )
      } else {
        alert(`チャンネル取得エラー: ${result.error}`)
      }
    } catch (error) {
      console.error("チャンネル取得エラー:", error)
      alert("チャンネル取得中にエラーが発生しました")
    } finally {
      setIsLoadingChannels(false)
    }
  }

  // チャンネルを監視に追加
  const addChannel = async () => {
    if (!selectedChannel) return

    console.log("➕ チャンネル追加リクエスト:", selectedChannel)
    try {
      const result = await window.electronAPI.addWatchChannel(selectedChannel)
      console.log("➕ チャンネル追加結果:", result)
      if (result.success) {
        await loadWatchedChannels() // 監視リストを更新
        setSelectedChannel("")
      } else {
        alert(`チャンネル追加エラー: ${result.error}`)
      }
    } catch (error) {
      console.error("チャンネル追加エラー:", error)
      alert(`チャンネル追加中にエラーが発生しました: ${error}`)
    }
  }

  // チャンネルを監視から削除
  const removeChannel = async (channelId: string) => {
    console.log("🗑️ チャンネル削除リクエスト:", channelId)
    try {
      const result = await window.electronAPI.removeWatchChannel(channelId)
      console.log("🗑️ チャンネル削除結果:", result)
      if (result.success) {
        await loadWatchedChannels() // 監視リストを更新
      } else {
        console.error("チャンネル削除エラー:", result.error)
        alert(`チャンネル削除エラー: ${result.error}`)
      }
    } catch (error) {
      console.error("チャンネル削除エラー:", error)
      alert("チャンネル削除中にエラーが発生しました")
    }
  }

  // 初期化時に監視チャンネルを読み込み
  useEffect(() => {
    if (isConnected) {
      loadWatchedChannels()
    }
  }, [isConnected])

  // チャンネル検索フィルタリング
  const filteredChannels = availableChannels
    .filter((channel) =>
      channel.name.toLowerCase().includes(channelSearch.toLowerCase())
    )
    .sort((a, b) => {
      const aMember = a.is_member ? 1 : 0
      const bMember = b.is_member ? 1 : 0
      return bMember - aMember
    })

  return (
    <>
      {/* 監視チャンネル状況（元のcontrol.htmlから完全再現） */}
      <div
        className={`status-section mb-4 border-l-4 pl-3 ${
          watchedChannels.length > 0 ? "border-green-500" : "border-gray-300"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <div className="status-icon w-4 h-4 flex items-center justify-center rounded-full bg-gray-100 text-xs">
              {watchedChannels.length > 0 ? "🟢" : "⚪"}
            </div>
            <div className="ml-2">
              <div className="font-medium">監視チャンネル</div>
              <div className="text-sm text-gray-600">
                <span>{watchedChannels.length}</span>チャンネル監視中
              </div>
            </div>
          </div>
          <button
            className="bg-green-600 text-white rounded-sm px-3 py-1 text-sm hover:bg-green-700 disabled:opacity-50"
            onClick={() => setShowChannelDialog(true)}
            disabled={!isConnected}
          >
            📺 チャンネル管理
          </button>
        </div>

        {/* 監視中チャンネル一覧表示 */}
        <div className="mt-2 pl-6">
          {watchedChannels.map((channelId) => {
            const channelInfo = watchedChannelData[channelId]
            return (
              <div
                key={channelId}
                className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded-sm text-xs mr-2 mb-1"
              >
                #{channelInfo?.name || channelId}
                <button
                  onClick={() => removeChannel(channelId)}
                  className="ml-1 text-red-600 hover:text-red-800"
                  title="監視を停止"
                >
                  ×
                </button>
              </div>
            )
          })}
          {watchedChannels.length === 0 && (
            <div className="text-gray-500 text-sm">
              監視中のチャンネルはありません
            </div>
          )}
        </div>
      </div>

      {/* チャンネル管理ダイアログ（元のcontrol.htmlから完全再現） */}
      {showChannelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">📺 チャンネル管理</h2>
              <button
                className="bg-gray-300 text-gray-800 rounded-sm px-3 py-1 hover:bg-gray-400"
                onClick={() => setShowChannelDialog(false)}
              >
                閉じる
              </button>
            </div>

            <div className="channel-config">
              {/* 現在の監視チャンネル */}
              <div className="mb-4">
                <h3 className="font-semibold mb-2">監視中のチャンネル</h3>
                <div className="bg-gray-50 border rounded-sm p-3 min-h-[60px]">
                  {watchedChannels.length > 0 ? (
                    watchedChannels.map((channelId) => {
                      const channelInfo = watchedChannelData[channelId]
                      return (
                        <div
                          key={channelId}
                          className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded-sm text-sm mr-2 mb-1"
                        >
                          #{channelInfo?.name || channelId}
                          <button
                            onClick={() => removeChannel(channelId)}
                            className="ml-1 text-red-600 hover:text-red-800"
                            title="監視を停止"
                          >
                            ×
                          </button>
                        </div>
                      )
                    })
                  ) : (
                    <span className="text-gray-500">
                      監視中のチャンネルはありません
                    </span>
                  )}
                </div>
              </div>

              {/* チャンネル検索・追加 */}
              <div className="mb-4">
                <label className="block mb-1 font-semibold">
                  チャンネル検索:
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="チャンネル名で検索..."
                    value={channelSearch}
                    onChange={(e) => setChannelSearch(e.target.value)}
                    className="border rounded-sm px-3 py-2 w-full focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                    disabled={!isConnected}
                  />
                  <button
                    onClick={loadChannelList}
                    disabled={!isConnected || isLoadingChannels}
                    className="bg-blue-600 text-white rounded-sm px-4 py-2 hover:bg-blue-800 whitespace-nowrap disabled:opacity-50"
                  >
                    {isLoadingChannels ? "取得中..." : "一覧取得"}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="block mb-1 font-semibold">
                  チャンネル選択:
                </label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="border rounded-sm px-3 py-2 w-full focus:outline-hidden focus:ring-2 focus:ring-blue-500 mb-2"
                  disabled={!isConnected || availableChannels.length === 0}
                  size={5}
                >
                  {availableChannels.length === 0 ? (
                    <option value="">
                      先にチャンネル一覧を取得してください
                    </option>
                  ) : (
                    <>
                      <option value="">チャンネルを選択してください</option>
                      {filteredChannels.map((channel) => (
                        <option
                          key={channel.id}
                          value={channel.id}
                          disabled={!channel.is_member}
                        >
                          #{channel.name}{" "}
                          {channel.is_private ? "(プライベート)" : ""}
                          {!channel.is_member ? " (未参加)" : ""}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <button
                  onClick={addChannel}
                  disabled={!selectedChannel || !isConnected}
                  className="bg-green-600 text-white rounded-sm px-4 py-2 hover:bg-green-800 w-full disabled:opacity-50"
                >
                  選択したチャンネルを監視に追加
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
