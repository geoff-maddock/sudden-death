# Realm tired legs and the bench (epic 2, phase 5): each match a player starts adds to their legs, each match on the
# bench takes one off. A Tired starter (3+) brings 1 Fatigue card into the draw pile at kickoff, a Spent one (5+) 2.
# A bed takes 4 off everyone, camping out 2. The pre-game card says who is tired, the Team screen shows Fresh, Tired
# or Spent, the save keeps it, How to play explains it, and W_FAT.off turns it all off.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-legs-*.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close]'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""
WIN = r'''(() => { RUN.maxhp = Math.max(RUN.maxhp, 600); RUN.hp = RUN.maxhp; let g = 0;
  while (B && !B.over && g++ < 120) { let k = 0; while (B.phase === 'player' && !B.over && k++ < 30) { const al = alive(); if (!al.length) break; const t = al.slice().sort((a, b) => a.hp - b.hp)[0];
    const i = B.hand.findIndex(c => canPlay(c) && def(c).type === 'atk'), j = i >= 0 ? i : B.hand.findIndex(c => canPlay(c) && def(c).type !== 'junk' && def(c).type !== 'curse'); if (j < 0) break; playCard(j, B.enemies.indexOf(t)); }
    if (B.over) break; for (const e of alive()) e.hp = Math.max(1, Math.floor(e.hp * .5)); runSteps(endTurn()); }
  consumeFx(); renderFightHUD(); finishFight(); return UI.view; })()'''
FATIGUE_IN = "[...B.draw, ...B.hand, ...B.discard, ...(B.exhaust || [])].filter(c => c.id === 'fatigue').length"

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_FAT !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- a fresh team, and a bench ----------
        fresh = await pg.evaluate("(() => { wAddPlayer(wMakePlayer({ kind: 'goblin' }, 'tavern')); return wRoster().map(p => [p.n, wLegs(p), wLegsState(p)]); })()")
        check(len(fresh) == 4 and all(f[1] == 0 and f[2] == 'fresh' for f in fresh), 'everyone starts fresh', fresh)

        # ---------- a tired and a spent starter: the pre-game card, then Fatigue cards at kickoff ----------
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(() => { const s = wStarters(); s[0].legs = 3; s[1].legs = 5; s[2].legs = 0; wBenchList()[0].legs = 2; const L = DB.locs.find(l => l.map === 'graftonbury'); wEnterMap('world', L.x, L.y + 1); WG.min = 12 * 60; wWildMatch('plains'); })()")
        await pg.wait_for_selector('#wPlay')
        pre = await pg.evaluate("(() => { const e = document.querySelector('#modalBox .wlegs'); return e ? e.textContent : ''; })()")
        names = await pg.evaluate("wStarters().map(p => p.n)")
        check('Tired legs' in pre and names[0] in pre and names[1] in pre and names[2] not in pre and '3 Fatigue cards' in pre, 'the pre-game card names the tired starters and counts the Fatigue cards', [pre, names])
        await pg.screenshot(path='/tmp/realm-legs-pregame.png')
        await pg.click('#wPlay')
        await pg.wait_for_function("UI.view === 'fight' && !!B && B.phase === 'player'")
        k = await pg.evaluate(f"({{ n: {FATIGUE_IN}, legs: wRoster().map(wLegs), log: B.log ? B.log.slice(-12).map(l => l.t || l[0] || String(l)).join(' ') : '' }})")
        check(k['n'] == 3, 'a Tired starter brings 1 Fatigue card and a Spent one 2', k)
        check(k['legs'] == [4, 6, 1, 1], 'after kickoff: starters\' legs go up one, the bench\'s down one', k['legs'])
        view = await pg.evaluate(WIN)
        check(view == 'panel', 'the match is won', view)
        await pg.click('#bCont'); await pg.wait_for_function("UI.view === 'world'")
        await pg.evaluate(CLOSE_ALL)

        # ---------- the Team screen ----------
        await pg.evaluate("wOpenCamp()"); await pg.wait_for_timeout(300)
        tags = await pg.evaluate("[...document.querySelectorAll('#modalBox .wpr')].map(li => { const t = li.querySelector('[class*=wlegs-]'); return t ? [t.textContent, t.title] : null; })")
        check(tags[:3] == [['Tired', tags[0][1]], ['Spent', tags[1][1]], ['Fresh', tags[2][1]]] if all(tags) else False, 'the Team screen shows Fresh, Tired or Spent', tags)
        check('Fatigue card' in tags[1][1], 'and the tag says why', tags[1])
        await pg.screenshot(path='/tmp/realm-legs-team.png')
        await pg.evaluate(CLOSE_ALL)

        # ---------- rest: a bed, then a camp ----------
        bed = await pg.evaluate("(() => { RUN.gold = Math.max(RUN.gold, 50); wEnterMap('graftonbury', MAPS.graftonbury.spawn[0], MAPS.graftonbury.spawn[1]); const r = wSleepInn(12); return { r, legs: wRoster().map(wLegs) }; })()")
        check(bed['r'] == '' and bed['legs'] == [0, 2, 0, 0], 'a night in a bed takes 4 off everyone\'s legs', bed)
        camp = await pg.evaluate("(() => { wRoster()[1].legs = 6; const L = DB.locs.find(l => l.map === 'graftonbury'); wEnterMap('world', L.x, L.y + 3); wAddItem(W_CAMP.item, 1); const r = wMakeCamp(0.999); return { r, legs: wRoster().map(wLegs) }; })()")
        check(camp['r'] == '' and camp['legs'][1] == 4, 'a night camping out takes 2 off', camp)
        await pg.evaluate(CLOSE_ALL)

        # ---------- the save ----------
        await pg.evaluate("wRoster()[0].legs = 5; wSave()")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate(CLOSE_ALL)
        check(await pg.evaluate("wRoster().map(wLegs)") == [5, 4, 0, 0], 'the save keeps everyone\'s legs', await pg.evaluate("wRoster().map(wLegs)"))

        # ---------- off ----------
        off = await pg.evaluate("(() => { W_FAT.off = true; const n = wFatCards(wRoster()[0]); W_FAT.off = false; return n; })()")
        check(off == 0, 'W_FAT.off turns it off (the bot\'s control run)', off)
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpLegs'); return h ? h.textContent : ''; })()")
        check('Tired legs' in help_ and 'Fatigue' in help_ and 'bench' in help_, 'How to play explains tired legs', help_)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm legs passed')

asyncio.run(main())
