/**
 * Resume Roaster — app.js
 * AI-powered resume analysis using Google Gemini API (streaming)
 * Built for PromptWars × TierBreaker Community
 */

'use strict';

// ─── DOM refs ────────────────────────────────────────────────────────────────
const apiKeyInput     = document.getElementById('api-key');
const toggleKeyBtn    = document.getElementById('toggle-key');
const jdInput         = document.getElementById('jd-input');
const resumeInput     = document.getElementById('resume-input');
const jdCount         = document.getElementById('jd-count');
const resumeCount     = document.getElementById('resume-count');
const modeBtns        = document.querySelectorAll('.mode-btn');
const runBtn          = document.getElementById('run-btn');
const errorMsg        = document.getElementById('error-msg');
const emptyState      = document.getElementById('empty-state');
const outputContainer = document.getElementById('output-container');
const outputCards     = document.getElementById('output-cards');
const outputActions   = document.getElementById('output-actions');
const copyBtn         = document.getElementById('copy-btn');
const resetBtn        = document.getElementById('reset-btn');

// Progress steps
const stepAnalyze = document.getElementById('step-analyze');
const stepRoast   = document.getElementById('step-roast');
const stepRewrite = document.getElementById('step-rewrite');

// ─── Config ──────────────────────────────────────────────────────────────────
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models';

// ─── State ───────────────────────────────────────────────────────────────────
let selectedMode = 'full';
let isRunning    = false;
let rewriteText  = '';

// ─── Char counters ───────────────────────────────────────────────────────────
function updateCount(input, counter) {
  counter.textContent = input.value.length.toLocaleString() + ' characters';
}
jdInput.addEventListener('input',     () => updateCount(jdInput, jdCount));
resumeInput.addEventListener('input', () => updateCount(resumeInput, resumeCount));

// ─── Validate & enable run button ────────────────────────────────────────────
function validateForm() {
  const hasKey    = apiKeyInput.value.trim().length > 10;
  const hasJD     = jdInput.value.trim().length > 50;
  const hasResume = resumeInput.value.trim().length > 50;
  runBtn.disabled = !(hasKey && hasJD && hasResume) || isRunning;
}
[apiKeyInput, jdInput, resumeInput].forEach(el =>
  el.addEventListener('input', validateForm)
);

// ─── Toggle API key visibility ────────────────────────────────────────────────
toggleKeyBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleKeyBtn.querySelector('svg').style.opacity = isPassword ? '0.5' : '1';
});

// ─── Mode selection ───────────────────────────────────────────────────────────
modeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    modeBtns.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    selectedMode = btn.dataset.mode;
  });
});

// ─── Progress helpers ─────────────────────────────────────────────────────────
function setStepStatus(step, status) {
  step.dataset.status = status;
}
function resetProgress() {
  [stepAnalyze, stepRoast, stepRewrite].forEach(s => setStepStatus(s, 'pending'));
}

// ─── Output card builder ─────────────────────────────────────────────────────
function createCard({ type, icon, title, badge }) {
  const card = document.createElement('div');
  card.className = `output-card card-type-${type}`;
  card.innerHTML = `
    <div class="output-card-header">
      <span class="card-icon" aria-hidden="true">${icon}</span>
      <span class="card-title">${title}</span>
      <span class="card-badge">${badge}</span>
    </div>
    <div class="output-card-body">
      <p class="output-text streaming" id="text-${type}"></p>
    </div>
  `;
  outputCards.appendChild(card);
  return document.getElementById(`text-${type}`);
}

// ─── Stream a single Gemini call ─────────────────────────────────────────────
async function streamGemini({ apiKey, systemPrompt, userPrompt, onChunk, onDone }) {
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?key=${apiKey}&alt=sse`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: userPrompt }]
      }],
      generationConfig: {
        maxOutputTokens: 1500,
        temperature: 0.7,
      }
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    const msg = err?.error?.message || `Gemini API error ${response.status}`;
    throw new Error(msg);
  }

  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) onChunk(text);
      } catch { /* ignore malformed SSE chunks */ }
    }
  }

  onDone();
}

// ─── Prompts ─────────────────────────────────────────────────────────────────
function buildAnalyzePrompt(jd) {
  return `Here is a job description:\n\n${jd}\n\nExtract and list exactly:
1. The top 8 must-have technical skills or keywords
2. The top 4 soft skills or traits
3. The seniority level expected
4. The 3 biggest priorities for this role

Be concise. Use bullet points. No fluff.`;
}

function buildRoastPrompt(jd, resume) {
  return `Job Description:\n${jd}\n\nResume:\n${resume}\n\n
You are a brutally honest senior recruiter. Roast this resume against the JD.
- What are the 5 biggest weaknesses or gaps?
- What keywords from the JD are completely missing?
- What would make a recruiter reject this in 10 seconds?
- Give a match score out of 10 with brief reasoning

Be specific, brutal, but constructive. No sugarcoating.`;
}

function buildRewritePrompt(jd, resume) {
  return `Job Description:\n${jd}\n\nOriginal Resume:\n${resume}\n\n
Rewrite this resume to perfectly match the job description.
Requirements:
- Inject the exact keywords and phrases from the JD naturally
- Reframe experience to highlight relevance
- Make the summary/objective directly address this role
- Ensure it would pass ATS screening
- Keep it professional, honest, and one-page friendly
- Do NOT add fake experience — only reframe real experience

Output the full rewritten resume text, ready to copy-paste.`;
}

// ─── Run the roaster ─────────────────────────────────────────────────────────
async function runRoaster() {
  if (isRunning) return;

  const apiKey = apiKeyInput.value.trim();
  const jd     = jdInput.value.trim();
  const resume = resumeInput.value.trim();

  setError('');

  if (apiKey.length < 10) {
    setError('Please enter a valid Gemini API key.');
    return;
  }
  if (jd.length < 50) {
    setError('Please paste a proper job description (at least 50 characters).');
    return;
  }
  if (resume.length < 50) {
    setError('Please paste your resume (at least 50 characters).');
    return;
  }

  // Setup UI
  isRunning = true;
  rewriteText = '';
  runBtn.classList.add('loading');
  runBtn.querySelector('.btn-text').textContent = 'Running...';
  outputCards.innerHTML = '';
  outputActions.hidden = true;
  emptyState.hidden = true;
  outputContainer.hidden = false;
  resetProgress();

  const systemPrompt = 'You are an expert career coach and resume optimizer. Be direct, specific, and genuinely helpful. Format your output cleanly with bullet points and clear sections.';

  try {
    // ── Step 1: Analyze JD ──
    if (selectedMode === 'full') {
      setStepStatus(stepAnalyze, 'active');
      const analyzeEl = createCard({
        type: 'analyze', icon: '🔍', title: 'JD Analysis', badge: 'Step 1 of 3'
      });
      await streamGemini({
        apiKey,
        systemPrompt,
        userPrompt: buildAnalyzePrompt(jd),
        onChunk: (text) => { analyzeEl.textContent += text; },
        onDone:  () => {
          analyzeEl.classList.remove('streaming');
          setStepStatus(stepAnalyze, 'done');
        },
      });
    }

    // ── Step 2: Roast ──
    if (selectedMode === 'full' || selectedMode === 'roast') {
      const isRoastOnly = selectedMode === 'roast';
      setStepStatus(isRoastOnly ? stepAnalyze : stepRoast, 'active');
      if (!isRoastOnly) setStepStatus(stepAnalyze, 'done');

      const roastEl = createCard({
        type: 'roast', icon: '🔥', title: 'The Roast', badge: isRoastOnly ? 'Full analysis' : 'Step 2 of 3'
      });
      await streamGemini({
        apiKey,
        systemPrompt,
        userPrompt: buildRoastPrompt(jd, resume),
        onChunk: (text) => { roastEl.textContent += text; },
        onDone:  () => {
          roastEl.classList.remove('streaming');
          setStepStatus(isRoastOnly ? stepAnalyze : stepRoast, 'done');
        },
      });
    }

    // ── Step 3: Rewrite ──
    if (selectedMode === 'full' || selectedMode === 'rewrite') {
      const isRewriteOnly = selectedMode === 'rewrite';
      setStepStatus(isRewriteOnly ? stepAnalyze : stepRewrite, 'active');
      if (!isRewriteOnly) setStepStatus(stepRoast, 'done');

      const rewriteEl = createCard({
        type: 'rewrite', icon: '✨', title: 'Rewritten Resume', badge: isRewriteOnly ? 'Optimized' : 'Step 3 of 3'
      });
      await streamGemini({
        apiKey,
        systemPrompt,
        userPrompt: buildRewritePrompt(jd, resume),
        onChunk: (text) => {
          rewriteEl.textContent += text;
          rewriteText += text;
        },
        onDone: () => {
          rewriteEl.classList.remove('streaming');
          setStepStatus(isRewriteOnly ? stepAnalyze : stepRewrite, 'done');
        },
      });
    }

    // Done
    outputActions.hidden = false;

  } catch (err) {
    setError('Error: ' + (err.message || 'Something went wrong. Check your API key and try again.'));
    resetProgress();
  } finally {
    isRunning = false;
    runBtn.classList.remove('loading');
    runBtn.querySelector('.btn-text').textContent = 'Run Roaster';
    validateForm();
  }
}

// ─── Copy rewritten resume ────────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  if (!rewriteText) return;
  try {
    await navigator.clipboard.writeText(rewriteText);
    const orig = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = orig; }, 2000);
  } catch {
    const el = document.getElementById('text-rewrite');
    if (el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
    }
  }
});

// ─── Reset ────────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  outputCards.innerHTML = '';
  outputActions.hidden = true;
  outputContainer.hidden = true;
  emptyState.hidden = false;
  rewriteText = '';
  setError('');
  resetProgress();
});

// ─── Run button + keyboard ────────────────────────────────────────────────────
runBtn.addEventListener('click', runRoaster);
apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') jdInput.focus();
});

// ─── Error helper ─────────────────────────────────────────────────────────────
function setError(msg) {
  errorMsg.textContent = msg;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
validateForm();
