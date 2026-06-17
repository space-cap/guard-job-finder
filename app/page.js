import { getConfig } from "@/lib/config.js";
import { getDistinctFilterValues, getSettings, getStats, listJobs } from "@/lib/db.js";
import { saveSettings, setFavorite, setHidden } from "./actions.js";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }) {
  const params = await searchParams;
  const filters = {
    keyword: params?.keyword || "",
    region: params?.region || "",
    badge: params?.badge || "",
    view: params?.view || "active"
  };
  const jobs = listJobs({ limit: 80, ...filters });
  const stats = getStats();
  const latestRun = stats.latestRun;
  const filterValues = getDistinctFilterValues();
  const config = getConfig();
  const settings = getSettings({
    searchKeywords: config.searchKeywords.join(","),
    excludeKeywords: config.excludeKeywords.join(","),
    searchResultCount: String(config.searchResultCount),
    fetchDetails: String(config.fetchDetails),
    minNotifyScore: String(config.minNotifyScore)
  });

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <h1>경비 일자리 모니터</h1>
            <p>고용24 상세검색 기반 신규 공고 수집 대시보드</p>
          </div>
          <div className="status-pill">
            마지막 실행: {latestRun?.finished_at ? formatDateTime(latestRun.finished_at) : "아직 없음"}
          </div>
        </div>
      </header>

      <main className="main">
        <section className="metrics" aria-label="수집 현황">
          <Metric label="저장 공고" value={`${stats.total}건`} />
          <Metric label="오늘 신규" value={`${stats.todayCount}건`} />
          <Metric label="마감 전" value={`${stats.openCount}건`} />
          <Metric label="관심 공고" value={`${stats.favoriteCount}건`} />
        </section>

        <section className="control-panel" aria-label="검색 설정">
          <div className="panel-head">
            <h2>검색 설정</h2>
            <span>다음 수집부터 반영</span>
          </div>
          <form className="settings-form" action={saveSettings}>
            <label>
              검색어
              <textarea name="searchKeywords" rows="3" defaultValue={settings.searchKeywords} />
            </label>
            <label>
              제외어
              <textarea name="excludeKeywords" rows="3" defaultValue={settings.excludeKeywords} />
            </label>
            <label>
              키워드별 건수
              <input
                name="searchResultCount"
                type="number"
                min="1"
                max="50"
                defaultValue={settings.searchResultCount}
              />
            </label>
            <label>
              알림 최소 점수
              <input
                name="minNotifyScore"
                type="number"
                min="0"
                max="100"
                defaultValue={settings.minNotifyScore}
              />
            </label>
            <label className="checkbox-line">
              <input
                name="fetchDetails"
                type="checkbox"
                defaultChecked={settings.fetchDetails === "true"}
              />
              상세 페이지 수집
            </label>
            <button className="button" type="submit">설정 저장</button>
          </form>
        </section>

        <div className="toolbar">
          <h2>최신 공고</h2>
          <div className="status-pill">
            최근 신규: {latestRun?.new_count ?? 0}건 · 수집 방식: {latestRun?.source_mode || "browser"}
          </div>
        </div>

        <form className="filters" action="/" method="get">
          <select name="keyword" defaultValue={filters.keyword} aria-label="키워드 필터">
            <option value="">전체 키워드</option>
            {filterValues.keywords.map((keyword) => (
              <option value={keyword} key={keyword}>{keyword}</option>
            ))}
          </select>
          <select name="region" defaultValue={filters.region} aria-label="지역 필터">
            <option value="">전체 지역</option>
            {filterValues.regions.map((region) => (
              <option value={region} key={region}>{region}</option>
            ))}
          </select>
          <select name="badge" defaultValue={filters.badge} aria-label="배지 필터">
            <option value="">전체 배지</option>
            {filterValues.badges.map((badge) => (
              <option value={badge} key={badge}>{badge}</option>
            ))}
          </select>
          <select name="view" defaultValue={filters.view} aria-label="보기 필터">
            <option value="active">일반</option>
            <option value="favorite">관심</option>
            <option value="hidden">숨김</option>
          </select>
          <button className="button secondary" type="submit">필터 적용</button>
          <a className="button ghost" href="/">초기화</a>
        </form>

        {jobs.length === 0 ? (
          <div className="empty">
            아직 저장된 공고가 없습니다. `npm run fetch:jobs`로 첫 수집을 실행하세요.
          </div>
        ) : (
          <section className="job-list" aria-label="공고 목록">
            {jobs.map((job) => (
              <JobCard key={job.source_id} job={job} />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function JobCard({ job }) {
  return (
    <article className={`job-card ${job.favorite ? "is-favorite" : ""}`}>
      <div className="job-head">
        <div>
          <h3 className="job-title">{job.title}</h3>
          <p className="company">{job.company || "회사명 없음"}</p>
        </div>
        <div className="badges">
          <span className="badge score">{job.score ?? 0}점</span>
          {job.favorite ? <span className="badge new">관심</span> : null}
          {job.badges.map((badge) => (
            <span
              className={`badge ${badge === "신규" ? "new" : ""} ${
                badge === "마감임박" ? "warn" : ""
              }`}
              key={badge}
            >
              {badge}
            </span>
          ))}
        </div>
      </div>

      <dl className="job-meta">
        <div>
          <b>지역</b>
          <span>{job.region || "정보 없음"}</span>
        </div>
        <div>
          <b>급여</b>
          <span>{job.salary || "정보 없음"}</span>
        </div>
        <div>
          <b>근무</b>
          <span>{job.work_schedule || "정보 없음"}</span>
        </div>
        <div>
          <b>마감</b>
          <span>{job.close_date || "정보 없음"}</span>
        </div>
        <div>
          <b>고용/접수</b>
          <span>{job.employment_type || job.reception_method || "정보 없음"}</span>
        </div>
      </dl>

      {job.duty || job.detail_text ? (
        <p className="detail-line">{job.duty || truncate(job.detail_text, 160)}</p>
      ) : null}

      <div className="job-actions">
        <div className="keyword-line">
          검색어: {job.matched_keywords.length > 0 ? job.matched_keywords.join(", ") : "정보 없음"}
        </div>
        <div className="action-row">
          <form action={setFavorite}>
            <input type="hidden" name="sourceId" value={job.source_id} />
            <input type="hidden" name="enabled" value={job.favorite ? "false" : "true"} />
            <button className="button secondary" type="submit">
              {job.favorite ? "관심 해제" : "관심"}
            </button>
          </form>
          <form action={setHidden}>
            <input type="hidden" name="sourceId" value={job.source_id} />
            <input type="hidden" name="enabled" value={job.hidden ? "false" : "true"} />
            <button className="button secondary" type="submit">
              {job.hidden ? "숨김 해제" : "숨김"}
            </button>
          </form>
          {job.url ? (
            <a className="button" href={job.url} target="_blank" rel="noreferrer">
              원문 보기
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function truncate(value, length) {
  if (!value || value.length <= length) return value;
  return `${value.slice(0, length)}...`;
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}
