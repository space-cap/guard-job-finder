import { recordNotification, wasNotificationSent } from "./db.js";

export async function notifyNewJobs(jobs, config) {
  const channels = (process.env.NOTIFY_CHANNELS || "")
    .split(",")
    .map((channel) => channel.trim())
    .filter(Boolean);

  if (channels.length === 0 || jobs.length === 0) {
    return [];
  }

  const results = [];
  for (const channel of channels) {
    const unsent = jobs.filter((job) => !wasNotificationSent(job.sourceId, channel));
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

async function sendSlack(jobs, config) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("SLACK_WEBHOOK_URL is missing");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: formatMessage(jobs, config) })
  });
  if (!response.ok) throw new Error(`Slack webhook failed: ${response.status}`);
}

async function sendDiscord(jobs, config) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("DISCORD_WEBHOOK_URL is missing");

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: formatMessage(jobs, config) })
  });
  if (!response.ok) throw new Error(`Discord webhook failed: ${response.status}`);
}

function formatMessage(jobs, config) {
  const visibleJobs = jobs.slice(0, 10);
  const lines = [`[경비 일자리] 새 공고 ${jobs.length}건`];

  visibleJobs.forEach((job, index) => {
    lines.push("");
    lines.push(`${index + 1}. ${job.title}`);
    lines.push(`   회사: ${job.company || "정보 없음"}`);
    lines.push(`   지역: ${job.region || "정보 없음"}`);
    lines.push(`   급여: ${job.salary || "정보 없음"}`);
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
