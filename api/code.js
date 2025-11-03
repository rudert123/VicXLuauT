import fs from "fs";
import path from "path";
import crypto from "crypto";

export default async function handler(req, res) {
  const { key } = req.query;
  if (!key) return res.status(400).send("-- Missing key --");

  const dbPath = path.join(process.cwd(), "data", "db.json");
  if (!fs.existsSync(dbPath)) return res.status(404).send("-- No data --");

  const db = JSON.parse(fs.readFileSync(dbPath));
  const foundIndex = db.scripts.findIndex(s => s.key === key);

  if (foundIndex === -1) {
    const log = { type: "unauthorized", keyAttempt: key, ip: req.headers['x-forwarded-for'], date: new Date().toISOString() };
    db.logs.push(log);
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    console.log(`Webhook sim: Unauthorized access - ${JSON.stringify(log)}`);  // Simulate webhook
    return res.status(403).send("unauthorized access! you are not developer. please out just system who can read this.");
  }

  const script = db.scripts[foundIndex];
  if (new Date(script.expiry) < new Date()) return res.status(410).send("-- Script expired --");

  if (script.stats.lastFetch && (Date.now() - new Date(script.stats.lastFetch).getTime()) < 3600000 / 10) {
    return res.status(429).send("-- Rate limit exceeded --");
  }

  const hmacSecret = process.env.HMAC_SECRET_BASE64 ? Buffer.from(process.env.HMAC_SECRET_BASE64, 'base64').toString() : 'secret';
  const computedHmac = crypto.createHmac('sha256', hmacSecret).update(script.code).digest('hex');
  if (computedHmac !== script.hmac) return res.status(500).send("-- Integrity check failed --");

  script.stats.fetches++;
  script.stats.lastFetch = new Date().toISOString();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

  res.setHeader("Content-Type", "text/plain");
  res.send(script.code);
}