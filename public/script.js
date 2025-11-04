let editor;

// === TOGGLE THEME (Dark ↔ Light) ===
function toggleTheme() {
  const isDark = document.body.style.background.includes('0f0f23');
  document.body.style.background = isDark
    ? 'linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 50%, #d0d0d0 100%)'
    : 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)';
  document.body.style.color = isDark ? '#000' : '#e0e0e0';
  editor.setTheme(isDark ? "ace/theme/chrome" : "ace/theme/monokai");
}

// === STATUS MESSAGE ===
function status(msg) {
  const el = document.getElementById("status");
  if (el) el.innerText = msg;
}

// === REGISTER ===
async function register() {
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value;
  if (!username || !password) return status("Fill all fields");

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    status(data.success ? "Registered! Login now." : data.error || "Failed");
  } catch (err) {
    status("Network error");
  }
}

// === LOGIN ===
async function login() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;
  if (!username || !password) return status("Fill all fields");

  try {
    const res = await fetch(`/api/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
    const data = await res.json();

    if (data.success && data.token) {
      localStorage.setItem("token", data.token);
      document.getElementById("auth").classList.add("hidden");
      document.getElementById("dashboard").classList.remove("hidden");
      loadList();
      initAceEditor();
    } else {
      status(data.error || "Login failed");
    }
  } catch (err) {
    status("Network error");
  }
}

// === INIT ACE EDITOR ===
function initAceEditor() {
  if (editor) return; // Prevent double init

  ace.require("ace/ext/language_tools");
  editor = ace.edit("editor");
  editor.setTheme("ace/theme/monokai");
  editor.session.setMode("ace/mode/lua");
  editor.setOptions({
    enableBasicAutocompletion: true,
    enableSnippets: true,
    enableLiveAutocompletion: true,
    fontSize: "14px",
    showPrintMargin: false
  });

  const editorEl = document.getElementById('editor');

  // Drag & Drop .lua files
  ['dragover', 'dragenter'].forEach(evt => {
    editorEl.addEventListener(evt, e => e.preventDefault(), false);
  });
  editorEl.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.lua')) {
      const reader = new FileReader();
      reader.onload = ev => {
        editor.setValue(ev.target.result, -1);
        document.getElementById('editor-status').innerText = `Loaded: ${file.name}`;
      };
      reader.readAsText(file);
    } else {
      document.getElementById('editor-status').innerText = 'Only .lua files allowed!';
    }
  });

  // Real-time syntax check
  editor.session.on('change', () => {
    const code = editor.getValue();
    let error = '';
    const open = (code.match(/\(/g) || []).length;
    const close = (code.match(/\)/g) || []).length;
    if (open !== close) error = 'Unmatched parentheses';
    document.getElementById('editor-status').innerText = error || 'Code OK';
  });
}

// === UPLOAD SCRIPT ===
async function upload() {
  const token = localStorage.getItem("token");
  if (!token) return alert("Login first!");

  const name = document.getElementById("name").value.trim();
  const key = document.getElementById("key").value.trim();
  const expiryDays = document.getElementById("expiryDays").value || "30";
  const obfuscationLevel = document.getElementById("obfuscationLevel").value;
  const code = editor.getValue();

  if (!name || !code) return alert("Name and code required!");

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, key, expiryDays, obfuscationLevel, code, token })
    });
    const data = await res.json();
    alert(data.success ? "Uploaded successfully!" : data.error || "Upload failed");
    loadList();
  } catch (err) {
    alert("Network error");
  }
}

// === LOAD SCRIPT LIST ===
async function loadList() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const res = await fetch(`/api/list?token=${token}`);
    if (!res.ok) throw new Error("Session expired");
    const data = await res.json();

    const list = document.getElementById("list");
    list.innerHTML = "";

    (data.scripts || []).forEach(s => {
      const div = document.createElement("div");
      div.className = "roblox-card p-5 rounded-xl roblox-shadow stagger mb-4";
      div.innerHTML = `
        <div class="flex justify-between items-start">
          <div>
            <b class="text-lg roblox-title">${s.name || 'Unnamed'}</b>
            <code class="text-blue-400 text-sm ml-2">${s.key}</code>
          </div>
          <div class="text-right text-sm text-gray-400">
            ${new Date(s.expiry).toLocaleDateString()} | ${s.obfuscationLevel || 'none'}
          </div>
        </div>
        <div class="mt-2 text-xs text-gray-300">
          Fetches: <b>${s.stats?.fetches || 0}</b> 
          ${s.stats?.lastFetch ? `| Last: ${new Date(s.stats.lastFetch).toLocaleTimeString()}` : ''}
        </div>
        <pre class="mt-3 p-3 bg-gray-900 rounded text-xs overflow-x-auto"><code class="lua">${(s.code || '').substring(0, 150)}...</code></pre>
        <div class="mt-3 flex flex-wrap gap-2">
          <a href="/api/code?key=${s.key}" target="_blank" class="text-blue-400 underline text-sm">Load Script</a>
          <button onclick="editScript(${s.id})" class="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded text-sm">Edit</button>
          <button onclick="deleteScript(${s.id})" class="bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm">Delete</button>
          <button onclick="shareOnX('${s.key}')" class="bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded text-sm">Share on X</button>
        </div>
      `;
      list.appendChild(div);
    });
  } catch (err) {
    alert("Failed to load scripts. Login again.");
    localStorage.removeItem("token");
    location.reload();
  }
}

// === EDIT SCRIPT (Load into editor) ===
function editScript(id) {
  alert(`Edit script ID: ${id} (coming soon)`);
  // TODO: Load script code into editor
}

// === DELETE SCRIPT ===
async function deleteScript(id) {
  if (!confirm("Delete this script?")) return;
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`/api/delete?id=${id}&token=${token}`, { method: "DELETE" });
    const data = await res.json();
    alert(data.success ? "Deleted!" : data.error);
    loadList();
  } catch (err) {
    alert("Delete failed");
  }
}

// === SHARE ON X (Twitter) ===
function shareOnX(key) {
  const url = `${window.location.origin}/api/code?key=${key}`;
  const text = `Check out my Luau script! %23RobloxDev %23Luau`;
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  window.open(shareUrl, '_blank');
}

// === BUNDLE SCRIPTS ===
async function bundleScripts() {
  const keys = document.getElementById("bundle-keys").value.trim();
  const name = document.getElementById("bundle-name").value.trim();
  const token = localStorage.getItem("token");
  if (!keys || !name) return alert("Fill keys and name");

  try {
    const res = await fetch("/api/bundle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys: keys.split(","), name, token })
    });
    const data = await res.json();
    alert(data.success ? `Bundle created: ${data.bundleKey}` : data.error);
  } catch (err) {
    alert("Bundle failed");
  }
}

// === LOAD STATS ===
async function loadStats() {
  const token = localStorage.getItem("token");
  try {
    const res = await fetch(`/api/stats?token=${token}`);
    const data = await res.json();
    const statsDiv = document.getElementById("stats");
    statsDiv.innerHTML = `
      <p>Total Scripts: <b>${data.totalScripts}</b></p>
      <p>Total Fetches: <b>${data.totalFetches}</b></p>
      <p>Active Users: <b>${data.activeUsers}</b></p>
    `;
  } catch (err) {
    document.getElementById("stats").innerHTML = "<p>Failed to load stats</p>";
  }
}

// === EXPORT CSV ===
function exportCsv() {
  alert("CSV Export coming soon!");
}

// === AUTO INIT ON LOAD ===
window.addEventListener("load", () => {
  if (localStorage.getItem("token")) {
    document.getElementById("auth").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    loadList();
    initAceEditor();
  }
});
