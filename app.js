/**
 * Resume Roaster — app.js
 * AI-powered resume analysis using Anthropic's Claude API (streaming)
 * Built for PromptWars × TierBreaker Community
 */

'use strict';

// ─── DOM refs ────────────────────────────────────────────────────────────────
const apiKeyInput   = document.getElementById('api-key');
const toggleKeyBtn  = document.getElementById('toggle-key');
const jdInput       = document.getElementById('jd-input');
const resumeInput   = document.getElementById('resume-input');
const jdCount       = document.getElementById('jd-count');
const resumeCount   = document.getElementById('resume-count');
const modeBtns      = document.querySelectorAll('.mode-btn');
const runBtn        = document.getElementById('run-btn');
const errorMsg      = document.getElementById('error-msg');
const emptyState    = document.getElementById('empty-state');
const outputContainer = document.getElementById('output-container');
const outputCards   = document.getElementById('output-cards');
const outputActions = document.getElementById('output-actions');
const copyBtn       = document.getElementById('copy-btn');
const resetBtn      = document.getElementById('reset-btn');

// Progress steps
const stepAnalyze = document.getElementById('step-analyze');
const stepRoast   = document.getElementById('step-roast');
const stepRewrite = document.getElementById('step-rewrite');

// ─── State ───────────────────────────────────────────────────────────────────
let selectedMode = 'full';
let isRunning    = false;
let rewriteText  = '';   // stored for copy

// ─── Char counters ───────────────────────────────────────────────────────────
function updateCount(input, counter) {
  const len = input.value.length;
  counter.textContent = len.toLocaleString() + ' characters';
}
jdInput.addEventListener('input', () => updateCount(jdInput, jdCount));
resumeInput.addEventListener('input', () => updateCount(resumeInput, resumeCount));

// ─── Validate & enable run button ────────────────────────────────────────────
function validateForm() {
  const hasKey    = apiKeyInput.value.trim().startsWith('sk-ant-');
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
    modeBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
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

// ─── Stream a single Claude call ─────────────────────────────────────────────
async function streamClaude({ apiKey, systemPrompt, userPrompt, onChunk, onDone }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':         'application/json',
      'x-api-key':            apiKey,
      'anthropic-version':    '2023-06-01',
      'anthropic-beta':       'messages-2023-12-15',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: 1500,
      stream:     true,
      system:     systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${response.status}`);
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
      if (data === '[DONE]') continue;
      try {
        const json = JSON.parse(data);
        if (json.type === 'content_block_delta' && json.delta?.text) {
          onChunk(json.delta.text);
        }
      } catch { /* ignore malformed SSE */ }
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

  // Validate
  const apiKey = apiKeyInput.value.trim();
  const jd     = jdInput.value.trim();
  const resume = resumeInput.value.trim();

  setError('');

  if (!apiKey.startsWith('sk-ant-')) {
    setError('Invalid API key. It should start with sk-ant-');
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

  const systemPrompt = 'You are an expert career coach and resume optimizer. Be direct, specific, and genuinely helpful. Format your output cleanly for readability.';

  try {
    // ── Step 1: Analyze JD ──
    if (selectedMode === 'full') {
      setStepStatus(stepAnalyze, 'active');
      const analyzeEl = createCard({
        type: 'analyze', icon: '🔍', title: 'JD Analysis', badge: 'Step 1 of 3'
      });
      await streamClaude({
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
      await streamClaude({
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
      await streamClaude({
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

    // Done — show actions
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
    // Fallback: select the text element
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

// ─── Run button ───────────────────────────────────────────────────────────────
runBtn.addEventListener('click', runRoaster);

// Also allow Enter key in short inputs
apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') jdInput.focus();
});

// ─── Error helper ─────────────────────────────────────────────────────────────
function setError(msg) {
  errorMsg.textContent = msg;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
validateForm();
