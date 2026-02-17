mod commands;
mod slack_client;
mod storage;

use commands::{config, slack};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // アプリデータディレクトリの初期化
            let app_data_dir = app.path().app_data_dir().expect("app data dir");
            std::fs::create_dir_all(&app_data_dir).ok();

            // SlackClientの状態を管理
            let slack_state = slack_client::SlackClientState::new();
            app.manage(slack_state);

            // StorageStateの管理
            let storage_state = storage::StorageState::new(app_data_dir);
            app.manage(storage_state);

            log::info!("Leaner Waigaya 起動完了");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Config commands
            config::save_settings,
            config::load_settings,
            // Slack commands
            slack::slack_connect,
            slack::slack_disconnect,
            slack::slack_test_connection,
            slack::slack_get_channels,
            slack::slack_add_channel,
            slack::slack_remove_channel,
            slack::slack_get_channel_info,
            slack::slack_get_watched_channels,
            slack::get_current_channel_name,
            slack::slack_reload_users,
            slack::get_users_count,
            slack::slack_get_custom_emojis,
            slack::save_emojis_data,
            slack::set_local_users_data,
            slack::set_local_emojis_data,
            slack::get_cache_status,
            slack::get_emoji_url,
            slack::get_emojis_last_updated,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
