# Realm links: the feel of golf (issue #92, phase 11). Sound on the course from the shots and the end: a strike for a
# full shot and a tap for a putt, the ball in the cup and the gallery for yours, a chime for a power cast, the horn and
# the gallery when you win; none with sound effects off, and none off the course. Tips: golf once your team can play,
# the Divot Cup once you have won a match. Medals: golf matches won, Divot Cups, a hole in one, an eagle and a win by 5
# and 4 or more, counted from a real match's result. How to play has the feel. Asserts; exits nonzero on failure.
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

HELP = r"""
// count every sound effect asked for, by name
window.__snd = []; for (const k of Object.keys(sfx)) { const f = sfx[k]; sfx[k] = function () { __snd.push(k); }; }
window.__to = (ph, n) => { let i = 0; while (wGL.phase !== ph && i++ < (n || 4000)) wGL.tick(0.05); return wGL.phase === ph; };
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wGL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS).filter(k => !/^w_(links|divot)$/.test(k))); SET.sfx = true; SET.music = false")
        await pg.evaluate(HELP)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- tips ----------
        await pg.evaluate("(() => { const kinds = ['elf', 'spider', 'gorgon']; let i = 0; while (wRoster().length < 4) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern')); wFourAuto(); SET.tips = true; })()")
        await pg.wait_for_function("tipQ.includes('w_links') || TIPS_SEEN.includes('w_links')", timeout=10000)
        tp = await pg.evaluate("({ links: tipQ.includes('w_links') || TIPS_SEEN.includes('w_links'), divot: tipQ.includes('w_divot') || TIPS_SEEN.includes('w_divot') })")
        check(tp == {'links': True, 'divot': False}, 'the golf tip once your team can play (not the cup\'s yet)', tp)
        await pg.evaluate("(() => { for (let i = 0; i < 8 && !document.getElementById('modal').hidden; i++) { const b = document.querySelector('#modalBox button'); if (b) b.click(); } document.querySelectorAll('.coach, #coach').forEach(x => x.hidden = true); })()")

        # ---------- sound ----------
        sd = await pg.evaluate("""(() => { wLinksGame({ seed: 5, mode: 'play' }); wGL.pause(true); __to('aim'); __snd.length = 0; wGL.drag(.9, 0); const strike = __snd.slice();
          const G = wGL.G, H = wGL.course(G.h); let n = 0; while (wGL.phase !== 'aim' && n++ < 4000) wGL.tick(0.05);
          G.ball[0] = { x: H.pin.x - .3, y: H.pin.y, lie: 'G' }; G.ball[1] = { x: H.tee.x, y: H.tee.y, lie: 'T' }; G.hole.st = [2, 0]; wGL.setMode('watch'); wGL.setMode('play'); __to('aim');
          __snd.length = 0; wGL.aimAt(H.pin.x, H.pin.y); wGL.drag(wGL.view.sel.tick, 0); const putt = __snd.slice(), holed = wGL.view.last.holed;
          __snd.length = 0; wGL.G.mana[0] = 5; n = 0; while (wGL.phase !== 'aim' && n++ < 8000) wGL.tick(0.05); wGL.castMine('pow'); wGL.drag(.8, 0); const cast = __snd.slice();
          SET.sfx = false; __snd.length = 0; n = 0; while (wGL.phase !== 'aim' && n++ < 8000) wGL.tick(0.05); wGL.drag(.8, 0); const off = __snd.slice(); SET.sfx = true;
          return { strike, putt, holed, cast, off }; })()""")
        check('hit' in sd['strike'], 'a strike for a full shot', sd)
        check(sd['holed'] and 'card' in sd['putt'] and 'coin' in sd['putt'] and 'crowd' in sd['putt'], 'a tap for a putt, and the ball in the cup and the gallery for yours', sd)
        check('magic' in sd['cast'], 'a chime for a power cast', sd)
        # a new match's first cast chimes, though the last match had more casts (the count is set afresh at the start)
        nx = await pg.evaluate("""(() => { wLinksGame({ seed: 8, mode: 'play' }); wGL.pause(true); __to('aim'); wGL.G.mana[0] = 5; __snd.length = 0; wGL.castMine('pow'); wGL.drag(.8, 0);
          return { snd: __snd.slice(), casts: wGL.casts.length }; })()""")
        check(nx['casts'] >= 1 and 'magic' in nx['snd'], 'a new match\'s first cast chimes', nx)
        check(sd['off'] == [], 'no sound with sound effects off', sd)
        en = await pg.evaluate("""(() => { wLinksGame({ seed: 6, mode: 'watch', holes: 3 }); wGL.pause(true); __snd.length = 0; let i = 0; while (!WGL.over && i++ < 40000) wGL.tick(0.05);
          const watched = __snd.slice(-3); wLeaveLinks(); __snd.length = 0; wGL.simGame({ seed: 7 }); return { watched, away: __snd.length }; })()""")
        check('horn' in en['watched'] and 'crowd' in en['watched'] and en['away'] == 0, 'a round you watch ends with the horn and the gallery; nothing sounds off the course', en)

        # ---------- medals, from a real match ----------
        md = await pg.evaluate("""(() => { const before = Object.assign({}, ACHS.stats), LABwas = LAB; LAB = false;
          WG.lkg = null; wStartLinks({ club: 'local', how: 'play' }); wGL.pause(true);
          const sum = Object.assign(wGL.summary(), { win: 0, text: '5 and 4', won: [5, 0], log: [{ k: 'shot', side: 0, lie0: 'T', holed: true, club: 'si' }], stat: [{ eagles: 1 }, { eagles: 0 }] });
          wLinksSettle(sum); WGL = null; wLeaveLinks();
          const d = k => (ACHS.stats[k] || 0) - (before[k] || 0); LAB = LABwas;
          return { wins: d('realmLinksWins'), aces: d('realmAces'), eagles: d('realmEagles'), routs: d('realmRouts'), ach: ['w_links', 'w_divot', 'w_ace', 'w_eagle', 'w_rout'].every(id => ACH.some(a => a.id === id)) }; })()""")
        check(md == {'wins': 1, 'aces': 1, 'eagles': 1, 'routs': 1, 'ach': True}, 'medals: golf matches won, a hole in one, an eagle and a win by 5 and 4, from a real match\'s result (and Divot Cups have theirs)', md)
        dv = await pg.evaluate("""(() => { const before = ACHS.stats.realmDivots || 0; WG.lkcup = { week: 1, field: ['me', 'local', 'a', 'b', 'c', 'd', 'e', 'f'], round: 2, games: [[], [], [{ a: 'me', b: 'local', ra: 3, rb: 1, w: 'me', end: '' }]], done: true, champ: 'me' };
          try { wDivotWon(); } catch (e) { return String(e); } return (ACHS.stats.realmDivots || 0) - before; })()""")
        check(dv == 1, 'a Divot Cup counts towards its medal', dv)
        await pg.evaluate("(() => { for (let i = 0; i < 8 && !document.getElementById('modal').hidden; i++) { const b = document.querySelector('#modalBox button'); if (b) b.click(); } WG.cardOffer = null; })()")
        await pg.wait_for_function("tipQ.includes('w_divot') || TIPS_SEEN.includes('w_divot')", timeout=10000)
        check(True, 'the Divot Cup tip once you have won a golf match')
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const t = (document.getElementById('wHelpLinksFeel') || {}).textContent || ''; return ['strike', 'cup', 'gallery', 'medals'].map(s => t.includes(s)); })()")
        check(all(hp), 'How to play has the feel of golf', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
