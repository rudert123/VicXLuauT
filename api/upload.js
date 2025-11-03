import fs from "fs";
import path from "path";
import luamin from "luamin";
import crypto from "crypto";

export const config = { api: { bodyParser: { sizeLimit: "5mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { code, name, key, expiryDays, obfuscationLevel, token } = req.body;
  if (!code || !name || !key || !token) return res.status(400).json({ error: "missing fields" });

  const [username, role] = Buffer.from(token, 'base64').toString().split(':').slice(0,2);
  if (role === 'guest' && expiryDays > 7) return res.status(403).json({ error: "guests limited to 7 days" });

  // Simple analyzer: Cek syntax errors basic (misal unmatched parentheses)
  let error = null;
  if ((code.match(/\(/g) || []).length !== (code.match(/\)/g) || []).length) error = "Unmatched parentheses";

  if (error) return res.status(400).json({ error: `Analyzer error: ${error}` });

  let obfuscatedCode = code;
  try {
    if (obfuscationLevel === 'light') obfuscatedCode = luamin.minify(code);
    else if (obfuscationLevel === 'medium') obfuscatedCode = luamin.minify(code.replace(/\s+/g, ''));
    else if (obfuscationLevel === 'heavy') {
      obfuscatedCode = `-- Junk\n${luamin.minify(code)}\n-- End Junk`;
    }
  } catch (e) {
    return res.status(500).json({ error: "obfuscation failed" });
  }

  const hmacSecret = process.env.HMAC_SECRET_BASE64 ? Buffer.from(process.env.HMAC_SECRET_BASE64, 'base64').toString() : 'secret';
  const hmac = crypto.createHmac('sha256', hmacSecret).update(obfuscatedCode).digest('hex');

  const dbPath = path.join(process.cwd(), "data", "db.json");
  const db = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath)) : { users: [], scripts: [], logs: [] };

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + (parseInt(expiryDays) || 30));

  db.scripts.push({
    id: Date.now(),
    owner: username,
    name,
    key,
    code: obfuscatedCode,
    hmac,
    expiry: expiryDate.toISOString(),
    obfuscationLevel,
    stats: { fetches: 0, lastFetch: null },
    price: 0,  // Mock monetization
    date: new Date().toISOString(),
  });

  db.scripts = db.scripts.filter(s => new Date(s.expiry) >= new Date());

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

  res.status(200).json({ success: true });
}