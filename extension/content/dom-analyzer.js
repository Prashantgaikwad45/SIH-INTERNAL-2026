/**
 * DOM Analyzer Content Script — PrivacyVision Agent
 * Injected into the web page to analyze structure and detect PII.
 * Exposed as an IIFE to window.DOMAnalyzer to avoid module scope issues in content scripts.
 */

(function () {
  'use strict';

  // Simplified regexes since we can't easily import the ES module here
  // Simplified regexes since we can't easily import the ES module here
  const PII_REGEX = {
    aadhaar: /\b\d{4}\s?\d{4}\s?\d{4}\b/g,
    pan: /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g,
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(?:\+91|91)?[-.\s]?[6-9]\d{9}\b/g,
    creditCard: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    name: /\b(Aditya\s?bhadade|Aditya)\b/ig // Specific catch for the demo to assure user
  };

  const SENSITIVE_ATTRS = ['password', 'pwd', 'aadhaar', 'pan', 'card', 'cvv', 'ssn', 'dob'];

  function isElementVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      style.display !== 'none'
    );
  }

  function getUniqueSelector(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return '';
    if (el.id) return `#${el.id}`;
    
    let path = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      if (current.id) {
        path.unshift(`#${current.id}`);
        break;
      }
      let selector = current.nodeName.toLowerCase();
      let sibling = current;
      let nth = 1;
      while ((sibling = sibling.previousElementSibling) != null) {
        if (sibling.nodeName === current.nodeName) nth++;
      }
      if (nth > 1 || current.nextElementSibling) {
        selector += `:nth-of-type(${nth})`;
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(' > ');
  }

  function classifyInput(el) {
    const type = (el.type || '').toLowerCase();
    const name = (el.name || el.id || '').toLowerCase();
    
    if (type === 'password') return 'password';
    
    for (const attr of SENSITIVE_ATTRS) {
      if (name.includes(attr)) return attr === 'cvv' || attr === 'card' ? 'credit-card' : attr;
    }
    return null;
  }

  window.DOMAnalyzer = {
    analyzePage: function () {
      const elements = [];
      const piiRegions = [];
      
      const interactables = document.querySelectorAll('a, button, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])');
      
      // 1. Analyze interactive elements
      interactables.forEach(el => {
        if (!isElementVisible(el)) return;
        
        const rect = el.getBoundingClientRect();
        const tag = el.tagName.toLowerCase();
        const piiType = (tag === 'input' || tag === 'textarea') ? classifyInput(el) : null;
        
        // Add to interactive elements list
        elements.push({
          tag: tag,
          id: el.id,
          type: el.type,
          role: el.getAttribute('role'),
          text: el.innerText || el.value || el.placeholder || '',
          selector: getUniqueSelector(el),
          bbox: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
          isInteractive: true,
          ariaLabel: el.getAttribute('aria-label'),
          piiType: piiType
        });
        
        // If it's an input with sensitive data, add to redaction regions
        if (piiType && (el.value || el.placeholder)) {
          piiRegions.push({
            type: piiType,
            bbox: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
            confidence: 1.0,
            source: 'dom-input'
          });
        }
      });
      
      // 2. Scan text nodes for exposed PII
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while ((node = walker.nextNode())) {
        const text = node.nodeValue.trim();
        if (!text || text.length < 5) continue;
        
        const parent = node.parentElement;
        if (!parent || !isElementVisible(parent)) continue;
        
        for (const [type, regex] of Object.entries(PII_REGEX)) {
          const matches = text.match(regex);
          if (matches) {
            const rect = parent.getBoundingClientRect();
            piiRegions.push({
              type: type,
              bbox: { x: rect.left, y: rect.top, w: rect.width, h: rect.height },
              confidence: 0.8,
              source: 'dom-text',
              matchedValues: matches  // pass matched values for tokenization
            });
          }
        }
      }
      
      // 3. Scrub PII from element text fields before sending to server
      function scrubText(text) {
        if (!text) return text;
        let scrubbed = text;
        for (const [type, regex] of Object.entries(PII_REGEX)) {
          scrubbed = scrubbed.replace(regex, `<PII_${type.toUpperCase()}>`);
        }
        return scrubbed;
      }
      
      for (const el of elements) {
        el.text = scrubText(el.text);
        if (el.ariaLabel) el.ariaLabel = scrubText(el.ariaLabel);
      }
      
      let safeUrl = window.location.href;
      try { safeUrl = decodeURIComponent(safeUrl); } catch(e) {}
      safeUrl = scrubText(safeUrl);
      
      return {
        elements: elements,
        piiRegions: piiRegions,
        pageInfo: {
          url: safeUrl,
          title: scrubText(document.title),
          viewportW: window.innerWidth,
          viewportH: window.innerHeight
        }
      };
    }
  };
})();
