import { getStats, listJobs } from "@/lib/db.js";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const jobs = listJobs(50);
  const stats = getStats();
  const latestRun = stats.latestRun;

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
          <Metric label="최근 신규" value={`${latestRun?.new_count ?? 0}건`} />
        </section>

        <div className="toolbar">
          <h2>최신 공고</h2>
          <div className="status-pill">
            수집 방식: {latestRun?.source_mode || "browser"}
          </div>
        </div>

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
    <article className="job-card">
      <div className="job-head">
        <div>
          <h3 className="job-title">{job.title}</h3>
          <p className="company">{job.company || "회사명 없음"}</p>
        </div>
        <div className="badges">
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
      </dl>

      <div className="job-actions">
        <div className="keyword-line">
          검색어: {job.matched_keywords.length > 0 ? job.matched_keywords.join(", ") : "정보 없음"}
        </div>
        {job.url ? (
          <a className="button" href={job.url} target="_blank" rel="noreferrer">
            원문 보기
          </a>
        ) : null}
      </div>
    </article>
  );
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}
