"""
PrivacyVision Agent — FastAPI Server
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from schemas import AnalyzeRequest, AnalyzeResponse
from vlm_engine import VLMEngine
import json
import time

app = FastAPI(title="PrivacyVision Agent Server")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

engine = VLMEngine()

@app.get("/health")
async def health():
    return {"status": "ok", "vlm": await engine.health_check()}

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest):
    action = await engine.analyze_screen(req.sanitized_image, req.model_dump())
    return AnalyzeResponse(action=action)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_json({"type": "connected", "connection_id": "test"})
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            print(f"[WS] Received message type: {msg.get('type')}, payload keys: {list(msg.get('payload', {}).keys())}")
            if msg.get("type") == "analyze":
                payload = msg.get("payload", {})
                img = payload.get("sanitized_image", "") or payload.get("sanitizedImage", "")
                print(f"[WS] Image payload length: {len(img)}, task: {payload.get('task', 'N/A')}")
                try:
                    action = await engine.analyze_screen(img, payload)
                    print(f"[WS] Gemini action: {action.action}, thought: {action.thought[:100]}")
                    await websocket.send_json({
                        "type": "action",
                        "action": action.model_dump(),
                        "conversation_id": payload.get("conversationId", "")
                    })
                except Exception as e:
                    print(f"[WS] ERROR during analysis: {e}")
                    await websocket.send_json({
                        "type": "action",
                        "action": {"thought": str(e), "action": "WAIT", "post_delay_ms": 500, "confidence": 0.0, "is_complete": False},
                        "conversation_id": payload.get("conversationId", "")
                    })
            elif msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                print(f"[WS] Unknown message type: {msg.get('type')}")
    except WebSocketDisconnect:
        print("[WS] Client disconnected")
    except Exception as e:
        print(f"[WS] Unexpected error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
