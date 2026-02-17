use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::slack_client::SlackConfig;

/// ストレージ管理の状態
pub struct StorageState {
    pub app_data_dir: PathBuf,
    /// 設定のインメモリキャッシュ
    config_cache: Mutex<Option<SlackConfig>>,
}

/// 保存用の設定構造（トークンを暗号化フラグ付きで保存）
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredConfig {
    #[serde(default)]
    bot_token: String,
    #[serde(default)]
    app_token: String,
    #[serde(default)]
    channels: Vec<String>,
    #[serde(default)]
    watched_channel_data: HashMap<String, crate::slack_client::SlackChannel>,
}

impl StorageState {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            app_data_dir,
            config_cache: Mutex::new(None),
        }
    }

    /// 設定ファイルのパスを取得
    fn config_path(&self) -> PathBuf {
        self.app_data_dir.join("slack-config.json")
    }

    /// ユーザーデータファイルのパスを取得
    pub fn users_path(&self) -> PathBuf {
        self.app_data_dir.join("users.json")
    }

    /// 絵文字データファイルのパスを取得
    pub fn emojis_path(&self) -> PathBuf {
        self.app_data_dir.join("emojis.json")
    }

    /// 設定を保存
    pub fn save_config(&self, config: &SlackConfig) -> Result<(), String> {
        let stored = StoredConfig {
            bot_token: config.bot_token.clone(),
            app_token: config.app_token.clone(),
            channels: config.channels.clone(),
            watched_channel_data: config.watched_channel_data.clone(),
        };

        let json = serde_json::to_string_pretty(&stored)
            .map_err(|e| format!("JSON変換エラー: {}", e))?;

        fs::write(self.config_path(), json)
            .map_err(|e| format!("設定保存エラー: {}", e))?;

        // キャッシュを更新
        *self.config_cache.lock().unwrap() = Some(config.clone());

        log::info!("設定を保存しました: {:?}", self.config_path());
        Ok(())
    }

    /// 設定を読み込み
    pub fn load_config(&self) -> Result<Option<SlackConfig>, String> {
        // キャッシュがあればそれを返す
        if let Some(cached) = self.config_cache.lock().unwrap().as_ref() {
            return Ok(Some(cached.clone()));
        }

        let path = self.config_path();
        if !path.exists() {
            return Ok(None);
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| format!("設定読み込みエラー: {}", e))?;

        let stored: StoredConfig = serde_json::from_str(&content)
            .map_err(|e| format!("JSON解析エラー: {}", e))?;

        let config = SlackConfig {
            bot_token: stored.bot_token,
            app_token: stored.app_token,
            channels: stored.channels,
            watched_channel_data: stored.watched_channel_data,
        };

        // キャッシュに保存
        *self.config_cache.lock().unwrap() = Some(config.clone());

        log::info!("設定を読み込みました");
        Ok(Some(config))
    }

    /// ユーザーデータを保存
    pub fn save_users_data(&self, data: &serde_json::Value) -> Result<(), String> {
        let json = serde_json::to_string_pretty(data)
            .map_err(|e| format!("JSON変換エラー: {}", e))?;
        fs::write(self.users_path(), json)
            .map_err(|e| format!("ユーザーデータ保存エラー: {}", e))?;
        log::info!("ユーザーデータを保存しました");
        Ok(())
    }

    /// ユーザーデータを読み込み
    pub fn load_users_data(&self) -> Result<serde_json::Value, String> {
        let path = self.users_path();
        if !path.exists() {
            return Ok(serde_json::json!({}));
        }
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("ユーザーデータ読み込みエラー: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("ユーザーデータJSON解析エラー: {}", e))
    }

    /// 絵文字データを保存
    pub fn save_emojis_data(&self, data: &serde_json::Value) -> Result<(), String> {
        let json = serde_json::to_string_pretty(data)
            .map_err(|e| format!("JSON変換エラー: {}", e))?;
        fs::write(self.emojis_path(), json)
            .map_err(|e| format!("絵文字データ保存エラー: {}", e))?;
        log::info!("絵文字データを保存しました");
        Ok(())
    }

    /// 絵文字データファイルの最終更新日時をUnixタイムスタンプ（秒）で取得
    pub fn get_emojis_last_updated(&self) -> Option<u64> {
        let path = self.emojis_path();
        if !path.exists() {
            return None;
        }
        fs::metadata(&path)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
    }

    /// 絵文字データを読み込み
    pub fn load_emojis_data(&self) -> Result<serde_json::Value, String> {
        let path = self.emojis_path();
        if !path.exists() {
            return Ok(serde_json::json!({}));
        }
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("絵文字データ読み込みエラー: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("絵文字データJSON解析エラー: {}", e))
    }
}
