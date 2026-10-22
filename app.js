/* YZ SKU Admin — single-page admin app (vanilla JS + Supabase) */
(() => {
"use strict";

const CFG = window.YZ_CONFIG;
const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY);
const app = document.getElementById("app");
const BUCKET = "sku-images";
const SKU_RE = /^[A-Za-z0-9._-]{2,40}$/;

const state = {
  session: null, admin: null, loaded: false,
  products: [], types: [], img: {},
  q: "", type: "all", status: "active", sort: "updated", view: "grid", limit: 120,
  selecting: false, selected: new Set(),
  scanStop: null,
};

/* ---------------- utils ---------------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const money = (n) => n == null || n === "" ? "—" : new Intl.NumberFormat("en-SG", { style: "currency", currency: CFG.CURRENCY, maximumFractionDigits: 2 }).format(n);
const moneyShort = (n) => new Intl.NumberFormat("en-SG", { style: "currency", currency: CFG.CURRENCY, notation: n >= 100000 ? "compact" : "standard", maximumFractionDigits: n >= 100000 ? 1 : 0 }).format(n || 0);
const num = (n) => new Intl.NumberFormat("en-SG").format(n || 0);
const when = (d) => { const t = new Date(d); const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "just now"; if (diff < 3600) return Math.floor(diff / 60) + " min ago";
  if (diff < 86400) return Math.floor(diff / 3600) + " h ago"; if (diff < 7 * 86400) return Math.floor(diff / 86400) + " d ago";
  return t.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" }); };
const qrBase = () => (CFG.QR_BASE_URL || (location.origin + location.pathname)).replace(/#.*$/, "");
const qrLink = (sku) => qrBase() + "#/p/" + encodeURIComponent(sku);
const typeOf = (name) => state.types.find((t) => t.name === name);
const typeColour = (name) => typeOf(name)?.colour || "#8f857a";
const isLow = (p) => p.status === "active" && p.reorder_at != null && p.stock <= p.reorder_at;
const initials = (s) => (s || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2600); }
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

const I = {
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  qr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 20h2M20 14v2"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>',
};
const brandMark = '<span class="brand-mark"><svg viewBox="0 0 32 32"><path d="M8 8h6v6H8zM18 8h6v6h-6zM8 18h6v6H8zM18 18h2v2h-2zM22 22h2v2h-2zM18 22h2v2h-2zM22 18h2v2h-2z"/></svg></span>';

/* ---------------- modal ---------------- */
function modal(html, onMount) {
  const bg = document.createElement("div");
  bg.className = "modal-bg";
  bg.innerHTML = `<div class="modal card" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => bg.remove();
  bg.addEventListener("click", (e) => { if (e.target === bg || e.target.closest("[data-close]")) close(); });
  document.body.appendChild(bg);
  onMount?.(bg.firstElementChild, close);
  bg.querySelector("input,select,textarea")?.focus();
  return close;
}
function confirmBox(title, text, okLabel = "Delete") {
  return new Promise((res) => {
    modal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p>
      <div class="row" style="justify-content:flex-end;margin-top:16px"><button class="btn" data-close>Cancel</button><button class="btn dark" id="ok">${esc(okLabel)}</button></div>`,
      (m, close) => { $("#ok", m).onclick = () => { close(); res(true); }; m.parentElement.addEventListener("click", (e) => { if (e.target.closest("[data-close]") || e.target === m.parentElement) res(false); }); });
  });
}

/* ---------------- data ---------------- */
async function loadAll() {
  const [{ data: types, error: e1 }] = await Promise.all([sb.from("sku_types").select("*").order("sort").order("name")]);
  if (e1) throw e1;
  const products = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("sku_products").select("*").order("sku").range(from, from + 999);
    if (error) throw error;
    products.push(...data);
    if (data.length < 1000) break;
  }
  state.types = types; state.products = products; state.loaded = true;
  await signImages(products.map((p) => p.image_path));
}
async function signImages(paths) {
  const need = [...new Set(paths.filter((p) => p && !state.img[p]))];
  for (let i = 0; i < need.length; i += 500) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(need.slice(i, i + 500), 60 * 60 * 12);
    (data || []).forEach((d) => { if (d.signedUrl) state.img[d.path] = d.signedUrl; });
  }
}
const imgFor = (p) => (p?.image_path && state.img[p.image_path]) || null;
function upsertLocal(p) { const i = state.products.findIndex((x) => x.sku === p.sku); if (i >= 0) state.products[i] = p; else state.products.push(p); }

/* ---------------- QR ---------------- */
function makeQR(text) { const q = qrcode(0, "M"); q.addData(text); q.make(); return q; }
function qrDataURL(text, cell = 8) { return makeQR(text).createDataURL(cell, 2); }
function labelCanvas(p) {
  const q = makeQR(qrLink(p.sku)); const n = q.getModuleCount();
  const cell = 12, qs = n * cell, pad = 40, W = qs + pad * 2, H = qs + pad * 2 + 110;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect(pad + k * cell, pad + r * cell, cell, cell);
  x.textAlign = "center"; x.font = "bold 34px ui-monospace, Menlo, monospace"; x.fillText(p.sku, W / 2, qs + pad + 50);
  x.font = "600 24px Figtree, sans-serif"; let name = p.name || ""; while (x.measureText(name).width > W - 40 && name.length > 3) name = name.slice(0, -2);
  if (name !== (p.name || "")) name += "…"; x.fillStyle = "#333"; x.fillText(name, W / 2, qs + pad + 88);
  return c;
}
function downloadLabel(p) { const a = document.createElement("a"); a.href = labelCanvas(p).toDataURL("image/png"); a.download = `QR-${p.sku}.png`; a.click(); }
function printLabels(list) {
  const area = $("#print-area");
  area.innerHTML = list.map((p) => `<div class="label"><img src="${qrDataURL(qrLink(p.sku), 6)}" alt=""><div class="s">${esc(p.sku)}</div><div class="n">${esc(p.name)}</div></div>`).join("");
  setTimeout(() => window.print(), 150);
}

/* ---------------- shell ---------------- */
function shell(active, inner) {
  const tab = (href, key, icon, label) => `<a href="${href}" class="${active === key ? "active" : ""}">${icon}<span>${label}</span></a>`;
  return `<div class="shell">
    <header class="topbar"><div class="topbar-inner">
      <a class="brand" href="#/products">${brandMark}<span class="hide-sm">YZ SKU</span></a>
      <nav class="nav">${tab("#/products", "products", I.box, "Products")}${tab("#/types", "types", I.tag, "Types")}${tab("#/scan", "scan", I.scan, "Scan")}${tab("#/settings", "settings", I.gear, "Settings")}</nav>
      <span class="spacer"></span>
      <a class="btn primary" href="#/new">${I.plus}<span class="hide-sm">Add product</span></a>
    </div></header>
    <main id="main">${inner}</main></div>`;
}

/* ---------------- router ---------------- */
async function render() {
  if (state.scanStop) { state.scanStop(); state.scanStop = null; }
  state.selecting = false; state.selected.clear();
  if (!state.session) return viewLogin();
  if (!state.admin) return viewNotAdmin();
  if (state.admin.must_change_password) return viewSetPassword();
  if (!state.loaded) {
    app.innerHTML = shell("", '<div class="spinner"></div>');
    try { state.loading ||= loadAll().finally(() => (state.loading = null)); await state.loading; } catch (e) { app.innerHTML = shell("", `<div class="card pad error">Could not load products: ${esc(e.message)}</div>`); return; }
  }
  const parts = (location.hash.replace(/^#\/?/, "") || "products").split("/").map(decodeURIComponent);
  const [r, a, b] = parts;
  window.scrollTo(0, 0);
  if (r === "products") return viewProducts();
  if (r === "types" && a) return viewTypeDetail(a);
  if (r === "types") return viewTypes();
  if (r === "scan") return viewScan();
  if (r === "settings") return viewSettings();
  if (r === "new") return viewForm(null, a);
  if (r === "p" && a && b === "edit") return viewForm(state.products.find((p) => p.sku === a));
  if (r === "p" && a) return viewProduct(a);
  // Legacy QR format from the first prototype: …#SKU
  const legacy = state.products.find((p) => p.sku === parts.join("/"));
  if (legacy) return go("#/p/" + encodeURIComponent(legacy.sku));
  return viewProducts();
}

/* ---------------- auth views ---------------- */
function viewLogin() {
  app.innerHTML = `<div class="auth"><form class="card stack" id="f">
    <div class="brand">${brandMark}<span>YZ SKU Admin</span></div>
    <div><h2>Sign in</h2><p class="muted" style="margin:4px 0 0">Manage products, QR codes and stock.</p></div>
    <div class="field"><label for="em">Email</label><input class="input" id="em" type="email" autocomplete="username" required></div>
    <div class="field"><label for="pw">Password</label><input class="input" id="pw" type="password" autocomplete="current-password" required></div>
    <div class="error" id="err"></div>
    <button class="btn primary" type="submit">Sign in</button>
  </form></div>`;
  $("#f").onsubmit = async (e) => {
    e.preventDefault(); const btn = $("#f button"); btn.disabled = true; $("#err").textContent = "";
    const { error } = await sb.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value });
    if (error) { $("#err").textContent = error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message; btn.disabled = false; }
  };
}
function viewNotAdmin() {
  app.innerHTML = `<div class="auth"><div class="card stack"><div class="brand">${brandMark}<span>YZ SKU Admin</span></div>
    <h2>No access</h2><p class="muted">${esc(state.session.user.email)} isn't on the admin list.</p>
    <button class="btn" id="out">Sign out</button></div></div>`;
  $("#out").onclick = () => sb.auth.signOut();
}
function viewSetPassword() {
  app.innerHTML = `<div class="auth"><form class="card stack" id="f"><div class="brand">${brandMark}<span>YZ SKU Admin</span></div>
    <div><h2>Choose your password</h2><p class="muted" style="margin:4px 0 0">Replace the temporary password before continuing.</p></div>
    <div class="field"><label for="p1">New password</label><input class="input" id="p1" type="password" minlength="8" autocomplete="new-password" required></div>
    <div class="field"><label for="p2">Repeat new password</label><input class="input" id="p2" type="password" minlength="8" autocomplete="new-password" required></div>
    <div class="error" id="err"></div><button class="btn primary">Save password</button></form></div>`;
  $("#f").onsubmit = async (e) => {
    e.preventDefault(); const p1 = $("#p1").value;
    if (p1 !== $("#p2").value) return ($("#err").textContent = "Passwords don't match.");
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) return ($("#err").textContent = error.message);
    await sb.from("sku_admins").update({ must_change_password: false }).eq("email", state.admin.email);
    state.admin.must_change_password = false; toast("Password saved"); render();
  };
}

/* ---------------- products ---------------- */
function filtered(list = state.products, opts = state) {
  const q = (opts.q || "").trim().toLowerCase();
  let out = list.filter((p) => {
    if (opts.type && opts.type !== "all" && (opts.type === "__none" ? p.type : p.type !== opts.type)) return false;
    if (opts.status === "active" && p.status !== "active") return false;
    if (opts.status === "discontinued" && p.status !== "discontinued") return false;
    if (opts.status === "low" && !isLow(p)) return false;
    if (!q) return true;
    return [p.sku, p.name, p.type, p.location, p.supplier, p.colour, p.origin, p.description].some((v) => v && String(v).toLowerCase().includes(q));
  });
  const s = opts.sort || "updated";
  const cmp = { updated: (a, b) => b.updated_at.localeCompare(a.updated_at), sku: (a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }),
    name: (a, b) => a.name.localeCompare(b.name), price: (a, b) => (b.price || 0) - (a.price || 0), stock: (a, b) => a.stock - b.stock }[s];
  return out.sort(cmp);
}
function statsHTML(list) {
  const active = list.filter((p) => p.status === "active");
  const units = active.reduce((s, p) => s + (p.stock || 0), 0);
  const value = active.reduce((s, p) => s + (p.stock || 0) * (p.price || 0), 0);
  const low = list.filter(isLow).length;
  return `<div class="stats">
    <div class="card stat"><div class="k">Active SKUs</div><div class="v">${num(active.length)}</div></div>
    <div class="card stat"><div class="k">Units in stock</div><div class="v">${num(units)}</div></div>
    <div class="card stat"><div class="k">Stock value (retail)</div><div class="v">${moneyShort(value)}</div></div>
    <div class="card stat clickable" data-low><div class="k">Low stock</div><div class="v" style="color:${low ? "var(--warn)" : "inherit"}">${num(low)}</div></div></div>`;
}
function cardHTML(p) {
  const img = imgFor(p); const sel = state.selected.has(p.sku);
  const badge = p.status === "discontinued" ? '<span class="chip badge">Discontinued</span>' : isLow(p) ? `<span class="chip warn badge">Low · ${p.stock}</span>` : "";
  return `<a class="card pcard ${state.selecting && sel ? "selected" : ""}" href="#/p/${encodeURIComponent(p.sku)}" data-sku="${esc(p.sku)}">
    <div class="thumb">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="ph">${esc(initials(p.name))}</span>`}</div>
    ${badge}${state.selecting ? `<span class="sel">${sel ? I.check : ""}</span>` : ""}
    <div class="body"><span class="faint mono">${esc(p.sku)}</span><span class="name">${esc(p.name)}</span>
      <div class="meta"><span class="chip"><span class="dot" style="background:${typeColour(p.type)}"></span>${esc(p.type || "No type")}</span><span class="price">${money(p.price)}</span></div>
      <div class="faint">${num(p.stock)} in stock${p.location ? " · " + esc(p.location) : ""}</div></div></a>`;
}
function rowHTML(p) {
  const img = imgFor(p); const sel = state.selected.has(p.sku);
  return `<tr class="link" data-sku="${esc(p.sku)}">
    ${state.selecting ? `<td><input type="checkbox" ${sel ? "checked" : ""} aria-label="Select ${esc(p.sku)}"></td>` : ""}
    <td><div class="mini-thumb">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : esc(initials(p.name))}</div></td>
    <td class="mono">${esc(p.sku)}</td><td><strong>${esc(p.name)}</strong></td>
    <td><span class="chip"><span class="dot" style="background:${typeColour(p.type)}"></span>${esc(p.type || "No type")}</span></td>
    <td class="num">${money(p.price)}</td><td class="num">${isLow(p) ? `<span class="chip warn">${p.stock}</span>` : num(p.stock)}</td>
    <td>${esc(p.location || "")}</td><td class="faint">${when(p.updated_at)}</td></tr>`;
}
function resultsHTML(list) {
  if (!state.products.length) return `<div class="card empty"><h3>No products yet</h3><p>Add your first SKU, or import a CSV in Settings.</p><a class="btn primary" href="#/new">${I.plus}Add product</a></div>`;
  if (!list.length) return `<div class="card empty"><h3>No matches</h3><p>Try a different search or filter.</p></div>`;
  const shown = list.slice(0, state.limit);
  const more = list.length > shown.length ? `<div style="text-align:center;margin-top:16px"><button class="btn" data-more>Show more (${num(list.length - shown.length)} left)</button></div>` : "";
  if (state.view === "list") return `<div class="card table-wrap"><table class="list"><thead><tr>${state.selecting ? "<th></th>" : ""}<th></th><th>SKU</th><th>Name</th><th>Type</th><th class="num">Price</th><th class="num">Stock</th><th>Location</th><th>Updated</th></tr></thead><tbody>${shown.map(rowHTML).join("")}</tbody></table></div>${more}`;
  return `<div class="grid">${shown.map(cardHTML).join("")}</div>${more}`;
}
function bindResults(root, getList, rerender) {
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-more]")) { state.limit += 240; rerender(); return; }
    const el = e.target.closest("[data-sku]"); if (!el) return;
    const sku = el.dataset.sku;
    if (state.selecting) { e.preventDefault(); state.selected.has(sku) ? state.selected.delete(sku) : state.selected.add(sku); rerender(); return; }
    if (el.tagName === "TR") go("#/p/" + encodeURIComponent(sku));
  });
}
function selbarHTML(list) {
  if (!state.selecting) return "";
  return `<div class="selbar"><strong>${state.selected.size} selected</strong><span class="spacer" style="flex:1"></span>
    <button class="btn sm ghost" style="color:inherit" data-selall>Select all ${list.length > 500 ? "(first 500)" : `(${list.length})`}</button>
    <button class="btn sm" data-print ${state.selected.size ? "" : "disabled"}>${I.print}Print labels</button>
    <button class="btn sm ghost" style="color:inherit" data-selcancel>Done</button></div>`;
}
function bindSelbar(root, getList, rerender) {
  root.addEventListener("click", (e) => {
    if (e.target.closest("[data-selall]")) { getList().slice(0, 500).forEach((p) => state.selected.add(p.sku)); rerender(); }
    if (e.target.closest("[data-selcancel]")) { state.selecting = false; state.selected.clear(); rerender(); }
    if (e.target.closest("[data-print]")) printLabels(state.products.filter((p) => state.selected.has(p.sku)));
  });
}

function viewProducts() {
  state.limit = 120;
  const counts = {}; state.products.forEach((p) => { const k = p.type || "__none"; counts[k] = (counts[k] || 0) + 1; });
  const pill = (val, label, colour) => `<button class="pill ${state.type === val ? "active" : ""}" data-type="${esc(val)}">${colour ? `<span class="dot" style="background:${colour}"></span>` : ""}${esc(label)} <span class="n">${num(val === "all" ? state.products.length : counts[val] || 0)}</span></button>`;
  app.innerHTML = shell("products", `
    <div class="page-head"><div><h1>Products</h1><p class="muted">Every SKU at a glance. Tap a product for its QR code and details.</p></div></div>
    ${statsHTML(state.products)}
    <div class="toolbar">
      <div class="search">${I.search}<input class="input" id="q" type="search" placeholder="Search SKU, name, location, supplier…" value="${esc(state.q)}"></div>
      <select class="input" id="status" style="width:auto"><option value="active">Active</option><option value="all">All statuses</option><option value="low">Low stock</option><option value="discontinued">Discontinued</option></select>
      <select class="input" id="sort" style="width:auto"><option value="updated">Recently updated</option><option value="sku">SKU</option><option value="name">Name A–Z</option><option value="price">Price high–low</option><option value="stock">Stock low–high</option></select>
      <div class="row" style="gap:4px"><button class="btn icon-btn ${state.view === "grid" ? "dark" : ""}" data-view="grid" title="Grid view" aria-label="Grid view">${I.grid}</button><button class="btn icon-btn ${state.view === "list" ? "dark" : ""}" data-view="list" title="List view" aria-label="List view">${I.list}</button></div>
      <button class="btn" id="selmode">${I.qr}Labels</button>
    </div>
    <div class="pills" style="margin-bottom:14px">${pill("all", "All types")}${state.types.map((t) => pill(t.name, t.name, t.colour)).join("")}${counts.__none ? pill("__none", "No type") : ""}</div>
    <div id="sel"></div><div id="results"></div>`);
  $("#status").value = state.status; $("#sort").value = state.sort;
  const list = () => filtered();
  const rerender = () => { const l = list(); $("#sel").innerHTML = selbarHTML(l); $("#results").innerHTML = resultsHTML(l); };
  rerender();
  $("#q").oninput = (e) => { state.q = e.target.value; state.limit = 120; rerender(); };
  $("#status").onchange = (e) => { state.status = e.target.value; rerender(); };
  $("#sort").onchange = (e) => { state.sort = e.target.value; rerender(); };
  $$("[data-view]").forEach((b) => (b.onclick = () => { state.view = b.dataset.view; viewProducts(); }));
  $$("[data-type]").forEach((b) => (b.onclick = () => { state.type = b.dataset.type; $$("[data-type]").forEach((x) => x.classList.toggle("active", x === b)); rerender(); }));
  $("[data-low]").onclick = () => { state.status = "low"; $("#status").value = "low"; rerender(); };
  $("#selmode").onclick = () => { state.selecting = !state.selecting; if (!state.selecting) state.selected.clear(); rerender(); };
  bindResults($("#results"), list, rerender); bindSelbar($("#sel"), list, rerender);
}

/* ---------------- types ---------------- */
function typeSummary(name) {
  const items = state.products.filter((p) => (name === "__none" ? !p.type : p.type === name));
  const active = items.filter((p) => p.status === "active");
  return { items, count: active.length, units: active.reduce((s, p) => s + p.stock, 0), value: active.reduce((s, p) => s + p.stock * (p.price || 0), 0), low: items.filter(isLow).length };
}
function viewTypes() {
  const card = (name, label, colour) => {
    const s = typeSummary(name);
    const pics = s.items.filter(imgFor).slice(0, 4);
    return `<a class="card tcard" href="#/types/${encodeURIComponent(name)}" style="--tc:${colour}">
      <div class="row" style="justify-content:space-between"><h2>${esc(label)}</h2>${s.low ? `<span class="chip warn">${s.low} low</span>` : ""}</div>
      <div class="thumbs">${[0, 1, 2, 3].map((i) => `<div>${pics[i] ? `<img src="${esc(imgFor(pics[i]))}" alt="" loading="lazy">` : ""}</div>`).join("")}</div>
      <div class="nums"><div><div class="k">SKUs</div><div class="v">${num(s.count)}</div></div><div><div class="k">Units</div><div class="v">${num(s.units)}</div></div><div><div class="k">Value</div><div class="v">${moneyShort(s.value)}</div></div></div></a>`;
  };
  const none = state.products.some((p) => !p.type);
  app.innerHTML = shell("types", `
    <div class="page-head"><div><h1>Types</h1><p class="muted">Your products organised by type.</p></div>
      <div class="row"><button class="btn" id="manage">${I.edit}Manage types</button><button class="btn dark" id="addtype">${I.plus}New type</button></div></div>
    ${state.types.length || none ? `<div class="types-grid">${state.types.map((t) => card(t.name, t.name, t.colour)).join("")}${none ? card("__none", "No type", "#8f857a") : ""}</div>`
      : `<div class="card empty"><h3>No types yet</h3><p>Create types like Pearls or Jade to group products.</p></div>`}`);
  $("#addtype").onclick = () => typeModal();
  $("#manage").onclick = manageTypesModal;
}
function viewTypeDetail(name) {
  const t = typeOf(name); const label = name === "__none" ? "No type" : name;
  if (!t && name !== "__none") return go("#/types");
  const opts = { q: "", type: name, status: "all", sort: "sku" };
  const s = typeSummary(name);
  app.innerHTML = shell("types", `
    <a class="back" href="#/types">${I.back}All types</a>
    <div class="page-head"><div><div class="row"><span class="chip"><span class="dot" style="background:${t?.colour || "#8f857a"}"></span>${t ? "SKU prefix " + esc(t.prefix) : "Unassigned"}</span></div>
      <h1 style="margin-top:6px">${esc(label)}</h1></div>
      <div class="row">${t ? `<button class="btn" id="edit">${I.edit}Edit type</button><a class="btn primary" href="#/new/${encodeURIComponent(name)}">${I.plus}Add ${esc(name)}</a>` : ""}</div></div>
    <div class="stats"><div class="card stat"><div class="k">Active SKUs</div><div class="v">${num(s.count)}</div></div><div class="card stat"><div class="k">Units in stock</div><div class="v">${num(s.units)}</div></div>
      <div class="card stat"><div class="k">Stock value</div><div class="v">${moneyShort(s.value)}</div></div><div class="card stat"><div class="k">Low stock</div><div class="v">${num(s.low)}</div></div></div>
    <div class="toolbar"><div class="search">${I.search}<input class="input" id="q" type="search" placeholder="Search in ${esc(label)}…"></div>
      <select class="input" id="status" style="width:auto"><option value="all">All statuses</option><option value="active">Active</option><option value="low">Low stock</option><option value="discontinued">Discontinued</option></select>
      <button class="btn" id="selmode">${I.qr}Labels</button></div>
    <div id="sel"></div><div id="results"></div>`);
  state.limit = 120;
  const list = () => filtered(state.products, opts);
  const rerender = () => { const l = list(); $("#sel").innerHTML = selbarHTML(l); $("#results").innerHTML = resultsHTML(l); };
  rerender();
  $("#q").oninput = (e) => { opts.q = e.target.value; rerender(); };
  $("#status").onchange = (e) => { opts.status = e.target.value; rerender(); };
  $("#selmode").onclick = () => { state.selecting = !state.selecting; if (!state.selecting) state.selected.clear(); rerender(); };
  if (t) $("#edit").onclick = () => typeModal(t);
  bindResults($("#results"), list, rerender); bindSelbar($("#sel"), list, rerender);
}
function suggestPrefix(name) {
  let base = (name || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3) || "SKU";
  if (base.length < 2) base = (base + "X").slice(0, 2);
  let p = base, i = 2; while (state.types.some((t) => t.prefix === p)) p = base.slice(0, 3) + i++;
  return p;
}
const SWATCHES = ["#b7a58c", "#4f8a6b", "#a33a2c", "#2f6f9f", "#c08a2d", "#7a5c99", "#3b3b3b", "#d17a8b"];
function typeModal(t, onDone) {
  modal(`<form id="tf" class="stack"><h2>${t ? "Edit type" : "New type"}</h2>
    <div class="field"><label for="tn">Name</label><input class="input" id="tn" required maxlength="40" value="${esc(t?.name || "")}" placeholder="e.g. Pearls"></div>
    <div class="field"><label for="tp">SKU prefix</label><input class="input mono" id="tp" required pattern="[A-Z0-9]{2,6}" maxlength="6" value="${esc(t?.prefix || "")}" placeholder="e.g. PRL">
      <span class="hint">2–6 capital letters/digits. New SKUs of this type are suggested as PREFIX-0001, PREFIX-0002…</span></div>
    <div class="field"><label>Colour</label><div class="row" id="sw">${SWATCHES.map((c) => `<button type="button" class="btn icon-btn" data-c="${c}" style="background:${c};border:3px solid ${(t?.colour || SWATCHES[0]) === c ? "var(--ink)" : "transparent"}" aria-label="Colour ${c}"></button>`).join("")}</div></div>
    <div class="error" id="terr"></div>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">${t ? "Save" : "Create type"}</button></div></form>`,
  (m, close) => {
    let colour = t?.colour || SWATCHES[state.types.length % SWATCHES.length];
    $$("#sw [data-c]", m).forEach((b) => { b.style.borderColor = b.dataset.c === colour ? "var(--ink)" : "transparent";
      b.onclick = () => { colour = b.dataset.c; $$("#sw [data-c]", m).forEach((x) => (x.style.borderColor = x === b ? "var(--ink)" : "transparent")); }; });
    const tn = $("#tn", m), tp = $("#tp", m);
    let touched = !!t; tp.oninput = () => { touched = true; tp.value = tp.value.toUpperCase(); };
    tn.oninput = () => { if (!touched) tp.value = suggestPrefix(tn.value); };
    $("#tf", m).onsubmit = async (e) => {
      e.preventDefault();
      const row = { name: tn.value.trim(), prefix: tp.value.trim().toUpperCase(), colour };
      const q = t ? sb.from("sku_types").update(row).eq("name", t.name).select().single() : sb.from("sku_types").insert({ ...row, sort: state.types.length + 1 }).select().single();
      const { data, error } = await q;
      if (error) return ($("#terr", m).textContent = error.code === "23505" ? "That name or prefix is already used." : error.message);
      if (t) { state.products.forEach((p) => { if (p.type === t.name) p.type = data.name; }); Object.assign(t, data); } else state.types.push(data);
      close(); toast(t ? "Type saved" : "Type created");
      if (onDone) onDone(data); else if (t && location.hash.startsWith("#/types/")) go("#/types/" + encodeURIComponent(data.name)); else render();
    };
  });
}
function manageTypesModal() {
  modal(`<h2>Manage types</h2><p class="faint">Deleting a type keeps its products — they become “No type”.</p>
    <div class="stack" style="gap:6px;margin:12px 0">${state.types.map((t) => `<div class="row" style="justify-content:space-between;border:1px solid var(--line);border-radius:10px;padding:8px 10px">
      <span class="row" style="gap:8px"><span class="chip"><span class="dot" style="background:${t.colour}"></span>${esc(t.prefix)}</span><strong>${esc(t.name)}</strong><span class="faint">${typeSummary(t.name).items.length}</span></span>
      <span class="row" style="gap:4px"><button class="btn sm" data-e="${esc(t.name)}">Edit</button><button class="btn sm danger" data-d="${esc(t.name)}">Delete</button></span></div>`).join("") || '<p class="muted">No types yet.</p>'}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-close>Close</button></div>`,
  (m, close) => {
    $$("[data-e]", m).forEach((b) => (b.onclick = () => { close(); typeModal(typeOf(b.dataset.e)); }));
    $$("[data-d]", m).forEach((b) => (b.onclick = async () => {
      const n = b.dataset.d; close();
      if (!(await confirmBox(`Delete “${n}”?`, `${typeSummary(n).items.length} product(s) will be kept with no type.`))) return;
      const { error } = await sb.from("sku_types").delete().eq("name", n);
      if (error) return toast(error.message);
      state.types = state.types.filter((t) => t.name !== n); state.products.forEach((p) => { if (p.type === n) p.type = null; });
      toast("Type deleted"); render();
    }));
  });
}

/* ---------------- product detail ---------------- */
const FIELDS = [["type", "Type"], ["price", "Price"], ["cost", "Cost"], ["stock", "Stock"], ["reorder_at", "Reorder at"], ["location", "Location"], ["supplier", "Supplier"], ["size", "Size"], ["weight", "Weight"], ["colour", "Colour"], ["origin", "Origin"], ["status", "Status"]];
const fmtField = (k, v) => v == null || v === "" ? "—" : k === "price" || k === "cost" ? money(v) : k === "stock" || k === "reorder_at" ? num(v) : esc(v);
const LABELS = Object.fromEntries([...FIELDS, ["name", "Name"], ["description", "Description"], ["image_path", "Photo"]]);

async function viewProduct(sku) {
  const p = state.products.find((x) => x.sku === sku);
  if (!p) {
    app.innerHTML = shell("", `<div class="card empty"><h3>SKU “${esc(sku)}” not found</h3><p>It may have been deleted, or not added yet.</p>
      <div class="row" style="justify-content:center"><a class="btn" href="#/products">Back to products</a><a class="btn primary" href="#/new" id="addit">${I.plus}Add ${esc(sku)}</a></div></div>`);
    $("#addit").onclick = (e) => { e.preventDefault(); state.prefillSku = sku; go("#/new"); };
    return;
  }
  const img = imgFor(p);
  app.innerHTML = shell("", `
    <a class="back" href="javascript:history.back()">${I.back}Back</a>
    <div class="detail"><div class="stack">
      <div class="card pad hero">
        <div class="thumb">${img ? `<img src="${esc(img)}" alt="${esc(p.name)}">` : `<span class="ph">${esc(initials(p.name))}</span>`}</div>
        <div class="stack" style="gap:10px">
          <div class="row"><span class="mono faint">${esc(p.sku)}</span>${p.type ? `<a class="chip" href="#/types/${encodeURIComponent(p.type)}" style="text-decoration:none"><span class="dot" style="background:${typeColour(p.type)}"></span>${esc(p.type)}</a>` : ""}
            ${p.status === "discontinued" ? '<span class="chip">Discontinued</span>' : isLow(p) ? '<span class="chip warn">Low stock</span>' : '<span class="chip ok">Active</span>'}</div>
          <h1>${esc(p.name)}</h1>
          <div class="row" style="gap:18px"><div><div class="faint">Price</div><div style="font-family:var(--serif);font-size:24px;font-weight:600">${money(p.price)}</div></div>
            <div><div class="faint">In stock</div><div class="row" style="gap:6px"><button class="btn sm icon-btn" data-adj="-1" aria-label="Decrease stock">−</button><strong style="font-size:22px;min-width:40px;text-align:center" id="stk">${num(p.stock)}</strong><button class="btn sm icon-btn" data-adj="1" aria-label="Increase stock">+</button></div></div></div>
          ${p.description ? `<p class="muted" style="margin:0;white-space:pre-wrap">${esc(p.description)}</p>` : ""}
          <div class="row"><a class="btn dark" href="#/p/${encodeURIComponent(p.sku)}/edit">${I.edit}Edit</a><button class="btn danger" id="del">Delete</button></div>
        </div></div>
      <div class="card pad"><h3 style="margin-bottom:14px">Details</h3><div class="kv">${FIELDS.filter(([k]) => k !== "type" && k !== "status").map(([k, l]) => `<div><div class="k">${l}</div><div class="v">${fmtField(k, p[k])}</div></div>`).join("")}
        <div><div class="k">Last updated</div><div class="v">${when(p.updated_at)}</div></div><div><div class="k">Updated by</div><div class="v">${esc(p.updated_by || "—")}</div></div></div></div>
      <div class="card pad"><h3 style="margin-bottom:6px">Change history</h3><ul class="history" id="hist"><li class="faint">Loading…</li></ul></div>
    </div>
    <div class="card pad qrbox"><h3>QR code</h3><img src="${qrDataURL(qrLink(p.sku), 8)}" alt="QR code for ${esc(p.sku)}">
      <div class="mono">${esc(p.sku)}</div><p class="faint" style="margin:0">Scanning opens this page. The code only holds the SKU, so editing details never needs a new label.</p>
      <div class="row" style="justify-content:center"><button class="btn" id="dl">${I.download}Download PNG</button><button class="btn" id="pr">${I.print}Print</button></div>
      <button class="btn ghost sm" id="cp">Copy link</button></div></div>`);
  $("#dl").onclick = () => downloadLabel(p);
  $("#pr").onclick = () => printLabels([p]);
  $("#cp").onclick = async () => { try { await navigator.clipboard.writeText(qrLink(p.sku)); toast("Link copied"); } catch { toast(qrLink(p.sku)); } };
  $("#del").onclick = async () => {
    if (!(await confirmBox(`Delete ${p.sku}?`, "This removes the product. Any printed QR label for this SKU will show “not found”."))) return;
    const { error } = await sb.from("sku_products").delete().eq("sku", p.sku);
    if (error) return toast(error.message);
    if (p.image_path) sb.storage.from(BUCKET).remove([p.image_path]);
    state.products = state.products.filter((x) => x.sku !== p.sku); toast("Deleted"); go("#/products");
  };
  let pending = 0, timer;
  $$("[data-adj]").forEach((b) => (b.onclick = () => {
    pending += +b.dataset.adj; $("#stk").textContent = num(Math.max(0, p.stock + pending));
    clearTimeout(timer); timer = setTimeout(async () => {
      const next = Math.max(0, p.stock + pending); pending = 0;
      const { data, error } = await sb.from("sku_products").update({ stock: next }).eq("sku", p.sku).select().single();
      if (error) return toast(error.message);
      upsertLocal(data); toast(`Stock set to ${next}`); loadHistory(p.sku);
    }, 700);
  }));
  loadHistory(p.sku);
}
async function loadHistory(sku) {
  const { data, error } = await sb.from("sku_history").select("*").eq("sku", sku).order("changed_at", { ascending: false }).limit(30);
  const el = $("#hist"); if (!el) return;
  if (error) return (el.innerHTML = `<li class="error">${esc(error.message)}</li>`);
  if (!data.length) return (el.innerHTML = '<li class="faint">No changes recorded yet.</li>');
  el.innerHTML = data.map((h) => {
    const ch = h.changes ? Object.entries(h.changes).map(([k, v]) => k === "image_path" ? "Photo changed" : k === "description" ? "Description edited"
      : `${LABELS[k] || k}: ${v.from == null || v.from === "" ? "—" : esc(v.from)} → ${v.to == null || v.to === "" ? "—" : esc(v.to)}`).join(" · ") : "";
    return `<li><strong>${h.action === "created" ? "Created" : h.action === "deleted" ? "Deleted" : "Updated"}</strong> <span class="faint">· ${when(h.changed_at)} · ${esc(h.changed_by || "")}</span>${ch ? `<div class="ch">${ch}</div>` : ""}</li>`;
  }).join("");
}

/* ---------------- add / edit ---------------- */
function nextSku(typeName) {
  const t = typeOf(typeName); if (!t) return "";
  const re = new RegExp("^" + t.prefix + "-(\\d+)$"); let max = 0, width = 4;
  state.products.forEach((p) => { const m = p.sku.match(re); if (m) { max = Math.max(max, +m[1]); width = Math.max(width, m[1].length); } });
  return `${t.prefix}-${String(max + 1).padStart(width, "0")}`;
}
async function resizeImage(file, max = 1400) {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b), "image/webp", 0.85));
}
function viewForm(p, presetType) {
  const isNew = !p;
  if (!isNew && !p) return go("#/products");
  const v = p || { status: "active", stock: 0, type: presetType || (state.type !== "all" && state.type !== "__none" ? state.type : state.types[0]?.name) || null };
  const prefill = state.prefillSku; state.prefillSku = null;
  const inp = (k, label, attrs = "", hint = "") => `<div class="field"><label for="f_${k}">${label}</label><input class="input" id="f_${k}" name="${k}" value="${esc(v[k] ?? "")}" ${attrs}>${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
  const img = imgFor(p);
  app.innerHTML = shell("", `
    <a class="back" href="javascript:history.back()">${I.back}Back</a>
    <div class="page-head"><h1>${isNew ? "Add product" : "Edit " + esc(p.sku)}</h1></div>
    <form id="pf" class="card pad stack" novalidate>
      <div class="section-title">Basics</div>
      <div class="form-grid">
        <div class="field"><label for="f_type">Type</label><select class="input" id="f_type" name="type"><option value="">No type</option>${state.types.map((t) => `<option ${t.name === v.type ? "selected" : ""}>${esc(t.name)}</option>`).join("")}<option value="__new">+ New type…</option></select></div>
        <div class="field"><label for="f_sku">SKU</label><input class="input mono" id="f_sku" name="sku" value="${esc(isNew ? prefill || nextSku(v.type) : p.sku)}" ${isNew ? 'required pattern="[A-Za-z0-9._\\-]{2,40}"' : "readonly"}>
          <span class="hint">${isNew ? "Suggested from the type prefix — you can change it. It can't be changed later, because QR labels point to it." : "SKUs are permanent so printed QR labels keep working."}</span></div>
        <div class="field full"><label for="f_name">Product name</label><input class="input" id="f_name" name="name" required maxlength="200" value="${esc(v.name || "")}" placeholder="e.g. Akoya pearl strand 7–7.5mm"></div>
        ${inp("price", `Price (${CFG.CURRENCY})`, 'type="number" step="0.01" min="0" inputmode="decimal"')}
        ${inp("cost", `Cost (${CFG.CURRENCY})`, 'type="number" step="0.01" min="0" inputmode="decimal"', "Optional, for your reference")}
        ${inp("stock", "Stock on hand", 'type="number" step="1" min="0" inputmode="numeric"')}
        ${inp("reorder_at", "Low-stock alert at", 'type="number" step="1" min="0" inputmode="numeric"', "Flags the product when stock falls to this number")}
      </div>
      <div class="section-title">Photo</div>
      <div class="upload"><div class="thumb" id="pv">${img ? `<img src="${esc(img)}" alt="">` : '<span class="ph">+</span>'}</div>
        <div class="stack" style="gap:6px"><label class="btn" style="width:max-content">Choose photo<input type="file" id="f_img" accept="image/*" hidden></label>
          ${img ? '<button type="button" class="btn ghost sm" id="rmimg" style="width:max-content">Remove photo</button>' : ""}<span class="faint">JPG, PNG or WebP. Resized automatically.</span></div></div>
      <div class="section-title">Details</div>
      <div class="form-grid">
        ${inp("size", "Size", 'placeholder="e.g. 7–7.5mm, 45cm"')}${inp("weight", "Weight", 'placeholder="e.g. 32g"')}
        ${inp("colour", "Colour", 'placeholder="e.g. White rosé"')}${inp("origin", "Origin", 'placeholder="e.g. Japan"')}
        ${inp("location", "Storage location", 'placeholder="e.g. Shelf A3"')}${inp("supplier", "Supplier")}
        <div class="field"><label for="f_status">Status</label><select class="input" id="f_status" name="status"><option value="active">Active</option><option value="discontinued">Discontinued</option></select></div>
        <div class="field full"><label for="f_description">Description / notes</label><textarea class="input" id="f_description" name="description">${esc(v.description || "")}</textarea></div>
      </div>
      <div class="error" id="err"></div>
      <div class="form-actions"><button type="button" class="btn" onclick="history.back()">Cancel</button><button class="btn primary" id="save">${isNew ? "Add product" : "Save changes"}</button></div>
    </form>`);
  $("#f_status").value = v.status || "active";
  let file = null, removeImg = false, skuTouched = !!prefill;
  const typeSel = $("#f_type"), skuIn = $("#f_sku");
  if (isNew) skuIn.oninput = () => (skuTouched = true);
  let lastType = typeSel.value;
  typeSel.onchange = () => {
    if (typeSel.value === "__new") {
      typeSel.value = lastType;
      return typeModal(null, (t) => { typeSel.insertAdjacentHTML("beforeend", ""); const o = new Option(t.name, t.name, true, true); typeSel.insertBefore(o, typeSel.querySelector('[value="__new"]')); lastType = t.name; if (isNew && !skuTouched) skuIn.value = nextSku(t.name); });
    }
    lastType = typeSel.value; if (isNew && !skuTouched) skuIn.value = nextSku(typeSel.value);
  };
  $("#f_img").onchange = (e) => { file = e.target.files[0]; if (!file) return; removeImg = false; $("#pv").innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`; };
  $("#rmimg")?.addEventListener("click", () => { removeImg = true; file = null; $("#pv").innerHTML = '<span class="ph">+</span>'; });

  $("#pf").onsubmit = async (e) => {
    e.preventDefault(); const err = $("#err"); err.textContent = "";
    const fd = Object.fromEntries(new FormData(e.target));
    const sku = (isNew ? fd.sku : p.sku).trim();
    if (!SKU_RE.test(sku)) return (err.textContent = "SKU must be 2–40 characters: letters, numbers, dot, dash or underscore.");
    if (!fd.name.trim()) return (err.textContent = "Product name is required.");
    const n = (x) => (x === "" || x == null ? null : Number(x));
    const row = { name: fd.name.trim(), type: fd.type || null, status: fd.status, price: n(fd.price), cost: n(fd.cost), stock: n(fd.stock) ?? 0, reorder_at: n(fd.reorder_at),
      location: fd.location.trim() || null, supplier: fd.supplier.trim() || null, size: fd.size.trim() || null, weight: fd.weight.trim() || null,
      colour: fd.colour.trim() || null, origin: fd.origin.trim() || null, description: fd.description.trim() || null };
    if (row.stock < 0 || !Number.isInteger(row.stock)) return (err.textContent = "Stock must be a whole number, 0 or more.");
    const btn = $("#save"); btn.disabled = true; btn.textContent = "Saving…";
    try {
      const old = p?.image_path;
      if (file) {
        const blob = await resizeImage(file); const path = `${sku}/${Date.now()}.webp`;
        const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/webp", upsert: false });
        if (error) throw error; row.image_path = path;
      } else if (removeImg) row.image_path = null;
      const q = isNew ? sb.from("sku_products").insert({ sku, ...row }).select().single() : sb.from("sku_products").update(row).eq("sku", sku).select().single();
      const { data, error } = await q;
      if (error) { if (row.image_path) sb.storage.from(BUCKET).remove([row.image_path]); throw error.code === "23505" ? new Error(`SKU ${sku} already exists.`) : error; }
      if (old && (file || removeImg)) sb.storage.from(BUCKET).remove([old]);
      await signImages([data.image_path]); upsertLocal(data);
      toast(isNew ? "Product added" : "Changes saved");
      go("#/p/" + encodeURIComponent(sku));
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = isNew ? "Add product" : "Save changes"; }
  };
}

/* ---------------- scan ---------------- */
function parseScan(text) {
  const t = (text || "").trim();
  try { const u = new URL(t); const h = decodeURIComponent(u.hash.replace(/^#\/?/, ""));
    if (h.startsWith("p/")) return h.slice(2).split("/")[0]; if (h) return h; } catch { /* not a URL */ }
  return t;
}
function viewScan() {
  app.innerHTML = shell("scan", `<div class="scan-wrap">
    <div class="page-head"><div><h1>Scan</h1><p class="muted">Point your camera at a product's QR code.</p></div></div>
    <div class="viewfinder"><video id="vid" playsinline muted></video><div class="frame"></div><div class="msg" id="vmsg">Starting camera…</div></div>
    <div class="row" style="margin-top:12px;justify-content:center"><label class="btn">${I.qr}Scan from photo<input type="file" id="photo" accept="image/*" hidden></label><button class="btn" id="restart" hidden>Scan again</button></div>
    <form class="row" id="man" style="margin-top:12px"><input class="input mono" id="mansku" placeholder="…or type a SKU" style="flex:1"><button class="btn dark">Find</button></form>
    <div class="scan-result" id="res"></div></div>`);
  const vid = $("#vid"), msg = $("#vmsg"), canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true });
  let stream = null, raf = 0, stopped = false;
  const detector = "BarcodeDetector" in window ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
  const stop = () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); stream = null; };
  state.scanStop = stop;
  const found = (text) => {
    stop(); navigator.vibrate?.(60); msg.hidden = false; msg.textContent = "Scanned ✓"; $("#restart").hidden = false;
    showResult(parseScan(text));
  };
  const tick = async () => {
    if (stopped) return;
    if (vid.readyState >= 2) {
      try {
        if (detector) { const codes = await detector.detect(vid); if (codes[0]) return found(codes[0].rawValue); }
        else { const w = 480, h = Math.round((vid.videoHeight / vid.videoWidth) * w) || 480; canvas.width = w; canvas.height = h; ctx.drawImage(vid, 0, 0, w, h);
          const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" }); if (r) return found(r.data); }
      } catch { /* keep scanning */ }
    }
    raf = requestAnimationFrame(tick);
  };
  const start = async () => {
    stopped = false; $("#restart").hidden = true; msg.hidden = false; msg.textContent = "Starting camera…"; $("#res").innerHTML = "";
    if (!navigator.mediaDevices?.getUserMedia) { msg.textContent = "Camera not available in this browser. Use “Scan from photo” or type the SKU."; return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      vid.srcObject = stream; await vid.play(); msg.hidden = true; tick();
    } catch (e) { msg.textContent = e.name === "NotAllowedError" ? "Camera permission was blocked. Allow camera access for this site, or use “Scan from photo”." : "Couldn't start the camera. Use “Scan from photo” or type the SKU."; }
  };
  state.scanStop = stop;
  start();
  $("#restart").onclick = () => { state.scanStop = stop; start(); };
  $("#photo").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return; const bmp = await createImageBitmap(f);
    const s = Math.min(1, 1200 / Math.max(bmp.width, bmp.height)); canvas.width = bmp.width * s; canvas.height = bmp.height * s;
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const r = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
    if (r) found(r.data); else toast("No QR code found in that photo");
    e.target.value = "";
  };
  $("#man").onsubmit = (e) => { e.preventDefault(); const v = $("#mansku").value.trim(); if (v) { stop(); $("#restart").hidden = false; showResult(parseScan(v)); } };
}
function showResult(sku) {
  const el = $("#res"); if (!el) return;
  const p = state.products.find((x) => x.sku.toLowerCase() === sku.toLowerCase());
  if (!p) {
    el.innerHTML = `<div class="card pad stack"><div><span class="faint">Scanned</span><div class="mono" style="font-size:16px">${esc(sku)}</div></div>
      <p class="muted" style="margin:0">No product with this SKU yet.</p>${SKU_RE.test(sku) ? `<button class="btn primary" id="addsc">${I.plus}Add as new product</button>` : ""}</div>`;
    $("#addsc")?.addEventListener("click", () => { state.prefillSku = sku; go("#/new"); });
    return;
  }
  const img = imgFor(p);
  el.innerHTML = `<div class="card pad stack">
    <div class="row" style="flex-wrap:nowrap;align-items:flex-start"><div class="mini-thumb" style="width:72px;height:72px;flex-shrink:0">${img ? `<img src="${esc(img)}" alt="">` : esc(initials(p.name))}</div>
      <div style="min-width:0"><div class="mono faint">${esc(p.sku)}</div><h2 style="margin:2px 0">${esc(p.name)}</h2>
      <div class="row" style="gap:6px"><span class="chip"><span class="dot" style="background:${typeColour(p.type)}"></span>${esc(p.type || "No type")}</span><strong>${money(p.price)}</strong>${p.location ? `<span class="faint">${esc(p.location)}</span>` : ""}</div></div></div>
    <div class="row" style="justify-content:space-between;background:var(--surface-2);border-radius:10px;padding:10px 12px"><span>In stock</span>
      <span class="row" style="gap:6px"><button class="btn sm icon-btn" data-adj="-1" aria-label="Decrease">−</button><strong id="sstk" style="font-size:20px;min-width:44px;text-align:center">${num(p.stock)}</strong><button class="btn sm icon-btn" data-adj="1" aria-label="Increase">+</button></span></div>
    <div class="row"><a class="btn dark" href="#/p/${encodeURIComponent(p.sku)}" style="flex:1">View details</a><a class="btn" href="#/p/${encodeURIComponent(p.sku)}/edit" style="flex:1">${I.edit}Edit</a></div></div>`;
  let pending = 0, timer;
  $$("[data-adj]", el).forEach((b) => (b.onclick = () => {
    pending += +b.dataset.adj; $("#sstk").textContent = num(Math.max(0, p.stock + pending));
    clearTimeout(timer); timer = setTimeout(async () => {
      const next = Math.max(0, p.stock + pending); pending = 0;
      const { data, error } = await sb.from("sku_products").update({ stock: next }).eq("sku", p.sku).select().single();
      if (error) return toast(error.message); upsertLocal(data); Object.assign(p, data); toast(`Stock set to ${next}`);
    }, 700);
  }));
}

/* ---------------- settings & CSV ---------------- */
const CSV_COLS = ["sku", "name", "type", "status", "price", "cost", "stock", "reorder_at", "location", "supplier", "size", "weight", "colour", "origin", "description"];
function toCSV(rows) {
  const cell = (v) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [CSV_COLS.join(","), ...rows.map((r) => CSV_COLS.map((c) => cell(r[c])).join(","))].join("\r\n");
}
function parseCSV(text) {
  const rows = []; let row = [], cur = "", q = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return rows.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()])));
}
function download(name, text, type = "text/csv") { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + text], { type })); a.download = name; a.click(); }

function viewSettings() {
  app.innerHTML = shell("settings", `
    <div class="page-head"><div><h1>Settings</h1><p class="muted">Signed in as ${esc(state.session.user.email)}</p></div></div>
    <div class="stack" style="max-width:720px">
      <div class="card pad stack"><h2>Import products from CSV</h2>
        <p class="muted" style="margin:0">Columns: <span class="mono">${CSV_COLS.join(", ")}</span>. Only <span class="mono">sku</span> and <span class="mono">name</span> are required. Rows with an existing SKU update that product. Unknown types are created automatically.</p>
        <div class="row"><label class="btn dark">Choose CSV file<input type="file" id="csv" accept=".csv,text/csv" hidden></label><button class="btn" id="tmpl">${I.download}Download template</button></div>
        <div id="imp"></div></div>
      <div class="card pad stack"><h2>Export</h2><p class="muted" style="margin:0">${num(state.products.length)} products.</p>
        <div class="row"><button class="btn" id="exp">${I.download}Export all as CSV</button><button class="btn" id="labels">${I.print}Print every QR label</button></div></div>
      <div class="card pad stack"><h2>QR link</h2><p class="muted" style="margin:0">Every QR code opens <span class="mono">${esc(qrBase())}#/p/&lt;SKU&gt;</span>. This is set in <span class="mono">config.js</span> — keep it the same once labels are printed.</p></div>
      <div class="card pad stack"><h2>Account</h2><div class="row"><button class="btn" id="pw">Change password</button><button class="btn danger" id="out">Sign out</button></div></div>
    </div>`);
  $("#tmpl").onclick = () => download("yz-sku-template.csv", toCSV([{ sku: "PRL-0001", name: "Akoya pearl strand 7mm", type: "Pearls", status: "active", price: 880, stock: 4, reorder_at: 1, location: "Shelf A1" }]));
  $("#exp").onclick = () => download(`yz-sku-export-${new Date().toISOString().slice(0, 10)}.csv`, toCSV([...state.products].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }))));
  $("#labels").onclick = () => { if (state.products.length > 600 && !confirm(`Print ${state.products.length} labels?`)) return; printLabels([...state.products].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true }))); };
  $("#out").onclick = () => sb.auth.signOut();
  $("#pw").onclick = () => modal(`<form id="cpf" class="stack"><h2>Change password</h2>
      <div class="field"><label for="np">New password</label><input class="input" id="np" type="password" minlength="8" autocomplete="new-password" required></div>
      <div class="error" id="cperr"></div><div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary">Save</button></div></form>`,
    (m, close) => { $("#cpf", m).onsubmit = async (e) => { e.preventDefault(); const { error } = await sb.auth.updateUser({ password: $("#np", m).value }); if (error) $("#cperr", m).textContent = error.message; else { close(); toast("Password changed"); } }; });
  $("#csv").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return; e.target.value = "";
    const out = $("#imp"); const rows = parseCSV(await f.text());
    const errors = []; const recs = [];
    const toNum = (x) => (x === "" || x == null ? null : Number(String(x).replace(/[^0-9.\-]/g, "")));
    rows.forEach((r, i) => {
      const sku = (r.sku || "").trim();
      if (!SKU_RE.test(sku)) return errors.push(`Row ${i + 2}: invalid SKU “${sku}”`);
      if (!r.name) return errors.push(`Row ${i + 2}: missing name`);
      const rec = { sku, name: r.name };
      ["type", "location", "supplier", "size", "weight", "colour", "origin", "description"].forEach((k) => { if (k in r) rec[k] = r[k] || null; });
      ["price", "cost", "reorder_at"].forEach((k) => { if (k in r) rec[k] = toNum(r[k]); });
      if ("stock" in r) rec.stock = Math.max(0, Math.round(toNum(r.stock) || 0));
      if ("status" in r) rec.status = /disc/i.test(r.status) ? "discontinued" : "active";
      recs.push(rec);
    });
    const dupes = recs.length - new Set(recs.map((r) => r.sku)).size;
    if (dupes) errors.push(`${dupes} duplicate SKU row(s) in file — the last one wins.`);
    const bySku = new Map(recs.map((r) => [r.sku, r]));
    const list = [...bySku.values()];
    const newTypes = [...new Set(list.map((r) => r.type).filter((t) => t && !typeOf(t)))];
    const updates = list.filter((r) => state.products.some((p) => p.sku === r.sku)).length;
    out.innerHTML = `<div class="card pad stack" style="background:var(--surface-2);box-shadow:none"><strong>${num(list.length)} products ready</strong>
      <span class="muted">${num(list.length - updates)} new · ${num(updates)} updates${newTypes.length ? ` · new types: ${newTypes.map(esc).join(", ")}` : ""}</span>
      ${errors.length ? `<div class="error">${errors.slice(0, 8).map(esc).join("<br>")}${errors.length > 8 ? `<br>…and ${errors.length - 8} more` : ""}</div>` : ""}
      <div class="row"><button class="btn primary" id="go" ${list.length ? "" : "disabled"}>Import ${num(list.length)}</button></div></div>`;
    $("#go").onclick = async () => {
      const btn = $("#go"); btn.disabled = true;
      try {
        for (const name of newTypes) {
          const { data, error } = await sb.from("sku_types").insert({ name, prefix: suggestPrefix(name), colour: SWATCHES[state.types.length % SWATCHES.length], sort: state.types.length + 1 }).select().single();
          if (error) throw error; state.types.push(data);
        }
        // group by column set so partial CSVs don't blank out columns they don't include
        const groups = new Map(); list.forEach((r) => { const k = Object.keys(r).sort().join(","); (groups.get(k) || groups.set(k, []).get(k)).push(r); });
        let done = 0;
        for (const grp of groups.values()) for (let i = 0; i < grp.length; i += 500) {
          const { data, error } = await sb.from("sku_products").upsert(grp.slice(i, i + 500), { onConflict: "sku" }).select();
          if (error) throw error; data.forEach(upsertLocal); done += data.length; btn.textContent = `Imported ${done}…`;
        }
        toast(`Imported ${done} products`); out.innerHTML = `<p class="muted">Imported ${num(done)} products.</p>`;
      } catch (ex) { btn.disabled = false; btn.textContent = "Retry import"; out.insertAdjacentHTML("beforeend", `<div class="error">${esc(ex.message)}</div>`); }
    };
  };
}

/* ---------------- boot ---------------- */
async function loadAdmin() {
  const email = state.session?.user?.email;
  if (!email) { state.admin = null; return; }
  const { data } = await sb.from("sku_admins").select("*").ilike("email", email).maybeSingle();
  state.admin = data || null;
}
window.addEventListener("hashchange", render);
sb.auth.onAuthStateChange((event, session) => {
  const was = state.session?.user?.id; state.session = session;
  if (event === "SIGNED_OUT") { state.admin = null; state.loaded = false; state.products = []; state.img = {}; render(); return; }
  if (event === "SIGNED_IN" && was !== session?.user?.id) setTimeout(async () => { await loadAdmin(); render(); }, 0);
});
(async () => {
  app.innerHTML = '<div class="spinner"></div>';
  const { data } = await sb.auth.getSession(); state.session = data.session;
  await loadAdmin(); render();
})();
})();
