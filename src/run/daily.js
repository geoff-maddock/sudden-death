/* p5f: the daily challenge (issue #60, phase 2). One seeded run a day, the same for everyone who plays it: the club,
   the line, the difficulty and a twist all come from the local date. Difficulty rises through the week, from Rookie on
   Sunday to Hall of Fame on Saturday. One attempt a day: starting the daily uses the day up, and a missed day can't be
   played later. Results are kept per profile in pkey('sd-daily') as { days: { 'YYYY-MM-DD': entry } }, where an entry's
   st is 'on' (started), 'win' or 'lose'. A daily started before midnight can still be finished after it.
   Wraps recordRun (saves-records.js) to write the day's result. */
const DAILY_DIFF = [0, 0, 1, 1, 2, 2, 3]; // Sunday to Saturday: Rookie, Rookie, Contender, Contender, All-Star, All-Star, Hall of Fame
// each twist runs once, at the start of the run, on its own seeded stream ('twist'), so it lands the same for everyone
const DAILY_TWISTS = {
  purse: { n: 'Deep Pockets', d: 'Start with 250 gold.', go: () => { RUN.gold = 250; } },
  heirloom: { n: 'Heirloom', d: 'Start with a second trophy, an uncommon one.', go: () => { const p = relicPool('u'); if (p.length) gainRelic(pick(p)); } },
  lean: { n: 'Lean Roster', d: 'Start with two fewer Check cards, so your best cards come round sooner.', go: () => { for (let k = 0; k < 2; k++) { const i = RUN.deck.findIndex(c => c.id === 'check'); if (i >= 0) RUN.deck.splice(i, 1); } } },
  glass: { n: 'Glass Cannon', d: 'Start with 15 less max HP and a rare attack.', go: () => { RUN.maxhp -= 15; RUN.hp = Math.min(RUN.hp, RUN.maxhp); const p = cardPool('r').filter(c => c.type === 'atk'); if (p.length) RUN.deck.push(mkCard(pick(p).id)); } },
  iron: { n: 'Iron Lungs', d: 'Start with 15 more max HP, and an Ejection Notice in your deck.', go: () => { RUN.maxhp += 15; RUN.hp += 15; RUN.deck.push(mkCard('penalty')); } },
  // (all three signature cards upgraded more than doubled the bot's wins: +22 points over no twist, test/daily_lab.py)
  scouted: { n: 'Well Scouted', d: 'One of your players’ signature cards starts upgraded.', go: () => { const sig = SIG[pick(RUN.party).kind], c = RUN.deck.find(c => c.id === sig); if (c) c.up = true; } },
  medicine: { n: 'Medicine Bag', d: 'Start with both tonic slots full.', go: () => { const k = Object.keys(TONICS); gainTonic(pick(k)); gainTonic(pick(k)); } },
  free: { n: 'Free Agents', d: 'Your line comes from the open draft class, not a club, and brings a club’s trophy.' },
};
const pad2 = n => String(n).padStart(2, '0');
function dayKey(d = new Date()) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function dayDate(key) { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); }
function dayBefore(key) { const d = dayDate(key); d.setDate(d.getDate() - 1); return dayKey(d); }
function dayName(key, long) { return dayDate(key).toLocaleDateString(undefined, long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' }); }
// the day's challenge, from the date alone. Never touches the live run's streams: it draws on its own, and for the Free
// Agents twist builds the draft class under a stand-in RUN (with B set aside), then puts both back.
// tw: another twist in place of the day's ('none' for none), for the balance bots (test/daily_lab.py); the club, the line
// and everything else stay the day's
function dailyOf(key = dayKey(), tw) {
  const date = dayDate(key), seed = seedHash(0x5d0d, 'daily:' + key);
  const s = { rng: seedHash(seed, 'setup') }, r = () => rngStep(s, 'rng'), at = a => a[(r() * a.length) | 0];
  const dayTwist = at(Object.keys(DAILY_TWISTS)), twist = tw || dayTwist, club = at(CLUB_IDS), free = twist === 'free';
  const idx = [...Array(free ? Object.keys(KIND_NAME).length : CLUBS[club].roster.length).keys()];
  for (let i = idx.length - 1; i > 0; i--) { const j = (r() * (i + 1)) | 0; [idx[i], idx[j]] = [idx[j], idx[i]]; }
  let roster = CLUBS[club].roster;
  if (free) { const r0 = RUN, b0 = B; RUN = { seed, act: 0, pos: 'draft' }; B = null; try { roster = genDraftClass(); } finally { RUN = r0; B = b0; } }
  const picks = idx.slice(0, 3);
  return { key, date, dow: date.getDay(), diff: DAILY_DIFF[date.getDay()], seed, twist, club, free, roster, picks, line: picks.map(i => roster[i]) };
}
// a new run for the day (used by the Daily tab, and by the bots without the record)
function newDailyRun(key = dayKey(), tw) {
  const D = dailyOf(key, tw);
  if (D.free) newRun('free', D.picks, D.roster, CLUBS[D.club].relic, D.seed); else newRun(D.club, D.picks, undefined, undefined, D.seed);
  RUN.path = []; RUN.diff = D.diff; RUN.daily = key; RUN.twist = D.twist;
  rngWith('twist', () => { const T = DAILY_TWISTS[D.twist]; if (T && T.go) T.go(); });
  saveRun();
  return RUN;
}
function loadDaily() { try { const d = JSON.parse(localStorage.getItem(pkey('sd-daily')) || 'null'); return d && d.days ? d : { days: {} }; } catch (e) { return { days: {} }; } }
function saveDaily(d) { if (LAB) return; try { localStorage.setItem(pkey('sd-daily'), JSON.stringify(d)); } catch (e) { } }
// start today's daily, once: false if the day is already used
function dailyStart(key = dayKey()) {
  const rec = loadDaily(); if (rec.days[key]) return false;
  const D = dailyOf(key); newDailyRun(key);
  rec.days[key] = { st: 'on', diff: D.diff, twist: D.twist, club: D.free ? 'free' : D.club, line: D.line.map(p => p[0]), t: Date.now() };
  saveDaily(rec);
  return true;
}
// days in a row with a daily played, up to today (or up to yesterday, while today's is still to play)
function dailyStreak(days, today = dayKey()) {
  let k = days[today] ? today : dayBefore(today), n = 0;
  while (days[k]) { n++; k = dayBefore(k); }
  return n;
}
// what became of a day: still on (its run is the saved one), won, lost, or abandoned (started, then the save was replaced)
function dailyState(key, e, saved = loadRun()) {
  if (!e) return 'none';
  if (e.st === 'win' || e.st === 'lose') return e.st;
  return saved && saved.daily === key ? 'on' : 'gone';
}
const recordRunNoDaily = recordRun;
recordRun = function (result) {
  const key = RUN && RUN.daily;
  recordRunNoDaily(result);
  if (!key || LAB) return;
  const rec = loadDaily(), e = rec.days[key] || (rec.days[key] = { diff: RUN.diff, twist: RUN.twist, club: RUN.club });
  Object.assign(e, { st: result, act: RUN.act, floor: RUN.floor, score: runScore(RUN), sw: RUN.stats.sportsWins || 0 });
  saveDaily(rec);
};
