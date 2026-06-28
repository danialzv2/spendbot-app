# SpendBot 💸

Too lazy to open your banking app and manually track spending? Same. So I built this instead.

SpendBot is an AI-powered spending tracker that lives on your phone as an app. You chat with it like a normal person, it figures out what you spent, logs it to Google Sheets, and shows you a dashboard so you actually know where your money went.

---

## What it does

**Chat to log spending** — just type naturally. No forms, no dropdowns.
```
you:      rm25 lunch mcdonalds
spendbot: ✅ Logged! Food · RM 25.00 · McDonald's
```

**Scan receipts** — tap the camera icon, take a photo of any receipt. AI reads the total automatically.

**Dashboard** — see spending by month, category breakdown, budget pace vs last month, and a list of every transaction with a delete button if you accidentally logged something wrong.

**Configure** — set your monthly salary and fixed commitments (rent, car loan, subscriptions). SpendBot calculates your actual disposable income so you know how much you really have left.

**Ask for advice** — it knows your spending history, so you can ask things like:
```
you: my salary is rm4500, am i overspending on food?
you: how much will i spend this month at this pace?
you: can i afford rm800 rent?
```

---

## How it works

Your messages go to a FastAPI server hosted on Google Cloud Run. Gemini AI parses what you said and decides whether it's a spending log, a summary request, or a financial question. The data lives in Google Sheets — one tab for spending, one for your config. The frontend is a PWA (a website that installs like an app on your iPhone).

Everything runs on free tiers. Total cost: RM 0 per month.

---

## Stack

- **Frontend** — React PWA, hosted on Vercel
- **Backend** — FastAPI (Python), hosted on Google Cloud Run
- **AI** — Google Gemini 3.1 Flash Lite
- **Database** — Google Sheets
- **Receipt scanning** — Gemini Vision

---

## Want to set it up yourself?

Read the [Setup Guide](SETUP.md). It walks through everything from cloning the repo to installing it on your phone.