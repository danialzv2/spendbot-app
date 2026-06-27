import json
import re
from google import genai
from google.genai import types
from config import GEMINI_API_KEY, GEMINI_MODEL

_client = genai.Client(api_key=GEMINI_API_KEY)

_RECEIPT_PROMPT = """\
You are reading a receipt image for a Malaysian user's expense tracker.
Extract the spending details and return ONLY valid JSON, no markdown, no extra text.

JSON keys:
- amount    : float  (total amount paid in RM; look for TOTAL, JUMLAH, AMOUNT DUE)
- category  : one of [Food, Drinks, Groceries, Clothing, Transport, Entertainment, Health, Bills, Other]
- place     : string (merchant/store name from the receipt)
- note      : string (max 8 words describing what was purchased)
- items     : list of strings (top 3 line items if visible, else empty list)
- confidence: "high" | "medium" | "low" (how confident you are in the total amount)

If you cannot read the receipt or find a total, set amount to null.

Example output:
{
  "amount": 45.80,
  "category": "Food",
  "place": "McDonald's Sunway",
  "note": "fast food meal combo",
  "items": ["McValue Meal", "McFlurry", "Fries"],
  "confidence": "high"
}
"""


async def parse_receipt(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """Parse a receipt image and extract spending info using Gemini Vision.

    Args:
        image_bytes: Raw image bytes (JPEG, PNG, WEBP supported)
        mime_type:   MIME type of the image (default: image/jpeg)

    Returns:
        dict with keys: amount, category, place, note, items, confidence
    """
    response = _client.models.generate_content(
        model=GEMINI_MODEL,
        contents=[
            types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
            types.Part.from_text(text=_RECEIPT_PROMPT),
        ],
        config=types.GenerateContentConfig(
            max_output_tokens=256,
            temperature=0.1,
        ),
    )
    raw = re.sub(r"```json|```", "", response.text).strip()
    return json.loads(raw)