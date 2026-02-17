import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import {
  SlackConfig, SlackConnectionResult, ConfigSaveResult, ConfigLoadResult,
  SlackMessage, ChannelListResult, ChannelActionResult, SlackChannel,
  EmojiListResult
} from './types';

/**
 * Tauri APIラッパー
 * window.electronAPI と同じインターフェースを提供し、
 * 内部では Tauri の invoke() / listen() を使用する
 */
export const tauriAPI = {
  // 接続管理
  slackConnect: (config: SlackConfig): Promise<SlackConnectionResult> =>
    invoke('slack_connect', { config }),
  slackTestConnection: (config: SlackConfig): Promise<SlackConnectionResult> =>
    invoke('slack_test_connection', { config }),
  saveConfig: (config: SlackConfig): Promise<ConfigSaveResult> =>
    invoke('save_settings', { config }),
  loadConfig: (): Promise<ConfigLoadResult> =>
    invoke('load_settings'),

  // メッセージング
  displaySlackMessage: (message: SlackMessage): void => {
    emit('display-slack-message', message);
  },
  onDisplaySlackMessage: (callback: (message: SlackMessage) => void): (() => void) => {
    let unlisten: (() => void) | null = null;
    listen<SlackMessage>('display-slack-message', (event) => {
      callback(event.payload);
    }).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  },
  onAddToTextQueue: (callback: (message: SlackMessage) => void): (() => void) => {
    let unlisten: (() => void) | null = null;
    listen<SlackMessage>('add-to-text-queue', (event) => {
      callback(event.payload);
    }).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  },
  removeAllListeners: (_channel: string) => {
    // Tauriではlisten()の戻り値でunlistenするため、この関数は互換性のために残す
  },

  // チャンネル管理
  slackGetChannels: (): Promise<ChannelListResult> =>
    invoke('slack_get_channels'),
  addWatchChannel: (channelId: string): Promise<ChannelActionResult> =>
    invoke('slack_add_channel', { channelId }),
  removeWatchChannel: (channelId: string): Promise<ChannelActionResult> =>
    invoke('slack_remove_channel', { channelId }),
  getChannelInfo: (channelId: string): Promise<SlackChannel> =>
    invoke('slack_get_channel_info', { channelId }),
  getWatchedChannels: (): Promise<{ ids: string[], data: { [key: string]: SlackChannel } }> =>
    invoke('slack_get_watched_channels'),
  getCurrentChannelName: (): Promise<string> =>
    invoke('get_current_channel_name'),
  onChannelUpdated: (callback: (channelName: string) => void): (() => void) => {
    let unlisten: (() => void) | null = null;
    listen<string>('channel-updated', (event) => {
      callback(event.payload);
    }).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  },

  // ユーザー管理
  slackReloadUsers: (): Promise<{ success: boolean, count?: number, error?: string }> =>
    invoke('slack_reload_users'),
  slackGetUsersCount: (): Promise<{ success: boolean, count: number, error?: string }> =>
    invoke('get_users_count'),
  onUserDataUpdated: (callback: (count: number) => void): (() => void) => {
    let unlisten: (() => void) | null = null;
    listen<number>('user-data-updated', (event) => {
      callback(event.payload);
    }).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  },
  clearUserDataUpdated: () => {
    // Tauriでは個別のunlistenで管理するため、この関数は互換性のために残す
  },

  // 絵文字管理
  getCustomEmojis: (): Promise<EmojiListResult> =>
    invoke('slack_get_custom_emojis'),
  saveEmojisData: (emojis: any): Promise<{ success: boolean; error?: string }> =>
    invoke('save_emojis_data', { emojisData: emojis }),
  onCustomEmojisData: (callback: (emojis: any) => void): (() => void) => {
    let unlisten: (() => void) | null = null;
    listen<any>('custom-emojis-data', (event) => {
      callback(event.payload);
    }).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  },

  getEmojisLastUpdated: (): Promise<number | null> =>
    invoke('get_emojis_last_updated'),

  // ローカルデータ管理
  setLocalUsersData: (): Promise<{ success: boolean; data?: any; error?: string }> =>
    invoke('set_local_users_data'),
  setLocalEmojisData: (): Promise<{ success: boolean; data?: any; error?: string }> =>
    invoke('set_local_emojis_data'),

  // 表示設定
  displaySettingsUpdate: (_settings: any): void => {
    emit('display-settings-update', {});
  },
  onDisplaySettingsUpdate: (callback: () => void): (() => void) => {
    let unlisten: (() => void) | null = null;
    listen('display-settings-update', () => {
      callback();
    }).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
  },
};

// window.electronAPI としてグローバルに公開
// 既存のコンポーネントが window.electronAPI を参照しているため、
// Tauri環境ではこのAPIをwindow.electronAPIとして設定する
if (typeof window !== 'undefined') {
  (window as any).electronAPI = tauriAPI;
}
