import fs from "fs";
import path from "path";
import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { username, password, role } = req.body;  // role default 'guest'
  if (!username || !password) return res.status(400).json({ error: "missing fields" });

  const dbPath = path.join(process.cwd(), "data", "db.json");
  const db = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath)) : { users: [], scripts: [], logs: [] };

  if (db.users.find(u => u.username === username)) return res.status(409).json({ error: "user exists" });

  db.users.push({
    username,
    passwordHash: crypto.createHash('sha256').update(password).digest('hex'),
    role: role || 'guest',
  });

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  res.status(200).json({ success: true });
}
