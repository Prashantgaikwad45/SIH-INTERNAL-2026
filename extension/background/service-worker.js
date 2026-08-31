import { MappingRegistry } from '../lib/mapping-registry.js';
import { redactImage } from '../lib/redaction.js';
import { AgentWebSocketClient } from '../lib/api-client.js';

const state = {
  status: 'idle',
  privacyFilter: true,
  serverUrl: 'ws://localhost:8000/ws',
  currentTask: null,
  mlReady: false,
  piiCount: 0,
  actionLog: []
};

const registry = new MappingRegistry();
const wsClient = new AgentWebSocketClient();

// Open the side panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

// ── Port-based communication with side panel ──
const connectedPorts = new Set();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'sidepanel') {
    connectedPorts.add(port);
    console.log('[SW] Side panel connected. Total:', connectedPorts.size);

    port.onMessage.addListener((msg) => {
      if (msg.type === 'EXECUTE_TASK') {
        runPipeline(msg.task);
      } else if (msg.type === 'GET_STATE') {
        port.postMessage({ type: 'STATUS_UPDATE', state });
      }
    });

    port.onDisconnect.addListener(() => {
      connectedPorts.delete(port);
      console.log('[SW] Side panel disconnected. Total:', connectedPorts.size);
    });
  }
});

function broadcastState() {
  for (const port of connectedPorts) {
    try {
      port.postMessage({ type: 'STATUS_UPDATE', state });
    } catch (e) {
      connectedPorts.delete(port);
    }
  }
}

function addLog(message) {
  state.actionLog.push({ time: new Date().toLocaleTimeString(), message });
  if (state.actionLog.length > 50) state.actionLog.shift();
  broadcastState();
}

async function ensureOffscreenDocument() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existing.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'offscreen/offscreen.html',
      reasons: ['DOM_PARSER', 'WORKERS'],
      justification: 'ML inference'
    });
  }
}

async function runPipeline(task) {
  state.currentTask = task;
  state.status = 'analyzing';
  addLog('Scanning DOM & capturing screenshot...');
  registry.clear();
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
      throw new Error('Cannot analyze chrome:// pages or blank tabs. Please navigate to a real website.');
    }

    const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    
    // DOM Analysis — with auto-inject fallback
    const domData = await new Promise(async (resolve, reject) => {
      const listener = (msg) => {
        if (msg.type === 'DOM_ANALYSIS_RESULT') {
          chrome.runtime.onMessage.removeListener(listener);
          resolve(msg.data);
        }
      };
      chrome.runtime.onMessage.addListener(listener);

      // Try sending message to existing content script
      chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_DOM' }, async (response) => {
        if (chrome.runtime.lastError) {
          // Content script not loaded — inject it programmatically
          addLog('Injecting content scripts...');
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content/dom-analyzer.js', 'content/action-executor.js', 'content/content.js']
            });
            // Retry after injection
            chrome.tabs.sendMessage(tab.id, { type: 'ANALYZE_DOM' }, (r) => {
              if (chrome.runtime.lastError) {
                chrome.runtime.onMessage.removeListener(listener);
                reject(new Error('Failed to inject content scripts. Page may be restricted.'));
              }
            });
          } catch (e) {
            chrome.runtime.onMessage.removeListener(listener);
            reject(new Error(`Cannot inject scripts: ${e.message}`));
          }
        }
      });

      // Safety timeout
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener);
        reject(new Error('DOM analysis timeout'));
      }, 8000);
    });

    // ML inference disabled — Gemini handles visual analysis server-side.
    // Local DOM-based PII detection is still used for redaction.
    const mlResults = { faces: [] };

    // Merge Regions & Redact
    const allRegions = [...(domData.piiRegions || []), ...(mlResults.faces || [])];
    state.piiCount = allRegions.length;
    
    state.status = 'redacting';
    addLog(`Redacting ${allRegions.length} sensitive region(s)...`);
    const tokenizedDOM = registry.getTokenizedDOM(domData);
    const redacted = await redactImage(screenshot, allRegions);
    
    state.status = 'waiting_server';
    addLog('Waiting for AI analysis...');
    await wsClient.connect();
    const serverResp = await wsClient.sendAnalysis({
      sanitizedImage: redacted.sanitizedImageDataUrl,
      tokenizedDOM,
      task,
      redactionInfo: redacted.redactionMeta
    });

    state.status = 'executing';
    if (serverResp.action && serverResp.action.action !== 'DONE') {
      addLog(`🧠 Thought: ${serverResp.action.thought}`);
      addLog(`⚡ Executing: ${serverResp.action.action}`);
      chrome.tabs.sendMessage(tab.id, {
        type: 'EXECUTE_ACTION',
        action: serverResp.action,
        mappingRegistry: registry._debug()
      }, () => {
        if (chrome.runtime.lastError) console.warn("Action execution warning:", chrome.runtime.lastError);
      });
      // Mark idle after dispatching the action
      state.status = 'idle';
      addLog('Task Complete');
    } else {
      if (serverResp.action && serverResp.action.thought) {
        addLog(`🧠 Thought: ${serverResp.action.thought}`);
      }
      state.status = 'idle';
      addLog('Task Complete');
    }
  } catch (err) {
    state.status = 'idle';
    addLog(`Error: ${err.message}`);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXECUTE_TASK') {
    runPipeline(msg.task);
    sendResponse({ status: 'started' });
  } else if (msg.type === 'GET_STATE') {
    sendResponse(state);
  }
  return true;
});
