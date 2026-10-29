# 기여 가이드

한남랭에 관심 가져주셔서 고마워요. 버그 제보, 예제, 문서 고치기, 언어 아이디어 모두 환영합니다.

## 기여 방법

1. 큰 변경(문법, 연산 추가·변경)은 **이슈로 먼저 의논**해 주세요. 작은 버그 수정이나 오타는 바로 PR을 보내도 돼요.
2. 레포를 포크하고 브랜치를 만듭니다. (`main`에 직접 push 하지 마세요.)
3. 변경하고 테스트를 통과시킵니다. ([아래](#개발-환경과-테스트) 참고)
4. PR을 열고 **무엇을, 왜** 바꿨는지 적어주세요.

기여한 코드는 이 프로젝트와 같은 [MIT 라이선스](LICENSE)로 제공되는 것에 동의한 것으로 봅니다.

## 개발 환경과 테스트

필요한 것은 [Rust](https://rustup.rs) stable과 Node.js(22 이상)예요.

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test        # Rust 인터프리터
npm test          # IDE의 JS 인터프리터
```

IDE를 로컬에서 보려면 `npm run build:site` 후 `dist/`를 정적 서버로 열어요 ([README](README.md) 참고).

PR을 올리면 같은 검사가 GitHub Actions에서 자동으로 돌아갑니다.

## 구조

| 위치 | 역할 |
|---|---|
| `src/lib.rs` | Rust 인터프리터. **기준 구현**이에요. |
| `src/main.rs` | CLI (`hnl run`, `num`, `say`) |
| `web/hnl.js` | IDE용 JS 인터프리터. Rust 구현과 같은 의미론이어야 해요. |
| `web/app.js`, `index.html`, `style.css` | IDE 화면 |
| `examples/` | 예제. CLI, IDE, 테스트가 함께 써요. |
| `docs/SPEC.md` | 언어 명세 |

## 언어를 바꿀 때 (중요)

인터프리터가 두 개(Rust, JS)라서 **의미를 바꾸는 PR은 아래를 한 번에 고쳐야** 합니다.

- [ ] `src/lib.rs`와 `web/hnl.js`의 동작
- [ ] `docs/SPEC.md`
- [ ] `tests/hnl.rs`와 `tests/js/hnl.test.js`에 새 동작을 검증하는 테스트
- [ ] 영향받는 `examples/*.hnl`

두 구현의 결과가 다르면 Rust 쪽이 맞는 걸로 봅니다.

## 예제 추가하기

1. `examples/이름.hnl`에 코드를 넣습니다. 코드만 쓰고, 설명은 PR 본문이나 문서에 적어주세요 (한남랭에는 주석이 없어요).
2. 기대 출력을 `tests/hnl.rs`와 `tests/js/hnl.test.js`에 추가합니다.
3. IDE 예제 목록에 넣으려면 `web/app.js`의 `EXAMPLES`에 항목을 추가하세요. 입력이 필요하면 `stdin`도 적어요.

문자열 출력 코드는 `cargo run -- say "문자열"`, 숫자 리터럴은 `cargo run -- num 42`로 만들 수 있어요.

## 코드 스타일

- Rust: `cargo fmt`와 `cargo clippy`를 따릅니다. 경고는 없어야 해요.
- JS: 의존성 없는 ES 모듈이에요. 번들러나 외부 라이브러리를 넣지 않습니다.
- 에러 메시지는 한국어이고 밈 말투의 가벼운 톤을 유지해요. 단, 무엇이 문제인지는 분명히 알려줘야 합니다.
- 커밋 메시지는 한국어로, 무엇을 바꿨는지 한 줄 요약 + 필요하면 본문을 적어주세요.

## 이슈 작성

- **버그**: 재현하는 `.hnl` 코드, 입력, 기대 결과와 실제 결과를 적어주세요. IDE 버그라면 브라우저 종류도요.
- **언어 제안**: 어떤 점이 불편한지, 제안이 기존 대화형 스택 머신 모델과 어떻게 맞는지 적어주세요.

## 행동 수칙

서로 존중해 주세요. 밈과 말장난이 이 프로젝트의 재미지만, 특정 개인이나 집단을 공격하는 내용은 받지 않습니다.
