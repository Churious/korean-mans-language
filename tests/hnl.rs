use std::fs;
use std::path::Path;

use hnl::{compile, encode, parse_literal, run, say, Machine};
use num_bigint::BigInt;

fn example(name: &str) -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("examples")
        .join(name);
    fs::read_to_string(path).expect("예제를 읽을 수 있어야 해요")
}

fn lit(text: &str) -> BigInt {
    parse_literal(text, 0).unwrap().expect("리터럴이어야 해요")
}

fn err(source: &str) -> String {
    run(source, "").expect_err("에러가 나야 해요").message
}

#[test]
fn literal_roundtrip() {
    for n in [0, 3, 14, 100, 65, 123_456, -14, -7, -100] {
        assert_eq!(lit(&encode(n)), BigInt::from(n));
    }
}

#[test]
fn known_encodings() {
    assert_eq!(encode(14), "티~원 티~~~~원");
    assert_eq!(encode(-14), "지~랄 티~~~~원");
    assert_eq!(encode(100), "티~원 티원 티원");
}

#[test]
fn not_a_literal() {
    assert_eq!(parse_literal("줴줴이야", 0).unwrap(), None);
    assert_eq!(parse_literal("티~원 지~랄", 0).unwrap(), None);
    assert_eq!(parse_literal("", 0).unwrap(), None);
}

#[test]
fn too_many_tildes() {
    assert!(compile("요이\n티~~~~~~~~~~원\n넌 나가라").is_err());
}

#[test]
fn examples() {
    assert_eq!(run(&example("countdown.hnl"), "").unwrap(), "3\n2\n1\n");
    assert_eq!(run(&example("factorial.hnl"), "5").unwrap(), "120\n");
    assert_eq!(run(&example("factorial.hnl"), "0").unwrap(), "1\n");
    assert_eq!(run(&example("factorial.hnl"), "10").unwrap(), "3628800\n");
    assert_eq!(
        run(&example("factorial.hnl"), "25").unwrap(),
        "15511210043330985984000000\n"
    );
    assert_eq!(run(&example("hello.hnl"), "").unwrap(), "Hello, World!\n");
    assert_eq!(run(&example("sum.hnl"), "20 22").unwrap(), "42\n");
}

fn calc(a: i32, b: i32, op: &str) -> String {
    let source = format!(
        "요이\n{}\n{}\n{op}\n줴줴이야\n넌 나가라",
        encode(a),
        encode(b)
    );
    run(&source, "").unwrap()
}

#[test]
fn arithmetic() {
    assert_eq!(calc(7, 3, "아~"), "10");
    assert_eq!(calc(7, 3, "아~~"), "4");
    assert_eq!(calc(7, 3, "아~~~~~"), "21");
    assert_eq!(calc(7, 3, "아~~~~~~~"), "2");
    assert_eq!(calc(7, 3, "아~~~~~~~~"), "1");
    assert_eq!(calc(-7, 2, "아~~~~~~~"), "-3");
    assert_eq!(calc(-7, 2, "아~~~~~~~~"), "-1");
    assert_eq!(calc(3, 7, "아~~~~~~~~~"), "1");
    assert_eq!(calc(7, 3, "아~~~~~~~~~"), "0");
}

#[test]
fn stack_ops() {
    let prints = |op: &str, n: usize| {
        let source = format!(
            "요이\n티~원\n티~~원\n{op}\n{}넌 나가라",
            "줴줴이야\n".repeat(n)
        );
        run(&source, "").unwrap()
    };
    assert_eq!(prints("아~~~", 2), "12"); // swap: [2 1] → 1, 2
    assert_eq!(prints("아~~~~~~", 1), "1"); // drop: [1]
    assert_eq!(prints("아~~~~", 3), "121"); // over: [1 2 1]
}

#[test]
fn input_and_eof() {
    let source = "요이\n이지랄ㅋㅋ\n이지랄ㅋㅋ\n아~\n줴줴이야\n넌 나가라";
    assert_eq!(run(source, "20 22").unwrap(), "42");
    assert_eq!(run(source, "5").unwrap(), "4"); // EOF 는 -1
    assert!(run(source, "5 abc").is_err());
}

#[test]
fn big_numbers() {
    // 2^200 = 1606938044258990275541962092341162602522202993782792835301376
    let mut source = String::from("요이\n티~원\n");
    for _ in 0..200 {
        source += "티~~원\n아~~~~~\n";
    }
    source += "줴줴이야\n넌 나가라";
    assert_eq!(
        run(&source, "").unwrap(),
        "1606938044258990275541962092341162602522202993782792835301376"
    );
}

#[test]
fn errors() {
    assert!(err("티~원\n줴줴이야").contains("요이"));
    assert!(err("요이\n티~원\n줴줴이야").contains("요이"));
    assert!(err("요이\n티~원\n예?\n넌 나가라").contains("대답"));
    assert!(err("요이\n티~원\n예?\n예?\n줴줴이야\n넌 나가라").contains("질문에 질문"));
    assert!(err("요이\n줴줴이야\n넌 나가라").contains("스택이 비었어요"));
    assert!(err("요이\n아뇨아뇨아뇨 티~~~원\n넌 나가라").contains("없는데요"));
    assert!(err("요이\n티~원\n티원\n아~~~~~~~\n넌 나가라").contains("0으로"));
    assert!(err("요이\n아(주석)\n넌 나가라").contains("무슨 말인지"));
    assert!(err("요이\n아~~~~~~~~~~\n넌 나가라").contains("9개"));
    assert!(err("요이\n지~랄\n줴줴이야!\n넌 나가라").contains("문자로"));
}

#[test]
fn error_has_line_number() {
    // 1: push, 2: print, 3: print (스택이 비어서 실패)
    assert!(err("요이\n티~원\n줴줴이야\n줴줴이야\n넌 나가라").starts_with("3번째 줄"));
}

#[test]
fn infinite_loop_guard() {
    let program = compile("요이\n아뇨아뇨아뇨 티~원\n넌 나가라").unwrap();
    let mut machine = Machine::new(program, "").with_max_steps(100);
    assert!(machine.run().unwrap_err().message.contains("오래"));
}

#[test]
fn step_by_step() {
    let program = compile("요이\n\n티~~원\n아\n넌 나가라").unwrap();
    let mut machine = Machine::new(program, "");
    machine.step().unwrap();
    assert_eq!(machine.stack, vec![BigInt::from(2)]);
    machine.step().unwrap();
    assert_eq!(machine.stack, vec![BigInt::from(2), BigInt::from(2)]);
    assert!(machine.done());
}

#[test]
fn say_compiles_and_prints() {
    let source = say("안녕");
    assert_eq!(compile(&source).unwrap().body.len(), 4);
    assert_eq!(run(&source, "").unwrap(), "안녕");
}
