//! 한남랭 인터프리터. 문법은 `docs/SPEC.md` 참고.
//!
//! 정수는 크기 제한이 없고, 의미론은 `web/hnl.js`와 같다.

use std::fmt;

use num_bigint::BigInt;
use num_traits::{ToPrimitive, Zero};

pub const DEFAULT_MAX_STEPS: u64 = 10_000_000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HnlError {
    pub message: String,
}

impl HnlError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }

    fn at(line: usize, message: impl AsRef<str>) -> Self {
        Self::new(format!("{line}번째 줄: {}", message.as_ref()))
    }
}

impl fmt::Display for HnlError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for HnlError {}

/// `아~…` 연산. `~` 개수가 `OPS`의 인덱스.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Op {
    Dup,
    Add,
    Sub,
    Swap,
    Over,
    Mul,
    Drop,
    Div,
    Mod,
    Less,
}

pub const OPS: [Op; 10] = [
    Op::Dup,
    Op::Add,
    Op::Sub,
    Op::Swap,
    Op::Over,
    Op::Mul,
    Op::Drop,
    Op::Div,
    Op::Mod,
    Op::Less,
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Instr {
    Push(BigInt),
    Ask,
    Goto(usize),
    Print,
    Char,
    Read,
    Halt,
    Calc(Op),
}

/// `open ~* close` 꼴의 토큰이면 `~` 개수(= 한 자릿수)를 돌려준다.
fn stretch(token: &str, open: char, close: char) -> Option<usize> {
    let mut chars = token.chars();
    if chars.next()? != open {
        return None;
    }
    let mut count = 0;
    loop {
        match chars.next()? {
            '~' => count += 1,
            c if c == close => return chars.next().is_none().then_some(count),
            _ => return None,
        }
    }
}

fn digit(n: usize, lineno: usize) -> Result<u8, HnlError> {
    u8::try_from(n)
        .ok()
        .filter(|d| *d <= 9)
        .ok_or_else(|| HnlError::at(lineno, "한 자릿수는 ~를 9개까지만 늘일 수 있어요"))
}

/// 숫자 리터럴이면 값을, 아니면 `None`을 돌려준다.
pub fn parse_literal(text: &str, lineno: usize) -> Result<Option<BigInt>, HnlError> {
    let mut tokens = text.split_whitespace();
    let Some(first) = tokens.next() else {
        return Ok(None);
    };
    let (negative, first_digit) = match (stretch(first, '티', '원'), stretch(first, '지', '랄'))
    {
        (Some(n), _) => (false, n),
        (None, Some(n)) => (true, n),
        _ => return Ok(None),
    };
    let mut digits = vec![digit(first_digit, lineno)?];
    for token in tokens {
        match stretch(token, '티', '원') {
            Some(n) => digits.push(digit(n, lineno)?),
            None => return Ok(None),
        }
    }
    let text: String = digits.iter().map(|d| char::from(b'0' + d)).collect();
    let value: BigInt = text.parse().expect("숫자만 모았으니 항상 파싱돼요");
    Ok(Some(if negative { -value } else { value }))
}

/// 정수를 숫자 리터럴 문자열로 바꾼다.
pub fn encode(n: impl Into<BigInt>) -> String {
    let n: BigInt = n.into();
    let digits = n.magnitude().to_string();
    let mut tokens: Vec<String> = digits
        .bytes()
        .map(|d| format!("티{}원", "~".repeat(usize::from(d - b'0'))))
        .collect();
    if n.sign() == num_bigint::Sign::Minus {
        tokens[0] = format!(
            "지{}랄",
            "~".repeat(usize::from(digits.as_bytes()[0] - b'0'))
        );
    }
    tokens.join(" ")
}

/// `text`를 출력하는 프로그램을 만든다.
pub fn say(text: &str) -> String {
    let mut lines = vec!["요이".to_string()];
    for ch in text.chars() {
        lines.push(encode(u32::from(ch)));
        lines.push("줴줴이야!".to_string());
    }
    lines.push("넌 나가라".to_string());
    lines.join("\n") + "\n"
}

fn parse_line(text: &str, lineno: usize) -> Result<Instr, HnlError> {
    if let Some(value) = parse_literal(text, lineno)? {
        return Ok(Instr::Push(value));
    }
    if let Some(rest) = text.strip_prefix("아뇨아뇨아뇨") {
        let target = parse_literal(rest, lineno)?
            .ok_or_else(|| HnlError::at(lineno, "아뇨아뇨아뇨 뒤에는 갈 줄 번호가 와야 해요"))?;
        // 범위를 벗어난 값은 compile 에서 "없는 줄" 에러가 되도록 usize::MAX 로 둔다.
        return Ok(Instr::Goto(target.to_usize().unwrap_or(usize::MAX)));
    }
    match text {
        "예?" => return Ok(Instr::Ask),
        "줴줴이야" => return Ok(Instr::Print),
        "줴줴이야!" => return Ok(Instr::Char),
        "이지랄ㅋㅋ" => return Ok(Instr::Read),
        "넌 나가라" => return Ok(Instr::Halt),
        _ => {}
    }
    if let Some(tildes) = text.strip_prefix('아') {
        if tildes.chars().all(|c| c == '~') {
            return OPS
                .get(tildes.chars().count())
                .map(|op| Instr::Calc(*op))
                .ok_or_else(|| HnlError::at(lineno, "아는 ~를 9개까지만 늘일 수 있어요"));
        }
    }
    Err(HnlError::at(
        lineno,
        format!("무슨 말인지 모르겠어요: {text}"),
    ))
}

/// 검사를 마친 프로그램. `body[i]`가 `i + 1`번째 줄이다.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Program {
    pub body: Vec<Instr>,
}

impl Program {
    pub fn uses_input(&self) -> bool {
        self.body.contains(&Instr::Read)
    }
}

pub fn compile(source: &str) -> Result<Program, HnlError> {
    let lines: Vec<&str> = source
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();
    if lines.len() < 2 || lines[0] != "요이" || lines[lines.len() - 1] != "넌 나가라" {
        return Err(HnlError::new("'요이'로 시작해서 '넌 나가라'로 끝내야 해요"));
    }
    let body = lines[1..lines.len() - 1]
        .iter()
        .enumerate()
        .map(|(i, text)| parse_line(text, i + 1))
        .collect::<Result<Vec<_>, _>>()?;
    for (i, instr) in body.iter().enumerate() {
        let lineno = i + 1;
        match instr {
            Instr::Goto(target) if !(1..=body.len()).contains(target) => {
                let shown = if *target == usize::MAX {
                    "그런".to_string()
                } else {
                    target.to_string()
                };
                return Err(HnlError::at(lineno, format!("{shown}번째 줄은 없는데요")));
            }
            Instr::Ask => {
                if lineno == body.len() {
                    return Err(HnlError::at(lineno, "물어봤으면 대답을 들어야죠"));
                }
                if body[i + 1] == Instr::Ask {
                    return Err(HnlError::at(lineno, "질문에 질문으로 대답하지 마세요ㅋㅋ"));
                }
            }
            _ => {}
        }
    }
    Ok(Program { body })
}

pub struct Machine {
    body: Vec<Instr>,
    inputs: Vec<String>,
    input_pos: usize,
    max_steps: u64,
    pub stack: Vec<BigInt>,
    pub pc: usize,
    pub steps: u64,
    pub output: String,
    pub halted: bool,
}

impl Machine {
    pub fn new(program: Program, input: &str) -> Self {
        Self {
            body: program.body,
            inputs: input.split_whitespace().map(str::to_string).collect(),
            input_pos: 0,
            max_steps: DEFAULT_MAX_STEPS,
            stack: Vec::new(),
            pc: 0,
            steps: 0,
            output: String::new(),
            halted: false,
        }
    }

    pub fn with_max_steps(mut self, max_steps: u64) -> Self {
        self.max_steps = max_steps;
        self
    }

    pub fn done(&self) -> bool {
        self.halted || self.pc >= self.body.len()
    }

    fn fail<T>(&self, message: impl AsRef<str>) -> Result<T, HnlError> {
        Err(HnlError::at(self.pc + 1, message))
    }

    fn pop(&mut self) -> Result<BigInt, HnlError> {
        match self.stack.pop() {
            Some(value) => Ok(value),
            None => self.fail("할 말이 없는데요 (스택이 비었어요)"),
        }
    }

    pub fn step(&mut self) -> Result<(), HnlError> {
        if self.done() {
            return Ok(());
        }
        self.steps += 1;
        if self.steps > self.max_steps {
            return Err(HnlError::new("너무 오래 걸려요 (무한 루프인가요?)"));
        }
        match self.body[self.pc].clone() {
            Instr::Push(value) => self.stack.push(value),
            Instr::Ask => {
                self.pc += if self.pop()?.is_zero() { 2 } else { 1 };
                return Ok(());
            }
            Instr::Goto(target) => {
                self.pc = target - 1;
                return Ok(());
            }
            Instr::Print => {
                let value = self.pop()?;
                self.output.push_str(&value.to_string());
            }
            Instr::Char => {
                let value = self.pop()?;
                match value.to_u32().and_then(char::from_u32) {
                    Some(ch) => self.output.push(ch),
                    None => return self.fail(format!("문자로 바꿀 수 없는 숫자예요: {value}")),
                }
            }
            Instr::Read => {
                let value = match self.inputs.get(self.input_pos).cloned() {
                    None => BigInt::from(-1),
                    Some(token) => match parse_int(&token) {
                        Some(value) => value,
                        None => return self.fail(format!("숫자를 말해주세요: {token}")),
                    },
                };
                self.input_pos += 1;
                self.stack.push(value);
            }
            Instr::Halt => {
                self.halted = true;
                return Ok(());
            }
            Instr::Calc(op) => self.calc(op)?,
        }
        self.pc += 1;
        Ok(())
    }

    fn calc(&mut self, op: Op) -> Result<(), HnlError> {
        match op {
            Op::Dup => {
                let a = self.pop()?;
                self.stack.push(a.clone());
                self.stack.push(a);
            }
            Op::Drop => {
                self.pop()?;
            }
            Op::Swap => {
                let b = self.pop()?;
                let a = self.pop()?;
                self.stack.push(b);
                self.stack.push(a);
            }
            Op::Over => {
                let b = self.pop()?;
                let a = self.pop()?;
                self.stack.push(a.clone());
                self.stack.push(b);
                self.stack.push(a);
            }
            Op::Add | Op::Sub | Op::Mul | Op::Div | Op::Mod | Op::Less => {
                let b = self.pop()?;
                let a = self.pop()?;
                let result = match op {
                    Op::Add => a + b,
                    Op::Sub => a - b,
                    Op::Mul => a * b,
                    Op::Less => BigInt::from(u8::from(a < b)),
                    _ if b.is_zero() => return self.fail("0으로 나누지 마세요"),
                    Op::Div => a / b,
                    _ => a % b,
                };
                self.stack.push(result);
            }
        }
        Ok(())
    }

    pub fn run(&mut self) -> Result<(), HnlError> {
        while !self.done() {
            self.step()?;
        }
        Ok(())
    }
}

/// `[+-]?\d+` 만 정수로 받는다.
fn parse_int(token: &str) -> Option<BigInt> {
    let digits = token.strip_prefix(['+', '-']).unwrap_or(token);
    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    token.strip_prefix('+').unwrap_or(token).parse().ok()
}

/// 소스를 컴파일해서 실행하고 출력을 돌려준다.
pub fn run(source: &str, input: &str) -> Result<String, HnlError> {
    let mut machine = Machine::new(compile(source)?, input);
    machine.run()?;
    Ok(machine.output)
}
