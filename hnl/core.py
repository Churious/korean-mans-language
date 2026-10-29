"""한남랭(가칭) 인터프리터. 문법은 SPEC.md 참고."""
import re
import sys


class HnlError(Exception):
    pass


POS = re.compile(r"티(~*)원")
NEG = re.compile(r"지(~*)랄")
OP_NAMES = ["dup", "add", "sub", "swap", "over", "mul", "drop", "div", "mod", "less"]


def _digit(match, lineno):
    n = len(match.group(1))
    if n > 9:
        raise HnlError(f"{lineno}번째 줄: 한 자릿수는 ~를 9개까지만 늘일 수 있어요")
    return n


def parse_literal(text, lineno=0):
    """숫자 리터럴이면 정수를, 아니면 None을 돌려준다."""
    tokens = text.split()
    if not tokens:
        return None
    first = tokens[0]
    negative = False
    m = POS.fullmatch(first)
    if m is None:
        m = NEG.fullmatch(first)
        negative = m is not None
    if m is None:
        return None
    digits = [_digit(m, lineno)]
    for tok in tokens[1:]:
        m = POS.fullmatch(tok)
        if m is None:
            return None
        digits.append(_digit(m, lineno))
    value = int("".join(map(str, digits)))
    return -value if negative else value


def encode(n):
    """정수를 숫자 리터럴 문자열로 바꾼다."""
    digits = str(abs(n))
    toks = [f"티{'~' * int(d)}원" for d in digits]
    if n < 0:
        toks[0] = f"지{'~' * int(digits[0])}랄"
    return " ".join(toks)


def parse(source):
    lines = [ln.strip() for ln in source.splitlines()]
    lines = [ln for ln in lines if ln]
    if len(lines) < 2 or lines[0] != "요이" or lines[-1] != "넌 나가라":
        raise HnlError("'요이'로 시작해서 '넌 나가라'로 끝내야 해요")
    body = []
    for i, text in enumerate(lines[1:-1], start=1):
        body.append(_parse_line(text, i))
    for i, ins in enumerate(body, start=1):
        if ins[0] == "goto" and not 1 <= ins[1] <= len(body):
            raise HnlError(f"{i}번째 줄: {ins[1]}번째 줄은 없는데요")
        if ins[0] == "ask":
            if i == len(body):
                raise HnlError(f"{i}번째 줄: 물어봤으면 대답을 들어야죠")
            if body[i][0] == "ask":
                raise HnlError(f"{i}번째 줄: 질문에 질문으로 대답하지 마세요ㅋㅋ")
    return body


def _parse_line(text, lineno):
    lit = parse_literal(text, lineno)
    if lit is not None:
        return ("push", lit)
    if text == "예?":
        return ("ask",)
    if text.startswith("아뇨아뇨아뇨"):
        target = parse_literal(text[len("아뇨아뇨아뇨"):], lineno)
        if target is None:
            raise HnlError(f"{lineno}번째 줄: 아뇨아뇨아뇨 뒤에는 갈 줄 번호가 와야 해요")
        return ("goto", target)
    if text == "줴줴이야":
        return ("print",)
    if text == "줴줴이야!":
        return ("char",)
    if text == "이지랄ㅋㅋ":
        return ("read",)
    if text == "넌 나가라":
        return ("halt",)
    m = re.fullmatch(r"아(~*)", text)
    if m:
        n = len(m.group(1))
        if n > 9:
            raise HnlError(f"{lineno}번째 줄: 아는 ~를 9개까지만 늘일 수 있어요")
        return ("op", OP_NAMES[n])
    raise HnlError(f"{lineno}번째 줄: 무슨 말인지 모르겠어요: {text}")


def _trunc_div(a, b):
    q = abs(a) // abs(b)
    return q if (a < 0) == (b < 0) else -q


def run(source, stdin=None, stdout=None, max_steps=10_000_000):
    stdin = stdin if stdin is not None else sys.stdin
    stdout = stdout if stdout is not None else sys.stdout
    body = parse(source)
    inputs = iter(stdin.read().split())
    stack = []
    pc = 0
    steps = 0

    def pop():
        if not stack:
            raise HnlError(f"{pc + 1}번째 줄: 할 말이 없는데요 (스택이 비었어요)")
        return stack.pop()

    while pc < len(body):
        steps += 1
        if steps > max_steps:
            raise HnlError("너무 오래 걸려요 (무한 루프인가요?)")
        ins = body[pc]
        kind = ins[0]
        if kind == "push":
            stack.append(ins[1])
        elif kind == "ask":
            pc += 1 if pop() != 0 else 2
            continue
        elif kind == "goto":
            pc = ins[1] - 1
            continue
        elif kind == "print":
            stdout.write(str(pop()))
        elif kind == "char":
            code = pop()
            try:
                stdout.write(chr(code))
            except (ValueError, OverflowError):
                raise HnlError(f"{pc + 1}번째 줄: 문자로 바꿀 수 없는 숫자예요: {code}")
        elif kind == "read":
            tok = next(inputs, None)
            try:
                stack.append(-1 if tok is None else int(tok))
            except ValueError:
                raise HnlError(f"{pc + 1}번째 줄: 숫자를 말해주세요: {tok}")
        elif kind == "halt":
            return
        else:
            _apply(ins[1], stack, pop, pc)
        pc += 1


def _apply(name, stack, pop, pc):
    if name == "dup":
        a = pop()
        stack.extend([a, a])
    elif name == "drop":
        pop()
    elif name == "swap":
        b, a = pop(), pop()
        stack.extend([b, a])
    elif name == "over":
        b, a = pop(), pop()
        stack.extend([a, b, a])
    else:
        b, a = pop(), pop()
        if name == "add":
            stack.append(a + b)
        elif name == "sub":
            stack.append(a - b)
        elif name == "mul":
            stack.append(a * b)
        elif name == "less":
            stack.append(1 if a < b else 0)
        else:
            if b == 0:
                raise HnlError(f"{pc + 1}번째 줄: 0으로 나누지 마세요")
            q = _trunc_div(a, b)
            stack.append(q if name == "div" else a - b * q)


def say(text):
    """text를 출력하는 프로그램을 만든다."""
    lines = ["요이"]
    for ch in text:
        lines += [encode(ord(ch)), "줴줴이야!"]
    lines.append("넌 나가라")
    return "\n".join(lines) + "\n"
