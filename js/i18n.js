// Language: English or Traditional Chinese (Cantonese wording, like FitTrack).
// Every UI string is written as t('English', '中文') right where it is used.
const KEY = 'gob_lang';
let lang = (() => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'zh') return saved;
  } catch { /* storage blocked */ }
  return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
})();
document.documentElement.lang = lang === 'zh' ? 'zh-Hant-HK' : 'en-GB';

export const getLang = () => lang;
export const t = (en, zh) => (lang === 'zh' ? zh : en);
export function setLang(l) {
  lang = l === 'zh' ? 'zh' : 'en';
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant-HK' : 'en-GB';
}
export const hasChosenLang = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };

const loc = () => (lang === 'zh' ? 'zh-HK' : 'en-GB');
export const fmtDateTime = iso => new Date(iso).toLocaleString(loc(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtDay = isoDate => new Date(isoDate + 'T12:00:00Z').toLocaleDateString(loc(), { day: 'numeric', month: 'short' });
export const fmtLongToday = () => new Date().toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' });
export const monthName = () => new Date().toLocaleString(loc(), { month: 'long' });

// little language switch used on the sign-in screen and the Me page
export const langSwitchHtml = () => `<div class="seg" role="group" aria-label="Language / 語言">
  <button type="button" data-lang="en" class="${lang === 'en' ? 'on' : ''}">English</button>
  <button type="button" data-lang="zh" class="${lang === 'zh' ? 'on' : ''}">繁中</button></div>`;
