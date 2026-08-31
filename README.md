# PrivacyVision Agent

**On-Device Visual Perception for Privacy-Preserving Browser Agents**

A Chrome browser extension powered by a Vision Language Model (VLM) backend that intelligently analyzes web pages, detects sensitive information, and executes privacy-preserving actions automatically.

---

## 🎯 Project Overview

PrivacyVision Agent is an innovative solution (SIH Problem #26171) that combines:
- **Browser Extension** — Seamless UI for users to submit tasks and monitor PII redaction
- **VLM-Powered Backend** — Analyzes DOM content and visual information to identify sensitive data
- **Automated Privacy Protection** — Detects and redacts personally identifiable information (PII) like names, emails, phone numbers, SSNs, and financial data
- **Intelligent Action Execution** — Performs context-aware browser actions based on visual understanding

---

## 📁 Project Structure

```
├── demo-site/              # Demo website for testing
│   ├── index.html
│   └── script.js
│
├── extension/              # Chrome extension (Manifest V3)
│   ├── manifest.json       # Extension configuration
│   ├── package.json
│   ├── background/         # Service worker
│   ├── content/            # Content scripts for DOM analysis & action execution
│   ├── popup/              # Main popup UI
│   ├── sidepanel/          # Side panel for extended interaction
│   ├── offscreen/          # Offscreen scripts for image processing
│   ├── icons/              # Extension icons
│   └── lib/                # Shared utilities
│       ├── api-client.js   # Server communication
│       ├── pii-patterns.js # PII detection patterns
│       ├── redaction.js    # Redaction logic
│       ├── mapping-registry.js
│
└── server/                 # FastAPI backend
    ├── main.py             # FastAPI server & WebSocket endpoints
    ├── vlm_engine.py       # Vision Language Model integration
    ├── action_parser.py    # Parse VLM responses into actions
    ├── prompt_templates.py # VLM prompt engineering
    ├── schemas.py          # Data models (Pydantic)
    └── requirements.txt    # Python dependencies
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 16+** (for extension development)
- **Python 3.9+** (for backend server)
- **Chrome/Chromium** browser
- **Google Gemini API key** (or compatible VLM provider)

### Backend Setup

1. **Install dependencies:**
   ```bash
   cd server
   pip install -r requirements.txt
   ```

2. **Configure environment variables:**
   Create a `.env` file in the `server/` directory:
   ```env
   GEMINI_API_KEY=your_api_key_here
   SERVER_HOST=localhost
   SERVER_PORT=8000
   ```

3. **Start the FastAPI server:**
   ```bash
   cd server
   python main.py
   ```
   The server will start on `http://localhost:8000`
   
   Check health: `curl http://localhost:8000/health`

### Extension Setup

1. **Navigate to extension folder:**
   ```bash
   cd extension
   npm install
   ```

2. **Load extension in Chrome:**
   - Open `chrome://extensions/`
   - Enable **Developer mode** (top-right)
   - Click **Load unpacked**
   - Select the `extension/` folder

3. **Configure extension:**
   - Update `extension/lib/api-client.js` to point to your server URL
   - Ensure the server is running before using the extension

### Demo Site

Open `demo-site/index.html` in your browser to test the extension against sample content.

---

## 💡 Key Features

### 🔐 PII Detection & Redaction
- **Automatic Detection** — Identifies names, emails, phone numbers, SSNs, credit cards, etc.
- **Visual Analysis** — Uses VLM to understand page context and semantic meaning
- **Smart Redaction** — Redacts sensitive data while preserving usability

### 🤖 Intelligent Task Execution
- **Natural Language Tasks** — Users describe what they want (e.g., "Log in with credentials")
- **Visual Understanding** — VLM analyzes screenshots to understand page layout
- **Context-Aware Actions** — Execute clicks, typing, navigation based on visual perception

### 🔄 WebSocket Communication
- **Real-time Analysis** — Low-latency communication between extension and server
- **Streaming Responses** — Immediate feedback on detected PII and recommended actions

### 🎨 User-Friendly Interface
- **Popup UI** — Quick task input and status monitoring
- **Side Panel** — Extended interaction and detailed logs
- **Visual Feedback** — Real-time redaction preview

---

## 🔌 API Endpoints

### REST API

**POST `/analyze`** — Analyze a screenshot for PII and get recommended actions
```json
{
  "sanitized_image": "base64_encoded_image",
  "task": "Extract all user information",
  "model": "gemini-2.0-flash"
}
```

Response:
```json
{
  "action": {
    "thought": "Analysis of the screenshot...",
    "action": "CLICK_BUTTON",
    "coordinates": [100, 50],
    "confidence": 0.95,
    "is_complete": false,
    "post_delay_ms": 1000
  }
}
```

**GET `/health`** — Check server and VLM engine status

### WebSocket `/ws`

Real-time bidirectional communication for continuous task execution:
```json
{
  "type": "analyze",
  "payload": {
    "sanitized_image": "base64_encoded_image",
    "task": "Fill login form",
    "conversationId": "session_123"
  }
}
```

---

## 📝 Configuration

### Server Configuration (`server/schemas.py`)
- **Model Selection** — Configure which VLM to use (Gemini, Claude, etc.)
- **Confidence Threshold** — Set minimum confidence for actions
- **PII Detection Sensitivity** — Adjust detection aggressiveness

### Extension Configuration
- **API Endpoint** — Update `extension/lib/api-client.js` with server URL
- **Redaction Style** — Configure visual redaction appearance
- **Auto-Submit** — Enable/disable automatic action execution

---

## 🧪 Development & Testing

### Running Tests
```bash
cd server
pytest tests/
```

### Debugging the Extension
1. Open `chrome://extensions/?id=EXTENSION_ID`
2. Click **Inspect views** under background service worker
3. Use Chrome DevTools to debug

### Debugging the Server
- Server logs are printed to console
- WebSocket messages are logged with `[WS]` prefix
- Add breakpoints in `vlm_engine.py` for VLM analysis debugging

---

## 🛠️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Chrome Browser                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           PrivacyVision Extension                    │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Popup / Side Panel (UI)                       │  │   │
│  │  │  • Task input                                  │  │   │
│  │  │  • Status monitoring                           │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │         ↓ WebSocket                                   │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  Service Worker + Content Scripts              │  │   │
│  │  │  • DOM Analysis                                │  │   │
│  │  │  • Screenshot Capture                          │  │   │
│  │  │  • Action Execution                            │  │   │
│  │  │  • PII Redaction                               │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                   WebSocket / REST API
                            │
┌───────────────────────────▼─────────────────────────────────┐
│          PrivacyVision FastAPI Server                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Endpoints                                         │ │
│  │  • POST /analyze                                       │ │
│  │  • WebSocket /ws                                       │ │
│  │  • GET /health                                         │ │
│  └────────────────────────────────────────────────────────┘ │
│         ↓                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  VLM Engine (Google Gemini)                            │ │
│  │  • Screenshot Analysis                                │ │
│  │  • PII Detection                                       │ │
│  │  • Action Planning                                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 📚 Tech Stack

| Component  | Technology                    |
|------------|-------------------------------|
| **Frontend** | JavaScript (ES6+), HTML5, CSS3 |
| **Backend** | Python 3.9+, FastAPI, WebSocket |
| **AI Model** | Google Gemini (VLM)          |
| **Extension** | Manifest V3                  |
| **Build** | Node.js, npm                  |

---

## 🔐 Privacy & Security

- **No Data Persistence** — Screenshots and PII are not stored permanently
- **Local Processing** — Extension operates locally in the browser
- **Sanitization** — Images can be pre-processed to remove sensitive visual data
- **HTTPS Only** — Server communication encrypted in production

---

## 📄 License

This project is developed for Smart India Hackathon 2026 (Problem #26171).

---

## 🤝 Contributing

1. Create a feature branch
2. Commit changes with clear messages
3. Submit a pull request

---

## 📞 Support & Issues

For issues, questions, or suggestions:
- Check existing GitHub issues
- Review server logs for API errors
- Enable developer mode in Chrome for extension debugging

---

## ✨ Future Enhancements

- [ ] Multi-language support for PII patterns
- [ ] Offline VLM models for privacy
- [ ] Advanced visual obfuscation techniques
- [ ] Integration with password managers
- [ ] Custom PII pattern definition UI
- [ ] Batch processing mode