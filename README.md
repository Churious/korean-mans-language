# 한남랭

밈 말투로 코딩하는 난해한 프로그래밍 언어 (이름은 가칭).

- 한 줄이 한 번의 **발화**이고, `예?`에는 반드시 **대답**이 있어야 합니다.
- 숫자는 **늘임**으로 씁니다. `티~원` = 1, `티~~~원` = 3, 14는 `티~원 티~~~~원`.
- 브라우저 IDE에서 한 단계씩 실행하며 스택을 볼 수 있어요.

```
요이
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
```

## IDE

GitHub Pages로 배포됩니다: **https://churious.github.io/korean-mans-language/**

기능은 다음과 같아요. 실행 / 한 단계 / 천천히 실행, 현재 줄 하이라이트와 스택 시각화, 실행 줄 번호 거터(빈 줄은 건너뜀), 예제 불러오기, 숫자·문자열 변환기, 빠른 입력 팔레트, 공유 링크(코드가 URL에 담겨요).

로컬에서 보려면:
```bash
py scripts/build_site.py
py -m http.server 8000 -d dist
```
`http://localhost:8000`을 열어주세요. (`file://`로 열면 모듈이 막혀요.)

### Pages 배포

1. GitHub에 push 합니다 (기본 브랜치 `main`).
2. 레포 **Settings → Pages → Source**를 **GitHub Actions**로 바꿉니다.
3. [pages.yml](.github/workflows/pages.yml)이 테스트를 돌리고 `dist/`를 배포합니다.

## CLI

```bash
py -m hnl run examples/countdown.hnl
echo 5 | py -m hnl run examples/factorial.hnl
py -m hnl num -14          # 지~랄 티~~~~원
py -m hnl say "안녕"        # 문자열을 출력하는 프로그램 생성
```

`pip install -e .` 하면 `hnl` 명령으로도 쓸 수 있습니다.

## 구조

```
hnl/            파이썬 인터프리터와 CLI
web/            IDE (정적 사이트, 의존성 없음)
examples/       예제 .hnl (CLI와 IDE가 같이 씀)
docs/SPEC.md    언어 명세
docs/words.md   쓸 만한 밈 단어 조사
scripts/        사이트 빌드
tests/          파이썬 테스트 + tests/js (JS 코어 테스트)
```

## 테스트

```bash
py -m unittest discover -s tests -v
npm test
```

## 문서

- [언어 명세](docs/SPEC.md)
- [단어 조사](docs/words.md)
