# 99jik.com

[99jik.com](https://99jik.com) 소스. 작은 데스크톱 환경으로 동작하는 한국어/영어 개인 사이트입니다. 터미널이 주 화면이고, 창 관리자와 몇 개의 앱이 그 주위에 있으며, 같은 내용을 평범한 문서로 보는 Easy Mode가 따로 있습니다.

## 스택

의존성은 빌드 도구 두 개뿐입니다. 런타임 프레임워크는 없습니다.

- **Preact** (`preact/compat`), JSX
- **esbuild** 단일 번들 (`dist/app.js`)
- **GitHub Pages** 배포, 커스텀 도메인은 [CNAME](CNAME)

`src/*.js`는 `window` 전역에 붙는 부작용 모듈이고, `src/*.jsx`만 ES 모듈입니다. 로드 순서가 의미를 가지므로 [src/main.jsx](src/main.jsx)의 import 순서를 바꿀 때는 주의해야 합니다.

- [src/prefs.js](src/prefs.js)는 `<html lang>`을 확정하므로 [src/crisp.js](src/crisp.js)보다 먼저 와야 합니다.
- [src/wm.js](src/wm.js)는 `window.WM`을 만들고, [src/desktop.jsx](src/desktop.jsx)가 모듈 최상단에서 그걸 구조분해합니다.

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
| `npm run check` | 브라우저 없이 도는 스모크 테스트 |
| `npm run calendar` | 캘린더 스냅샷 갱신. `ICAL_URL` 환경변수 필요 |

`npm run dev`는 [scripts/build.mjs](scripts/build.mjs)의 `copyStatic()`이 시작 시 1회만 도는 구조입니다. `styles.css`나 `index.html`을 고쳤으면 `npm run build`를 다시 돌려야 dist에 반영됩니다.

## 데스크톱

[src/desktop.jsx](src/desktop.jsx)가 창 목록과 스태킹 순서를, [src/wm.js](src/wm.js)가 기하 계산과 저장된 배치를 맡습니다. 배경화면은 이미지가 아니라 활성 테마에서 그려집니다. 테마 넷이 배경 넷을 갖되 바이트는 늘지 않습니다.

- **스냅**: 위 가장자리는 최대화, 좌우는 반쪽, 네 모서리는 사분면. 끄는 동안 착지 지점이 미리 보입니다.
- **리사이즈**: 변 넷과 모서리 넷. 그립이 프레임 바깥으로 6px 나가므로 `.win.framed`는 `overflow: visible`이고 둥근 모서리는 안쪽 컨텐츠를 클리핑해 유지합니다.
- **맞닿은 창**: 잡은 변에 다른 창이 붙어 있으면 분할선을 공유해 같이 움직입니다. 스냅 이름이 아니라 좌표로 판정하므로 한 번 손으로 조정한 뒤에도 동작합니다.
- **작업공간** 4개, **상시 독**, **바탕화면 우클릭 메뉴**, **잠금화면**(비밀번호 없음. 정적 번들에 든 비밀번호는 보안이 아니라 연출입니다).
- **배치 저장**: 창 위치, 크기, 상태, 작업공간을 `localStorage`에 둡니다. 복원할 때는 좌표를 클램프하고 앱 이름을 검증합니다. 더 넓은 화면에서 저장됐거나 없어진 앱을 가리킬 수 있기 때문입니다.

### 창은 언마운트하지 않습니다

최소화, 다른 작업공간, 잠금화면은 **전부 화면 밖으로 옮기는 것**으로 처리합니다. 언마운트하면 그 안의 iframe이 리로드되고 재생 중이던 것이 멈춥니다. 이 버그를 세 번 냈고, 지금은 [scripts/smoke.mjs](scripts/smoke.mjs)가 `.win.stowed`에 `display: none`이 들어가면 실패시킵니다.

같은 이유로 음악 플레이어는 데스크톱이 소유합니다. 창이 아니라 데스크톱에 붙어 있어서 `clear`를 하든 창을 닫든 소리가 이어집니다.

### 키보드

`Ctrl+Alt` 네임스페이스입니다. **Alt+Tab과 Ctrl+Alt+Tab은 쓸 수 없습니다.** 운영체제가 페이지보다 먼저 가로챕니다. 창 순환은 백틱 키를 씁니다.

판정은 `e.key`가 아니라 **`e.code`**(물리 키)로 합니다. 한글 자판이 켜져 있으면 문자 키의 `e.key`가 자모로 오기 때문에 `Ctrl+Alt+M` 같은 것이 아무것도 매치하지 않았습니다.

| 키 | 동작 |
|---|---|
| `Ctrl+Alt+T/F/B/C/M/V/,` | 앱 실행 또는 포커스 |
| `Ctrl+Alt+` `` ` `` | 창 순환 (`Shift`로 역순) |
| `Ctrl+Alt+↑ / ↓` | 최대화 / 복원 후 최소화 |
| `Ctrl+Alt+Shift+←/→` | 반쪽 스냅 |
| `Ctrl+Alt+←/→`, `1..4` | 작업공간 이동 |
| `Ctrl+Alt+Q / D / L` | 닫기 / 바탕화면 보기 / 잠그기 |

전체 목록은 설정 창에도 있습니다. 안 그러면 아무도 못 찾습니다.

### 바탕화면은 폴더입니다

아이콘은 `~/Desktop`의 내용이고 그 안의 `.desktop` 파일이 런처입니다. 파일 탐색기로 들어가면 같은 것이 보이고, `.desktop`을 열면 `Exec`이 가리키는 앱이 뜹니다. 목록이 두 벌이 아니라 한 벌이라 어긋날 수 없습니다. 스모크 테스트가 `Exec`이 실제 앱을 가리키는지 검사합니다.

## 앱

| 앱 | 파일 | 비고 |
|---|---|---|
| 터미널 | [terminal-view.jsx](src/terminal-view.jsx) | 여러 개 열립니다 |
| 파일 | [files.jsx](src/files.jsx) | `window.FS`를 직접 읽습니다 |
| 브라우저 | [browser.jsx](src/browser.jsx) | 프레이밍을 허용하는 사이트만 |
| 채팅 | [chat.jsx](src/chat.jsx) | 대화는 모듈 저장소에 |
| 음악 | [mpv.jsx](src/mpv.jsx) | 플레이어는 데스크톱 소유 |
| 이력서 | [pdf.jsx](src/pdf.jsx) | blob URL로 렌더 |
| 뷰어 | [viewer.jsx](src/viewer.jsx) | 파일당 창 하나 |
| 설정 | [settings.jsx](src/settings.jsx) | 테마, 언어, 단축키, 배치 초기화 |

터미널, 파일, 브라우저, 뷰어는 여러 개 열립니다. 채팅, 음악, 설정은 하나만 열립니다. 대화는 하나고, 플레이어는 싱글턴이고, 설정 창 두 개는 같은 상태를 두 번 보는 것뿐입니다.

### 브라우저

프레이밍을 허용하는 사이트만 열립니다. 그건 웹의 작은 일부입니다. github는 `X-Frame-Options: deny`, google과 youtube는 `SAMEORIGIN`을 보내고, 정적 사이트에는 우회할 프록시가 없습니다.

그래서 **거짓말을 하지 않습니다.** 거부하는 호스트는 헤더를 직접 확인해 목록으로 갖고 있다가 실제 값을 보여주고, YouTube 링크는 임베드 경로로 바꿔서 실제로 재생합니다. 모르는 사이트는 3.5초 뒤에도 비어 있으면 대부분의 사이트가 막는다고 안내합니다. 교차 출처 프레임이 거부당했는지 로딩 중인지는 JS로 구분할 방법이 없어서, 시간 말고는 근거가 없습니다.

기본 북마크는 헤더를 실제로 찍어서 열리는 것만 넣었습니다. 주소창에 점 없는 입력은 검색어로 보고 위키백과로 보냅니다. Google, Bing, DuckDuckGo가 전부 프레이밍을 거부해서 여기서 실제로 되는 검색은 그것뿐입니다.

### 이력서 뷰어

`raw.githubusercontent.com`은 `X-Frame-Options: deny`를 보내므로 PDF를 iframe에 바로 못 넣습니다. 대신 `Access-Control-Allow-Origin: *`을 보내므로 바이트를 fetch할 수 있고, blob URL은 same-origin이라 프레이밍 헤더가 적용되지 않습니다. 브라우저 내장 뷰어가 그대로 렌더합니다. 라이브러리도 빌드 단계도 없고 CV는 다른 저장소에 그대로 있습니다.

### 음악

플레이리스트는 YouTube Data API로 읽습니다. 한 페이지 상한이 50이라 `nextPageToken`을 따라갑니다. 재생은 IFrame Player API입니다. `?list=` 임베드는 바깥에서 조종할 수 없어서 다음 곡으로 넘어가지 않습니다.

브라우저는 소리 있는 자동재생을 거부하지만 음소거 자동재생은 거부하지 않습니다. 그래서 음소거로 시작해서 재생이 실제로 시작된 뒤 소리를 켭니다. 화면은 기본으로 숨겨져 있고(화면 밖으로 보냅니다. 크기를 0으로 줄이면 디코딩할 곳이 없어집니다) 버튼으로 켤 수 있습니다. **YouTube 약관은 플레이어를 가리는 것을 금지합니다.** 되돌릴 수 있게 토글로 뒀습니다.

## 터미널

터미널은 흉내가 아니라 구현입니다. [src/fs.js](src/fs.js)가 `src/data.js`에서 가상 트리를 만들고, [src/coreutils.js](src/coreutils.js)의 도구들이 그 트리에서 값을 계산합니다. `du`와 `df`와 `ls -l`이 서로 어긋나지 않는 이유입니다.

렌더링은 전부 모노스페이스 텍스트입니다. **프롬프트도 화면 하단 고정 바가 아니라 스크롤백의 마지막 줄**이라, 입력과 출력이 한 흐름 안에 있습니다. 가로 스크롤은 없습니다. 터미널은 창 폭에서 줄바꿈하고, 표는 창이 좁으면 실제로 어긋납니다. xterm에서도 그렇습니다.

명령 67개가 `help`에 보이고, 숨은 별칭까지 하면 더 있습니다.

- **파일시스템**: `ls -alrt`, `cd`, `pwd`, `cat -n`, `tree -a`, `find -name <glob>`, `grep -inav`, 심볼릭 링크
- **텍스트**: `head`, `tail`, `wc`, `nl`, `sort`, `uniq`, `cut`, `tr`, `rev`, `tac`, `seq`, `tee`, `echo`, `sed`, `diff`, `shuf`, `xxd`, `base64`
- **경로**: `basename`, `dirname`, `realpath`, `readlink`, `stat`, `file`, `which`, `type`
- **시스템**: `df`, `du`, `free`, `ps`, `env`, `id`, `hostname`, `mount`, `uname`, `date`, `uptime`, `nproc`, `man`
- **별도 패키지**: `awk`, `bc`, `cal`, `neofetch`, `xdg-open`, `vi`, `mpv`, `qrencode`, `vcard`, `less`, `lolcat`, `time`, `alias`
- **파이프**: `cat /etc/passwd | cut -d: -f1`, `ls -al | awk '{print $5, $9}'`, `seq 5 | tac`. 상류 명령은 하류가 있는지 전달받아서, `ls`는 실제 ls가 stdout이 tty가 아닐 때 그러듯 한 줄에 하나씩 출력합니다.
- **키바인딩**: `Ctrl-A/E`(줄 처음·끝), `Ctrl-U/K`(삭제), `Alt-Backspace`(단어 삭제), `Ctrl-C`(줄 취소, 단 선택된 텍스트가 있으면 복사가 우선), `Ctrl-D`(EOF), `Ctrl-L`(화면 지우기), `Alt-R`(역방향 히스토리 검색). **`Ctrl-R`과 `Ctrl-W`는 브라우저 소유라 건드리지 않습니다.**
- **확장**: `!!`, `!$`, `$?`. 종료 상태는 명령 없음이면 127, SIGINT면 130으로 bash와 같습니다.
- **Tab 완성**: 한 번은 공통 접두사까지, 두 번 연속이면 후보를 스크롤백에 컬럼으로 출력하고 프롬프트를 다시 그립니다.

### 셸마다 자기 상태를 갖습니다

파일시스템은 cwd를 하나만 들고 있고 프롬프트 이름도 전역이었습니다. 창이 하나일 때는 문제가 없었지만 여러 개가 되면 한 창에서 `cd`나 `su`를 하면 전부 따라 움직였습니다.

지금은 각 셸이 자기 디렉터리와 자기 정체성을 들고, 명령을 실행하기 직전에 전역을 자기 쪽으로 돌려놓고(`FS.enter`, `enterPromptName`) 끝나면 되읽습니다. Tab 완성도 같은 경로를 씁니다. `setCwd`와 `setPromptName`은 계속 저장하므로 **새 셸은 마지막 `cd` 위치, 마지막 이름에서 시작**합니다.

### 값이 전부 실물입니다

`neofetch`는 `/etc/os-release`, FS 트리 크기, `performance.now()`, 저장된 테마, `screen`, V8 힙에서 값을 읽습니다. `cal`은 캘린더에 일정이 있는 날을 표시합니다. `df`와 `du`와 `neofetch`의 디스크 수치가 서로 어긋나면 [scripts/smoke.mjs](scripts/smoke.mjs)가 실패시킵니다.

`bc`는 `eval`이 아니라 재귀 하향 파서입니다. 입력이 신뢰할 수 없는 텍스트이기도 하고, `^`가 bc에서는 거듭제곱인데 JavaScript에서는 XOR라서 그렇습니다.

`qrencode`는 [src/qr.js](src/qr.js)의 자체 인코더입니다. GF(256) 리드-솔로몬, BCH(15,5) 포맷 정보, ISO/IEC 18004 모듈 배치, 페널티 규칙 기반 마스크 선택. 스캔되는 코드가 나오지 않으면 의미가 없어서 실제로 구현했습니다.

### vi

[src/vi-editor.jsx](src/vi-editor.jsx)는 진짜 모달 편집기입니다. 버퍼는 실제로 편집됩니다: `h j k l 0 ^ $ w b e gg G`, `i I a A o O`, `x D dd`, `u`(되돌리기), `p`, `ZZ`, `:` 명령. **저장만 실패합니다.**

읽기 전용 마운트라 vim이 실제로 내는 순서 그대로입니다. `:w` 는 `E45: 'readonly' option is set (add ! to override)`, `:w!` 는 `E212: Can't open file for writing`, 저장 없이 `:q` 하면 `E37: No write since last change (add ! to override)`. 나가려면 `:q!` 를 알아야 합니다.

vi는 화면 행 수를 직접 세기 때문에 줄바꿈되면 물결(`~`) 개수와 위치 표시가 어긋납니다. 그래서 `set nowrap`으로 동작합니다.

### 쓰기와 네트워크

트리는 읽기 전용입니다. `mkdir`, `touch`, `rm`, `cp`, `mv`, `chmod`는 리눅스가 실제로 내는 `Read-only file system` 오류를 반환하고, `rm /`는 그 이전에 GNU rm의 `--preserve-root` 실패가 먼저 걸립니다. 네트워크 도구(`ping`, `ssh`, `curl`)도 브라우저 샌드박스에서 실패하는 실제 이유를 그대로 말합니다.

파일 탐색기의 우클릭 메뉴도 이름 바꾸기와 삭제를 그대로 두고 누르면 같은 오류를 냅니다. 숨기는 게 깔끔하지만 아무것도 알려주지 않습니다.

[src/extras.js](src/extras.js)에는 coreutils가 아닌 별도 패키지(`sl`, `cowsay`, `fortune`, `cmatrix`, `reboot`)와 셸 정체성(`su`, `exit`, `sudo`)만 있습니다. 명령 테이블을 먼저 조회하고 없을 때만 여기로 넘어가므로, 실제 명령이 가려지지 않습니다. 예전에 순서가 반대여서 `df`와 `man`과 `ps`가 농담에 가려진 적이 있습니다.

`man <명령>`이 모든 명령에 동작합니다. 명령 정의의 `usage` 필드에서 나오며, `usage` 없는 명령이 생기면 스모크 테스트가 실패합니다.

## 라이브 데이터

복사해 두지 않고 열 때 읽습니다. 전부 CORS를 허용하는 출처라서 프록시가 필요 없습니다.

| 파일 | 출처 |
|---|---|
| `~/now.log` | Google Calendar API |
| `~/repos` | GitHub API, 공개 저장소 전부 |
| `/home/memo/til.log` | til.99jik.com RSS |
| `/var/log/deploy.log` | 이 저장소의 커밋 |
| `~/.midnight/playlist.m3u` | YouTube Data API |

이 파일들은 `ls -l`에서 0바이트로 나옵니다. 읽기 전에는 길이가 없기 때문이고, `/proc`이 그렇게 합니다.

## 서체

두 서체에 역할을 나눠 뒀습니다. `:root`의 `--mono`와 `--ui`입니다.

- **`--mono`**: 터미널, vi, 부팅 로그, QR, 그리고 GUI 안에서도 경로, 오류 문자열, 키 이름, 코드, 정렬이 의미인 것들
- **`--ui`**: 창 제목표시줄(터미널 것 포함), 독, 메뉴, 잠금화면, GUI 앱 본문

창 장식은 앱이 아니라 시스템 소유라서 제목표시줄은 전부 같은 서체입니다.

**한글이 패딩된 중간 열에 오면 안 됩니다.** 한글은 JetBrains Mono에 글리프가 없어 다음 폰트에서 나오는데, 그 advance가 라틴의 정확히 두 배라는 보장이 없습니다. 셀을 정확히 세도 열이 밀립니다. 그래서 모든 표에서 한글은 마지막 열이고, 중간 열에 들어가면 스모크 테스트가 실패합니다.

## 세 개의 화면

- `99jik.com` 은 데스크톱으로 엽니다. 터미널이 최대화된 채로 시작합니다.
- `99jik.com/?view=easy` 는 문서 뷰로 엽니다. **지원서나 메일에는 이 링크를 씁니다.** 채용 담당자나 교수님이 터미널을 만날 이유가 없습니다.
- 좁은 화면이나 포인터가 없는 기기는 창을 띄우지 않고 터미널이 곧 화면입니다.

`?view` 는 저장된 기본 모드보다 우선합니다. 링크를 받은 사람 모두에게 같은 화면이 뜨도록 하기 위해서입니다. 모드를 바꾸면 주소창도 따라 바뀌므로 현재 화면을 그대로 복사해 공유할 수 있고, 기본 모드일 때는 파라미터가 빠져서 주소가 깨끗하게 유지됩니다.

## 크롤러 폴백

클라이언트 렌더링이라 크롤러와 링크 미리보기 스크레이퍼가 받는 HTML은 원래 `<div id="root"></div>` 하나였습니다. [scripts/build.mjs](scripts/build.mjs)의 `fallbackHtml()` 이 `src/data.js` 를 읽어 같은 내용을 평범한 HTML로 만들어 `index.html` 에 심습니다.

`<head>` 의 인라인 스크립트가 첫 페인트 전에 `js` 클래스를 붙이고 CSS가 그 아래에서 폴백을 숨기므로, 스크립트가 도는 방문자는 이걸 보지 못합니다. 런타임 비용은 0입니다. JS가 꺼진 환경에서는 이 HTML이 그대로 보입니다.

[scripts/smoke.mjs](scripts/smoke.mjs) 가 `fallbackHtml()` 을 직접 import 해서 이름, 모든 프로젝트 제목, 논문, 특허, CV 링크가 들어 있는지 검사합니다. 폴백이 조용히 비는 것을 막기 위해서입니다. 그래서 `build.mjs` 는 스크립트로 직접 실행될 때만 빌드하고, import 로는 부작용이 없습니다.

## 색 대비

네 테마 모두 본문(`fg`), 보조 텍스트(`muted`), 오류(`red`) 가 WCAG AA(4.5:1) 이상입니다. `muted` 가 중요한데, 명령 출력의 약 15%가 dim 으로 나가기 때문에 장식이 아니라 본문입니다. 장식용은 `faint` 하나뿐입니다.

테마 색을 바꿀 때는 이 기준을 다시 확인해야 합니다. Solarized 의 `red` 는 원본 팔레트(`#dc322f`, 3.25:1)가 AA 를 통과하지 못해 의도적으로 밝게 바꾼 값입니다.

## 테스트

`npm run check`는 브라우저 없이 [scripts/smoke.mjs](scripts/smoke.mjs)를 돌립니다. DOM을 흉내 낸 뒤 `src/*.js`를 `main.jsx`와 같은 순서로 로드하고 명령 레이어를 실제로 실행합니다.

Preact 컴포넌트는 실행할 수 없으므로 **소스를 읽어 검사**합니다. 조용히 무너지는 종류의 회귀가 반복해서 나왔기 때문입니다.

- `.win.stowed`에 `display: none`이 들어가면 실패 (재생이 멈춥니다)
- 최소화한 창을 렌더에서 걸러내면 실패
- 한글이 패딩된 중간 열에 오면 실패
- CSS에 이름만 있고 정의되지 않은 `@keyframes`가 있으면 실패
- `.win.maxed`가 남기는 여백과 `WM.DOCK_H`가 다르면 실패
- 데이터가 CV와 어긋나면 실패
- 렌더러가 처리하지 않는 `block.kind`를 명령이 낼 수 있으면 실패

마지막 항목은 `parts`가 사라져 lolcat이 흑백으로 나온 적이 있어서 넣었습니다. 오류는 나지 않았습니다.

## 콘텐츠 수정

거의 전부 [src/data.js](src/data.js) 한 파일에 있습니다. 프로필, 연구 관심사, 프로젝트, 논문, 특허, 경력, 스킬, 원칙 문서, `fortune` 문구까지 여기서 읽습니다. 가상 파일시스템([src/fs.js](src/fs.js))의 트리도 이 데이터에서 생성되므로, 프로젝트를 추가하면 `~/projects/<slug>.md`가 자동으로 생깁니다.

- `projects`의 `summary_*`는 표와 카드에 나오는 한 줄, `detail_*`는 `cat <slug>`와 `.md` 파일에만 나오는 상세입니다. 두 언어의 `detail` 줄 수가 다르면 스모크 테스트가 실패합니다. 한쪽 언어만 조용히 덜 말하는 것을 막기 위해서입니다.
- `publications`는 CV가 정본입니다. 국내 학회 논문이라 한국어 제목이 원제고 영어 제목은 CV의 번역입니다.
- `notes.*`의 문서들은 마크다운입니다. 파일 창과 뷰어가 렌더하고 `cat`은 원문을 찍습니다. 렌더러([src/md.jsx](src/md.jsx))는 헤딩, 목록, 인용, 코드 펜스, **표**, 인라인 마크를 지원합니다. HTML 문자열을 만들지 않고 Preact 노드를 직접 만들기 때문에, 노트에 태그가 들어 있으면 그 태그의 텍스트로 나옵니다.
- `notes.memo`는 도메인별로 파일 하나씩입니다. `{ file, title, md }` 형태이고 `title`은 `/home/memo/README`의 목차에 쓰입니다.

예외로 [index.html](index.html)의 `<title>`과 og 메타는 정적이라 따로 고쳐야 합니다.

날짜는 손으로 적지 않습니다. 푸터의 저작권 연도와 업데이트 날짜는 빌드 시각(`__BUILD_DATE__`)에서 유도됩니다.

## 캘린더

브라우저가 **Google Calendar API로 직접** 읽습니다. 동기화가 필요 없고, 반복 일정도 인스턴스로 펼쳐집니다.

키는 [data.js](src/data.js)의 `site.gcalApiKey`에 있습니다. 브라우저 키라 번들에 노출되는 게 정상이고, **유일한 방어선은 Google Cloud의 HTTP 리퍼러 제한**입니다. 현재 `99jik.com` 계열만 허용돼 있어서 다른 곳에서는 403이 납니다. 키를 갈 때는 제한을 다시 거는 걸 잊지 마세요. 같은 키가 YouTube Data API도 쓰므로 API 제한사항에 둘 다 들어 있어야 합니다.

`localhost`는 일부러 허용 목록에서 뺐습니다. 그래서 로컬 개발에서는 API가 실패하고 아래 스냅샷으로 떨어집니다.

### 폴백 스냅샷

`public/calendar.json`은 API가 실패했을 때 쓰이는 방어선입니다. 할당량이나 키 문제, 구글 장애뿐 아니라 **방문자 브라우저가 `Referer`를 떼고 보내는 경우**에도 필요합니다. 리퍼러가 없으면 API가 403을 내기 때문입니다. `localhost`가 허용 목록에 없어서 로컬 개발도 여기로 떨어집니다.

[scripts/fetch-calendar.mjs](scripts/fetch-calendar.mjs)가 공개 iCal 피드에서 만들고 **배포 워크플로가 빌드 직전에 갱신**합니다. 갱신이 실패해도 배포를 막지 않습니다.

파일은 **커밋된 채로 둡니다.** 갱신이 실패했을 때 아무것도 없는 것보다 오래된 진짜 스냅샷이 낫기 때문입니다. 매일 이걸 커밋하던 크론 워크플로는 삭제했고, 이제 **CI가 저장소에 쓰는 일은 없습니다**. 스모크 테스트가 워크플로에 `git commit`이나 `contents: write`가 들어오면 실패시킵니다.

셋 다 실패하면 마지막 폴백은 **빈 캘린더**입니다. 예전에는 그럴듯한 일정 아홉 개가 들어 있었고 UI가 그걸 방금 동기화된 것처럼 표시했습니다. 지금은 불러오지 못했다고 말합니다.

수동으로 갱신하려면 `npm run calendar` 입니다.

수집 범위는 ±1년입니다. 날짜 필터링은 [calendar.js](src/calendar.js)가 브라우저에서 하므로, 스냅샷이 오래돼도 그 범위 안에서는 정확합니다. 예전에 `-1일~+45일`로 잘라 저장하던 시절에는 동기화가 멈추면 곧바로 빈 화면이 됐습니다.

태그는 캘린더가 이미 달고 있는 대괄호 접두어(`[수업]`, `[TA]`, `[Seminar]`)를 먼저 읽습니다. 주인이 직접 붙인 분류라 키워드 추측보다 낫습니다. [calendar.js](src/calendar.js)와 [fetch-calendar.mjs](scripts/fetch-calendar.mjs)가 같은 규칙을 써야 합니다. 다르면 API가 안 될 때 `now`의 의미가 바뀝니다.

### 공개 범위

이 캘린더는 공개입니다. 제목에 `[private]` 또는 `[비공개]`가 들어간 일정만 제외되고 나머지는 제목과 장소가 그대로 보입니다. 비공개 캘린더로 바꾸려면 API 키 방식을 버리고 시크릿 기반 동기화로 되돌려야 합니다.

## 배포

`main`에 푸시하면 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)이 빌드해서 GitHub Pages로 올립니다. `paths` 필터가 걸려 있어 관련 없는 커밋으로는 배포가 돌지 않습니다. 빌드 전에 `npm run check`가 돌고, 캘린더 스냅샷 갱신은 실패해도 배포를 막지 않습니다.

## 소셜 카드

`og:image`로 쓰는 [public/og.png](public/og.png)는 [scripts/make-og.py](scripts/make-og.py)로 생성합니다. Pillow와 Windows 시스템 폰트(Consolas, Malgun Gothic)가 필요한 일회성 도구이며 빌드에는 포함되지 않습니다. 이름이나 소속, 테마 색이 바뀌면 다시 돌리세요.

```bash
python scripts/make-og.py
```

`og:image`가 절대 URL이라 링크 미리보기는 배포 후에만 확인됩니다.
