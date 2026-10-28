/* p5c: achievements. A ladder of bronze, silver and gold for each, counted across every run this profile
   plays, kept in the browser (per profile) and shown in the record book. */
const ACH = [
  { id: 'cups', n: 'Cup Winner', d: 'Win the Brimstone Cup', stat: 'cups', at: [1, 5, 15] },
  { id: 'hof', n: 'Immortal', d: 'Win the Cup on Hall of Fame', stat: 'hofCups', at: [1, 3, 10] },
  { id: 'allstar', n: 'All-Star Season', d: 'Win the Cup on All-Star or harder', stat: 'hardCups', at: [1, 5, 15] },
  { id: 'free', n: 'Walk-On', d: 'Win the Cup as Free Agents', stat: 'freeCups', at: [1, 3, 10] },
  { id: 'clubs', n: 'Around the League', d: 'Win the Cup with different clubs', stat: 'clubCups', set: 1, at: [2, 4, 8] },
  { id: 'games', n: 'Gamer', d: 'Win games (sports wins)', stat: 'sportsWins', at: [10, 50, 200] },
  { id: 'sports', n: 'Ten-Sport Athlete', d: 'Win a game in different sports', stat: 'sportsWon', set: 1, at: [5, 8, 10] },
  { id: 'hattrick', n: 'Hat Trick Hero', d: 'Score hat tricks', stat: 'hl_hattrick', at: [1, 5, 20] },
  { id: 'slam', n: 'Grand Slammer', d: 'Hit grand slams', stat: 'hl_grandslam', at: [1, 5, 20] },
  { id: 'walkoff', n: 'Walk-Off', d: 'Win with walk-off hits', stat: 'hl_walkoff', at: [1, 5, 20] },
  { id: 'shutout', n: 'Brick Wall', d: 'Shut a team out', stat: 'hl_shutout', at: [1, 10, 40] },
  { id: 'td', n: 'End Zone', d: 'Score touchdowns', stat: 'touchdowns', at: [5, 25, 100] },
  { id: 'highlights', n: 'Highlight Reel', d: 'Make highlights', stat: 'highlights', at: [10, 50, 200] },
  { id: 'elites', n: 'Giant Killer', d: 'Beat elites', stat: 'elites', at: [10, 50, 200] },
  { id: 'bosses', n: 'Boss Fight', d: 'Beat bosses', stat: 'bosses', at: [3, 15, 50] },
  { id: 'goals', n: 'Front Office', d: 'Complete season goal tiers', stat: 'goals', at: [5, 25, 100] },
  { id: 'practice', n: 'Practice Makes Perfect', d: 'Practice cards', stat: 'practice', at: [5, 25, 100] },
  { id: 'potg', n: 'Clutch', d: 'Win a game you trailed at the end of your first turn', stat: 'comebacks', at: [1, 10, 40] },
];
const MEDAL = ['Bronze', 'Silver', 'Gold'], MEDAL_COL = ['#c98a4a', '#c8ccd4', '#ffd166'];
function loadAch() { try { return JSON.parse(localStorage.getItem(pkey('sd-ach')) || 'null') || { stats: {}, sets: {}, got: {} }; } catch (e) { return { stats: {}, sets: {}, got: {} }; } }
let ACHS = loadAch();
function saveAch() { if (LAB) return; try { localStorage.setItem(pkey('sd-ach'), JSON.stringify(ACHS)); } catch (e) { } }
const achValue = a => a.set ? (ACHS.sets[a.stat] || []).length : ACHS.stats[a.stat] || 0;
function achAdd(stat, n) { if (LAB) return; ACHS.stats[stat] = (ACHS.stats[stat] || 0) + n; achCheck(); }
function achSet(stat, v) { if (LAB) return; const s = ACHS.sets[stat] = ACHS.sets[stat] || []; if (!s.includes(v)) s.push(v); achCheck(); }
// new medals: count them, save, and announce
function achCheck() {
  const fresh = [];
  for (const a of ACH) { const v = achValue(a), had = ACHS.got[a.id] == null ? -1 : ACHS.got[a.id]; let tier = had; while (tier < 2 && v >= a.at[tier + 1]) tier++; if (tier > had) { ACHS.got[a.id] = tier; fresh.push([a, tier]); } }
  saveAch(); for (const [a, t] of fresh) achToast(a, t);
}
// after every fight and at the end of every run
function achFight() {
  if (LAB || !B || !B.sc) return;
  if (B.type === 'elite' || B.type === 'rival') achAdd('elites', 1);
  if (B.type === 'boss') achAdd('bosses', 1);
  if (B.sc.win) { achAdd('sportsWins', 1); achSet('sportsWon', B.sport); if (B.sc.trailedT1) achAdd('comebacks', 1); }
  for (const h of B.sc.hl || []) { achAdd('hl_' + h, 1); achAdd('highlights', 1); }
  if (B.sc.td) achAdd('touchdowns', B.sc.td);
}
function achRun(result) {
  if (LAB || result !== 'win') return;
  const d = diffOf(RUN).id; achAdd('cups', 1);
  if (d === 'hof') achAdd('hofCups', 1);
  if (d === 'hof' || d === 'allstar') achAdd('hardCups', 1);
  if (RUN.club === 'free') achAdd('freeCups', 1);
  achSet('clubCups', RUN.club);
}
// a medal toast, bottom left, a few seconds each
const achQ = [];
function achToast(a, t) { achQ.push([a, t]); if (achQ.length === 1) achShow(); }
function achShow() {
  const it = achQ[0]; if (!it) return; const [a, t] = it;
  let el = $('achToast'); if (!el) { el = document.createElement('aside'); el.id = 'achToast'; el.className = 'achtoast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `${medalSVG(t, 40)}<div><small>Achievement: ${MEDAL[t]}</small><b>${esc(a.n)}</b><span>${esc(a.d)}: ${a.at[t]}</span></div>`;
  el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  try { sfx.coin(); setTimeout(() => sfx.coin(), 140); } catch (e) { }
  setTimeout(() => { el.hidden = true; achQ.shift(); if (achQ.length) setTimeout(achShow, 300); }, 3800);
}
const medalSVG = (t, s = 28) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" aria-hidden="true"><path d="M8 2h3l1 5-3 1zM16 2h-3l-1 5 3 1z" fill="#7a2a1a"/><circle cx="12" cy="15" r="7" fill="${t < 0 ? '#2a1d16' : MEDAL_COL[t]}" stroke="#21160f" stroke-width="1.5"/><path d="M12 11l1.2 2.5 2.7.3-2 1.8.6 2.7-2.5-1.4-2.5 1.4.6-2.7-2-1.8 2.7-.3z" fill="${t < 0 ? '#3e2f25' : '#fff8'}"/></svg>`;
function achHTML() {
  const got = ACH.filter(a => ACHS.got[a.id] != null), golds = ACH.filter(a => ACHS.got[a.id] === 2).length;
  return `<h3 style="margin-top:26px">Achievements <small style="color:var(--dim);font-size:16px">${got.length}/${ACH.length} earned, ${golds} gold, as ${esc(profileName())}</small></h3>
  <div class="achgrid">${ACH.map(a => { const t = ACHS.got[a.id] == null ? -1 : ACHS.got[a.id], v = achValue(a), next = t < 2 ? a.at[t + 1] : a.at[2], prev = t < 0 ? 0 : a.at[t];
    return `<div class="ach${t < 0 ? ' locked' : ''}">${medalSVG(t, 40)}<div><b>${esc(a.n)}</b><small>${esc(a.d)}</small><div class="pips">${[0, 1, 2].map(k => `<i style="background:${k <= t ? MEDAL_COL[k] : 'var(--stone2)'}" title="${MEDAL[k]}: ${a.at[k]}"></i>`).join('')}</div><div class="gbar"><i style="width:${t >= 2 ? 100 : Math.min(100, 100 * (v - prev) / Math.max(1, next - prev))}%;background:${t >= 2 ? MEDAL_COL[2] : MEDAL_COL[t + 1]}"></i></div><small>${t >= 2 ? `Gold. ${v} in all.` : `${v} / ${next} for ${MEDAL[t + 1]}`}</small></div></div>`; }).join('')}</div>`;
}
