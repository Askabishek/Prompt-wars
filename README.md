# 🔥 AI Resume Roaster — PromptWars

Paste a job description and your resume to get a job-requirement analysis, candid gap review, and an honest ATS-aware rewrite.

Built for **PromptWars × TierBreaker Community** at GKM College of Engineering.

## Features
- JD analysis: skills, keywords, soft skills, seniority, and priorities
- Resume review with evidence-based gaps and a match estimate
- Resume rewrite that explicitly avoids inventing experience or achievements
- Three modes: Full Chain, Roast Only, Rewrite Only
- Streaming output and copy-to-clipboard
- Responsive, dependency-free frontend

## Run locally
Open `index.html` in a modern browser. For best results, use a local static server (for example, `python -m http.server 8000`) and open `http://localhost:8000`.

## Gemini API key and privacy
1. Create a key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Paste it into the app.
3. The key is held in page memory and sent to Google's API in the `x-goog-api-key` request header; it is not saved by this app or placed in the request URL. Clear the field and close the tab when finished.

**Important:** This is a client-side demo. Your browser necessarily uses the API key, so do not use a sensitive, shared, or production key on a public deployment. Restrict the key in Google AI Studio / Google Cloud where supported. Resume text is sent to Google's API for processing. Do not paste information you are not comfortable sharing with that provider.

## Limits and accuracy
- Job description and resume inputs are limited to 20,000 characters each.
- AI output may be incorrect. Verify every claim and never accept invented metrics, credentials, or experience.
- The rewrite is a drafting aid, not a guarantee of passing an ATS or getting an interview.

## Tests
Run `npm test` (requires Node.js 18+). Tests cover important client-side security and validation safeguards.
