import { CustomEmoji } from './types';
import { tauriAPI } from './tauri-api';
import { gemoji } from 'gemoji';

export interface EmojiMap {
  [key: string]: string;
}

export interface CustomEmojiMap {
  [key: string]: string; // URL
}

// gemoji（GitHub管理）から標準絵文字マップを構築
const STANDARD_EMOJI_MAP: EmojiMap = {};
for (const entry of gemoji) {
  for (const name of entry.names) {
    STANDARD_EMOJI_MAP[name] = entry.emoji;
  }
}

export class EmojiConverter {
  private standardEmojis: EmojiMap;
  private customEmojis: CustomEmojiMap;
  private isLoaded: boolean = false;

  constructor() {
    this.standardEmojis = STANDARD_EMOJI_MAP;
    this.customEmojis = {};
  }

  /**
   * カスタム絵文字を読み込み（現行システムと同等）
   */
  async loadCustomEmojis(): Promise<void> {
    try {
      const result = await tauriAPI.getCustomEmojis();
      if (result.success && result.emojis) {
        this.customEmojis = {};
        result.emojis.forEach(emoji => {
          this.customEmojis[emoji.name] = emoji.url;
        });
        this.isLoaded = true;
        console.log(`📙 カスタム絵文字読み込み完了: ${Object.keys(this.customEmojis).length}個`);
      } else {
        console.warn('⚠️ カスタム絵文字の読み込みに失敗:', result.error);
      }

      // IPCでカスタム絵文字データを受信するリスナーも設定
      tauriAPI.onCustomEmojisData((data: CustomEmojiMap) => {
        this.updateCustomEmojis(data);
      });
    } catch (error) {
      console.error('❌ カスタム絵文字読み込みエラー:', error);
    }
  }

  /**
   * Slackの絵文字表記をUnicode絵文字やHTMLイメージに変換
   * 現行 display.js:295-312行と同等の動作
   */
  convertSlackEmojis(text: string): string {
    if (!text) return text;

    // :emoji_name: 形式の絵文字を検索・変換
    // 日本語などのマルチバイト文字に対応
    return text.replace(/:([^:\s]+):/g, (match, emojiName) => {
      // まず標準絵文字マップをチェック
      let emoji = this.standardEmojis[emojiName];

      // 標準絵文字にない場合はカスタム絵文字をチェック
      if (!emoji && this.customEmojis[emojiName]) {
        const customEmojiUrl = this.customEmojis[emojiName];
        // カスタム絵文字はイメージタグで表示
        emoji = `<img src="${customEmojiUrl}" alt=":${emojiName}:" class="custom-emoji" style="width: 1.2em; height: 1.2em; vertical-align: middle; display: inline-block;" />`;
      }

      return emoji || match; // 見つからない場合は元のまま
    });
  }

  /**
   * カスタム絵文字キャッシュを更新
   */
  updateCustomEmojis(customEmojis: CustomEmojiMap): void {
    this.customEmojis = { ...customEmojis };
    this.isLoaded = true;
    console.log(`🎨 カスタム絵文字をローカルデータから反映: ${Object.keys(this.customEmojis).length}個`);
  }

  /**
   * テキストにカスタム絵文字（HTMLタグ）が含まれているかチェック
   * 現行 display.js:272-276行と同等
   */
  hasCustomEmojis(text: string): boolean {
    return text.includes('<img') && text.includes('custom-emoji');
  }

  /**
   * Slackのmrkdwn記法をHTMLに変換
   */
  convertMrkdwn(text: string): string {
    if (!text) return text;

    // コードブロック ```...``` を先に処理（内部のマークアップを無視するため）
    text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

    // インラインコード `...`
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 太字 *...*
    text = text.replace(/(?<!\w)\*([^\*]+)\*(?!\w)/g, '<strong>$1</strong>');

    // イタリック _..._
    text = text.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');

    // 取り消し線 ~...~
    text = text.replace(/(?<!\w)~([^~]+)~(?!\w)/g, '<del>$1</del>');

    // 改行
    text = text.replace(/\n/g, '<br>');

    return text;
  }

  /**
   * React用のテキスト変換（絵文字+mrkdwn、dangerouslySetInnerHTML用）
   * 注: 入力はSlack APIからのテキストでユーザー直接入力ではない
   */
  convertEmojisToReact(text: string): string {
    let result = this.convertSlackEmojis(text);
    result = this.convertMrkdwn(result);
    return result;
  }

  /**
   * キャッシュ状態を取得
   */
  getCacheStatus(): { standardCount: number, customCount: number } {
    return {
      standardCount: Object.keys(this.standardEmojis).length,
      customCount: Object.keys(this.customEmojis).length
    };
  }

  // 後方互換性のため既存メソッドも保持
  convertEmojis(text: string): string {
    return this.convertSlackEmojis(text);
  }

  getEmojiList(): CustomEmoji[] {
    return Object.entries(this.customEmojis).map(([name, url]) => ({
      name,
      url,
    }));
  }

  getEmojiUrl(name: string): string | undefined {
    return this.customEmojis[name];
  }

  isEmojiLoaded(): boolean {
    return this.isLoaded || Object.keys(this.customEmojis).length > 0;
  }
}

// グローバルインスタンス
export const emojiConverter = new EmojiConverter();
