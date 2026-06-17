import { loadEnv } from "../lib/env.js";
import { getDb, initDb } from "../lib/db.js";

loadEnv();

initDb(getDb());
console.log("Database is ready.");
