# SolidStateImage

맥미니에 저장된 대용량 사진을 **테일스케일(Tailscale) P2P** 로 연결해, 갤럭시 탭에서
용량 낭비·렉 없이 **아주 빠르게** 브라우징하는 원격 이미지 뷰어.

SMB로 파일을 통째로 받지 않습니다. 맥미니 백엔드가 이미지를 실시간으로 경량화(WebP)
하고 **한 번 만든 결과를 디스크에 캐싱**해 즉시 스트리밍합니다. 프론트엔드는 웹 기술로
만들고 **Capacitor**로 감싸 갤럭시 탭용 안드로이드 앱(APK)으로 빌드합니다.

```
Galaxy Tab (Capacitor 앱 / Chrome PWA)
        │  http  (Tailscale 100.x.y.z:8787)
        ▼
Mac mini  ──  Node + Express + Sharp
              ├─ /api/dir    폴더·이미지 목록(JSON)
              ├─ /api/thumb  격자용 WebP 썸네일 (정사각 크롭, 디스크 캐시)
              ├─ /api/view   뷰어용 WebP (긴 변 최대 2000px, 디스크 캐시)
              └─ /api/raw    원본 다운로드
```

## 구성

| 폴더       | 내용 | 스택 |
| ---------- | ---- | ---- |
| `server/`  | 맥미니 이미지 서버 | Node.js · Express · Sharp(libvips) |
| `app/`     | 갤럭시 탭 프론트엔드 | React · Vite · TypeScript · framer-motion · Capacitor |

### 속도 설계 (핵심)

- **백엔드 디스크 캐싱** — `(경로+수정시각+크기+옵션)` 해시로 캐시. 한 번 생성한
  썸네일/뷰는 재생성 없이 디스크에서 바로 스트리밍. 소스가 수정되면 자동 무효화.
- **HTTP 캐시** — `Cache-Control: immutable` + `ETag`/`304`. 한 번 받은 이미지는
  WebView/브라우저가 다시 요청하지 않음.
- **정사각 크롭 썸네일** — 격자가 균일(애플 사진 앱 느낌)하고 레이아웃 시프트 없음.
- **`content-visibility`** — Chromium(WebView)이 화면 밖 썸네일 렌더를 건너뜀 → 사실상
  가상 스크롤 수준의 성능을 적은 코드로.
- **이웃 프리페치** — 뷰어에서 앞뒤 사진을 미리 받아 스와이프가 즉시 반응.

### UI

다크 글래스 디자인 토큰(`app/src/styles/global.css`) + `backdrop-filter` 블러로 애플
리퀴드 글래스풍의 미니멀 UI. framer-motion 스프링 애니메이션, 핀치 줌·더블탭 줌
(`react-zoom-pan-pinch`), 네이티브 scroll-snap 기반의 부드러운 사진 페이징.

---

## 1) 백엔드 실행 (맥미니)

```bash
cd server
npm install
PHOTO_ROOT="/Users/me/Pictures" npm start      # 기본 포트 8787
```

환경 변수:

| 변수 | 기본값 | 설명 |
| ---- | ------ | ---- |
| `PHOTO_ROOT` | `~/Pictures` | 브라우징할 사진 루트(이 밖으로는 절대 못 나감) |
| `PORT` | `8787` | 서버 포트 |
| `CACHE_DIR` | `server/cache` | 생성 이미지 캐시 위치 |
| `WEB_DIR` | `app/dist` | 빌드된 웹앱 경로(있으면 `/`에서 같이 서빙) |
| `THUMB_QUALITY` / `VIEW_QUALITY` | `72` / `84` | WebP 화질 |

> **HEIC/HEIF**(아이폰 사진): 번들된 libvips가 못 읽으면 macOS `sips`로 자동 폴백 변환합니다.

맥미니에서 항상 떠 있게 하려면 `launchd`(또는 `pm2`)로 등록하세요.

## 2) 가장 간단한 사용법 — 브라우저/PWA

웹앱을 빌드해 두면 백엔드가 `/`에서 같이 서빙하므로, 갤탭에서 주소만 열면 됩니다.

```bash
cd app && npm install && npm run build      # → app/dist 생성
cd ../server && PHOTO_ROOT=... npm start
```

갤럭시 탭 크롬에서 `http://<맥미니-tailscale-ip>:8787` 접속 → 메뉴 → **홈 화면에 추가**.
(API와 같은 출처라 CORS·혼합콘텐츠 문제 없음)

## 3) 네이티브 앱(APK)으로 — Capacitor

```bash
cd app
npm install
npm run build
npx cap add android          # 최초 1회: android/ 네이티브 프로젝트 생성
npm run cap:sync             # 빌드 + 동기화
npm run cap:open             # Android Studio 열기 → Run/APK 빌드
```

- 네이티브 앱은 첫 실행 시 **연결 화면**에서 맥미니 주소(`http://100.x.y.z:8787`)를 입력합니다.
- 맥미니는 평문 HTTP라 `capacitor.config.ts`에 **cleartext 허용**을 켜 두었습니다.
- 안드로이드 하드웨어 뒤로가기 → 상위 폴더 이동(루트에서는 앱 종료).

## 4) 개발 모드

```bash
# 터미널 A — 백엔드
cd server && PHOTO_ROOT=... npm run dev

# 터미널 B — 프론트(Vite, /api 를 8787로 프록시)
cd app && npm run dev          # http://localhost:5173
```

다른 포트의 백엔드를 쓰려면 `VITE_API_TARGET=http://localhost:9000 npm run dev`.

---

## 테일스케일

맥미니와 갤럭시 탭 모두 같은 Tailnet에 로그인하면 끝입니다. 맥미니의 Tailscale IP
(`100.x.y.z`, `tailscale ip -4`로 확인)를 앱 서버 주소로 사용하세요. 포트포워딩·공인 IP
불필요, 트래픽은 WireGuard로 암호화됩니다.

## API 요약

| 엔드포인트 | 설명 |
| ---------- | ---- |
| `GET /api/dir?path=<rel>` | 폴더 목록 `{ dirs, images, parent, ... }` |
| `GET /api/thumb?path=<rel>&w=400` | 정사각 WebP 썸네일 (`w` ∈ 200·300·400·600) |
| `GET /api/view?path=<rel>&w=2000` | 뷰어용 WebP (`w` ∈ 1280·2000·2560) |
| `GET /api/raw?path=<rel>` | 원본 파일 |
| `GET /api/health` | 상태 확인 |

모든 경로는 `PHOTO_ROOT` 기준 상대경로이며, 상위 탈출(`..`) 요청은 403으로 차단됩니다.
