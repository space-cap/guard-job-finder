import { getDb, initDb } from "../lib/db.js";

initDb(getDb());
console.log("Database is ready.");
