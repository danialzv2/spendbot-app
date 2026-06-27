# Setup Guide

This guide walks you through setting up SpendBot from scratch. It takes about 30–45 minutes if you follow it step by step. You don't need any server knowledge — everything here uses free hosting with a simple web interface.

Before you start, make sure you have a Google account, a GitHub account, and a phone.

---

## Step 1 — Fork the repo

Go to the SpendBot GitHub repo and click **Fork** at the top right. This creates your own copy of the code that you can deploy and modify.

Once forked, you'll have something like `github.com/yourusername/spendbot-app`.

---

## Step 2 — Get a Gemini API key

SpendBot uses Google's Gemini 3.1 Flash Lite model to understand your messages. The free tier gives you 500 requests per day which is more than enough for personal use.

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the key and save it somewhere — you'll need it later

---

## Step 3 — Set up Google Sheets

This is where your spending data gets stored.

**Create the spreadsheet**

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet
2. Rename it to exactly `SpendBot` (capital S, capital B, no spaces)
3. Leave it empty — the app creates the headers on first run

**Create a service account** (this lets the app write to your sheet)

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project — name it anything, like `spendbot`
3. In the top search bar, search for **Google Sheets API** and click **Enable**
4. Do the same for **Google Drive API** — search and enable it
5. In the left sidebar, go to **IAM & Admin → Service Accounts**
6. Click **Create Service Account**
7. Give it a name like `spendbot-sheets` and click through to finish
8. Click on the service account you just created
9. Go to the **Keys** tab → **Add Key → Create New Key → JSON**
10. A JSON file will download to your computer — keep this safe

**Share your sheet with the service account**

1. Open the JSON file you just downloaded and find the `client_email` field — it looks like `something@project.iam.gserviceaccount.com`
2. Open your SpendBot Google Sheet and click **Share**
3. Paste that email address, set the role to **Editor**, and click Send

**Prepare the credentials**

The JSON file needs to be converted into a single line of text before you can use it as an environment variable.

1. Open the JSON file and copy all of its contents
2. Go to [jsonformatter.org/json-minify](https://jsonformatter.org/json-minify)
3. Paste the JSON, click Minify, and copy the result
4. Save this minified string — it will be your `GSHEET_CREDS` environment variable

---

## Step 4 — Deploy the backend to Cloud Run

The backend is your FastAPI server. Google Cloud Run hosts it for free and automatically deploys every time you push to GitHub.

**Connect your repo**

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and make sure you're on the project you created in Step 3
2. Search for **Cloud Run** in the top bar and open it
3. Click **Create Service**
4. Select **Continuously deploy from a repository**
5. Click **Set up with Cloud Build**
6. Choose **GitHub** as the source, authenticate, and select your forked repo
7. Click **Next**

**Configure the build**

On the next screen, set these:

- Branch: `^main$`
- Build Type: `Python via Google Cloud Buildpacks`
- Build context directory: `/app`

Click **Save**.

**Configure the service**

Back on the main form:

- Service name: `spendbot-api`
- Region: pick the one closest to you (for Malaysia, use `asia-southeast1`)
- Authentication: select **Allow unauthenticated invocations**

Then click **Container, Networking, Security** to expand it and set:

- Container port: `8080`
- Memory: `512 MiB`
- Startup CPU boost: turn this **On** (reduces cold start time)

**Add your environment variables**

Click on the **Variables & Secrets** tab and add these one by one:

| Variable | Value |
|----------|-------|
| `GEMINI_API_KEY` | the key from Step 2 |
| `GSHEET_NAME` | `SpendBot` |
| `GSHEET_CREDS` | the minified JSON string from Step 3 |
| `APP_PIN` | a PIN you choose — this protects your app from random people accessing it |

**Autoscaling**

Click the **Autoscaling** tab and set minimum instances to `0` and maximum to `3`. This keeps it on the free tier.

**Deploy**

Click **Create**. The first deploy takes 3–5 minutes. When it's done, you'll see a URL like `https://spendbot-api-xxxxxxxx-as.a.run.app`. Copy this URL.

**Verify it's working**

Open that URL in your browser. You should see:
```
{"status": "SpendBot is running 🚀"}
```

If you see that, the backend is live.

---

## Step 5 — Set up UptimeRobot

Cloud Run scales to zero when no one's using it, which means the first request after a long idle period can take a few seconds. UptimeRobot pings your API every 5 minutes to keep it warm.

1. Sign up for free at [uptimerobot.com](https://uptimerobot.com)
2. Click **Add New Monitor**
3. Set monitor type to `HTTP(s)`
4. Paste your Cloud Run URL from Step 4
5. Set the interval to 5 minutes
6. Click **Create Monitor**

That's it. UptimeRobot also emails you if your backend ever goes down, which is a nice bonus.

---

## Step 6 — Deploy the frontend to Vercel

The frontend is your React app. Vercel hosts it for free and also auto-deploys from GitHub.

1. Go to [vercel.com](https://vercel.com) and sign up with your GitHub account
2. Click **Add New → Project**
3. Find your forked repo and click **Import**
4. Before clicking Deploy, scroll down to **Environment Variables** and add:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | your Cloud Run URL from Step 4 |
| `VITE_USER_ID` | your user ID (see note below) |

**Finding your user ID**

Your user ID is the `chat_id` stored in your Google Sheet. Since you haven't used the app yet, you can set this to any unique string for now — like your name or `user_123`. Just remember what you set it to because this is how the app knows which rows in the sheet belong to you.

5. Click **Deploy**

Vercel will give you a URL like `https://spendbot-app.vercel.app`. This is your app.

---

## Step 7 — Install it on your phone

This is the part that makes it feel like a real app instead of a website.

**On iPhone:**
1. Open **Safari** (has to be Safari, not Chrome)
2. Go to your Vercel URL
3. Tap the **Share** button (the box with an arrow pointing up)
4. Scroll down and tap **Add to Home Screen**
5. Tap **Add**

SpendBot now has its own icon on your home screen. When you open it, it runs fullscreen with no browser bar — it looks and feels like a native app.

**On Android:**
1. Open Chrome and go to your Vercel URL
2. Tap the three-dot menu
3. Tap **Add to Home Screen**

---

## Step 8 — Log your first transaction

Open the app and enter the PIN you set in Step 4.

Then type something in the chat:

```
rm15 nasi lemak kl sentral
```

Check your Google Sheet — a new row should appear with the timestamp, amount, category, and place. If it's there, everything is working.

---

## Troubleshooting

**The app shows "Could not reach SpendBot"**

This usually means the `VITE_API_URL` in Vercel is wrong. Double-check that it matches your Cloud Run URL exactly, including `https://` and no trailing slash.

If you added the environment variable after your first deploy, Vercel won't pick it up automatically. Go to **Vercel → your project → Deployments → three dots → Redeploy**.

**Cloud Run deployment fails**

Check the logs: Cloud Run → your service → **Logs** tab. The most common cause is `GSHEET_CREDS` having line breaks in it. The JSON must be on a single line — re-minify it at jsonformatter.org/json-minify and update the environment variable.

**The dashboard shows no data**

Make sure the `VITE_USER_ID` in Vercel matches what's in the `chat_id` column of your Google Sheet. They need to match exactly.

**Wrong PIN error on login**

The PIN is stored in Cloud Run environment variables as `APP_PIN`. If you want to change it, go to Cloud Run → your service → **Edit & Deploy New Revision → Variables & Secrets** and update it there.

---

## Environment variables reference

Here's a full list of every variable used, so you have it in one place.

**Cloud Run (backend):**

| Variable | Where to get it |
|----------|----------------|
| `GEMINI_API_KEY` | aistudio.google.com/app/apikey |
| `GSHEET_NAME` | name of your Google Sheet (e.g. `SpendBot`) |
| `GSHEET_CREDS` | minified JSON from your service account key file |
| `APP_PIN` | any PIN you choose |

**Vercel (frontend):**

| Variable | Where to get it |
|----------|----------------|
| `VITE_API_URL` | your Cloud Run service URL |
| `VITE_USER_ID` | any unique string you choose (becomes your user ID) |