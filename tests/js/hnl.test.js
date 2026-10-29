import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { Machine, compile, encode, lineNumbers, parseLiteral, run, sayLines } from '../../web/hnl.js';

const example = (name) =>
  readFileSync(fileURLToPath(new URL(`../../examples/${name}`, import.meta.url)), 'utf8');

test('숫자 리터럴 왕복', () => {
  for (const n of [0n, 3n, 14n, 100n, 65n, 123456n, -14n, -7n, -100n]) {
    assert.equal(parseLiteral(encode(n)), n);
  }
  assert.equal(encode(14), '티~원 티~~~~원');
  assert.equal(encode(-14), '지~랄 티~~~~원');
});

test('예제', () => {
  assert.equal(run(example('countdown.hnl')), '3\n2\n1\n');
  assert.equal(run(example('factorial.hnl'), '5'), '120\n');
  assert.equal(run(example('factorial.hnl'), '0'), '1\n');
  assert.equal(run(example('factorial.hnl'), '25'), '15511210043330985984000000\n');
  assert.equal(run(example('hello.hnl')), 'Hello, World!\n');
  assert.equal(run(example('sum.hnl'), '20 22'), '42\n');
});

const calc = (a, b, op) => run(`요이\n${encode(a)}\n${encode(b)}\n${op}\n줴줴이야\n넌 나가라`);

test('연산', () => {
  assert.equal(calc(7, 3, '아~'), '10');
  assert.equal(calc(7, 3, '아~~'), '4');
  assert.equal(calc(7, 3, '아~~~~~'), '21');
  assert.equal(calc(7, 3, '아~~~~~~~'), '2');
  assert.equal(calc(7, 3, '아~~~~~~~~'), '1');
  assert.equal(calc(-7, 2, '아~~~~~~~'), '-3');
  assert.equal(calc(-7, 2, '아~~~~~~~~'), '-1');
  assert.equal(calc(3, 7, '아~~~~~~~~~'), '1');
  assert.equal(calc(7, 3, '아~~~~~~~~~'), '0');
});

test('에러', () => {
  const fails = (src) => assert.throws(() => run(src), { name: 'Error' });
  fails('티~원\n줴줴이야');
  fails('요이\n티~원\n예?\n넌 나가라');
  fails('요이\n티~원\n예?\n예?\n줴줴이야\n넌 나가라');
  fails('요이\n줴줴이야\n넌 나가라');
  fails('요이\n아뇨아뇨아뇨 티~~~원\n넌 나가라');
  fails('요이\n티~원\n티원\n아~~~~~~~\n넌 나가라');
  fails('요이\n티~~~~~~~~~~원\n넌 나가라');
  assert.throws(() => new Machine('요이\n아뇨아뇨아뇨 티~원\n넌 나가라', '', 100).run(), /오래/);
});

test('한 단계씩 실행하면 원본 줄과 스택을 알려준다', () => {
  const src = '요이\n\n티~~원\n아\n넌 나가라';
  const m = new Machine(src);
  assert.equal(m.currentSrcLine, 2);
  m.step();
  assert.deepEqual(m.stack, [2n]);
  assert.equal(m.currentSrcLine, 3);
  m.step();
  assert.deepEqual(m.stack, [2n, 2n]);
  assert.ok(m.done);
});

test('거터 줄 번호는 빈 줄을 건너뛴다', () => {
  const info = lineNumbers('요이\n\n티~원\n줴줴이야\n넌 나가라');
  assert.deepEqual(info, [
    { kind: 'start' },
    null,
    { kind: 'n', n: 1 },
    { kind: 'n', n: 2 },
    { kind: 'end' },
  ]);
});

test('say는 컴파일 가능한 프로그램을 만든다', () => {
  const src = ['요이', ...sayLines('안녕'), '넌 나가라'].join('\n');
  assert.equal(compile(src).body.length, 4);
  assert.equal(run(src), '안녕');
});
