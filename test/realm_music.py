# Realm ambient music (issue #28, phases 1 and 2): the plan (a seeded stream of chords, motif fragments, accents and gusts:
# the chord walk never stands still, no fragment twice in a row, long rests, no 4-bar stretch repeats, the same seed
# plays the same and another day differs), when the bed plays (the Charter Plains by day in Ambient; tunes elsewhere,
# in matches and in Classic; nothing with Music off or in LAB), the voice cap, the Music style setting and How to
# play. Phase 2, the mood: wMusicMood in each case (a quiet road, off the road, night, fog, a blizzard, an ash storm,
# low HP, tired legs, an alpha, a lair, a dungeon, a town, a site, a ground, a grudge), the intensity easing up fast
# and down slow, and the plan at each intensity (the pulse, the grid, shorter gaps, no birds) and at night (an owl, a
# lower pad); live, low HP swells the bed and it settles after.
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
      const ch = a.filter(e => e.k === 'chord'), mo = a.filter(e => e.k === 'motif'), ac = a.filter(e => e.k === 'acc');
      const o = { same: JSON.stringify(a) === JSON.stringify(b), differs: JSON.stringify(ch.slice(0, 20).map(e => e.deg)) !== JSON.stringify(c.filter(e => e.k === 'chord').slice(0, 20).map(e => e.deg)),
        first: ch[0].deg, chords: ch.length, still: 0, badLen: 0, motifs: mo.length, twice: 0, sameStart: 0, gaps: [], share: 0, badFrag: 0, vars: {}, answers: 0, acc: {}, accGaps: [], repeats: 0, windows: 0 };
      for (let i = 1; i < ch.length; i++) { if (ch[i].deg === ch[i - 1].deg) o.still++; const d = ch[i].t - ch[i - 1].t; if (![2, 3, 4].some(n => Math.abs(d - n * bar) < 1e-6)) o.badLen++; }
      for (let i = 0; i < mo.length; i++) {
        const m = mo[i], [st, L, v] = m.frag.split('.'); o.vars[v] = 1; if (m.answer) o.answers++;
        if (m.notes.length !== (m.answer ? 2 : 1) * +L || +L < 2 || +L > 5) o.badFrag++;
        o.share += m.dur;
        if (i) { if (m.frag === mo[i - 1].frag) o.twice++; if (st === mo[i - 1].frag.split('.')[0]) o.sameStart++; o.gaps.push(m.t - (mo[i - 1].t + mo[i - 1].dur)); }
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
    # another region keeps its tune for now
    await pg.evaluate("__go('bloom', 12)")
    await pg.wait_for_function("MUS.theme === 'w_bloom' && !WAMB.pal", timeout=T)
    check(True, 'in the Mosswold its tune plays (no palette yet)')
    await pg.wait_for_function("WAMB.ringing === 0", timeout=T)
    check(True, 'the bed\'s voices all end after it stops')
    await pg.evaluate("__go('bloom', 23, false)")
    await pg.wait_for_function("MUS.theme === 'w_night' && !WAMB.pal", timeout=T)
    check(True, 'at night off the road in the Mosswold, the night tune (no palette yet)')
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
    # after the tab slept: only the latest chord and gust catch up
    cu = await pg.evaluate("""(() => { const n0 = WAMB.log.length; WAMB.t0 -= 120; wAmbTick();
      const got = WAMB.log.slice(n0); return { chords: got.filter(e => e.k === 'chord').length, gusts: got.filter(e => e.k === 'gust').length, motifs: got.filter(e => e.k === 'motif').length, live: WAMB.live, cap: W_AMB.voices }; })()""")
    check(1 <= cu['chords'] <= 2 and 1 <= cu['gusts'] <= 2 and cu['motifs'] <= 1 and cu['live'] <= cu['cap'], 'after two minutes asleep, only the latest chord and gust catch up (plus any due in the last 3 s), not all of them', cu)
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
    check(all(s in h for s in ['ambient', 'Charter Plains', 'Classic', 'Matches', 'danger', 'heartbeat', 'HP']), 'How to play explains the music style', h)
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
