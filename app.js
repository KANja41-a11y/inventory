const KEY = "seoul-game-inventory-v1";
const FALLBACK = {
  profile: { game: "Seoul Quest", player: "Player One", avatar: "" },
  items: [],
  letter: { title: "Untuk kamu", body: "Tekan putar, ya.", from: "— aku" }
};
const $ = (s) => document.querySelector(s);
let state, editingId = null, deletingId = null;

// avatar default (SVG) kalau belum ada foto
const DEFAULT_AVATAR = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ffe3ec"/><circle cx="50" cy="38" r="18" fill="#ff5d8f"/><path d="M14 100c4-26 20-36 36-36s32 10 36 36z" fill="#ff9248"/></svg>');

async function load() {
  const saved = localStorage.getItem(KEY);
  if (saved) { try { return JSON.parse(saved); } catch {} }
  try { return await (await fetch("data/inventory.json")).json(); }
  catch { return structuredClone(FALLBACK); } // kalau dibuka lewat file://
}

function save(msg = "Tersimpan ✓") {
  try { localStorage.setItem(KEY, JSON.stringify(state)); toast(msg); }
  catch { toast("Gagal menyimpan (penyimpanan penuh)"); }
}

function toast(t) {
  const el = $("#toast"); el.textContent = t; el.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 1800);
}

function renderProfile() {
  const p = state.profile;
  $("#gameName").textContent = p.game;
  $("#playerName").textContent = p.player;
  $("#avatar").src = p.avatar || DEFAULT_AVATAR;
  document.title = p.game + " · Inventory";
}

function renderLetter() {
  const l = state.letter || FALLBACK.letter;
  $("#letterTitle").textContent = l.title;
  $("#letterBody").textContent = l.body;
  $("#letterFrom").textContent = l.from;
}

function renderItems() {
  const q = $("#search").value.trim().toLowerCase();
  const list = state.items.filter((i) => i.name.toLowerCase().includes(q));
  $("#count").textContent = state.items.length + " item";
  const grid = $("#grid"); grid.textContent = "";
  if (!list.length) {
    const e = document.createElement("p"); e.className = "empty";
    e.textContent = state.items.length ? "Item tidak ditemukan." : "Inventory kosong. Tambah item pertamamu.";
    grid.append(e); return;
  }
  for (const i of list) {
    const c = document.createElement("article"); c.className = "card";
    const mk = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; n.textContent = txt; return n; };
    const meta = mk("div", "meta", ""); meta.append(mk("span", "qty", "×" + i.qty), mk("span", "tag " + i.rarity, i.rarity));
    const tools = mk("div", "tools", "");
    const eb = mk("button", "", "Edit"), db = mk("button", "", "Hapus");
    eb.onclick = () => openItem(i.id); db.onclick = () => askDelete(i.id);
    tools.append(eb, db);
    c.append(mk("div", "ico", i.icon), mk("h3", "", i.name), mk("p", "", i.note || ""), meta, tools);
    grid.append(c);
  }
}

// CREATE + UPDATE
function openItem(id = null) {
  editingId = id;
  const f = $("#itemForm"); f.reset();
  $("#itemTitle").textContent = id ? "Edit item" : "Tambah item";
  if (id) { const i = state.items.find((x) => x.id === id); for (const k of ["icon", "name", "qty", "rarity", "note"]) f[k].value = i[k] ?? ""; }
  $("#itemDlg").showModal();
}
$("#itemForm").addEventListener("submit", (e) => {
  if (e.submitter?.value !== "ok") return;
  const f = e.target;
  const data = { icon: f.icon.value.trim(), name: f.name.value.trim(), qty: Math.max(1, +f.qty.value || 1), rarity: f.rarity.value, note: f.note.value.trim() };
  if (editingId) Object.assign(state.items.find((x) => x.id === editingId), data);
  else state.items.unshift({ id: "i" + Date.now(), ...data });
  save(editingId ? "Item diperbarui ✓" : "Item ditambahkan ✓"); renderItems();
});

// DELETE (permanen: dihapus dari state + localStorage)
function askDelete(id) {
  deletingId = id;
  $("#delText").textContent = `"${state.items.find((x) => x.id === id).name}" akan hilang selamanya. Kamu bisa menambahkannya lagi nanti lewat Tambah item.`;
  $("#delDlg").showModal();
}
$("#delDlg form").addEventListener("submit", (e) => {
  if (e.submitter?.value !== "ok") return;
  state.items = state.items.filter((x) => x.id !== deletingId);
  save("Item dihapus"); renderItems();
});

// PROFIL
let pendingAvatar = null;
$("#editProfile").onclick = () => {
  const f = $("#profileForm"); pendingAvatar = null; $("#avatarFile").value = "";
  f.game.value = state.profile.game; f.player.value = state.profile.player;
  f.avatar.value = state.profile.avatar.startsWith("data:") ? "" : state.profile.avatar;
  $("#profileDlg").showModal();
};
$("#avatarFile").onchange = (e) => {
  const file = e.target.files[0]; if (!file) return;
  const img = new Image();
  img.onload = () => { // kecilkan supaya muat di penyimpanan
    const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
    const m = Math.min(img.width, img.height);
    c.getContext("2d").drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, s, s);
    pendingAvatar = c.toDataURL("image/jpeg", .85); URL.revokeObjectURL(img.src);
  };
  img.src = URL.createObjectURL(file);
};
$("#profileForm").addEventListener("submit", (e) => {
  if (e.submitter?.value !== "ok") return;
  const f = e.target;
  state.profile.game = f.game.value.trim();
  state.profile.player = f.player.value.trim();
  state.profile.avatar = pendingAvatar || f.avatar.value.trim() || (state.profile.avatar.startsWith("data:") && !f.avatar.value ? state.profile.avatar : "");
  save("Profil disimpan ✓"); renderProfile();
});

// SURAT -> video mulai
$("#envelope").onclick = () => {
  const env = $("#envelope"), open = !env.classList.contains("open");
  env.classList.toggle("open", open); env.setAttribute("aria-expanded", open);
  const v = $("#video"), wrap = $("#videoWrap");
  wrap.classList.toggle("show", open);
  if (open) { setTimeout(() => { v.play().catch(() => {}); wrap.scrollIntoView({ behavior: "smooth", block: "center" }); }, 900); }
  else v.pause();
};

// umum
document.addEventListener("click", (e) => { if (e.target.matches("[data-close]")) e.target.closest("dialog").close(); });
$("#addBtn").onclick = () => openItem();
$("#saveBtn").onclick = () => save();
$("#search").oninput = renderItems;

(async () => { state = await load(); renderProfile(); renderLetter(); renderItems(); })();
