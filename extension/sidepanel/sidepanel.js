document.addEventListener('DOMContentLoaded', () => {
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const messagesDiv = document.getElementById('messages');
  const welcomeView = document.getElementById('welcomeView');
  const chatView = document.getElementById('chatView');
  const container = document.getElementById('container');

  const settingsOverlay = document.getElementById('settingsOverlay');
  const closeSettings = document.getElementById('closeSettings');
  const serverUrlInput = document.getElementById('serverUrl');

  let serverUrl = 'ws://localhost:8000/ws';
  let currentStatusId = null;

  chrome.storage.local.get(['serverUrl'], (res) => {
    if (res.serverUrl) {
      serverUrl = res.serverUrl;
      serverUrlInput.value = serverUrl;
    }
  });

  document.querySelector('.model-label').onclick = () => settingsOverlay.classList.add('open');
  closeSettings.onclick = () => {
    settingsOverlay.classList.remove('open');
    serverUrl = serverUrlInput.value;
    chrome.storage.local.set({ serverUrl });
  };

  userInput.addEventListener('input', () => {
    sendBtn.disabled = userInput.value.trim() === '';
  });

  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!sendBtn.disabled) sendTask();
    }
  });

  sendBtn.addEventListener('click', sendTask);

  document.querySelectorAll('.suggestion-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      userInput.value = pill.querySelector('span:nth-child(2)').textContent;
      sendBtn.disabled = false;
      sendTask();
    });
  });

  // ── Persistent port connection to service worker ──
  let port = null;

  function connectPort() {
    port = chrome.runtime.connect({ name: 'sidepanel' });
    port.onMessage.addListener((msg) => {
      console.log('[SidePanel] Received port message:', msg);
      handleStatusUpdate(msg);
    });
    port.onDisconnect.addListener(() => {
      console.log('[SidePanel] Port disconnected, reconnecting...');
      setTimeout(connectPort, 500);
    });
  }

  connectPort();

  function handleStatusUpdate(msg) {
    if (msg.type !== 'STATUS_UPDATE') return;
    const s = msg.state;

    if (s.status === 'analyzing' && currentStatusId) {
      updateStatus(currentStatusId, 'Analyzing page…');
    } else if (s.status === 'redacting' && currentStatusId) {
      updateStatus(currentStatusId, `Redacting ${s.piiCount} region(s)…`);
    } else if (s.status === 'waiting_server' && currentStatusId) {
      updateStatus(currentStatusId, 'Thinking…');
    } else if (s.status === 'idle' && currentStatusId) {
      // Remove the spinner
      removeEl(currentStatusId);
      currentStatusId = null;

      // Find thought from logs
      const logs = s.actionLog || [];
      let thought = '';
      for (const l of logs) {
        if (l.message.startsWith('🧠')) thought = l.message.replace('🧠 Thought: ', '');
      }

      if (thought) {
        addAgentMsg(thought);
      }

      // Check for errors
      const errLog = logs.find(l => l.message.startsWith('Error:'));
      if (errLog) {
        addBadge('error', errLog.message);
      } else {
        addBadge('done', '✓ Done');
      }
    }
  }

  function sendTask() {
    const task = userInput.value.trim();
    if (!task) return;

    userInput.value = '';
    sendBtn.disabled = true;

    welcomeView.style.display = 'none';
    chatView.style.display = 'block';

    addUserMsg(task);

    currentStatusId = 'st-' + Date.now();
    addStatus(currentStatusId, 'Analyzing page…');

    // Send via port
    if (port) {
      port.postMessage({ type: 'EXECUTE_TASK', task, serverUrl });
    }
  }

  // ── UI Helpers ──
  function addUserMsg(text) {
    appendHtml(`<div class="msg-user"><div class="msg-user-bubble">${esc(text)}</div></div>`);
  }

  function addAgentMsg(text) {
    appendHtml(`<div class="msg-agent-block"><div class="msg-agent-text">${esc(text)}</div></div>`);
  }

  function addStatus(id, text) {
    appendHtml(`<div class="status-pill" id="${id}"><span class="dot"></span><span>${esc(text)}</span></div>`);
  }

  function updateStatus(id, text) {
    const el = document.getElementById(id);
    if (el) el.querySelector('span:last-child').textContent = text;
  }

  function removeEl(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function addBadge(type, text) {
    appendHtml(`<div class="status-pill ${type}"><span class="dot"></span><span>${esc(text)}</span></div>`);
  }

  function appendHtml(html) {
    messagesDiv.insertAdjacentHTML('beforeend', html);
    scroll();
  }

  function scroll() {
    requestAnimationFrame(() => container.scrollTop = container.scrollHeight);
  }

  function esc(t) {
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }
});
