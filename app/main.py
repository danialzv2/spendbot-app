import json
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import List
from zoneinfo import ZoneInfo

from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from sheets import (
    init_sheet, init_config_sheet,
    insert_spending, delete_transaction,
    query_summary, get_financial_context,
    get_user_config, save_user_config,
)
from gemini import parse_message
from advisor import get_advice
from receipt import parse_receipt
from formatters import format_log_reply, format_receipt_reply, format_summary, HELP_TEXT
from config import APP_PIN

# ── App lifecycle ─────────────────────────────────────────────────────────────
sheet        = None
config_sheet = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global sheet, config_sheet
    sheet        = init_sheet()
    config_sheet = init_config_sheet()
    yield

app = FastAPI(lifespan=lifespan)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Auth ──────────────────────────────────────────────────────────────────────
async def verify_pin(authorization: str = Header(default=None)):
    if not APP_PIN:
        return
    if authorization != f"Bearer {APP_PIN}":
        raise HTTPException(status_code=401, detail="Invalid PIN")

# ── Pydantic models ───────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message:  str
    chat_id:  str

class CommitmentItem(BaseModel):
    label:  str
    amount: float

class ConfigRequest(BaseModel):
    salary:      float = 0.0
    commitments: List[CommitmentItem] = []

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/")
@app.head("/")
async def health():
    return {"status": "SpendBot is running 🚀"}

# ── Auth endpoint ─────────────────────────────────────────────────────────────
@app.post("/auth")
async def auth(authorization: str = Header(default=None)):
    if not APP_PIN:
        return {"ok": True}
    if authorization != f"Bearer {APP_PIN}":
        raise HTTPException(status_code=401, detail="Invalid PIN")
    return {"ok": True}

# ── Chat (protected) ──────────────────────────────────────────────────────────
@app.post("/chat")
async def chat(req: ChatRequest, _: None = Depends(verify_pin)):
    reply = await _process_text(req.message, req.chat_id)
    return {"reply": reply}

# ── Receipt Upload (protected) ────────────────────────────────────────────────
@app.post("/receipt")
async def upload_receipt(
    chat_id: str,
    file: UploadFile = File(...),
    _: None = Depends(verify_pin),
):
    try:
        image_bytes = await file.read()
        mime_type   = file.content_type or "image/jpeg"
        parsed      = await parse_receipt(image_bytes, mime_type)
        if not parsed.get("amount"):
            return {"success": False, "reply": "⚠️ Couldn't read the total. Try a clearer photo or type it manually."}
        timestamp = insert_spending(
            sheet,
            chat_id  = chat_id,
            amount   = parsed["amount"],
            category = parsed.get("category", "Other"),
            place    = parsed.get("place") or "Unknown",
            note     = parsed.get("note") or "",
        )
        return {"success": True, "reply": format_receipt_reply(parsed, timestamp), "data": parsed}
    except Exception as e:
        return {"success": False, "reply": f"⚠️ Receipt error: {str(e)}"}

# ── Delete Transaction (protected) ────────────────────────────────────────────
@app.delete("/transaction")
async def remove_transaction(
    chat_id:   str = Query(...),
    timestamp: str = Query(...),
    _: None = Depends(verify_pin),
):
    """Delete a single spending row from Sheet1 matched by chat_id + timestamp."""
    deleted = delete_transaction(sheet, chat_id=chat_id, timestamp=timestamp)
    if deleted:
        return {"ok": True, "message": "Transaction deleted"}
    raise HTTPException(status_code=404, detail="Transaction not found")

# ── Config GET (protected) ────────────────────────────────────────────────────
@app.get("/config")
async def get_config(chat_id: str, _: None = Depends(verify_pin)):
    return get_user_config(config_sheet, chat_id)

# ── Config POST (protected) ───────────────────────────────────────────────────
@app.post("/config")
async def save_config(
    chat_id: str,
    body: ConfigRequest,
    _: None = Depends(verify_pin),
):
    save_user_config(
        config_sheet,
        chat_id     = chat_id,
        salary      = body.salary,
        commitments = [{"label": c.label, "amount": c.amount} for c in body.commitments],
    )
    return {"ok": True}

# ── Dashboard (protected) ─────────────────────────────────────────────────────
@app.get("/dashboard")
async def get_dashboard(chat_id: str, _: None = Depends(verify_pin)):
    MY_TZ    = ZoneInfo("Asia/Kuala_Lumpur")
    now      = datetime.now(MY_TZ)
    today    = now.date()
    yesterday        = today - timedelta(days=1)
    this_month       = now.strftime("%Y-%m")
    last_month       = (now.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
    this_week_start  = today - timedelta(days=today.weekday())

    records = sheet.get_all_records()
    rows = []
    for row in records:
        if str(row.get("chat_id")) != str(chat_id):
            continue
        try:
            ts = datetime.strptime(str(row["timestamp"]), "%Y-%m-%d %H:%M:%S").replace(tzinfo=MY_TZ)
        except Exception:
            continue
        rows.append({
            "timestamp":   row["timestamp"],
            "date":        ts.date(),
            "month":       ts.strftime("%Y-%m"),
            "month_label": ts.strftime("%B %Y"),
            "amount":      float(row.get("amount", 0)),
            "category":    row.get("category", "Other"),
            "place":       row.get("place", ""),
            "note":        row.get("note", ""),
        })

    if not rows:
        return {"overview": {}, "months": [], "all_time": {"by_category": {}, "transactions": [], "total": 0}}

    def sum_rows(rs):   return sum(r["amount"] for r in rs)
    def by_cat(rs):
        d = defaultdict(float)
        for r in rs:
            d[r["category"]] = round(d[r["category"]] + r["amount"], 2)
        return dict(sorted(d.items(), key=lambda x: x[1], reverse=True))
    def to_tx(rs):
        return sorted([
            {"timestamp": r["timestamp"], "amount": r["amount"],
             "category": r["category"], "place": r["place"], "note": r["note"]}
            for r in rs
        ], key=lambda x: x["timestamp"], reverse=True)

    today_rows       = [r for r in rows if r["date"] == today]
    yesterday_rows   = [r for r in rows if r["date"] == yesterday]
    this_week_rows   = [r for r in rows if r["date"] >= this_week_start]
    this_month_rows  = [r for r in rows if r["month"] == this_month]
    last_month_rows  = [r for r in rows if r["month"] == last_month]

    days_so_far = max((today - datetime.strptime(this_month + "-01", "%Y-%m-%d").date()).days + 1, 1)
    spend_this  = sum_rows(this_month_rows)
    cats_this   = by_cat(this_month_rows)
    top_cat     = max(cats_this, key=cats_this.get) if cats_this else "—"

    overview = {
        "spend_today":          round(sum_rows(today_rows), 2),
        "spend_yesterday":      round(sum_rows(yesterday_rows), 2),
        "spend_this_week":      round(sum_rows(this_week_rows), 2),
        "spend_this_month":     round(spend_this, 2),
        "spend_last_month":     round(sum_rows(last_month_rows), 2),
        "avg_daily_this_month": round(spend_this / days_so_far, 2),
        "tx_count_this_month":  len(this_month_rows),
        "days_so_far":          days_so_far,
        "top_category":         top_cat,
    }

    months_map = defaultdict(list)
    for r in rows:
        months_map[r["month"]].append(r)

    months_out = []
    for month_key in sorted(months_map.keys(), reverse=True):
        month_rows = months_map[month_key]
        months_out.append({
            "month":        month_key,
            "label":        month_rows[0]["month_label"],
            "total":        round(sum_rows(month_rows), 2),
            "tx_count":     len(month_rows),
            "by_category":  by_cat(month_rows),
            "transactions": to_tx(month_rows),
        })

    all_time = {
        "total":        round(sum_rows(rows), 2),
        "tx_count":     len(rows),
        "by_category":  by_cat(rows),
        "transactions": to_tx(rows),
    }

    return {"overview": overview, "months": months_out, "all_time": all_time}

# ── Text processing ───────────────────────────────────────────────────────────
async def _process_text(text: str, chat_id) -> str:
    try:
        parsed = await parse_message(text)
        intent = parsed.get("intent", "unknown")

        if parsed.get("is_spending") and intent == "log":
            timestamp = insert_spending(
                sheet,
                chat_id  = chat_id,
                amount   = parsed["amount"],
                category = parsed["category"],
                place    = parsed.get("place") or "Unknown",
                note     = parsed.get("note") or "",
            )
            return format_log_reply(parsed, timestamp)

        elif intent == "summary_today":
            return format_summary(query_summary(sheet, chat_id, "today"))
        elif intent == "summary_week":
            return format_summary(query_summary(sheet, chat_id, "week"))
        elif intent == "summary_month":
            return format_summary(query_summary(sheet, chat_id, "month"))

        elif intent == "advice":
            try:
                context = get_financial_context(sheet, chat_id)
                return await get_advice(question=text, context=context)
            except Exception as e:
                return f"⚠️ Couldn't generate advice: {str(e)}"

        elif intent == "help":
            return HELP_TEXT

        else:
            return "🤔 I didn't catch that. Try: rm25 lunch mcdonalds or type help"

    except json.JSONDecodeError:
        return "⚠️ Couldn't parse that. Try: rm25 food mcdonalds"
    except Exception as e:
        return f"⚠️ Something went wrong: {str(e)}"