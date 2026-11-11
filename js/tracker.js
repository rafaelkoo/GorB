// Gym tracker screens: log today's workout, and a person's progress.
import * as api from './supa.js';
import { EXERCISES, EX, CATS, BIG_FOUR } from './exercises.js';

const $app = () => document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const kg = n => `${+(+n).toFixed(2)} kg`;
const shortDate = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
function showError(err) {
  const box = document.querySelector('.error') || $app().insertAdjacentElement('afterbegin', document.createElement('p'));
  box.className = 'error'; box.textContent = err?.message || String(err);
}
function note(text) {
  const box = document.createElement('p'); box.className = 'ok'; box.textContent = text;
  $app().insertAdjacentElement('afterbegin', box);
}

// ---------- history helpers ----------
// sessions[exerciseId] = [{date, sets:[{kg, reps}]}] oldest first
function bySession(rows) {
  const out = {};
  for (const r of rows) {
    const list = out[r.exercise_id] || (out[r.exercise_id] = []);
    let s = list[list.length - 1];
    if (!s || s.date !== r.performed_on) list.push(s = { date: r.performed_on, sets: [] });
    s.sets.push({ kg: +r.weight_kg, reps: r.reps });
  }
  return out;
}
const bestKg = sets => Math.max(0, ...sets.filter(s => s.reps >= 1).map(s => s.kg));
const prOf = sessions => sessions.reduce((b, s) => { const k = bestKg(s.sets); return k > b.kg ? { kg: k, date: s.date } : b; }, { kg: 0, date: null });
function setsText(sets) {
  // "3 × 5 @ 100 kg" when every set matches, else "100×5, 105×3"
  const same = sets.every(s => s.kg === sets[0].kg && s.reps === sets[0].reps);
  return same ? `${sets.length} × ${sets[0].reps} @ ${kg(sets[0].kg)}` : sets.map(s => `${+s.kg}×${s.reps}`).join(', ');
}

// ---------- log today's workout ----------
const draftKey = uid => `gob_draft_${uid}_${api.ukToday()}`;
const loadDraft = uid => { try { return JSON.parse(localStorage.getItem(draftKey(uid))); } catch { return null; } };
const saveDraft = (uid, d) => { try { localStorage.setItem(draftKey(uid), JSON.stringify(d)); } catch { /* storage blocked */ } };
const dropDraft = uid => { try { localStorage.removeItem(draftKey(uid)); } catch { /* ignore */ } };

export async function logScreen(user) {
  const today = api.ukToday();
  const history = bySession(await api.liftHistory(user.id));
  const past = id => (history[id] || []).filter(s => s.date < today);
  // start from: unsaved draft → what was already saved today → empty
  let draft = loadDraft(user.id);
  if (!draft) {
    const items = Object.entries(history)
      .filter(([, list]) => list.at(-1)?.date === today)
      .map(([id, list]) => ({ id, sets: list.at(-1).sets.map(s => ({ kg: s.kg, reps: s.reps })) }));
    draft = { items, saved: items.length > 0 };
  }
  const keep = () => saveDraft(user.id, draft);

  function draw() {
    $app().innerHTML = `
      <section class="hero"><h2>Today's workout</h2>
        <p class="muted">${esc(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}${draft.saved ? ' · saved, edit and save again' : ''}</p></section>
      ${draft.items.map((it, i) => {
        const last = past(it.id).at(-1);
        return `<section class="card ex" data-i="${i}">
          <div class="ex-head"><div><h3>${esc(EX[it.id]?.en || it.id)}</h3><span class="muted">${esc(EX[it.id]?.zh || '')}</span></div>
            <button class="ghost x" data-act="drop" aria-label="Remove ${esc(EX[it.id]?.en)}">✕</button></div>
          <p class="muted last">${last ? `Last time (${esc(shortDate(last.date))}): ${esc(setsText(last.sets))}` : 'First time logging this'}</p>
          <div class="sets">
            <div class="set head"><span>Set</span><span>kg</span><span>Reps</span><span></span></div>
            ${it.sets.map((s, j) => `<div class="set" data-j="${j}"><span>${j + 1}</span>
              <input inputmode="decimal" aria-label="Set ${j + 1} kg" value="${s.kg ?? ''}" data-f="kg">
              <input inputmode="numeric" aria-label="Set ${j + 1} reps" value="${s.reps ?? ''}" data-f="reps">
              <button class="ghost x" data-act="unset" aria-label="Remove set ${j + 1}">✕</button></div>`).join('')}
          </div>
          <button class="ghost" data-act="addset">+ Set</button>
        </section>`;
      }).join('')}
      <button id="addex" class="big ghost">+ Add exercise</button>
      ${draft.items.length ? '<button id="save" class="big">Save workout</button>' : ''}`;

    $app().querySelectorAll('.ex').forEach(card => {
      const it = draft.items[+card.dataset.i];
      card.querySelectorAll('input').forEach(inp => inp.oninput = () => {
        const s = it.sets[+inp.closest('.set').dataset.j];
        s[inp.dataset.f] = inp.value === '' ? null : Number(inp.value.replace(',', '.'));
        keep();
      });
      card.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
        const act = b.dataset.act;
        if (act === 'drop') draft.items.splice(+card.dataset.i, 1);
        if (act === 'addset') { const l = it.sets.at(-1) || {}; it.sets.push({ kg: l.kg ?? null, reps: l.reps ?? null }); }
        if (act === 'unset') it.sets.splice(+b.closest('.set').dataset.j, 1);
        keep(); draw();
      });
    });
    $app().querySelector('#addex').onclick = () => picker(id => {
      const last = past(id).at(-1);
      draft.items.push({ id, sets: last ? last.sets.map(s => ({ kg: s.kg, reps: s.reps })) : [{ kg: null, reps: null }] });
      keep(); draw();
    });
    $app().querySelector('#save')?.addEventListener('click', save);
  }

  async function save(e) {
    const btn = e.currentTarget, rows = [];
    for (const it of draft.items) {
      let n = 0;
      for (const s of it.sets) {
        if (!(s.reps >= 1) && !(s.kg > 0)) continue;              // skip empty rows
        if (!(s.kg >= 0) || !(Number.isInteger(s.reps) && s.reps >= 0)) return showError({ message: `Check the numbers for ${EX[it.id]?.en}.` });
        rows.push({ exercise_id: it.id, set_no: ++n, weight_kg: s.kg, reps: s.reps });
      }
    }
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await api.saveWorkout(user.id, rows);
      dropDraft(user.id);
      const prs = [...new Set(rows.map(r => r.exercise_id))]
        .map(id => ({ id, now: Math.max(...rows.filter(r => r.exercise_id === id && r.reps >= 1).map(r => r.weight_kg), 0), before: prOf(past(id)).kg }))
        .filter(p => p.before > 0 && p.now > p.before);
      location.hash = '#/p/me';
      setTimeout(() => note(prs.length ? `Saved. New PR: ${prs.map(p => `${EX[p.id]?.en} ${kg(p.now)}`).join(', ')} 🏆` : 'Workout saved.'), 300);
    } catch (err) { showError(err); btn.disabled = false; btn.textContent = 'Save workout'; }
  }

  draw();
}

// Full-screen list to pick an exercise: search + body part filter.
function picker(onPick) {
  const box = document.createElement('div');
  box.className = 'sheet'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Add exercise');
  let cat = '', q = '';
  const list = () => EXERCISES.filter(([id, en, zh, c]) => (!cat || c === cat) && (!q || `${en} ${zh}`.toLowerCase().includes(q)));
  function draw() {
    box.innerHTML = `<div class="sheet-in">
      <div class="ex-head"><h3>Add exercise</h3><button class="ghost x" id="close" aria-label="Close">✕</button></div>
      <input id="q" placeholder="Search, e.g. bench" value="${esc(q)}" autocomplete="off">
      <div class="chips"><button data-c="" class="${cat ? '' : 'on'}">All</button>${Object.entries(CATS).map(([k, v]) => `<button data-c="${k}" class="${cat === k ? 'on' : ''}">${esc(v)}</button>`).join('')}</div>
      <ul class="pick">${list().map(([id, en, zh, , equip]) => `<li><button data-id="${id}"><b>${esc(en)}</b> <span class="muted">${esc(zh)} · ${esc(equip)}</span></button></li>`).join('') || '<li class="muted">No match</li>'}</ul>
    </div>`;
    box.querySelector('#close').onclick = () => box.remove();
    const qi = box.querySelector('#q');
    qi.oninput = () => { q = qi.value.trim().toLowerCase(); const pos = qi.selectionStart; draw(); const n = box.querySelector('#q'); n.focus(); n.setSelectionRange(pos, pos); };
    box.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cat = b.dataset.c; draw(); });
    box.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { box.remove(); onPick(b.dataset.id); });
  }
  draw();
  document.body.append(box);
  box.querySelector('#q').focus();
}

// ---------- progress ----------
function spark(sessions) {
  const pts = sessions.map(s => bestKg(s.sets)).filter(k => k > 0);
  if (pts.length < 2) return '';
  const W = 300, H = 64, lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const xy = pts.map((k, i) => [8 + i * (W - 16) / (pts.length - 1), H - 8 - (k - lo) / span * (H - 16)]);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Best set per session, ${kg(pts[0])} to ${kg(pts.at(-1))}">
    <polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${xy.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)"/>`).join('')}</svg>`;
}

export async function progressScreen(user, who) {
  const uid = who === 'me' ? user.id : who;
  const [profile, rows] = await Promise.all([api.getProfile(uid), api.liftHistory(uid)]);
  const sessions = bySession(rows);
  const order = Object.keys(sessions).sort((a, b) => sessions[b].at(-1).date.localeCompare(sessions[a].at(-1).date));
  const mine = uid === user.id;
  const total = BIG_FOUR.reduce((t, id) => t + prOf(sessions[id] || []).kg, 0);
  const days = new Set(rows.map(r => r.performed_on)).size;
  $app().innerHTML = `
    <section class="hero"><h2>${mine ? 'Your progress' : `${esc(profile.display_name)}'s progress`}</h2>
      <p class="muted">${days} workout${days === 1 ? '' : 's'} logged</p>
      ${mine ? '<a class="big" href="#/log">🏋️ Log today\'s workout</a>' : ''}</section>
    <section class="card"><h3>Personal bests</h3>
      <div class="pbs">${BIG_FOUR.map(id => { const p = prOf(sessions[id] || []); return `<div><span class="muted">${esc(EX[id].en)}</span><b>${p.kg ? kg(p.kg) : '—'}</b></div>`; }).join('')}
        <div class="total"><span class="muted">Total</span><b>${total ? kg(total) : '—'}</b></div></div></section>
    ${order.length ? order.map(id => {
      const list = sessions[id], pr = prOf(list), last = list.at(-1);
      return `<section class="card"><div class="ex-head"><div><h3>${esc(EX[id]?.en || id)}</h3><span class="muted">${esc(EX[id]?.zh || '')}</span></div>
          <div class="pr"><span class="muted">PR</span><b>${pr.kg ? kg(pr.kg) : '—'}</b></div></div>
        ${spark(list)}
        <p class="muted">Last (${esc(shortDate(last.date))}): ${esc(setsText(last.sets))} · ${list.length} session${list.length === 1 ? '' : 's'}</p></section>`;
    }).join('') : `<section class="card"><p class="muted">${mine ? 'Nothing logged yet. Log your first workout.' : 'Nothing logged yet.'}</p></section>`}`;
}

// PB board for the group page: rows = members, columns = the four lifts + total
export async function pbBoardHtml(groupId, userId) {
  const rows = await api.groupLifts(groupId);
  if (!rows.length) return '<p class="muted">No lifts logged yet. Log a workout to get on the board.</p>';
  const people = {};
  for (const r of rows) (people[r.user_id] ||= { name: r.display_name, kg: {} }).kg[r.exercise_id] = +r.best_kg;
  const list = Object.entries(people).map(([id, p]) => ({ id, ...p, total: BIG_FOUR.reduce((t, e) => t + (p.kg[e] || 0), 0) }))
    .sort((a, b) => b.total - a.total);
  const short = { bench_press: 'Bench', deadlift: 'Dead', squat: 'Squat', ohp: 'OHP' };
  return `<div class="tablewrap"><table class="pb"><thead><tr><th>Name</th>${BIG_FOUR.map(e => `<th>${short[e]}</th>`).join('')}<th>Total</th></tr></thead>
    <tbody>${list.map(p => `<tr class="${p.id === userId ? 'me' : ''}"><td><a href="#/p/${p.id}">${esc(p.name)}</a></td>
      ${BIG_FOUR.map(e => `<td>${p.kg[e] ? +p.kg[e] : '—'}</td>`).join('')}<td><b>${+p.total.toFixed(2)}</b></td></tr>`).join('')}</tbody></table></div>
    <p class="muted">kg, heaviest set with at least 1 rep. Tap a name to see their progress.</p>`;
}
