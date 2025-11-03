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
  const db = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath)) : { scripts: [] };

  // Guests see only own, admin see all
  const scripts = role === 'admin' ? db.scripts : db.scripts.filter(s => s.owner === username);

  res.status(200).json({ scripts });
}
