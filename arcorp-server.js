// AR Corp HR — lapisan koneksi server (Supabase REST, tanpa SDK).
// Dipakai oleh "AR Corp HR.dc.html". Tidak ada npm, tidak ada build step.
// Konfigurasi disimpan di localStorage: admin menempel URL + anon key sekali saja.

(function(){
'use strict';
const CFG_KEY = 'arcorp-server-cfg-v1';

const SCHEMA_SQL = `-- ══════════════════════════════════════════════════
-- AR CORP HR · skema database
-- Tempel seluruh isi ini ke Supabase → SQL Editor → Run
-- ══════════════════════════════════════════════════

create table if not exists ar_employees (
  id          text primary key,
  code        text,
  name        text not null,
  level       text,
  role        text,
  email       text unique,
  phone       text,
  place       text,
  supervisor  text,
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists ar_attendance (
  id          bigserial primary key,
  emp_id      text references ar_employees(id),
  emp_name    text,
  lat         double precision,
  lng         double precision,
  distance_km numeric,
  in_radius   boolean,
  place       text,
  device      text,
  at          timestamptz default now()
);

create table if not exists ar_vouchers (
  id          bigserial primary key,
  code        text unique,
  emp_id      text references ar_employees(id),
  emp_name    text,
  category    text check (category in ('Silver','Platinum','Jasmine')),
  client      text,
  amount      numeric not null,
  status      text default 'Menunggu',
  at          timestamptz default now()
);

create table if not exists ar_kasbon (
  id          bigserial primary key,
  emp_id      text references ar_employees(id),
  emp_name    text,
  amount      numeric not null,
  reason      text,
  status      text default 'Menunggu',
  decided_by  text,
  decided_at  timestamptz,
  at          timestamptz default now()
);

create table if not exists ar_chats (
  id          bigserial primary key,
  emp_id      text references ar_employees(id),
  from_side   text check (from_side in ('karyawan','supervisor')),
  text        text not null,
  at          timestamptz default now()
);

create index if not exists ar_att_at   on ar_attendance (at desc);
create index if not exists ar_vou_at   on ar_vouchers  (at desc);
create index if not exists ar_kas_at   on ar_kasbon    (at desc);
create index if not exists ar_cht_at   on ar_chats     (at desc);

-- ── Akses ─────────────────────────────────────────
-- Aplikasi internal tanpa login Supabase: anon key diberi izin baca-tulis.
-- Cukup untuk pemakaian internal. Untuk keamanan lebih ketat, aktifkan
-- Supabase Auth lalu ganti "true" di bawah dengan aturan per-pengguna.

alter table ar_employees  enable row level security;
alter table ar_attendance enable row level security;
alter table ar_vouchers   enable row level security;
alter table ar_kasbon     enable row level security;
alter table ar_chats      enable row level security;

do $$
declare tb text;
begin
  foreach tb in array array['ar_employees','ar_attendance','ar_vouchers','ar_kasbon','ar_chats'] loop
    execute format('drop policy if exists ar_all on %I', tb);
    execute format('create policy ar_all on %I for all using (true) with check (true)', tb);
  end loop;
end $$;
`;

function loadCfg(){
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || { url:'', key:'' }; }
  catch(e){ return { url:'', key:'' }; }
}
function saveCfg(cfg){
  const clean = { url: String(cfg.url || '').trim().replace(/\/+$/, ''), key: String(cfg.key || '').trim() };
  localStorage.setItem(CFG_KEY, JSON.stringify(clean));
  return clean;
}
function clearCfg(){ localStorage.removeItem(CFG_KEY); }
function isConfigured(){ const c = loadCfg(); return !!(c.url && c.key); }

function headers(cfg, extra){
  return Object.assign({
    'apikey': cfg.key,
    'Authorization': 'Bearer ' + cfg.key,
    'Content-Type': 'application/json'
  }, extra || {});
}

async function req(path, init){
  const cfg = loadCfg();
  if (!cfg.url || !cfg.key) throw new Error('Server belum diatur.');
  const res = await fetch(cfg.url + '/rest/v1/' + path, Object.assign({}, init, {
    headers: headers(cfg, init && init.headers)
  }));
  if (!res.ok){
    let msg = res.status + ' ' + res.statusText;
    try { const j = await res.json(); if (j.message) msg = j.message; if (j.hint) msg += ' — ' + j.hint; } catch(e){}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

async function testConnection(cfg){
  const saved = loadCfg();
  if (cfg) saveCfg(cfg);
  try {
    const rows = await req('ar_employees?select=id&limit=1');
    return { ok:true, message:'Tersambung. Tabel terbaca.', rows: Array.isArray(rows) ? rows.length : 0 };
  } catch (e){
    if (!cfg) throw e;
    saveCfg(saved);
    const m = String(e.message || e);
    let hint = m;
    if (/Failed to fetch|NetworkError/i.test(m)) hint = 'Tidak bisa menghubungi server. Periksa URL project (harus https://xxxx.supabase.co).';
    else if (/Invalid API key|JWT/i.test(m)) hint = 'Anon key salah. Ambil dari Supabase → Settings → API → anon public.';
    else if (/does not exist|relation/i.test(m)) hint = 'Tersambung, tapi tabel belum ada. Jalankan SQL skema dulu di SQL Editor.';
    return { ok:false, message: hint };
  }
}

const sel = (tb, q) => req(tb + '?select=*' + (q || ''));

const pull = {
  employees:  () => sel('ar_employees', '&active=is.true&order=code.asc'),
  attendance: (n = 60)  => sel('ar_attendance', '&order=at.desc&limit=' + n),
  vouchers:   (n = 400) => sel('ar_vouchers',   '&order=at.desc&limit=' + n),
  kasbon:     (n = 80)  => sel('ar_kasbon',     '&order=at.desc&limit=' + n),
  chats:      (empId, n = 80) => sel('ar_chats', (empId ? '&emp_id=eq.' + encodeURIComponent(empId) : '') + '&order=at.asc&limit=' + n)
};

function insert(table, row){
  return req(table, { method:'POST', headers:{ 'Prefer':'return=representation' }, body: JSON.stringify(row) });
}
function patch(table, id, row){
  return req(table + '?id=eq.' + encodeURIComponent(id), { method:'PATCH', headers:{ 'Prefer':'return=representation' }, body: JSON.stringify(row) });
}

const push = {
  employees: rows => req('ar_employees', {
    method:'POST',
    headers:{ 'Prefer':'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(rows)
  }),
  attendance: r => insert('ar_attendance', r),
  voucher:    r => insert('ar_vouchers', r),
  kasbon:     r => insert('ar_kasbon', r),
  chat:       r => insert('ar_chats', r),
  decideKasbon: (id, status, by) => patch('ar_kasbon', id, { status, decided_by: by, decided_at: new Date().toISOString() }),
  payVoucher:   (id) => patch('ar_vouchers', id, { status:'Dicairkan' }),
  updateVoucher: (id, row) => patch('ar_vouchers', id, row),
  deleteVoucher: (id) => req('ar_vouchers?id=eq.' + encodeURIComponent(id), { method:'DELETE' })
};

// Antrean offline: aksi yang gagal terkirim disimpan, dicoba lagi saat online.
const Q_KEY = 'arcorp-server-queue-v1';
function readQ(){ try { return JSON.parse(localStorage.getItem(Q_KEY)) || []; } catch(e){ return []; } }
function writeQ(q){ try { localStorage.setItem(Q_KEY, JSON.stringify(q.slice(-200))); } catch(e){} }

function queueSize(){ return readQ().length; }

async function send(kind, payload){
  if (!isConfigured()) return { ok:false, offline:true };
  try {
    const fn = kind === 'attendance' ? push.attendance
      : kind === 'kasbon'  ? push.kasbon
      : kind === 'chat'    ? push.chat
      : kind === 'voucher' ? push.voucher
      : null;
    if (!fn) throw new Error('Aksi tidak dikenal: ' + kind);
    const out = await fn(payload);
    return { ok:true, data: out };
  } catch (e){
    const q = readQ(); q.push({ kind, payload, at: Date.now() }); writeQ(q);
    return { ok:false, queued:true, error: String(e.message || e) };
  }
}

async function flushQueue(){
  if (!isConfigured()) return { sent:0, left: queueSize() };
  const q = readQ(); if (!q.length) return { sent:0, left:0 };
  const left = []; let sent = 0;
  for (const item of q){
    try { await send(item.kind, item.payload); sent++; }
    catch(e){ left.push(item); }
  }
  writeQ(left);
  return { sent, left: left.length };
}

window.ARServer = {
  SCHEMA_SQL, loadCfg, saveCfg, clearCfg, isConfigured,
  testConnection, pull, push, send, flushQueue, queueSize
};
window.dispatchEvent(new Event('arserver-ready'));
})();
