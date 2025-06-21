import { SlackMessage } from './types';

export interface QueueItem {
  id: number;
  text: string;
  user?: string;
  userIcon?: string;
  timestamp: string;
  type: 'slack' | 'text';
}

export interface DisplaySettings {
  fontSize: number;
  bgColor: string;
  bgAlpha: number;
  fontColor: string;
}

export class TextQueue {
  private queue: QueueItem[] = [];
  private currentIndex: number = -1;
  private currentTimer: NodeJS.Timeout | null = null;
  private isPlaying: boolean = false;
  private maxQueueSize: number = 50; // TypeScript版で追加：キューサイズ制限

  // 表示設定
  private displaySettings: DisplaySettings = {
    fontSize: 20,
    bgColor: "#000000", 
    bgAlpha: 0.5,
    fontColor: "#ffffff"
  };

  private readonly DEFAULT_SETTINGS: DisplaySettings = {
    fontSize: 20,
    bgColor: "#000000",
    bgAlpha: 0.5, 
    fontColor: "#ffffff"
  };

  // コールバック関数
  private onMessageSend: ((message: SlackMessage) => void) | null = null;
  private onUIUpdate: ((queue: QueueItem[], currentIndex: number, isPlaying: boolean) => void) | null = null;

  constructor() {
    this.loadDisplaySettings();
    this.updateUI();
  }

  // コールバック設定
  setMessageCallback(callback: (message: SlackMessage) => void): void {
    this.onMessageSend = callback;
  }

  setUIUpdateCallback(callback: (queue: QueueItem[], currentIndex: number, isPlaying: boolean) => void): void {
    this.onUIUpdate = callback;
  }

  // 表示設定の読み込み（localStorage）
  private loadDisplaySettings(): void {
    try {
      const saved = localStorage.getItem('waigayaDisplaySettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.displaySettings = { ...this.DEFAULT_SETTINGS, ...parsed };
        console.log('📁 表示設定を読み込みました:', this.displaySettings);
      } else {
        console.log('📁 デフォルト表示設定を使用');
      }
    } catch (error) {
      console.error('❌ 表示設定読み込みエラー:', error);
      this.displaySettings = { ...this.DEFAULT_SETTINGS };
    }
  }

  // 表示設定の保存（localStorage）
  private saveDisplaySettings(): void {
    try {
      localStorage.setItem('waigayaDisplaySettings', JSON.stringify(this.displaySettings));
      console.log('💾 表示設定を保存しました:', this.displaySettings);
    } catch (error) {
      console.error('❌ 表示設定保存エラー:', error);
    }
  }

  // 表示設定をデフォルトに戻す
  resetDisplaySettings(): void {
    this.displaySettings = { ...this.DEFAULT_SETTINGS };
    this.saveDisplaySettings();
    this.updateUI();
    console.log('🔄 表示設定をリセットしました');
  }

  // Slackメッセージをキューに追加（現行実装と同じ）
  addSlackMessage(messageData: SlackMessage): void {
    if (messageData.text && messageData.text.trim()) {
      const queueItem: QueueItem = {
        id: Date.now(),
        text: messageData.text.trim(),
        user: messageData.user,
        userIcon: messageData.userIcon,
        timestamp: new Date().toLocaleTimeString(),
        type: 'slack'
      };

      // キューサイズ制限（TypeScript版で追加）
      if (this.queue.length >= this.maxQueueSize) {
        this.queue.shift(); // 古いメッセージを削除
        if (this.currentIndex > 0) {
          this.currentIndex--;
        }
        console.log(`📦 キューサイズ制限により古いメッセージを削除（最大${this.maxQueueSize}件）`);
      }

      this.queue.push(queueItem);
      this.updateUI();

      // 既存タイマーをクリア
      if (this.currentTimer) {
        clearTimeout(this.currentTimer);
        this.currentTimer = null;
      }

      // 新しいメッセージを即座に表示
      this.currentIndex = this.queue.length - 1;
      this.playNext();

      console.log('📝 Slackメッセージをキューに追加:', {
        id: queueItem.id,
        text: queueItem.text.substring(0, 50),
        user: queueItem.user,
        queueLength: this.queue.length
      });
    }
  }

  // プレーンテキストをキューに追加
  addTextMessage(text: string): void {
    if (text && text.trim()) {
      const queueItem: QueueItem = {
        id: Date.now(),
        text: text.trim(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'text'
      };

      // キューサイズ制限
      if (this.queue.length >= this.maxQueueSize) {
        this.queue.shift();
        if (this.currentIndex > 0) {
          this.currentIndex--;
        }
      }

      this.queue.push(queueItem);
      this.updateUI();

      // 既存タイマーをクリア
      if (this.currentTimer) {
        clearTimeout(this.currentTimer);
        this.currentTimer = null;
      }

      // 新しいメッセージを即座に表示
      this.currentIndex = this.queue.length - 1;
      this.playNext();

      console.log('📝 テキストメッセージをキューに追加:', {
        id: queueItem.id,
        text: queueItem.text.substring(0, 50),
        queueLength: this.queue.length
      });
    }
  }

  // キューの再生開始
  startQueue(): void {
    if (this.queue.length === 0) {
      console.log('📭 キューが空のため再生できません');
      return;
    }

    if (this.currentIndex === -1) {
      this.currentIndex = 0;
    }

    this.isPlaying = true;
    this.playNext();
    console.log('▶️ キュー再生開始');
  }

  // 次のメッセージを再生（現行実装と同じ3秒間隔）
  private playNext(): void {
    if (this.currentIndex >= this.queue.length) {
      // 末尾まで再生したら停止
      this.isPlaying = false;
      this.currentTimer = null;
      this.updateUI();
      console.log('⏹️ キュー再生完了');
      return;
    }

    const currentItem = this.queue[this.currentIndex];
    
    if (currentItem.type === 'slack') {
      // Slackメッセージとして表示
      this.sendToDisplay(currentItem.text, {
        user: currentItem.user || 'unknown',
        userIcon: currentItem.userIcon || '',
        text: currentItem.text,
        type: 'slack'
      });
    } else {
      // プレーンテキストとして表示
      this.sendToDisplay(currentItem.text);
    }

    this.updateUI();

    // 3秒後に次のメッセージへ（現行実装と同じ）
    this.currentTimer = setTimeout(() => {
      this.currentIndex++;
      this.playNext();
    }, 3000);

    console.log('📺 メッセージ表示:', {
      index: this.currentIndex + 1,
      total: this.queue.length,
      type: currentItem.type,
      text: currentItem.text.substring(0, 50)
    });
  }

  // 表示ウィンドウにメッセージ送信（IPC経由）
  private sendToDisplay(text: string, metadata?: any): void {
    try {
      if (this.onMessageSend) {
        if (metadata) {
          // Slackメッセージとして送信
          this.onMessageSend({
            text: text,
            user: metadata.user,
            userIcon: metadata.userIcon
          });
        } else {
          // プレーンテキストとして送信
          this.onMessageSend({
            text: text,
            user: 'System',
            userIcon: ''
          });
        }
      } else {
        console.warn('⚠️ メッセージ送信コールバックが設定されていません');
      }
    } catch (error) {
      console.error('❌ メッセージ送信エラー:', error);
    }
  }

  // UI更新
  private updateUI(): void {
    if (this.onUIUpdate) {
      this.onUIUpdate(this.queue, this.currentIndex, this.isPlaying);
    }
  }

  // キュー制御メソッド（TypeScript版で追加）
  pause(): void {
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
    this.isPlaying = false;
    this.updateUI();
    console.log('⏸️ キュー一時停止');
  }

  resume(): void {
    if (!this.isPlaying && this.currentIndex < this.queue.length) {
      this.isPlaying = true;
      this.playNext();
      console.log('▶️ キュー再開');
    }
  }

  stop(): void {
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
    this.isPlaying = false;
    this.currentIndex = -1;
    this.updateUI();
    console.log('⏹️ キュー停止');
  }

  clear(): void {
    this.stop();
    this.queue = [];
    this.updateUI();
    console.log('🗑️ キューをクリア');
  }

  // 設定取得・更新
  getDisplaySettings(): DisplaySettings {
    return { ...this.displaySettings };
  }

  updateDisplaySettings(settings: Partial<DisplaySettings>): void {
    this.displaySettings = { ...this.displaySettings, ...settings };
    this.saveDisplaySettings();
    this.updateUI();
    console.log('🎨 表示設定を更新:', settings);
  }

  // 状態取得
  getStatus(): { 
    queueLength: number; 
    currentIndex: number; 
    isPlaying: boolean; 
    queue: QueueItem[] 
  } {
    return {
      queueLength: this.queue.length,
      currentIndex: this.currentIndex,
      isPlaying: this.isPlaying,
      queue: [...this.queue]
    };
  }
}

// シングルトンインスタンス
export const textQueue = new TextQueue();