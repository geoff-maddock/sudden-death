/* w19: the Journal. A Journal button in the world HUD (and the J key) opens four tabs:
     People     everyone you have talked to: where you met, when you last spoke, every topic and what they said
     Places     every place you have been, by region; places with their own rules (cups, the Crown, dungeons, lairs,
                your home ground) get a Rules box written from the game's own tables, so it stays true
     Victories  the wins that matter: cup rounds and titles, the Crown, dungeon bosses, lairs, grudge matches and
                rival clubs met on the road (ordinary wild matches are left out)
     Quests     side quests, active once their giver has mentioned the quest's keyword to you, and your players' own
   A quest filter (active quests), a keyword filter (every CAPITALISED word somebody answers to, and who said it
   first) and a search box narrow all four tabs. A CAPITALISED word in the journal is a link to its keyword filter.

   WG.journal  { people: { id: { n, at, last, said: { topic: text } } },     ('greet' is the hello)
                 places: { id: { at, last } },        (location ids from DB.locs; regions as 'r:<region>')
                 wins:   [ { at, where, k, t, opp, sport, score } ],   oldest first, at most W_JOURNAL.wins
                 words:  { WORD: { who, n, at } },
                 quests: { sideplot id: at } }        (when a side quest became active)
   at = a stamp { a: dayAbs, y: year, d: day, where }; an older save's journal is built from what the save already
   knows (places seen, cups and bosses won), with stamps marked { old: 1 }.
   Wrapped: wNewGame (a fresh journal), wSay (people, words, quests), wEnterMap and wAmbient (places and regions),
   wEncounterHook (lairs), wDispatchEnd (victories), wRenderHud (the Journal button), renderHelp (#wHelpJournal). */

const W_JOURNAL = { wins: 300, plain: ['JOB', 'NAME', 'BYE', 'YES', 'HOME'] };
const WJ = { tab: 'people', quest: '', word: '', q: '', close: null };
const W_JTABS = [['people', 'People'], ['places', 'Places'], ['wins', 'Victories'], ['quests', 'Quests']];
const W_JWIN_KIND = { cup: 'Cup round', title: 'Title', boss: 'Boss', grudge: 'Grudge', rival: 'Rival' };

/* ---------- the record ---------- */
function wJBlank() { return { people: {}, places: {}, wins: [], words: {}, quests: {} }; }
function wJ() {
  if (!WG) return null;
  if (!WG.journal) WG.journal = wJBackfill();
  return WG.journal;
}
function wJWhere() { const m = wCurMap(); if (!m) return ''; return m.kind === 'world' ? (wRegionName() || m.name) : m.name; }
function wJStamp() { return { a: WG.dayAbs, y: WG.year, d: WG.day, where: wJWhere() }; }
function wJWhen(s) {
  if (!s || s.old) return 'before this journal';
  const se = ['Spring', 'Summer', 'Autumn', 'Winter'][Math.min(3, Math.floor((s.d - 1) / 28))];
  return `${se}, day ${s.d}${s.y > 1 ? `, year ${s.y}` : ''}`;
}
/* an older save: what it already knows */
function wJBackfill() {
  const J = wJBlank(), old = { a: 0, y: WG.year, d: WG.day, where: '', old: 1 };
  for (const L of DB.locs) if (WG.flags['seen_' + L.id] || WG.map === L.map || (L.alpha && WG.flags['alpha_' + L.alpha])) J.places[L.id] = { at: old, last: old };
  for (const id in WG.cupLog || {}) {
    const C = DB.cups[id], c = WG.cupLog[id]; if (!C) continue;
    J.wins.push({ at: { a: 0, y: c.year, d: c.day, where: wTownName(C.town) }, where: wTownName(C.town), k: 'title', t: C.final ? 'Won the Crown' : `Won the ${C.name}`, opp: '', sport: '', score: '' });
  }
  for (const id in DB.alphas) if (WG.flags['alpha_' + id]) J.wins.push({ at: old, where: '', k: 'boss', t: `Beat ${DB.alphas[id].name}`, opp: '', sport: '', score: '' });
  return J;
}
function wJPlace(id) {
  const J = wJ(); if (!J || !id) return;
  const s = wJStamp(), P = J.places[id];
  if (P) P.last = s; else J.places[id] = { at: s, last: s };
}
function wJLocOfMap(map) { return DB.locs.find(l => l.map === map) || null; }

/* every topic key anybody answers to: a CAPITALISED word is a keyword if somebody would answer it (wFindTopic's rule) */
let wJTopicSet = null;
function wJAnswered(w) {
  if (!wJTopicSet) { wJTopicSet = new Set(); for (const id in DB.chars) for (const k in DB.chars[id].topics || {}) wJTopicSet.add(k); }
  const k = w.toLowerCase();
  if (W_JOURNAL.plain.includes(w)) return false;
  if (wJTopicSet.has(k)) return true;
  if (k.length < 4) return false;
  for (const x of wJTopicSet) if (x.startsWith(k.slice(0, 4))) return true;
  return false;
}
function wJCaps(text) { return [...new Set(String(text || '').match(/\b[A-Z]{3,}\b/g) || [])]; }

/* a side quest's givers (the people named in its `who`), and its keywords (the CAPITALISED words in its hint) */
let wJGiverMap = null;
function wJGivers(sp) {
  if (!wJGiverMap) {
    wJGiverMap = {};
    // by full name, or first and last word ("Captain Lull Marrowbone" gives quests as "Captain Marrowbone")
    const says = n => { const w = n.split(' '); return w.length > 2 ? [n, w[0] + ' ' + w[w.length - 1]] : [n]; };
    for (const s of DB.sideplots) wJGiverMap[s.id] = Object.keys(DB.chars).filter(id => { const n = DB.chars[id].name; return typeof n === 'string' && n[0] !== '@' && says(n).some(x => s.who.includes(x)); });
  }
  return wJGiverMap[sp.id] || [];
}
function wJHintWords(sp) { return wJCaps(sp.hint).filter(w => !W_JOURNAL.plain.includes(w)); }

function wJHeard(id, kw, r) {
  const J = wJ(); if (!J) return;
  const ch = wChar(id), s = wJStamp();
  let P = J.people[id];
  if (!P) P = J.people[id] = { n: ch.name, at: s, last: s, said: {} };
  P.last = s; P.n = ch.name;
  const key = !kw ? 'greet' : kw === 'name' ? null : r.key;
  if (key) P.said[key] = r.text;
  for (const w of wJCaps(r.text)) if (!J.words[w] && wJAnswered(w)) J.words[w] = { who: id, n: ch.name, at: s };
  // a side quest goes active when its giver mentions its keyword, or you ask them about it
  for (const sp of DB.sideplots) {
    if (J.quests[sp.id] || wFlag(sp.id) || !wJGivers(sp).includes(id)) continue;
    const ws = wJHintWords(sp);
    if (ws.some(w => String(r.text).includes(w) || (r.key && wFindTopic(ch, w.toLowerCase()) === r.key))) {
      J.quests[sp.id] = s;
      wLog(`In your journal: ${sp.title}.`, 'm');
    }
  }
}
function wJAddWin(e) {
  const J = wJ(); if (!J) return;
  J.wins.push(e);
  if (J.wins.length > W_JOURNAL.wins) J.wins.splice(0, J.wins.length - W_JOURNAL.wins);
}
function wJWin(W, cup) {
  const ref = W.ref || {}, gs = (RUN && RUN.games) || [], g = gs[gs.length - 1] || null;
  const base = { at: wJStamp(), where: wJWhere(), sport: (g && g.sport) || W.sport || '', score: g ? gameScore(g) : '' };
  if (W.kind === 'cup' && ref.cup && DB.cups[ref.cup]) {
    const C = DB.cups[ref.cup];
    const opp = ref.club ? wClubName(ref.club) : (W.name || W.foes || '');
    wJAddWin(Object.assign({}, base, { k: 'cup', t: `${C.name}, round ${ref.round + 1} of 3`, opp }));
    if (cup && cup.id === ref.cup && cup.round === 2 && !WG.cup && wFlag(C.flag)) wJAddWin(Object.assign({}, base, { k: 'title', t: C.final ? 'Won the Crown' : `Won the ${C.name}`, opp: '' }));
  } else if ((W.kind === 'alpha' || W.kind === 'lair') && ref.alpha && DB.alphas[ref.alpha]) {
    wJAddWin(Object.assign({}, base, { k: 'boss', t: `Beat ${DB.alphas[ref.alpha].name}`, opp: W.name || wCap(DB.alphas[ref.alpha].name) }));
  } else if (W.kind === 'event' && ref.rival) {
    wJAddWin(Object.assign({}, base, ref.grudge ? { k: 'grudge', t: `Grudge match against ${wTheClub(ref.rival)}`, opp: wClubName(ref.rival) }
      : { k: 'rival', t: `Beat ${wTheClub(ref.rival)} on the road`, opp: wClubName(ref.rival) }));
  }
}

/* ---------- wrappers ---------- */
const wW19NewGame = wNewGame;
wNewGame = function (opts) {
  const r = wW19NewGame(opts);
  WG.journal = wJBlank();
  const L = wJLocOfMap(WG.map); if (L) wJPlace(L.id);
  return r;
};
const wW19Say = wSay;
wSay = function (id, kw) {
  const r = wW19Say(id, kw);
  try { if (WG && r && r.text != null) wJHeard(id, (kw || '').trim().toLowerCase(), r); } catch (e) { console.error(e); }
  return r;
};
const wW19EnterMap = wEnterMap;
wEnterMap = function (id, x, y) {
  const r = wW19EnterMap(id, x, y);
  try {
    if (WG) { if (id === 'world') wJPlace('r:' + wRegionHere()); else { const L = wJLocOfMap(id); if (L) wJPlace(L.id); } }
  } catch (e) { console.error(e); }
  return r;
};
const wW19Ambient = wAmbient;
wAmbient = function (m, preReg) {
  wW19Ambient(m, preReg);
  if (WG && m && m.kind === 'world') wJPlace('r:' + wRegionHere());
};
const wW19EncounterHook = wEncounterHook;
wEncounterHook = function (region, tileCh, info) {
  if (WG && info && info.kind === 'lair' && info.loc) wJPlace(info.loc);
  return wW19EncounterHook(region, tileCh, info);
};
const wW19DispatchEnd = wDispatchEnd;
wDispatchEnd = function (W, r) {
  const cup = WG && WG.cup ? { id: WG.cup.id, round: WG.cup.round } : null;
  wW19DispatchEnd(W, r);
  try { if (W && WG && r === 'win') { wJWin(W, cup); wSave(); } } catch (e) { console.error(e); }
};

/* ---------- the rules of a place, from the game's own tables ---------- */
function wJRules(id) {
  const L = DB.locs.find(l => l.id === id), out = []; if (!L) return out;
  for (const cid in DB.cups) {
    const C = DB.cups[cid]; if (C.town !== id) continue;
    if (C.final) {
      const P = W_CUP.crown.prize;
      out.push(`<b>The Crown.</b> Entries in championship week only (the last ${DB.meta.champWeek} days of the year), and only with all four town cups won. Three rounds: two rival clubs, then ${esc(DB.apex.name)}. A win pays ${P.gold} gold and ${P.fans} fans, and makes you champion of the realm.${wFlag(C.flag) ? ' <span class="wjok">Won.</span>' : ` You have ${wCupsWon()} of 4 cups.`}`);
    } else {
      const P = W_CUP.prize;
      out.push(`<b>${esc(C.name)}.</b> ${W_CUP.fee} gold to enter, with the registrar. Three rounds back to back: a local side, a seeded team with a trick or two, then a rival club. Lose once and you are out (enter again for the fee). A win pays ${P.gold} gold, ${P.fans} fans and a pick of ${P.pick} rare cards, and goes on the Wall of Awards.${wFlag(C.flag) ? ' <span class="wjok">Won.</span>' : ''}`);
    }
  }
  const D = DB.dungeons.find(d => d.id === id);
  if (D) {
    const a = DB.alphas[D.alpha], rooms = (MAPS[id] && wDungeonRooms(id).length) || D.rooms, left = MAPS[id] ? wRoomsLeft(id).length : rooms;
    const ch = DB.chests[id + '_prize'], beaten = wFlag('alpha_' + D.alpha);
    out.push(`<b>${esc(D.name)}.</b> ${rooms} rooms, each held by a famous team; a room you beat stays beaten. ${W_DUNGEON.alphaNeedsRooms ? `Beat every room and ${esc(a.name)} plays you in the deepest.` : `${wCap(esc(a.name))} waits in the deepest room.`} ${wJGate(id)} The prize chest holds ${ch && ch.gold ? ch.gold + ' gold and ' : ''}magic gear.${beaten ? ' <span class="wjok">Beaten.</span>' : ` Rooms left: ${left}.`}`);
  }
  if (L.kind === 'lair' && DB.alphas[L.alpha]) {
    const a = DB.alphas[L.alpha];
    out.push(`<b>${esc(L.name)}.</b> The lair of ${esc(a.name)}, a boss match on the spot, with no rooms to clear. ${wJGate(id)} A win pays magic gear from its hoard.${wFlag('alpha_' + L.alpha) ? ' <span class="wjok">Beaten.</span>' : ''}`);
  }
  const G = wHomeGround();
  if (G && G.town === id) {
    const parts = Object.keys(W_GROUND.parts).map(k => { const lv = wGroundLv(k), P = W_GROUND.parts[k]; return lv ? `${esc(P.name)}: ${esc(P.does[lv - 1])}` : null; }).filter(Boolean);
    out.push(`<b>Your home ground.</b> Matches in this region have the home crowd behind you. ${parts.length ? parts.join(' ') : 'No upgrades yet: ask at the inn.'}`);
  }
  return out;
}
function wJGate(id) {
  const G = W_GATE[id]; if (!G || (!G.cups && !G.key)) return '';
  const need = [];
  if (G.cups) need.push(`${G.cups} cup${G.cups === 1 ? '' : 's'} won`);
  if (G.key) need.push(`the ${DB.items[G.key].name}`);
  return `To get in: ${need.join(' and ')}${wGateCheck(id).ok ? ' (you can)' : ''}.`;
}

/* ---------- filters ---------- */
function wJActiveQuests() {
  const J = wJ(), out = [];
  for (const sp of DB.sideplots) if (J.quests[sp.id] && !wFlag(sp.id)) out.push({ id: sp.id, t: sp.title, sp });
  for (const p of wRoster()) if (p.pq && ['offer', 'go', 'home'].includes(p.pq.st)) out.push({ id: 'p:' + p.id, t: `${p.n}'s quest`, p });
  return out;
}
/* what the chosen quest points at: its people, the CAPITALISED words of its hint, and the places it names */
function wJQuestNeedle(qid) {
  if (!qid) return null;
  if (qid.startsWith('p:')) {
    const p = wPlayer(+qid.slice(2)); if (!p) return null;
    return { people: [qid], words: [], names: [wTownName(wEnsureHome(p))] };
  }
  const sp = DB.sideplots.find(s => s.id === qid); if (!sp) return null;
  const txt = (sp.hint + ' ' + sp.who).toLowerCase();
  const names = [...DB.locs.map(l => l.name), ...Object.values(DB.alphas).map(a => a.name)].filter(n => txt.includes(n.toLowerCase().replace(/^the /, '')));
  return { people: wJGivers(sp), words: wJHintWords(sp), names };
}
function wJHasWord(text, w, caseSens) { return new RegExp('\\b' + w + '\\b', caseSens ? '' : 'i').test(text || ''); }
/* does an entry pass the quest, keyword and search filters? kind: 'person' | 'place' | 'win' | 'quest' */
function wJPass(kind, id, text) {
  const N = wJQuestNeedle(WJ.quest);
  if (N) {
    const capsHit = N.words.some(w => wJHasWord(text, w, true)), nameHit = N.names.some(n => text.toLowerCase().includes(n.toLowerCase().replace(/^the /, '')));
    const ok = kind === 'person' ? N.people.includes(id) || capsHit
      : kind === 'quest' ? id === WJ.quest
      : nameHit || N.words.some(w => wJHasWord(text, w, false));
    if (!ok) return false;
  }
  if (WJ.word) {
    const w = WJ.word;
    const ok = kind === 'person' ? wJHasWord(text, w, true) || !!wFindTopic(wChar(id), w.toLowerCase())
      : kind === 'quest' ? wJHasWord(text, w, true)
      : wJHasWord(text, w, false);
    if (!ok) return false;
  }
  if (WJ.q && !text.toLowerCase().includes(WJ.q.toLowerCase())) return false;
  return true;
}
/* CAPITALISED words become keyword links; the chosen word and the quest's words are marked */
function wJText(t) {
  const N = wJQuestNeedle(WJ.quest), hot = [WJ.word, ...(N ? N.words : [])].filter(Boolean);
  return esc(t || '').replace(/\b[A-Z]{3,}\b/g, w => {
    const known = wJ().words[w];
    if (!known) return w;
    return `<button class="wjkw${hot.includes(w) ? ' on' : ''}" data-jword="${w}">${w}</button>`;
  });
}

/* ---------- the tabs ---------- */
function wJPortrait(id) {
  const pid = wTalkPid(id), p = pid != null && wPlayer(pid);
  if (p) return wPlayerPort(p, 64);
  const ch = wChar(id); return portraitURL(ch.kind, wNpcTeam(ch.kind), '', 64);
}
function wJTopicName(k) { return k === 'greet' ? 'Hello' : wCap(k); }
function wJPeople() {
  const J = wJ(), filt = !!(WJ.quest || WJ.word || WJ.q);
  const rows = Object.keys(J.people).map(id => {
    const P = J.people[id], text = P.n + ' ' + Object.values(P.said).join(' ') + ' ' + (P.at.where || '');
    return { id, P, text };
  }).filter(x => wJPass('person', x.id, x.text)).sort((a, b) => (b.P.last.a || 0) - (a.P.last.a || 0));
  if (!rows.length) return [0, `<p class="hint">${Object.keys(J.people).length ? 'Nobody you have talked to fits.' : 'Nobody yet. Walk into people to talk to them.'}</p>`];
  return [rows.length, rows.map(({ id, P }) => {
    const mine = wTalkPid(id) != null;
    return `<details class="wjp" ${filt ? 'open' : ''}><summary><img src="${wJPortrait(id)}" alt=""><span><b>${esc(P.n)}</b>${mine ? ' <small class="wjtag">your team</small>' : ''}
      <small>Met ${P.at.where ? 'in ' + esc(P.at.where) + ', ' : ''}${wJWhen(P.at)}. Last spoke ${wJWhen(P.last)}${P.last.where && P.last.where !== P.at.where ? ' in ' + esc(P.last.where) : ''}.</small></span></summary>
      <dl>${Object.keys(P.said).map(k => `<dt>${esc(wJTopicName(k))}</dt><dd>${wJText(P.said[k])}</dd>`).join('')}</dl></details>`;
  }).join('')];
}
function wJPlaces() {
  const J = wJ(), W = MAPS.world, groups = {};
  for (const id in J.places) {
    if (id.startsWith('r:')) continue;
    const L = DB.locs.find(l => l.id === id); if (!L) continue;
    const rg = W ? wRegion(W, L.x, L.y) : 'plains', rules = wJRules(id);
    const text = L.name + ' ' + rules.join(' ').replace(/<[^>]+>/g, '') + ' ' + ((DB.regions[rg] || {}).name || '');
    if (!wJPass('place', id, text)) continue;
    (groups[rg] = groups[rg] || []).push({ L, P: J.places[id], rules });
  }
  let n = 0;
  const html = Object.keys(DB.regions).filter(rg => groups[rg] || (J.places['r:' + rg] && !(WJ.quest || WJ.word || WJ.q))).map(rg => {
    const R = DB.regions[rg], seen = J.places['r:' + rg], list = (groups[rg] || []).sort((a, b) => (a.P.at.a || 0) - (b.P.at.a || 0));
    n += list.length;
    return `<section class="wjreg"><h4>${esc(R.name)}${seen ? ` <small>first there ${wJWhen(seen.at)}</small>` : ''}</h4>
      ${list.map(({ L, P, rules }) => `<div class="wjplace"><b>${esc(L.name)}</b> <small>First visit ${wJWhen(P.at)}; last ${wJWhen(P.last)}.</small>
        ${rules.length ? `<div class="wjrules"><h5>Rules</h5>${rules.map(r => `<p>${r}</p>`).join('')}</div>` : ''}</div>`).join('') || '<p class="hint">Only the open country so far.</p>'}</section>`;
  }).join('');
  return [n, html || '<p class="hint">No places fit.</p>'];
}
function wJWins() {
  const J = wJ();
  const rows = J.wins.map((e, i) => ({ e, i, text: [e.t, e.opp, e.where, e.sport && SPORT_NAME[e.sport], e.score].filter(Boolean).join(' ') }))
    .filter(x => wJPass('win', x.i, x.text)).reverse();
  if (!rows.length) return [0, `<p class="hint">${J.wins.length ? 'No victories fit.' : 'No big wins yet. Cups, bosses, lairs, grudge matches and rival clubs go here.'}</p>`];
  return [rows.length, `<ul class="wjwins">${rows.map(({ e }) => `<li><span class="wjk wjk-${e.k}">${W_JWIN_KIND[e.k] || ''}</span><div><b>${esc(e.t)}</b>
    <small>${wJWhen(e.at)}${e.where ? ', ' + esc(e.where) : ''}${e.opp ? ' &middot; against ' + esc(e.opp) : ''}${e.sport ? ' &middot; ' + esc(SPORT_NAME[e.sport] || e.sport) : ''}${e.score ? ' &middot; ' + esc(e.score) : ''}</small></div></li>`).join('')}</ul>`];
}
function wJQuests() {
  const J = wJ(), act = [], done = [];
  for (const sp of DB.sideplots) {
    const on = J.quests[sp.id], fin = wFlag(sp.id); if (!on && !fin) continue;
    const text = `${sp.title} ${sp.who} ${sp.hint} ${sp.pay}`;
    if (!wJPass('quest', sp.id, text)) continue;
    const h = `<div class="wjq${fin ? ' done' : ''}"><b>${esc(sp.title)}</b> <small>${esc(sp.who)}${on ? ` &middot; since ${wJWhen(on)}` : ''}</small>
      <p>${wJText(sp.hint)}</p><p class="hint">Reward: ${esc(sp.pay)}</p></div>`;
    (fin ? done : act).push(h);
  }
  for (const p of wRoster()) {
    const q = p.pq; if (!q) continue;
    const id = 'p:' + p.id, text = `${p.n} ${wNameOf(p)} ${wQuestLine(p)} ${wTownName(wEnsureHome(p))}`;
    if (!wJPass('quest', id, text)) continue;
    const h = `<div class="wjq${q.st === 'done' ? ' done' : ''}"><b>${esc(p.n)}'s quest</b> <small>your team${q.st === 'offer' ? ' &middot; offered, not yet taken' : ''}</small><p>${esc(wQuestLine(p))}</p>
      <p class="hint">Reward: a nickname, and ${esc(p.n)}'s signature card.</p></div>`;
    (q.st === 'done' ? done : act).push(h);
  }
  const n = act.length + done.length;
  if (!n) return [0, '<p class="hint">No quests yet. People mention them: listen for the CAPITALISED words.</p>'];
  return [n, `${act.length ? `<h4>Active</h4>${act.join('')}` : ''}${done.length ? `<h4>Done</h4>${done.join('')}` : ''}`];
}

/* ---------- the screen ---------- */
function wOpenJournal(tab) {
  if (!WG || !RUN) return;
  wJ();
  if (tab) WJ.tab = tab;
  WJ.close = modal(`<header><h3>Journal</h3><div class="row"><div class="filters wjtabs" role="tablist" style="margin:0">${W_JTABS.map(([k, n]) => `<button role="tab" data-jtab="${k}">${n} <small></small></button>`).join('')}</div>
    <button class="ghost" data-close>Close</button></div></header>
    <div class="wjbar"><label>Quest <select id="wJQuest"></select></label><label>Keyword <select id="wJWord"></select></label>
      <input id="wJFind" type="search" placeholder="Search&hellip;" aria-label="Search the journal" autocomplete="off"></div>
    <p class="hint wjwhy" id="wJWhy"></p>
    <div class="wjbody" id="wJBody"></div>`, () => {
    // the search box keeps focus when the box closes, and the world's keys ignore a focused input
    const a = document.activeElement; if (a && a.id === 'wJFind') a.blur();
    WJ.close = null; WUI.hudKey = ''; wDrain();
  });
  const box = $('modalBox');
  box.querySelectorAll('[data-jtab]').forEach(b => b.onclick = () => { WJ.tab = b.dataset.jtab; wRenderJournal(); });
  $('wJQuest').onchange = e => { WJ.quest = e.target.value; wRenderJournal(); };
  $('wJWord').onchange = e => { WJ.word = e.target.value; wRenderJournal(); };
  const f = $('wJFind'); f.value = WJ.q;
  f.oninput = () => { WJ.q = f.value.trim(); wRenderJournal(); };
  f.onkeydown = e => e.stopPropagation();
  wRenderJournal();
}
function wRenderJournal() {
  const body = $('wJBody'); if (!body) return;
  const J = wJ(), act = wJActiveQuests();
  if (WJ.quest && !act.some(q => q.id === WJ.quest)) WJ.quest = '';
  if (WJ.word && !J.words[WJ.word]) WJ.word = '';
  $('wJQuest').innerHTML = `<option value="">All</option>${act.map(q => `<option value="${q.id}" ${q.id === WJ.quest ? 'selected' : ''}>${esc(q.t)}</option>`).join('')}`;
  const words = Object.keys(J.words).sort();
  $('wJWord').innerHTML = `<option value="">All</option>${words.map(w => `<option value="${w}" ${w === WJ.word ? 'selected' : ''}>${w}</option>`).join('')}`;
  const why = [];
  if (WJ.word) { const W = J.words[WJ.word]; why.push(`<b>${WJ.word}</b>: first heard from ${esc(W.n)}${W.at.where ? ' in ' + esc(W.at.where) : ''}, ${wJWhen(W.at)}.`); }
  if (WJ.quest) { const N = wJQuestNeedle(WJ.quest); if (N && N.words.length) why.push(`Showing what touches ${N.words.map(w => `<b>${w}</b>`).join(', ')}${N.names.length ? ' and ' + N.names.map(esc).join(', ') : ''}.`); }
  if (WJ.quest || WJ.word || WJ.q) why.push('<button class="ghost wjclr" id="wJClear">Clear filters</button>');
  $('wJWhy').innerHTML = why.join(' ');
  if ($('wJClear')) $('wJClear').onclick = () => { WJ.quest = ''; WJ.word = ''; WJ.q = ''; $('wJFind').value = ''; wRenderJournal(); };
  const tabs = { people: wJPeople(), places: wJPlaces(), wins: wJWins(), quests: wJQuests() };
  $('modalBox').querySelectorAll('[data-jtab]').forEach(b => {
    const on = b.dataset.jtab === WJ.tab; b.setAttribute('aria-pressed', on); b.setAttribute('aria-selected', on);
    b.querySelector('small').textContent = tabs[b.dataset.jtab][0];
  });
  body.innerHTML = tabs[WJ.tab][1];
  body.querySelectorAll('[data-jword]').forEach(b => b.onclick = e => { e.preventDefault(); WJ.word = WJ.word === b.dataset.jword ? '' : b.dataset.jword; wRenderJournal(); });
}

/* the Journal button, beside Team; J opens it */
const wW19RenderHud = wRenderHud;
wRenderHud = function () {
  wW19RenderHud();
  if (!WUI.built || !WG) return;
  const team = $('wCampBtn');
  if (team && !$('wJournalBtn')) {
    team.insertAdjacentHTML('afterend', `<button class="ghost wcampb" id="wJournalBtn" title="Journal: people, places, victories and quests (J)">Journal</button>`);
    $('wJournalBtn').onclick = () => { if (wActive()) wOpenJournal(); };
  }
};
document.addEventListener('keydown', e => {
  if ((e.key === 'j' || e.key === 'J') && wActive() && !WUI.talk && !(e.target.closest && e.target.closest('input,textarea,select')) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); wOpenJournal(); }
});

const wW19RenderHelp = renderHelp;
renderHelp = function () {
  wW19RenderHelp();
  const sec = $('wHelp'); if (!sec || $('wHelpJournal')) return;
  sec.insertAdjacentHTML('beforeend', `<div id="wHelpJournal"><h4>The journal</h4>
    <p class="hint"><b>Journal</b> (<kbd>J</kbd>) keeps your journey. <b>People</b>: everyone you have talked to, and everything they told you. <b>Places</b>: everywhere you have been, by region, with the rules of the places that have their own (cups, the Crown, dungeons, lairs, your home ground). <b>Victories</b>: cup rounds and titles, bosses, lairs, grudge matches and rival clubs. <b>Quests</b>: a side quest goes in once the person who gives it mentions its CAPITALISED word to you; your players' own quests are there too.</p>
    <p class="hint">Pick an active quest to see only what touches it, or a keyword (every CAPITALISED word somebody answers to) to see who said it and where it leads. Tap a CAPITALISED word in the journal to do the same.</p></div>`);
};
