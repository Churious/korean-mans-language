use std::io::{Read, Write};
use std::process::ExitCode;

use hnl::{compile, encode, say, Machine};
use num_bigint::BigInt;

const USAGE: &str = "사용법: hnl run <파일> | num <정수> | say <문자열>";

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args
        .iter()
        .map(String::as_str)
        .collect::<Vec<_>>()
        .as_slice()
    {
        ["run", path] => run_file(path),
        ["num", n] => match n.parse::<BigInt>() {
            Ok(n) => {
                println!("{}", encode(n));
                ExitCode::SUCCESS
            }
            Err(_) => fail(&format!("정수가 아니에요: {n}")),
        },
        ["say", text] => {
            print!("{}", say(text));
            ExitCode::SUCCESS
        }
        _ => {
            eprintln!("{USAGE}");
            ExitCode::from(2)
        }
    }
}

fn fail(message: &str) -> ExitCode {
    eprintln!("에러: {message}");
    ExitCode::FAILURE
}

fn run_file(path: &str) -> ExitCode {
    let source = match std::fs::read_to_string(path) {
        Ok(source) => source,
        Err(e) => return fail(&format!("{path}: {e}")),
    };
    let program = match compile(&source) {
        Ok(program) => program,
        Err(e) => return fail(&e.message),
    };
    let mut input = String::new();
    if program.uses_input() {
        if let Err(e) = std::io::stdin().read_to_string(&mut input) {
            return fail(&format!("입력을 읽지 못했어요: {e}"));
        }
    }
    let mut machine = Machine::new(program, &input);
    let result = machine.run();
    let mut stdout = std::io::stdout().lock();
    let _ = stdout.write_all(machine.output.as_bytes());
    let _ = stdout.flush();
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => fail(&e.message),
    }
}
