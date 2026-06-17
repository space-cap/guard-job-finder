# 고용24 상세검색 수집 조사

작성일: 2026-06-17

## 결론

개인회원 API 키로는 채용정보 목록/상세 API를 사용할 수 없다.

검증 응답:

```xml
<GO24>
  <error>개인회원은 사용할 수 없는 OPEN-API입니다.</error>
</GO24>
```

따라서 현재 구현은 고용24 상세검색 페이지의 POST 결과 HTML을 파싱한다.

## 사용 엔드포인트

초기 페이지:

```text
GET https://www.work24.go.kr/wk/a/b/1200/retriveDtlEmpSrchList.do
```

검색 결과:

```text
POST https://www.work24.go.kr/wk/a/b/1200/retriveDtlEmpSrchListInPost.do
```

주요 파라미터:

- `keyword`
- `srcKeyword`
- `resultCnt`
- `sortOrderBy=DESC`
- `sortField=DATE`
- `pageIndex=1`
- `currentPageNo=1`

## 파싱 기준

검색 결과 HTML에서 상세 링크를 찾는다.

```text
a[href*=empDetailAuthView]
a[onclick*=empDetailAuthView]
```

공고 하나는 상세 링크의 상위 `tr`에 들어 있다.

- 1번째 `td`: 회사명, 채용제목
- 2번째 `td`: 급여, 경력, 학력, 근무형태, 지역
- 3번째 `td`: 마감일, 등록일

상세 링크 예시:

```text
/wk/a/b/1500/empDetailAuthView.do?wantedAuthNo=...&infoTypeCd=VALIDATION&infoTypeGroup=tb_workinfoworknet
```

중복 기준:

1. `wantedAuthNo`
2. 원문 URL
3. `회사명 + 제목 + 지역 + 마감일` 해시

## 운영 주의

- 화면 구조가 바뀌면 파서가 깨질 수 있다.
- 하루 2회 정도의 저빈도 실행을 전제로 한다.
- 로그인, 우회, 보안장치 회피가 필요한 방식은 사용하지 않는다.
