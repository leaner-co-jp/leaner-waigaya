const { ipcRenderer } = require('electron');

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
        timestamp: new Date().toLocaleTimeString()
      });
      this.updateUI();
    }
  }
  
  startQueue() {
    if (this.queue.length === 0) return;
    
    this.isPlaying = true;
    if (this.currentIndex === -1) {
      this.currentIndex = 0;
    }
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
    
    const currentText = this.queue[this.currentIndex];
    this.sendToDisplay(currentText.text);
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
  
  sendToDisplay(text) {
    // IPCを使ってメインプロセス経由で表示ウィンドウにテキストを送信
    try {
      ipcRenderer.send('display-text', text);
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
const textQueue = new TextQueue();

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