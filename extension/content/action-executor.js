/**
 * Action Executor Content Script — PrivacyVision Agent
 * Executes browser actions (clicks, typing, etc.) requested by the VLM.
 * Resolves PII placeholders securely using the local registry mapping.
 */

(function () {
  'use strict';

  // Helper to sleep
  const delay = ms => new Promise(res => setTimeout(res, ms));

  function getElementBySelectorOrCoords(target) {
    if (!target) return null;
    
    if (target.selector) {
      const el = document.querySelector(target.selector);
      if (el) return el;
    }
    
    if (target.coordinates) {
      const el = document.elementFromPoint(target.coordinates.x, target.coordinates.y);
      if (el) return el;
    }
    
    return null;
  }

  function simulateTyping(el, text) {
    el.focus();
    // For React/SPA compatibility, we must update the value descriptor
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, text);
    } else {
      el.value = text;
    }
    
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function resolveTokens(text, mappingRegistry) {
    if (!text || !mappingRegistry) return text;
    let resolved = text;
    for (const [token, value] of Object.entries(mappingRegistry)) {
      resolved = resolved.split(token).join(value);
    }
    return resolved;
  }

  window.ActionExecutor = {
    executeAction: async function (actionData, mappingRegistry) {
      console.log('[ActionExecutor] Executing:', actionData);
      
      const { action, target, value } = actionData;
      let el = getElementBySelectorOrCoords(target);

      try {
        switch (action) {
          case 'CLICK':
            if (!el) throw new Error('Target element not found');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(300); // Wait for scroll
            el.click();
            return { success: true, message: `Clicked ${target.selector || 'element'}` };

          case 'TYPE':
            if (!el) throw new Error('Target element not found');
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await delay(300);
            
            // SECURITY: Resolve PII placeholders from local mapping registry
            const realValue = resolveTokens(value, mappingRegistry);
            simulateTyping(el, realValue);
            return { success: true, message: `Typed into ${target.selector || 'element'} (PII resolved securely)` };

          case 'SELECT':
            if (!el) throw new Error('Target element not found');
            el.value = value;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true, message: `Selected ${value}` };

          case 'SCROLL':
            const scrollAmount = window.innerHeight * 0.8;
            if (value === 'down') window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
            else if (value === 'up') window.scrollBy({ top: -scrollAmount, behavior: 'smooth' });
            else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            await delay(500);
            return { success: true, message: `Scrolled ${value}` };

          case 'NAVIGATE':
            if (!value) throw new Error('No URL provided');
            window.location.href = value;
            return { success: true, message: `Navigating to ${value}` };
            
          case 'WAIT':
            return { success: true, message: `Waiting...` };

          case 'DONE':
            return { success: true, message: `Task completed` };

          default:
            throw new Error(`Unknown action type: ${action}`);
        }
      } catch (err) {
        console.error('[ActionExecutor] Error:', err);
        return { success: false, message: err.message };
      }
    }
  };
})();
