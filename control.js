const { ipcRenderer } = require('electron');

class SlackIntegration {
  constructor() {
    this.isConnected = false;
    this.autoAdd = false;
    this.autoConnect = true; // デフォルトで自動接続ON
    this.watchedChannels = []; // チャンネルIDの配列（後方互換性のため保持）
    this.watchedChannelData = {}; // { channelId: { name: 'channel-name', id: 'channelId' } }
    this.availableChannels = [];
    this.debugVisible = false;
    
    this.setupSlackListeners();
    this.loadSlackStatus();
    this.setupChannelSearch();
    this.setupDebugLogging();
  }
  
  setupDebugLogging() {
    // コンソールログをUI上にも表示
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      originalLog.apply(console, args);
      this.addDebugLog('LOG', args.join(' '));
    };
    
    console.error = (...args) => {
      originalError.apply(console, args);
      this.addDebugLog('ERROR', args.join(' '));
    };
  }
  
  addDebugLog(level, message) {
    const debugLog = document.getElementById('debugLog');
    if (debugLog) {
      const timestamp = new Date().toLocaleTimeString();
      const logEntry = `[${timestamp}] ${level}: ${message}\n`;
      debugLog.textContent += logEntry;
      debugLog.scrollTop = debugLog.scrollHeight;
    }
  }
  
  setupSlackListeners() {
    // Slackメッセージ受信リスナー
    ipcRenderer.on('slack-message-received', (event, messageData) => {
      console.log('📨 コントロール画面でSlackメッセージ受信:', messageData);
      console.log('🔄 自動追加設定:', this.autoAdd);
      console.log('🔄 textQueueオブジェクト:', typeof textQueue, textQueue);
      
      if (this.autoAdd) {
        // チャンネル名を削除し、ユーザー名とテキストのみを表示
        const displayData = {
          text: messageData.text,
          user: messageData.user,
          userIcon: messageData.userIcon
        };
        console.log('✅ テキストキューに追加しようとしています:', displayData);
        
        // textQueueが存在するかチェック
        if (window.textQueue && typeof window.textQueue.addSlackMessage === 'function') {
          window.textQueue.addSlackMessage(displayData);
          console.log('✅ テキストキューに正常に追加されました');
          
          // Slackメッセージは自動再生開始
          if (!window.textQueue.isPlaying) {
            console.log('🚀 Slackメッセージで自動再生を開始');
            window.textQueue.startQueue();
          }
        } else {
          console.error('❌ textQueueが利用できません:', typeof window.textQueue);
          
          // 代替案: 直接DOMを操作してテキストエリアに追加
          const textarea = document.getElementById('newText');
          if (textarea) {
            textarea.value = `${displayData.user}: ${displayData.text}`;
            console.log('🔄 代替案として入力フィールドに設定しました');
          }
        }
      } else {
        console.log('⚠️ 自動追加がOFFのため表示されません');
      }
    });
  }
  
  async loadSlackStatus() {
    try {
      const status = await ipcRenderer.invoke('slack-get-status');
      this.isConnected = status.connected;
      this.watchedChannels = status.config.channels || [];
      
      // 保存された設定を読み込み
      await this.loadSavedConfig();
      
      this.updateUI();
    } catch (error) {
      console.error('Slackステータス取得エラー:', error);
    }
  }
  
  async loadSavedConfig() {
    try {
      const result = await ipcRenderer.invoke('load-config');
      if (result.success && result.config) {
        const config = result.config;
        
        console.log('📁 設定読み込み内容:', config);
        
        // UIに設定値を復元
        if (config.botToken) {
          document.getElementById('botToken').value = config.botToken;
        }
        if (config.appToken) {
          document.getElementById('appToken').value = config.appToken;
        }
        // 古い形式（IDのみ）と新しい形式（名前付き）の両方に対応
        if (config.channels && Array.isArray(config.channels)) {
          this.watchedChannels = [...config.channels];
          console.log('🔍 復元された監視チャンネル:', this.watchedChannels);
        }
        if (config.watchedChannelData && typeof config.watchedChannelData === 'object') {
          this.watchedChannelData = { ...config.watchedChannelData };
          // watchedChannelsも更新（後方互換性）
          this.watchedChannels = Object.keys(this.watchedChannelData);
          console.log('🔍 復元された監視チャンネルデータ:', this.watchedChannelData);
        }
        if (config.autoAdd !== undefined) {
          this.autoAdd = config.autoAdd;
          const btn = document.getElementById('slackAutoBtn');
          if (btn) {
            btn.textContent = `自動追加: ${this.autoAdd ? 'ON' : 'OFF'}`;
            btn.style.backgroundColor = this.autoAdd ? '#28a745' : '#007cba';
          }
        }
        if (config.autoConnect !== undefined) {
          this.autoConnect = config.autoConnect;
          const btn = document.getElementById('autoConnectBtn');
          if (btn) {
            btn.textContent = `起動時自動接続: ${this.autoConnect ? 'ON' : 'OFF'}`;
            btn.style.backgroundColor = this.autoConnect ? '#28a745' : '#007cba';
          }
        }
        
        console.log('📁 保存された設定を復元しました');
        
        // 自動接続がONで、トークンが両方揃っていれば自動接続
        if (this.autoConnect && config.botToken && config.appToken) {
          console.log('🚀 保存されたトークンで自動接続を開始します');
          this.updateStatus('保存された設定で自動接続中...', '');
          try {
            await this.connect();
          } catch (error) {
            console.error('自動接続エラー:', error);
            this.updateStatus('自動接続に失敗しました', 'error');
          }
        }
      }
    } catch (error) {
      console.error('設定読み込みエラー:', error);
    }
  }
  
  async saveConfig() {
    try {
      const config = {
        botToken: document.getElementById('botToken').value,
        appToken: document.getElementById('appToken').value,
        channels: this.watchedChannels, // 後方互換性のため保持
        watchedChannelData: this.watchedChannelData, // チャンネル名付きデータ
        autoAdd: this.autoAdd,
        autoConnect: this.autoConnect
      };
      
      const result = await ipcRenderer.invoke('save-config', config);
      if (result.success) {
        console.log('📁 設定を保存しました');
      } else {
        console.error('設定保存エラー:', result.error);
      }
    } catch (error) {
      console.error('設定保存エラー:', error);
    }
  }
  
  async connect() {
    const botToken = document.getElementById('botToken').value;
    const appToken = document.getElementById('appToken').value;
    
    if (!botToken || !appToken) {
      this.updateStatus('Bot TokenとApp Tokenを入力してください', 'error');
      return;
    }
    
    // トークン形式チェック
    if (!botToken.startsWith('xoxb-')) {
      this.updateStatus('Bot Tokenは xoxb- で始まる必要があります', 'error');
      return;
    }
    
    if (!appToken.startsWith('xapp-')) {
      this.updateStatus('App Tokenは xapp- で始まる必要があります', 'error');
      return;
    }
    
    this.updateStatus('接続テスト中...', '');
    
    try {
      // まず接続テストを実行
      const testResult = await ipcRenderer.invoke('slack-test-connection', {
        botToken,
        appToken
      });
      
      if (!testResult.success) {
        let errorMsg = `接続テストエラー: ${testResult.error}`;
        if (testResult.code === 'slack_webapi_platform_error') {
          if (testResult.data?.error === 'invalid_auth') {
            errorMsg = 'トークンが無効です。正しいBot TokenとApp Tokenを確認してください';
          } else if (testResult.data?.error === 'missing_scope') {
            errorMsg = `権限不足: ${testResult.data.needed} が必要です`;
          }
        }
        this.updateStatus(errorMsg, 'error');
        return;
      }
      
      this.updateStatus('Socket Mode接続中...', '');
      
      const result = await ipcRenderer.invoke('slack-connect', {
        botToken,
        appToken,
        channels: this.watchedChannels
      });
      
      if (result.success) {
        this.isConnected = true;
        
        // 監視チャンネルがあるかどうかで表示を変更
        if (this.watchedChannels.length > 0) {
          this.updateStatus(`接続成功 - ${this.watchedChannels.length}チャンネルを監視中`, 'connected');
          console.log('✅ 接続成功 - 監視開始:', this.watchedChannels);
        } else {
          this.updateStatus('接続成功 - チャンネル一覧を取得してください', 'connected');
          console.log('✅ 接続成功 - 監視チャンネルなし');
        }
        
        await this.updateUI(); // UIの状態を更新
        
        // 接続成功時に設定を保存
        await this.saveConfig();
      } else {
        this.updateStatus(`接続エラー: ${result.error}`, 'error');
      }
    } catch (error) {
      console.error('接続エラー詳細:', error);
      this.updateStatus(`接続エラー: ${error.message}`, 'error');
    }
  }
  
  async disconnect() {
    try {
      await ipcRenderer.invoke('slack-disconnect');
      this.isConnected = false;
      this.watchedChannels = [];
      this.availableChannels = []; // チャンネル一覧もクリア
      this.watchedChannelData = {}; // チャンネルデータもクリア
      this.updateStatus('切断しました', '');
      await this.updateUI();
    } catch (error) {
      this.updateStatus(`切断エラー: ${error.message}`, 'error');
    }
  }
  
  async loadChannels() {
    if (!this.isConnected) {
      this.updateStatus('先にSlackに接続してください', 'error');
      return;
    }
    
    try {
      this.updateStatus('チャンネル一覧を取得中...', 'connected');
      const loadBtn = document.getElementById('loadChannelsBtn');
      loadBtn.disabled = true;
      loadBtn.textContent = '取得中...';
      
      this.availableChannels = await ipcRenderer.invoke('slack-get-channels');
      this.updateChannelSelect();
      this.updateChannelList(); // チャンネル名を更新
      this.updateStatus(`チャンネル一覧取得完了 (${this.availableChannels.length}チャンネル)`, 'connected');
      
      loadBtn.disabled = false;
      loadBtn.textContent = 'チャンネル一覧取得';
    } catch (error) {
      console.error('チャンネル取得エラー:', error);
      this.updateStatus('チャンネル取得エラー', 'error');
      
      const loadBtn = document.getElementById('loadChannelsBtn');
      loadBtn.disabled = false;
      loadBtn.textContent = 'チャンネル一覧取得';
    }
  }
  
  updateChannelSelect(filteredChannels = null) {
    const select = document.getElementById('channelSelect');
    const searchInput = document.getElementById('channelSearch');
    const loadBtn = document.getElementById('loadChannelsBtn');
    
    select.innerHTML = '';
    
    const channelsToShow = filteredChannels || this.availableChannels;
    
    if (channelsToShow.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      if (!this.isConnected) {
        option.textContent = 'まずSlackに接続してください';
      } else if (this.availableChannels.length === 0) {
        option.textContent = 'チャンネル一覧を取得してください';
      } else {
        option.textContent = filteredChannels ? '検索結果なし' : 'チャンネルがありません';
      }
      select.appendChild(option);
    } else {
      channelsToShow.forEach(channel => {
        const option = document.createElement('option');
        option.value = channel.id;
        option.textContent = `#${channel.name}${channel.isPrivate ? ' (プライベート)' : ''} (${channel.memberCount}人)`;
        select.appendChild(option);
      });
    }
    
    select.disabled = !this.isConnected || this.availableChannels.length === 0;
    searchInput.disabled = !this.isConnected || this.availableChannels.length === 0;
    loadBtn.disabled = !this.isConnected;
  }
  
  setupChannelSearch() {
    const searchInput = document.getElementById('channelSearch');
    
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase();
      
      if (searchTerm === '') {
        this.updateChannelSelect();
      } else {
        const filteredChannels = this.availableChannels.filter(channel =>
          channel.name.toLowerCase().includes(searchTerm)
        );
        this.updateChannelSelect(filteredChannels);
      }
    });
  }
  
  async addChannel() {
    const select = document.getElementById('channelSelect');
    const channelId = select.value;
    
    if (!channelId) {
      alert('チャンネルを選択してください');
      return;
    }
    
    if (this.watchedChannels.includes(channelId)) {
      alert('既に監視中のチャンネルです');
      return;
    }
    
    // チャンネル名を取得
    const channel = this.availableChannels.find(ch => ch.id === channelId);
    const channelName = channel ? channel.name : channelId;
    
    this.watchedChannels.push(channelId);
    this.watchedChannelData[channelId] = {
      id: channelId,
      name: channelName
    };
    
    ipcRenderer.send('slack-add-channel', channelId);
    await this.updateUI();
    // チャンネル追加時に設定を保存
    await this.saveConfig();
  }
  
  async removeChannel(channelId) {
    this.watchedChannels = this.watchedChannels.filter(id => id !== channelId);
    delete this.watchedChannelData[channelId]; // チャンネルデータも削除
    ipcRenderer.send('slack-remove-channel', channelId);
    await this.updateUI();
    // チャンネル削除時に設定を保存
    await this.saveConfig();
  }
  
  async toggleAutoAdd() {
    this.autoAdd = !this.autoAdd;
    const btn = document.getElementById('slackAutoBtn');
    btn.textContent = `自動追加: ${this.autoAdd ? 'ON' : 'OFF'}`;
    btn.style.backgroundColor = this.autoAdd ? '#28a745' : '#007cba';
    // 自動追加設定変更時に保存
    await this.saveConfig();
  }
  
  async toggleAutoConnect() {
    this.autoConnect = !this.autoConnect;
    const btn = document.getElementById('autoConnectBtn');
    btn.textContent = `起動時自動接続: ${this.autoConnect ? 'ON' : 'OFF'}`;
    btn.style.backgroundColor = this.autoConnect ? '#28a745' : '#007cba';
    // 自動接続設定変更時に保存
    await this.saveConfig();
  }
  
  
  async updateUI() {
    await this.updateChannelList();
    this.updateChannelSelect();
  }
  
  async updateChannelList() {
    const container = document.getElementById('channelList');
    
    if (this.watchedChannels.length === 0) {
      container.innerHTML = 'なし';
      return;
    }
    
    container.innerHTML = this.watchedChannels.map(channelId => {
      let displayText;
      let titleText = `ID: ${channelId}`;
      let cssClass = 'channel-item';
      
      // 保存されたチャンネルデータから名前を取得
      if (this.watchedChannelData[channelId] && this.watchedChannelData[channelId].name) {
        displayText = `#${this.watchedChannelData[channelId].name}`;
      } else {
        // チャンネル一覧から名前を取得
        const channel = this.availableChannels.find(ch => ch.id === channelId);
        if (channel) {
          displayText = `#${channel.name}`;
          // チャンネルデータを更新
          this.watchedChannelData[channelId] = {
            id: channelId,
            name: channel.name
          };
        } else {
          // 名前が不明な場合はIDを表示
          displayText = `#${channelId}`;
          titleText = 'チャンネル名未取得';
          cssClass += ' unknown';
        }
      }
      
      return `<span class="${cssClass}" title="${titleText}">
        ${displayText}
        <button onclick="slackIntegration.removeChannel('${channelId}')">×</button>
      </span>`;
    }).join('');
  }
  
  updateStatus(message, type) {
    const status = document.getElementById('slackStatus');
    status.textContent = message;
    status.className = 'slack-status';
    if (type) {
      status.classList.add(type);
    }
  }
}

class TextQueue {
  constructor() {
    this.queue = [];
    this.currentIndex = -1;
    this.isPlaying = false;
    this.currentTimer = null;
    this.displayTime = 3000; // ms
    this.fadeTime = 500; // ms
    
    this.updateUI();
  }
  
  addText(text) {
    if (text.trim()) {
      this.queue.push({
        id: Date.now(),
        text: text.trim(),
        timestamp: new Date().toLocaleTimeString(),
        type: 'text'
      });
      this.updateUI();
    }
  }
  
  addSlackMessage(messageData) {
    if (messageData.text && messageData.text.trim()) {
      const wasEmpty = this.queue.length === 0;
      
      this.queue.push({
        id: Date.now(),
        text: messageData.text.trim(),
        user: messageData.user,
        userIcon: messageData.userIcon,
        timestamp: new Date().toLocaleTimeString(),
        type: 'slack'
      });
      
      console.log('📋 Slackメッセージ追加後の状態:', {
        queueLength: this.queue.length,
        isPlaying: this.isPlaying,
        wasEmpty: wasEmpty
      });
      
      this.updateUI();
      
      // Slackメッセージの場合は自動再生開始
      if (!this.isPlaying) {
        console.log('🎬 Slackメッセージで自動再生を開始');
        this.startQueue();
      }
    }
  }
  
  startQueue() {
    console.log('🎬 startQueue呼び出し:', {
      queueLength: this.queue.length,
      isPlaying: this.isPlaying,
      currentIndex: this.currentIndex
    });
    
    if (this.queue.length === 0) {
      console.log('⚠️ キューが空のため開始できません');
      return;
    }
    
    this.isPlaying = true;
    if (this.currentIndex === -1) {
      this.currentIndex = 0;
    }
    
    console.log('▶️ 再生開始:', {
      currentIndex: this.currentIndex,
      currentItem: this.queue[this.currentIndex]
    });
    
    this.playNext();
    this.updateStatus();
  }
  
  stopQueue() {
    this.isPlaying = false;
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
    this.sendToDisplay('');
    this.updateStatus();
    this.updateUI();
  }
  
  nextText() {
    if (this.currentTimer) {
      clearTimeout(this.currentTimer);
      this.currentTimer = null;
    }
    
    if (this.isPlaying) {
      this.playNext();
    }
  }
  
  playNext() {
    if (!this.isPlaying || this.currentIndex >= this.queue.length) {
      this.stopQueue();
      return;
    }
    
    const currentItem = this.queue[this.currentIndex];
    if (currentItem.type === 'slack') {
      // Slackメッセージの場合はメタデータも送信
      this.sendToDisplay(currentItem.text, {
        user: currentItem.user,
        userIcon: currentItem.userIcon,
        type: 'slack'
      });
    } else {
      // 通常のテキストの場合
      this.sendToDisplay(currentItem.text);
    }
    this.updateUI();
    
    this.currentTimer = setTimeout(() => {
      this.currentIndex++;
      this.playNext();
    }, this.displayTime + this.fadeTime);
  }
  
  clearQueue() {
    this.stopQueue();
    this.queue = [];
    this.currentIndex = -1;
    this.updateUI();
  }
  
  removeItem(id) {
    const index = this.queue.findIndex(item => item.id === id);
    if (index !== -1) {
      this.queue.splice(index, 1);
      if (this.currentIndex >= index) {
        this.currentIndex--;
      }
      this.updateUI();
    }
  }
  
  updateSettings() {
    const displayTimeInput = document.getElementById('displayTime');
    const fadeTimeInput = document.getElementById('fadeTime');
    
    this.displayTime = parseFloat(displayTimeInput.value) * 1000;
    this.fadeTime = parseFloat(fadeTimeInput.value) * 1000;
  }
  
  sendToDisplay(text, metadata = null) {
    // IPCを使ってメインプロセス経由で表示ウィンドウにテキストを送信
    try {
      if (metadata) {
        ipcRenderer.send('display-slack-message', { text, metadata });
      } else {
        ipcRenderer.send('display-text', text);
      }
    } catch (error) {
      console.log('IPC error:', error);
    }
  }
  
  updateUI() {
    const queueList = document.getElementById('queueList');
    
    if (this.queue.length === 0) {
      queueList.innerHTML = 'キューは空です';
      return;
    }
    
    queueList.innerHTML = this.queue.map((item, index) => `
      <div class="queue-item ${index === this.currentIndex && this.isPlaying ? 'active' : ''}">
        <div>
          <strong>${index + 1}.</strong> ${item.text}
          <small style="color: #666; margin-left: 10px;">(${item.timestamp})</small>
        </div>
        <button onclick="textQueue.removeItem(${item.id})" style="background: #dc3545; padding: 4px 8px; font-size: 12px;">削除</button>
      </div>
    `).join('');
  }
  
  updateStatus() {
    const status = document.getElementById('status');
    if (this.isPlaying) {
      status.textContent = `再生中 (${this.currentIndex + 1}/${this.queue.length})`;
      status.className = 'status playing';
    } else {
      status.textContent = '停止中';
      status.className = 'status stopped';
    }
  }
}

// グローバルインスタンス
let textQueue;
let slackIntegration;

// ページ読み込み完了後にイベントリスナーを設定
document.addEventListener('DOMContentLoaded', () => {
  // グローバルインスタンスを初期化
  console.log('🚀 DOMContentLoaded: グローバルインスタンスを初期化中...');
  textQueue = new TextQueue();
  slackIntegration = new SlackIntegration();
  
  // windowオブジェクトにも登録してアクセスを確実にする
  window.textQueue = textQueue;
  window.slackIntegration = slackIntegration;
  
  console.log('✅ グローバルインスタンス初期化完了:', { textQueue, slackIntegration });
  
  // Slackボタンのイベントリスナー設定
  document.getElementById('connectSlackBtn').onclick = async () => {
    await slackIntegration.connect();
  };
  
  document.getElementById('disconnectSlackBtn').onclick = async () => {
    await slackIntegration.disconnect();
  };
  
  document.getElementById('addChannelBtn').onclick = async () => {
    await slackIntegration.addChannel();
  };
  
  document.getElementById('slackAutoBtn').onclick = async () => {
    await slackIntegration.toggleAutoAdd();
  };
  
  document.getElementById('autoConnectBtn').onclick = async () => {
    await slackIntegration.toggleAutoConnect();
  };
  
  document.getElementById('loadChannelsBtn').onclick = async () => {
    await slackIntegration.loadChannels();
  };
  
  document.getElementById('saveConfigBtn').onclick = async () => {
    await slackIntegration.saveConfig();
    alert('設定を保存しました');
  };
  
  document.getElementById('clearConfigBtn').onclick = async () => {
    if (confirm('保存された設定をすべてクリアしますか？')) {
      try {
        const result = await ipcRenderer.invoke('save-config', {
          botToken: '',
          appToken: '',
          channels: [],
          watchedChannelData: {},
          autoAdd: false,
          autoConnect: true
        });
        
        if (result.success) {
          // UIをクリア
          document.getElementById('botToken').value = '';
          document.getElementById('appToken').value = '';
          slackIntegration.watchedChannels = [];
          slackIntegration.watchedChannelData = {};
          slackIntegration.autoAdd = false;
          slackIntegration.autoConnect = true;
          await slackIntegration.updateUI();
          
          const autoAddBtn = document.getElementById('slackAutoBtn');
          autoAddBtn.textContent = '自動追加: OFF';
          autoAddBtn.style.backgroundColor = '#007cba';
          
          const autoConnectBtn = document.getElementById('autoConnectBtn');
          autoConnectBtn.textContent = '起動時自動接続: ON';
          autoConnectBtn.style.backgroundColor = '#28a745';
          
          alert('設定をクリアしました');
        }
      } catch (error) {
        console.error('設定クリアエラー:', error);
        alert('設定のクリアに失敗しました');
      }
    }
  };
  
  // テキストキューボタンのイベントリスナー設定
  document.getElementById('addTextBtn').onclick = () => {
    addText();
  };
  
  document.getElementById('addAndStartBtn').onclick = () => {
    addAndStart();
  };
  
  document.getElementById('startQueueBtn').onclick = () => {
    startQueue();
  };
  
  document.getElementById('stopQueueBtn').onclick = () => {
    stopQueue();
  };
  
  document.getElementById('nextTextBtn').onclick = () => {
    nextText();
  };
  
  document.getElementById('clearQueueBtn').onclick = () => {
    clearQueue();
  };
});

// UI関数
function addText() {
  const textarea = document.getElementById('newText');
  textQueue.addText(textarea.value);
  textarea.value = '';
}

function addAndStart() {
  addText();
  textQueue.startQueue();
}

function startQueue() {
  textQueue.updateSettings();
  textQueue.startQueue();
}

function stopQueue() {
  textQueue.stopQueue();
}

function nextText() {
  textQueue.nextText();
}

function clearQueue() {
  textQueue.clearQueue();
}

// 設定変更時の更新
document.getElementById('displayTime').addEventListener('change', () => {
  textQueue.updateSettings();
});

document.getElementById('fadeTime').addEventListener('change', () => {
  textQueue.updateSettings();
});

// Slack UI関数 - DOMContentLoadedのイベントリスナー内で直接実行するため削除

// デバッグ用UI関数
function toggleDebug() {
  const debugInfo = document.getElementById('debugInfo');
  debugInfo.style.display = debugInfo.style.display === 'none' ? 'block' : 'none';
}

function clearDebugLog() {
  const debugLog = document.getElementById('debugLog');
  if (debugLog) {
    debugLog.textContent = '';
  }
}