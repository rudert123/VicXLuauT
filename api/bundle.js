import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { keys, bundleName, token } = req.body;
  if (!keys || !bundleName || !token) return res.status(400).json({ error: "missing fields" });

  // Validate token
  const [username] = Buffer.from(token, 'base64').toString().split(':');

  const dbPath = path.join(process.cwd(), "data", "db.json");
  const db = JSON.parse(fs.readFileSync(dbPath));

  const codes = keys.map(k => db.scripts.find(s => s.key === k && s.owner === username)?.code).filter(Boolean);
  if (codes.length !== keys.length) return res.status(403).json({ error: "invalid keys" });

  const bundledCode = codes.join('\n-- Bundle Separator\n');

  // Simpan sebagai script baru
  db.scripts.push({
    id: Date.now(),
    owner: username,
    name: bundleName,
    key: `bundle-${Date.now()}`,
    code: bundledCode,
    hmac: '',  // Skip HMAC for bundle
    expiry: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
    stats: { fetches: 0, lastFetch: null },
    date: new Date().toISOString(),
  });

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
  res.status(200).json({ success: true });
}
