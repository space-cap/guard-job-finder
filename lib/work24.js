import * as cheerio from "cheerio";

const BASE_URL = "https://www.work24.go.kr";
const SEARCH_PAGE = "/wk/a/b/1200/retriveDtlEmpSrchList.do";
const SEARCH_POST = "/wk/a/b/1200/retriveDtlEmpSrchListInPost.do";

export async function searchWork24Jobs({ keyword, resultCount = 10, excludeKeywords = [] }) {
  const cookie = await getInitialCookie();
  const body = buildSearchBody(keyword, resultCount);
  const response = await fetch(`${BASE_URL}${SEARCH_POST}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      cookie,
      referer: `${BASE_URL}${SEARCH_PAGE}`,
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Work24 search failed: ${response.status}`);
  }

  const html = await response.text();
  return parseJobRows(html, { keyword, excludeKeywords });
}

function buildSearchBody(keyword, resultCount) {
  return new URLSearchParams({
    currentPageNo: "1",
    resultCnt: String(resultCount),
    sortOrderBy: "DESC",
    sortField: "DATE",
    pageIndex: "1",
    keyword,
    srcKeyword: keyword,
    keywordWantedTitle: "N",
    keywordBusiNm: "N",
    keywordJobCont: "N",
    keywordStaAreaNm: "N",
    searchMode: "",
    benefitSrchAndOr: "O",
    keywordJobCd: "",
    keywordJobCdSeqNo: "",
    keywordEtcYn: "",
    keywordFlag: "",
    cloDateStdtParam: "",
    cloDateEndtParam: "",
    regDateStdtParam: "",
    regDateEndtParam: "",
    termSearchGbn: "",
    cloTermSearchGbn: "",
    notSrcKeyword: ""
  });
}

async function getInitialCookie() {
  const response = await fetch(`${BASE_URL}${SEARCH_PAGE}`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"
    }
  });
  const cookies = response.headers.getSetCookie?.() || [];
  return cookies.length > 0 ? cookies.map((cookie) => cookie.split(";")[0]).join("; ") : "";
}

export function parseJobRows(html, { keyword, excludeKeywords = [] } = {}) {
  const $ = cheerio.load(html);
  const jobs = [];
  const seen = new Set();

  $("a[href*=empDetailAuthView], a[onclick*=empDetailAuthView]").each((_, element) => {
    const link = $(element);
    const row = link.closest("tr");
    if (!row.length) return;

    row.find("script, style").remove();

    const href = extractHref(link);
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;
    const wantedAuthNo = new URL(url).searchParams.get("wantedAuthNo") || "";
    const title = cleanText(link.text());
    const cells = row.children("td");
    const company = cleanText(cells.eq(0).find(".cp_name").first().text());
    const salary = cleanText(cells.eq(1).find("li.dollar").first().text());
    const career = cleanText(cells.eq(1).find("li.member span").eq(0).text());
    const education = cleanText(cells.eq(1).find("li.member span").eq(1).text());
    const workSchedule = cleanText(cells.eq(1).find("li.time").first().text());
    const region = cleanText(cells.eq(1).find("li.site").first().text());
    const dateText = cleanText(cells.eq(2).text());
    const closeDate = matchDate(dateText, /마감일\s*:\s*(\d{4}-\d{2}-\d{2})/);
    const regDate = matchDate(dateText, /등록일\s*:\s*(\d{4}-\d{2}-\d{2})/);
    const rawText = cleanText(row.text());
    const sourceId = wantedAuthNo || url || hashFallback(company, title, region, closeDate);

    if (seen.has(sourceId)) return;
    if (shouldExclude(rawText, excludeKeywords)) return;

    seen.add(sourceId);
    jobs.push({
      sourceId,
      wantedAuthNo,
      title,
      company,
      region,
      salary,
      workSchedule,
      career,
      education,
      closeDate,
      regDate,
      url,
      matchedKeywords: keyword ? [keyword] : [],
      badges: buildBadges({ title, workSchedule, rawText, regDate, closeDate }),
      rawText
    });
  });

  return jobs;
}

function extractHref(link) {
  const href = link.attr("href");
  if (href && href !== "#none" && href !== "javascript:void(0)") return href;
  const onclick = link.attr("onclick") || "";
  const match = onclick.match(/['"]([^'"]*empDetailAuthView\.do[^'"]*)['"]/);
  return match?.[1] || "";
}

function cleanText(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function matchDate(text, pattern) {
  return text.match(pattern)?.[1] || "";
}

function shouldExclude(text, excludeKeywords) {
  return excludeKeywords.some((keyword) => keyword && text.includes(keyword));
}

function buildBadges({ title, workSchedule, rawText, regDate, closeDate }) {
  const text = `${title} ${workSchedule} ${rawText}`;
  const badges = [];
  if (/(야간|저녁|새벽|당직|격일|24시간)/.test(text)) badges.push("야간/당직");
  if (/(주말|토요일|일요일|주2일|주 2일|주1일|주 1일)/.test(text)) badges.push("주말");
  if (regDate === new Date().toISOString().slice(0, 10)) badges.push("신규");
  if (isClosingSoon(closeDate)) badges.push("마감임박");
  return badges;
}

function isClosingSoon(closeDate) {
  if (!closeDate) return false;
  const today = new Date();
  const target = new Date(`${closeDate}T00:00:00+09:00`);
  const diffDays = (target.getTime() - today.getTime()) / 86400000;
  return diffDays >= 0 && diffDays <= 3;
}

function hashFallback(...parts) {
  const text = parts.filter(Boolean).join("|");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return `hash-${hash.toString(16)}`;
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
