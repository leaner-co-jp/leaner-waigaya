use crate::slack_client::{
    CacheStatus, ChannelActionResult, ChannelListResult, EmojiListResult,
    SlackChannel, SlackClientState, SlackConfig, SlackConnectionResult,
    WatchedChannelsResult,
};
use crate::storage::StorageState;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

// --- 接続管理 ---

#[tauri::command]
pub async fn slack_connect(
    config: SlackConfig,
    slack: State<'_, SlackClientState>,
    app_handle: AppHandle,
) -> Result<SlackConnectionResult, String> {
    slack.update_config(config).await;
    Ok(slack.connect(app_handle).await)
}

#[tauri::command]
pub async fn slack_disconnect(
    slack: State<'_, SlackClientState>,
) -> Result<SlackConnectionResult, String> {
    slack.disconnect().await;
    Ok(SlackConnectionResult {
        success: true,
        error: None,
    })
}

#[tauri::command]
pub async fn slack_test_connection(
    config: SlackConfig,
    slack: State<'_, SlackClientState>,
) -> Result<SlackConnectionResult, String> {
    slack.update_config(config).await;
    Ok(slack.test_connection().await)
}

// --- チャンネル管理 ---

#[tauri::command]
pub async fn slack_get_channels(
    slack: State<'_, SlackClientState>,
) -> Result<ChannelListResult, String> {
    Ok(slack.get_channel_list().await)
}

#[tauri::command]
pub async fn slack_add_channel(
    channel_id: String,
    slack: State<'_, SlackClientState>,
    storage: State<'_, StorageState>,
    app_handle: AppHandle,
) -> Result<ChannelActionResult, String> {
    log::info!("slack_add_channel コマンド呼び出し: {}", channel_id);
    let result = slack.add_watch_channel(&channel_id, &storage).await;
    log::info!("slack_add_channel 結果: {:?}", result);

    // 表示ウィンドウにチャンネル更新を通知
    if result.success {
        let channel_name = slack.get_current_channel_name().await;
        let _ = app_handle.emit("channel-updated", &channel_name);
    }

    Ok(result)
}

#[tauri::command]
pub async fn slack_remove_channel(
    channel_id: String,
    slack: State<'_, SlackClientState>,
    storage: State<'_, StorageState>,
    app_handle: AppHandle,
) -> Result<ChannelActionResult, String> {
    log::info!("slack_remove_channel コマンド呼び出し: {}", channel_id);
    let result = slack.remove_watch_channel(&channel_id, &storage).await;
    log::info!("slack_remove_channel 結果: {:?}", result);

    if result.success {
        let channel_name = slack.get_current_channel_name().await;
        let _ = app_handle.emit("channel-updated", &channel_name);
    }

    Ok(result)
}

#[tauri::command]
pub async fn slack_get_channel_info(
    channel_id: String,
    slack: State<'_, SlackClientState>,
) -> Result<SlackChannel, String> {
    Ok(slack.get_channel_info(&channel_id).await)
}

#[tauri::command]
pub async fn slack_get_watched_channels(
    slack: State<'_, SlackClientState>,
) -> Result<WatchedChannelsResult, String> {
    Ok(slack.get_watched_channels().await)
}

#[tauri::command]
pub async fn get_current_channel_name(
    slack: State<'_, SlackClientState>,
) -> Result<String, String> {
    Ok(slack.get_current_channel_name().await)
}

// --- ユーザー管理 ---

#[derive(Debug, Serialize, Deserialize)]
pub struct UsersReloadResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UsersCountResult {
    pub success: bool,
    pub count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[tauri::command]
pub async fn slack_reload_users(
    slack: State<'_, SlackClientState>,
    storage: State<'_, StorageState>,
) -> Result<UsersReloadResult, String> {
    match slack.fetch_all_users().await {
        Ok((count, users_json)) => {
            // ファイルに保存
            if let Err(e) = storage.save_users_data(&users_json) {
                log::error!("ユーザーデータ保存エラー: {}", e);
            }
            Ok(UsersReloadResult {
                success: true,
                count: Some(count),
                error: None,
            })
        }
        Err(e) => Ok(UsersReloadResult {
            success: false,
            count: None,
            error: Some(e),
        }),
    }
}

#[tauri::command]
pub async fn get_users_count(
    slack: State<'_, SlackClientState>,
) -> Result<UsersCountResult, String> {
    let count = slack.get_users_count().await;
    Ok(UsersCountResult {
        success: true,
        count,
        error: None,
    })
}

// --- 絵文字管理 ---

#[derive(Debug, Serialize, Deserialize)]
pub struct EmojiSaveResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[tauri::command]
pub async fn slack_get_custom_emojis(
    slack: State<'_, SlackClientState>,
    storage: State<'_, StorageState>,
    app_handle: AppHandle,
) -> Result<EmojiListResult, String> {
    let result = slack.get_custom_emojis().await;

    if result.success {
        if let Some(ref emojis) = result.emojis {
            // {name: url} 形式に変換してファイル保存
            let emoji_data: serde_json::Value = emojis
                .iter()
                .map(|e| (e.name.clone(), serde_json::Value::String(e.url.clone())))
                .collect::<serde_json::Map<String, serde_json::Value>>()
                .into();

            if let Err(e) = storage.save_emojis_data(&emoji_data) {
                log::error!("絵文字データ保存エラー: {}", e);
            }

            // UIに更新を通知
            let _ = app_handle.emit("custom-emojis-data", &emoji_data);
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn save_emojis_data(
    emojis_data: serde_json::Value,
    storage: State<'_, StorageState>,
) -> Result<EmojiSaveResult, String> {
    match storage.save_emojis_data(&emojis_data) {
        Ok(()) => Ok(EmojiSaveResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(EmojiSaveResult {
            success: false,
            error: Some(e),
        }),
    }
}

#[tauri::command]
pub async fn get_emojis_last_updated(
    storage: State<'_, StorageState>,
) -> Result<Option<u64>, String> {
    Ok(storage.get_emojis_last_updated())
}

// --- ローカルデータ管理 ---

#[derive(Debug, Serialize, Deserialize)]
pub struct LocalDataResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[tauri::command]
pub async fn set_local_users_data(
    slack: State<'_, SlackClientState>,
    storage: State<'_, StorageState>,
) -> Result<LocalDataResult, String> {
    match storage.load_users_data() {
        Ok(data) => {
            if let Some(obj) = data.as_object() {
                if !obj.is_empty() {
                    slack.set_local_users_data(data.clone()).await;
                    return Ok(LocalDataResult {
                        success: true,
                        data: Some(data),
                        error: None,
                    });
                }
            }
            Ok(LocalDataResult {
                success: false,
                data: None,
                error: Some("No local user data found.".to_string()),
            })
        }
        Err(e) => Ok(LocalDataResult {
            success: false,
            data: None,
            error: Some(e),
        }),
    }
}

#[tauri::command]
pub async fn set_local_emojis_data(
    slack: State<'_, SlackClientState>,
    storage: State<'_, StorageState>,
    app_handle: AppHandle,
) -> Result<LocalDataResult, String> {
    match storage.load_emojis_data() {
        Ok(data) => {
            if let Some(obj) = data.as_object() {
                if !obj.is_empty() {
                    slack.set_local_emojis_data(data.clone()).await;
                    // UIに絵文字データを通知
                    let _ = app_handle.emit("custom-emojis-data", &data);
                    return Ok(LocalDataResult {
                        success: true,
                        data: Some(data),
                        error: None,
                    });
                }
            }
            Ok(LocalDataResult {
                success: false,
                data: None,
                error: Some("No local emoji data found.".to_string()),
            })
        }
        Err(e) => Ok(LocalDataResult {
            success: false,
            data: None,
            error: Some(e),
        }),
    }
}

#[tauri::command]
pub async fn get_cache_status(
    slack: State<'_, SlackClientState>,
) -> Result<CacheStatus, String> {
    Ok(slack.get_cache_status().await)
}

#[tauri::command]
pub async fn get_emoji_url(
    name: String,
    slack: State<'_, SlackClientState>,
) -> Result<Option<String>, String> {
    Ok(slack.get_emoji_url(&name).await)
}
