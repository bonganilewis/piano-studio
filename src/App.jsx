import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://vkorvzgfdykubtlxtytu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrb3J2emdmZHlrdWJ0bHh0eXR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MjY1NTAsImV4cCI6MjA5MzUwMjU1MH0.n4ttTsvPLu3RC5KXQam-Lal2DxJeeCgirc4p4CTivhk";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Date/Week helpers ────────────────────────────────────────────────────────
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const BILLING_LABELS = { "per-lesson": "Per Lesson", weekly: "Weekly", monthly: "Monthly" };

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `${d.getUTCFullYear()}-W${String(Math.ceil((((d - yearStart) / 86400000) + 1) / 7)).padStart(2,"0")}`;
}

function weekToDate(isoWeek) {
  const [year, w] = isoWeek.split("-W");
  const jan1 = new Date(Date.UTC(+year, 0, 1));
  const dayOfWeek = jan1.getUTCDay() || 7;
  const offset = (1 - dayOfWeek) + (+w - 1) * 7;
  return new Date(jan1.getTime() + offset * 86400000);
}

function weekLabel(isoWeek) {
  const start = weekToDate(isoWeek);
  const end = new Date(start.getTime() + 6 * 86400000);
  const fmt = d => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

function currentWeek() { return getISOWeek(new Date()); }

function shiftWeek(isoWeek, delta) {
  const d = weekToDate(isoWeek);
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return getISOWeek(d);
}

function venmoLink(handle, amount, note) {
  const h = handle.replace(/^@/, "");
  return `https://venmo.me/${h}/${amount}?note=${encodeURIComponent(note)}`;
}

function amountDue(student, attended) {
  if (!attended) return 0;
  return parseFloat(student.rate) || 0;
}

function upcomingBirthday(birthday) {
  if (!birthday) return null;
  const today = new Date();
  const [, m, d] = birthday.split("-");
  let bd = new Date(today.getFullYear(), +m - 1, +d);
  if (bd < today) bd = new Date(today.getFullYear() + 1, +m - 1, +d);
  const days = Math.round((bd - today) / 86400000);
  return days <= 30 ? { days, date: bd } : null;
}

// ── Inline SVG Icons ─────────────────────────────────────────────────────────
const Ico = {
  piano:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 4v16M12 4v10M17 4v16M2 14h5M12 14h5"/></svg>,
  user:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  dollar:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  check:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>,
  x:       <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  edit:    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  trash:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>,
  plus:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>,
  cog:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  chevL:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>,
  chevR:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>,
  venmo:   <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.5 2c.8 1.3 1.2 2.7 1.2 4.5 0 5.6-4.8 12.9-8.7 18H4.8L2 3.6l6.3-.6 1.6 12.9c1.5-2.5 3.3-6.4 3.3-9.1 0-1.5-.3-2.5-.7-3.3L19.5 2z"/></svg>,
  ban:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>,
  cake:    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v2M12 8v2M17 8v2M7 4l.5 4M12 2l.5 6M17 4l.5 4"/></svg>,
  history: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/></svg>,
};

// ── Global CSS ───────────────────────────────────────────────────────────────
const STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Nunito:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#f5f0eb;
  --surface:#fffdf9;
  --surface2:#f9f4ee;
  --ink:#1c1510;
  --ink2:#5c4f44;
  --ink3:#9c8f84;
  --gold:#b8912a;
  --gold-l:#e8d5a3;
  --gold-p:#faf3e0;
  --rust:#c0442a;
  --sage:#4a7a52;
  --sky:#2d7dd2;
  --border:#e2d9ce;
  --rad:14px;
  --rad-s:8px;
  --sh:0 2px 16px rgba(28,21,16,.07);
  --sh-l:0 8px 40px rgba(28,21,16,.13);
}
body{font-family:'Nunito',sans-serif;background:var(--bg);color:var(--ink);font-size:14px;line-height:1.6}
.serif{font-family:'Playfair Display',serif}

/* Layout */
.shell{display:flex;flex-direction:column;min-height:100vh}
.topbar{background:var(--ink);color:#fff;height:54px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;position:sticky;top:0;z-index:99}
.topbar-brand{display:flex;align-items:center;gap:10px;font-family:'Playfair Display',serif;font-size:19px;color:var(--gold-l)}
.topbar-week{font-size:11px;color:var(--ink3);background:rgba(255,255,255,.08);padding:3px 10px;border-radius:20px;letter-spacing:.04em}

.tabs{background:var(--surface);border-bottom:1px solid var(--border);display:flex;overflow-x:auto;scrollbar-width:none;padding:0 14px;gap:2px}
.tabs::-webkit-scrollbar{display:none}
.tab{display:flex;align-items:center;gap:6px;padding:11px 14px;border:none;background:none;font-family:'Nunito',sans-serif;font-size:13px;font-weight:500;color:var(--ink3);cursor:pointer;white-space:nowrap;border-bottom:2px solid transparent;transition:.15s;margin-bottom:-1px}
.tab:hover{color:var(--ink)}
.tab.on{color:var(--gold);border-bottom-color:var(--gold)}

.main{flex:1;padding:18px 14px;max-width:820px;margin:0 auto;width:100%}

/* Cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--rad);padding:20px;margin-bottom:14px;box-shadow:var(--sh)}
.card-head{font-family:'Playfair Display',serif;font-size:18px;margin-bottom:16px;display:flex;align-items:center;gap:8px;color:var(--ink)}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 15px;border-radius:var(--rad-s);border:none;font-family:'Nunito',sans-serif;font-size:13px;font-weight:600;cursor:pointer;transition:.15s;text-decoration:none;white-space:nowrap}
.btn-dk{background:var(--ink);color:#fff}.btn-dk:hover{background:#2e261e}
.btn-go{background:var(--gold);color:#fff}.btn-go:hover{background:#a07a20}
.btn-gh{background:transparent;border:1px solid var(--border);color:var(--ink2)}.btn-gh:hover{background:var(--gold-p);border-color:var(--gold-l)}
.btn-re{background:transparent;border:1px solid #f0c8c8;color:var(--rust)}.btn-re:hover{background:#fdf0ee}
.btn-sky{background:var(--sky);color:#fff}.btn-sky:hover{background:#235faa}
.btn-sm{padding:5px 10px;font-size:12px}
.btn-ic{padding:5px;border-radius:6px}
.btn:disabled{opacity:.45;cursor:not-allowed}

/* Forms */
.field{margin-bottom:12px}
.lbl{display:block;font-size:11px;font-weight:600;color:var(--ink3);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px}
.inp,.sel,.txa{width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:var(--rad-s);background:var(--surface2);font-family:'Nunito',sans-serif;font-size:14px;color:var(--ink);transition:border-color .15s;appearance:none}
.inp:focus,.sel:focus,.txa:focus{outline:none;border-color:var(--gold);background:var(--surface)}
.sel{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239c8f84' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px}
.txa{resize:vertical;min-height:70px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}

/* Student rows */
.s-row{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border:1px solid var(--border);border-radius:var(--rad-s);margin-bottom:8px;background:var(--surface2);transition:box-shadow .15s}
.s-row:hover{box-shadow:var(--sh)}
.av{width:38px;height:38px;border-radius:50%;background:var(--gold-p);border:1.5px solid var(--gold-l);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:16px;font-weight:600;color:var(--gold);flex-shrink:0}
.s-info{flex:1;min-width:0}
.s-name{font-weight:600;font-size:14px}
.s-meta{font-size:12px;color:var(--ink3);margin-top:2px}
.s-acts{display:flex;gap:5px;align-items:center;flex-shrink:0}

/* Week nav */
.wk-nav{display:flex;align-items:center;gap:10px;margin-bottom:16px;background:var(--surface);border:1px solid var(--border);border-radius:var(--rad-s);padding:10px 14px}
.wk-lbl{flex:1;text-align:center;font-family:'Playfair Display',serif;font-size:17px;color:var(--ink)}
.wk-cur{font-size:11px;color:var(--gold);margin-left:8px;font-family:'Nunito',sans-serif}

/* Attendance */
.att-wrap{display:flex;border:1px solid var(--border);border-radius:var(--rad-s);overflow:hidden;flex-shrink:0}
.att-btn{flex:1;padding:5px 10px;border:none;background:var(--surface2);font-size:12px;font-family:'Nunito',sans-serif;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:4px;transition:.12s}
.att-btn+.att-btn{border-left:1px solid var(--border)}
.att-btn.yes{background:#e8f5e9;color:var(--sage)}
.att-btn.no{background:#fdecea;color:var(--rust)}
.att-btn.dim{color:var(--ink3)}

/* Pay selector */
.pay-sel{padding:5px 8px;border:1px solid var(--border);border-radius:var(--rad-s);font-size:12px;font-family:'Nunito',sans-serif;font-weight:600;background:var(--surface2);color:var(--ink);cursor:pointer}

/* Badges */
.badge{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600}
.b-paid{background:#e8f5e9;color:var(--sage)}
.b-unpaid{background:#fff3e0;color:#b06000}
.b-cash{background:#e3f2fd;color:#1a5fa8}
.b-waived{background:#f5f5f5;color:var(--ink3)}
.b-cancel{background:#fdecea;color:var(--rust)}
.b-inactive{background:#eee;color:var(--ink3)}

/* Stats */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px}
.stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--rad-s);padding:14px;text-align:center}
.stat-v{font-family:'Playfair Display',serif;font-size:28px;color:var(--ink)}
.stat-l{font-size:11px;color:var(--ink3);text-transform:uppercase;letter-spacing:.06em;margin-top:2px}

/* Modal */
.overlay{position:fixed;inset:0;background:rgba(28,21,16,.5);display:flex;align-items:flex-end;justify-content:center;z-index:200}
@media(min-width:560px){.overlay{align-items:center;padding:20px}}
.modal{background:var(--surface);border-radius:var(--rad) var(--rad) 0 0;padding:22px 18px;width:100%;max-width:540px;max-height:92vh;overflow-y:auto}
@media(min-width:560px){.modal{border-radius:var(--rad)}}
.modal-ttl{font-family:'Playfair Display',serif;font-size:21px;margin-bottom:18px;color:var(--ink)}
.modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;padding-top:14px;border-top:1px solid var(--border)}

/* Misc */
.cancel-banner{background:#fdecea;border:1px solid #f5b8b8;border-radius:var(--rad-s);padding:10px 14px;color:var(--rust);font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.empty{text-align:center;padding:36px 20px;color:var(--ink3)}
.empty-ico{font-size:34px;margin-bottom:10px}
.divider{height:1px;background:var(--border);margin:14px 0}
.note-box{background:var(--gold-p);border:1px solid var(--gold-l);border-radius:var(--rad-s);padding:9px 13px;font-size:12px;color:var(--ink2);font-style:italic;margin-top:6px}
.toggle-wrap{display:flex;align-items:center;gap:10px}
.tog{position:relative;width:40px;height:22px}
.tog input{opacity:0;width:0;height:0;position:absolute}
.tog-sl{position:absolute;inset:0;background:#ccc;border-radius:22px;cursor:pointer;transition:.2s}
.tog-sl::before{content:'';position:absolute;width:16px;height:16px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.2s}
.tog input:checked+.tog-sl{background:var(--gold)}
.tog input:checked+.tog-sl::before{transform:translateX(18px)}
.spinner{display:inline-block;width:18px;height:18px;border:2px solid var(--border);border-top-color:var(--gold);border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.fade-in{animation:fadeIn .25s ease}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600;padding:6px 10px;border-bottom:1px solid var(--border)}
.tbl td{padding:8px 10px;border-bottom:1px solid var(--border);color:var(--ink2)}
.tbl tr:last-child td{border-bottom:none}
.venmo-row{background:#f0f7ff;border:1px solid #b8d8f0;border-radius:var(--rad-s);padding:10px 13px;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px}
.toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--ink);color:#fff;padding:10px 20px;border-radius:30px;font-size:13px;font-weight:600;z-index:999;animation:fadeIn .2s ease}
`;

// ── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState(null);
  const show = useCallback((m) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 2500);
  }, []);
  return { msg, show };
}

// ── StudentForm ──────────────────────────────────────────────────────────────
const BLANK = { name:"", parent_name:"", phone:"", email:"", lesson_day:1, lesson_time:"16:00", rate:"", billing_type:"weekly", level:"", notes:"", venmo_name:"", birthday:"", active:true };

function StudentForm({ initial, onSave, onCancel, saving }) {
  const [f, setF] = useState({ ...BLANK, ...(initial || {}) });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <div>
      <div className="g2">
        <div className="field"><label className="lbl">Student Name *</label><input className="inp" value={f.name} onChange={e => set("name", e.target.value)} placeholder="First Last" /></div>
        <div className="field"><label className="lbl">Parent / Guardian</label><input className="inp" value={f.parent_name} onChange={e => set("parent_name", e.target.value)} placeholder="Parent name" /></div>
      </div>
      <div className="g2">
        <div className="field"><label className="lbl">Phone</label><input className="inp" type="tel" value={f.phone} onChange={e => set("phone", e.target.value)} placeholder="(555) 000-0000" /></div>
        <div className="field"><label className="lbl">Email</label><input className="inp" type="email" value={f.email} onChange={e => set("email", e.target.value)} placeholder="email@example.com" /></div>
      </div>
      <div className="g3">
        <div className="field"><label className="lbl">Lesson Day</label>
          <select className="sel" value={f.lesson_day} onChange={e => set("lesson_day", +e.target.value)}>
            {DAYS.map((d,i) => <option key={i} value={i}>{d}</option>)}
          </select>
        </div>
        <div className="field"><label className="lbl">Time</label><input className="inp" type="time" value={f.lesson_time} onChange={e => set("lesson_time", e.target.value)} /></div>
        <div className="field"><label className="lbl">Level</label><input className="inp" value={f.level} onChange={e => set("level", e.target.value)} placeholder="Beginner, Book 3…" /></div>
      </div>
      <div className="g3">
        <div className="field"><label className="lbl">Rate ($)</label><input className="inp" type="number" value={f.rate} onChange={e => set("rate", e.target.value)} placeholder="0.00" /></div>
        <div className="field"><label className="lbl">Billing</label>
          <select className="sel" value={f.billing_type} onChange={e => set("billing_type", e.target.value)}>
            <option value="per-lesson">Per Lesson</option>
            <option value="weekly">Weekly Flat</option>
            <option value="monthly">Monthly Flat</option>
          </select>
        </div>
        <div className="field"><label className="lbl">Birthday</label><input className="inp" type="date" value={f.birthday || ""} onChange={e => set("birthday", e.target.value)} /></div>
      </div>
      <div className="field"><label className="lbl">Venmo Username (theirs)</label><input className="inp" value={f.venmo_name} onChange={e => set("venmo_name", e.target.value)} placeholder="@parentusername" /></div>
      <div className="field"><label className="lbl">Notes / Repertoire</label><textarea className="txa" value={f.notes} onChange={e => set("notes", e.target.value)} placeholder="Current book, goals, parent notes…" /></div>
      <div className="field">
        <div className="toggle-wrap">
          <label className="tog"><input type="checkbox" checked={f.active} onChange={e => set("active", e.target.checked)} /><span className="tog-sl" /></label>
          <span style={{fontSize:13,color:"var(--ink2)"}}>Active student</span>
        </div>
      </div>
      <div className="modal-foot">
        <button className="btn btn-gh" onClick={onCancel} disabled={saving}>Cancel</button>
        <button className="btn btn-dk" onClick={() => f.name.trim() && onSave(f)} disabled={saving || !f.name.trim()}>
          {saving ? <><span className="spinner" />&nbsp;Saving…</> : "Save Student"}
        </button>
      </div>
    </div>
  );
}

// ── Dashboard tab ────────────────────────────────────────────────────────────
function Dashboard({ students, records, cancelledWeeks, settings, week, setWeek, onToggleCancel, onSetAttendance, onSetPayment, loading }) {
  const cw = currentWeek();
  const isCancelled = cancelledWeeks.includes(week);
  const active = students.filter(s => s.active);

  const getRecord = s => records.find(r => r.student_id === s.id && r.week === week);

  const presentCount = active.filter(s => getRecord(s)?.attended === true).length;
  const totalDue = active.reduce((acc, s) => {
    const r = getRecord(s);
    return acc + amountDue(s, r?.attended === true);
  }, 0);
  const unpaidCount = active.filter(s => {
    const r = getRecord(s);
    const due = amountDue(s, r?.attended === true);
    return due > 0 && (!r?.payment_status || r.payment_status === "unpaid");
  }).length;

  return (
    <div className="fade-in">
      {/* Week nav */}
      <div className="wk-nav">
        <button className="btn btn-gh btn-sm btn-ic" onClick={() => setWeek(shiftWeek(week,-1))}>{Ico.chevL}</button>
        <div className="wk-lbl">{weekLabel(week)}{week===cw&&<span className="wk-cur">● This Week</span>}</div>
        <button className="btn btn-gh btn-sm btn-ic" onClick={() => setWeek(shiftWeek(week,1))}>{Ico.chevR}</button>
      </div>

      {/* Stats */}
      <div className="stats">
        <div className="stat"><div className="stat-v">{active.length}</div><div className="stat-l">Students</div></div>
        <div className="stat"><div className="stat-v">{isCancelled?"—":presentCount}</div><div className="stat-l">Attended</div></div>
        <div className="stat"><div className="stat-v" style={{color:unpaidCount>0?"var(--rust)":"var(--sage)"}}>{isCancelled?"—":unpaidCount}</div><div className="stat-l">Unpaid</div></div>
        <div className="stat"><div className="stat-v">${isCancelled?0:totalDue.toFixed(0)}</div><div className="stat-l">Revenue</div></div>
      </div>

      {isCancelled && (
        <div className="cancel-banner">
          <span>{Ico.ban}&nbsp; Lessons cancelled this week — no payments due</span>
          <button className="btn btn-gh btn-sm" onClick={onToggleCancel}>Uncancel</button>
        </div>
      )}

      {!isCancelled && (
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:14}}>
          <button className="btn btn-re btn-sm" onClick={onToggleCancel}>{Ico.ban} Cancel This Week</button>
          <span style={{fontSize:12,color:"var(--ink3)"}}>Removes all payment obligations</span>
        </div>
      )}

      {loading && <div style={{textAlign:"center",padding:30}}><span className="spinner"/></div>}

      {!loading && active.length === 0 && (
        <div className="empty"><div className="empty-ico">🎹</div><div>No active students yet — add one in the Students tab.</div></div>
      )}

      {!loading && active.map(s => {
        const rec = getRecord(s);
        const attended = rec?.attended;
        const payStatus = rec?.payment_status || "unpaid";
        const due = amountDue(s, attended === true);
        const showVenmo = !isCancelled && attended === true && payStatus === "unpaid" && due > 0 && settings?.venmo_handle;

        return (
          <div key={s.id} className="s-row" style={{flexWrap:"wrap",gap:10}}>
            <div className="av">{s.name.charAt(0)}</div>
            <div className="s-info">
              <div className="s-name">{s.name}</div>
              <div className="s-meta">{DAYS[s.lesson_day]} {s.lesson_time} · ${s.rate} {BILLING_LABELS[s.billing_type]}</div>
              {s.notes && <div className="note-box">{s.notes}</div>}

              {showVenmo && (
                <div className="venmo-row">
                  <div>
                    <div style={{fontSize:12,color:"var(--sky)",fontWeight:600}}>Payment Request</div>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#1a4a72"}}>${due.toFixed(2)}</div>
                  </div>
                  <a className="btn btn-sky btn-sm" href={venmoLink(settings.venmo_handle, due, `Piano - ${s.name}`)} target="_blank" rel="noopener noreferrer">
                    {Ico.venmo} Open Venmo
                  </a>
                </div>
              )}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:6,alignItems:"flex-end",flexShrink:0}}>
              {!isCancelled ? (
                <>
                  <div className="att-wrap">
                    <button className={`att-btn ${attended===true?"yes":"dim"}`} onClick={() => onSetAttendance(s.id, rec, attended===true ? null : true)}>
                      {Ico.check} Present
                    </button>
                    <button className={`att-btn ${attended===false?"no":"dim"}`} onClick={() => onSetAttendance(s.id, rec, attended===false ? null : false)}>
                      {Ico.x} Absent
                    </button>
                  </div>

                  {attended === true && due > 0 && (
                    <select className="pay-sel" value={payStatus} onChange={e => onSetPayment(rec, e.target.value)}>
                      <option value="unpaid">Unpaid — ${due.toFixed(2)}</option>
                      <option value="paid">✓ Paid (Venmo)</option>
                      <option value="cash">✓ Paid (Cash)</option>
                      <option value="waived">Waived</option>
                    </select>
                  )}

                  {attended === true && payStatus !== "unpaid" && (
                    <span className={`badge b-${payStatus}`}>
                      {payStatus==="paid"?"✓ Venmo":payStatus==="cash"?"✓ Cash":"Waived"}
                    </span>
                  )}

                  {attended === false && <span className="badge b-waived">Absent</span>}
                </>
              ) : (
                <span className="badge b-cancel">Cancelled</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Students tab ─────────────────────────────────────────────────────────────
function Students({ students, onAdd, onUpdate, onDelete, loading }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("active");
  const [saving, setSaving] = useState(false);

  const today = new Date();
  const birthdays = students.filter(s => upcomingBirthday(s.birthday));

  const filtered = students.filter(s =>
    filter==="all" ? true : filter==="active" ? s.active : !s.active
  );

  const handleSave = async (data) => {
    setSaving(true);
    if (editing) await onUpdate(editing.id, data);
    else await onAdd(data);
    setSaving(false);
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="fade-in">
      {birthdays.length > 0 && (
        <div className="card" style={{borderColor:"var(--gold-l)",background:"var(--gold-p)"}}>
          <div className="card-head" style={{fontSize:15,marginBottom:10}}>{Ico.cake} Upcoming Birthdays</div>
          {birthdays.map(s => {
            const bd = upcomingBirthday(s.birthday);
            return <div key={s.id} style={{fontSize:13,color:"var(--ink2)",marginBottom:3}}>
              🎂 <strong>{s.name}</strong> — {bd.date.toLocaleDateString("en-US",{month:"long",day:"numeric"})} ({bd.days===0?"Today!":bd.days===1?"Tomorrow":`in ${bd.days} days`})
            </div>;
          })}
        </div>
      )}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{display:"flex",gap:6}}>
          {["active","inactive","all"].map(f => (
            <button key={f} className={`btn btn-sm ${filter===f?"btn-dk":"btn-gh"}`} onClick={()=>setFilter(f)}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn btn-go btn-sm" onClick={()=>{setEditing(null);setShowForm(true)}}>{Ico.plus} Add Student</button>
      </div>

      {loading && <div style={{textAlign:"center",padding:30}}><span className="spinner"/></div>}
      {!loading && filtered.length===0 && <div className="empty"><div className="empty-ico">🎹</div><div>No students here.</div></div>}

      {!loading && filtered.map(s => (
        <div key={s.id} className="s-row">
          <div className="av">{s.name.charAt(0)}</div>
          <div className="s-info">
            <div className="s-name">{s.name} {!s.active&&<span className="badge b-inactive" style={{marginLeft:6}}>Inactive</span>}</div>
            <div className="s-meta">
              {s.parent_name&&`${s.parent_name} · `}{DAYS[s.lesson_day]} {s.lesson_time} · ${s.rate}/{s.billing_type==="per-lesson"?"lesson":s.billing_type==="weekly"?"wk":"mo"}{s.level&&` · ${s.level}`}
            </div>
            {s.phone && <div style={{fontSize:12,color:"var(--ink3)",marginTop:2}}>{s.phone}{s.email&&` · ${s.email}`}</div>}
            {s.notes && <div className="note-box">{s.notes}</div>}
          </div>
          <div className="s-acts">
            <button className="btn btn-gh btn-sm btn-ic" title="Edit" onClick={()=>{setEditing(s);setShowForm(true)}}>{Ico.edit}</button>
            <button className="btn btn-re btn-sm btn-ic" title="Delete" onClick={()=>onDelete(s.id)}>{Ico.trash}</button>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="overlay" onClick={e=>e.target===e.currentTarget&&!saving&&(setShowForm(false),setEditing(null))}>
          <div className="modal">
            <div className="modal-ttl">{editing?"Edit Student":"New Student"}</div>
            <StudentForm initial={editing} onSave={handleSave} onCancel={()=>{setShowForm(false);setEditing(null)}} saving={saving} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── History tab ──────────────────────────────────────────────────────────────
function History({ students, records, cancelledWeeks }) {
  const [selStudent, setSelStudent] = useState("all");
  const weeks = [];
  const d = new Date();
  for (let i = 0; i < 12; i++) weeks.push(getISOWeek(new Date(d.getTime() - i*7*86400000)));

  const active = students.filter(s => s.active);

  const totalPaid = records.filter(r => r.payment_status === "paid" || r.payment_status === "cash").reduce((acc, r) => {
    const s = students.find(x => x.id === r.student_id);
    return acc + (s ? amountDue(s, r.attended === true) : 0);
  }, 0);

  const totalUnpaid = records.filter(r => !r.payment_status || r.payment_status === "unpaid").reduce((acc, r) => {
    const s = students.find(x => x.id === r.student_id);
    const due = s ? amountDue(s, r.attended === true) : 0;
    return acc + due;
  }, 0);

  return (
    <div className="fade-in">
      <div className="stats">
        <div className="stat"><div className="stat-v" style={{color:"var(--sage)"}}>${totalPaid.toFixed(0)}</div><div className="stat-l">Collected (12 wk)</div></div>
        <div className="stat"><div className="stat-v" style={{color:"var(--rust)"}}>${totalUnpaid.toFixed(0)}</div><div className="stat-l">Outstanding</div></div>
        <div className="stat"><div className="stat-v">{cancelledWeeks.length}</div><div className="stat-l">Cancelled Weeks</div></div>
      </div>

      <div className="card">
        <div className="card-head">{Ico.history} Payment History — Last 12 Weeks</div>
        <div className="field">
          <select className="sel" value={selStudent} onChange={e=>setSelStudent(e.target.value)}>
            <option value="all">All Students</option>
            {active.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={{overflowX:"auto"}}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Week</th>
                {selStudent==="all" ? <th>Student</th> : null}
                <th>Attended</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map(w => {
                const cancelled = cancelledWeeks.includes(w);
                const rows = (selStudent==="all" ? active : active.filter(s=>s.id===selStudent)).map(s => {
                  const r = records.find(x=>x.student_id===s.id && x.week===w);
                  if (!r && !cancelled) return null;
                  const attended = r?.attended;
                  const pay = r?.payment_status||"unpaid";
                  const due = cancelled ? 0 : amountDue(s, attended===true);
                  return { s, attended, pay, due, cancelled };
                }).filter(Boolean);
                return rows.map((row,i) => (
                  <tr key={`${w}-${row.s.id}`}>
                    {i===0 && <td rowSpan={rows.length} style={{verticalAlign:"top",paddingTop:10,whiteSpace:"nowrap",color:"var(--ink3)",fontSize:12}}>{weekLabel(w)}</td>}
                    {selStudent==="all" && <td style={{fontWeight:500}}>{row.s.name}</td>}
                    <td>{row.cancelled ? <span className="badge b-cancel">Cancelled</span> : row.attended===true?"✓":row.attended===false?"✗":"—"}</td>
                    <td>{row.due>0?`$${row.due.toFixed(2)}`:"—"}</td>
                    <td>{row.cancelled?<span className="badge b-cancel">N/A</span>:row.due>0?<span className={`badge b-${row.pay}`}>{row.pay}</span>:"—"}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Settings tab ─────────────────────────────────────────────────────────────
function Settings({ settings, onSave }) {
  const [f, setF] = useState({ studio_name: "", venmo_handle: "", ...settings });
  const [saving, setSaving] = useState(false);
  useEffect(() => { setF({ studio_name:"", venmo_handle:"", ...settings }); }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(f);
    setSaving(false);
  };

  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-head">{Ico.cog} Studio Settings</div>
        <div className="field"><label className="lbl">Studio Name</label><input className="inp" value={f.studio_name} onChange={e=>setF(p=>({...p,studio_name:e.target.value}))} placeholder="My Piano Studio" /></div>
        <div className="field">
          <label className="lbl">Your Venmo Handle</label>
          <input className="inp" value={f.venmo_handle} onChange={e=>setF(p=>({...p,venmo_handle:e.target.value}))} placeholder="@yourusername" />
          <div style={{fontSize:12,color:"var(--ink3)",marginTop:4}}>Parents will be sent a Venmo link that opens a pre-filled payment to this handle.</div>
        </div>
        <button className="btn btn-dk" onClick={handleSave} disabled={saving}>
          {saving?<><span className="spinner"/>&nbsp;Saving…</>:"Save Settings"}
        </button>
      </div>

      <div className="card" style={{borderColor:"var(--gold-l)",background:"var(--gold-p)"}}>
        <div className="card-head" style={{fontSize:15}}>💡 Venmo Tips</div>
        <p style={{fontSize:13,color:"var(--ink2)",lineHeight:1.7}}>
          When you tap <strong>Open Venmo</strong> next to a student, it opens the Venmo app pre-filled with your handle, the exact amount, and the student's name in the note.<br/><br/>
          After a parent pays, come back and mark their lesson as <strong>Paid (Venmo)</strong> using the dropdown. Your payment history is tracked in the History tab.
        </p>
      </div>
    </div>
  );
}

// ── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [week, setWeek] = useState(currentWeek());
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [cancelledWeeks, setCancelledWeeks] = useState([]);
  const [settings, setSettings] = useState({ studio_name:"Piano Studio", venmo_handle:"" });
  const [loading, setLoading] = useState(true);
  const { msg: toast, show: showToast } = useToast();

  // ── Load all data ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: sts }, { data: recs }, { data: cw }, { data: cfg }] = await Promise.all([
        sb.from("students").select("*").order("name"),
        sb.from("weekly_records").select("*"),
        sb.from("cancelled_weeks").select("week"),
        sb.from("studio_settings").select("*").eq("id",1).single(),
      ]);
      if (sts) setStudents(sts);
      if (recs) setRecords(recs);
      if (cw) setCancelledWeeks(cw.map(r=>r.week));
      if (cfg) setSettings(cfg);
      setLoading(false);
    }
    load();
  }, []);

  // ── Student CRUD ───────────────────────────────────────────────────────────
	const addStudent = async (data) => {
	  const clean = { ...data, birthday: data.birthday || null, rate: data.rate || 0 };
	  const { data: newS, error } = await sb.from("students").insert([clean]).select().single();
	  if (error) { showToast("Error saving student"); return; }
	  setStudents(p => [...p, newS].sort((a,b)=>a.name.localeCompare(b.name)));
	  showToast("Student added ✓");
	};

	const updateStudent = async (id, data) => {
	  const clean = { ...data, birthday: data.birthday || null, rate: data.rate || 0 };
	  const { data: upd, error } = await sb.from("students").update(clean).eq("id",id).select().single();
	  if (error) { showToast("Error updating student"); return; }
	  setStudents(p => p.map(s=>s.id===id?upd:s));
	  showToast("Student updated ✓");
	};

  const deleteStudent = async (id) => {
    if (!confirm("Remove this student? All their records will be deleted.")) return;
    const { error } = await sb.from("students").delete().eq("id",id);
    if (error) { showToast("Error deleting student"); return; }
    setStudents(p => p.filter(s=>s.id!==id));
    setRecords(p => p.filter(r=>r.student_id!==id));
    showToast("Student removed");
  };

  // ── Attendance ─────────────────────────────────────────────────────────────
  const setAttendance = async (studentId, existingRec, attended) => {
  const { data, error } = await sb.from("weekly_records").upsert(
    [{ student_id:studentId, week, attended, payment_status:"unpaid" }],
    { onConflict: "student_id,week" }
  ).select().single();
  if (error) return;
  setRecords(p => {
    const exists = p.find(r => r.student_id===studentId && r.week===week);
    return exists ? p.map(r => r.student_id===studentId && r.week===week ? data : r) : [...p, data];
  });
};

  // ── Payment ────────────────────────────────────────────────────────────────
  const setPayment = async (rec, payment_status) => {
    if (!rec) return;
    const { data, error } = await sb.from("weekly_records").update({ payment_status }).eq("id",rec.id).select().single();
    if (error) return;
    setRecords(p => p.map(r=>r.id===rec.id?data:r));
    if (payment_status !== "unpaid") showToast(`Marked as ${payment_status} ✓`);
  };

  // ── Cancel week ────────────────────────────────────────────────────────────
  const toggleCancel = async () => {
    if (cancelledWeeks.includes(week)) {
      await sb.from("cancelled_weeks").delete().eq("week",week);
      setCancelledWeeks(p => p.filter(w=>w!==week));
      showToast("Week restored");
    } else {
      await sb.from("cancelled_weeks").insert([{ week }]);
      setCancelledWeeks(p => [...p, week]);
      showToast("Week cancelled — no payments due");
    }
  };

  // ── Settings ───────────────────────────────────────────────────────────────
  const saveSettings = async (data) => {
    const { data: upd, error } = await sb.from("studio_settings").update(data).eq("id",1).select().single();
    if (error) { showToast("Error saving settings"); return; }
    setSettings(upd);
    showToast("Settings saved ✓");
  };

  const tabs = [
    { id:"dashboard", label:"This Week", icon:Ico.piano },
    { id:"students",  label:"Students",  icon:Ico.user },
    { id:"history",   label:"History",   icon:Ico.history },
    { id:"settings",  label:"Settings",  icon:Ico.cog },
  ];

  return (
    <>
      <style>{STYLE}</style>
      <div className="shell">
        <header className="topbar">
          <div className="topbar-brand">{Ico.piano} {settings.studio_name}</div>
          <div className="topbar-week">{weekLabel(currentWeek())}</div>
        </header>

        <nav className="tabs">
          {tabs.map(t => (
            <button key={t.id} className={`tab ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>
              {t.icon} {t.label}
            </button>
          ))}
        </nav>

        <main className="main">
          {tab==="dashboard" && (
            <Dashboard
              students={students} records={records} cancelledWeeks={cancelledWeeks}
              settings={settings} week={week} setWeek={setWeek}
              onToggleCancel={toggleCancel}
              onSetAttendance={setAttendance}
              onSetPayment={setPayment}
              loading={loading}
            />
          )}
          {tab==="students" && (
            <Students students={students} onAdd={addStudent} onUpdate={updateStudent} onDelete={deleteStudent} loading={loading} />
          )}
          {tab==="history" && (
            <History students={students} records={records} cancelledWeeks={cancelledWeeks} />
          )}
          {tab==="settings" && (
            <Settings settings={settings} onSave={saveSettings} />
          )}
        </main>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}