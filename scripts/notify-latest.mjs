import { loadEnv } from "../lib/env.js";
import { getConfig } from "../lib/config.js";
import { listRecentJobs } from "../lib/db.js";
import { notifyNewJobs } from "../lib/notify.js";

loadEnv();

const config = getConfig();
const jobs = listRecentJobs(10).map((job) => ({
  sourceId: job.source_id,
  title: job.title,
  company: job.company,
  region: job.region,
  salary: job.salary,
  workSchedule: job.work_schedule,
  closeDate: job.close_date,
  url: job.url,
  score: job.score,
  matchedKeywords: job.matched_keywords
}));

const results = await notifyNewJobs(jobs, config, { force: true });
if (results.length === 0) {
  console.log("No notification was sent. Check NOTIFY_CHANNELS and webhook settings.");
} else {
  results.forEach((result) => {
    console.log(`notify:${result.channel} ${result.status} count=${result.count}`);
  });
}
