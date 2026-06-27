import json
from datetime import datetime, timedelta
import gspread
from google.oauth2.service_account import Credentials
from config import GSHEET_CREDS, GSHEET_NAME, MY_TZ

_SCOPES = [
    "https://spreadsheets.google.com/feeds",
    "https://www.googleapis.com/auth/drive",
]

def _get_client():
    """Authenticate and return a gspread client."""
    import re as _re
    creds_raw = GSHEET_CREDS

    def fix_private_key(s: str) -> str:
        match = _re.search(r'"private_key"\s*:\s*"(.*?)"(?=\s*,)', s, _re.DOTALL)
        if match:
            key_val   = match.group(1)
            key_fixed = key_val.replace('\n', '\\n').replace('\r', '')
            s = s[:match.start(1)] + key_fixed + s[match.end(1):]
        return s

    creds_raw  = fix_private_key(creds_raw)
    creds_dict = json.loads(creds_raw)
    creds      = Credentials.from_service_account_info(creds_dict, scopes=_SCOPES)
    return gspread.authorize(creds)


# ── Sheet 1 — Spending ────────────────────────────────────────────────────────

def init_sheet():
    """Authenticate and return Sheet1 (spending log), creating headers if needed."""
    client = _get_client()
    sheet  = client.open(GSHEET_NAME).sheet1
    if not sheet.row_values(1):
        sheet.append_row(
            ["timestamp", "chat_id", "amount", "category", "place", "note"],
            value_input_option="USER_ENTERED"
        )
    return sheet


def insert_spending(sheet, chat_id, amount, category, place, note) -> str:
    """Append a spending row. Returns the timestamp string."""
    now_my = datetime.now(MY_TZ).strftime("%Y-%m-%d %H:%M:%S")
    sheet.append_row(
        [now_my, str(chat_id), amount, category, place, note],
        value_input_option="USER_ENTERED"
    )
    return now_my


def delete_transaction(sheet, chat_id: str, timestamp: str) -> bool:
    """Delete a transaction row matching chat_id + timestamp.
    
    Sheet1 columns: timestamp(0) | chat_id(1) | amount(2) | category(3) | place(4) | note(5)
    Returns True if a row was found and deleted, False otherwise.
    """
    all_values = sheet.get_all_values()  # includes header row

    for i, row in enumerate(all_values[1:], start=2):  # skip header, 1-based index
        row_timestamp = str(row[0]).strip()
        row_chat_id   = str(row[1]).strip()
        if row_timestamp == str(timestamp).strip() and row_chat_id == str(chat_id).strip():
            sheet.delete_rows(i)
            return True

    return False  # no matching row found


def query_summary(sheet, chat_id: int, period: str = "month") -> dict:
    """Return spending breakdown for today / week / this calendar month."""
    records = sheet.get_all_records()
    now_my  = datetime.now(MY_TZ)

    if period == "today":
        cutoff = now_my.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        cutoff = now_my - timedelta(days=7)
    else:
        cutoff = now_my.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    breakdown: dict[str, float] = {}
    total = 0.0

    for row in records:
        if str(row.get("chat_id")) != str(chat_id):
            continue
        try:
            ts_naive = datetime.strptime(str(row["timestamp"]), "%Y-%m-%d %H:%M:%S")
            ts_my    = ts_naive.replace(tzinfo=MY_TZ)
        except Exception:
            continue
        if ts_my < cutoff:
            continue

        cat = row.get("category", "Other")
        amt = float(row.get("amount", 0))
        breakdown[cat] = breakdown.get(cat, 0.0) + amt
        total += amt

    breakdown = dict(sorted(breakdown.items(), key=lambda x: x[1], reverse=True))
    return {"total": total, "breakdown": breakdown, "period": period}


def get_financial_context(sheet, chat_id: int) -> dict:
    """Build a rich spending context dict for the AI advisor."""
    records  = sheet.get_all_records()
    now_my   = datetime.now(MY_TZ)
    today    = now_my.date()

    this_month_str = now_my.strftime("%Y-%m")
    last_month_dt  = (now_my.replace(day=1) - timedelta(days=1))
    last_month_str = last_month_dt.strftime("%Y-%m")

    rows = []
    for row in records:
        if str(row.get("chat_id")) != str(chat_id):
            continue
        try:
            ts = datetime.strptime(str(row["timestamp"]), "%Y-%m-%d %H:%M:%S").replace(tzinfo=MY_TZ)
        except Exception:
            continue
        rows.append({
            "date":     ts.date(),
            "month":    ts.strftime("%Y-%m"),
            "amount":   float(row.get("amount", 0)),
            "category": row.get("category", "Other"),
            "place":    row.get("place", ""),
        })

    if not rows:
        return {}

    this_month_rows = [r for r in rows if r["month"] == this_month_str]
    last_month_rows = [r for r in rows if r["month"] == last_month_str]
    last_30_rows    = [r for r in rows if r["date"] >= today - timedelta(days=30)]
    last_7_rows     = [r for r in rows if r["date"] >= today - timedelta(days=7)]
    today_rows      = [r for r in rows if r["date"] == today]

    def total(rs):   return round(sum(r["amount"] for r in rs), 2)
    def by_cat(rs):
        d = {}
        for r in rs:
            d[r["category"]] = round(d.get(r["category"], 0) + r["amount"], 2)
        return dict(sorted(d.items(), key=lambda x: x[1], reverse=True))
    def by_place(rs):
        d = {}
        for r in rs:
            if r["place"] and r["place"] != "Unknown":
                d[r["place"]] = round(d.get(r["place"], 0) + r["amount"], 2)
        return dict(sorted(d.items(), key=lambda x: x[1], reverse=True))

    days_in_month_so_far = max((today - today.replace(day=1)).days + 1, 1)
    days_last_month      = last_month_dt.day
    total_this           = total(this_month_rows)
    total_last           = total(last_month_rows)

    return {
        "today":                     str(today),
        "spend_today":               total(today_rows),
        "spend_this_week":           total(last_7_rows),
        "spend_this_month":          total_this,
        "spend_last_month":          total_last,
        "avg_daily_this_month":      round(total_this / days_in_month_so_far, 2),
        "avg_daily_last_month":      round(total_last / days_last_month, 2) if days_last_month else 0,
        "avg_daily_last_30_days":    round(total(last_30_rows) / 30, 2),
        "projected_month_spend":     round(total_this / days_in_month_so_far * 30, 2),
        "days_left_in_month":        (today.replace(month=today.month % 12 + 1, day=1) - timedelta(days=1)).day - today.day,
        "top_categories_this_month": by_cat(this_month_rows),
        "top_categories_last_30":    by_cat(last_30_rows),
        "top_places_last_30":        dict(list(by_place(last_30_rows).items())[:5]),
        "total_transactions_30d":    len(last_30_rows),
        "avg_transaction_amount":    round(total(last_30_rows) / len(last_30_rows), 2) if last_30_rows else 0,
    }


# ── Sheet 2 — Config ──────────────────────────────────────────────────────────

def init_config_sheet():
    """Return Sheet2 (config), creating it if it doesn't exist."""
    client      = _get_client()
    spreadsheet = client.open(GSHEET_NAME)
    worksheets  = spreadsheet.worksheets()

    if len(worksheets) >= 2:
        config_sheet = worksheets[1]
    else:
        config_sheet = spreadsheet.add_worksheet(title="Config", rows=200, cols=4)

    if not config_sheet.row_values(1):
        config_sheet.append_row(
            ["chat_id", "type", "label", "amount"],
            value_input_option="USER_ENTERED"
        )
    return config_sheet


def get_user_config(config_sheet, chat_id: str) -> dict:
    """Read salary and commitments for a given chat_id from Sheet2."""
    records     = config_sheet.get_all_records()
    salary      = 0.0
    commitments = []

    for row in records:
        if str(row.get("chat_id")) != str(chat_id):
            continue
        row_type = str(row.get("type", "")).strip().lower()
        if row_type == "salary":
            salary = float(row.get("amount", 0) or 0)
        elif row_type == "commitment":
            commitments.append({
                "label":  str(row.get("label", "")),
                "amount": float(row.get("amount", 0) or 0),
            })

    return {"salary": salary, "commitments": commitments}


def save_user_config(config_sheet, chat_id: str, salary: float, commitments: list) -> None:
    """Overwrite all config rows for a given chat_id in Sheet2."""
    all_values    = config_sheet.get_all_values()
    rows_to_delete = [
        i + 2
        for i, row in enumerate(all_values[1:])
        if str(row[0]) == str(chat_id)
    ]
    for row_idx in reversed(rows_to_delete):
        config_sheet.delete_rows(row_idx)

    config_sheet.append_row(
        [str(chat_id), "salary", "Monthly Salary", salary],
        value_input_option="USER_ENTERED"
    )
    for c in commitments:
        config_sheet.append_row(
            [str(chat_id), "commitment", c["label"], c["amount"]],
            value_input_option="USER_ENTERED"
        )