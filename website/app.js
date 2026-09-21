const output = document.querySelector('#output');
const run = document.querySelector('#run');
const sequence = [
  ['14:13', 'INCIDENT', 'Users API integrity failures observed'],
  ['14:13', 'BOUNDARY', 'M039 + api-users@902a isolated'],
  ['14:14', 'CANDIDATE', 'checkpoint-v17 reconstructed'],
  ['14:14', 'VERIFY', 'health · migration · schema · smoke · api · integrity — passed'],
  ['14:14', 'SIGNAL', 'READY · compatible · verified · current · 0 unknowns'],
  ['14:14', 'GUARD', 'ALLOW recovery branch; production mutation disabled'],
];
run.addEventListener('click', async () => {
  run.disabled = true; output.textContent = '';
  for (const [time, kind, message] of sequence) { await new Promise((resolve) => setTimeout(resolve, 360)); output.textContent += `${time}  ${kind.padEnd(9)} ${message}\n`; }
  run.textContent = 'Verified recovery candidate';
});
