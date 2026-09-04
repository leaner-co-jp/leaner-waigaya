mod commands;
mod slack_client;
mod storage;

use commands::{config, slack};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{LogicalSize, Manager, WindowEvent};

/// displayウィンドウのサイズ変更を監視し、落ち着いたら保存する
fn watch_display_window_size(app: &tauri::App) {
    let Some(display) = app.get_webview_window("display") else {
        log::warn!("displayウィンドウが見つからないためサイズ保存を無効化");
        return;
    };

    // 保存済みのサイズがあれば復元
    if let Some(state) = app.state::<storage::StorageState>().load_window_state() {
        if let Err(e) = display.set_size(LogicalSize::new(state.width, state.height)) {
            log::warn!("ウィンドウサイズの復元に失敗: {}", e);
        } else {
            log::info!("ウィンドウサイズを復元: {}x{}", state.width, state.height);
        }
    }

    // リサイズはドラッグ中に連発するので、最後のイベントから500ms待って1回だけ書く
    let generation = Arc::new(AtomicU64::new(0));
    let app_handle = app.handle().clone();
    let window = display.clone();
    display.on_window_event(move |event| {
        let WindowEvent::Resized(size) = event else {
            return;
        };
        let scale = window.scale_factor().unwrap_or(1.0);
        let logical: LogicalSize<f64> = size.to_logical(scale);
        // 最小化などで0になったサイズは記録しない
        if logical.width < 1.0 || logical.height < 1.0 {
            return;
        }
        let my_gen = generation.fetch_add(1, Ordering::SeqCst) + 1;
        let generation = generation.clone();
        let app_handle = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_millis(500)).await;
            if generation.load(Ordering::SeqCst) != my_gen {
                return;
            }
            let state = storage::WindowState {
                width: logical.width,
                height: logical.height,
            };
            if let Err(e) = app_handle
                .state::<storage::StorageState>()
                .save_window_state(&state)
            {
                log::warn!("{}", e);
            }
        });
    });
}

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

            watch_display_window_size(app);

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
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                let state = app_handle.state::<slack_client::SlackClientState>();
                tauri::async_runtime::block_on(state.disconnect());
            }
        });
}
