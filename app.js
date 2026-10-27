const KEY = "seoul-game-inventory-v2";
const FALLBACK = {
  profile: { game: "Seoul Quest", player: "Player One", avatar: "" },
  items: [],
  letter: { title: "Untuk kamu", body: "Tekan putar, ya.", from: "— aku" }
};
const $ = (s) => document.querySelector(s);
let state, editingId = null, deletingId = null;
let workPhoto = "", workAvatar = "";

const DEFAULT_AVATAR = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ffe3ec"/><circle cx="50" cy="38" r="18" fill="#ff5d8f"/><path d="M14 100c4-26 20-36 36-36s32 10 36 36z" fill="#ff9248"/></svg>');
const PIN = '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.500a2.5 2.5 0 0 1 0 5z"/></svg>';

async function load() {
  const saved = localStorage.getItem(KEY);
  if (saved) { try { return JSON.parse(saved); } catch {} }
  try { return await (await fetch("data/inventory.json")).json(); }
  catch { return structuredClone(FALLBACK); }
}
function save(msg = "Tersimpan ✓") {
  try { localStorage.setItem(KEY, JSON.stringify(state)); toast(msg); }
  catch { toast("Gagal menyimpan: penyimpanan penuh, pakai foto lebih kecil"); }
}
function toast(t) {
  const el = $("#toast"); el.textContent = t; el.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2200);
}

// baca & kecilkan foto supaya muat di penyimpanan
function readImage(file, max, square) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let sx = 0, sy = 0, sw = img.width, sh = img.height, w, h;
        if (square) { const m = Math.min(sw, sh); sx = (sw - m) / 2; sy = (sh - m) / 2; sw = sh = m; w = h = Math.min(max, m); }
        else { const k = Math.min(1, max / Math.max(sw, sh)); w = Math.round(sw * k); h = Math.round(sh * k); }
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function safeUrl(u) {
  u = (u || "").trim(); if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try { return new URL(u).href; } catch { return ""; }
}
function setPreview(imgEl, removeBtn, src) {
  imgEl.hidden = !src; removeBtn.hidden = !src;
  if (src) imgEl.src = src;
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
  $("#count").textContent = state.items.length + " post";
  const grid = $("#grid"); grid.textContent = "";
  if (!list.length) {
    const e = document.createElement("p"); e.className = "empty";
    e.textContent = state.items.length ? "Map tidak ditemukan." : "Belum ada post. Tambah map pertamamu.";
    grid.append(e); return;
  }
  for (const i of list) {
    const c = document.createElement("article"); c.className = "card";
    let thumb;
    if (i.photo) { thumb = document.createElement("img"); thumb.className = "thumb"; thumb.src = i.photo; thumb.alt = i.name; thumb.loading = "lazy"; }
    else { thumb = document.createElement("div"); thumb.className = "thumb ph"; thumb.innerHTML = PIN; }
    const body = document.createElement("div"); body.className = "body";
    const h = document.createElement("h3"); h.textContent = i.name; body.append(h);
    const url = safeUrl(i.link);
    if (url) { const a = document.createElement("a"); a.className = "go"; a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = "Buka link"; body.append(a); }
    const tools = document.createElement("div"); tools.className = "tools";
    const eb = document.createElement("button"); eb.textContent = "Edit"; eb.onclick = () => openItem(i.id);
    const db = document.createElement("button"); db.textContent = "Hapus"; db.onclick = () => askDelete(i.id);
    tools.append(eb, db); body.append(tools);
    c.append(thumb, body); grid.append(c);
  }
}

// CREATE + UPDATE
function openItem(id = null) {
  editingId = id;
  const f = $("#itemForm"); f.reset(); $("#itemFile").value = "";
  $("#itemTitle").textContent = id ? "Edit post" : "Tambah post";
  workPhoto = "";
  if (id) {
    const i = state.items.find((x) => x.id === id);
    f.name.value = i.name; f.link.value = i.link || "";
    workPhoto = i.photo || "";
    f.photoUrl.value = workPhoto.startsWith("data:") ? "" : workPhoto;
  }
  setPreview($("#itemPreview"), $("#itemPhotoRemove"), workPhoto);
  $("#itemDlg").showModal();
}
$("#itemFile").onchange = async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try { workPhoto = await readImage(file, 900, false); $("#itemForm").photoUrl.value = ""; setPreview($("#itemPreview"), $("#itemPhotoRemove"), workPhoto); }
  catch { toast("Foto tidak bisa dibaca"); }
};
$("#itemForm").photoUrl.oninput = (e) => { workPhoto = e.target.value.trim(); setPreview($("#itemPreview"), $("#itemPhotoRemove"), workPhoto); };
$("#itemPhotoRemove").onclick = () => { workPhoto = ""; $("#itemFile").value = ""; $("#itemForm").photoUrl.value = ""; setPreview($("#itemPreview"), $("#itemPhotoRemove"), ""); };
$("#itemForm").addEventListener("submit", (e) => {
  if (e.submitter?.value !== "ok") return;
  const f = e.target;
  const data = { name: f.name.value.trim(), link: safeUrl(f.link.value), photo: workPhoto };
  if (editingId) Object.assign(state.items.find((x) => x.id === editingId), data);
  else state.items.unshift({ id: "m" + Date.now(), ...data });
  save(editingId ? "Post diperbarui ✓" : "Post ditambahkan ✓"); renderItems();
});

// DELETE (permanen)
function askDelete(id) {
  deletingId = id;
  $("#delText").textContent = `"${state.items.find((x) => x.id === id).name}" akan hilang selamanya. Kamu bisa menambahkannya lagi lewat Tambah post.`;
  $("#delDlg").showModal();
}
$("#delDlg form").addEventListener("submit", (e) => {
  if (e.submitter?.value !== "ok") return;
  state.items = state.items.filter((x) => x.id !== deletingId);
  save("Post dihapus"); renderItems();
});

// PROFIL
$("#editProfile").onclick = () => {
  const f = $("#profileForm"); $("#avatarFile").value = "";
  f.game.value = state.profile.game; f.player.value = state.profile.player;
  workAvatar = state.profile.avatar || "";
  f.avatar.value = workAvatar.startsWith("data:") ? "" : workAvatar;
  setPreview($("#profilePreview"), $("#avatarRemove"), workAvatar);
  $("#profileDlg").showModal();
};
$("#avatarFile").onchange = async (e) => {
  const file = e.target.files[0]; if (!file) return;
  try { workAvatar = await readImage(file, 300, true); $("#profileForm").avatar.value = ""; setPreview($("#profilePreview"), $("#avatarRemove"), workAvatar); }
  catch { toast("Foto tidak bisa dibaca"); }
};
$("#profileForm").avatar.oninput = (e) => { workAvatar = e.target.value.trim(); setPreview($("#profilePreview"), $("#avatarRemove"), workAvatar); };
$("#avatarRemove").onclick = () => { workAvatar = ""; $("#avatarFile").value = ""; $("#profileForm").avatar.value = ""; setPreview($("#profilePreview"), $("#avatarRemove"), ""); };
$("#profileForm").addEventListener("submit", (e) => {
  if (e.submitter?.value !== "ok") return;
  const f = e.target;
  state.profile.game = f.game.value.trim();
  state.profile.player = f.player.value.trim();
  state.profile.avatar = workAvatar;
  save("Profil disimpan ✓"); renderProfile();
});

// SURAT -> video mulai
$("#envelope").onclick = () => {
  const env = $("#envelope"), open = !env.classList.contains("open");
  env.classList.toggle("open", open); env.setAttribute("aria-expanded", open);
  const v = $("#video"), wrap = $("#videoWrap");
  wrap.classList.toggle("show", open);
  if (open) setTimeout(() => { v.play().catch(() => {}); wrap.scrollIntoView({ behavior: "smooth", block: "center" }); }, 900);
  else v.pause();
};

document.addEventListener("click", (e) => { if (e.target.matches("[data-close]")) e.target.closest("dialog").close(); });
$("#addBtn").onclick = () => openItem();
$("#saveBtn").onclick = () => save();
$("#search").oninput = renderItems;

(async () => { state = await load(); renderProfile(); renderLetter(); renderItems(); })();
