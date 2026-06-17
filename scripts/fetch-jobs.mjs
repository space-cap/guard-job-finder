import { getConfig } from "../lib/config.js";
import { createRun, finishRun, upsertJob } from "../lib/db.js";
import { notifyNewJobs } from "../lib/notify.js";
import { delay, searchWork24Jobs } from "../lib/work24.js";

const config = getConfig();
const runId = createRun({
  sourceMode: config.sourceMode,
  keywords: config.searchKeywords
});

let fetchedCount = 0;
let newCount = 0;
const newJobs = [];

try {
  for (const [index, keyword] of config.searchKeywords.entries()) {
    const jobs = await searchWork24Jobs({
      keyword,
      resultCount: config.searchResultCount,
      excludeKeywords: config.excludeKeywords
    });

    fetchedCount += jobs.length;
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
  const notificationResults = await notifyNewJobs(newJobs, config);
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
  throw error;
}
