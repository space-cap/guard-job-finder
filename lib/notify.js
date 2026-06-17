import { recordNotification, wasNotificationSent } from "./db.js";

export async function notifyNewJobs(jobs, config, options = {}) {
  const channels = (process.env.NOTIFY_CHANNELS || "")
    .split(",")
    .map((channel) => channel.trim())
    .filter(Boolean);

  if (channels.length === 0 || jobs.length === 0) {
    return [];
  }

  const results = [];
  for (const channel of channels) {
    const candidates = jobs
      .filter((job) => (job.score ?? 0) >= (config.minNotifyScore ?? 0))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const unsent = options.force
      ? candidates
      : candidates.filter((job) => !wasNotificationSent(job.sourceId, channel));
    if (unsent.length === 0) continue;

    try {
      if (channel === "slack") {
        await sendSlack(unsent, config);
      } else if (channel === "discord") {
        await sendDiscord(unsent, config);
      } else {
        continue;
      }

      unsent.forEach((job) =>
        recordNotification({ sourceId: job.sourceId, channel, status: "sent" })
      );
      results.push({ channel, count: unsent.length, status: "sent" });
    } catch (error) {
      unsent.forEach((job) =>
        recordNotification({
          sourceId: job.sourceId,
          channel,
          status: "failed",
          error: error instanceof Error ? error.message : String(error)
        })
      );
      results.push({
        channel,
        count: unsent.length,
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return results;
}

export async function notifyFailure(error, config) {
  if (!isEnabled(process.env.NOTIFY_FAILURES, true)) return [];

  const channels = (process.env.NOTIFY_CHANNELS || "")
    .split(",")
    .map((channel) => channel.trim())
    .filter(Boolean);
  if (channels.length === 0) return [];

  const message = [
    "[경비 일자리] 수집 실패",
    "",
    `시간: ${formatKst(new Date())}`,
    `오류: ${error instanceof Error ? error.message : String(error)}`,
    "",
    `웹페이지: ${config.appBaseUrl}`
  ].join("\n");

  const results = [];
  for (const channel of channels) {
    try {
      if (channel === "slack") {
        await postJson(process.env.SLACK_WEBHOOK_URL, { text: message }, "Slack");
      } else if (channel === "discord") {
        await postJson(process.env.DISCORD_WEBHOOK_URL, { content: message }, "Discord");
      } else {
        continue;
      }
      results.push({ channel, status: "sent" });
    } catch (sendError) {
      results.push({
        channel,
        status: "failed",
        error: sendError instanceof Error ? sendError.message : String(sendError)
      });
    }
  }
  return results;
}

async function sendSlack(jobs, config) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("SLACK_WEBHOOK_URL is missing");
  await postJson(webhookUrl, { text: formatMessage(jobs, config) }, "Slack");
}

async function sendDiscord(jobs, config) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("DISCORD_WEBHOOK_URL is missing");
  await postJson(webhookUrl, { content: formatMessage(jobs, config) }, "Discord");
}

async function postJson(webhookUrl, payload, label) {
  if (!webhookUrl) throw new Error(`${label} webhook URL is missing`);
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${label} webhook failed: ${response.status} ${body}`);
  }
}

function formatMessage(jobs, config) {
  const visibleJobs = jobs.slice(0, 10);
  const keywordSummary = summarizeKeywords(jobs);
  const lines = [`[경비 일자리] 새 공고 ${jobs.length}건`];

  if (keywordSummary) {
    lines.push(`키워드별: ${keywordSummary}`);
  }

  visibleJobs.forEach((job, index) => {
    lines.push("");
    lines.push(`${index + 1}. ${job.title} (${job.score ?? 0}점)`);
    lines.push(`   회사: ${job.company || "정보 없음"}`);
    lines.push(`   지역: ${job.region || "정보 없음"}`);
    lines.push(`   급여: ${job.salary || "정보 없음"}`);
    lines.push(`   근무: ${job.workSchedule || job.work_schedule || "정보 없음"}`);
    lines.push(`   마감: ${job.closeDate || "정보 없음"}`);
    if (job.url) lines.push(`   링크: ${job.url}`);
  });

  if (jobs.length > visibleJobs.length) {
    lines.push("");
    lines.push(`나머지 ${jobs.length - visibleJobs.length}건은 웹페이지에서 확인하세요.`);
  }
  lines.push("");
  lines.push(`웹페이지: ${config.appBaseUrl}`);
  return lines.join("\n");
}

function summarizeKeywords(jobs) {
  const counts = new Map();
  jobs.forEach((job) => {
    (job.matchedKeywords || job.matched_keywords || []).forEach((keyword) => {
      counts.set(keyword, (counts.get(keyword) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([keyword, count]) => `${keyword} ${count}`)
    .join(", ");
}

function isEnabled(value, fallback) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "y", "on"].includes(String(value).toLowerCase());
}

function formatKst(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "full",
    timeStyle: "medium",
    timeZone: "Asia/Seoul"
  }).format(date);
}
