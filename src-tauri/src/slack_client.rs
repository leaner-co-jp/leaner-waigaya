use base64::Engine as _;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;
use tokio::sync::RwLock;

// === 型定義 (TypeScript types.ts に対応) ===

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SlackConfig {
    #[serde(default)]
    pub bot_token: String,
    #[serde(default)]
    pub app_token: String,
    #[serde(default)]
    pub channels: Vec<String>,
    #[serde(default)]
    pub watched_channel_data: HashMap<String, SlackChannel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackChannel {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub is_private: Option<bool>,
    #[serde(default)]
    pub is_member: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackMessage {
    pub text: String,
    pub user: String,
    #[serde(rename = "userIcon")]
    pub user_icon: String,
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(default)]
    pub timestamp: Option<String>,
    #[serde(rename = "_queueAction", default)]
    pub queue_action: Option<String>,
    #[serde(rename = "threadTs", default)]
    pub thread_ts: Option<String>,
    #[serde(rename = "replyToUser", default)]
    pub reply_to_user: Option<String>,
    #[serde(rename = "replyToText", default)]
    pub reply_to_text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<ImageData>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageData {
    #[serde(rename = "dataUrl")]
    pub data_url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SlackFileObject {
    #[allow(dead_code)]
    id: Option<String>,
    mimetype: Option<String>,
    url_private_download: Option<String>,
    url_private: Option<String>,
    thumb_480: Option<String>,
    thumb_360: Option<String>,
    #[allow(dead_code)]
    name: Option<String>,
    #[allow(dead_code)]
    filetype: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SlackConnectionResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelListResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channels: Option<Vec<SlackChannel>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChannelActionResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomEmoji {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmojiListResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub emojis: Option<Vec<CustomEmoji>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchedChannelsResult {
    pub ids: Vec<String>,
    pub data: HashMap<String, SlackChannel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStatus {
    pub users: usize,
    pub emojis: usize,
}

// === Slack API レスポンス型 ===

#[derive(Debug, Deserialize)]
struct AuthTestResponse {
    ok: bool,
    #[serde(default)]
    user: Option<String>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ConversationsListResponse {
    ok: bool,
    #[serde(default)]
    channels: Vec<ConversationChannel>,
    #[serde(default)]
    response_metadata: Option<ResponseMetadata>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ConversationChannel {
    id: String,
    name: String,
    #[serde(default)]
    is_private: bool,
    #[serde(default)]
    is_member: bool,
}

#[derive(Debug, Deserialize)]
struct ConversationsInfoResponse {
    #[allow(dead_code)]
    ok: bool,
    #[serde(default)]
    channel: Option<ConversationChannel>,
}

#[derive(Debug, Deserialize)]
struct ResponseMetadata {
    #[serde(default)]
    next_cursor: String,
}

#[derive(Debug, Deserialize)]
struct UsersListResponse {
    ok: bool,
    #[serde(default)]
    members: Vec<serde_json::Value>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsersInfoResponse {
    #[allow(dead_code)]
    ok: bool,
    #[serde(default)]
    user: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct EmojiListResponse {
    ok: bool,
    #[serde(default)]
    emoji: HashMap<String, String>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ConversationsRepliesResponse {
    ok: bool,
    #[serde(default)]
    messages: Vec<ReplyMessage>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ReplyMessage {
    #[serde(default)]
    text: Option<String>,
    #[serde(default)]
    user: Option<String>,
}

// === Socket Mode 関連型 ===

#[derive(Debug, Deserialize)]
struct AppsConnectionsOpenResponse {
    ok: bool,
    url: Option<String>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SocketModeMessage {
    #[serde(rename = "type")]
    msg_type: Option<String>,
    envelope_id: Option<String>,
    payload: Option<SocketModePayload>,
}

#[derive(Debug, Deserialize)]
struct SocketModePayload {
    event: Option<SlackEvent>,
}

#[derive(Debug, Deserialize)]
struct SlackEvent {
    #[serde(rename = "type")]
    event_type: Option<String>,
    channel: Option<String>,
    user: Option<String>,
    text: Option<String>,
    ts: Option<String>,
    thread_ts: Option<String>,
    #[allow(dead_code)]
    #[serde(default)]
    parent_user_id: Option<String>,
    #[serde(default)]
    files: Option<Vec<SlackFileObject>>,
    #[serde(default)]
    reaction: Option<String>,
    #[serde(default)]
    item: Option<SlackReactionItem>,
}

#[derive(Debug, Deserialize)]
struct SlackReactionItem {
    #[serde(rename = "type")]
    #[allow(dead_code)]
    item_type: Option<String>,
    channel: Option<String>,
    ts: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct SlackReactionEvent {
    action: String,
    reaction: String,
    user: String,
    channel: String,
    message_ts: String,
}

// === SlackClient 本体 ===

pub struct SlackClientState {
    inner: Arc<RwLock<SlackClientInner>>,
}

struct SlackClientInner {
    config: SlackConfig,
    is_connected: bool,
    watched_channels: std::collections::HashSet<String>,
    user_cache: HashMap<String, serde_json::Value>,
    custom_emoji_cache: HashMap<String, String>,
    current_channel_name: String,
    /// Socket Mode WebSocket 接続のキャンセルトークン
    socket_cancel: Option<tokio::sync::watch::Sender<bool>>,
}

impl SlackClientState {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(SlackClientInner {
                config: SlackConfig::default(),
                is_connected: false,
                watched_channels: std::collections::HashSet::new(),
                user_cache: HashMap::new(),
                custom_emoji_cache: HashMap::new(),
                current_channel_name: "waigaya".to_string(),
                socket_cancel: None,
            })),
        }
    }

    // --- 設定管理 ---

    pub async fn update_config(&self, config: SlackConfig) {
        let mut inner = self.inner.write().await;
        if !config.channels.is_empty() {
            log::info!("監視チャンネルを復元: {:?}", config.channels);
            inner.watched_channels = config.channels.iter().cloned().collect();
        }
        inner.config = SlackConfig {
            bot_token: if config.bot_token.is_empty() {
                inner.config.bot_token.clone()
            } else {
                config.bot_token
            },
            app_token: if config.app_token.is_empty() {
                inner.config.app_token.clone()
            } else {
                config.app_token
            },
            channels: if config.channels.is_empty() {
                inner.config.channels.clone()
            } else {
                config.channels
            },
            watched_channel_data: if config.watched_channel_data.is_empty() {
                inner.config.watched_channel_data.clone()
            } else {
                config.watched_channel_data
            },
        };
    }

    pub async fn get_current_channel_name(&self) -> String {
        self.inner.read().await.current_channel_name.clone()
    }

    // --- 接続管理 ---

    pub async fn test_connection(&self) -> SlackConnectionResult {
        let inner = self.inner.read().await;
        let bot_token = inner.config.bot_token.clone();
        let app_token = inner.config.app_token.clone();
        drop(inner);

        if bot_token.is_empty() || app_token.is_empty() {
            return SlackConnectionResult {
                success: false,
                error: Some("Bot Token と App Token が必要です".to_string()),
            };
        }

        // Bot Token テスト
        match self.auth_test(&bot_token).await {
            Ok(resp) => {
                if !resp.ok {
                    return SlackConnectionResult {
                        success: false,
                        error: Some(format!("Bot Token認証失敗: {}", resp.error.unwrap_or_default())),
                    };
                }
                log::info!("Bot Token認証成功: {:?}", resp.user);
            }
            Err(e) => {
                return SlackConnectionResult {
                    success: false,
                    error: Some(format!("Bot Token認証エラー: {}", e)),
                };
            }
        }

        // App Token 形式チェック
        if !app_token.starts_with("xapp-") {
            return SlackConnectionResult {
                success: false,
                error: Some("App Tokenは 'xapp-' で始まる必要があります".to_string()),
            };
        }

        // Socket Mode 接続テスト
        match self.test_socket_mode(&app_token).await {
            Ok(_) => SlackConnectionResult {
                success: true,
                error: None,
            },
            Err(e) => SlackConnectionResult {
                success: false,
                error: Some(format!("Socket Mode接続テスト失敗: {}", e)),
            },
        }
    }

    pub async fn connect(&self, app_handle: tauri::AppHandle) -> SlackConnectionResult {
        let inner = self.inner.read().await;
        let bot_token = inner.config.bot_token.clone();
        let app_token = inner.config.app_token.clone();
        drop(inner);

        if bot_token.is_empty() || app_token.is_empty() {
            return SlackConnectionResult {
                success: false,
                error: Some("Bot Token と App Token が必要です".to_string()),
            };
        }

        // Bot Token 認証テスト
        match self.auth_test(&bot_token).await {
            Ok(resp) => {
                if !resp.ok {
                    return SlackConnectionResult {
                        success: false,
                        error: Some(format!("Bot Token認証失敗: {}", resp.error.unwrap_or_default())),
                    };
                }
                log::info!("Bot Token認証成功");
                self.inner.write().await.is_connected = true;
            }
            Err(e) => {
                return SlackConnectionResult {
                    success: false,
                    error: Some(format!("接続エラー: {}", e)),
                };
            }
        }

        // Socket Mode 接続を非同期で開始
        let inner_clone = self.inner.clone();
        let app_handle_clone = app_handle.clone();
        let app_token_clone = app_token.clone();
        let bot_token_clone = bot_token.clone();

        // 既存のSocket接続をキャンセル
        {
            let mut inner = self.inner.write().await;
            if let Some(cancel) = inner.socket_cancel.take() {
                let _ = cancel.send(true);
            }
        }

        let (cancel_tx, cancel_rx) = tokio::sync::watch::channel(false);
        self.inner.write().await.socket_cancel = Some(cancel_tx);

        tokio::spawn(async move {
            if let Err(e) = Self::run_socket_mode(
                inner_clone,
                app_handle_clone,
                app_token_clone,
                bot_token_clone,
                cancel_rx,
            ).await {
                log::warn!("Socket Mode接続失敗（基本機能は利用可能）: {}", e);
            }
        });

        SlackConnectionResult {
            success: true,
            error: None,
        }
    }

    pub async fn disconnect(&self) {
        let mut inner = self.inner.write().await;
        if let Some(cancel) = inner.socket_cancel.take() {
            let _ = cancel.send(true);
        }
        inner.is_connected = false;
        log::info!("Slack切断完了");
    }

    // --- Slack Web API ---

    async fn auth_test(&self, token: &str) -> Result<AuthTestResponse, String> {
        let client = reqwest::Client::new();
        let resp = client
            .post("https://slack.com/api/auth.test")
            .bearer_auth(token)
            .send()
            .await
            .map_err(|e| format!("HTTP通信エラー: {}", e))?;

        resp.json::<AuthTestResponse>()
            .await
            .map_err(|e| format!("レスポンス解析エラー: {}", e))
    }

    async fn test_socket_mode(&self, app_token: &str) -> Result<(), String> {
        let client = reqwest::Client::new();
        let resp = client
            .post("https://slack.com/api/apps.connections.open")
            .bearer_auth(app_token)
            .send()
            .await
            .map_err(|e| format!("HTTP通信エラー: {}", e))?;

        let result: AppsConnectionsOpenResponse = resp
            .json()
            .await
            .map_err(|e| format!("レスポンス解析エラー: {}", e))?;

        if result.ok {
            log::info!("Socket Mode接続テスト成功");
            Ok(())
        } else {
            Err(format!("Socket Mode接続失敗: {}", result.error.unwrap_or_default()))
        }
    }

    pub async fn get_channel_list(&self) -> ChannelListResult {
        let inner = self.inner.read().await;
        let bot_token = inner.config.bot_token.clone();
        drop(inner);

        if bot_token.is_empty() {
            return ChannelListResult {
                success: false,
                channels: None,
                error: Some("Bot Tokenが設定されていません".to_string()),
            };
        }

        let client = reqwest::Client::new();
        let mut all_channels = Vec::new();
        let mut cursor = String::new();

        loop {
            let mut params = vec![
                ("types", "public_channel,private_channel"),
                ("exclude_archived", "true"),
                ("limit", "1000"),
            ];
            if !cursor.is_empty() {
                params.push(("cursor", &cursor));
            }

            let resp = match client
                .get("https://slack.com/api/conversations.list")
                .bearer_auth(&bot_token)
                .query(&params)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => {
                    return ChannelListResult {
                        success: false,
                        channels: None,
                        error: Some(format!("チャンネル一覧取得エラー: {}", e)),
                    };
                }
            };

            let result: ConversationsListResponse = match resp.json().await {
                Ok(r) => r,
                Err(e) => {
                    return ChannelListResult {
                        success: false,
                        channels: None,
                        error: Some(format!("レスポンス解析エラー: {}", e)),
                    };
                }
            };

            if !result.ok {
                return ChannelListResult {
                    success: false,
                    channels: None,
                    error: Some(format!("APIエラー: {}", result.error.unwrap_or_default())),
                };
            }

            for ch in result.channels {
                all_channels.push(SlackChannel {
                    id: ch.id,
                    name: ch.name,
                    is_private: Some(ch.is_private),
                    is_member: Some(ch.is_member),
                });
            }

            match result.response_metadata {
                Some(meta) if !meta.next_cursor.is_empty() => {
                    cursor = meta.next_cursor;
                }
                _ => break,
            }
        }

        log::info!("チャンネル一覧取得完了: {}チャンネル", all_channels.len());
        ChannelListResult {
            success: true,
            channels: Some(all_channels),
            error: None,
        }
    }

    pub async fn get_channel_info(&self, channel_id: &str) -> SlackChannel {
        let inner = self.inner.read().await;
        let bot_token = inner.config.bot_token.clone();
        drop(inner);

        if bot_token.is_empty() {
            return SlackChannel {
                id: channel_id.to_string(),
                name: "unknown".to_string(),
                is_private: None,
                is_member: None,
            };
        }

        let client = reqwest::Client::new();
        let resp = client
            .get("https://slack.com/api/conversations.info")
            .bearer_auth(&bot_token)
            .query(&[("channel", channel_id)])
            .send()
            .await;

        match resp {
            Ok(r) => {
                if let Ok(result) = r.json::<ConversationsInfoResponse>().await {
                    if let Some(ch) = result.channel {
                        return SlackChannel {
                            id: ch.id,
                            name: ch.name,
                            is_private: Some(ch.is_private),
                            is_member: Some(ch.is_member),
                        };
                    }
                }
            }
            Err(e) => {
                log::error!("チャンネル情報取得エラー: {}", e);
            }
        }

        SlackChannel {
            id: channel_id.to_string(),
            name: "unknown".to_string(),
            is_private: None,
            is_member: None,
        }
    }

    pub async fn add_watch_channel(&self, channel_id: &str, storage: &crate::storage::StorageState) -> ChannelActionResult {
        log::info!("add_watch_channel 開始: {}", channel_id);
        {
            let inner = self.inner.read().await;
            log::info!("現在の監視チャンネル: {:?}", inner.watched_channels);
            if inner.watched_channels.contains(channel_id) {
                log::warn!("チャンネルは既に監視されています: {}", channel_id);
                return ChannelActionResult {
                    success: false,
                    error: Some("指定されたチャンネルは既に監視されています".to_string()),
                    message: None,
                };
            }
        }

        log::info!("チャンネル情報を取得中: {}", channel_id);
        let channel_info = self.get_channel_info(channel_id).await;
        log::info!("チャンネル情報: name={}, is_member={:?}", channel_info.name, channel_info.is_member);
        if channel_info.is_member == Some(false) {
            log::warn!("ボットがチャンネルに参加していません: {}", channel_info.name);
            return ChannelActionResult {
                success: false,
                error: Some(format!("チャンネル「{}」にボットが参加していません", channel_info.name)),
                message: None,
            };
        }

        {
            let mut inner = self.inner.write().await;
            inner.watched_channels.insert(channel_id.to_string());
            inner.config.channels = inner.watched_channels.iter().cloned().collect();
            inner.config.watched_channel_data.insert(channel_id.to_string(), channel_info.clone());

            // 最初のチャンネルならチャンネル名を更新
            if inner.watched_channels.len() == 1 {
                inner.current_channel_name = channel_info.name.clone();
            }
        }

        log::info!("チャンネル監視追加完了: {}", channel_id);

        // 設定を自動保存
        self.save_channel_settings(storage).await;

        ChannelActionResult {
            success: true,
            error: None,
            message: Some(format!("#{} を監視対象に追加しました", channel_info.name)),
        }
    }

    pub async fn remove_watch_channel(&self, channel_id: &str, storage: &crate::storage::StorageState) -> ChannelActionResult {
        log::info!("チャンネル監視削除リクエスト: {}", channel_id);
        let mut inner = self.inner.write().await;
        log::info!("現在の監視チャンネル: {:?}", inner.watched_channels);
        if !inner.watched_channels.remove(channel_id) {
            log::warn!("チャンネルが見つかりません: {}", channel_id);
            return ChannelActionResult {
                success: false,
                error: Some("指定されたチャンネルは監視されていません".to_string()),
                message: None,
            };
        }
        inner.config.channels = inner.watched_channels.iter().cloned().collect();
        inner.config.watched_channel_data.remove(channel_id);

        if inner.watched_channels.is_empty() {
            inner.current_channel_name = "waigaya".to_string();
        }
        drop(inner);

        self.save_channel_settings(storage).await;

        log::info!("チャンネル監視削除完了: {}", channel_id);
        ChannelActionResult {
            success: true,
            error: None,
            message: Some("監視を解除しました".to_string()),
        }
    }

    pub async fn get_watched_channels(&self) -> WatchedChannelsResult {
        let inner = self.inner.read().await;
        WatchedChannelsResult {
            ids: inner.watched_channels.iter().cloned().collect(),
            data: inner.config.watched_channel_data.clone(),
        }
    }

    async fn save_channel_settings(&self, storage: &crate::storage::StorageState) {
        let inner = self.inner.read().await;
        let config = inner.config.clone();
        drop(inner);

        if let Err(e) = storage.save_config(&config) {
            log::error!("チャンネル設定保存失敗: {}", e);
        }
    }

    // --- ユーザー管理 ---

    pub async fn fetch_all_users(&self) -> Result<(usize, serde_json::Value), String> {
        let inner = self.inner.read().await;
        let bot_token = inner.config.bot_token.clone();
        drop(inner);

        if bot_token.is_empty() {
            return Err("Bot Tokenが設定されていません".to_string());
        }

        let client = reqwest::Client::new();
        let resp = client
            .get("https://slack.com/api/users.list")
            .bearer_auth(&bot_token)
            .send()
            .await
            .map_err(|e| format!("ユーザー一覧取得エラー: {}", e))?;

        let result: UsersListResponse = resp
            .json()
            .await
            .map_err(|e| format!("レスポンス解析エラー: {}", e))?;

        if !result.ok {
            return Err(format!("APIエラー: {}", result.error.unwrap_or_default()));
        }

        let mut user_cache = HashMap::new();
        for member in &result.members {
            if let Some(id) = member.get("id").and_then(|v| v.as_str()) {
                if member.get("profile").is_some() {
                    user_cache.insert(id.to_string(), member.clone());
                }
            }
        }

        let count = user_cache.len();
        let users_json = serde_json::to_value(&user_cache)
            .map_err(|e| format!("JSON変換エラー: {}", e))?;

        // キャッシュに保存
        self.inner.write().await.user_cache = user_cache;

        log::info!("ユーザー情報を一括取得: {}件", count);
        Ok((count, users_json))
    }

    #[allow(dead_code)]
    pub async fn get_user_info(&self, user_id: &str) -> serde_json::Value {
        // キャッシュから取得
        {
            let inner = self.inner.read().await;
            if let Some(user) = inner.user_cache.get(user_id) {
                return user.clone();
            }
        }

        // APIから取得
        let inner = self.inner.read().await;
        let bot_token = inner.config.bot_token.clone();
        drop(inner);

        if bot_token.is_empty() {
            return serde_json::json!({"name": "unknown", "profile": {}});
        }

        let client = reqwest::Client::new();
        let resp = client
            .get("https://slack.com/api/users.info")
            .bearer_auth(&bot_token)
            .query(&[("user", user_id)])
            .send()
            .await;

        match resp {
            Ok(r) => {
                if let Ok(result) = r.json::<UsersInfoResponse>().await {
                    if let Some(user) = result.user {
                        // キャッシュに保存
                        self.inner.write().await.user_cache.insert(user_id.to_string(), user.clone());
                        return user;
                    }
                }
            }
            Err(e) => {
                log::error!("ユーザー情報取得エラー: {}", e);
            }
        }

        serde_json::json!({"name": "unknown", "profile": {}})
    }

    pub async fn get_users_count(&self) -> usize {
        self.inner.read().await.user_cache.len()
    }

    // --- 絵文字管理 ---

    pub async fn get_custom_emojis(&self) -> EmojiListResult {
        let inner = self.inner.read().await;
        let bot_token = inner.config.bot_token.clone();
        drop(inner);

        if bot_token.is_empty() {
            return EmojiListResult {
                success: false,
                emojis: None,
                error: Some("Bot Tokenが設定されていません".to_string()),
            };
        }

        let client = reqwest::Client::new();
        let resp = match client
            .get("https://slack.com/api/emoji.list")
            .bearer_auth(&bot_token)
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                return EmojiListResult {
                    success: false,
                    emojis: None,
                    error: Some(format!("絵文字取得エラー: {}", e)),
                };
            }
        };

        let result: EmojiListResponse = match resp.json().await {
            Ok(r) => r,
            Err(e) => {
                return EmojiListResult {
                    success: false,
                    emojis: None,
                    error: Some(format!("レスポンス解析エラー: {}", e)),
                };
            }
        };

        if !result.ok {
            return EmojiListResult {
                success: false,
                emojis: None,
                error: Some(format!("APIエラー: {}", result.error.unwrap_or_default())),
            };
        }

        let mut emojis = Vec::new();
        let mut emoji_cache = HashMap::new();
        for (name, url) in &result.emoji {
            if url.starts_with("http") {
                emojis.push(CustomEmoji {
                    name: name.clone(),
                    url: url.clone(),
                });
                emoji_cache.insert(name.clone(), url.clone());
            }
        }

        // キャッシュに保存
        self.inner.write().await.custom_emoji_cache = emoji_cache;

        log::info!("カスタム絵文字取得完了: {}個", emojis.len());
        EmojiListResult {
            success: true,
            emojis: Some(emojis),
            error: None,
        }
    }

    pub async fn get_emoji_url(&self, name: &str) -> Option<String> {
        self.inner.read().await.custom_emoji_cache.get(name).cloned()
    }

    pub async fn get_cache_status(&self) -> CacheStatus {
        let inner = self.inner.read().await;
        CacheStatus {
            users: inner.user_cache.len(),
            emojis: inner.custom_emoji_cache.len(),
        }
    }

    // --- ローカルデータ管理 ---

    pub async fn set_local_users_data(&self, data: serde_json::Value) {
        if let Some(obj) = data.as_object() {
            let mut inner = self.inner.write().await;
            inner.user_cache.clear();
            for (k, v) in obj {
                inner.user_cache.insert(k.clone(), v.clone());
            }
            log::info!("ローカルユーザーデータを設定: {}件", inner.user_cache.len());
        }
    }

    pub async fn set_local_emojis_data(&self, data: serde_json::Value) {
        if let Some(obj) = data.as_object() {
            let mut inner = self.inner.write().await;
            inner.custom_emoji_cache.clear();
            for (k, v) in obj {
                if let Some(url) = v.as_str() {
                    inner.custom_emoji_cache.insert(k.clone(), url.to_string());
                }
            }
            log::info!("ローカルカスタム絵文字データを設定: {}個", inner.custom_emoji_cache.len());
        }
    }

    // --- Socket Mode ---

    async fn run_socket_mode(
        inner: Arc<RwLock<SlackClientInner>>,
        app_handle: tauri::AppHandle,
        app_token: String,
        bot_token: String,
        mut cancel_rx: tokio::sync::watch::Receiver<bool>,
    ) -> Result<(), String> {
        use futures_util::{SinkExt, StreamExt};
        use tokio_tungstenite::tungstenite::Message;

        log::info!("Socket Mode接続開始...");

        // WebSocket URLを取得
        let client = reqwest::Client::new();
        let resp = client
            .post("https://slack.com/api/apps.connections.open")
            .bearer_auth(&app_token)
            .send()
            .await
            .map_err(|e| format!("HTTP通信エラー: {}", e))?;

        let result: AppsConnectionsOpenResponse = resp
            .json()
            .await
            .map_err(|e| format!("レスポンス解析エラー: {}", e))?;

        if !result.ok {
            return Err(format!("Socket Mode接続失敗: {}", result.error.unwrap_or_default()));
        }

        let ws_url = result.url.ok_or("WebSocket URLが取得できません")?;
        log::info!("Socket Mode WebSocket URL取得成功");

        // WebSocket接続
        let (ws_stream, _) = tokio_tungstenite::connect_async(&ws_url)
            .await
            .map_err(|e| format!("WebSocket接続エラー: {}", e))?;

        log::info!("Socket Mode WebSocket接続成功");

        let (mut write, mut read) = ws_stream.split();

        loop {
            tokio::select! {
                _ = cancel_rx.changed() => {
                    if *cancel_rx.borrow() {
                        log::info!("Socket Mode接続をキャンセル");
                        break;
                    }
                }
                msg = read.next() => {
                    match msg {
                        Some(Ok(Message::Text(text))) => {
                            if let Ok(socket_msg) = serde_json::from_str::<SocketModeMessage>(&text) {
                                // ACK を送信
                                if let Some(ref envelope_id) = socket_msg.envelope_id {
                                    let ack = serde_json::json!({"envelope_id": envelope_id});
                                    if let Err(e) = write.send(Message::Text(ack.to_string().into())).await {
                                        log::error!("ACK送信エラー: {}", e);
                                    }
                                }

                                // events_api のメッセージイベントのみ処理
                                if socket_msg.msg_type.as_deref() == Some("events_api") {
                                    if let Some(payload) = &socket_msg.payload {
                                        if let Some(event) = &payload.event {
                                            if event.event_type.as_deref() == Some("reaction_added") || event.event_type.as_deref() == Some("reaction_removed") {
                                                if let Some(item) = &event.item {
                                                    if let Some(item_channel) = &item.channel {
                                                        let is_watched = {
                                                            inner.read().await.watched_channels.contains(item_channel)
                                                        };

                                                        if is_watched {
                                                            let action = if event.event_type.as_deref() == Some("reaction_added") {
                                                                "added"
                                                            } else {
                                                                "removed"
                                                            };
                                                            let reaction_name = event.reaction.clone().unwrap_or_default();
                                                            let user_id = event.user.clone().unwrap_or_default();
                                                            let user_info = Self::fetch_user_info_static(&bot_token, &user_id, &inner).await;
                                                            let user_name = user_info.get("real_name")
                                                                .or_else(|| user_info.get("name"))
                                                                .and_then(|v| v.as_str())
                                                                .unwrap_or("unknown")
                                                                .to_string();
                                                            let message_ts = item.ts.clone().unwrap_or_default();

                                                            let reaction_event = SlackReactionEvent {
                                                                action: action.to_string(),
                                                                reaction: reaction_name.clone(),
                                                                user: user_name,
                                                                channel: item_channel.clone(),
                                                                message_ts,
                                                            };

                                                            if let Err(e) = app_handle.emit("slack-reaction", &reaction_event) {
                                                                log::error!("リアクションイベント送信エラー: {}", e);
                                                            }
                                                        }
                                                    }
                                                }
                                            } else if event.event_type.as_deref() == Some("message") {
                                                if let Some(channel) = &event.channel {
                                                    let is_watched = {
                                                        inner.read().await.watched_channels.contains(channel)
                                                    };

                                                    if is_watched {
                                                        let user_id = event.user.clone().unwrap_or_default();
                                                        let text = event.text.clone().unwrap_or_default();
                                                        let text = Self::resolve_mentions(&text, &bot_token, &inner).await;
                                                        let ts = event.ts.clone();

                                                        // ユーザー情報を取得
                                                        let user_info = Self::fetch_user_info_static(&bot_token, &user_id, &inner).await;
                                                        let user_name = user_info.get("real_name")
                                                            .or_else(|| user_info.get("name"))
                                                            .and_then(|v| v.as_str())
                                                            .unwrap_or("unknown")
                                                            .to_string();
                                                        let user_icon = user_info.get("profile")
                                                            .and_then(|p| p.get("image_72").or_else(|| p.get("image_48")))
                                                            .and_then(|v| v.as_str())
                                                            .unwrap_or("")
                                                            .to_string();

                                                        // スレッド返信の親メッセージ情報を取得
                                                        let thread_ts = event.thread_ts.clone();
                                                        let (reply_to_user, reply_to_text) = if let Some(ref tts) = thread_ts {
                                                            // thread_ts と ts が同じ場合はスレッドの親メッセージ自体なのでスキップ
                                                            if Some(tts.as_str()) != event.ts.as_deref() {
                                                                if let Some((parent_user_id, parent_text)) = Self::fetch_parent_message_static(&bot_token, channel, tts).await {
                                                                    // 親メッセージのユーザー名を解決
                                                                    let parent_user_info = Self::fetch_user_info_static(&bot_token, &parent_user_id, &inner).await;
                                                                    let parent_user_name = parent_user_info.get("real_name")
                                                                        .or_else(|| parent_user_info.get("name"))
                                                                        .and_then(|v| v.as_str())
                                                                        .unwrap_or("unknown")
                                                                        .to_string();
                                                                    let parent_text = Self::resolve_mentions(&parent_text, &bot_token, &inner).await;
                                                                    (Some(parent_user_name), Some(parent_text))
                                                                } else {
                                                                    (None, None)
                                                                }
                                                            } else {
                                                                (None, None)
                                                            }
                                                        } else {
                                                            (None, None)
                                                        };

                                                        // 画像ファイルの処理
                                                        let images = if let Some(files) = &event.files {
                                                            let mut image_list = Vec::new();
                                                            for file in files {
                                                                let mime = file.mimetype.as_deref().unwrap_or("");
                                                                if !mime.starts_with("image/") {
                                                                    continue;
                                                                }
                                                                // 複数のURLを優先順に試行
                                                                let candidate_urls: Vec<&str> = [
                                                                    file.url_private_download.as_deref(),
                                                                    file.thumb_480.as_deref(),
                                                                    file.thumb_360.as_deref(),
                                                                    file.url_private.as_deref(),
                                                                ].into_iter().flatten().collect();

                                                                let mut fetched = false;
                                                                for url in &candidate_urls {
                                                                    if let Some(data_url) = Self::fetch_image_as_data_url(&bot_token, url, mime).await {
                                                                        image_list.push(ImageData {
                                                                            data_url,
                                                                            name: file.name.clone(),
                                                                        });
                                                                        fetched = true;
                                                                        break;
                                                                    }
                                                                }
                                                                if !fetched {
                                                                    log::warn!("全URLで画像取得失敗: name={:?}", file.name);
                                                                }
                                                            }
                                                            if image_list.is_empty() { None } else { Some(image_list) }
                                                        } else {
                                                            None
                                                        };

                                                        let has_text = !text.is_empty();
                                                        let has_images = images.is_some();

                                                        if has_text || has_images {
                                                            let message = SlackMessage {
                                                                text,
                                                                user: user_name,
                                                                user_icon,
                                                                channel: Some(channel.clone()),
                                                                timestamp: ts,
                                                                queue_action: Some("addToQueue".to_string()),
                                                                thread_ts,
                                                                reply_to_user,
                                                                reply_to_text,
                                                                images,
                                                            };

                                                            // Tauri Eventでフロントエンドに送信
                                                            if let Err(e) = app_handle.emit("add-to-text-queue", &message) {
                                                                log::error!("メッセージ送信エラー: {}", e);
                                                            } else {
                                                                log::info!("メッセージをフロントエンドに送信: {}", message.text.chars().take(50).collect::<String>());
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Some(Ok(Message::Ping(data))) => {
                            if let Err(e) = write.send(Message::Pong(data)).await {
                                log::error!("Pong送信エラー: {}", e);
                            }
                        }
                        Some(Ok(Message::Close(_))) => {
                            log::info!("Socket Mode WebSocket接続クローズ");
                            break;
                        }
                        Some(Err(e)) => {
                            log::error!("WebSocket受信エラー: {}", e);
                            break;
                        }
                        None => {
                            log::info!("WebSocketストリーム終了");
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }

        inner.write().await.is_connected = false;
        Ok(())
    }

    /// Slack画像をダウンロードしてdata URLに変換
    /// Slackのファイル URLは302リダイレクトでCDNに転送される。
    /// リダイレクト時にAuthorizationヘッダーが別ホストに転送されないため、
    /// リダイレクトを無効化し、Locationヘッダーを取得して直接フェッチする。
    async fn fetch_image_as_data_url(bot_token: &str, url: &str, mimetype: &str) -> Option<String> {
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .build()
            .ok()?;

        // Step 1: Bearer認証付きでリクエスト → リダイレクトURLを取得
        let resp = client
            .get(url)
            .header("Authorization", format!("Bearer {}", bot_token))
            .send()
            .await
            .ok()?;

        let status = resp.status();

        if status.is_redirection() {
            // Step 2: リダイレクト先URL（CDN、認証トークン埋め込み済み）を取得してフェッチ
            let redirect_url = resp.headers().get("location")
                .and_then(|v| v.to_str().ok())?;
            log::debug!("画像リダイレクト先: {}", &redirect_url[..redirect_url.len().min(80)]);

            let img_resp = reqwest::get(redirect_url).await.ok()?;
            if !img_resp.status().is_success() {
                log::warn!("画像リダイレクト先ダウンロード失敗: status={}", img_resp.status());
                return None;
            }
            let content_type = img_resp.headers().get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_string();
            if content_type.contains("text/html") {
                log::warn!("画像リダイレクト先がHTMLを返却: url={}", redirect_url);
                return None;
            }
            let actual_mime = if content_type.starts_with("image/") {
                content_type.split(';').next().unwrap_or(mimetype).to_string()
            } else {
                mimetype.to_string()
            };
            let bytes = img_resp.bytes().await.ok()?;
            let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
            Some(format!("data:{};base64,{}", actual_mime, encoded))
        } else if status.is_success() {
            // リダイレクトなしで直接取得できた場合
            let content_type = resp.headers().get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_string();
            if content_type.contains("text/html") {
                log::warn!("画像URLがHTMLを返却: url={}", url);
                return None;
            }
            let actual_mime = if content_type.starts_with("image/") {
                content_type.split(';').next().unwrap_or(mimetype).to_string()
            } else {
                mimetype.to_string()
            };
            let bytes = resp.bytes().await.ok()?;
            let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
            Some(format!("data:{};base64,{}", actual_mime, encoded))
        } else {
            log::warn!("画像ダウンロード失敗: status={}", status);
            None
        }
    }

    /// ユーザー情報を取得（static版、Socket Modeタスク内で使用）
    async fn fetch_user_info_static(
        bot_token: &str,
        user_id: &str,
        inner: &Arc<RwLock<SlackClientInner>>,
    ) -> serde_json::Value {
        // キャッシュから取得
        {
            let read = inner.read().await;
            if let Some(user) = read.user_cache.get(user_id) {
                return user.clone();
            }
        }

        if bot_token.is_empty() || user_id.is_empty() {
            return serde_json::json!({"name": "unknown", "profile": {}});
        }

        let client = reqwest::Client::new();
        let resp = client
            .get("https://slack.com/api/users.info")
            .bearer_auth(bot_token)
            .query(&[("user", user_id)])
            .send()
            .await;

        match resp {
            Ok(r) => {
                if let Ok(result) = r.json::<UsersInfoResponse>().await {
                    if let Some(user) = result.user {
                        inner.write().await.user_cache.insert(user_id.to_string(), user.clone());
                        return user;
                    }
                }
            }
            Err(e) => {
                log::error!("ユーザー情報取得エラー: {}", e);
            }
        }

        serde_json::json!({"name": "unknown", "profile": {}})
    }

    /// スレッドの親メッセージを取得（static版、Socket Modeタスク内で使用）
    async fn fetch_parent_message_static(
        bot_token: &str,
        channel: &str,
        thread_ts: &str,
    ) -> Option<(String, String)> {
        if bot_token.is_empty() {
            return None;
        }

        let client = reqwest::Client::new();
        let resp = client
            .get("https://slack.com/api/conversations.replies")
            .bearer_auth(bot_token)
            .query(&[
                ("channel", channel),
                ("ts", thread_ts),
                ("limit", "1"),
                ("inclusive", "true"),
            ])
            .send()
            .await;

        match resp {
            Ok(r) => {
                if let Ok(result) = r.json::<ConversationsRepliesResponse>().await {
                    if result.ok {
                        if let Some(parent) = result.messages.first() {
                            let text = parent.text.clone().unwrap_or_default();
                            let truncated: String = text.chars().take(50).collect();
                            let user_id = parent.user.clone().unwrap_or_default();
                            return Some((user_id, truncated));
                        }
                    } else {
                        log::warn!("conversations.replies APIエラー: {:?}", result.error);
                    }
                }
            }
            Err(e) => {
                log::error!("親メッセージ取得エラー: {}", e);
            }
        }

        None
    }

    /// テキスト中の <@UXXXXX> メンションをユーザー名に置換する
    async fn resolve_mentions(
        text: &str,
        bot_token: &str,
        inner: &Arc<RwLock<SlackClientInner>>,
    ) -> String {
        let re = regex::Regex::new(r"<@(U[A-Z0-9]+)(?:\|[^>]*)?>").unwrap();
        let mut result = text.to_string();

        // マッチするユーザーIDを収集（重複排除）
        let user_ids: Vec<String> = {
            let mut ids = Vec::new();
            for cap in re.captures_iter(text) {
                if let Some(m) = cap.get(1) {
                    let id = m.as_str().to_string();
                    if !ids.contains(&id) {
                        ids.push(id);
                    }
                }
            }
            ids
        };

        for user_id in user_ids {
            let user_info = Self::fetch_user_info_static(bot_token, &user_id, inner).await;
            let display_name = user_info.get("profile")
                .and_then(|p| p.get("display_name"))
                .and_then(|v| v.as_str())
                .filter(|s| !s.is_empty())
                .or_else(|| user_info.get("real_name").and_then(|v| v.as_str()))
                .or_else(|| user_info.get("name").and_then(|v| v.as_str()))
                .unwrap_or("unknown");

            // HTMLエスケープ
            let escaped_name = display_name
                .replace('&', "&amp;")
                .replace('<', "&lt;")
                .replace('>', "&gt;")
                .replace('"', "&quot;");

            // <@UXXXXX> と <@UXXXXX|name> の両方を置換
            let pattern = format!(r"<@{}(?:\|[^>]*)?>", regex::escape(&user_id));
            if let Ok(re_user) = regex::Regex::new(&pattern) {
                result = re_user.replace_all(
                    &result,
                    format!(r#"<span class="slack-mention">@{}</span>"#, escaped_name),
                ).to_string();
            }
        }

        result
    }
}
