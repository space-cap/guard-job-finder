import { loadEnv } from "../lib/env.js";
import { getConfig } from "../lib/config.js";
import { createRun, finishRun, getSettings, upsertJob } from "../lib/db.js";
import { notifyFailure, notifyNewJobs } from "../lib/notify.js";
import { delay, searchWork24Jobs } from "../lib/work24.js";

loadEnv();

const args = new Set(process.argv.slice(2));
const baseConfig = getConfig();
const savedSettings = getSettings({
  searchKeywords: baseConfig.searchKeywords.join(","),
  excludeKeywords: baseConfig.excludeKeywords.join(","),
  searchResultCount: String(baseConfig.searchResultCount),
  fetchDetails: String(baseConfig.fetchDetails),
  minNotifyScore: String(baseConfig.minNotifyScore)
});
const config = {
  ...baseConfig,
  searchKeywords: parseCsvSetting(savedSettings.searchKeywords, baseConfig.searchKeywords),
  excludeKeywords: parseCsvSetting(savedSettings.excludeKeywords, baseConfig.excludeKeywords),
  searchResultCount: Number(savedSettings.searchResultCount || baseConfig.searchResultCount),
  fetchDetails: parseBoolSetting(savedSettings.fetchDetails, baseConfig.fetchDetails),
  minNotifyScore: Number(savedSettings.minNotifyScore || baseConfig.minNotifyScore)
};
const runId = createRun({
  sourceMode: config.sourceMode,
  keywords: config.searchKeywords
});

let fetchedCount = 0;
let newCount = 0;
const newJobs = [];
const fetchedJobs = [];

try {
  for (const [index, keyword] of config.searchKeywords.entries()) {
    const jobs = await searchWork24Jobs({
      keyword,
      resultCount: config.searchResultCount,
      excludeKeywords: config.excludeKeywords,
      fetchDetails: config.fetchDetails,
      detailDelayMs: config.detailDelayMs
    });

    fetchedCount += jobs.length;
    fetchedJobs.push(...jobs);
    for (const job of jobs) {
      const result = upsertJob(job);
      if (result.inserted) {
        newCount += 1;
        newJobs.push(job);
      }
    }

    console.log(`${keyword}: ${jobs.length} jobs`);
    if (index < config.searchKeywords.length - 1) {
      await delay(config.searchDelayMs);
    }
  }

  finishRun(runId, { fetchedCount, newCount });
  const notificationJobs = args.has("--notify-all") ? dedupeJobs(fetchedJobs) : newJobs;
  const notificationResults = await notifyNewJobs(notificationJobs, config, {
    force: args.has("--notify-all")
  });
  notificationResults.forEach((result) => {
    console.log(
      `notify:${result.channel} ${result.status} count=${result.count}${
        result.error ? ` error=${result.error}` : ""
      }`
    );
  });
  console.log(`Done. fetched=${fetchedCount}, new=${newCount}`);
} catch (error) {
  finishRun(runId, {
    fetchedCount,
    newCount,
    status: "failed",
    error: error instanceof Error ? error.message : String(error)
  });
  const failureResults = await notifyFailure(error, config);
  failureResults.forEach((result) => {
    console.log(
      `notifyFailure:${result.channel} ${result.status}${result.error ? ` error=${result.error}` : ""}`
    );
  });
  throw error;
}

function parseCsvSetting(value, fallback) {
  const parsed = String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function parseBoolSetting(value, fallback) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "y", "on"].includes(String(value).toLowerCase());
}

function dedupeJobs(jobs) {
  const map = new Map();
  jobs.forEach((job) => {
    if (!map.has(job.sourceId)) map.set(job.sourceId, job);
  });
  return Array.from(map.values());
}
