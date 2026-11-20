# Realm lanes: the feel of bowling (issue #100, phase 11). Sound at the lanes: the ball's roll and the pins when it gets
# there, the gallery and the rest, only while the lanes are on screen and Sound effects is on (nothing in LAB, nothing
# with sound off). Tips for bowling and the Gutter Cup. Medals: bowling matches won, Gutter Cups, a turkey, a clean
# game, the 7-10 converted and a 300 (read from the sheet: a run of strikes, every frame a mark), never for a conceded
# match. How to play has #wHelpLanesFeel; Quick start has a Bowling tab with its three pictures, and the lanes bar a
# Quick start button that opens it. Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox #wLanesOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wBL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- sound ----------
        # (the realm's tone and noise are counted, not played: the test counts what the lanes would play)
        await pg.evaluate("""(() => { window.__snd = []; tone = (f, d) => __snd.push(['tone', f, d]); noise = (d, v, fq) => __snd.push(['noise', fq, d]); SND.on = true; })()""")
        s = await pg.evaluate("""(() => { SET.sfx = true; W_LANES_MODE = 'watch'; wLanesGame({ seed: 3, mode: 'watch' }); wBL.pause(true); __snd.length = 0;
          let n = 0, rolls = 0, strikes = 0, crash = 0; const seen = new Set();
          wBL.onPhase; while (n++ < 6000 && wBL.G.n < 24) { const ph = wBL.phase; wBL.tick(0.05); if (wBL.phase !== ph && wBL.phase === 'roll') { rolls++; const L = wBL.last; if (L.roll.strike) strikes++; } }
          crash = __snd.filter(x => x[0] === 'noise' && x[1] === 900).length;
          const on = __snd.length; __snd.length = 0;
          SET.sfx = false; n = 0; const g0 = wBL.G.n; while (n++ < 3000 && wBL.G.n < g0 + 4) wBL.tick(0.05); const off = __snd.length;
          return { view: UI.view, rolls, strikes, on, crash, off, roll: on >= rolls * 2 }; })()""")
        check(s['view'] == 'lanes' and s['roll'] and s['on'] > 0, 'at the lanes with Sound effects on: the roll on the wood for every ball, and the pins', s)
        check(s['crash'] >= s['strikes'] > 0, 'a crash in the pins for every strike', s)
        check(s['off'] == 0, 'Sound effects off: nothing at all', s)
        await pg.evaluate("(() => { WBL = null; wLeaveLanes(); })()")
        await pg.wait_for_function("UI.view === 'world'")

        # ---------- tips, medals ----------
        t = await pg.evaluate("""(() => ({ tips: ['w_lanes', 'w_gutter'].every(k => TIPS[k] && TIPS[k][1].length > 20),
          ach: ['w_lanes', 'w_gutter', 'w_turkey', 'w_clean', 'w_seventen', 'w_perfect'].every(id => ACH.some(a => a.id === id)) }))()""")
        check(t == {'tips': True, 'ach': True}, 'tips for bowling and the Gutter Cup; six bowling medals in the record book', t)
        sh = await pg.evaluate("""(() => { const X = { b: ['X'] }, row = a => ({ game: a });
          const perfect = row(Array(9).fill(X).concat([{ b: ['X', 'X', 'X'] }])), clean = row(Array(9).fill({ b: ['7', '/'] }).concat([{ b: ['8', '/', '9'] }])), open = row([{ b: ['X'] }, { b: ['X'] }, { b: ['7', '2'] }, { b: ['X'] }]);
          return { perfect: [wLanesTurkey(perfect), wLanesClean(perfect)], clean: [wLanesTurkey(clean), wLanesClean(clean)], open: [wLanesTurkey(open), wLanesClean(open)] }; })()""")
        check(sh == {'perfect': [12, True], 'clean': [0, True], 'open': [2, False]}, 'the sheet says it: twelve strikes in a row is a turkey and a clean game; nine spares are clean; an open frame is not', sh)
        await pg.evaluate("(() => { for (const kind of ['elf', 'dwarf', 'gorgon']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); })()")
        m = await pg.evaluate("""(() => { const st0 = Object.assign({}, ACHS.stats), sim0 = wBL.simGame;
          const X = { b: ['X'], split: false, score: 0 }, game = Array(9).fill(X).concat([{ b: ['X', 'X', 'X'], split: false, score: 300 }]);
          wBL.simGame = o => Object.assign(sim0(o), { win: 0, game: [300, 190], tot: [300, 190], marks: [{ game, ro: null }, { game: [], ro: null }], st: [{ sevenTenMade: 1 }, {}], text: '300 to 190' });
          wLng().met = {}; const r = wStartLanes({ club: 'local', how: 'sim' }); wBL.simGame = sim0;
          const d = k => (ACHS.stats[k] || 0) - (st0[k] || 0);
          return { r, wins: d('realmLanesWins'), turkeys: d('realmTurkeys'), clean: d('realmCleanGames'), seven: d('realmSevenTens'), perfect: d('realmPerfect') }; })()""")
        await pg.evaluate(CLOSE_ALL)
        check(m == {'r': '', 'wins': 1, 'turkeys': 1, 'clean': 1, 'seven': 1, 'perfect': 1}, 'a 300 from the world: a win, a turkey, a clean game, the 7-10 and a perfect game, each counted once', m)
        cd = await pg.evaluate("""(() => { const st0 = Object.assign({}, ACHS.stats); wLng().met = {}; wStartLanes({ club: 'local', how: 'manage' }); wBL.pause(true);
          const s = wBL.summary(); s.win = 1; s.text = 'conceded'; s.marks = [{ game: Array(12).fill({ b: ['X'] }), ro: null }, { game: [], ro: null }]; wLanesSettle(s); WBL = null; wLeaveLanes();
          return ['realmLanesWins', 'realmTurkeys'].map(k => (ACHS.stats[k] || 0) - (st0[k] || 0)); })()""")
        await pg.evaluate(CLOSE_ALL)
        check(cd == [0, 0], 'a conceded match earns no medals', cd)
        gw = await pg.evaluate("""(() => { const g0 = ACHS.stats.realmGutters || 0; WG.lncup = { week: wWeek(), field: ['me'], round: 2, games: [[], [], [{ a: 'me', b: 'local', ra: 2, rb: 1, w: 'me', end: '' }]], done: true, champ: 'me' };
          wGutterWon(); return (ACHS.stats.realmGutters || 0) - g0; })()""")
        await pg.evaluate(CLOSE_ALL)
        check(gw == 1, 'winning the Gutter Cup counts a medal', gw)

        # ---------- How to play, Quick start ----------
        await pg.evaluate("showPage('help')")
        h = await pg.evaluate("""(() => { const f = (document.getElementById('wHelpLanesFeel') || {}).textContent || '', Q = W_QUICK.find(q => q.id === 'lanes');
          return { feel: ['roll', 'strike', 'sea', 'turkey', '300'].every(w => f.includes(w)), steps: Q && Q.steps.length, imgs: Q && Q.steps.every(s => (W_QUICK_IMG[s.img] || '').startsWith('data:image/jpeg')), tab: !!document.querySelector('#wQuick [data-wq="lanes"]') }; })()""")
        check(h == {'feel': True, 'steps': 3, 'imgs': True, 'tab': True}, 'How to play explains the sounds and medals; Quick start has a Bowling tab, three steps with their pictures', h)
        await pg.evaluate("showPage('play')")
        q = await pg.evaluate("""(async () => { wLanesGame({ seed: 4, mode: 'play' }); wBL.pause(true); const b = document.getElementById('wQuick_lanes'); if (!b) return { btn: false };
          b.click(); await new Promise(r => setTimeout(r, 150)); const on = document.querySelector('#wQuick [data-wq="lanes"].on'), pg = document.querySelector('.page:not([hidden])');
          return { btn: true, on: !!on, help: !!document.getElementById('wQuick') && document.getElementById('wQuick').offsetParent !== null }; })()""")
        check(q == {'btn': True, 'on': True, 'help': True}, 'the lanes bar\'s Quick start button opens How to play on the Bowling tab', q)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
