import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getConfig } from "./config.js";

let db;

export function getDb() {
  if (db) return db;
  const dbPath = resolve(getConfig().databasePath);
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  initDb(db);
  return db;
}

export function initDb(database = getDb()) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      source_id TEXT PRIMARY KEY,
      wanted_auth_no TEXT,
      title TEXT NOT NULL,
      company TEXT,
      region TEXT,
      salary TEXT,
      work_schedule TEXT,
      career TEXT,
      education TEXT,
      close_date TEXT,
      reg_date TEXT,
      url TEXT,
      matched_keywords TEXT NOT NULL DEFAULT '[]',
      badges TEXT NOT NULL DEFAULT '[]',
      raw_text TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      source_mode TEXT NOT NULL,
      keywords TEXT NOT NULL,
      fetched_count INTEGER NOT NULL DEFAULT 0,
      new_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      error TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      UNIQUE(source_id, channel)
    );
  `);
}

export function createRun({ sourceMode, keywords }) {
  const now = new Date().toISOString();
  const result = getDb()
    .prepare(
      `INSERT INTO runs (started_at, source_mode, keywords, status)
       VALUES (?, ?, ?, ?)`
    )
    .run(now, sourceMode, JSON.stringify(keywords), "running");
  return Number(result.lastInsertRowid);
}

export function finishRun(id, { fetchedCount, newCount, status = "success", error = null }) {
  getDb()
    .prepare(
      `UPDATE runs
       SET finished_at = ?, fetched_count = ?, new_count = ?, status = ?, error = ?
       WHERE id = ?`
    )
    .run(new Date().toISOString(), fetchedCount, newCount, status, error, id);
}

export function upsertJob(job) {
  const database = getDb();
  const now = new Date().toISOString();
  const existing = database
    .prepare("SELECT matched_keywords FROM jobs WHERE source_id = ?")
    .get(job.sourceId);

  const matchedKeywords = mergeJsonArray(
    existing?.matched_keywords,
    job.matchedKeywords || []
  );
  const badges = job.badges || [];

  if (!existing) {
    database
      .prepare(
        `INSERT INTO jobs (
          source_id, wanted_auth_no, title, company, region, salary, work_schedule,
          career, education, close_date, reg_date, url, matched_keywords, badges,
          raw_text, first_seen_at, last_seen_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        job.sourceId,
        job.wantedAuthNo || null,
        job.title,
        job.company || null,
        job.region || null,
        job.salary || null,
        job.workSchedule || null,
        job.career || null,
        job.education || null,
        job.closeDate || null,
        job.regDate || null,
        job.url || null,
        JSON.stringify(matchedKeywords),
        JSON.stringify(badges),
        job.rawText || null,
        now,
        now,
        now
      );
    return { inserted: true };
  }

  database
    .prepare(
      `UPDATE jobs
       SET wanted_auth_no = ?, title = ?, company = ?, region = ?, salary = ?,
           work_schedule = ?, career = ?, education = ?, close_date = ?, reg_date = ?,
           url = ?, matched_keywords = ?, badges = ?, raw_text = ?,
           last_seen_at = ?, updated_at = ?
       WHERE source_id = ?`
    )
    .run(
      job.wantedAuthNo || null,
      job.title,
      job.company || null,
      job.region || null,
      job.salary || null,
      job.workSchedule || null,
      job.career || null,
      job.education || null,
      job.closeDate || null,
      job.regDate || null,
      job.url || null,
      JSON.stringify(matchedKeywords),
      JSON.stringify(badges),
      job.rawText || null,
      now,
      now,
      job.sourceId
    );
  return { inserted: false };
}

export function listJobs(limit = 50) {
  return getDb()
    .prepare(
      `SELECT *
       FROM jobs
       ORDER BY COALESCE(reg_date, last_seen_at) DESC, last_seen_at DESC
       LIMIT ?`
    )
    .all(limit)
    .map((job) => ({
      ...job,
      matched_keywords: safeJson(job.matched_keywords, []),
      badges: safeJson(job.badges, [])
    }));
}

export function getLatestRun() {
  return getDb()
    .prepare("SELECT * FROM runs ORDER BY id DESC LIMIT 1")
    .get();
}

export function wasNotificationSent(sourceId, channel) {
  const row = getDb()
    .prepare("SELECT 1 FROM notifications WHERE source_id = ? AND channel = ?")
    .get(sourceId, channel);
  return Boolean(row);
}

export function recordNotification({ sourceId, channel, status, error = null }) {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO notifications (source_id, channel, sent_at, status, error)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(sourceId, channel, new Date().toISOString(), status, error);
}

export function getStats() {
  const database = getDb();
  const total = database.prepare("SELECT COUNT(*) AS count FROM jobs").get().count;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = database
    .prepare("SELECT COUNT(*) AS count FROM jobs WHERE first_seen_at >= ?")
    .get(`${today}T00:00:00.000Z`).count;
  const openCount = database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM jobs
       WHERE close_date IS NULL OR close_date = '' OR close_date >= ?`
    )
    .get(today).count;
  const latestRun = getLatestRun();

  return { total, todayCount, openCount, latestRun };
}

function mergeJsonArray(json, values) {
  const set = new Set(safeJson(json, []));
  values.forEach((value) => set.add(value));
  return Array.from(set);
}

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
