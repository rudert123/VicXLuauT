import fs from "fs";
import path from "path";
import crypto from "crypto";

export default async function handler(req, res) {
  const { username, password } = req.query;
  if (!username || !password) return res.status(400).json({ error: "missing fields" });

  const dbPath = path.join(process.cwd(), "data", "db.json");
  const db = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath)) : { users: [], scripts: [], logs: [] };

  const user = db.users.find(u => u.username === username);
  if (!user || crypto.createHash('sha256').update(password).digest('hex') !== user.passwordHash) {
    return res.status(403).json({ error: "invalid credentials" });
  }

  const token = Buffer.from(`${username}:${user.role}:${Date.now() + 3600000}`).toString('base64');
  res.status(200).json({ success: true, token, role: user.role });
}
