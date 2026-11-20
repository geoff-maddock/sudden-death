# Realm shed: the feel of curling (issue #102, phase 11). Sound at the Shed: a sliding stone's rumble, a clack when it
# hits another, the brooms while it is swept, the skip's call, the gallery for an end scored, only while the Shed is on
# screen and Sound effects is on (nothing with sound off). Tips for curling and the Brass Broom. Medals: curling matches
# won, Brass Brooms, ends stolen, four-enders and a draw to rest on the button (the engine counts those), never for a
# conceded match. How to play has #wHelpShedFeel; Quick start has a Curling tab with its three pictures, and the Shed's
# Quick start button opens it. Asserts; exits nonzero on failure.
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
  const b = document.querySelector('#modalBox [data-close], #modalBox #wShedOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.music = false; SET.shedEnds = 4")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- sound ----------
        # (the realm's tone and noise are counted, not played: the test counts what the Shed would play, a beat at a time)
        await pg.evaluate("""(() => { window.__snd = []; tone = (f, d) => __snd.push(['tone', f, d]); noise = (d, v, fq) => __snd.push(['noise', fq, d]); SND.on = true; })()""")
        s = await pg.evaluate("""(() => { SET.sfx = true; W_SHED_MODE = 'watch'; wShedGame({ seed: 3, mode: 'watch', ends: 4 }); wCR.pause(true); __snd.length = 0;
          let n = 0, slides = 0, hits = 0, ends = 0; wCR.pause(false);
          while (n++ < 40000 && wCR.G.n < 32) { const ph = wCR.phase, g = wCR.G.n, e = wCR.G.end; wCR.tick(0.05); if (wCR.phase === 'slide') { if (ph !== 'slide') slides++; wShedSlideBeat(); }
            if (wCR.G.n > g && wCR.last) hits += wCR.last.hits > 0 ? 1 : 0; if (wCR.G.end > e) ends++; }
          const rumble = __snd.filter(x => x[0] === 'noise' && x[1] === 110).length, clack = __snd.filter(x => x[0] === 'noise' && x[1] === 2600).length, brush = __snd.filter(x => x[0] === 'noise' && x[1] === 3200).length;
          const on = __snd.length; __snd.length = 0;
          SET.sfx = false; n = 0; const g0 = wCR.G.n; while (n++ < 8000 && wCR.G.n < g0 + 3) { wCR.tick(0.05); if (wCR.phase === 'slide') wShedSlideBeat(); } const off = __snd.length; wCR.pause(true);
          return { view: UI.view, slides, hits, ends, on, rumble, clack, brush, off }; })()""")
        check(s['view'] == 'shed' and s['slides'] >= 20 and s['rumble'] >= s['slides'], 'at the Shed with Sound effects on: a sliding stone rumbles down the pebble', s)
        check(s['clack'] >= 1 and s['hits'] >= 1, 'a clack when a stone hits another', s)
        check(s['brush'] >= 1, 'the brooms while a stone is swept', s)
        check(s['off'] == 0, 'Sound effects off: nothing at all', s)
        await pg.evaluate("(() => { WCR = null; wLeaveShed(); })()")
        await pg.wait_for_function("UI.view === 'world'")

        # ---------- tips, medals ----------
        t = await pg.evaluate("""(() => ({ tips: ['w_shed', 'w_broom'].every(k => TIPS[k] && TIPS[k][1].length > 20),
          ach: ['w_shed', 'w_broom', 'w_steal', 'w_four', 'w_button'].every(id => ACH.some(a => a.id === id)) }))()""")
        check(t == {'tips': True, 'ach': True}, 'tips for curling and the Brass Broom; five curling medals in the record book', t)
        bt = await pg.evaluate("""(() => { const T = k => ({ name: k, short: 'T', roster: [0, 1, 2, 3].map(i => ({ n: k + i, kind: 'dwarf' })) });
          // (thrown on its aim exactly, a draw to the button rests on it; one to the four-foot's edge doesn't count)
          wCR.start({ seed: 9, hammer: 1, teams: [T('a'), T('b')] }); let G = wCR.G; const aim = wCR.solveDraw(0, 0, 1, G.ice, G.cold), ev = wCR.throwStone(0, { shot: 'draw', x: 0, y: 0, h: 1, aim }, aim, null);
          const on = { d: ev.stop ? +Math.hypot(ev.stop.x, ev.stop.y).toFixed(1) : 99, made: ev.made, count: G.st[0].buttons };
          wCR.start({ seed: 9, hammer: 1, teams: [T('a'), T('b')] }); G = wCR.G; const aim2 = wCR.solveDraw(0, 20, 1, G.ice, G.cold), ev2 = wCR.throwStone(0, { shot: 'draw', x: 0, y: 20, h: 1, aim: aim2 }, aim2, null);
          return { on, off: { made: ev2.made, count: G.st[0].buttons }, button: wCR.button }; })()""")
        check(bt['on']['d'] <= bt['button'] and bt['on']['made'] and bt['on']['count'] == 1 and bt['off']['made'] and bt['off']['count'] == 0, 'the engine counts a draw made that comes to rest on the button, and not one made beside it', bt)
        es = await pg.evaluate("""(() => { SET.sfx = true; let crowd = 0; const c0 = sfx.crowd; sfx.crowd = () => { crowd++; }; W_SHED_MODE = 'watch'; wShedGame({ seed: 12, mode: 'watch', ends: 4 }); wCR.pause(true); __snd.length = 0;
          // (each end's own sound, counted across the stone that ended it: the game's own end is left out, its horn and gallery are onOver's)
          let n = 0, ok = 0, bad = [], last = null; const you = wCR.view.you; wCR.pause(false);
          while (n++ < 40000 && !wCR.G.over) { const e = wCR.G.end, c0n = crowd, s0 = __snd.length; wCR.tick(0.05);
            if (wCR.G.over) { const add = __snd.slice(s0); last = { crowd: crowd - c0n, low: add.filter(x => x[0] === 'tone' && x[1] === 196).length, chime: add.filter(x => x[0] === 'tone' && x[1] === 880).length }; }
            else if (wCR.phase === 'rest' && wCR.G.end > e) {
              const L = wCR.last.rule.end, add = __snd.slice(s0), low = add.filter(x => x[0] === 'tone' && x[1] === 196).length, chime = add.filter(x => x[0] === 'tone' && x[1] === 880).length, cr = crowd - c0n;
              const want = L.s < 0 ? [0, 0, 1] : L.s === you ? [1, 0, 0] : [0, 1, 0]; if (JSON.stringify([cr, low, chime]) === JSON.stringify(want)) ok++; else bad.push({ end: L, got: [cr, low, chime] }); } }
          wCR.pause(true); sfx.crowd = c0; SET.sfx = false; WCR = null; wLeaveShed();
          return { ok, bad: bad.slice(0, 3), last }; })()""")
        check(es['ok'] >= 3 and es['bad'] == [], 'every end heard once: the gallery for yours, a low note for theirs, a chime for a blank', es)
        check(es['last'] == {'crowd': 1, 'low': 0, 'chime': 0}, 'the game\'s last end is the horn\'s alone (one gallery, no end sound on top)', es)
        cl = await pg.evaluate("""(() => { SET.sfx = true; W_SHED_MODE = 'play'; wShedGame({ seed: 13, mode: 'play', hammer: 1 }); wCR.pause(true); let n = 0; while (wCR.phase !== 'aim' && n++ < 8000) wCR.tick(.05);
          wCR.press(); n = 0; while (wCR.view.meter && wCR.view.meter.v < 0.86 && n++ < 3000) wCR.tick(.002); wCR.press(); wCR.pause(false); __snd.length = 0; n = 0; let hurry = 0;
          while (wCR.phase === 'slide' && n++ < 600) { wCR.tick(.05); wShedSlideBeat(); } hurry = __snd.filter(x => x[0] === 'tone' && x[1] === 392).length;
          wCR.setMode('watch'); n = 0; while (wCR.slideSide !== 1 - wCR.view.you && n++ < 8000) wCR.tick(.05); __snd.length = 0; n = 0;
          while (wCR.phase === 'slide' && n++ < 600) { wCR.tick(.05); wShedSlideBeat(); } wCR.pause(true); const cpu = __snd.filter(x => x[0] === 'tone' && (x[1] === 392 || x[1] === 330)).length; SET.sfx = false; W_SHED_MODE = 'play'; WCR = null; wLeaveShed();
          return { hurry, cpu }; })()""")
        check(cl['hurry'] >= 1 and cl['cpu'] == 0, 'your skip calls "Hurry hard!" on a light stone of yours, and says nothing on theirs', cl)
        await pg.evaluate("(() => { for (const kind of ['elf', 'dwarf', 'gorgon']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); })()")
        m = await pg.evaluate("""(() => { const st0 = Object.assign({}, ACHS.stats), sim0 = wCR.simGame;
          wCR.simGame = o => { const g = sim0(o); g.win = 0; g.tot = [9, 3]; g.text = '9 to 3'; g.board = { sc: [[4, 0, 5, 0], [0, 2, 0, 1]], ends: 4 }; g.st[0].ends.stolen = 2; g.st[0].buttons = 3; return g; };
          wShg().met = {}; const r = wStartShed({ club: 'local', how: 'sim' }); wCR.simGame = sim0;
          const d = k => (ACHS.stats[k] || 0) - (st0[k] || 0);
          return { r, wins: d('realmShedWins'), steals: d('realmSteals'), four: d('realmFourEnders'), buttons: d('realmButtons') }; })()""")
        await pg.evaluate(CLOSE_ALL)
        check(m == {'r': '', 'wins': 1, 'steals': 2, 'four': 2, 'buttons': 3}, 'a big win from the world: a win, its steals, its four-enders and its buttons, each counted', m)
        cd = await pg.evaluate("""(() => { const st0 = Object.assign({}, ACHS.stats); wShg().met = {}; wStartShed({ club: 'local', how: 'manage' }); wCR.pause(true);
          const s = wCR.summary(); s.win = 1; s.text = 'conceded'; s.st[0].ends.stolen = 1; s.st[0].buttons = 1; wShedSettle(s); WCR = null; wLeaveShed();
          return ['realmShedWins', 'realmSteals', 'realmButtons'].map(k => (ACHS.stats[k] || 0) - (st0[k] || 0)); })()""")
        await pg.evaluate(CLOSE_ALL)
        check(cd == [0, 0, 0], 'a conceded match earns no medals', cd)
        gw = await pg.evaluate("""(() => { const g0 = ACHS.stats.realmBrooms || 0; WG.crcup = { week: wWeek(), field: ['me'], round: 2, games: [[], [], [{ a: 'me', b: 'local', ra: 5, rb: 3, w: 'me', end: '' }]], done: true, champ: 'me' };
          wBroomWon(); return (ACHS.stats.realmBrooms || 0) - g0; })()""")
        await pg.evaluate(CLOSE_ALL)
        check(gw == 1, 'winning the Brass Broom counts a medal', gw)

        # ---------- How to play, Quick start ----------
        await pg.evaluate("showPage('help')")
        h = await pg.evaluate("""(() => { const f = (document.getElementById('wHelpShedFeel') || {}).textContent || '', Q = W_QUICK.find(q => q.id === 'shed');
          return { feel: ['rumble', 'clack', 'brooms', 'Hurry hard', 'button'].every(w => f.includes(w)), steps: Q && Q.steps.length, imgs: Q && Q.steps.every(s => (W_QUICK_IMG[s.img] || '').startsWith('data:image/jpeg')), tab: !!document.querySelector('#wQuick [data-wq="shed"]') }; })()""")
        check(h == {'feel': True, 'steps': 3, 'imgs': True, 'tab': True}, 'How to play explains the sounds and medals; Quick start has a Curling tab, three steps with their pictures', h)
        await pg.evaluate("showPage('play')")
        q = await pg.evaluate("""(async () => { wShedGame({ seed: 4, mode: 'play' }); wCR.pause(true); const b = document.getElementById('wQuick_shed'); if (!b) return { btn: false };
          b.click(); await new Promise(r => setTimeout(r, 150)); const on = document.querySelector('#wQuick [data-wq="shed"].on');
          return { btn: true, on: !!on, help: !!document.getElementById('wQuick') && document.getElementById('wQuick').offsetParent !== null }; })()""")
        check(q == {'btn': True, 'on': True, 'help': True}, 'the Shed\'s Quick start button opens How to play on the Curling tab', q)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
