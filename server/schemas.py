"""
Pydantic schemas for the PrivacyVision Agent server.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum

class ActionType(str, Enum):
    CLICK = "CLICK"
    TYPE = "TYPE"
    SCROLL = "SCROLL"
    SELECT = "SELECT"
    HOVER = "HOVER"
    WAIT = "WAIT"
    NAVIGATE = "NAVIGATE"
    DONE = "DONE"

class Coordinates(BaseModel):
    x: float
    y: float

class ActionTarget(BaseModel):
    selector: Optional[str] = None
    coordinates: Optional[Coordinates] = None

class BrowserAction(BaseModel):
    thought: str = Field(description="Model's reasoning for this action")
    action: ActionType
    target: Optional[ActionTarget] = None
    value: Optional[str] = None
    post_delay_ms: int = Field(default=500)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    is_complete: bool = Field(default=False)

class RedactionInfo(BaseModel):
    type: str
    bbox: Dict[str, float]
    tokenId: Optional[str] = None
    method: Optional[str] = None

class AnalyzeRequest(BaseModel):
    sanitized_image: str = Field(description="Base64 encoded sanitized screenshot")
    tokenized_dom: Dict[str, Any] = Field(default_factory=dict)
    task: str = Field(description="User's task")
    redaction_info: List[RedactionInfo] = Field(default_factory=list)
    conversation_id: str = Field(default="")
    page_info: Dict[str, Any] = Field(default_factory=dict)

class AnalyzeResponse(BaseModel):
    action: BrowserAction
    raw_response: Optional[str] = None
