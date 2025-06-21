import { WebClient } from "@slack/web-api";
import { SocketModeClient, LogLevel } from "@slack/socket-mode";
import { SlackConfig, SlackConnectionResult, SlackChannel, ChannelListResult, ChannelActionResult, CustomEmoji, EmojiListResult } from "./types";

export class SlackWatcher {
  private socketClient: SocketModeClient | null = null;
  private isConnected: boolean = false;
  private watchedChannels: Set<string> = new Set();
  private config: SlackConfig = {
    botToken: "",
    appToken: "",
  };

  // メッセージ受信コールバック
  private messageCallback: ((message: any) => void) | null = null;
  // 設定保存コールバック
  private configSaveCallback: ((config: SlackConfig) => void) | null = null;
  // 重複メッセージ防止用（最近処理したメッセージのタイムスタンプを保持）
  // private recentMessageTimestamps: Set<string> = new Set();

  // ローカルキャッシュ（現行システムと同等）
  private userCache: { [key: string]: any } = {};
  private customEmojiCache: { [key: string]: any } = {};

  async updateConfig(config: SlackConfig): Promise<void> {
    this.config = { ...this.config, ...config };

    // 保存された監視チャンネルを復元
    if (config.channels && config.channels.length > 0) {
      console.log("🔄 監視チャンネルを復元:", config.channels);
      this.watchedChannels = new Set(config.channels);
    }
  }

  async testConnection(): Promise<SlackConnectionResult> {
    if (!this.config.botToken || !this.config.appToken) {
      return {
        success: false,
        error: "Bot Token と App Token が必要です",
      };
    }

    try {
      console.log("🔍 Slack接続テスト開始...");

      // Bot Tokenのテスト
      const webClient = new WebClient(this.config.botToken);
      const authTest = await webClient.auth.test();

      if (!authTest.ok) {
        return {
          success: false,
          error: `Bot Token認証失敗: ${authTest.error || "不明なエラー"}`,
        };
      }

      console.log("✅ Bot Token認証成功:", authTest.user);

      // App Tokenの形式チェック
      if (!this.config.appToken.startsWith('xapp-')) {
        return {
          success: false,
          error: "App Tokenは 'xapp-' で始まる必要があります",
        };
      }

      // App Tokenのテスト（Socket Mode接続）
      console.log("🔗 Socket Mode接続テスト開始...");
      console.log("🔍 App Token形式確認:", this.config.appToken.substring(0, 10) + "...");

      const socketClient = new SocketModeClient({
        appToken: this.config.appToken,
        logLevel: LogLevel.DEBUG, // 現行実装と同じ
      });

      return new Promise((resolve) => {
        let resolved = false;

        const resolveOnce = (result: SlackConnectionResult) => {
          if (!resolved) {
            resolved = true;
            resolve(result);
          }
        };

        const timeoutId = setTimeout(() => {
          console.log("⏰ Socket Mode接続タイムアウト（30秒）");
          console.log("🔍 考えられる原因:");
          console.log("  1. App TokenにSocket Mode権限が設定されていない");
          console.log("  2. SlackアプリでSocket Modeが有効化されていない");
          console.log("  3. Event Subscriptionsが設定されていない");
          console.log("  4. ネットワーク接続の問題");

          socketClient.disconnect();
          resolveOnce({
            success: false,
            error: "App Token接続タイムアウト（30秒） - Socket Mode設定を確認してください",
          });
        }, 30000); // 30秒に延長

        socketClient.on("ready", () => {
          clearTimeout(timeoutId);
          console.log("✅ App Token認証成功 (ready)");
          socketClient.disconnect();
          resolveOnce({
            success: true,
          });
        });

        socketClient.on("connecting", () => {
          console.log("🔗 Socket Mode接続中...");
        });

        socketClient.on("connected", () => {
          console.log("🔗 Socket Mode接続完了 (connected)");
          // connected イベントでも成功とみなす
          clearTimeout(timeoutId);
          console.log("✅ App Token認証成功 (connected)");
          socketClient.disconnect();
          resolveOnce({
            success: true,
          });
        });

        socketClient.on("disconnect", () => {
          console.log("🔌 Socket Mode切断");
        });

        socketClient.on("error", (error: any) => {
          clearTimeout(timeoutId);
          console.error("❌ App Token認証失敗:", error);
          socketClient.disconnect();
          const errorMessage = error?.message || error?.toString() || "不明なエラー";
          resolveOnce({
            success: false,
            error: `App Token認証失敗: ${errorMessage}`,
          });
        });

        console.log("🚀 Socket Mode開始...");
        socketClient.start().catch((error: any) => {
          clearTimeout(timeoutId);
          console.error("❌ Socket Mode開始エラー:", error);
          const errorMessage = error?.message || error?.toString() || "不明なエラー";
          resolveOnce({
            success: false,
            error: `Socket Mode開始失敗: ${errorMessage}`,
          });
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Slack接続テストエラー:", error);
      return {
        success: false,
        error: `接続テストエラー: ${errorMessage}`,
      };
    }
  }

  async connect(): Promise<SlackConnectionResult> {
    if (!this.config.botToken || !this.config.appToken) {
      return {
        success: false,
        error: "Bot Token と App Token が必要です",
      };
    }

    try {
      // Bot Token認証テスト（基本機能用）
      console.log("🔌 Slack基本接続開始...");
      const webClient = new WebClient(this.config.botToken);
      const authTest = await webClient.auth.test();

      if (!authTest.ok) {
        return {
          success: false,
          error: `Bot Token認証失敗: ${authTest.error || "不明なエラー"}`,
        };
      }

      console.log("✅ Bot Token認証成功 - 基本機能利用可能");
      this.isConnected = true;

      // Socket Mode接続は別途試行（失敗しても基本機能は利用可能）
      try {
        console.log("🔌 Socket Mode接続試行中...");
        this.socketClient = new SocketModeClient({
          appToken: this.config.appToken,
          logLevel: LogLevel.DEBUG, // 現行実装と同じ
        });

        // メッセージ受信イベントハンドラー（slack_eventのみを使用して重複を防止）
        this.socketClient.on("slack_event", (event: any) => {
          console.log("🔔 Slack Event受信:", JSON.stringify(event, null, 2));
          this.handleSlackMessage(event);
        });

        // 注意: messageイベントは低レベルWebSocketメッセージなので使用しない
        // 重複受信防止のため、slack_eventのみを使用

        // 詳細な接続状態イベントを追加（現行実装と同じ）
        this.socketClient.on("ready", () => {
          console.log("🚀 Socket接続準備完了");
        });

        this.socketClient.on("connecting", () => {
          console.log("🔄 Socket接続中...");
        });

        this.socketClient.on("authenticated", () => {
          console.log("🔐 Socket認証完了");
        });

        this.socketClient.on("close", (code: any, reason: any) => {
          console.log("🔌 Socket接続クローズ:", { code, reason });
          this.isConnected = false;
        });

        this.socketClient.on("error", (error: any) => {
          console.error("❌ Socket Mode接続エラー:", error);
        });

        // Socket Mode開始（タイムアウト付き）
        const socketPromise = this.socketClient.start();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Socket Mode接続タイムアウト")), 10000);
        });

        await Promise.race([socketPromise, timeoutPromise]);
        console.log("✅ Socket Mode接続成功 - 全機能利用可能");
        console.log("🔍 Socket Mode接続状況確認:");
        console.log("  - socketClient:", !!this.socketClient);
        console.log("  - isConnected:", this.isConnected);
        console.log("  - 監視チャンネル数:", this.watchedChannels.size);
        console.log("  - 監視チャンネル一覧:", Array.from(this.watchedChannels));

      } catch (socketError: any) {
        console.warn("⚠️ Socket Mode接続失敗（基本機能は利用可能）:", socketError?.message || socketError);
        // Socket Mode失敗しても基本機能は利用可能なのでエラーとしない
      }

      return {
        success: true,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Slack接続エラー:", error);
      this.isConnected = false;
      return {
        success: false,
        error: `接続エラー: ${errorMessage}`,
      };
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.socketClient) {
        await this.socketClient.disconnect();
        this.socketClient = null;
      }
      this.isConnected = false;
      console.log("🔌 Slack切断完了");
    } catch (error) {
      console.error("❌ Slack切断エラー:", error);
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getConfig(): SlackConfig {
    // 機密情報を隠して返す
    return {
      botToken: this.config.botToken ? "***" : "",
      appToken: this.config.appToken ? "***" : "",
    };
  }

  // チャンネル一覧を取得（全ページを取得）
  async getChannelList(): Promise<ChannelListResult> {
    if (!this.config.botToken) {
      return {
        success: false,
        error: "Bot Tokenが設定されていません",
      };
    }

    try {
      const webClient = new WebClient(this.config.botToken);
      let allChannels: SlackChannel[] = [];
      let cursor: string | undefined = undefined;

      do {
        const result = await webClient.conversations.list({
          types: "public_channel,private_channel",
          exclude_archived: true,
          limit: 1000,
          cursor: cursor,
        });

        if (result.channels) {
          const channels = result.channels.map((channel: any) => ({
            id: channel.id,
            name: channel.name,
            is_private: channel.is_private,
            is_member: channel.is_member,
          }));
          allChannels = allChannels.concat(channels);
        }

        cursor = result.response_metadata?.next_cursor;
      } while (cursor);

      console.log(`📋 チャンネル一覧取得完了: ${allChannels.length}チャンネル`);
      return {
        success: true,
        channels: allChannels,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ チャンネル一覧取得エラー:", error);
      return {
        success: false,
        error: `チャンネル一覧取得エラー: ${errorMessage}`,
      };
    }
  }

  // チャンネル情報を取得
  async getChannelInfo(channelId: string): Promise<SlackChannel> {
    if (!this.config.botToken) {
      throw new Error("Bot Tokenが設定されていません");
    }

    try {
      const webClient = new WebClient(this.config.botToken);
      const result = await webClient.conversations.info({
        channel: channelId,
      });

      if (result.channel) {
        return {
          id: result.channel.id!,
          name: result.channel.name!,
          is_private: result.channel.is_private,
          is_member: result.channel.is_member,
        };
      }

      return { id: channelId, name: "unknown" };
    } catch (error) {
      console.error("❌ チャンネル情報取得エラー:", error);
      return { id: channelId, name: "unknown" };
    }
  }

  // 監視するチャンネルを追加
  async addWatchChannel(channelId: string): Promise<ChannelActionResult> {
    try {
      console.log("🔍 チャンネル監視追加:", {
        channelId,
        現在の監視チャンネル: Array.from(this.watchedChannels),
      });

      // チャンネル情報を取得してボットが参加しているかチェック
      const channelInfo = await this.getChannelInfo(channelId);
      console.log("📋 監視対象チャンネル情報:", channelInfo);

      if (!channelInfo.is_member) {
        return {
          success: false,
          error: `チャンネル「${channelInfo.name}」にボットが参加していません`,
        };
      }

      this.watchedChannels.add(channelId);
      console.log("✅ チャンネル監視追加完了:", {
        channelId,
        現在の監視チャンネル: Array.from(this.watchedChannels),
      });

      // 設定を自動保存
      await this.saveChannelSettings();

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ チャンネル監視追加エラー:", error);
      return {
        success: false,
        error: `チャンネル監視追加エラー: ${errorMessage}`,
      };
    }
  }

  // 監視チャンネルを削除
  async removeWatchChannel(channelId: string): Promise<ChannelActionResult> {
    try {
      this.watchedChannels.delete(channelId);
      console.log("✅ チャンネル監視削除完了:", {
        channelId,
        現在の監視チャンネル: Array.from(this.watchedChannels),
      });

      // 設定を自動保存
      await this.saveChannelSettings();

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ チャンネル監視削除エラー:", error);
      return {
        success: false,
        error: `チャンネル監視削除エラー: ${errorMessage}`,
      };
    }
  }

  // 監視中のチャンネル一覧を取得
  getWatchedChannels(): { ids: string[], data: { [key: string]: SlackChannel } } {
    return {
      ids: Array.from(this.watchedChannels),
      data: this.config.watchedChannelData || {}
    };
  }

  // メッセージ受信ハンドラー（監視チャンネルのみフィルタリング）
  private handleSlackMessage(event: any): void {
    try {
      console.log("📨 受信イベント:", JSON.stringify(event, null, 2));
      console.log("🔍 現在の監視チャンネル:", Array.from(this.watchedChannels));

      // メッセージイベントのみ処理
      if (event.type === "events_api") {
        // 現行実装と同じくbodyとpayloadの両方をチェック
        const slackEvent = event.body?.event || event.payload?.event;
        console.log("📋 Slackイベント詳細:", JSON.stringify(slackEvent, null, 2));

        if (slackEvent && slackEvent.type === "message") {
          const message = slackEvent;
          console.log("💬 メッセージイベント詳細:", {
            channel: message.channel,
            user: message.user,
            text: message.text,
            subtype: message.subtype,
            timestamp: message.ts,
          });

          // チャンネルIDが監視対象かチェック
          if (this.watchedChannels.has(message.channel)) {
            console.log("🎯 監視チャンネルのメッセージ受信:", {
              channel: message.channel,
              user: message.user,
              text: message.text,
            });

            // メッセージを透過表示ウィンドウに送信
            this.sendMessageToDisplay(message);
          } else {
            console.log("🔍 非監視チャンネルのメッセージ - スキップ:", {
              receivedChannel: message.channel,
              watchedChannels: Array.from(this.watchedChannels),
            });
          }
        } else {
          console.log("ℹ️ メッセージ以外のイベント:", slackEvent?.type || "不明");
        }

        // Socket ModeのイベントにACKを送信
        if (event.ack) {
          event.ack();
          console.log("✅ ACK送信完了:", event.envelope_id);
        } else if (this.socketClient && event.envelope_id) {
          // ackがないイベントもある（helloなど）
          console.log("📨 イベント処理完了(ACK不要):", event.envelope_id);
        }
      } else {
        console.log("ℹ️ events_api以外のイベント:", event.type);
      }
    } catch (error) {
      console.error("❌ メッセージ処理エラー:", error);
    }
  }

  // メッセージをTextQueueに送信（現行システムと同じ動作）
  private async sendMessageToDisplay(slackMessage: any): Promise<void> {
    try {
      console.log("📤 メッセージ表示処理開始:", slackMessage);

      // ユーザー情報を取得
      const userInfo = await this.getUserInfo(slackMessage.user);
      console.log("👤 ユーザー情報取得結果:", userInfo);

      // SlackMessage型に変換
      const displayMessage = {
        text: slackMessage.text || "（テキストなし）",
        user: userInfo.real_name || userInfo.name || slackMessage.user || "unknown",
        userIcon: userInfo.profile?.image_72 || userInfo.profile?.image_48 || "",
        channel: slackMessage.channel,
        timestamp: slackMessage.ts,
      };

      console.log("📤 TextQueueにメッセージ追加:", displayMessage);

      // 現行システムと同じ動作：TextQueueに追加して3秒間隔で表示
      // これにより、実際のSlackメッセージも3秒間隔で順次表示される
      if (this.messageCallback) {
        // メッセージコールバックを通じてTextQueueに追加要求
        this.messageCallback({
          ...displayMessage,
          _queueAction: 'addToQueue' // TextQueue追加の指示
        });
        console.log("✅ TextQueue追加要求送信完了");
      } else {
        console.error("❌ messageCallbackが設定されていません");
      }
    } catch (error) {
      console.error("❌ 表示メッセージ送信エラー:", error);
    }
  }

  // ユーザー情報を取得（ローカルキャッシュ優先）
  private async getUserInfo(userId: string): Promise<any> {
    if (!userId) {
      return { name: "unknown", profile: {} };
    }

    // まずローカルキャッシュから取得を試行
    const cachedUser = this.getUserInfoFromCache(userId);
    if (cachedUser) {
      return cachedUser;
    }

    // キャッシュにない場合はAPIから取得
    if (!this.config.botToken) {
      return { name: "unknown", profile: {} };
    }

    try {
      console.log(`🌐 APIからユーザー情報取得: ${userId}`);
      const webClient = new WebClient(this.config.botToken);
      const result = await webClient.users.info({ user: userId });

      if (result.user) {
        // 取得したユーザー情報をキャッシュに保存
        this.userCache[userId] = result.user;
        return result.user;
      }

      return { name: "unknown", profile: {} };
    } catch (error) {
      console.error("❌ ユーザー情報取得エラー:", error);
      return { name: "unknown", profile: {} };
    }
  }

  // 設定保存機能
  async saveChannelSettings(): Promise<void> {
    try {
      const channelData: { [key: string]: SlackChannel } = {};

      // 監視中の各チャンネルの詳細情報を取得
      for (const channelId of this.watchedChannels) {
        const channelInfo = await this.getChannelInfo(channelId);
        channelData[channelId] = channelInfo;
      }

      // 設定を更新
      const updatedConfig: SlackConfig = {
        ...this.config,
        channels: Array.from(this.watchedChannels),
        watchedChannelData: channelData,
      };

      console.log("💾 チャンネル設定保存:", {
        channels: updatedConfig.channels,
        channelCount: this.watchedChannels.size,
      });

      // メインプロセスに設定保存を要求
      if (this.configSaveCallback) {
        this.configSaveCallback(updatedConfig);
      }
    } catch (error) {
      console.error("❌ チャンネル設定保存エラー:", error);
    }
  }

  // コールバック設定
  setMessageCallback(callback: (message: any) => void): void {
    this.messageCallback = callback;
  }

  setConfigSaveCallback(callback: (config: SlackConfig) => void): void {
    this.configSaveCallback = callback;
  }

  // カスタム絵文字一覧を取得
  async getCustomEmojis(): Promise<EmojiListResult> {
    if (!this.config.botToken) {
      return {
        success: false,
        error: "Bot Tokenが設定されていません",
      };
    }

    try {
      const webClient = new WebClient(this.config.botToken);
      const result = await webClient.emoji.list();

      if (!result.ok) {
        return {
          success: false,
          error: `絵文字取得エラー: ${result.error || "不明なエラー"}`,
        };
      }

      const emojis: CustomEmoji[] = [];
      if (result.emoji) {
        for (const [name, url] of Object.entries(result.emoji)) {
          if (typeof url === 'string' && url.startsWith('http')) {
            emojis.push({ name, url });
          }
        }
      }

      console.log(`📙 カスタム絵文字取得完了: ${emojis.length}個`);
      return {
        success: true,
        emojis,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ カスタム絵文字取得エラー:", error);
      return {
        success: false,
        error: `カスタム絵文字取得エラー: ${errorMessage}`,
      };
    }
  }

  // =====================================
  // ローカルキャッシュ管理メソッド（現行システムと同等）
  // =====================================

  // ローカルユーザーデータを設定（現行 slack-client.js:565-569行と同等）
  setLocalUsersData(usersData: any): void {
    this.userCache = usersData || {};
    console.log(`📁 ローカルユーザーデータを設定: ${Object.keys(this.userCache).length}件`);
  }

  // ローカルカスタム絵文字データを設定（現行 slack-client.js:571-575行と同等）
  setLocalEmojisData(emojisData: any): void {
    this.customEmojiCache = emojisData || {};
    console.log(`📁 ローカルカスタム絵文字データを設定: ${Object.keys(this.customEmojiCache).length}個`);
  }

  // ローカルキャッシュからユーザー情報を取得（パフォーマンス向上）
  private getUserInfoFromCache(userId: string): any | null {
    if (this.userCache[userId]) {
      console.log(`📋 キャッシュからユーザー情報取得: ${userId}`);
      return this.userCache[userId];
    }
    return null;
  }

  // ローカルキャッシュからカスタム絵文字を取得
  getCustomEmojiFromCache(emojiName: string): string | null {
    if (this.customEmojiCache[emojiName]) {
      return this.customEmojiCache[emojiName];
    }
    return null;
  }

  // キャッシュ状態の取得
  getCacheStatus(): { users: number, emojis: number } {
    return {
      users: Object.keys(this.userCache).length,
      emojis: Object.keys(this.customEmojiCache).length
    };
  }

  // ユーザー一覧を一括取得（現行 slack-client.js:492-518行と同等）
  async fetchAllUsers(saveToLocal: boolean = true): Promise<{ success: boolean, count?: number, users?: any, error?: string }> {
    if (!this.config.botToken) {
      return {
        success: false,
        error: "Bot Tokenが設定されていません",
      };
    }

    try {
      console.log("📥 ユーザー一覧を一括取得開始...");
      const webClient = new WebClient(this.config.botToken);
      const result = await webClient.users.list({});

      if (result.members && Array.isArray(result.members)) {
        // キャッシュに保存
        this.userCache = {};
        result.members.forEach((user: any) => {
          if (user.id && user.profile) {
            this.userCache[user.id] = user;
          }
        });

        const userCount = Object.keys(this.userCache).length;
        console.log(`✅ ユーザー情報を一括取得: ${userCount}件`);

        // ローカルファイルに保存（現行システムと同じ動作）
        if (saveToLocal) {
          console.log("💾 ユーザーデータをローカルファイルに保存要求");
          // この後の保存処理は呼び出し元(main.ts)で行う
        }

        return {
          success: true,
          count: userCount,
          users: this.userCache, // 取得したデータを返す
        };
      } else {
        console.warn("⚠️ ユーザー情報が取得できませんでした");
        return {
          success: false,
          error: "ユーザー情報が取得できませんでした"
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ ユーザー一覧取得エラー:", error);
      return {
        success: false,
        error: `ユーザー一覧取得エラー: ${errorMessage}`,
      };
    }
  }

  // ユーザー数を取得
  getUsersCount(): number {
    return Object.keys(this.userCache).length;
  }

  // ユーザーキャッシュを取得（ローカル保存用）
  getUserCache(): any {
    return this.userCache;
  }
}
