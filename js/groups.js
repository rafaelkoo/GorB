// Being in more than one group: the groups page (a card per group), joining with a preview, and each
// group's own settings. Server side: migration 035.
import * as api from './supa.js';
import { t, monthName } from './i18n.js';
import { esc, render, showError, toast } from './ui.js';

const initial = n => esc((n || '?').trim().slice(0, 1).toUpperCase());

// ---------- the groups page ----------
export async function groupsHome(user, { auto = true } = {}) {
  const [cards, unread] = await Promise.all([api.myGroupCards().catch(() => null), api.chatUnread().catch(() => ({}))]);
  const list = cards || (await api.myGroups()).map(g => ({ ...g, names: [], today: [] }));
  // opening the app: one group → straight in; a pinned group → straight there
  if (auto && list.length === 1) { location.hash = `#/g/${list[0].id}`; return; }
  if (auto && list.find(g => g.pinned)) { location.hash = `#/g/${list.find(g => g.pinned).id}`; return; }
  const el = render(`
    <header class="page-head"><div><h2>${t('Your groups', '你嘅 group')}</h2>
      ${list.length > 1 ? `<p class="muted">${t(`${list.length} groups · one check-in counts in all of them`, `${list.length} 個 group · 打卡一次，全部 group 都計`)}</p>` : ''}</div></header>
    ${list.length ? list.map(g => {
      const today = new Set(g.today || []), n = unread[g.id] || 0, me = today.has(user.id);
      const boss = g.boss, left = boss && boss.hp ? Math.max(0, Math.round((boss.hp - boss.dmg) / boss.hp * 100)) : null;
      return `<a class="card grp-card" href="#/g/${g.id}">
        <div class="grp-top"><div><b class="grp-name">${g.pinned ? '<span class="pin" aria-label="' + t('Pinned', '置頂') + '">●</span> ' : ''}${esc(g.name)}</b>
          <span class="muted small">${t(`${g.members ?? '?'} people · ${today.size} checked in today`, `${g.members ?? '?'} 個人 · 今日 ${today.size} 個打咗卡`)}</span></div>
          ${n ? `<span class="badge-pill">${t(`${n} unread`, `${n} 個未讀`)}</span>` : ''}</div>
        <div class="grp-tags">
          ${g.rank ? `<span class="pill">${t(`You’re #${g.rank} in ${monthName()}`, `你排第 ${g.rank}`)}</span>` : ''}
          ${boss ? (boss.defeated ? `<span class="pill gold">${t('Boss beaten', '魔王打低咗')}</span>` : `<span class="pill">${t(`Boss ${left}% HP`, `魔王仲有 ${left}% 血`)}</span>`) : ''}
          ${me ? `<span class="pill ok">${t('You checked in', '你今日打咗卡')}</span>` : ''}
          ${g.mute_checkins || g.mute_chat ? `<span class="pill">${t('Muted', '靜音')}</span>` : ''}</div>
        ${g.names?.length ? `<div class="grp-faces" aria-label="${t('Who checked in today', '今日邊個打咗卡')}">${g.names.slice(0, 10).map(p => `<span class="face ${today.has(p.id) ? 'in' : ''}" title="${esc(p.name)}">${initial(p.name)}</span>`).join('')}</div>` : ''}
      </a>`;
    }).join('') : `<section class="card"><p class="muted">${t('No groups yet. Make one or join with a code.', '仲未有 group。開一個，或者用邀請碼加入。')}</p></section>`}
    <section class="card"><h3>${t('Join a group', '加入 group')}</h3>
      <form id="jn" class="row"><input id="gcode" required maxlength="8" placeholder="${t('Invite code', '邀請碼')}" aria-label="${t('Invite code', '邀請碼')}" autocapitalize="characters"><button>${t('Next', '下一步')}</button></form></section>
    <section class="card"><h3>${t('Make a group', '開 group')}</h3>
      <form id="mk" class="row"><input id="gname" required maxlength="60" placeholder="${t('Group name', 'Group 名')}" aria-label="${t('Group name', 'Group 名')}"><button>${t('Create', '建立')}</button></form></section>`);
  el.querySelector('#mk').onsubmit = async e => {
    e.preventDefault();
    try { const g = await api.createGroup(el.querySelector('#gname').value); location.hash = `#/g/${g.id}`; } catch (err) { showError(err); }
  };
  el.querySelector('#jn').onsubmit = e => { e.preventDefault(); location.hash = `#/preview/${encodeURIComponent(el.querySelector('#gcode').value.trim().toUpperCase())}`; };
}

// ---------- joining: see the group first, choose what they see of your past ----------
export async function joinPreview(user, code) {
  const el = render(`<p class="muted">${t('Loading…', '載入緊…')}</p>`);
  let pv, mine;
  try { [pv, mine] = await Promise.all([api.groupPreview(code), api.myGroups()]); } catch (err) { showError(err); return; }
  if (!pv) { render(`<section class="card"><h3>${t('That invite code doesn’t work', '呢個邀請碼用唔到')}</h3><p class="muted">${t('Check it with the person who sent it.', '問返傳俾你嘅人。')}</p><a class="link" href="#/all">‹ ${t('Your groups', '你嘅 group')}</a></section>`); return; }
  if (pv.already) { location.hash = `#/g/${pv.id}`; return; }
  el.innerHTML = `
    <section class="card join-card">
      <p class="muted">${t('You’ve been invited to', '你獲邀加入')}</p>
      <h2>${esc(pv.name)}</h2>
      <p class="muted small">${t(`${pv.members.length} people`, `${pv.members.length} 個人`)}${pv.top ? ` · ${t(`most days this month: ${esc(pv.top.name)} (${pv.top.days})`, `今個月最多日數：${esc(pv.top.name)}（${pv.top.days} 日）`)}` : ''}</p>
      <div class="grp-faces">${pv.members.slice(0, 12).map(p => `<span class="face in" title="${esc(p.name)}">${initial(p.name)}</span>`).join('')}</div>
    </section>
    <section class="card">
      <h3>${t('Once you join', '加入之後')}</h3>
      <ul class="join-list">
        <li>${t('Your level, moves, chests and tickets stay the same: they’re shared by all your groups.', '你嘅等級、招式、寶箱同戰鬥券唔變，所有 group 共用。')}</li>
        <li>${t('Every check-in photo goes to this group too. You can give each group its own caption.', '以後每張打卡相都會去埋呢個 group，caption 可以每個 group 分開寫。')}</li>
        <li>${t('Your one boss attack a day counts here too.', '每日一次嘅魔王攻擊會計埋呢個 group。')}</li>
      </ul>
      <fieldset class="join-hist"><legend>${t('Can they see your check-ins from before you joined?', '佢哋睇唔睇到你加入之前嘅打卡？')}</legend>
        <label><input type="radio" name="hist" value="1" checked> <span><b>${t('Yes, the last 7 days', '睇到，最近 7 日')}</b><small class="muted">${t('Photos are kept for 7 days anyway.', '相片本身都只係保留 7 日。')}</small></span></label>
        <label><input type="radio" name="hist" value="0"> <span><b>${t('Only from now on', '只睇到加入之後嘅')}</b><small class="muted">${t('You can change this later in the group’s settings.', '之後可以喺 group 設定度改。')}</small></span></label>
      </fieldset>
      ${mine.length ? `<p class="muted small">${t(`You’re already in: ${mine.map(g => esc(g.name)).join(', ')}`, `你已經喺：${mine.map(g => esc(g.name)).join('、')}`)}</p>` : ''}
      <div class="row"><a class="button ghost" href="#/all">${t('Not now', '唔加入')}</a><button id="joinGo">${t(`Join ${esc(pv.name)}`, `加入 ${esc(pv.name)}`)}</button></div>
    </section>`;
  el.querySelector('#joinGo').onclick = async e => {
    e.target.disabled = true;
    const show = el.querySelector('input[name="hist"]:checked').value === '1';
    try { const g = await api.joinGroup(code, show); window.dispatchEvent(new Event('customchange')); location.hash = `#/g/${g.id}`; }
    catch (err) { e.target.disabled = false; showError(err); }
  };
}

// ---------- one group's settings (only for you) ----------
export async function groupSettings(user, groupId) {
  const [groups, cards] = await Promise.all([api.myGroups(), api.myGroupCards().catch(() => [])]);
  const g = groups.find(x => x.id === groupId);
  if (!g) { location.hash = '#/all'; return; }
  const c = (cards || []).find(x => x.id === groupId) || {};
  const many = groups.length > 1;
  const row = (key, on, title, note) => `<label class="set-row"><span><b>${title}</b><small class="muted">${note}</small></span>
    <input type="checkbox" data-k="${key}" ${on ? 'checked' : ''}></label>`;
  const el = render(`
    <header class="page-head"><div><h2>${t(`${esc(g.name)} settings`, `${esc(g.name)} 設定`)}</h2><p class="muted">${t('Only for you, only this group', '只影響你，只影響呢個 group')}</p></div>
      <a class="link" href="#/g/${g.id}">‹ ${t('Back', '返去')}</a></header>
    <section class="card set-card">
      ${row('notify_checkins', !c.mute_checkins, t('Check-in alerts', '打卡通知'), t('Tell me when someone here checks in', '有人打卡就通知我'))}
      ${row('notify_chat', !c.mute_chat, t('Chat alerts', '傾偈通知'), t('New messages, replies and reactions', '新訊息、回覆同 emoji'))}
      ${row('show_history', c.show_history !== false, t('Show my check-ins from before I joined', '俾佢哋睇我加入之前嘅打卡'), t('Off: they only see the ones after you joined', '關咗：佢哋只睇到你加入之後嘅'))}
      ${many ? row('in_everyone', c.in_everyone !== false, t('Include in my “Everyone” ranking', '計入我嘅「全部人」排名'), t('Only changes what you see', '只影響你自己睇到嘅'))
        + row('pinned', !!c.pinned, t('Pin', '置頂'), t('Open the app on this group', '開 app 先去呢個 group')) : ''}
    </section>
    <button id="leave" class="ghost danger">${t(`Leave ${esc(g.name)}`, `退出 ${esc(g.name)}`)}</button>`);
  el.querySelectorAll('[data-k]').forEach(box => box.onchange = async () => {
    const k = box.dataset.k, v = box.checked;
    const prefs = k === 'notify_checkins' ? { mute_checkins: !v } : k === 'notify_chat' ? { mute_chat: !v } : { [k]: v };
    box.disabled = true;
    try { await api.setGroupPrefs(g.id, prefs); toast(t('Saved', '儲存咗')); } catch (err) { box.checked = !v; showError(err); }
    box.disabled = false;
  });
  el.querySelector('#leave').onclick = async () => {
    if (!confirm(t(`Leave ${g.name}?`, `確定退出 ${g.name}？`))) return;
    try { await api.leaveGroup(g.id, user.id); window.dispatchEvent(new Event('customchange')); location.hash = '#/all'; } catch (err) { showError(err); }
  };
}
