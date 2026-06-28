import json
from google import genai
from google.genai import types
from config import GEMINI_API_KEY, GEMINI_MODEL

_client = genai.Client(api_key=GEMINI_API_KEY)

_MAX_OUTPUT_TOKENS = 500

_ADVISOR_SYSTEM = """\
You are SpendBot's personal finance advisor for a Malaysian user. Be direct, concise, and specific.

Rules:
- Always reference the user's ACTUAL numbers. Never give generic advice.
- If salary and commitments are provided, factor them in for every answer.
- If user asks "can I afford X", calculate it explicitly: check budget_remaining_this_month.
- If user asks how much they can save, use: disposable_income - projected_spend.
- Use RM for all amounts. Max 3 short paragraphs or bullet points.
- Use Telegram-style formatting: *bold*, `numbers`. No # headers.
- End with one specific, actionable tip based on their actual data.
- If no salary is configured, remind them to set it in Configure tab for better advice.

Spending + financial context:
{context}

User question: {question}
"""

_CONTEXT_KEYS = [
    # Spending data
    "spend_today", "spend_this_week", "spend_this_month", "spend_last_month",
    "avg_daily_this_month", "avg_daily_last_month", "avg_daily_last_30_days",
    "projected_month_spend", "days_left_in_month",
    "top_categories_this_month", "avg_transaction_amount", "total_transactions_30d",
    # Config data (salary + commitments)
    "monthly_salary", "total_commitments", "commitments_detail",
    "disposable_income", "budget_remaining_this_month",
]


def _trim_context(context: dict) -> dict:
    trimmed = {k: context[k] for k in _CONTEXT_KEYS if k in context}
    if "top_categories_this_month" in trimmed:
        cats = trimmed["top_categories_this_month"]
        trimmed["top_categories_this_month"] = dict(list(cats.items())[:4])
    if "commitments_detail" in trimmed:
        # keep max 8 commitments to avoid token bloat
        trimmed["commitments_detail"] = trimmed["commitments_detail"][:8]
    return trimmed


async def get_advice(question: str, context: dict) -> str:
    """Get AI financial advice grounded in the user's real spending + config data."""
    if not context:
        return (
            "⚠️ No spending data yet. "
            "Log some transactions first!\n\n"
            "Try: `rm25 lunch mcdonalds`"
        )

    trimmed     = _trim_context(context)
    context_str = json.dumps(trimmed, separators=(",", ":"))
    prompt      = _ADVISOR_SYSTEM.format(context=context_str, question=question)

    response = _client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            max_output_tokens=_MAX_OUTPUT_TOKENS,
            temperature=0.4,
        ),
    )
    return response.text.strip()