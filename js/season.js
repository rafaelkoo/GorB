// Monthly season pass: free reward tiers for gym days this month; resets on the 1st (migration 029).
import * as api from './supa.js';
import { t, getLang } from './i18n.js';
import { toast, showError } from './ui.js';

const ITEM = { gold_top: () => t('Gold top', '金色上衣'), crown: () => t('Crown', '皇冠'), gold_shoes: () => t('Gold shoes', '金鞋') };

export function seasonCardHtml() {
  return `<section class="card season-card" id="seasonCard"><div class="card-head"><h3 id="sTitle">${t('Season pass', '賽季')}</h3><span class="muted small" id="sLeft"></span></div><div id="sBody"></div></section>`;
}

export async function mountSeason(el, onItem) {
  const card = el.querySelector('#seasonCard'); if (!card) return;
  let s;
  try { s = await api.seasonPass(); } catch { card.hidden = true; return; }
  if (!s) { card.hidden = true; return; }
  const month = new Date(`${s.month}T12:00:00Z`).toLocaleDateString(getLang() === 'zh' ? 'zh-HK' : 'en-GB', { month: 'long' });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
  const left = Math.round((new Date(`${s.month_end}T12:00:00Z`) - new Date(`${today}T12:00:00Z`)) / 864e5) + 1;
  card.querySelector('#sTitle').textContent = t(`${month} season`, `${month}賽季`);
  card.querySelector('#sLeft').textContent = t(`${left} day${left === 1 ? '' : 's'} left`, `仲有 ${left} 日`);
  const max = s.tiers.at(-1).need;
  const draw = () => {
    card.querySelector('#sBody').innerHTML = `
      <p class="s-days"><b>${s.days}</b> ${t('gym days this month', '日（今個月去咗）')}</p>
      <div class="s-track" role="progressbar" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${s.days}"><i style="width:${Math.min(100, s.days / max * 100)}%"></i></div>
      <ol class="s-tiers">${s.tiers.map(x => {
        const reached = s.days >= x.need;
        return `<li class="${x.claimed ? 'claimed' : reached ? 'ready' : ''} ${x.item ? 'has-item' : ''}">
          <span class="s-need">${x.need}</span>
          <span class="s-rew">${x.item ? `<b>🎁 ${ITEM[x.item]()}</b> ` : ''}+${x.coins} 💧 +${x.xp} ${t('XP', '經驗')}</span>
          ${x.claimed ? '<span class="q-done">✓</span>' : reached ? `<button class="small-btn" data-tier="${x.need}">${t('Claim', '領取')}</button>` : `<span class="muted small">${t(`${x.need - s.days} to go`, `仲差 ${x.need - s.days} 日`)}</span>`}
        </li>`;
      }).join('')}</ol>
      <p class="muted small">${t('Starts again from zero on the 1st. Items you unlock are yours for good.', '每個月 1 號由零開始。解鎖咗嘅衫同帽永遠屬於你。')}</p>`;
    card.querySelectorAll('[data-tier]').forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await api.claimSeason(+b.dataset.tier);
        const x = s.tiers.find(y => y.need === +b.dataset.tier); if (x) x.claimed = true;
        draw();
        if (r) {
          navigator.vibrate?.(40);
          toast(r.item ? t(`Unlocked: ${ITEM[r.item]()}! Wear it on your character 👑`, `解鎖咗：${ITEM[r.item]()}！去角色度著上佢 👑`) : t(`+${r.coins} 💧 +${r.xp} XP`, `+${r.coins} 💧 +${r.xp} 經驗`));
          if (r.item) onItem?.();
        }
      } catch (err) { b.disabled = false; showError(err); }
    });
  };
  draw();
}
