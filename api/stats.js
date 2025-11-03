import fs from "fs";
import path from "path";

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
  const db = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath)) : { scripts: [], logs: [] };

  const userScripts = db.scripts.filter(s => s.owner === username || role === 'admin');
  const stats = userScripts.map(s => ({ name: s.name, fetches: s.stats.fetches, lastFetch: s.stats.lastFetch, expiry: s.expiry }));

  // Eco-audit: Suggest delete if fetches < 1 and old
  const audit = userScripts.filter(s => s.stats.fetches < 1 && (Date.now() - new Date(s.date).getTime()) > 7*24*60*60*1000).map(s => s.name);

  res.status(200).json({ stats, logs: db.logs.filter(l => role === 'admin' || l.keyAttempt in userScripts.map(s => s.key)), audit });
}