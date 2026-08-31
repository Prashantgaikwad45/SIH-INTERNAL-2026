/**
 * Content Script Bridge — PrivacyVision Agent
 * Listens for messages from the Service Worker and delegates to DOMAnalyzer / ActionExecutor.
 */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'ANALYZE_DOM') {
    try {
      const data = window.DOMAnalyzer.analyzePage();
      sendResponse({ status: 'ok' });
      // Send result back asynchronously
      chrome.runtime.sendMessage({
        type: 'DOM_ANALYSIS_RESULT',
        data: data
      });
    } catch (err) {
      console.error('[Content] DOM Analysis error:', err);
    }
  } 
  
  else if (msg.type === 'EXECUTE_ACTION') {
    try {
      window.ActionExecutor.executeAction(msg.action, msg.mappingRegistry)
        .then(result => {
          chrome.runtime.sendMessage({
            type: 'ACTION_COMPLETE',
            data: result
          });
        });
      sendResponse({ status: 'executing' });
    } catch (err) {
      console.error('[Content] Action Execution error:', err);
    }
  }
  
  return true;
});
