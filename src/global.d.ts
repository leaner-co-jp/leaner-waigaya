import { ElectronAPI } from './preload';

// Electron Forge Vite プラグインによって提供される環境変数
// declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
// declare const MAIN_WINDOW_VITE_NAME: string;

// electron-squirrel-startup モジュールの型定義
declare module 'electron-squirrel-startup' {
	const started: boolean;
	export = started;
}

declare global {
	interface Window {
		electronAPI: ElectronAPI;
	}
	const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
	const MAIN_WINDOW_VITE_NAME: string;
}

export { };
