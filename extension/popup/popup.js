document.getElementById('btn').addEventListener('click', () => {
  const task = document.getElementById('task').value;
  chrome.runtime.sendMessage({ type: 'EXECUTE_TASK', task });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATUS_UPDATE') {
    const log = document.getElementById('log');
    log.innerHTML = msg.state.actionLog.map(l => `<div>${l.time}: ${l.message}</div>`).join('');
  }
});
