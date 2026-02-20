import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import {
  SlackConfig, SlackConnectionResult, ConfigSaveResult, ConfigLoadResult,
  SlackMessage, ChannelListResult, ChannelActionResult, SlackChannel,
  EmojiListResult, SlackReactionEvent
} from './types';

/**
 * Tauri APIラッパー
 * Tauri の invoke() / listen() をラップして統一的なインターフェースを提供する
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
  onSlackReaction: (callback: (event: SlackReactionEvent) => void): (() => void) => {
    let unlisten: (() => void) | null = null;
    listen<SlackReactionEvent>('slack-reaction', (event) => {
      callback(event.payload);
    }).then(fn => { unlisten = fn; });
    return () => { if (unlisten) unlisten(); };
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
