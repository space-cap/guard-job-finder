import { loadEnv } from "../lib/env.js";

loadEnv();

const webhookUrl = process.env.SLACK_WEBHOOK_URL;

if (!webhookUrl) {
  console.error("SLACK_WEBHOOK_URL is missing. Add it to .env first.");
  process.exit(1);
}

const now = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "full",
  timeStyle: "medium",
  timeZone: "Asia/Seoul"
}).format(new Date());

const message = [
  "[경비 일자리] Slack Webhook 테스트",
  "",
  `시간: ${now}`,
  "결과: Webhook 연결이 정상입니다.",
  "",
  "이 메시지가 보이면 .env의 SLACK_WEBHOOK_URL 설정이 동작합니다."
].join("\n");

const response = await fetch(webhookUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ text: message })
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(`Slack webhook failed: ${response.status} ${body}`);
}

console.log("Slack test message sent.");
