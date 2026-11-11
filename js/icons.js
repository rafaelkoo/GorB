// Small inline icons (stroke = currentColor), so they follow the text colour.
const svg = (d, size = 22) => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  group: s => svg('<path d="M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1"/><circle cx="9" cy="7" r="3.5"/><path d="M22 19v-1a4 4 0 0 0-3-3.9"/><path d="M16 3.1a3.5 3.5 0 0 1 0 6.8"/>', s),
  log: s => svg('<path d="M6.5 6.5v11"/><path d="M17.5 6.5v11"/><path d="M3 9.5v5"/><path d="M21 9.5v5"/><path d="M6.5 12h11"/>', s),
  ranks: s => svg('<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/>', s),
  me: s => svg('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>', s),
  camera: s => svg('<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>', s),
  check: s => svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>', s),
  share: s => svg('<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>', s),
  chart: s => svg('<path d="M3 20h18"/><path d="M6 16l4-5 4 3 5-7"/>', s),
  bell: s => svg('<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>', s)
};

// Chalk tally marks: groups of four strokes with a fifth struck across. n = days.
export function tally(n, label) {
  if (!n) return `<span class="tally none" aria-label="${label || '0'}">—</span>`;
  const groups = Math.ceil(n / 5), W = groups * 30;
  let d = '';
  for (let g = 0; g < groups; g++) {
    const x0 = g * 30 + 3, k = Math.min(5, n - g * 5);
    for (let i = 0; i < Math.min(4, k); i++) d += `M${x0 + i * 5 + (i % 2 ? 0.6 : 0)} 3.5 L${x0 + i * 5 - 0.4} 20.5 `;
    if (k === 5) d += `M${x0 - 3} 17.5 L${x0 + 19} 6 `;
  }
  return `<svg class="tally" viewBox="0 0 ${W} 24" width="${W}" height="24" role="img" aria-label="${label || n}"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
}
