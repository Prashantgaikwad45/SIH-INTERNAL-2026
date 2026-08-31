"""
VLM Engine — PrivacyVision Agent (Powered by Gemini)
"""
import base64
import os
from google import genai
from google.genai import types
from schemas import BrowserAction
from prompt_templates import SYSTEM_PROMPT, build_user_prompt
from action_parser import ActionParser
from dotenv import load_dotenv

load_dotenv()

class VLMEngine:
    def __init__(self):
        # Using the latest gemini-3.6-flash model
        self.model_name = "gemini-3.6-flash"
        api_key = os.environ.get("GEMINI_API_KEY")
        
        if not api_key:
            print("WARNING: GEMINI_API_KEY environment variable not set. VLM will fail.")
            
        self.client = genai.Client(api_key=api_key)

    async def analyze_screen(self, image_base64: str, request_data: dict, conv_id: str = "") -> BrowserAction:
        try:
            prompt = build_user_prompt(request_data)
            
            # Prepare image
            img_data = image_base64
            if ',' in img_data:
                img_data = img_data.split(',', 1)[1]
            
            # Base64 padding fix
            img_data = img_data + '=' * (-len(img_data) % 4)
            
            try:
                raw_img = base64.b64decode(img_data)
            except Exception as e:
                return BrowserAction(thought=f"Base64 decode error: {str(e)}", action="WAIT", confidence=0.0)
            
            # Load into PIL to ensure it's a perfectly valid image structure before sending
            from io import BytesIO
            from PIL import Image
            
            try:
                img_pil = Image.open(BytesIO(raw_img)).convert("RGB")
            except Exception as e:
                return BrowserAction(thought=f"PIL Image Error: {str(e)}. Prefix: {image_base64[:50]}... Length: {len(image_base64)}", action="WAIT", confidence=0.0)
            
            # Generate content using the new SDK (it natively accepts PIL Images)
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=[prompt, img_pil],
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.1,
                    response_mime_type="application/json"
                )
            )
            
            print(f"DEBUG Gemini Raw Output: {response.text}")
            return ActionParser.parse(response.text)
        except Exception as e:
            print(f"Gemini API Error: {e}")
            return BrowserAction(thought=str(e), action="WAIT", confidence=0.0)

    async def health_check(self):
        try:
            return bool(os.environ.get("GEMINI_API_KEY"))
        except:
            return False
