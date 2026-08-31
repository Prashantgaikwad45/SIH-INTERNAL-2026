"""
Action Parser — PrivacyVision Agent
"""
import json
import re
from schemas import BrowserAction, ActionType

class ActionParser:
    @staticmethod
    def parse(text: str) -> BrowserAction:
        try:
            cleaned = text.strip()
            if '```json' in cleaned:
                cleaned = cleaned.split('```json')[1].split('```')[0].strip()
                
            start = cleaned.find('{')
            end = cleaned.rfind('}') + 1
            if start >= 0 and end > start:
                data = json.loads(cleaned[start:end])
                return BrowserAction(**data)
        except Exception:
            pass
            
        return BrowserAction(
            thought=text[:200],
            action=ActionType.WAIT,
            confidence=0.1
        )
