const output = document.querySelector('#output');
const run = document.querySelector('#run');
const demoStatus = document.querySelector('#demo-status');

const recoverySequence = [
  ['14:13', 'INCIDENT', 'Users API integrity failures observed'],
  ['14:13', 'BOUNDARY', 'M039 + api-users@902a isolated'],
  ['14:14', 'CANDIDATE', 'checkpoint-v17 reconstructed'],
  ['14:14', 'VERIFY', 'health · migration · schema · smoke · api · integrity — passed'],
  ['14:14', 'SIGNAL', 'READY · compatible · verified · current · 0 unknowns'],
  ['14:14', 'GUARD', 'ALLOW recovery branch; production mutation disabled'],
];

run.addEventListener('click', async () => {
  run.disabled = true;
  output.textContent = '';
  demoStatus.textContent = 'Rendering deterministic evidence';
  for (const [time, kind, message] of recoverySequence) {
    await new Promise((resolve) => window.setTimeout(resolve, 360));
    output.textContent += `${time}  ${kind.padEnd(9)} ${message}\n`;
  }
  run.textContent = 'Verified recovery candidate';
  demoStatus.textContent = 'Receipt generated · no provider calls';
  run.disabled = false;
});

const frames = [
  {
    kind: 'OBSERVED FAILURE',
    eyebrow: 'INCIDENT INPUT',
    title: 'The users API fails after v1.8.',
    copy: 'A deployment, a schema revision, and a function revision changed together. Reprise records the relationship before it proposes a response.',
    evidence: ['deployment v1.8', 'schema S13', 'function F18'],
    glyph: '!',
    caption: 'Sample data · incident-acquisition · no live provider calls',
  },
  {
    kind: 'CHANGE BOUNDARY',
    eyebrow: 'EVIDENCE, NOT TIMESTAMPS',
    title: 'The boundary is a set of changes, not a guess.',
    copy: 'Reprise connects the incident to the migration and function revision while retaining the supporting deployment and schema evidence.',
    evidence: ['migration M104', 'function F18', 'schema S13', 'deployment v1.8'],
    glyph: '↯',
    caption: 'Deterministic sample boundary · conflicting evidence remains visible',
  },
  {
    kind: 'COMPATIBLE CHECKPOINT',
    eyebrow: 'RECONSTRUCTION',
    title: 'v1.7 is rebuilt as a compound checkpoint.',
    copy: 'The selected candidate carries the compatible schema, function, and storage contract together. A database point alone is not treated as sufficient.',
    evidence: ['checkpoint-v17', 'schema S12', 'function F17', 'contract C6'],
    glyph: '↺',
    caption: 'Local checkpoint reconstruction · provider-independent reasoning',
  },
  {
    kind: 'VERIFIED, THEN GUARDED',
    eyebrow: 'SAFE EXIT CRITERIA',
    title: 'A receipt proves what passed—and what stays blocked.',
    copy: 'Six checks verify the candidate. The Recovery Guard then compares the live revision supplied by an executor and keeps production mutation explicitly disabled.',
    evidence: ['6 checks passed', 'Signal: READY', 'guard: ALLOW', 'production: disabled'],
    glyph: '✓',
    caption: 'Tamper-evident receipt · explicit authorization still required',
  },
];

const briefShell = document.querySelector('#brief-shell');
const briefIndex = document.querySelector('#brief-index');
const briefKind = document.querySelector('#brief-kind');
const briefEyebrow = document.querySelector('#brief-eyebrow');
const briefTitle = document.querySelector('#brief-title');
const briefCopy = document.querySelector('#brief-copy');
const briefEvidence = document.querySelector('#brief-evidence');
const briefGlyph = document.querySelector('#brief-glyph');
const briefCaption = document.querySelector('#brief-caption');
const briefProgress = document.querySelector('#brief-progress');
const playBrief = document.querySelector('#play-brief');
const nextBrief = document.querySelector('#next-brief');
const stepButtons = [...document.querySelectorAll('.brief-steps [data-step]')];
let activeFrame = 0;
let briefingTimer;

function showFrame(index) {
  activeFrame = (index + frames.length) % frames.length;
  const frame = frames[activeFrame];
  briefShell.dataset.step = String(activeFrame);
  briefIndex.textContent = `${String(activeFrame + 1).padStart(2, '0')} / ${String(frames.length).padStart(2, '0')}`;
  briefKind.textContent = frame.kind;
  briefEyebrow.textContent = frame.eyebrow;
  briefTitle.textContent = frame.title;
  briefCopy.textContent = frame.copy;
  briefGlyph.textContent = frame.glyph;
  briefCaption.textContent = frame.caption;
  briefProgress.style.width = `${((activeFrame + 1) / frames.length) * 100}%`;
  briefEvidence.replaceChildren(...frame.evidence.map((item) => {
    const chip = document.createElement('span');
    chip.textContent = item;
    return chip;
  }));
  stepButtons.forEach((button, buttonIndex) => button.setAttribute('aria-selected', String(buttonIndex === activeFrame)));
}

function stopBriefing() {
  window.clearInterval(briefingTimer);
  briefingTimer = undefined;
  playBrief.setAttribute('aria-pressed', 'false');
  playBrief.innerHTML = '<span aria-hidden="true">▶</span> Play briefing';
}

function startBriefing() {
  showFrame(activeFrame + 1);
  playBrief.setAttribute('aria-pressed', 'true');
  playBrief.innerHTML = '<span aria-hidden="true">Ⅱ</span> Pause briefing';
  briefingTimer = window.setInterval(() => showFrame(activeFrame + 1), 3600);
}

playBrief.addEventListener('click', () => briefingTimer ? stopBriefing() : startBriefing());
nextBrief.addEventListener('click', () => {
  stopBriefing();
  showFrame(activeFrame + 1);
});
stepButtons.forEach((button) => button.addEventListener('click', () => {
  stopBriefing();
  showFrame(Number(button.dataset.step));
}));

showFrame(0);
