import { CustomEmoji } from './types';

export interface EmojiMap {
  [key: string]: string;
}

export interface CustomEmojiMap {
  [key: string]: string; // URL
}

// 標準Slack絵文字マップ（現行 display.js:51-131行から移植）
const SLACK_EMOJI_MAP: EmojiMap = {
  // 基本的な感情表現
  'smile': '😊',
  'laughing': '😆',
  'blush': '😊',
  'smiley': '😃',
  'relaxed': '☺️',
  'smirk': '😏',
  'heart_eyes': '😍',
  'kissing_heart': '😘',
  'kissing_closed_eyes': '😚',
  'flushed': '😳',
  'relieved': '😌',
  'satisfied': '😆',
  'grin': '😁',
  'wink': '😉',
  'stuck_out_tongue_winking_eye': '😜',
  'stuck_out_tongue_closed_eyes': '😝',
  'grinning': '😀',
  'kissing': '😗',
  'kissing_smiling_eyes': '😙',
  'stuck_out_tongue': '😛',
  'sleeping': '😴',
  'worried': '😟',
  'frowning': '😦',
  'anguished': '😧',
  'open_mouth': '😮',
  'grimacing': '😬',
  'confused': '😕',
  'hushed': '😯',
  'expressionless': '😑',
  'unamused': '😒',
  'sweat_smile': '😅',
  'sweat': '😓',
  'disappointed_relieved': '😥',
  'weary': '😩',
  'pensive': '😔',
  'disappointed': '😞',
  'confounded': '😖',
  'fearful': '😨',
  'cold_sweat': '😰',
  'persevere': '😣',
  'cry': '😢',
  'sob': '😭',
  'joy': '😂',
  'astonished': '😲',
  'scream': '😱',
  'tired_face': '😫',
  'angry': '😠',
  'rage': '😡',
  'triumph': '😤',
  'sleepy': '😪',
  'yum': '😋',
  'mask': '😷',
  'sunglasses': '😎',
  'dizzy_face': '😵',
  'imp': '👿',
  'smiling_imp': '😈',
  'neutral_face': '😐',
  'no_mouth': '😶',
  'innocent': '😇',
  'alien': '👽',

  // ジェスチャー・アクション
  '+1': '👍',
  'thumbsup': '👍',
  '-1': '👎',
  'thumbsdown': '👎',
  'ok_hand': '👌',
  'punch': '👊',
  'fist': '✊',
  'v': '✌️',
  'wave': '👋',
  'hand': '✋',
  'raised_hand': '✋',
  'open_hands': '👐',
  'point_up': '☝️',
  'point_down': '👇',
  'point_left': '👈',
  'point_right': '👉',
  'raised_hands': '🙌',
  'pray': '🙏',
  'clap': '👏',
  'muscle': '💪',

  // 心とシンボル
  'heart': '❤️',
  'broken_heart': '💔',
  'two_hearts': '💕',
  'sparkling_heart': '💖',
  'heartpulse': '💗',
  'blue_heart': '💙',
  'green_heart': '💚',
  'yellow_heart': '💛',
  'purple_heart': '💜',
  'gift_heart': '💝',
  'revolving_hearts': '💞',
  'heart_decoration': '💟',
  'diamond_shape_with_a_dot_inside': '💠',
  'bulb': '💡',
  'anger': '💢',
  'bomb': '💣',
  'zzz': '💤',
  'boom': '💥',
  'sweat_drops': '💦',
  'droplet': '💧',
  'dash': '💨',
  'hankey': '💩',
  'poop': '💩',
  'shit': '💩',
  'fire': '🔥',
  'star': '⭐',
  'star2': '🌟'
};

export class EmojiConverter {
  private standardEmojis: EmojiMap;
  private customEmojis: CustomEmojiMap;
  private isLoaded: boolean = false;

  constructor() {
    this.standardEmojis = SLACK_EMOJI_MAP;
    this.customEmojis = {};
  }

  /**
   * カスタム絵文字を読み込み（現行システムと同等）
   */
  async loadCustomEmojis(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.getCustomEmojis();
        if (result.success && result.emojis) {
          // CustomEmoji[]をCustomEmojiMapに変換
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
        if (window.electronAPI.onCustomEmojisData) {
          window.electronAPI.onCustomEmojisData((data: CustomEmojiMap) => {
            this.updateCustomEmojis(data);
          });
        }
      }
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
    console.log(`🎨 カスタム絵文字キャッシュ更新: ${Object.keys(this.customEmojis).length}個`);
  }

  /**
   * テキストにカスタム絵文字（HTMLタグ）が含まれているかチェック
   * 現行 display.js:272-276行と同等
   */
  hasCustomEmojis(text: string): boolean {
    return text.includes('<img') && text.includes('custom-emoji');
  }

  /**
   * React用の絵文字変換（dangerouslySetInnerHTML用）
   */
  convertEmojisToReact(text: string): string {
    return this.convertSlackEmojis(text);
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
