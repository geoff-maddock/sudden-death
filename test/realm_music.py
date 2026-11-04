# Realm ambient music (issue #28, phases 1 to 4): the plan (a seeded stream of chords, motif fragments, accents and gusts:
# the chord walk never stands still, no fragment twice in a row, long rests, no 4-bar stretch repeats, the same seed
# plays the same and another day differs), when the bed plays (the Charter Plains by day in Ambient; tunes elsewhere,
# in matches and in Classic; nothing with Music off or in LAB), the voice cap, the Music style setting and How to
# play. Phase 2, the mood: wMusicMood in each case (a quiet road, off the road, night, fog, a blizzard, an ash storm,
# low HP, tired legs, an alpha, a lair, a dungeon, a town, a site, a ground, a grudge), the intensity easing up fast
# and down slow, and the plan at each intensity (the pulse, the grid, shorter gaps, no birds) and at night (an owl, a
# lower pad); live, low HP swells the bed and it settles after. Phase 3, every land: each palette is complete and
# its own (scale, root, texture), the regions, towns, dungeons and the night road get theirs (sites and grounds keep
# their tunes), each one's plan uses only its own sounds and register, the night takes The Night Road's fragments
# and crickets, the weather is heard (fog's foghorn, ash's crackle, the blizzard's shimmer), every sound plays, and
# walking from one region to the next crossfades. Phase 4, special places: the five secret sites, the abbey, the Hall
# of Legends and a lair's door have their own palettes, every ground's map plays a bed on the ground's tune, and the
# whole tune is stated now and then (every 5 to 10 minutes by chance, never in danger; on arriving in a region; at
# dawn, once a day).
# The audio runs for real (Chromium with autoplay allowed). Asserts; exits nonzero on failure.
import asyncio, json, sys, subprocess, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

HELP = r'''
window.__wspot = function (rg, road) { const m = MAPS.world, hq = DB.locs.find(l => l.id === 'graftonbury'); let best = null, bd = 1e9;
  for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) { if (regionAt(x, y) !== rg) continue; const c = wTileAt(m, x, y), td = DB.tiles[c]; if (!(td && td.walk && !td.enter)) continue;
    if (road ? (c !== '=' && c !== 'b') : (c === '=' || c === 'b')) continue;
    const d = Math.hypot(x - hq.x, y - hq.y); if (d < bd) { bd = d; best = [x, y]; } } return best; };
window.__go = function (rg, hour, road) { const p = __wspot(rg, road); wEnterMap('world', p[0], p[1]); WG.min = (hour == null ? 12 : hour) * 60; WG.grace = 99; wDrain(); return p; };
window.__wbot = function (maxTurns) {
  let g = 0;
  while (B && !B.over && g++ < (maxTurns || 60)) {
    let guard = 0;
    while (B.phase === 'player' && !B.over && guard++ < 30) {
      const al = alive(); if (!al.length) break;
      const tgt = al.slice().sort((a, b) => (a.hp + a.block) - (b.hp + b.block))[0];
      let best = -1, bs = -1;
      B.hand.forEach((c, i) => { if (!canPlay(c)) return; const d = def(c); if (d.type === 'junk' || d.type === 'curse') return; const s = d.type === 'atk' ? 3 : d.type === 'pow' ? 2 : 1; if (s > bs) { bs = s; best = i; } });
      if (best < 0) break;
      playCard(best, B.enemies.indexOf(tgt));
    }
    if (B.over) break;
    runSteps(endTurn());
  }
  return B && B.over;
};
window.__closeAll = function () { WG.wprompts = []; WG.cardOffer = null; let n = 0;
  while (!document.getElementById('modal').hidden && n++ < 8) (document.querySelector('#modalBox [data-close]') || document.querySelector('#modalBox #wWake') || document.querySelector('#modalBox #wNotYet') || document.getElementById('modal')).click();
  WG.wprompts = []; WG.cardOffer = null; return document.getElementById('modal').hidden; };
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS)); tipQ.length = 0; if (document.getElementById('coach')) document.getElementById('coach').hidden = true"
T = 30000
W_ARRIVE = 8

async def boot(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof wStart === 'function' && !!document.getElementById('bNew')", timeout=T)
    await pg.add_script_tag(content=HELP)
    await pg.evaluate(NOTIPS)
    await pg.click('#bNew')
    await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')", timeout=T)
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo', timeout=T)
    await pg.click('#wGo')
    await pg.wait_for_function("WG && RUN && UI.view === 'world'", timeout=T)
    await pg.evaluate(NOTIPS)
    await pg.evaluate("__closeAll()")

async def plan_checks(pg):
    p = await pg.evaluate("""(() => {
      const P = W_AMB_PAL.plains, bar = 4 * 60 / P.bpm, a = wAmbPlan('plains', 1, 3600), b = wAmbPlan('plains', 1, 3600), c = wAmbPlan('plains', 2, 3600);
      const ch = a.filter(e => e.k === 'chord'), mo = a.filter(e => e.k === 'motif'), ac = a.filter(e => e.k === 'acc'), th = a.filter(e => e.k === 'theme');
      const o = { same: JSON.stringify(a) === JSON.stringify(b), differs: JSON.stringify(ch.slice(0, 20).map(e => e.deg)) !== JSON.stringify(c.filter(e => e.k === 'chord').slice(0, 20).map(e => e.deg)),
        first: ch[0].deg, chords: ch.length, still: 0, badLen: 0, motifs: mo.length, twice: 0, sameStart: 0, gaps: [], share: 0, badFrag: 0, vars: {}, answers: 0, acc: {}, accGaps: [], repeats: 0, windows: 0 };
      for (let i = 1; i < ch.length; i++) { if (ch[i].deg === ch[i - 1].deg) o.still++; const d = ch[i].t - ch[i - 1].t; if (![2, 3, 4].some(n => Math.abs(d - n * bar) < 1e-6)) o.badLen++; }
      for (let i = 0; i < mo.length; i++) {
        const m = mo[i], [st, L, v] = m.frag.split('.'); o.vars[v] = 1; if (m.answer) o.answers++;
        if (m.notes.length !== (m.answer ? 2 : 1) * +L || +L < 2 || +L > 5) o.badFrag++;
        o.share += m.dur;
        // a gap with the whole tune in it is the tune's, not the motif's rest
        if (i) { if (m.frag === mo[i - 1].frag) o.twice++; if (st === mo[i - 1].frag.split('.')[0]) o.sameStart++; if (!th.some(e => e.t > mo[i - 1].t && e.t < m.t)) o.gaps.push(m.t - (mo[i - 1].t + mo[i - 1].dur)); }
      }
      o.share /= 3600;
      for (let i = 0; i < ac.length; i++) { o.acc[ac[i].a] = (o.acc[ac[i].a] || 0) + 1; if (i) o.accGaps.push(ac[i].t - ac[i - 1].t); }
      // 4-bar stretches: what plays in each, against the one before
      const sig = w => a.filter(e => e.k !== 'gust' && e.t >= w * 4 * bar && e.t < (w + 1) * 4 * bar).map(e => [e.k, e.deg, e.frag, e.a, Math.round(e.t - w * 4 * bar)].join(':')).join('|');
      let prev = null; for (let w = 0; w < 3600 / (4 * bar); w++) { const s = sig(w); if (s && s === prev) o.repeats++; if (s) o.windows++; prev = s; }
      o.gapMin = Math.min(...o.gaps); o.gapMax = Math.max(...o.gaps); o.accMin = Math.min(...o.accGaps); o.accMax = Math.max(...o.accGaps); delete o.gaps; delete o.accGaps;
      WG.dayAbs = 10; const s1 = wAmbSeed('plains'); WG.dayAbs = 11; const s2 = wAmbSeed('plains'); WG.dayAbs = 10; o.seedDay = s1 !== s2;
      return o; })()""")
    check(p['same'], 'the same seed plans the same music')
    check(p['differs'] and p['seedDay'], 'another seed, or another day, plans different music', p)
    check(p['first'] == 0 and p['chords'] > 200 and p['still'] == 0, 'the pad starts on the home chord and never stays on a chord twice in a row', p)
    check(p['badLen'] == 0, 'a chord lasts 2, 3 or 4 bars', p)
    check(p['motifs'] > 40 and p['badFrag'] == 0, 'motif fragments are 2 to 5 notes of the tune (twice that when answered)', p)
    check(p['twice'] == 0 and p['sameStart'] == 0, 'no fragment twice in a row, nor from the same place in the tune', p)
    check(p['gapMin'] >= 20 - 1e-6 and p['gapMax'] <= 60 + 1e-6, 'calm, the motif rests 20 to 60 seconds between fragments', p)
    check(p['share'] < .3, 'and plays under 30% of the time', p)
    check(len(p['vars']) >= 5 and p['answers'] > 5, 'fragments are varied (moved, turned over, stretched, played backwards) and some are answered', p)
    check(p['acc'].get('bell', 0) > 10 and p['acc'].get('lark', 0) > 10 and p['accMin'] >= 25 - 1e-6 and p['accMax'] <= 70 + 1e-6, 'a bell and a lark now and then, 25 to 70 seconds apart', p)
    check(p['windows'] > 200 and p['repeats'] == 0, 'over an hour, no 4-bar stretch is the same as the one before', p)

async def mood_checks(pg):
    m = await pg.evaluate("""(() => { const o = {}, mood = () => { const x = wMusicMood(); return { place: x.place, site: x.site, palette: x.palette, i: x.intensity, tint: x.tint, why: x.why }; };
      __go('plains', 12, true); o.road = mood();
      __go('plains', 12, false); o.off = mood();
      __go('plains', 23, false); o.night = mood();
      WG.wx = { day: WG.dayAbs, by: { tide: 'fog', rime: 'blizzard', ember: 'ash' } };
      __go('tide', 12, false); o.fog = mood();
      __go('rime', 12, false); o.blizzard = mood();
      __go('ember', 12, false); o.ash = mood();
      __go('plains', 12, true); const hp = RUN.hp; RUN.hp = Math.round(RUN.maxhp * .1); o.hurt = mood(); RUN.hp = hp;
      const legs = wStarters().map(p => p.legs); wStarters().forEach(p => p.legs = W_FAT.tired); o.tired = mood(); wStarters().forEach((p, i) => p.legs = legs[i]);
      WG.grudge = { club: Object.keys(WG.league ? WG.league.clubs || {} : {})[0] || 'x', day: WG.dayAbs, n: '' }; o.grudge = mood(); WG.grudge = null;
      const L = DB.locs.find(l => l.kind === 'lair'); wEnterMap('world', L.x + 1, L.y); WG.min = 12 * 60; o.lair = mood();
      const h = MAPS.hatchery; wEnterMap('hatchery', h.spawn[0], h.spawn[1]); o.dungeon = mood();
      let ax = 0, ay = 0; h.t.forEach((row, y) => row.forEach((c, x) => { if (c === 'M') { ax = x; ay = y; } }));
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [ax + dx, ay + dy]).find(([x, y]) => (DB.tiles[h.t[y][x]] || {}).walk) || [ax, ay + 1];
      wEnterMap('hatchery', nb[0], nb[1]); o.alpha = mood();
      const g = MAPS.graftonbury; wEnterMap('graftonbury', g.spawn[0], g.spawn[1]); o.town = mood();
      const sm = MAPS.marigold; wEnterMap('marigold', sm.spawn[0], sm.spawn[1]); o.site = mood();
      wEnterMap('g_ballpark', 12, 5); o.ground = mood();
      __go('plains', 12, true); WG.wx = null; return o; })()""")
    check(m['road']['place'] == 'world' and m['road']['palette'] == 'plains' and m['road']['i'] < .05 and m['road']['why'] == [], 'a road on the plains by day: calm, the plains palette, no threat', m['road'])
    check(0 < m['off']['i'] < .35 and 'wild' in m['off']['why'], 'off the road, the odds of a wild team raise it a little', m['off'])
    check(m['night']['tint']['night'] and 'night' in m['night']['why'] and m['night']['i'] > m['off']['i'], 'night off the road is tenser, and tinted night', m['night'])
    check(m['fog']['tint']['wx'] == 'fog' and 'fog' in m['fog']['why'], 'fog by day off the road is a threat (ambushes), and tints the mood', m['fog'])
    check(m['blizzard']['tint']['wx'] == 'blizzard' and m['ash']['tint']['wx'] == 'ash', 'a blizzard and an ash storm tint it', [m['blizzard']['tint'], m['ash']['tint']])
    check(m['hurt']['tint']['hurt'] and 'hurt' in m['hurt']['why'] and m['hurt']['i'] > .6, 'low team HP turns it toward danger', m['hurt'])
    check(m['tired']['tint']['tired'] and m['tired']['i'] < .05, 'tired legs tint it (thinner), without danger', m['tired'])
    check('grudge' in m['grudge']['why'], 'a grudge out on the road is a threat', m['grudge'])
    check(m['lair']['place'] == 'lair' and 'lair' in m['lair']['why'] and m['lair']['i'] > .5, 'at a lair\'s door: the lair, and danger', m['lair'])
    check(m['dungeon']['place'] == 'dungeon' and 'dungeon' in m['dungeon']['why'], 'a dungeon is a threat', m['dungeon'])
    check('alpha' in m['alpha']['why'] and m['alpha']['i'] > m['dungeon']['i'], 'and next to its alpha, more so', [m['dungeon'], m['alpha']])
    check(m['town']['place'] == 'town' and m['town']['i'] == 0, 'a town is calm', m['town'])
    check(m['site']['place'] == 'site' and m['site']['site'] == 'marigold', 'the Marigold wreck is a special place', m['site'])
    check(m['ground']['place'] == 'ground', 'a ground is a ground', m['ground'])
    e = await pg.evaluate("""(() => { const i0 = WAMB.i; WAMB.i = 0; let up = 0; for (let k = 0; k < 20; k++) up = wAmbEase(1, .2); let dn = 0; for (let k = 0; k < 20; k++) dn = wAmbEase(0, .2);
      WAMB.i = 0; for (let k = 0; k < 300; k++) wAmbEase(1, .2); const top = WAMB.i; for (let k = 0; k < 600; k++) wAmbEase(0, .2); const end = WAMB.i; WAMB.i = i0; return { up, dn, top, end }; })()""")
    check(e['up'] > .5 and e['top'] > .99 and e['end'] < .01, 'the intensity eases up to a threat and settles after', e)
    check(1 - e['dn'] < e['up'], 'up faster than down', e)

    q = await pg.evaluate("""(() => { const at = (i, n) => { const a = wAmbPlan('plains', 3, 1200, i, n), mo = a.filter(e => e.k === 'motif'), ch = a.filter(e => e.k === 'chord'), pu = a.filter(e => e.k === 'pulse');
        const gaps = mo.slice(1).map((m, k) => m.t - (mo[k].t + mo[k].dur));
        return { pulse: pu.length, grid: pu.filter(e => e.grid).length, acc: a.filter(e => e.k === 'acc').map(e => e.a).filter((v, k, s) => s.indexOf(v) === k).sort(), motifs: mo.length,
          gapMax: Math.max(...gaps), maxLen: Math.max(...mo.map(m => +m.frag.split('.')[1])), chordMax: Math.max(...ch.slice(1).map((c, k) => c.t - ch[k].t)), pad: ch.reduce((s, c) => s + c.notes[0], 0) / ch.length }; };
      return { calm: at(0), mid: at(.5), hi: at(1), night: at(0, true) }; })()""")
    check(q['calm']['pulse'] == 0 and q['mid']['pulse'] > 100 and q['mid']['grid'] == 0 and q['hi']['grid'] > 100, 'calm has no pulse; tense, a heartbeat; in danger, a beat on the grid', q)
    check(q['hi']['motifs'] > 2 * q['calm']['motifs'] and q['hi']['gapMax'] <= 12 + 1e-6 and q['hi']['maxLen'] <= 3, 'in danger the motif comes oftener and shorter', q)
    check(q['hi']['chordMax'] < q['calm']['chordMax'] / 2, 'and the chords change sooner', q)
    check(q['hi']['acc'] == [] and set(q['calm']['acc']) == {'bell', 'lark'}, 'the birds and bells go quiet in danger', q)
    check('owl' in q['night']['acc'] and 'lark' not in q['night']['acc'] and q['night']['pad'] < q['calm']['pad'] - 6, 'at night an owl, not a lark, and the pad sits lower', q)

async def palette_checks(pg):
    v = await pg.evaluate("""(() => { const bad = [], sig = {}, need = ['name', 'theme', 'root', 'scale', 'bpm', 'bpmHi', 'drone', 'pad', 'lead', 'walk', 'tex', 'acc', 'accGap'];
      for (const k in W_AMB_PAL) { const P = W_AMB_PAL[k];
        for (const f of need) if (P[f] == null) bad.push(k + ' has no ' + f);
        if (!THEMES[P.theme] || (P.nightTheme && !THEMES[P.nightTheme])) bad.push(k + ': a tune is missing');
        if (!SCALES[P.scale]) bad.push(k + ': no scale ' + P.scale);
        if (!(P.bpmHi > P.bpm)) bad.push(k + ': danger is not faster');
        if (!P.walk[0] || Object.values(P.walk).some(o => o.some(d => !P.walk[d]))) bad.push(k + ': the chord walk has a dead end');
        const names = [].concat(P.acc, P.accNight || [], P.wx ? P.wx.acc || [] : [], [P.grain, P.nightGrain, P.wx && P.wx.grain].filter(Boolean).map(g => g.a));
        names.forEach(a => { if (!W_AMB_SND[a]) bad.push(k + ': no sound ' + a); });
        if (P.wx && !W_WX[P.wx.kind]) bad.push(k + ': no weather ' + P.wx.kind);
        if (!P.ground) sig[k] = [P.scale, P.root, P.tex.type || 'bandpass', P.tex.f].join('/'); }
      const want = Object.values(W_MUSIC_REGION).concat(['w_town', 'w_dungeon']).filter(t => !W_AMB_THEME[t]);
      const grounds = Object.keys(W_GRD_THEMES).filter(g => !W_AMB_PAL['grd_' + g] || W_AMB_PAL['grd_' + g].theme !== 'wg_' + g);
      const places = Object.keys(W_AMB_PLACE).filter(id => !DB.locs.some(l => l.id === id && l.kind === 'site') || !W_AMB_PAL[W_AMB_PLACE[id]]);
      const sites = DB.locs.filter(l => l.kind === 'site' && !W_AMB_PLACE[l.id]).map(l => l.id);
      return { bad, sigs: Object.values(sig), want, n: Object.keys(W_AMB_PAL).length, grounds, places, sites,
        wx: Object.keys(W_WX).filter(w => !Object.values(W_AMB_PAL).some(P => P.wx && P.wx.kind === w)) }; })()""")
    check(v['n'] == 15 + 10 and v['bad'] == [], 'palettes for the five regions, the towns, the dungeons, five sites, the abbey, the Hall, a lair and ten grounds, each complete', [v['n'], v['bad']])
    check(len(set(v['sigs'])) == len(v['sigs']), 'each land and place has its own scale, root and texture, so you know where you are', v['sigs'])
    check(v['grounds'] == [] and v['places'] == [] and v['sites'] == [], 'every ground has a bed on its own tune, and every secret site its own palette', v)
    check(v['want'] == [], 'every region\'s tune, the town\'s and the dungeon\'s has a palette', v['want'])
    check(v['wx'] == [], 'every weather has a palette that sounds it', v['wx'])
    q = await pg.evaluate("""(() => { const o = {};
      for (const k in W_AMB_PAL) { const P = W_AMB_PAL[k], a = wAmbPlan(k, 5, 900), d = wAmbPlan(k, 5, 900, 0, true), ch = a.filter(e => e.k === 'chord');
        const own = new Set([].concat(P.acc)), ownN = new Set([].concat(P.accNight || P.acc));
        o[k] = { acc: a.filter(e => e.k === 'acc').every(e => own.has(e.a)), accN: d.filter(e => e.k === 'acc').every(e => ownN.has(e.a)),
          pad: ch.reduce((s, c) => s + c.notes[0], 0) / ch.length, src: [...new Set(d.filter(e => e.k === 'motif').map(e => e.src))],
          grainDay: a.filter(e => e.k === 'grain').map(e => e.a).filter((x, i, s) => s.indexOf(x) === i), grainNight: d.filter(e => e.k === 'grain').map(e => e.a).filter((x, i, s) => s.indexOf(x) === i) };
        if (P.wx) { const w = wAmbPlan(k, 5, 900, 0, false, P.wx.kind), cnt = (pl, f) => pl.filter(f).length;
          o[k].wx = { acc: cnt(w, e => e.k === 'acc'), accDry: cnt(a, e => e.k === 'acc'), wxAcc: cnt(w, e => e.k === 'acc' && P.wx.acc.includes(e.a)) / Math.max(1, cnt(w, e => e.k === 'acc')),
            dryAcc: cnt(a, e => e.k === 'acc' && P.wx.acc.includes(e.a)) / Math.max(1, cnt(a, e => e.k === 'acc')), grains: cnt(w, e => e.k === 'grain'), grainsDry: cnt(a, e => e.k === 'grain') }; } }
      return o; })()""")
    check(all(x['acc'] and x['accN'] for x in q.values()), 'each palette plays only its own accents, by day and at night', {k: [x['acc'], x['accN']] for k, x in q.items()})
    pads = {k: round(x['pad']) for k, x in q.items() if k in ['plains', 'bloom', 'tide', 'ember', 'rime', 'town', 'dungeon']}
    check(pads['rime'] == max(pads.values()) and pads['tide'] < pads['plains'] and pads['ember'] < pads['plains'] and pads['dungeon'] < pads['plains'], 'the Frostspire sits highest; the Brinefen, the Cindermaw and the dungeons lower than the plains', pads)
    check(all(q[k]['src'] == ['w_night'] for k in ['plains', 'bloom', 'tide', 'ember', 'rime']) and q['town']['src'] == ['w_town'], 'at night the regions take their fragments from The Night Road (a town keeps its own)', {k: x['src'] for k, x in q.items()})
    check('cricket' in q['plains']['grainNight'] and q['plains']['grainDay'] == [] and q['ember']['grainDay'] == ['crackle'] and q['dungeon']['grainDay'] == ['drip'], 'crickets at night on the plains; crackle in the Cindermaw; drips in the dungeons', {k: [x['grainDay'], x['grainNight']] for k, x in q.items()})
    t, e, r = q['tide']['wx'], q['ember']['wx'], q['rime']['wx']
    check(t['wxAcc'] > t['dryAcc'] + .2 and t['acc'] > t['accDry'] * 1.3, 'in fog the foghorn sounds oftener, and the accents come oftener', t)
    check(e['grains'] > 2 * e['grainsDry'], 'in an ash storm the crackle thickens', e)
    check(r['acc'] > r['accDry'] * 1.2 and r['wxAcc'] > .6, 'in a blizzard, shimmer and ice come oftener', r)
    m = await pg.evaluate("""(() => { const o = {}; for (const rg of ['plains', 'bloom', 'tide', 'ember', 'rime']) { __go(rg, 12); o[rg] = wMusicMood().palette; }
      __go('bloom', 23, false); o.nightRoad = [wMusicHere(), wMusicMood().palette];
      const g = MAPS.mossgate; wEnterMap('mossgate', g.spawn[0], g.spawn[1]); o.town = wMusicMood().palette;
      const h = MAPS.emberdeep; wEnterMap('emberdeep', h.spawn[0], h.spawn[1]); o.dungeon = wMusicMood().palette;
      const c = MAPS.marigold; wEnterMap('marigold', c.spawn[0], c.spawn[1]); o.site = wMusicMood().palette;
      wEnterMap('g_bowl', 12, 5); o.ground = wMusicMood().palette; __go('plains', 12, true); return o; })()""")
    check(all(m[r] == r for r in ['plains', 'bloom', 'tide', 'ember', 'rime']), 'each region gets its own palette', m)
    check(m['nightRoad'] == ['w_night', 'bloom'] and m['town'] == 'town' and m['dungeon'] == 'dungeon', 'the night road its region\'s; every town the town\'s; every dungeon the dungeon\'s', m)
    check(m['site'] == 'wreck' and m['ground'] == 'grd_g_bowl', 'the Marigold wreck has its own palette; the Ash Bowl\'s map a bed on its tune', m)
    pl = await pg.evaluate("""(() => { const o = {}, at = (id, x, y) => { wEnterMap(id, x, y); return [wMusicMood().place, wMusicMood().palette]; };
      for (const l of DB.locs.filter(l => l.kind === 'site')) { const m = MAPS[l.map]; o[l.id] = at(l.map, m.spawn[0], m.spawn[1]); }
      const g = MAPS.coliseum; o.coliseum = at('coliseum', g.spawn[0], g.spawn[1]);
      const b = wAmbAbbey(), r = MAPS.rimewatch; o.abbey = at('rimewatch', b.x + 2, b.y + 2); o.street = at('rimewatch', r.spawn[0], r.spawn[1]);
      const L = DB.locs.find(l => l.kind === 'lair'); o.door = at('world', L.x + 1, L.y); o.near = at('world', L.x + 5, L.y);
      wSetFlag('alpha_' + L.alpha); o.beaten = at('world', L.x + 1, L.y); delete WG.flags['alpha_' + L.alpha];
      __go('plains', 12, true); return o; })()""")
    check(pl['marigold'] == ['site', 'wreck'] and pl['frozenchapel'][1] == 'chapel' and pl['hollowshrine'][1] == 'shrine' and pl['cottage'][1] == 'cottage' and pl['umbralden'][1] == 'nowhere', 'each secret site has its own palette', pl)
    check(pl['coliseum'] == ['hall', 'hall'], 'the Coliseum is the Hall of Legends', pl['coliseum'])
    np_ = await pg.evaluate("(() => { const k = W_AMB_PLACE.cottage; delete W_AMB_PLACE.cottage; const m = MAPS.cottage; wEnterMap('cottage', m.spawn[0], m.spawn[1]); const o = [wAmbPlace(), wAmbPalFor(wMusicHere())]; W_AMB_PLACE.cottage = k; __go('plains', 12, true); return o; })()")
    check(np_ == [None, None], 'a secret site with no palette keeps its tune (not the town bed)', np_)
    check(pl['abbey'] == ['abbey', 'abbey'] and pl['street'][1] == 'town', 'inside the abbey in Rimewatch, its choir; in the street, the town', [pl['abbey'], pl['street']])
    check(pl['door'][1] == 'lair' and pl['near'][1] != 'lair' and pl['beaten'][1] != 'lair', 'at a lair\'s door its own bed (not further off, nor once its alpha is beaten)', [pl['door'], pl['near'], pl['beaten']])
    th = await pg.evaluate("""(() => { const a = wAmbPlan('plains', 9, 3600), b = wAmbPlan('plains', 9, 3600, 1), th = a.filter(e => e.k === 'theme'), mo = a.filter(e => e.k === 'motif');
      const gaps = th.slice(1).map((e, i) => e.t - (th[i].t + th[i].dur)), clash = mo.filter(m => th.some(e => m.t < e.t + e.dur && m.t + m.dur > e.t)).length;
      return { n: th.length, gapMin: Math.min(...gaps), gapMax: Math.max(...gaps), notes: th.length ? th[0].notes.length : 0, want: wAmbNotes(THEMES.w_plains).length, src: th.length ? th[0].src : '', clash, danger: b.filter(e => e.k === 'theme').length }; })()""")
    check(6 <= th['n'] <= 12 and th['gapMin'] >= 300 - 1e-6 and th['gapMax'] <= 600 + 1e-6, 'the whole tune comes by chance every 5 to 10 minutes', th)
    check(th['notes'] == th['want'] and th['src'] == 'w_plains' and th['clash'] == 0, 'it is the whole tune (every note), and no fragment plays over it', th)
    check(th['danger'] == 0, 'never in danger', th)
    so = await pg.evaluate("""(() => { const bad = []; for (let sd = 1; sd < 40; sd++) { const g = wAmbGen('plains', sd, () => ({ i: 0 })); g(); g.soon(8); const ev = []; let e; while ((e = g()).t < 120) ev.push(e);
        const th = ev.filter(e => e.k === 'theme'), mo = ev.filter(e => e.k === 'motif');
        if (!th.length || th[0].t > 20) bad.push(sd + ': no tune'); if (mo.some(m => th.some(e => m.t < e.t + e.dur && m.t + m.dur > e.t))) bad.push(sd + ': overlap');
        for (let i = 1; i < ev.length; i++) if (ev[i].t < ev[i - 1].t - 1e-9) { bad.push(sd + ': back in time'); break; } }
      const g = wAmbGen('plains', 3, () => ({ i: 0 })); let e; while ((e = g()).t < 30) {} const ahead = e.t; g.soon(1); const n = g(); return { bad, ahead, next: n.t }; })()""")
    check(so['bad'] == [], 'asked for on arriving, the whole tune comes within seconds, no fragment rings over it, and the plan never goes back in time', so['bad'])
    check(so['next'] >= so['ahead'] - 1e-9, 'asked for sooner than the event already planned, it waits for it', so)

LEVEL = r"""async ([key, night, wx]) => {
  const sr = 44100, secs = 120, oc = new OfflineAudioContext(2, sr * secs, sr), P = W_AMB_PAL[key], v = W_AMB.voices, on = wx && P.wx;
  W_AMB.voices = 1e9; const mv = SET.mvol; SET.mvol = .55; WAMB.pal = key; WAMB.ch = wAmbChain(oc); WAMB.ch.fade.gain.value = 1; wAmbHold(oc, P);
  if (on) WAMB.ch.wx.g.gain.value = P.wx.tex.vol * W_AMB.tex;
  WAMB.ch.lp.frequency.value = W_AMB.lp * (night ? .75 : 1) * (on ? P.wx.lp : 1);
  for (const e of wAmbPlan(key, 4242, secs, 0, night, on ? P.wx.kind : null)) wAmbPlay(oc, e, e.t + .1);
  wAmbFlush(oc, Infinity);
  const buf = await oc.startRendering(); W_AMB.voices = v; SET.mvol = mv; WAMB.pal = null; WAMB.ch = null;
  const L = buf.getChannelData(0); let ss = 0; for (let i = 0; i < L.length; i++) ss += L[i] * L[i]; return Math.sqrt(ss / L.length);
}"""

async def level_checks(ctx):
    # two minutes of each palette, rendered offline on a page of its own (so its voices never count in the live one);
    # the noise and the room are seeded, so this is the same every run
    pg = await ctx.new_page(); await pg.goto(REALM_URL); await pg.wait_for_function("typeof wAmbPlan === 'function'", timeout=T)
    lv, nt, wx = {}, {}, {}
    for k in ['plains', 'bloom', 'tide', 'ember', 'rime', 'town', 'dungeon', 'wreck', 'chapel', 'abbey', 'shrine', 'cottage', 'nowhere', 'hall', 'lair'] + ['grd_g_' + g for g in ['ballpark', 'court', 'links', 'lists', 'lanes', 'shed', 'bowl', 'ring', 'rink', 'sheet']]:
        lv[k] = round(await pg.evaluate(LEVEL, [k, False, False]), 4)
    for k in ['plains', 'bloom', 'tide']:
        nt[k] = round(await pg.evaluate(LEVEL, [k, True, False]), 4)
    for k in ['tide', 'ember', 'rime']:
        wx[k] = round(await pg.evaluate(LEVEL, [k, False, True]), 4)
    await pg.close()
    ok = all(.83 <= lv[k] / lv['plains'] <= 1.2 for k in lv)
    check(ok and .008 < lv['plains'] < .04, 'every palette plays about as loud as the next (within a fifth of the plains): the lands, the places, the grounds', lv)
    check(all(.83 <= nt[k] / lv['plains'] <= 1.2 for k in nt), 'and at night', nt)
    check(all(.83 <= wx[k] / lv['plains'] <= 1.35 for k in wx), 'and in its weather (which may add up to a third: the wind, the ash)', wx)
    # the whole tune against its own bed: present, and never swamping it, in the quietest and loudest-gained palettes
    TUNE = r"""async (key) => {
      const sr = 22050, secs = 40, P = W_AMB_PAL[key], v = W_AMB.voices, mv = SET.mvol; W_AMB.voices = 1e9; SET.mvol = .55;
      const render = async (tune) => { const oc = new OfflineAudioContext(1, sr * secs, sr); WAMB.pal = key; WAMB.ch = wAmbChain(oc); WAMB.ch.fade.gain.value = 1; wAmbHold(oc, P);
        const g = wAmbGen(key, 11, () => ({ i: 0 })); g.S.t.theme = tune ? 2 : 1e9; g.S.t.motif = 1e9; let e; while ((e = g()).t < secs) wAmbPlay(oc, e, e.t + .1); wAmbFlush(oc, Infinity);
        const b = await oc.startRendering(), L = b.getChannelData(0); let ss = 0; for (let i = 2 * sr; i < 32 * sr; i++) ss += L[i] * L[i]; return Math.sqrt(ss / (30 * sr)); };
      const bed = await render(false), tune = await render(true); W_AMB.voices = v; SET.mvol = mv; WAMB.pal = null; WAMB.ch = null; return { bed, tune, ratio: tune / bed }; }"""
    pg = await ctx.new_page(); await pg.goto(REALM_URL); await pg.wait_for_function("typeof wAmbPlan === 'function'", timeout=T)
    tu = {}
    for k in ['plains', 'cottage', 'hall', 'tide', 'grd_g_ballpark']:
        tu[k] = round((await pg.evaluate(TUNE, k))['ratio'], 2)
    print('  the whole tune over its bed (RMS ratio):', tu)
    await pg.close()
    check(all(1.1 <= r <= 2.2 for r in tu.values()), 'the whole tune is heard over its bed, and never swamps it (the bed plays on under it)', tu)

async def live_checks(pg):
    await pg.evaluate("actx()")
    await pg.wait_for_function("SND.ctx && SND.ctx.state === 'running'", timeout=T)
    check(await pg.evaluate("SET.mstyle") == 'ambient', 'Music style starts on Ambient')
    await pg.evaluate("__go('plains', 12, true)")
    await pg.wait_for_function("WAMB.pal === 'plains' && !MUS.timer", timeout=T)
    w = await pg.evaluate("musicWanted()")
    check(w == ['w_plains', 'calm'], 'the Charter Plains by day still asks for its tune, calm', w)
    await pg.wait_for_function("WAMB.live > 0 && WAMB.log.some(e => e.k === 'chord')", timeout=T)
    check(await pg.evaluate("MUS.theme === null && !MUS.timer"), 'there the ambient bed plays, not the tune')
    await pg.evaluate("window.__ch = WAMB.ch; __go('plains', 12, false)")
    await pg.wait_for_function("WAMB.mood && WAMB.mood.why.includes('wild')", timeout=T)
    check(await pg.evaluate("WAMB.pal === 'plains' && !MUS.timer && WAMB.ch === __ch"), 'off the road by day too, and it carries on (no restart)')
    # the next region: a crossfade into its own palette
    await pg.evaluate("__go('bloom', 12)")
    await pg.wait_for_function("WAMB.pal === 'bloom' && !MUS.timer", timeout=T)
    check(await pg.evaluate("WAMB.lastFade === W_AMB.cross && WAMB.lastIn === W_AMB.cross && MUS.theme === null"), 'into the Mosswold: its own bed, crossfaded evenly from the plains (no tune between)', await pg.evaluate("[WAMB.lastFade, WAMB.lastIn]"))
    # arriving in a region: its whole tune, soon
    ar = await pg.evaluate("(() => { const due = WAMB.gen.S.t.theme - (SND.ctx.currentTime - WAMB.t0); return { due, region: WAMB.region }; })()")
    check(ar['due'] <= W_ARRIVE + 1 and ar['region'] == 'bloom', 'arriving in the Mosswold, its whole tune is due within seconds', ar)
    # back and forth over the border, quicker than the settle time: the bed stays put
    await pg.evaluate("window.__ch = WAMB.ch; __go('plains', 12); MUS.want = null")
    await pg.wait_for_function("MUS.want !== null", timeout=T)
    await pg.evaluate("__go('bloom', 12); MUS.want = null")
    await pg.wait_for_function("MUS.want !== null", timeout=T)
    check(await pg.evaluate("WAMB.ch === __ch && WAMB.pal === 'bloom'"), 'a quick step over a border and back keeps the same bed (no flapping)')
    fg = await pg.evaluate("(() => { WAMB.want = { key: 'plains', at: 0 }; wAmbStop(); const o = WAMB.want === null; return o; })()")
    check(fg, 'a stopped bed forgets the palette it was about to change to (the settle starts again after a match)')
    await pg.wait_for_function("WAMB.pal === 'bloom'", timeout=T)
    nt = await pg.evaluate("(() => { const r = RUN; RUN = null; let err = null; try { wAmbTick(); } catch (e) { err = e.message; } RUN = r; return err; })()")
    check(nt is None, 'with no journey loaded, the tick does nothing (no errors)', nt)
    ez = await pg.evaluate("(() => { WAMB.i = .1; const h = RUN.hp; RUN.hp = Math.round(RUN.maxhp * .1); wAmbStop(); wAmbStart('bloom'); const o = { i: WAMB.i, target: WAMB.mood.intensity }; RUN.hp = h; return o; })()")
    check(abs(ez['i'] - .1) < .02 and ez['target'] > .5, 'a new bed keeps the eased intensity and swells toward the target (no jump)', ez)
    hid = await pg.evaluate("""(() => { const L = DB.locs.find(l => l.kind === 'lair'), was = L.hidden; wEnterMap('world', L.x + 1, L.y); WG.min = 720;
      const seen = wAmbLairNear(6), pl = wAmbPlace(); L.hidden = 'clue_nobody_has'; const hidden = wAmbLairNear(6), pl2 = wAmbPlace(), why = wMusicMood().why; if (was) L.hidden = was; else delete L.hidden; __go('bloom', 12); return { seen: !!seen && pl === 'lair', hidden: !!hidden || pl2 === 'lair' || why.includes('lair') }; })()""")
    check(hid['seen'] and not hid['hidden'], 'a lair hidden behind a clue does not swell the music (the map as you see it)', hid)
    # the whole tune, live: every note gets its voices, a few at a time (never refused by the cap)
    await pg.evaluate("__go('bloom', 12, true); WAMB.tn = 0; WAMB.tnLost = 0; WAMB.gen.soon(SND.ctx.currentTime - WAMB.t0)")
    await pg.wait_for_function("WAMB.tn >= 8", timeout=60000)
    tl = await pg.evaluate("({ tn: WAMB.tn, lost: WAMB.tnLost, live: WAMB.live, cap: W_AMB.voices, queued: WAMB.ch.q.length })")
    check(tl['lost'] == 0 and tl['live'] <= tl['cap'], 'the whole tune plays note after note, none refused by the voice cap', tl)
    # dawn: once a day
    dn = await pg.evaluate("""(() => { const th0 = WAMB.gen.S.t.theme, min0 = WG.min; WAMB.gen.S.t.theme = 1e9; WAMB.dawnDay = null; WG.min = 6.5 * 60; wAmbTick(); const a = WAMB.gen.S.t.theme - (SND.ctx.currentTime - WAMB.t0);
      WAMB.gen.S.t.theme = 1e9; wAmbTick(); const b = WAMB.gen.S.t.theme; WAMB.gen.S.t.theme = th0; WG.min = min0; return { a, again: b === 1e9 }; })()""")
    check(dn['a'] < 12 and dn['again'], 'at dawn its whole tune is due, once a day', dn)
    # a special place has its own bed
    await pg.evaluate("(() => { const m = MAPS.cottage; wEnterMap('cottage', m.spawn[0], m.spawn[1]); })()")
    await pg.wait_for_function("WAMB.pal === 'cottage' && !MUS.timer", timeout=T)
    check(True, 'Vesper\'s Cottage has its own bed')
    await pg.evaluate("SET.mstyle = 'classic'")
    await pg.wait_for_function("!WAMB.pal && MUS.theme === 'w_town'", timeout=T)
    await pg.wait_for_function("WAMB.ringing === 0", timeout=T)
    check(True, 'the bed\'s voices all end after it stops')
    await pg.evaluate("SET.mstyle = 'ambient'")
    await pg.evaluate("__go('bloom', 23, false)")
    await pg.wait_for_function("WAMB.pal === 'bloom' && !MUS.timer && WAMB.mood && WAMB.mood.tint.night", timeout=T)
    check(True, 'at night off the road in the Mosswold, its bed, tinted night')
    # weather: a blizzard on the Frostspire brings its layer
    await pg.evaluate("WG.wx = { day: WG.dayAbs, by: { rime: 'blizzard' } }; __go('rime', 12, false)")
    await pg.wait_for_function("WAMB.pal === 'rime' && wAmbWx() === 'blizzard'", timeout=T)
    check(await pg.evaluate("!!WAMB.ch.wx"), 'in a blizzard the Frostspire bed has its weather layer, and it is blowing')
    await pg.evaluate("WG.wx = { day: WG.dayAbs, by: {} }")
    # every sound plays, in every palette
    snd = await pg.evaluate("""(() => { const c = SND.ctx, bad = [], v = W_AMB.voices, pk = WAMB.peak; W_AMB.voices = 1e6;
      for (const k in W_AMB_PAL) { wAmbStop(); wAmbStart(k); const P = W_AMB_PAL[k];
        for (const a in W_AMB_SND) { const n0 = WAMB.live;
          try { W_AMB_SND[a](c, { x: .5 }, c.currentTime + .05, P, wRng(7)); if (WAMB.live <= n0) bad.push(k + '/' + a + ': no voices'); } catch (e) { bad.push(k + '/' + a + ': ' + e.message); } } }
      W_AMB.voices = v; WAMB.peak = pk; wAmbStop(); return bad; })()""")
    check(snd == [], 'every accent and grain makes its voices, in every palette', snd)
    await pg.wait_for_function("WAMB.pal === 'rime'", timeout=T)
    await pg.evaluate("__go('plains', 23, false)")
    await pg.wait_for_function("WAMB.pal === 'plains' && !MUS.timer && WAMB.mood && WAMB.mood.tint.night && WAMB.mood.why.includes('night')", timeout=T)
    check(True, 'at night off the road on the plains, the bed, tinted night and tenser')
    await pg.evaluate("window.__ch = WAMB.ch; __go('plains', 23, true)")
    await pg.wait_for_function("WAMB.mood && !WAMB.mood.why.includes('night')", timeout=T)
    check(await pg.evaluate("WAMB.ch === __ch && !MUS.timer"), 'stepping onto the road at night keeps the same bed (no swap, no restart)')
    await pg.evaluate("__go('plains', 12, true)")
    await pg.wait_for_function("WAMB.pal === 'plains' && !MUS.timer", timeout=T)
    check(True, 'back on the plains by day, the bed again')
    # the voice cap
    cap = await pg.evaluate("""(() => { const c = SND.ctx, v = W_AMB.voices; W_AMB.voices = WAMB.live + 2;
      for (let i = 0; i < 6; i++) wAmbPlay(c, { k: 'chord', t: 0, dur: 4, deg: 0, notes: [55, 59, 62, 66] }, c.currentTime);
      const o = { live: WAMB.live, cap: W_AMB.voices }; W_AMB.voices = v; return o; })()""")
    check(cap['live'] <= cap['cap'], 'the bed never goes over its cap of live voices', cap)
    check(await pg.evaluate("WAMB.peak <= W_AMB.voices"), 'nor did it while playing', await pg.evaluate("[WAMB.peak, W_AMB.voices]"))
    # after the tab slept for an hour: the plan picks up where it was, in one step, and nothing plays late
    cu = await pg.evaluate("""(() => { const n0 = WAMB.log.length, ev = WAMB.ev; WAMB.t0 -= 3600; const now = SND.ctx.currentTime, t = performance.now(); wAmbTick();
      const got = WAMB.log.slice(n0); return { first: got.length ? got[0].t === ev.t : true, n: got.length, late: got.filter(e => WAMB.t0 + e.t < now - W_AMB.late).length, ms: performance.now() - t, live: WAMB.live, cap: W_AMB.voices }; })()""")
    check(cu['first'] and cu['late'] == 0 and cu['n'] < 30 and cu['ms'] < 50 and cu['live'] <= cu['cap'], 'after an hour asleep, the plan picks up where it was, at once, and nothing bursts out', cu)
    st = await pg.evaluate("""(() => { const n0 = WAMB.log.length; WAMB.t0 -= 2.5; const now = SND.ctx.currentTime; wAmbTick();
      const got = WAMB.log.slice(n0), late = e => WAMB.t0 + e.t < now - W_AMB.late;
      return { other: got.filter(e => e.k !== 'chord' && e.k !== 'gust' && late(e)).length, chords: got.filter(e => e.k === 'chord' && late(e)).length, onTime: got.filter(e => !late(e)).length }; })()""")
    check(st['other'] == 0 and st['chords'] == 0, 'after a stall of 2.5 s, nothing late bursts out at once', st)
    # 3: the cap keeps room for the pad: accents and grains stop short of the last voices
    pr = await pg.evaluate("""(() => { const c = SND.ctx, v = W_AMB.voices, P = W_AMB_PAL[WAMB.pal]; W_AMB.voices = WAMB.live + W_AMB.keep + 2; const n0 = WAMB.live;
      for (let i = 0; i < 4; i++) wAmbPlay(c, { k: 'acc', a: 'sleigh', t: 0, x: .3 + i / 10 }, c.currentTime + .05);
      const afterAcc = WAMB.live - n0; wAmbPlay(c, { k: 'chord', t: 0, dur: 4, deg: 0, notes: [55, 59, 62, 66] }, c.currentTime + .05);
      const o = { afterAcc, chord: WAMB.live - n0 - afterAcc }; W_AMB.voices = v; return o; })()""")
    check(pr['afterAcc'] == 2 and pr['chord'] == 4, 'accents stop short of the kept voices, so a chord still gets all its notes', pr)
    # 7: a noise voice starts where all of it fits in the buffer
    nz = await pg.evaluate("[0, .5, .99, 1].map(o => wAmbNoiseAt(o, 1.45) + 1.45 <= WAMB.noise.duration && wAmbNoiseAt(o, 1.45) === wAmbNoiseAt(o, 1.45)).every(Boolean)")
    check(nz, 'a noise voice starts from its seed, and all of it fits in the buffer (no cut-off hiss)')
    # 5: the pause menu ducks the bed
    await pg.evaluate("openPause()")
    await pg.wait_for_function("WAMB.ch && WAMB.ch.vol.gain.value < SET.mvol * W_AMB.vol * (W_AMB_PAL[WAMB.pal].gain || 1) * .5", timeout=T)
    await pg.evaluate("closePause()")
    await pg.wait_for_function("WAMB.ch && WAMB.ch.vol.gain.value > SET.mvol * W_AMB.vol * (W_AMB_PAL[WAMB.pal].gain || 1) * .9", timeout=T)
    check(True, 'the pause menu ducks the bed, and it comes back after')
    # a new bed starts its own count, and a stopped bed's voices stop after the fade
    rs = await pg.evaluate("(() => { const old = WAMB.ch; wAmbStop(); wAmbStart('plains'); return { fresh: WAMB.ch !== old && WAMB.ch.live <= 8 }; })()")
    check(rs['fresh'], 'a restarted bed counts its own voices, not the last one\'s tails', rs)
    await pg.wait_for_function("WAMB.ringing === WAMB.live", timeout=T)
    check(True, 'and the stopped bed\'s voices, scheduled ahead or ringing, stop after its fade')
    # a match plays its tune
    await pg.evaluate("startMatch({ type: 'normal', card: false, world: { kind: 'wild', region: 'plains', map: 'world' } })")
    await pg.wait_for_function("B && !B.over && UI.view === 'fight' && B.phase === 'player'", timeout=T)
    await pg.wait_for_function("MUS.theme === 'w_plains' && !!MUS.timer && !WAMB.pal", timeout=T)
    check(True, 'a match on the plains plays the tune')
    await pg.evaluate("RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = RUN.maxhp; __wbot(80); consumeFx(); renderFightHUD(); finishFight()")
    await pg.wait_for_selector('#bCont', timeout=T)
    await pg.click('#bCont')
    await pg.wait_for_function("UI.view === 'world' && !RUN.pending", timeout=T)
    await pg.evaluate("__closeAll(); __go('plains', 12, true)")
    await pg.wait_for_function("WAMB.pal === 'plains' && !MUS.timer", timeout=T)
    check(True, 'and back in the world, the bed')
    # asked for the bed in the middle of a tune's crossfade: the tune on its way is stopped as it starts
    await pg.evaluate("SET.mstyle = 'classic'")
    await pg.wait_for_function("MUS.theme === 'w_plains' && !!MUS.timer", timeout=T)
    await pg.evaluate("musicSet('w_town', 'calm'); window.__sw = MUS.switching; SET.mstyle = 'ambient'; musicSet('w_plains', 'calm')")
    await pg.wait_for_function("WAMB.pal === 'plains' && !MUS.switching && !MUS.timer", timeout=T)
    check(await pg.evaluate("__sw === true"), 'mid-crossfade, the bed starts and the incoming tune is stopped')
    await pg.evaluate("SET.mstyle = 'classic'")
    await pg.wait_for_function("MUS.theme === 'w_plains' && !!MUS.timer", timeout=T)
    one = await pg.evaluate("(() => { musicSet('w_town', 'calm'); SET.mstyle = 'ambient'; musicSet('w_plains', 'calm'); const a = WAMB.killT; musicSet('w_plains', 'calm'); musicSet('w_plains', 'calm'); return !!a && WAMB.killT === a; })()")
    check(one, 'and only one timer is set to stop it, however often the poll asks')
    await pg.wait_for_function("WAMB.pal === 'plains' && !MUS.switching && !MUS.timer && !WAMB.killT", timeout=T)
    # parameters get a new target only when they move
    pm = await pg.evaluate("(() => { const p = WAMB.ch.vol.gain, a = p.wAmbTo; let n = 0; const f = p.setTargetAtTime.bind(p); p.setTargetAtTime = (...x) => { n++; return f(...x); }; for (let i = 0; i < 5; i++) wAmbTick(); delete p.setTargetAtTime; return { n, a }; })()")
    check(pm['n'] == 0 and pm['a'] is not None, 'a level that has not moved gets no new automation, tick after tick', pm)
    # Classic
    await pg.evaluate("SET.mstyle = 'classic'")
    await pg.wait_for_function("MUS.theme === 'w_plains' && !!MUS.timer && !WAMB.pal", timeout=T)
    check(True, 'Classic plays the tune on the plains, as before')
    await pg.evaluate("SET.mstyle = 'ambient'")
    await pg.wait_for_function("WAMB.pal === 'plains' && !MUS.timer", timeout=T)
    # Music off, and LAB
    await pg.evaluate("SET.music = false; musicStop(); MUS.want = null")
    await pg.wait_for_function("MUS.want !== null", timeout=T)
    check(await pg.evaluate("!WAMB.pal && !MUS.timer"), 'with Music off, nothing plays (after the next look at what to play)')
    await pg.evaluate("SET.music = true")
    await pg.wait_for_function("WAMB.pal === 'plains'", timeout=T)
    lab = await pg.evaluate("(() => { LAB = true; musicSet('w_plains', 'calm'); wAmbStart('plains'); const o = !WAMB.pal; LAB = false; return o; })()")
    check(lab, 'no ambient music in LAB')
    await pg.wait_for_function("WAMB.pal === 'plains'", timeout=T)
    # live: low HP swells the bed, and it settles once healed
    await pg.evaluate("window.__hp = RUN.hp; RUN.hp = Math.round(RUN.maxhp * .1)")
    await pg.wait_for_function("WAMB.i > .5 && WAMB.log.some(e => e.k === 'pulse')", timeout=T)
    check(True, 'live: with the team hurt the bed swells, and the pulse comes in')
    await pg.evaluate("RUN.hp = window.__hp")
    await pg.wait_for_function("WAMB.i < .3", timeout=T)
    check(await pg.evaluate("WAMB.pal === 'plains'"), 'healed, it settles (without restarting)')

async def settings_checks(pg):
    await pg.evaluate("showSettings()")
    await pg.wait_for_selector('#wMstyle', timeout=T)
    s = await pg.evaluate("({ v: document.getElementById('wMstyle').value, hint: [...document.querySelectorAll('#modalBox p.hint')].pop().textContent })")
    check(s['v'] == 'ambient' and 'The Charter Plains' in s['hint'] and '(ambient)' in s['hint'], 'Settings has Music style, on Ambient, and says what is playing', s)
    await pg.select_option('#wMstyle', 'classic')
    await pg.wait_for_function("MUS.theme === 'w_plains' && !WAMB.pal", timeout=T)
    saved = await pg.evaluate("JSON.parse(localStorage.getItem('sd-settings')).mstyle")
    check(saved == 'classic', 'picking Classic plays the tune, and is saved', saved)
    await pg.click('#sMusic'); await pg.click('#sMusic')
    check(await pg.evaluate("!!document.getElementById('wMstyle') && document.getElementById('wMstyle').value === 'classic'"), 'the row stays when the panel redraws')
    await pg.select_option('#wMstyle', 'ambient')
    await pg.wait_for_function("WAMB.pal === 'plains' && !MUS.timer", timeout=T)
    await pg.evaluate("__closeAll()")

async def help_checks(pg):
    await pg.evaluate("showPage('help')")
    h = await pg.evaluate("document.getElementById('wHelpAmb') && document.getElementById('wHelpAmb').closest('#wHelp') ? document.getElementById('wHelpAmb').textContent : ''")
    check(all(s in h for s in ['ambient', 'Classic', 'Matches', 'danger', 'heartbeat', 'HP', 'Mosswold', 'Brinefen', 'Cindermaw', 'Frostspire', 'towns', 'dungeons', 'fog', 'blizzards', 'Special places', 'wreck', 'Hall of Legends', 'ground', 'whole tune', 'dawn']), 'How to play explains the music style', h)
    await pg.evaluate("showPage('play')")

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        errs = []
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await boot(pg)
        await plan_checks(pg)
        await mood_checks(pg)
        await palette_checks(pg)
        await level_checks(ctx)
        await live_checks(pg)
        await settings_checks(pg)
        await help_checks(pg)
        sd = await pg.evaluate('window.__sdErrs || []')
        check(not sd, 'no __sdErrs', sd)
        await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('all passed')

asyncio.run(main())
