# Guard Job Finder

고용24 상세검색 화면에서 경비 관련 공고를 수집해 SQLite에 저장하고, 웹페이지와 Slack/Discord 알림으로 확인하는 MVP입니다.

## 기술 스택

- Next.js
- Node.js 24
- Node 내장 SQLite
- Cheerio HTML 파싱
- Slack/Discord Webhook

## 시작하기

```powershell
npm install
Copy-Item .env.example .env
npm run fetch:jobs
npm run dev
```

웹페이지:

```text
http://localhost:3000
```

## 주요 명령

```powershell
npm run db:init
npm run fetch:jobs
npm run fetch:jobs:notify-all
npm run notify:latest
npm run test:slack
npm run dev
npm run build
```

## 환경 변수

`.env.example`를 `.env`로 복사해서 수정합니다.

- `SEARCH_KEYWORDS`: 쉼표로 구분한 검색어
- `EXCLUDE_KEYWORDS`: 제외어
- `SEARCH_RESULT_COUNT`: 키워드별 수집 건수
- `SEARCH_DELAY_MS`: 키워드 간 요청 대기 시간
- `FETCH_DETAILS`: 상세 페이지 추가 수집 여부
- `MIN_NOTIFY_SCORE`: Slack/Discord로 보낼 최소 적합도 점수
- `SLACK_WEBHOOK_URL`: Slack Incoming Webhook
- `DISCORD_WEBHOOK_URL`: Discord Webhook
- `NOTIFY_CHANNELS`: `slack`, `discord`, 또는 `slack,discord`

## 현재 수집 방식

개인회원 API 키는 채용정보 목록/상세 API를 사용할 수 없어서, 현재는 고용24 상세검색 페이지의 POST 결과 HTML을 파싱합니다.

수집 엔드포인트:

```text
https://www.work24.go.kr/wk/a/b/1200/retriveDtlEmpSrchListInPost.do
```

## 운영 메모

- `data/guard-jobs.sqlite`는 로컬 DB이며 Git에는 포함하지 않습니다.
- 하루 2회 실행은 Windows 작업 스케줄러 또는 서버 cron으로 `npm run fetch:jobs`를 등록합니다.
- Webhook 환경 변수가 없으면 알림은 보내지 않고 DB 저장만 수행합니다.

## Slack Webhook 테스트

`.env`에 다음 값을 넣습니다.

```env
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
NOTIFY_CHANNELS=slack
```

테스트 메시지를 보냅니다.

```powershell
npm run test:slack
```

## 강제 알림

새 공고가 없어도 최근 수집 결과를 테스트 발송하려면:

```powershell
npm run notify:latest
```

수집하면서 이번에 조회된 공고를 강제로 발송하려면:

```powershell
npm run fetch:jobs:notify-all
```

## Windows 작업 스케줄러

하루 2회 자동 수집을 등록합니다.

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-windows-task.ps1
```

자세한 내용은 [docs/windows-scheduler.md](docs/windows-scheduler.md)를 참고합니다.
