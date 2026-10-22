# 🔥 AI Resume Roaster

> Paste a job description + your resume → Claude analyzes, roasts, and rewrites it to match the JD perfectly.

Built for **PromptWars** × **TierBreaker Community** at GKM College of Engineering.

---

## Features

- **JD Analysis** — extracts keywords, skills, and priorities from the job description
- **Resume Roast** — brutal, specific feedback on what's missing or weak
- **Smart Rewrite** — ATS-optimized resume rewritten to match the JD
- **Three modes** — Full chain / Roast only / Rewrite only
- **Streaming output** — see Claude's response token by token
- **No backend** — runs entirely in the browser

---

## Setup

### Option 1: Open locally
Just open `index.html` in your browser. No build step, no dependencies.

### Option 2: Deploy to Render / Vercel / Netlify
1. Push this folder to a GitHub repo
2. Connect the repo to Render/Vercel/Netlify
3. Set publish directory to `/` (root)
4. Deploy — done

**No environment variables needed.** Users enter their own Anthropic API key in the UI.

---

## Getting an API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in
3. Go to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-...`)
5. Paste it into the app

> The key is never stored — it stays in memory only while the tab is open.

---

## How it works

The app makes direct API calls to Anthropic's `/v1/messages` endpoint with streaming enabled.

**Prompt chain:**
1. **Analyze** — extract must-have skills and priorities from the JD
2. **Roast** — compare resume vs JD, identify gaps, score the match
3. **Rewrite** — generate a new resume with JD keywords injected naturally

---

## Stack

- Vanilla HTML, CSS, JavaScript — zero dependencies
- Anthropic Claude API (`claude-sonnet-4-6`)
- Server-Sent Events (SSE) for streaming

---

## License

MIT — build on it, fork it, remix it.

---

*TierBreaker Community · Non-tier-1 college. Tier-1 ambition.*
