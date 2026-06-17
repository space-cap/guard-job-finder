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
      employment_type TEXT,
      duty TEXT,
      reception_method TEXT,
      close_date TEXT,
      reg_date TEXT,
      url TEXT,
      matched_keywords TEXT NOT NULL DEFAULT '[]',
      badges TEXT NOT NULL DEFAULT '[]',
      score INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      favorite INTEGER NOT NULL DEFAULT 0,
      raw_text TEXT,
      detail_text TEXT,
      detail_fetched_at TEXT,
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

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  ensureColumn(database, "jobs", "employment_type", "TEXT");
  ensureColumn(database, "jobs", "duty", "TEXT");
  ensureColumn(database, "jobs", "reception_method", "TEXT");
  ensureColumn(database, "jobs", "score", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "jobs", "hidden", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "jobs", "favorite", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(database, "jobs", "detail_text", "TEXT");
  ensureColumn(database, "jobs", "detail_fetched_at", "TEXT");
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
          career, education, employment_type, duty, reception_method, close_date,
          reg_date, url, matched_keywords, badges, score, raw_text, detail_text,
          detail_fetched_at, first_seen_at, last_seen_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
        job.employmentType || null,
        job.duty || null,
        job.receptionMethod || null,
        job.closeDate || null,
        job.regDate || null,
        job.url || null,
        JSON.stringify(matchedKeywords),
        JSON.stringify(badges),
        job.score || 0,
        job.rawText || null,
        job.detailText || null,
        job.detailFetchedAt || null,
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
           work_schedule = ?, career = ?, education = ?, employment_type = ?,
           duty = COALESCE(?, duty), reception_method = COALESCE(?, reception_method),
           close_date = ?, reg_date = ?, url = ?, matched_keywords = ?, badges = ?,
           score = ?, raw_text = ?, detail_text = COALESCE(?, detail_text),
           detail_fetched_at = COALESCE(?, detail_fetched_at),
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
      job.employmentType || null,
      job.duty || null,
      job.receptionMethod || null,
      job.closeDate || null,
      job.regDate || null,
      job.url || null,
      JSON.stringify(matchedKeywords),
      JSON.stringify(badges),
      job.score || 0,
      job.rawText || null,
      job.detailText || null,
      job.detailFetchedAt || null,
      now,
      now,
      job.sourceId
    );
  return { inserted: false };
}

export function listJobs({ limit = 50, keyword = "", region = "", badge = "", view = "active" } = {}) {
  const where = [];
  const params = [];

  if (view === "hidden") {
    where.push("hidden = 1");
  } else if (view === "favorite") {
    where.push("favorite = 1 AND hidden = 0");
  } else {
    where.push("hidden = 0");
  }

  if (keyword) {
    where.push("matched_keywords LIKE ?");
    params.push(`%${keyword}%`);
  }

  if (region) {
    where.push("region LIKE ?");
    params.push(`%${region}%`);
  }

  if (badge) {
    where.push("badges LIKE ?");
    params.push(`%${badge}%`);
  }

  params.push(limit);

  return getDb()
    .prepare(
      `SELECT *
       FROM jobs
       WHERE ${where.join(" AND ")}
       ORDER BY favorite DESC, score DESC, COALESCE(reg_date, last_seen_at) DESC, last_seen_at DESC
       LIMIT ?`
    )
    .all(...params)
    .map((job) => ({
      ...job,
      matched_keywords: safeJson(job.matched_keywords, []),
      badges: safeJson(job.badges, [])
    }));
}

export function listRecentJobs(limit = 10) {
  return listJobs({ limit, view: "active" });
}

export function updateJobFlag(sourceId, flag, enabled) {
  if (!["hidden", "favorite"].includes(flag)) {
    throw new Error(`Unsupported job flag: ${flag}`);
  }
  getDb()
    .prepare(`UPDATE jobs SET ${flag} = ?, updated_at = ? WHERE source_id = ?`)
    .run(enabled ? 1 : 0, new Date().toISOString(), sourceId);
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
  const total = database.prepare("SELECT COUNT(*) AS count FROM jobs WHERE hidden = 0").get().count;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = database
    .prepare("SELECT COUNT(*) AS count FROM jobs WHERE hidden = 0 AND first_seen_at >= ?")
    .get(`${today}T00:00:00.000Z`).count;
  const openCount = database
    .prepare(
      `SELECT COUNT(*) AS count
       FROM jobs
       WHERE hidden = 0 AND (close_date IS NULL OR close_date = '' OR close_date >= ?)`
    )
    .get(today).count;
  const favoriteCount = database
    .prepare("SELECT COUNT(*) AS count FROM jobs WHERE favorite = 1 AND hidden = 0")
    .get().count;
  const latestRun = getLatestRun();

  return { total, todayCount, openCount, favoriteCount, latestRun };
}

export function getSetting(key, fallback = "") {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row?.value ?? fallback;
}

export function getSettings(defaults = {}) {
  const rows = getDb().prepare("SELECT key, value FROM settings").all();
  const settings = { ...defaults };
  rows.forEach((row) => {
    settings[row.key] = row.value;
  });
  return settings;
}

export function setSetting(key, value) {
  getDb()
    .prepare(
      `INSERT INTO settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .run(key, value, new Date().toISOString());
}

export function setSettings(values) {
  const database = getDb();
  const insert = database.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  );
  const now = new Date().toISOString();
  database.exec("BEGIN");
  try {
    Object.entries(values).forEach(([key, value]) => insert.run(key, value, now));
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getDistinctFilterValues() {
  const database = getDb();
  const keywordSet = new Set();
  const badgeSet = new Set();
  database
    .prepare("SELECT matched_keywords, badges FROM jobs WHERE hidden = 0")
    .all()
    .forEach((row) => {
      safeJson(row.matched_keywords, []).forEach((value) => keywordSet.add(value));
      safeJson(row.badges, []).forEach((value) => badgeSet.add(value));
    });

  const regions = database
    .prepare(
      `SELECT DISTINCT substr(region, 1, instr(region || ' ', ' ') - 1) AS region
       FROM jobs
       WHERE hidden = 0 AND region IS NOT NULL AND region != ''
       ORDER BY region`
    )
    .all()
    .map((row) => row.region)
    .filter(Boolean);

  return {
    keywords: Array.from(keywordSet).sort(),
    badges: Array.from(badgeSet).sort(),
    regions
  };
}

function ensureColumn(database, table, column, definition) {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all();
  if (columns.some((item) => item.name === column)) return;
  database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
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
