let editor;

function toggleTheme() {
  document.body.classList.toggle('bg-gray-100');
  document.body.classList.toggle('text-black');
  document.body.classList.toggle('bg-gray-900');
  document.body.classList.toggle('text-white');
  const inputs = document.querySelectorAll('input, select');
  inputs.forEach(el => {
    el.classList.toggle('bg-white');
    el.classList.toggle('text-black');
    el.classList.toggle('bg-gray-800');
    el.classList.toggle('text-white');
    el.classList.toggle('border-gray-300');
    el.classList.toggle('border-gray-600');
  });
  // Update Ace theme if needed
  editor.setTheme(document.body.classList.contains('bg-gray-100') ? "ace/theme/chrome" : "ace/theme/monokai");
}

async function register() {
  const username = document.getElementById("reg-username").value;
  const password = document.getElementById("reg-password").value;

  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (data.success) {
    alert("Registered! Now login.");
  } else {
    document.getElementById("status").innerText = data.error;
  }
}

async function login() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  const res = await fetch(`/api/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`);
  const data = await res.json();

  if (data.success) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    document.getElementById("auth").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");
    loadList();
    initAceEditor();
  } else {
    document.getElementById("status").innerText = data.error;
  }
}

function initAceEditor() {
  ace.require("ace/ext/language_tools");
  editor = ace.edit("editor");
  editor.setTheme("ace/theme/monokai");
  editor.session.setMode("ace/mode/lua");
  editor.setOptions({
    enableBasicAutocompletion: true,
    enableSnippets: true,
    enableLiveAutocompletion: true,
    fontSize: "14px"
  });

  document.getElementById('editor').addEventListener('dragover', e => e.preventDefault());
  document.getElementById('editor').addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.lua')) {
      const reader = new FileReader();
      reader.onload = ev => editor.setValue(ev.target.result, -1);
      reader.readAsText(file);
    } else {
      document.getElementById('editor-status').innerText = 'Only .lua files!';
    }
  });

  document.getElementById('editor').addEventListener('paste', e => {
    const text = e.clipboardData.getData('text');
    editor.insert(text);
  });

  editor.session.on('change', () => {
    const code = editor.getValue();
    let error = '';
    if ((code.match(/\(/g) || []).length !== (code.match(/\)/g) || []).length) error = 'Unmatched parentheses';
    if (!code.includes('local') && code.includes('function')) error += ' Missing local?';
    document.getElementById('editor-status').innerText = error || 'Code OK';
  });

  if (!editor.getValue()) {
    const templates = [
      'print("Hello World")',
      'local function add(a, b) return a + b end\nprint(add(1, 2))',
      'for i = 1, 10 do print(i) end',
      '-- Roblox example\nlocal part = Instance.new("Part")\npart.Name = "Test"'
    ];
    editor.setValue(templates[Math.floor(Math.random() * templates.length)], -1);
  }
}

async function loadList() {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api/list?token=${encodeURIComponent(token)}`);
  if (res.status !== 200) return alert("Session expired.");

  const data = await res.json();
  const listDiv = document.getElementById("list");
  listDiv.innerHTML = "";

  if (!data.scripts) data.scripts = [];  // Fix if undefined

  data.scripts.forEach((s) => {
    const div = document.createElement("div");
    div.className = "p-4 bg-gray-800 rounded shadow script-item";
    div.innerHTML = `
      <b>${s.name || 'Unnamed'}</b> — key: ${s.key} <br>
      Expiry: ${new Date(s.expiry || Date.now()).toLocaleDateString()} | Level: ${s.obfuscationLevel || 'none'} <br>
      Fetches: ${s.stats?.fetches || 0} (Last: ${s.stats?.lastFetch || 'N/A'}) <br>
      <pre><code class="lua">${(s.code || '').substring(0, 100)}...</code></pre>
      <code>https://${window.location.host}/api/code?key=${s.key}</code> <br>
      <button onclick="editScript(${s.id})" class="bg-yellow-600 p-1 rounded mr-2">Edit</button>
      <button onclick="deleteScript(${s.id})" class="bg-red-600 p-1 rounded">Delete</button>
      <button onclick="shareOnX('${s.key}')" class="bg-blue-400 p-1 rounded ml-2">Share on X</button>
    `;
    listDiv.appendChild(div);
  });
}

async function upload() {
  const token = localStorage.getItem("token");
  const name = document.getElementById("name").value;
  const key = document.getElementById("key").value;
  const expiryDays = document.getElementById("expiryDays").value;
  const obfuscationLevel = document.getElementById("obfuscationLevel").value;
  const code = editor.getValue();
  const price = document.getElementById("price").value;

  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, key, expiryDays, obfuscationLevel, code, token }),
  });

  const data = await res.json();
  if (data.success) {
    alert("Uploaded!");
    loadList();
  } else {
    alert("Failed: " + data.error);
  }
}

async function bundleScripts() {
  const token = localStorage.getItem("token");
  const keys = document.getElementById("bundle-keys").value.split(',');
  const bundleName = document.getElementById("bundle-name").value;

  const res = await fetch("/api/bundle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys, bundleName, token }),
  });

  const data = await res.json();
  if (data.success) {
    alert("Bundled!");
    loadList();
  } else {
    alert("Failed: " + data.error);
  }
}

async function editScript(id) {
  const newCode = prompt("New code:");
  if (!newCode) return;

  const token = localStorage.getItem("token");
  const res = await fetch("/api/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action: 'edit', newCode, token }),
  });

  if (res.ok) {
    alert("Edited!");
    loadList();
  } else {
    alert("Failed");
  }
}

async function deleteScript(id) {
  if (!confirm("Delete?")) return;

  const token = localStorage.getItem("token");
  const res = await fetch("/api/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action: 'delete', token }),
  });

  if (res.ok) {
    alert("Deleted!");
    loadList();
  } else {
    alert("Failed");
  }
}

function shareOnX(key) {
  const url = `https://${window.location.host}/api/code?key=${key}`;
  window.open(`https://x.com/intent/post?text=Check my VicXLuauT script!&url=${encodeURIComponent(url)}`, '_blank');
}

async function loadStats() {
  const token = localStorage.getItem("token");
  const res = await fetch(`/api/stats?token=${encodeURIComponent(token)}`);
  if (res.status !== 200) return alert("Session expired.");

  const data = await res.json();
  const statsDiv = document.getElementById("stats");
  statsDiv.innerHTML = "<h4 class='text-lg'>Script Stats</h4>";

  data.stats.forEach((s) => {
    statsDiv.innerHTML += `
      <div class="p-2 bg-gray-800 rounded">
        <b>${s.name}</b>: Fetches ${s.fetches}, Last ${s.lastFetch || 'N/A'}, Expiry ${new Date(s.expiry).toLocaleDateString()}
      </div>
    `;
  });

  statsDiv.innerHTML += "<h4 class='text-lg mt-2'>Notifications/Logs</h4>";
  data.logs.forEach((log) => {
    statsDiv.innerHTML += `
      <div class="p-2 bg-red-900 rounded">
        Unauthorized attempt: ${log.keyAttempt} from ${log.ip || 'Unknown'} at ${new Date(log.date).toLocaleString()}
      </div>
    `;
  });

  if (data.audit.length) {
    document.getElementById("audit").innerHTML = `<h4 class="text-lg">Eco-Audit Suggestions</h4>Delete unused: ${data.audit.join(', ')}`;
  }
}

async function exportCsv() {
  const token = localStorage.getItem("token");
  window.location.href = `/api/export?token=${encodeURIComponent(token)}`;
}s
