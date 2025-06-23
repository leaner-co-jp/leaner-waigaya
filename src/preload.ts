import { contextBridge, ipcRenderer } from 'electron';
import {
  SlackConfig, SlackConnectionResult, ConfigSaveResult, ConfigLoadResult,
  SlackMessage, ChannelListResult, ChannelActionResult, SlackChannel,
  EmojiListResult
} from './lib/types';

const electronAPI = {
  // 接続管理
  slackConnect: (config: SlackConfig): Promise<SlackConnectionResult> =>
    ipcRenderer.invoke('slack-connect', config),
  slackTestConnection: (config: SlackConfig): Promise<SlackConnectionResult> =>
    ipcRenderer.invoke('slack-test-connection', config),
  saveConfig: (config: SlackConfig): Promise<ConfigSaveResult> =>
    ipcRenderer.invoke('save-settings', config),
  loadConfig: (): Promise<ConfigLoadResult> =>
    ipcRenderer.invoke('load-settings'),

  // メッセージング
  displaySlackMessage: (message: SlackMessage): void =>
    ipcRenderer.send('display-slack-message', message),
  onDisplaySlackMessage: (callback: (message: SlackMessage) => void): (() => void) => {
    const handler = (_: any, message: SlackMessage) => callback(message);
    ipcRenderer.on('display-slack-message-data', handler);
    return () => ipcRenderer.removeListener('display-slack-message-data', handler);
  },
  onAddToTextQueue: (callback: (message: SlackMessage) => void): (() => void) => {
    const handler = (_: any, message: SlackMessage) => callback(message);
    ipcRenderer.on('add-to-text-queue', handler);
    return () => ipcRenderer.removeListener('add-to-text-queue', handler);
  },
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),

  // チャンネル管理
  slackGetChannels: () => ipcRenderer.invoke("slack-get-channels"),
  addWatchChannel: (channelId: string) => ipcRenderer.invoke("slack-add-channel", channelId),
  removeWatchChannel: (channelId: string) => ipcRenderer.invoke("slack-remove-channel", channelId),
  getChannelInfo: (channelId: string) =>
    ipcRenderer.invoke('slack-get-channel-info', channelId),
  getWatchedChannels: () => ipcRenderer.invoke("slack-get-watched-channels"),
  getCurrentChannelName: () => ipcRenderer.invoke('get-current-channel-name'),
  onChannelUpdated: (callback: (channelName: string) => void): (() => void) => {
    const handler = (_: any, channelName: string) => callback(channelName);
    ipcRenderer.on('channel-updated', handler);
    return () => ipcRenderer.removeListener('channel-updated', handler);
  },

  // ユーザー管理
  slackReloadUsers: () => ipcRenderer.invoke("slack-reload-users"),
  slackGetUsersCount: () => ipcRenderer.invoke("get-users-count"),
  onUserDataUpdated: (callback: (count: number) => void): (() => void) => {
    const handler = (_: any, count: number) => callback(count);
    ipcRenderer.on('user-data-updated', handler);
    return () => ipcRenderer.removeListener('user-data-updated', handler);
  },
  clearUserDataUpdated: () => ipcRenderer.removeAllListeners('user-data-updated'),

  // 絵文字管理
  getCustomEmojis: () => ipcRenderer.invoke("slack-get-custom-emojis"),
  saveEmojisData: (emojis: any) =>
    ipcRenderer.invoke('save-emojis-data', emojis),
  onCustomEmojisData: (callback: (emojis: any) => void): (() => void) => {
    const handler = (_: any, emojis: any) => callback(emojis);
    ipcRenderer.on('custom-emojis-data', handler);
    return () => ipcRenderer.removeListener('custom-emojis-data', handler);
  },

  // ローカルデータ管理
  setLocalUsersData: () =>
    ipcRenderer.invoke('set-local-users-data'),
  setLocalEmojisData: () =>
    ipcRenderer.invoke('set-local-emojis-data'),

  // 表示設定
  displaySettingsUpdate: (settings: any) => ipcRenderer.send("display-settings-update"),
  onDisplaySettingsUpdate: (callback: () => void): (() => void) => {
    const handler = () => callback();
    ipcRenderer.on('display-settings-update-data', handler);
    return () => ipcRenderer.removeListener('display-settings-update-data', handler);
  },
};

export type ElectronAPI = typeof electronAPI;

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
