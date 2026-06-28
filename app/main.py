import json
import calendar
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import List
from zoneinfo import ZoneInfo

from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sheets import (
    init_sheet, init_config_sheet,
    insert_spending, delete_transaction, update_transaction,
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

# ── Valid categories ──────────────────────────────────────────────────────────
VALID_CATEGORIES = {
    "Food", "Drinks", "Groceries", "Clothing",
    "Transport", "Entertainment", "Health", "Bills", "Other",
}

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

class TransactionRequest(BaseModel):
    chat_id:  str
    amount:   float
    category: str
    place:    str = "Unknown"
    note:     str = ""

class UpdateTransactionRequest(BaseModel):
    chat_id:   str
    timestamp: str
    amount:    float
    category:  str
    place:     str = "Unknown"
    note:      str = ""

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
            sheet, chat_id=chat_id, amount=parsed["amount"],
            category=parsed.get("category", "Other"),
            place=parsed.get("place") or "Unknown",
            note=parsed.get("note") or "",
        )
        return {"success": True, "reply": format_receipt_reply(parsed, timestamp), "data": parsed}
    except Exception as e:
        return {"success": False, "reply": f"⚠️ Receipt error: {str(e)}"}

# ── Add Transaction (protected) ───────────────────────────────────────────────
@app.post("/transaction")
async def add_transaction(body: TransactionRequest, _: None = Depends(verify_pin)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    category  = body.category if body.category in VALID_CATEGORIES else "Other"
    timestamp = insert_spending(
        sheet, chat_id=body.chat_id, amount=body.amount,
        category=category, place=body.place.strip() or "Unknown", note=body.note.strip() or "",
    )
    return {
        "ok": True,
        "transaction": {
            "timestamp": timestamp, "amount": body.amount,
            "category": category, "place": body.place.strip() or "Unknown", "note": body.note.strip() or "",
        }
    }

# ── Update Transaction (protected) ───────────────────────────────────────────
@app.put("/transaction")
async def modify_transaction(body: UpdateTransactionRequest, _: None = Depends(verify_pin)):
    """Update amount/category/place/note of an existing transaction in Sheet1."""
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    category = body.category if body.category in VALID_CATEGORIES else "Other"
    updated  = update_transaction(
        sheet,
        chat_id   = body.chat_id,
        timestamp = body.timestamp,
        amount    = body.amount,
        category  = category,
        place     = body.place.strip() or "Unknown",
        note      = body.note.strip() or "",
    )
    if updated:
        return {
            "ok": True,
            "transaction": {
                "timestamp": body.timestamp, "amount": body.amount,
                "category": category, "place": body.place.strip() or "Unknown", "note": body.note.strip() or "",
            }
        }
    raise HTTPException(status_code=404, detail="Transaction not found")

# ── Delete Transaction (protected) ────────────────────────────────────────────
@app.delete("/transaction")
async def remove_transaction(
    chat_id:   str = Query(...),
    timestamp: str = Query(...),
    _: None = Depends(verify_pin),
):
    deleted = delete_transaction(sheet, chat_id=chat_id, timestamp=timestamp)
    if deleted:
        return {"ok": True}
    raise HTTPException(status_code=404, detail="Transaction not found")

# ── Config GET (protected) ────────────────────────────────────────────────────
@app.get("/config")
async def get_config(chat_id: str, _: None = Depends(verify_pin)):
    return get_user_config(config_sheet, chat_id)

# ── Config POST (protected) ───────────────────────────────────────────────────
@app.post("/config")
async def save_config(chat_id: str, body: ConfigRequest, _: None = Depends(verify_pin)):
    save_user_config(
        config_sheet, chat_id=chat_id, salary=body.salary,
        commitments=[{"label": c.label, "amount": c.amount} for c in body.commitments],
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
    days_in_month    = calendar.monthrange(now.year, now.month)[1]

    records = sheet.get_all_records()
    rows = []
    for row in records:
        if str(row.get("chat_id")) != str(chat_id): continue
        try:
            ts = datetime.strptime(str(row["timestamp"]), "%Y-%m-%d %H:%M:%S").replace(tzinfo=MY_TZ)
        except Exception:
            continue
        rows.append({
            "timestamp": row["timestamp"], "date": ts.date(),
            "month": ts.strftime("%Y-%m"), "month_label": ts.strftime("%B %Y"),
            "amount": float(row.get("amount", 0)), "category": row.get("category", "Other"),
            "place": row.get("place", "") or "", "note": row.get("note", "") or "",
            "day_of_week": ts.strftime("%A"),
        })

    config        = get_user_config(config_sheet, chat_id)
    salary        = config.get("salary", 0)
    commitments   = config.get("commitments", [])
    total_commits = sum(c["amount"] for c in commitments)
    disposable    = max(salary - total_commits, 0) if salary > 0 else 0

    if not rows:
        empty = _compute_insights([], salary, disposable, days_in_month, 0, 0)
        return {"overview": {}, "months": [], "all_time": {"by_category": {}, "transactions": [], "total": 0}, "insights": empty}

    def sum_rows(rs):   return round(sum(r["amount"] for r in rs), 2)
    def by_cat(rs):
        d = defaultdict(float)
        for r in rs: d[r["category"]] = round(d[r["category"]] + r["amount"], 2)
        return dict(sorted(d.items(), key=lambda x: x[1], reverse=True))
    def to_tx(rs):
        return sorted([{"timestamp": r["timestamp"], "amount": r["amount"], "category": r["category"], "place": r["place"], "note": r["note"]} for r in rs], key=lambda x: x["timestamp"], reverse=True)

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
        "spend_today": round(sum_rows(today_rows), 2), "spend_yesterday": round(sum_rows(yesterday_rows), 2),
        "spend_this_week": round(sum_rows(this_week_rows), 2), "spend_this_month": round(spend_this, 2),
        "spend_last_month": round(sum_rows(last_month_rows), 2), "avg_daily_this_month": round(spend_this / days_so_far, 2),
        "tx_count_this_month": len(this_month_rows), "days_so_far": days_so_far, "top_category": top_cat,
    }

    months_map = defaultdict(list)
    for r in rows: months_map[r["month"]].append(r)

    months_out = []
    for month_key in sorted(months_map.keys(), reverse=True):
        month_rows = months_map[month_key]
        months_out.append({"month": month_key, "label": month_rows[0]["month_label"], "total": round(sum_rows(month_rows), 2), "tx_count": len(month_rows), "by_category": by_cat(month_rows), "transactions": to_tx(month_rows)})

    all_time = {"total": round(sum_rows(rows), 2), "tx_count": len(rows), "by_category": by_cat(rows), "transactions": to_tx(rows)}
    insights = _compute_insights(rows, salary, disposable, days_in_month, days_so_far, spend_this)
    return {"overview": overview, "months": months_out, "all_time": all_time, "insights": insights}


def _compute_insights(rows, salary, disposable, days_in_month, days_so_far, spend_this):
    DOW = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    heatmap = {d: 0.0 for d in DOW}
    if rows and days_so_far > 0:
        now = datetime.now(ZoneInfo("Asia/Kuala_Lumpur"))
        this_month_str = now.strftime("%Y-%m")
        for r in rows:
            if r.get("month") == this_month_str:
                heatmap[r["day_of_week"]] = round(heatmap[r["day_of_week"]] + r["amount"], 2)

    days_remaining = max(days_in_month - days_so_far, 1)
    current_daily  = round(spend_this / days_so_far, 2) if days_so_far > 0 else 0

    if disposable > 0:
        target_daily = round(disposable / days_in_month, 2)
        ratio        = current_daily / target_daily if target_daily > 0 else 0
        if ratio <= 0.85:
            pace = {"status": "under",    "headline": "You're spending slower than expected.", "sub": "Great.",                                              "current": current_daily, "target": target_daily, "adjust_by": None}
        elif ratio <= 1.15:
            pace = {"status": "on_track", "headline": "You're right on track.",               "sub": "Keep it up.",                                         "current": current_daily, "target": target_daily, "adjust_by": None}
        else:
            overshoot = round(current_daily - target_daily, 2)
            pace = {"status": "over",     "headline": "You're overspending.",                 "sub": f"Reduce by RM{overshoot}/day to stay within budget.",  "current": current_daily, "target": target_daily, "adjust_by": overshoot}
    else:
        pace = {"status": "no_config", "headline": "Set your salary in Configure for pace tracking.", "sub": "", "current": current_daily, "target": 0, "adjust_by": None}

    daily_safe_spend   = {"has_config": True,  "amount": max(round((disposable - spend_this) / days_remaining, 2), 0), "budget_remaining": round(disposable - spend_this, 2), "days_remaining": days_remaining, "disposable": disposable} if disposable > 0 and days_remaining > 0 else {"has_config": False}
    savings_projection = {"has_config": True,  "projected_spend": round((spend_this / days_so_far) * days_in_month, 2), "projected_savings": round(disposable - round((spend_this / days_so_far) * days_in_month, 2), 2), "disposable": disposable} if disposable > 0 and days_so_far > 0 else {"has_config": False}

    return {"heatmap": heatmap, "pace": pace, "daily_safe_spend": daily_safe_spend, "savings": savings_projection, "anomalies": _detect_anomalies(rows)}


def _detect_anomalies(rows, recent_days=14):
    if not rows: return []
    try:
        today = max(r["date"] for r in rows)
        cutoff = today - timedelta(days=recent_days)
        recent = [r for r in rows if r["date"] >= cutoff]
        seen, found = set(), []
        for tx in sorted(recent, key=lambda x: x["timestamp"], reverse=True):
            key = tx["timestamp"]
            if key in seen: continue
            place = (tx.get("place") or "").strip(); category = tx.get("category", "Other"); amount = tx["amount"]; tx_date = tx["date"]; day_name = tx["day_of_week"]
            if place and place.lower() != "unknown":
                same_place = [r for r in rows if (r.get("place") or "").strip() == place and r["timestamp"] != key]
                if len(same_place) >= 3:
                    avg = sum(r["amount"] for r in same_place) / len(same_place)
                    if amount > avg * 2:
                        found.append({"timestamp": key, "place": place, "category": category, "amount": amount, "description": f"You usually spend RM{avg:.0f} at {place}. This visit was RM{amount:.0f} — {round(amount/avg,1)}x higher than usual."}); seen.add(key); continue
            same_dow = [r for r in rows if r["day_of_week"] == day_name and r.get("category") == category and r["timestamp"] != key]
            if len(same_dow) >= 4:
                avg = sum(r["amount"] for r in same_dow) / len(same_dow)
                if amount > avg * 2.5:
                    found.append({"timestamp": key, "place": place, "category": category, "amount": amount, "description": f"This is {round(amount/avg,1)}x higher than your average {day_name} {category.lower()} spend of RM{avg:.0f}."}); seen.add(key); continue
            if place and place.lower() != "unknown":
                place_history = [r for r in rows if (r.get("place") or "").strip() == place and r["timestamp"] != key]
                if len(place_history) >= 2:
                    last_visit = max(r["date"] for r in place_history); days_since = (tx_date - last_visit).days
                    if days_since >= 45:
                        found.append({"timestamp": key, "place": place, "category": category, "amount": amount, "description": f"You haven't been to {place} in {days_since} days."}); seen.add(key); continue
        return found[:5]
    except Exception:
        return []


async def _process_text(text: str, chat_id) -> str:
    try:
        parsed = await parse_message(text)
        intent = parsed.get("intent", "unknown")
        if parsed.get("is_spending") and intent == "log":
            timestamp = insert_spending(sheet, chat_id=chat_id, amount=parsed["amount"], category=parsed["category"], place=parsed.get("place") or "Unknown", note=parsed.get("note") or "")
            return format_log_reply(parsed, timestamp)
        elif intent == "summary_today":  return format_summary(query_summary(sheet, chat_id, "today"))
        elif intent == "summary_week":   return format_summary(query_summary(sheet, chat_id, "week"))
        elif intent == "summary_month":  return format_summary(query_summary(sheet, chat_id, "month"))
        elif intent == "advice":
            try:
                context = get_financial_context(sheet, chat_id)
                config  = get_user_config(config_sheet, chat_id)
                salary  = config.get("salary", 0)
                if salary > 0:
                    now_my        = datetime.now(ZoneInfo("Asia/Kuala_Lumpur"))
                    total_commits = sum(c["amount"] for c in config.get("commitments", []))
                    disposable    = max(salary - total_commits, 0)
                    spend_this    = context.get("spend_this_month", 0)
                    days_so_far   = max((now_my.date() - now_my.date().replace(day=1)).days + 1, 1)
                    days_in_month = calendar.monthrange(now_my.year, now_my.month)[1]
                    proj_spend    = round((spend_this / days_so_far) * days_in_month, 2) if days_so_far > 0 else 0
                    context.update({"monthly_salary": salary, "total_commitments": total_commits, "commitments_detail": config.get("commitments", []), "disposable_income": disposable, "budget_remaining_this_month": round(disposable - spend_this, 2), "days_left_in_month": days_in_month - days_so_far, "projected_savings_this_month": round(disposable - proj_spend, 2)})
                return await get_advice(question=text, context=context)
            except Exception as e:
                return f"⚠️ Couldn't generate advice: {str(e)}"
        elif intent == "help": return HELP_TEXT
        else: return "🤔 I didn't catch that. Try: rm25 lunch mcdonalds or type help"
    except json.JSONDecodeError:
        return "⚠️ Couldn't parse that. Try: rm25 food mcdonalds"
    except Exception as e:
        return f"⚠️ Something went wrong: {str(e)}"