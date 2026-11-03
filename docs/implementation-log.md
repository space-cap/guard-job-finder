# 구현 기록

작성일: 2026-06-17

## 1. 현재 상태

고용24 경비 일자리 모니터 MVP를 구현했다.

현재 앱은 고용24 상세검색 화면의 POST 결과 HTML을 수집해 SQLite에 저장하고, 웹 대시보드와 Slack/Discord Webhook 알림으로 보여준다.

공식 채용정보 Open API는 개인회원 키로 사용할 수 없어서 현재 기본 수집 방식은 `SOURCE_MODE=browser`다. 실제로는 브라우저 자동화가 아니라 고용24 상세검색 POST 결과 HTML을 HTTP로 받아 `cheerio`로 파싱한다.

## 2. 구현 완료 항목

### 2.1 수집

- 고용24 상세검색 초기 페이지 요청
- 검색 POST 엔드포인트 호출
- 키워드별 검색 실행
- 요청 간 대기 시간 적용
- 제외어 필터링
- 상세 공고 링크 추출
- 상세 페이지 추가 수집
- 담당업무, 고용형태, 접수방법, 상세 텍스트 저장

관련 파일:

- `lib/work24.js`
- `scripts/fetch-jobs.mjs`

### 2.2 저장소

- SQLite 저장
- `wantedAuthNo` 또는 URL 기반 중복 제거
- 검색 실행 이력 저장
- 알림 발송 이력 저장
- 웹 설정 저장
- 관심/숨김 상태 저장
- 적합도 점수 저장

관련 파일:

- `lib/db.js`
- `scripts/init-db.mjs`

### 2.3 경비 적합도 점수

검색 결과가 너무 넓게 잡히는 문제를 줄이기 위해 점수화 로직을 추가했다.

가점 예시:

- `경비원`
- `경비대원`
- `시설경비`
- `건물경비`
- `아파트 경비`
- `보안대원`
- `순찰`
- `당직 경비`
- `야간`
- `주말`

감점 예시:

- `요양보호사`
- `간병`
- `사회복지사`
- `물리치료사`
- `간호사`
- `조리원`
- `시설기사`
- `전기 기능사`
- `기계설비`
- `요양원`
- `병원`

알림은 기본적으로 `MIN_NOTIFY_SCORE` 이상의 공고만 보낸다.

### 2.4 웹 UI

웹 대시보드 기능:

- 저장 공고 수
- 오늘 신규 공고 수
- 마감 전 공고 수
- 관심 공고 수
- 최신 공고 목록
- 점수 배지
- 신규/야간/주말/마감임박 배지
- 키워드 필터
- 지역 필터
- 배지 필터
- 일반/관심/숨김 보기
- 관심 등록/해제
- 숨김/숨김 해제
- 검색 설정 수정

관련 파일:

- `app/page.js`
- `app/actions.js`
- `app/globals.css`

### 2.5 Slack/Discord 알림

알림 기능:

- 새 공고만 알림
- 강제 알림
- 최근 공고 테스트 알림
- Slack Webhook 테스트
- 수집 실패 알림
- 키워드별 신규 공고 요약
- 점수, 회사, 지역, 급여, 근무, 마감, 링크 포함

관련 파일:

- `lib/notify.js`
- `scripts/test-slack-webhook.mjs`
- `scripts/notify-latest.mjs`

명령:

```powershell
npm run test:slack
npm run notify:latest
npm run fetch:jobs:notify-all
```

### 2.6 Windows 작업 스케줄러

하루 2회 자동 수집을 등록할 수 있는 PowerShell 스크립트를 추가했다.

기본 실행 시간:

- 08:00
- 18:00

관련 파일:

- `scripts/register-windows-task.ps1`
- `scripts/unregister-windows-task.ps1`
- `docs/windows-scheduler.md`

등록:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-windows-task.ps1
```

해제:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\unregister-windows-task.ps1
```

## 3. 주요 명령

DB 초기화:

```powershell
npm run db:init
```

수집:

```powershell
npm run fetch:jobs
```

이번 조회 결과 강제 알림:

```powershell
npm run fetch:jobs:notify-all
```

최근 저장 공고 강제 알림:

```powershell
npm run notify:latest
```

Slack Webhook 테스트:

```powershell
npm run test:slack
```

개발 서버:

```powershell
npm run dev -- --port 3010
```

빌드:

```powershell
npm run build
```

## 4. 환경 변수

`.env.example` 기준으로 운영한다.

중요 값:

```env
SOURCE_MODE=browser
DATABASE_PATH=./data/guard-jobs.sqlite
APP_BASE_URL=http://localhost:3000
SEARCH_KEYWORDS=주말경비,야간경비,경비원,시설경비,건물경비,아파트 경비,보안,당직
EXCLUDE_KEYWORDS=요양보호사,간병,요양원,실버타운,사회복지사,물리치료사,간호사,조리원
SEARCH_RESULT_COUNT=10
SEARCH_DELAY_MS=1500
FETCH_DETAILS=true
DETAIL_DELAY_MS=300
MIN_NOTIFY_SCORE=20
SLACK_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=
NOTIFY_CHANNELS=slack
NOTIFY_FAILURES=true
```

주의:

- `.env`는 Git에 올리지 않는다.
- `SLACK_WEBHOOK_URL`은 비밀값으로 취급한다.
- Slack 테스트는 실제 채널에 메시지를 보낸다.

## 5. 검증 결과

확인한 명령:

```powershell
npm run db:init
npm run build
npm run fetch:jobs
npm run notify:latest
```

결과:

- DB 초기화 성공
- Next.js 빌드 성공
- 고용24 수집 성공
- 상세 페이지 수집 성공
- 점수/배지 저장 확인
- Slack 강제 발송 성공
- 웹 화면에서 `검색 설정`, `필터 적용`, `관심`, `숨김`, 점수 표시 확인

최근 확인 URL:

```text
http://localhost:3010
```

## 6. 운영 주의사항

- Node 내장 SQLite를 사용하므로 실행 시 `ExperimentalWarning`이 나온다. 현재 동작에는 문제 없다.
- 고용24 화면 구조가 바뀌면 `lib/work24.js`의 파서 수정이 필요할 수 있다.
- 수집은 하루 2회 정도의 저빈도 운영을 전제로 한다.
- 로그인, 우회, 보안장치 회피가 필요한 방식은 사용하지 않는다.
- `data/guard-jobs.sqlite`는 로컬 운영 데이터이므로 백업이 필요하면 별도로 복사한다.

## 7. 다음 개선 후보

- 상세 페이지 파싱 정확도 개선
- 지역 코드 기반 필터 추가
- 공고 상세 모달 또는 별도 상세 페이지 추가
- Slack 메시지에 관심 등록 링크 추가
- 실패 알림에 마지막 성공 시각 포함
- 오래된 마감 공고 자동 숨김 처리
- SQLite 백업 스크립트 추가
- Docker 배포 구성 추가

