# Realm lists: the feel of jousting (issue #117, phase 13). Sound at the Lists, only while the Lists are on screen and
# Sound effects is on (nothing with sound off): hoofbeats on the stride's beat through every charge, the crack of each
# lance broken (once a course, a helm break with its ring of steel), the herald's trumpet at each heat and the tilt, the
# gallery's cheer for the first side's points and a groan for the other's, the end's fanfare; on You ride a tick for a
# spur on the beat, and the lances heard as they meet in your balance moment, not again after it. The tilting yard has
# hoofbeats and cracks, no trumpet or gallery. The Lists' own music (g_lists) on the Lists view: fight in a match, calm
# after it, not in the world, not in the Umbral. Tips for jousting, the Gilded Lance and riding a course. Medals:
# jousting matches won, Gilded Lances, unhorsings, helm breaks and a heat without a point against, from matches from the
# world only (not an exhibition, not a conceded match). How to play has #wHelpListsFeel; the Quick start has a Jousting
# tab with its six pictures. At phone width a squire's name stays with its job buttons. Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox #wListsOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""

HELP = r"""
window.__to = (ph, max) => { let n = 0; while (wJT.phase !== ph && n++ < (max || 20000)) { wJT.tick(0.05); wListsHoofBeat(); } return wJT.phase === ph; };
window.__p = p => { const R = wJT.playRules; let n = 0; while (wJT.phase === 'charge' && wJT.view.charge.p < p - 1e-9 && n++ < 400) { wJT.tick(Math.min(.02, (p - wJT.view.charge.p) * R.charge + 1e-6)); wListsHoofBeat(); } };
// (the realm's tone and noise are counted, not played; the checks tick the match themselves, unpaused, inside one evaluate, so
// no frame runs between)
window.__snd = []; tone = (f, d) => __snd.push(['tone', f, d]); noise = (d, v, fq) => __snd.push(['noise', fq, d]); SND.on = true;
window.__count = (a, k, f, d) => a.filter(x => x[0] === k && x[1] === f && (d == null || Math.abs(x[2] - d) < 1e-6)).length;
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wJT !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.music = false; SET.listsCourses = 3")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)

        # ---------- sound: a whole match, watched ----------
        s = await pg.evaluate("""(() => { SET.sfx = true; let crowd = 0, groan0 = 0; const c0 = sfx.crowd; sfx.crowd = () => { crowd++; };
          W_LISTS_MODE = 'watch'; wListsGame({ seed: 7, mode: 'watch' }); wJT.pause(true); __snd.length = 0; wJT.pause(false);
          let n = 0, charges = 0, ph0 = ''; while (n++ < 60000 && !(WJT && WJT.over)) { wJT.tick(0.05); if (wJT.phase === 'charge') { if (ph0 !== 'charge') charges++; wListsHoofBeat(); } ph0 = wJT.phase; }
          const G = wJT.G, st = G.st, a = __snd.slice(), heats = G.log.some(e => e.tilt) ? 3 : 2;
          // (each course but the last: a cheer when the first side scores, a groan when only the other does; the last is the end's)
          const L = G.log.slice(0, -1), cheers = L.filter(e => e.pts[0] > 0).length, groans = L.filter(e => !(e.pts[0] > 0) && e.pts[1] > 0).length;
          sfx.crowd = c0;
          const out = { view: UI.view, over: !!G.over, courses: G.log.length, charges, hoof: __count(a, 'noise', 150), breaks: st[0].breaks + st[1].breaks, helms: st[0].helms + st[1].helms,
            cracks: __count(a, 'noise', 2400) + __count(a, 'noise', 1900), helmCracks: __count(a, 'noise', 1900), ring: __count(a, 'tone', 1250), glances: st[0].glances + st[1].glances, tinks: __count(a, 'tone', 1800),
            trumpets: __count(a, 'tone', 784, .32), heats, fanfare: __count(a, 'tone', 784, .45), crowd, cheers, groans: __count(a, 'noise', 520), wantGroans: groans };
          __snd.length = 0; SET.sfx = false; wListsGame({ seed: 8, mode: 'watch' }); n = 0; while (n++ < 3000) { wJT.tick(0.05); if (wJT.phase === 'charge') wListsHoofBeat(); } out.off = __snd.length; wJT.pause(true);
          return out; })()""")
        check(s['view'] == 'lists' and s['over'] and s['charges'] == s['courses'] and s['hoof'] >= 6 * s['courses'], 'at the Lists with Sound effects on: hoofbeats through every charge', s)
        check(s['cracks'] == s['breaks'] and s['helmCracks'] == s['helms'] == s['ring'] and s['tinks'] == s['glances'], 'the crack of each lance broken, once (a helm break bigger, with its ring), a tink for each glance', s)
        check(s['trumpets'] == s['heats'] and s['fanfare'] == 1, 'the herald\'s trumpet at each heat (and the tilt), the full fanfare at the end of a match watched', s)
        check(s['crowd'] == s['cheers'] + 1 and s['groans'] == s['wantGroans'] + 0, 'the gallery cheers the first side\'s points and groans at the other\'s; the last course is the end\'s', s)
        check(s['off'] == 0, 'Sound effects off: nothing at all', s)

        # ---------- You ride: the spur's tick, the lances heard as they meet ----------
        r = await pg.evaluate("""(() => { SET.sfx = true; W_LISTS_MODE = 'play'; const R = wJT.playRules;
          for (let seed = 30; seed < 90; seed++) { wListsGame({ seed, mode: 'play' }); wJT.pause(false);
            for (let c = 0; c < 6 && !wJT.G.over; c++) {
              if (!__to('plan')) break; __snd.length = 0; wJT.press(); const b = R.spur.beat[wJT.view.sel.pace];
              for (let k = 1; k * b < R.spur.until * R.charge; k++) { __p(k * b / R.charge); wJT.spur(); }
              const ticks = __count(__snd, 'tone', 880);
              __p(0.66); wJT.couch(true); let n = 0; while (wJT.phase === 'charge' && n++ < 400) { wJT.tick(.02); wListsHoofBeat(); } const clunk = __count(__snd, 'noise', 600);
              if (wJT.phase !== 'seat') continue;
              const atSeat = __count(__snd, 'noise', 2400) + __count(__snd, 'noise', 1900), hits = wJT.view.hits; __snd.length = 0;
              n = 0; while (wJT.phase === 'seat' && n++ < 400) wJT.tick(.02);
              const after = __count(__snd, 'noise', 2400) + __count(__snd, 'noise', 1900), L = wJT.last;
              wJT.pause(true); SET.sfx = false;
              return { seed, ticks, clunk, atSeat, want: hits.filter(h => h.broke).length, theirs: !!hits[1].broke, after, last: L.broke }; } }
          SET.sfx = false; return null; })()""")
        check(r is not None and r['ticks'] >= 3 and r['clunk'] == 1, 'on You ride: a tick for each spur on the beat, a clunk as your lance comes down', r)
        check(r is not None and r['theirs'] and r['atSeat'] == r['want'] >= 1 and r['after'] == 0, 'their lance broken on you is heard as the lances meet, in your balance moment, and not again after it', r)

        # ---------- the yard: hoofbeats and cracks, no trumpet or gallery ----------
        y = await pg.evaluate("""(() => { SET.sfx = true; let crowd = 0; const c0 = sfx.crowd; sfx.crowd = () => { crowd++; }; W_LISTS_MODE = 'play';
          wListsYard(); wJT.setMode('watch'); wJT.pause(false); __snd.length = 0;
          let n = 0; while (n++ < 20000 && !wJT.G.over) { wJT.tick(0.05); if (wJT.phase === 'charge') wListsHoofBeat(); }
          const a = __snd.slice(); sfx.crowd = c0; SET.sfx = false; wJT.pause(true);
          return { yard: !!wJT.G.yard, over: !!wJT.G.over, hoof: __count(a, 'noise', 150) > 0, trumpets: __count(a, 'tone', 784, .32) + __count(a, 'tone', 784, .45), crowd, groans: __count(a, 'noise', 520) }; })()""")
        check(y == {'yard': True, 'over': True, 'hoof': True, 'trumpets': 0, 'crowd': 0, 'groans': 0}, 'the tilting yard: hoofbeats, no trumpet and no gallery', y)
        await pg.evaluate("(() => { WJT = null; wLeaveLists(); })()")
        await pg.wait_for_function("UI.view === 'world'")

        # ---------- music ----------
        mu = await pg.evaluate("""(() => { const world = musicWanted()[0]; W_LISTS_MODE = 'watch'; wListsGame({ seed: 4, mode: 'watch' }); wJT.pause(true);
          const inMatch = musicWanted().slice(); wJT.G.lich = true; const umbral = musicWanted()[0]; delete wJT.G.lich;
          let n = 0; while (n++ < 60000 && !(WJT && WJT.over)) wJT.tick(0.1); const after = musicWanted().slice();
          WJT = null; wLeaveLists(); return { world, inMatch, umbral, after, theme: !!THEMES.wg_g_lists }; })()""")
        check(mu['theme'] and mu['inMatch'] == ['wg_g_lists', 'fight'] and mu['after'] == ['wg_g_lists', 'calm'], 'the Lists\' own music on the Lists view: fight in a match, calm after it', mu)
        check(mu['world'] != 'wg_g_lists' and mu['umbral'] != 'wg_g_lists', 'not in the world away from the Lists, and not in the Umbral\'s Hollow Lists', mu)

        # ---------- tips, medals ----------
        t = await pg.evaluate("""(() => ({ tips: ['w_lists', 'w_lance', 'w_listsride'].every(k => TIPS[k] && TIPS[k][1].length > 40),
          ach: ['w_lists', 'w_lance', 'w_unhorse', 'w_helmbreak', 'w_cleanheat'].every(id => ACH.filter(a => a.id === id).length === 1),
          stats: ACH.filter(a => ['w_lists', 'w_lance', 'w_unhorse', 'w_helmbreak', 'w_cleanheat'].includes(a.id)).map(a => a.stat) }))()""")
        check(t['tips'] and t['ach'] and t['stats'] == ['realmListsWins', 'realmLances', 'realmUnhorsings', 'realmHelmBreaks', 'realmCleanHeats'], 'tips for jousting, the Gilded Lance and riding a course; five jousting medals in the record book', t)
        await pg.evaluate("(() => { for (const kind of ['elf', 'werewolf', 'gorgon']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); })()")
        await pg.evaluate(CLOSE_ALL)
        m = await pg.evaluate("""(() => { const st0 = Object.assign({}, ACHS.stats), sim0 = wJT.simMatch;
          // (heat 1 clean: nothing above 0 for them, a foul of theirs; heat 2 not: they scored)
          wJT.simMatch = o => { const g = sim0(o); g.win = 0; g.tot = [8, 1]; g.text = '8 to 1'; g.st[0].unhorse = 2; g.st[0].helms = 3; g.board.sc = [[[2, 1, 3], [1, 1, null]], [[0, -1, 0], [2, 0, null]]]; return g; };
          wJtg().met = {}; const r = wStartLists({ club: 'local', how: 'sim' }); wJT.simMatch = sim0;
          const d = k => (ACHS.stats[k] || 0) - (st0[k] || 0);
          return { r, wins: d('realmListsWins'), unh: d('realmUnhorsings'), helms: d('realmHelmBreaks'), clean: d('realmCleanHeats') }; })()""")
        await pg.evaluate(CLOSE_ALL)
        check(m == {'r': '', 'wins': 1, 'unh': 2, 'helms': 3, 'clean': 1}, 'a win from the world: the win, its unhorsings, its helm breaks and its clean heat (a foul of theirs isn\'t a point against), each counted', m)
        cd = await pg.evaluate("""(() => { const st0 = Object.assign({}, ACHS.stats); wJtg().met = {}; W_LISTS_MODE = 'manage'; wStartLists({ club: 'local', how: 'manage' }); wJT.pause(true);
          const s = wJT.summary(); s.win = 1; s.text = 'conceded'; s.st[0].unhorse = 1; s.st[0].helms = 1; wListsSettle(s); WJT = null; wLeaveLists();
          const ex = Object.assign({}, ACHS.stats); W_LISTS_MODE = 'watch'; wListsGame({ seed: 9, mode: 'watch' }); let n = 0; while (n++ < 60000 && !(WJT && WJT.over)) wJT.tick(0.1); WJT = null; wLeaveLists();
          const keys = ['realmListsWins', 'realmUnhorsings', 'realmHelmBreaks', 'realmCleanHeats'];
          return { conceded: keys.map(k => (ex[k] || 0) - (st0[k] || 0)), exhibition: keys.map(k => (ACHS.stats[k] || 0) - (ex[k] || 0)) }; })()""")
        await pg.evaluate(CLOSE_ALL)
        check(cd == {'conceded': [0, 0, 0, 0], 'exhibition': [0, 0, 0, 0]}, 'a conceded match and an exhibition earn no medals', cd)
        gw = await pg.evaluate("""(() => { const g0 = ACHS.stats.realmLances || 0; WG.jtcup = { week: wWeek(), field: ['me'], round: 2, games: [[], [], [{ a: 'me', b: 'local', ra: 5, rb: 3, w: 'me', end: '' }]], done: true, champ: 'me' };
          wLanceWon(); return (ACHS.stats.realmLances || 0) - g0; })()""")
        await pg.evaluate(CLOSE_ALL)
        check(gw == 1, 'winning the Gilded Lance counts a medal', gw)

        # ---------- How to play, Quick start ----------
        await pg.evaluate("showPage('help')")
        h = await pg.evaluate("""(() => { const f = (document.getElementById('wHelpListsFeel') || {}).textContent || '', Q = W_QUICK.find(q => q.id === 'lists');
          return { feel: ['hoofbeats', 'crack', 'trumpet', 'gallery', 'music', 'Gilded Lances', 'without a point against'].every(w => f.includes(w)), steps: Q && Q.steps.length,
            imgs: !!Q && Q.steps.every(s => (W_QUICK_IMG[s.img] || '').startsWith('data:image/jpeg')), tab: !!document.querySelector('#wQuick [data-wq="lists"]') }; })()""")
        check(h == {'feel': True, 'steps': 6, 'imgs': True, 'tab': True}, 'How to play explains the sounds and medals; Quick start has a Jousting tab, six steps with their pictures', h)
        await pg.evaluate("showPage('play')")

        # ---------- the phone: a squire's name stays with its jobs ----------
        await pg.set_viewport_size({'width': 390, 'height': 844})
        ph = await pg.evaluate("""(() => { W_LISTS_MODE = 'play'; wListsGame({ seed: 5, mode: 'play' }); wJT.pause(true);
          let k = 0; while (k++ < 8 && !(wJT.view && wJT.view.jobs)) { __to('plan'); if (wJT.view.jobs) break; wJT.press(); let n = 0; while (['charge', 'seat'].includes(wJT.phase) && n++ < 2000) wJT.tick(.02); }
          wListsRows(); const sq = [...document.querySelectorAll('#wListsSq .wjtsq')];
          const one = sq.map(el => { const bs = [...el.querySelectorAll('button')].map(b => Math.round(b.getBoundingClientRect().top)), name = Math.round(el.querySelector('b').getBoundingClientRect().top); return Math.abs(bs[0] - name) <= 12 && Math.max(...bs) - Math.min(...bs) <= 4; });
          const r = { jobs: !!wJT.view.jobs, n: sq.length, together: one, scroll: document.documentElement.scrollWidth <= innerWidth + 1 }; WJT = null; wLeaveLists(); return r; })()""")
        check(ph == {'jobs': True, 'n': 2, 'together': [True, True], 'scroll': True}, 'at phone width each squire\'s name stays on one line with its job buttons, and nothing scrolls sideways', ph)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
