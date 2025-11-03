import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { id, action, newCode, token } = req.body;  // action: edit/delete
  if (!id || !action || !token) return res.status(400).json({ error: "missing fields" });

  const [username] = Buffer.from(token, 'base64').toString().split(':');

  const dbPath = path.join(process.cwd(), "data", "db.json");
  const db = JSON.parse(fs.readFileSync(dbPath));
  const index = db.scripts.findIndex(s => s.id === parseInt(id) && s.owner === username);

  if (index === -1) return res.status(403).json({ error: "not owner" });

  if (action === 'delete') {
    db.scripts.splice(index, 1);
  } else if (action === 'edit') {
    db.scripts[index].code = newCode;  // Re-obfuscate if needed
  }

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  res.status(200).json({ success: true });
}
