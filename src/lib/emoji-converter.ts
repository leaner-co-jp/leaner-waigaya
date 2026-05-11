import { CustomEmoji } from './types';
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
        // カスタム絵文字はイメージタグで表示（透過PNGでも見やすいよう背景を白に）
        emoji = `<img src="${customEmojiUrl}" alt=":${emojiName}:" class="custom-emoji" style="width: 1.2em; height: 1.2em; vertical-align: middle; display: inline-block; background-color: #ffffff; border-radius: 2px; object-fit: contain;" />`;
      }

      // Unicode 絵文字は img 以外の文字列 — 表示域に白背景を敷く
      if (emoji && !emoji.startsWith("<")) {
        emoji = `<span class="slack-unicode-emoji" style="background-color: #ffffff; display: inline-block; vertical-align: middle; line-height: 1; border-radius: 2px;">${emoji}</span>`;
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
