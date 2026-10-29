import { HnlError, Machine, OP_INFO, encode, lineNumbers, parseLiteral, sayLines } from './hnl.js';

const $ = (id) => document.getElementById(id);
const LINE = 22;
const PAD = 10;
const MAX_STEPS = 3_000_000;
const DELAYS = [1000, 700, 500, 350, 250, 150, 90, 50, 25, 10];

const EXAMPLES = [
  { file: 'countdown.hnl', title: '카운트다운', stdin: '' },
  { file: 'hello.hnl', title: 'Hello, World!', stdin: '' },
  { file: 'sum.hnl', title: '덧셈 (입력 20 22)', stdin: '20 22' },
  { file: 'factorial.hnl', title: '팩토리얼 (입력 5)', stdin: '5' },
];

const DEFAULT_PROGRAM = `요이
티~~~원
아
줴줴이야
티~원 티원
줴줴이야!
티~원
아~~
아
예?
아뇨아뇨아뇨 티~~원
넌 나가라
`;

const COMMANDS = [
  ['요이', '시작'], ['넌 나가라', '끝'], ['예?', '질문 (0이 아니면 다음 줄 실행)'],
  ['줴줴이야', '숫자 출력'], ['줴줴이야!', '문자 출력'], ['이지랄ㅋㅋ', '입력'],
  ['아(혼잣말)', '주석'],
];

const code = $('code');
const stdin = $('stdin');
let machine = null;
let timer = null;
let errLine = -1;

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* 저장 안 돼도 괜찮아요 */ } },
};

function toB64(text) {
  let bin = '';
  new TextEncoder().encode(text).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function setStatus(message, kind = '') {
  const el = $('status');
  el.textContent = message;
  el.className = `status ${kind}`;
}

function updateGutter() {
  const infos = lineNumbers(code.value);
  const cur = machine ? machine.currentSrcLine : -1;
  $('gutter').innerHTML = infos.map((info, i) => {
    const label = !info ? '' : info.kind === 'start' ? '시작' : info.kind === 'end' ? '끝' : info.n;
    const cls = i === errLine ? ' class="err"' : i === cur ? ' class="cur"' : '';
    return `<div${cls}>${label}</div>`;
  }).join('');
  $('gutter').scrollTop = code.scrollTop;
  moveHighlight();
}

function moveHighlight() {
  const hl = $('hl');
  const idx = errLine >= 0 ? errLine : machine ? machine.currentSrcLine : -1;
  if (idx < 0) {
    hl.style.display = 'none';
    return;
  }
  hl.style.display = 'block';
  hl.classList.toggle('err', errLine >= 0);
  hl.style.transform = `translateY(${PAD + idx * LINE - code.scrollTop}px)`;
}

function revealCurrent() {
  const idx = machine ? machine.currentSrcLine : -1;
  if (idx < 0) return;
  const top = PAD + idx * LINE;
  if (top < code.scrollTop) code.scrollTop = top - LINE;
  else if (top + LINE > code.scrollTop + code.clientHeight - 20) code.scrollTop = top - code.clientHeight / 2;
}

function printable(value) {
  const n = Number(value);
  return n >= 33 && n < 127 ? String.fromCharCode(n) : '';
}

function renderStack() {
  const el = $('stack');
  if (!machine) {
    el.innerHTML = '<span class="empty">실행하면 여기에 쌓여요</span>';
    $('meta').textContent = '';
    return;
  }
  const items = machine.stack;
  const shown = items.slice(-40);
  const hidden = items.length - shown.length;
  el.innerHTML = (hidden > 0 ? `<span class="empty">… ${hidden}개 더</span>` : '')
    + (shown.length ? shown.map((v, i) => {
      const ch = printable(v);
      const top = i === shown.length - 1 ? ' top' : '';
      return `<span class="cell${top}">${v}${ch ? `<i>${ch.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</i>` : ''}</span>`;
    }).join('') : '<span class="empty">(비어있음)</span>');
  const next = machine.done ? '끝' : `다음 ${machine.pc + 1}번째 줄`;
  $('meta').textContent = `${machine.steps}스텝 · ${next}`;
}

function render() {
  $('out').textContent = machine ? machine.output : '';
  renderStack();
  updateGutter();
}

function handleError(e) {
  if (!(e instanceof HnlError)) throw e;
  const infos = lineNumbers(code.value);
  errLine = e.bodyLine ? infos.findIndex((x) => x && x.kind === 'n' && x.n === e.bodyLine) : -1;
  setStatus(e.message, 'error');
}

function makeMachine() {
  errLine = -1;
  try {
    return new Machine(code.value, stdin.value, MAX_STEPS);
  } catch (e) {
    handleError(e);
    return null;
  }
}

function finish() {
  setStatus(`✔ 끝났어요 (${machine.steps}스텝)`, 'ok');
}

function stopPlay() {
  if (timer) clearInterval(timer);
  timer = null;
  $('play').textContent = '⏯ 천천히';
}

function stepOnce() {
  if (!machine) {
    machine = makeMachine();
    if (!machine) { render(); return false; }
    setStatus('');
  }
  if (machine.done) { finish(); return false; }
  try {
    machine.step();
  } catch (e) {
    stopPlay();
    handleError(e);
    render();
    return false;
  }
  if (machine.done) finish();
  render();
  revealCurrent();
  return !machine.done;
}

function runAll() {
  stopPlay();
  machine = makeMachine();
  if (!machine) { render(); return; }
  try {
    machine.run();
    finish();
  } catch (e) {
    handleError(e);
  }
  render();
}

function togglePlay() {
  if (timer) { stopPlay(); return; }
  if (machine && machine.done) machine = null;
  $('play').textContent = '⏸ 멈춤';
  timer = setInterval(() => { if (!stepOnce()) stopPlay(); }, DELAYS[$('speed').value - 1]);
}

function resetMachine() {
  stopPlay();
  machine = null;
  errLine = -1;
  setStatus('');
  render();
}

function onEdit() {
  resetMachine();
  store.set('hnl.code', code.value);
  store.set('hnl.stdin', stdin.value);
}

function insertAtCaret(text, { line = false } = {}) {
  const start = code.selectionStart;
  const before = code.value.slice(0, start);
  let chunk = text;
  if (line) {
    if (before && !before.endsWith('\n')) chunk = `\n${chunk}`;
    chunk += '\n';
  }
  code.setRangeText(chunk, start, code.selectionEnd, 'end');
  code.focus();
  onEdit();
}

function buildPalette() {
  const groups = [
    ['명령', COMMANDS.map(([text, tip]) => ({ label: text, tip, run: () => insertAtCaret(text, { line: true }) }))],
    ['조각', [
      { label: '티~원', tip: '숫자 한 자리 (양수 시작)', run: () => insertAtCaret('티~원') },
      { label: '지~랄', tip: '음수로 시작', run: () => insertAtCaret('지~랄') },
      { label: '아뇨아뇨아뇨', tip: '점프 (뒤에 줄 번호)', run: () => insertAtCaret('아뇨아뇨아뇨 ') },
      { label: '~', tip: '늘임 추가', run: () => insertAtCaret('~') },
    ]],
    ['스택', OP_INFO.map((op, i) => ({
      label: `아${'~'.repeat(i)}`, tip: `${op.name}: ${op.stack}`, run: () => insertAtCaret(`아${'~'.repeat(i)}`, { line: true }),
    }))],
  ];
  $('palette').replaceChildren(...groups.map(([name, buttons]) => {
    const row = document.createElement('div');
    row.className = 'group';
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = name;
    row.append(label, ...buttons.map((b) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = b.label;
      btn.title = b.tip;
      btn.addEventListener('click', b.run);
      return btn;
    }));
    return row;
  }));
}

function buildCheatsheet() {
  const cmdRows = [
    ['숫자 리터럴', 'push (예: 티~원 티~~~~원 = 14)'],
    ['줴줴이야 / 줴줴이야!', '숫자 / 문자 출력 (pop)'],
    ['이지랄ㅋㅋ', '정수 입력 (EOF면 −1)'],
    ['예?', 'pop 해서 0이 아니면 다음 줄 실행, 아니면 건너뜀'],
    ['아뇨아뇨아뇨 N', 'N번째 줄로 점프'],
    ['넌 나가라', '종료'],
    ['아( … )', '주석 (줄 번호에 안 셈)'],
  ];
  const table = (head, rows) => `<table><tr><th>${head[0]}</th><th>${head[1]}</th></tr>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</table>`;
  $('cheat').innerHTML = table(['발화', '동작'], cmdRows)
    + table(['아 연산', 'b = 맨 위'], OP_INFO.map((op, i) => [`아${'~'.repeat(i)}`, `${op.name} · ${op.stack}`]));
}

function updateConverter() {
  const text = $('numIn').value.trim();
  const out = $('numOut');
  if (!text) { out.textContent = ''; return; }
  const lit = parseLiteral(text);
  if (lit !== null) out.textContent = `= ${lit}`;
  else if (/^[+-]?\d+$/.test(text)) out.textContent = encode(BigInt(text));
  else out.textContent = '정수나 늘임 토큰을 적어주세요';
}

async function fetchExample(file) {
  try {
    const res = await fetch(`examples/${file}`);
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

function buildExamples() {
  const select = $('examples');
  select.innerHTML = '<option value="">예제 불러오기…</option>'
    + EXAMPLES.map((e, i) => `<option value="${i}">${e.title}</option>`).join('');
  select.addEventListener('change', async () => {
    const ex = EXAMPLES[select.value];
    select.value = '';
    if (!ex) return;
    const text = await fetchExample(ex.file);
    if (text === null) { setStatus('예제를 불러오지 못했어요. 로컬 서버로 열어주세요.', 'error'); return; }
    code.value = text;
    stdin.value = ex.stdin;
    onEdit();
  });
}

async function share() {
  const params = new URLSearchParams({ c: toB64(code.value) });
  if (stdin.value) params.set('i', toB64(stdin.value));
  const url = `${location.origin}${location.pathname}#${params}`;
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    setStatus('링크를 복사했어요', 'ok');
  } catch {
    setStatus('주소창의 링크를 복사하세요', 'ok');
  }
}

function loadInitial() {
  try {
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.has('c')) {
      code.value = fromB64(params.get('c'));
      stdin.value = params.has('i') ? fromB64(params.get('i')) : '';
      return;
    }
  } catch { /* 깨진 링크면 저장된 코드로 */ }
  code.value = store.get('hnl.code') ?? DEFAULT_PROGRAM;
  stdin.value = store.get('hnl.stdin') ?? '';
}

code.addEventListener('input', onEdit);
stdin.addEventListener('input', onEdit);
code.addEventListener('scroll', () => {
  $('gutter').scrollTop = code.scrollTop;
  moveHighlight();
});
code.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runAll(); }
  if (e.key === 'F10') { e.preventDefault(); stepOnce(); }
});
$('run').addEventListener('click', runAll);
$('step').addEventListener('click', () => { stopPlay(); stepOnce(); });
$('play').addEventListener('click', togglePlay);
$('reset').addEventListener('click', resetMachine);
$('share').addEventListener('click', share);
$('speed').addEventListener('input', () => { if (timer) { stopPlay(); togglePlay(); } });
$('numIn').addEventListener('input', updateConverter);
$('numInsert').addEventListener('click', () => {
  const text = $('numIn').value.trim();
  const lit = parseLiteral(text);
  if (lit !== null) insertAtCaret(text, { line: true });
  else if (/^[+-]?\d+$/.test(text)) insertAtCaret(encode(BigInt(text)), { line: true });
});
$('sayInsert').addEventListener('click', () => {
  const text = $('sayIn').value;
  if (text) insertAtCaret(sayLines(text).join('\n'), { line: true });
});

buildExamples();
buildPalette();
buildCheatsheet();
loadInitial();
render();
