import os
from dotenv import load_dotenv
from zoneinfo import ZoneInfo

load_dotenv()

# ── Credentials ───────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GSHEET_NAME    = os.environ.get("GSHEET_NAME", "SpendBot")
GSHEET_CREDS   = os.environ["GSHEET_CREDS"]

# ── App PIN (protects the API from public access) ─────────────────────────────
# Set this in Cloud Run env vars — never commit the actual PIN
APP_PIN = os.environ.get("APP_PIN", "")

# ── Gemini models ─────────────────────────────────────────────────────────────
GEMINI_MODEL           = "gemini-3.1-flash-lite-preview"
GEMINI_FALLBACK_MODEL  = "gemini-2.5-flash"
GEMINI_FALLBACK_MODEL2 = "gemini-2.5-flash-lite"

# ── Timezone ──────────────────────────────────────────────────────────────────
MY_TZ = ZoneInfo("Asia/Kuala_Lumpur")  # UTC+8

# ── Category emoji map ────────────────────────────────────────────────────────
CAT_EMOJI = {
    "Food":          "🍜",
    "Drinks":        "🧋",
    "Groceries":     "🛒",
    "Clothing":      "👕",
    "Transport":     "🚗",
    "Entertainment": "🎮",
    "Health":        "💊",
    "Bills":         "📄",
    "Other":         "📦",
}