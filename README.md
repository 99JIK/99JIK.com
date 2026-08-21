# 99jik.com

[99jik.com](https://99jik.com) 소스. 터미널 모드와 문서 모드(Easy Mode)를 오가는 한국어/영어 개인 사이트입니다.

## 스택

의존성은 빌드 도구 두 개뿐입니다. 런타임 프레임워크는 없습니다.

- **Preact** (`preact/compat`), JSX
- **esbuild** 단일 번들 (`dist/app.js`)
- **GitHub Pages** 배포, 커스텀 도메인은 [CNAME](CNAME)

`src/*.js`는 `window` 전역에 붙는 부작용 모듈이고, `src/*.jsx`만 ES 모듈입니다. 로드 순서가 의미를 가지므로 [src/main.jsx](src/main.jsx)의 import 순서를 바꿀 때는 주의해야 합니다. 특히 [src/prefs.js](src/prefs.js)는 `<html lang>`을 확정하기 때문에 [src/crisp.js](src/crisp.js)보다 먼저 와야 합니다.

## 로컬 실행

```bash
npm install
npm run build                                 # dist/ 생성
python -m http.server 8000 --directory dist   # http://localhost:8000
```

`file://`로 `dist/index.html`을 직접 열면 안 됩니다. `fetch("calendar.json")`이 막혀서 캘린더가 항상 mock 데이터로 빠집니다.

| 명령 | 하는 일 |
|---|---|
| `npm run build` | 번들 + 정적 파일 복사 + `sitemap.xml` 생성 |
| `npm run dev` | esbuild watch. **`src/*.js(x)`만** 다시 번들합니다 |
| `npm run check` | 브라우저 없이 명령 레이어 스모크 테스트 |
| `npm run calendar` | 캘린더 동기화 로컬 실행. `ICAL_URL` 환경변수 필요 |

`npm run dev`는 [scripts/build.mjs](scripts/build.mjs)의 `copyStatic()`이 시작 시 1회만 도는 구조입니다. `styles.css`나 `index.html`을 고쳤으면 `npm run build`를 다시 돌려야 dist에 반영됩니다.

## 터미널

기본 모드인 터미널은 흉내가 아니라 구현입니다. [src/fs.js](src/fs.js)가 `src/data.js`에서 가상 트리를 만들고, [src/coreutils.js](src/coreutils.js)의 도구들이 그 트리에서 값을 계산합니다. `du`와 `df`와 `ls -l`이 서로 어긋나지 않는 이유입니다.

렌더링은 전부 모노스페이스 텍스트입니다. 카드나 테이블 같은 웹 위젯은 없습니다. **프롬프트도 화면 하단 고정 바가 아니라 스크롤백의 마지막 줄**이라, 입력과 출력이 한 흐름 안에 있습니다.

- **파일시스템**: `ls -alrt`, `cd`, `pwd`, `cat -n`, `tree -a`, `find -name <glob>`, `grep -inav`, 심볼릭 링크
- **텍스트**: `head`, `tail`, `wc`, `nl`, `sort`, `uniq`, `cut`, `tr`, `rev`, `tac`, `seq`, `tee`, `echo`
- **경로**: `basename`, `dirname`, `realpath`, `readlink`, `stat`, `file`, `which`, `type`
- **시스템**: `df`, `du`, `free`, `ps`, `env`, `id`, `hostname`, `mount`, `uname`, `date`, `uptime`, `man`
- **별도 패키지**: `awk`, `bc`, `cal`, `neofetch`, `xdg-open`, `vi`, `sl`, `cowsay`, `fortune`, `cmatrix`
- **파이프**: `cat /etc/passwd | cut -d: -f1`, `ls -al | awk '{print $5, $9}'`, `seq 5 | tac`. 상류 명령은 하류가 있는지 전달받아서, `ls`는 실제 ls가 stdout이 tty가 아닐 때 그러듯 한 줄에 하나씩 출력합니다.
- **키바인딩**: `Ctrl-A/E`(줄 처음·끝), `Ctrl-U/K`(삭제), `Alt-Backspace`(단어 삭제), `Ctrl-C`(줄 취소, 단 선택된 텍스트가 있으면 복사가 우선), `Ctrl-D`(EOF), `Ctrl-L`(화면 지우기), `Alt-R`(역방향 히스토리 검색). **`Ctrl-R`과 `Ctrl-W`는 브라우저 소유라 건드리지 않습니다.**
- **확장**: `!!`, `!$`, `$?`. 종료 상태는 명령 없음이면 127, SIGINT면 130으로 bash와 같습니다.
- **Tab 완성**: 한 번은 공통 접두사까지, 두 번 연속이면 후보를 스크롤백에 컬럼으로 출력하고 프롬프트를 다시 그립니다.

### 값이 전부 실물입니다

`neofetch`는 `/etc/os-release`, FS 트리 크기, `performance.now()`, 저장된 테마, `screen`, V8 힙에서 값을 읽습니다. `cal`은 동기화된 캘린더에 일정이 있는 날을 표시합니다. `df`와 `du`와 `neofetch`의 디스크 수치가 서로 어긋나면 [scripts/smoke.mjs](scripts/smoke.mjs)가 실패시킵니다.

`bc`는 `eval`이 아니라 재귀 하향 파서입니다. 입력이 신뢰할 수 없는 텍스트이기도 하고, `^`가 bc에서는 거듭제곱인데 JavaScript에서는 XOR라서 그렇습니다.

### vi

[src/vi-editor.jsx](src/vi-editor.jsx)는 진짜 모달 편집기입니다. 버퍼는 실제로 편집됩니다: `h j k l 0 ^ $ w b e gg G`, `i I a A o O`, `x D dd`, `u`(되돌리기), `p`, `ZZ`, `:` 명령. **저장만 실패합니다.**

읽기 전용 마운트라 vim이 실제로 내는 순서 그대로입니다. `:w` 는 `E45: 'readonly' option is set (add ! to override)`, `:w!` 는 `E212: Can't open file for writing`, 저장 없이 `:q` 하면 `E37: No write since last change (add ! to override)`. 나가려면 `:q!` 를 알아야 합니다.

트리는 읽기 전용입니다. `mkdir`, `touch`, `rm`, `cp`, `mv`, `chmod`는 리눅스가 실제로 내는 `Read-only file system` 오류를 반환하고, `rm /`는 그 이전에 GNU rm의 `--preserve-root` 실패가 먼저 걸립니다. 네트워크 도구(`ping`, `ssh`, `curl`)도 브라우저 샌드박스에서 실패하는 실제 이유를 그대로 말합니다.

`man <명령>`이 모든 명령에 동작합니다. 명령 정의의 `usage` 필드에서 나오며, [scripts/smoke.mjs](scripts/smoke.mjs)가 `usage` 없는 명령이 생기면 실패시킵니다.

[src/extras.js](src/extras.js)에는 coreutils가 아닌 별도 패키지(`sl`, `cowsay`, `fortune`, `cmatrix`)와 셸 정체성(`su`, `exit`, `sudo`)만 있습니다. 명령 테이블을 먼저 조회하고 없을 때만 여기로 넘어가므로, 실제 명령이 가려지지 않습니다.

## 두 개의 뷰

- `99jik.com` 은 터미널로 엽니다.
- `99jik.com/?view=easy` 는 문서 뷰로 엽니다. **지원서나 메일에는 이 링크를 씁니다.** 채용 담당자나 교수님이 터미널을 만날 이유가 없습니다.

`?view` 는 저장된 기본 모드보다 우선합니다. 링크를 받은 사람 모두에게 같은 화면이 뜨도록 하기 위해서입니다. 모드를 바꾸면 주소창도 따라 바뀌므로 현재 화면을 그대로 복사해 공유할 수 있고, 기본 모드일 때는 파라미터가 빠져서 주소가 깨끗하게 유지됩니다.

## 크롤러 폴백

클라이언트 렌더링이라 크롤러와 링크 미리보기 스크레이퍼가 받는 HTML은 원래 `<div id="root"></div>` 하나였습니다. [scripts/build.mjs](scripts/build.mjs)의 `fallbackHtml()` 이 `src/data.js` 를 읽어 같은 내용을 평범한 HTML로 만들어 `index.html` 에 심습니다.

`<head>` 의 인라인 스크립트가 첫 페인트 전에 `js` 클래스를 붙이고 CSS가 그 아래에서 폴백을 숨기므로, 스크립트가 도는 방문자는 이걸 보지 못합니다. 런타임 비용은 0입니다. JS가 꺼진 환경에서는 이 HTML이 그대로 보입니다.

[scripts/smoke.mjs](scripts/smoke.mjs) 가 `fallbackHtml()` 을 직접 import 해서 이름, 모든 프로젝트 제목, 논문, CV 링크가 들어 있는지 검사합니다. 폴백이 조용히 비는 것을 막기 위해서입니다. 그래서 `build.mjs` 는 스크립트로 직접 실행될 때만 빌드하고, import 로는 부작용이 없습니다.

## 색 대비

네 테마 모두 본문(`fg`), 보조 텍스트(`muted`), 오류(`red`) 가 WCAG AA(4.5:1) 이상입니다. `muted` 가 중요한데, 명령 출력의 약 15%가 dim 으로 나가기 때문에 장식이 아니라 본문입니다. 장식용은 `faint` 하나뿐입니다.

테마 색을 바꿀 때는 이 기준을 다시 확인해야 합니다. Solarized 의 `red` 는 원본 팔레트(`#dc322f`, 3.25:1)가 AA 를 통과하지 못해 의도적으로 밝게 바꾼 값입니다.

## 콘텐츠 수정

거의 전부 [src/data.js](src/data.js) 한 파일에 있습니다. 프로필, 연구 관심사, 프로젝트, 논문, 경력, 스킬, `fortune` 문구까지 여기서 읽습니다. 가상 파일시스템([src/fs.js](src/fs.js))의 트리도 이 데이터에서 생성되므로, 프로젝트를 추가하면 `~/projects/<slug>.md`가 자동으로 생깁니다.

예외로 [index.html](index.html)의 `<title>`과 og 메타는 정적이라 따로 고쳐야 합니다.

날짜는 손으로 적지 않습니다. 푸터의 저작권 연도와 업데이트 날짜는 빌드 시각(`__BUILD_DATE__`)에서 유도됩니다.

## 캘린더

브라우저가 **Google Calendar API로 직접** 읽습니다. 동기화가 필요 없고, 반복 일정도 인스턴스로 펼쳐집니다.

키는 [data.js](src/data.js)의 `site.gcalApiKey`에 있습니다. 브라우저 키라 번들에 노출되는 게 정상이고, **유일한 방어선은 Google Cloud의 HTTP 리퍼러 제한**입니다. 현재 `99jik.com` 계열만 허용돼 있어서 다른 곳에서는 403이 납니다. 키를 갈 때는 제한을 다시 거는 걸 잊지 마세요.

`localhost`는 일부러 허용 목록에서 뺐습니다. 그래서 로컬 개발에서는 API가 실패하고 아래 스냅샷으로 떨어집니다.

### 폴백 스냅샷

`public/calendar.json`은 API가 실패했을 때(할당량, 키 문제, 구글 장애) 쓰이는 마지막 방어선입니다. [scripts/fetch-calendar.mjs](scripts/fetch-calendar.mjs)가 공개 iCal 피드에서 만들고, **배포 워크플로가 빌드 직전에 갱신**합니다. 커밋되지 않으므로 봇 커밋이 쌓이거나 충돌할 일이 없습니다.

수동으로 갱신하려면 `npm run calendar` 입니다.

수집 범위는 ±1년입니다. 날짜 필터링은 [calendar.js](src/calendar.js)가 브라우저에서 하므로, 스냅샷이 오래돼도 그 범위 안에서는 정확합니다. 예전에 `-1일~+45일`로 잘라 저장하던 시절에는 동기화가 멈추면 곧바로 빈 화면이 됐습니다.

### 공개 범위

이 캘린더는 공개입니다. 제목에 `[private]` 또는 `[비공개]`가 들어간 일정만 제외되고 나머지는 제목과 장소가 그대로 보입니다. 비공개 캘린더로 바꾸려면 API 키 방식을 버리고 시크릿 기반 동기화로 되돌려야 합니다.

## 배포

`main`에 푸시하면 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)이 빌드해서 GitHub Pages로 올립니다. `paths` 필터가 걸려 있어 관련 없는 커밋으로는 배포가 돌지 않습니다.

## 소셜 카드

`og:image`로 쓰는 [public/og.png](public/og.png)는 [scripts/make-og.py](scripts/make-og.py)로 생성합니다. Pillow와 Windows 시스템 폰트(Consolas, Malgun Gothic)가 필요한 일회성 도구이며 빌드에는 포함되지 않습니다. 이름이나 소속, 테마 색이 바뀌면 다시 돌리세요.

```bash
python scripts/make-og.py
```

`og:image`가 절대 URL이라 링크 미리보기는 배포 후에만 확인됩니다.
