use crate::slack_client::{SlackClientState, SlackConfig};
use crate::storage::StorageState;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigSaveResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConfigLoadResult {
    pub success: bool,
    pub config: Option<SlackConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[tauri::command]
pub async fn save_settings(
    config: SlackConfig,
    storage: State<'_, StorageState>,
    slack: State<'_, SlackClientState>,
) -> Result<ConfigSaveResult, String> {
    // SlackClientの設定も更新
    slack.update_config(config.clone()).await;

    match storage.save_config(&config) {
        Ok(()) => Ok(ConfigSaveResult {
            success: true,
            error: None,
        }),
        Err(e) => Ok(ConfigSaveResult {
            success: false,
            error: Some(e),
        }),
    }
}

#[tauri::command]
pub async fn load_settings(
    storage: State<'_, StorageState>,
) -> Result<ConfigLoadResult, String> {
    match storage.load_config() {
        Ok(config) => Ok(ConfigLoadResult {
            success: true,
            config,
            error: None,
        }),
        Err(e) => Ok(ConfigLoadResult {
            success: false,
            config: None,
            error: Some(e),
        }),
    }
}
