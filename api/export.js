import fs from "fs";
import path from "path";
import stringify from "csv-stringify/lib/sync";

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(403).json({ error: "invalid token" });

  try {
    const [username, role, expiry] = Buffer.from(token, 'base64').toString().split(':');
    if (Date.now() > parseInt(expiry)) return res.status(403).json({ error: "expired token" });
  } catch {
    return res.status(403).json({ error: "invalid token" });
  }

  const dbPath = path.join(process.cwd(), "data", "db.json");
  const db = JSON.parse(fs.readFileSync(dbPath));

  const data = db.scripts.map(s => [s.name, s.key, s.stats.fetches, s.expiry]);
  const csv = stringify([['Name', 'Key', 'Fetches', 'Expiry'], ...data]);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=stats.csv');
  res.send(csv);
}