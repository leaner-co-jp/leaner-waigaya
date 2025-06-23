export interface SlackConfig {
  botToken: string;
  appToken: string;
  channels?: string[];                    // 監視チャンネルID一覧
  watchedChannelData?: { [key: string]: SlackChannel }; // チャンネル詳細情報
}

export interface SlackConnectionResult {
  success: boolean;
  error?: string;
}

export interface ConfigSaveResult {
  success: boolean;
  error?: string;
}

export interface ConfigLoadResult {
  success: boolean;
  config: SlackConfig | null;
  error?: string;
}

export interface SlackMessage {
  text: string;
  user: string;
  userIcon: string;
  channel?: string;
  timestamp?: string;
  _queueAction?: 'addToQueue'; // TextQueue操作用の内部フラグ
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private?: boolean;
  is_member?: boolean;
}

export interface ChannelListResult {
  success: boolean;
  channels?: SlackChannel[];
  error?: string;
}

export interface ChannelActionResult {
  success: boolean;
  error?: string;
  message?: string;
}

export interface CustomEmoji {
  name: string;
  url: string;
}

export interface EmojiListResult {
  success: boolean;
  emojis?: CustomEmoji[];
  error?: string;
}

// IPC通信用の型定義
export interface ElectronAPI {
  // 接続管理
  slackConnect: (config: SlackConfig) => Promise<SlackConnectionResult>;
  slackTestConnection: (config: SlackConfig) => Promise<SlackConnectionResult>;
  saveConfig: (config: SlackConfig) => Promise<ConfigSaveResult>;
  loadConfig: () => Promise<ConfigLoadResult>;

  // メッセージング
  displaySlackMessage: (message: SlackMessage) => void;
  onDisplaySlackMessage: (callback: (message: SlackMessage) => void) => () => void;
  onAddToTextQueue: (callback: (message: SlackMessage) => void) => () => void;
  removeAllListeners: (channel: string) => void;

  // チャンネル管理
  slackGetChannels: () => Promise<ChannelListResult>;
  addWatchChannel: (channelId: string) => Promise<ChannelActionResult>;
  removeWatchChannel: (channelId: string) => Promise<ChannelActionResult>;
  getChannelInfo: (channelId: string) => Promise<SlackChannel>;
  getWatchedChannels: () => Promise<{ ids: string[], data: { [key: string]: SlackChannel } }>;
  getCurrentChannelName: () => Promise<string>;
  onChannelUpdated: (callback: (channelName: string) => void) => () => void;

  // ユーザー管理
  slackReloadUsers: () => Promise<{ success: boolean, count?: number, error?: string }>;
  slackGetUsersCount: () => Promise<{ success: boolean, count: number, error?: string }>;
  onUserDataUpdated: (callback: (count: number) => void) => () => void;
  clearUserDataUpdated: () => void;

  // 絵文字管理
  getCustomEmojis: () => Promise<EmojiListResult>;
  saveEmojisData: (emojis: any) => Promise<{ success: boolean; error?: string }>;
  onCustomEmojisData: (callback: (emojis: any) => void) => void;

  // ローカルデータ管理
  setLocalUsersData: () => Promise<{ success: boolean; data?: any; error?: string }>;
  setLocalEmojisData: () => Promise<{ success: boolean; data?: any; error?: string }>;

  // 表示設定
  displaySettingsUpdate: (settings: any) => void;
  onDisplaySettingsUpdate: (callback: () => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
