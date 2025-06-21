import React, { useState, useEffect } from 'react';

export interface DisplaySettings {
  fontSize: number;        // フォントサイズ（現行：20px）
  textColor: string;       // テキスト色（現行：#ffffff）
  backgroundColor: string; // 背景色（現行：#000000）
  opacity: number;         // 透明度（現行：0.5、範囲0.0-1.0）
  fadeTime: number;        // フェード時間（1-10秒）
  borderRadius: number;    // 角丸半径（0-20px）
}

// 現行システムのデフォルト値に合わせて調整
const DEFAULT_SETTINGS: DisplaySettings = {
  fontSize: 20,           // 現行システムのデフォルト値
  textColor: '#ffffff',   // 現行システムのデフォルト値
  backgroundColor: '#000000', // 現行システムのデフォルト値
  opacity: 0.5,          // 現行システムのデフォルト値
  fadeTime: 3,
  borderRadius: 8,
};

interface DisplaySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsChange: (settings: DisplaySettings) => void;
}

export const DisplaySettingsComponent: React.FC<DisplaySettingsProps> = ({
  isOpen,
  onClose,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);

  // localStorage から設定を読み込み
  useEffect(() => {
    const savedSettings = localStorage.getItem('waigayaDisplaySettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (error) {
        console.error('表示設定の読み込みエラー:', error);
      }
    }
  }, []);

  // 設定が変更されたときの処理（現行システムのリアルタイム反映と同等）
  const handleSettingChange = (key: keyof DisplaySettings, value: number | string) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    // localStorage に保存（現行システムと同じキー）
    localStorage.setItem('waigayaDisplaySettings', JSON.stringify(newSettings));
    
    // 親コンポーネントに通知
    onSettingsChange(newSettings);
    
    // DisplayWindowにリアルタイム反映（現行システムと同じ動作）
    if (typeof window !== 'undefined' && window.electronAPI?.displaySettingsUpdate) {
      window.electronAPI.displaySettingsUpdate(newSettings);
    }
  };

  // デフォルト設定にリセット
  const resetToDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem('waigayaDisplaySettings', JSON.stringify(DEFAULT_SETTINGS));
    onSettingsChange(DEFAULT_SETTINGS);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">🎨 表示設定</h2>
          <button
            className="bg-gray-300 text-gray-800 rounded px-3 py-1 hover:bg-gray-400"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>

        <div className="space-y-4">
          {/* フォントサイズ */}
          <div>
            <label className="block mb-1 font-semibold">
              フォントサイズ: {settings.fontSize}px
            </label>
            <input
              type="range"
              min={12}
              max={48}
              value={settings.fontSize}
              onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>12px</span>
              <span>48px</span>
            </div>
          </div>

          {/* テキスト色 */}
          <div>
            <label className="block mb-1 font-semibold">テキスト色</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.textColor}
                onChange={(e) => handleSettingChange('textColor', e.target.value)}
                className="w-12 h-8 border rounded"
              />
              <input
                type="text"
                value={settings.textColor}
                onChange={(e) => handleSettingChange('textColor', e.target.value)}
                className="border rounded px-2 py-1 font-mono text-sm flex-1"
                placeholder="#000000"
              />
            </div>
          </div>

          {/* 背景色 */}
          <div>
            <label className="block mb-1 font-semibold">背景色</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.backgroundColor}
                onChange={(e) => handleSettingChange('backgroundColor', e.target.value)}
                className="w-12 h-8 border rounded"
              />
              <input
                type="text"
                value={settings.backgroundColor}
                onChange={(e) => handleSettingChange('backgroundColor', e.target.value)}
                className="border rounded px-2 py-1 font-mono text-sm flex-1"
                placeholder="#ffffff"
              />
            </div>
          </div>

          {/* 透明度 */}
          <div>
            <label className="block mb-1 font-semibold">
              透明度: {Math.round(settings.opacity * 100)}%
            </label>
            <input
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={settings.opacity}
              onChange={(e) => handleSettingChange('opacity', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>10%</span>
              <span>100%</span>
            </div>
          </div>

          {/* フェード時間 */}
          <div>
            <label className="block mb-1 font-semibold">
              フェード時間: {settings.fadeTime}秒
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={settings.fadeTime}
              onChange={(e) => handleSettingChange('fadeTime', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1秒</span>
              <span>10秒</span>
            </div>
          </div>

          {/* 角丸半径 */}
          <div>
            <label className="block mb-1 font-semibold">
              角丸半径: {settings.borderRadius}px
            </label>
            <input
              type="range"
              min={0}
              max={20}
              value={settings.borderRadius}
              onChange={(e) => handleSettingChange('borderRadius', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0px</span>
              <span>20px</span>
            </div>
          </div>
        </div>

        {/* プレビュー */}
        <div className="mt-4 p-3 border rounded">
          <div className="text-sm font-semibold mb-2">プレビュー:</div>
          <div
            style={{
              fontSize: `${settings.fontSize}px`,
              color: settings.textColor,
              backgroundColor: settings.backgroundColor,
              opacity: settings.opacity,
              borderRadius: `${settings.borderRadius}px`,
              padding: '8px 12px',
              display: 'inline-block',
            }}
          >
            サンプルメッセージ
          </div>
        </div>

        {/* ボタン */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={resetToDefaults}
            className="bg-gray-600 text-white rounded px-4 py-2 hover:bg-gray-700 flex-1"
          >
            デフォルトに戻す
          </button>
          <button
            onClick={onClose}
            className="bg-blue-600 text-white rounded px-4 py-2 hover:bg-blue-700 flex-1"
          >
            適用
          </button>
        </div>
      </div>
    </div>
  );
};

// デフォルト設定を取得するヘルパー関数
export const getDisplaySettings = (): DisplaySettings => {
  const savedSettings = localStorage.getItem('waigayaDisplaySettings');
  if (savedSettings) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
    } catch (error) {
      console.error('表示設定の読み込みエラー:', error);
    }
  }
  return DEFAULT_SETTINGS;
};