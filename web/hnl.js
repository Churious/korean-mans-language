// 한남랭 코어. hnl/core.py와 같은 의미론이고, 정수는 BigInt로 다룬다.

export class HnlError extends Error {
  constructor(message, bodyLine = null) {
    super(message);
    this.bodyLine = bodyLine;
  }
}

const POS = /^티(~*)원$/;
const NEG = /^지(~*)랄$/;

export const OP_INFO = [
  { name: 'dup', desc: '맨 위를 복제', stack: 'a → a a' },
  { name: 'add', desc: '더하기', stack: 'a b → a+b' },
  { name: 'sub', desc: '빼기', stack: 'a b → a−b' },
  { name: 'swap', desc: '위 두 개 맞바꿈', stack: 'a b → b a' },
  { name: 'over', desc: '두 번째를 위로 복제', stack: 'a b → a b a' },
  { name: 'mul', desc: '곱하기', stack: 'a b → a×b' },
  { name: 'drop', desc: '맨 위 버림', stack: 'a →' },
  { name: 'div', desc: '나누기 (0쪽으로 버림)', stack: 'a b → a÷b' },
  { name: 'mod', desc: '나머지 (부호는 a를 따름)', stack: 'a b → a%b' },
  { name: 'less', desc: 'a<b면 1, 아니면 0', stack: 'a b → 0|1' },
];
const OP_NAMES = OP_INFO.map((o) => o.name);

const words = (text) => text.split(/\s+/).filter(Boolean);

function digit(match, lineno) {
  const n = match[1].length;
  if (n > 9) throw new HnlError(`${lineno}번째 줄: 한 자릿수는 ~를 9개까지만 늘일 수 있어요`, lineno);
  return n;
}

/** 숫자 리터럴이면 BigInt, 아니면 null. */
export function parseLiteral(text, lineno = 0) {
  const tokens = words(text);
  if (!tokens.length) return null;
  let m = POS.exec(tokens[0]);
  let negative = false;
  if (!m) {
    m = NEG.exec(tokens[0]);
    negative = m !== null;
  }
  if (!m) return null;
  const digits = [digit(m, lineno)];
  for (const tok of tokens.slice(1)) {
    const t = POS.exec(tok);
    if (!t) return null;
    digits.push(digit(t, lineno));
  }
  const value = BigInt(digits.join(''));
  return negative ? -value : value;
}

export function encode(n) {
  const big = BigInt(n);
  const digits = (big < 0n ? -big : big).toString();
  const toks = [...digits].map((d) => `티${'~'.repeat(+d)}원`);
  if (big < 0n) toks[0] = `지${'~'.repeat(+digits[0])}랄`;
  return toks.join(' ');
}

/** 문자열을 출력하는 프로그램 본문(요이/넌 나가라 제외). */
export function sayLines(text) {
  const out = [];
  for (const ch of text) out.push(encode(ch.codePointAt(0)), '줴줴이야!');
  return out;
}

function codeLines(source) {
  const out = [];
  source.split(/\r?\n/).forEach((raw, src) => {
    const text = raw.trim();
    if (text && !text.startsWith('아(')) out.push({ text, src });
  });
  return out;
}

/** 에디터 거터용: 원본 각 줄의 실행 줄 번호 정보. */
export function lineNumbers(source) {
  const infos = [];
  let n = -1;
  let last = -1;
  const lines = source.split('\n');
  const code = codeLines(source);
  if (code.length) last = code[code.length - 1].src;
  let first = code.length ? code[0].src : -1;
  lines.forEach((raw, i) => {
    const text = raw.trim();
    if (!text || text.startsWith('아(')) return infos.push(null);
    if (i === first) return infos.push({ kind: 'start' });
    if (i === last && code.length > 1 && text === '넌 나가라') return infos.push({ kind: 'end' });
    n += 1;
    infos.push({ kind: 'n', n: n + 1 });
  });
  return infos;
}

function parseLine(text, lineno) {
  const lit = parseLiteral(text, lineno);
  if (lit !== null) return { op: 'push', value: lit };
  if (text === '예?') return { op: 'ask' };
  if (text.startsWith('아뇨아뇨아뇨')) {
    const target = parseLiteral(text.slice('아뇨아뇨아뇨'.length), lineno);
    if (target === null) throw new HnlError(`${lineno}번째 줄: 아뇨아뇨아뇨 뒤에는 갈 줄 번호가 와야 해요`, lineno);
    return { op: 'goto', target: Number(target) };
  }
  if (text === '줴줴이야') return { op: 'print' };
  if (text === '줴줴이야!') return { op: 'char' };
  if (text === '이지랄ㅋㅋ') return { op: 'read' };
  if (text === '넌 나가라') return { op: 'halt' };
  const m = /^아(~*)$/.exec(text);
  if (m) {
    if (m[1].length > 9) throw new HnlError(`${lineno}번째 줄: 아는 ~를 9개까지만 늘일 수 있어요`, lineno);
    return { op: 'calc', name: OP_NAMES[m[1].length] };
  }
  throw new HnlError(`${lineno}번째 줄: 무슨 말인지 모르겠어요: ${text}`, lineno);
}

/** 소스를 검사하고 {body, srcLines}를 돌려준다. srcLines는 body[i]의 원본 줄 인덱스. */
export function compile(source) {
  const code = codeLines(source);
  if (code.length < 2 || code[0].text !== '요이' || code[code.length - 1].text !== '넌 나가라') {
    throw new HnlError("'요이'로 시작해서 '넌 나가라'로 끝내야 해요");
  }
  const inner = code.slice(1, -1);
  const body = inner.map((c, i) => parseLine(c.text, i + 1));
  body.forEach((ins, i) => {
    const lineno = i + 1;
    if (ins.op === 'goto' && !(ins.target >= 1 && ins.target <= body.length)) {
      throw new HnlError(`${lineno}번째 줄: ${ins.target}번째 줄은 없는데요`, lineno);
    }
    if (ins.op === 'ask') {
      if (lineno === body.length) throw new HnlError(`${lineno}번째 줄: 물어봤으면 대답을 들어야죠`, lineno);
      if (body[i + 1].op === 'ask') throw new HnlError(`${lineno}번째 줄: 질문에 질문으로 대답하지 마세요ㅋㅋ`, lineno);
    }
  });
  return { body, srcLines: inner.map((c) => c.src) };
}

export class Machine {
  constructor(source, input = '', maxSteps = 10_000_000) {
    const { body, srcLines } = compile(source);
    this.body = body;
    this.srcLines = srcLines;
    this.inputs = words(input);
    this.inputPos = 0;
    this.maxSteps = maxSteps;
    this.stack = [];
    this.pc = 0;
    this.steps = 0;
    this.output = '';
    this.halted = false;
  }

  get done() {
    return this.halted || this.pc >= this.body.length;
  }

  /** 지금 실행할 원본 줄 인덱스. 끝났으면 -1. */
  get currentSrcLine() {
    return this.done ? -1 : this.srcLines[this.pc];
  }

  fail(message) {
    throw new HnlError(`${this.pc + 1}번째 줄: ${message}`, this.pc + 1);
  }

  pop() {
    if (!this.stack.length) this.fail('할 말이 없는데요 (스택이 비었어요)');
    return this.stack.pop();
  }

  step() {
    if (this.done) return;
    if (++this.steps > this.maxSteps) {
      throw new HnlError('너무 오래 걸려요 (무한 루프인가요?)', this.pc + 1);
    }
    const ins = this.body[this.pc];
    switch (ins.op) {
      case 'push':
        this.stack.push(ins.value);
        break;
      case 'ask':
        this.pc += this.pop() !== 0n ? 1 : 2;
        return;
      case 'goto':
        this.pc = ins.target - 1;
        return;
      case 'print':
        this.output += this.pop().toString();
        break;
      case 'char': {
        const code = this.pop();
        try {
          this.output += String.fromCodePoint(Number(code));
        } catch {
          this.fail(`문자로 바꿀 수 없는 숫자예요: ${code}`);
        }
        break;
      }
      case 'read': {
        const tok = this.inputs[this.inputPos++];
        if (tok === undefined) this.stack.push(-1n);
        else if (/^[+-]?\d+$/.test(tok)) this.stack.push(BigInt(tok));
        else this.fail(`숫자를 말해주세요: ${tok}`);
        break;
      }
      case 'halt':
        this.halted = true;
        return;
      case 'calc':
        this.calc(ins.name);
        break;
    }
    this.pc += 1;
  }

  calc(name) {
    const s = this.stack;
    if (name === 'dup') {
      const a = this.pop();
      s.push(a, a);
    } else if (name === 'drop') {
      this.pop();
    } else if (name === 'swap') {
      const b = this.pop();
      const a = this.pop();
      s.push(b, a);
    } else if (name === 'over') {
      const b = this.pop();
      const a = this.pop();
      s.push(a, b, a);
    } else {
      const b = this.pop();
      const a = this.pop();
      if (name === 'add') s.push(a + b);
      else if (name === 'sub') s.push(a - b);
      else if (name === 'mul') s.push(a * b);
      else if (name === 'less') s.push(a < b ? 1n : 0n);
      else if (b === 0n) this.fail('0으로 나누지 마세요');
      else s.push(name === 'div' ? a / b : a % b);
    }
  }

  run() {
    while (!this.done) this.step();
    return this.output;
  }
}

export function run(source, input = '') {
  return new Machine(source, input).run();
}
