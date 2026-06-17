export function getConfig() {
  return {
    sourceMode: process.env.SOURCE_MODE || "browser",
    databasePath: process.env.DATABASE_PATH || "./data/guard-jobs.sqlite",
    appBaseUrl: process.env.APP_BASE_URL || "http://localhost:3000",
    searchKeywords: parseCsv(
      process.env.SEARCH_KEYWORDS ||
        "주말경비,야간경비,경비원,시설경비,건물경비,아파트 경비,보안,당직"
    ),
    excludeKeywords: parseCsv(
      process.env.EXCLUDE_KEYWORDS ||
        "요양보호사,간병,요양원,실버타운,사회복지사,물리치료사,간호사,조리원"
    ),
    searchResultCount: Number(process.env.SEARCH_RESULT_COUNT || 10),
    searchDelayMs: Number(process.env.SEARCH_DELAY_MS || 1500),
    fetchDetails: parseBoolean(process.env.FETCH_DETAILS, true),
    detailDelayMs: Number(process.env.DETAIL_DELAY_MS || 300),
    minNotifyScore: Number(process.env.MIN_NOTIFY_SCORE || 20)
  };
}

export function parseCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseBoolean(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "y", "on"].includes(String(value).toLowerCase());
}
