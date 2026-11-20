# Realm shed: Tilda Spindle (issue #102). The Shed's fan reads the day's ICE (what the cold has done to it, and the
# frost along the boards), talks about sweeping the empty sheet, and when asked to PLAY: not until your four has won a
# curling match from the world; then she joins, once, a spider at the team's level with her curling sweep at the cap,
# and greets you as one of your own after. A full roster you won't make room on leaves her still asking. How to play
# names her. Asserts; exits nonzero on failure.
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
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        t = await pg.evaluate("""(() => { const cold = wShedColdNow(), ice = wSay('gf_shed', 'ice').text, sweep = wSay('gf_shed', 'sweep').text, greet = wSay('gf_shed', '').text;
          const want = cold === 'heavy' ? 'Heavy' : cold === 'keen' ? 'Keen' : 'As Hennock likes it';
          return { ice: ice.startsWith(want) && /boards/.test(ice), sweep: /empty/.test(sweep), greet: /nobody lets me play/.test(greet) }; })()""")
        check(t == {'ice': True, 'sweep': True, 'greet': True}, 'Tilda reads the day\'s ICE (the cold and the boards), sweeps the empty sheet, and nobody lets her play', t)
        n0 = await pg.evaluate("(() => { const n = wRoster().length; const r = wSay('gf_shed', 'play'); wRunAct(r.act, 'gf_shed'); return { n, after: wRoster().length, joined: wFlag('tilda_joined'), said: r.text, greet: /ICE/.test(wSay('gf_shed', '').text) && /PLAY/.test(wSay('gf_shed', '').text) }; })()")
        check(n0['after'] == n0['n'] and not n0['joined'] and 'Win a curling match' in n0['said'] and n0['greet'], 'her greeting names ICE and PLAY; before your four has won a curling match, she won\'t believe you have a rink (said in the talk box)', n0)
        j = await pg.evaluate("""(() => { WG.shg = Object.assign(wShg(), { w: 1 }); while (wRoster().length >= W_PARTY.max) WG.roster.pop(); const n = wRoster().length, lv = wStarLvl();
          const r = wSay('gf_shed', 'play'); wRunAct(r.act, 'gf_shed'); const T = wRoster().find(p => p.n === 'Tilda Spindle');
          const again = (() => { const r2 = wSay('gf_shed', 'play'); wRunAct(r2.act, 'gf_shed'); return wRoster().filter(p => p.n === 'Tilda Spindle').length; })();
          return { joined: !!T && wFlag('tilda_joined'), kind: T && T.kind, lvl: T && T.lvl === lv, swp: T && wCrOf(T).swp === wCrCap(), again, greet: /Back at the Shed/.test(wSay('gf_shed', '').text), grew: wRoster().length - n }; })()""")
        check(j == {'joined': True, 'kind': 'spider', 'lvl': True, 'swp': True, 'again': 1, 'greet': True, 'grew': 1}, 'after a win she joins, once: a spider at the team\'s level, the best sweeper there is, and greets you as her own', j)
        f = await pg.evaluate("""(() => { const T = wRoster().find(p => p.n === 'Tilda Spindle'); wRelease(T.id); const gone = wSay('gf_shed', 'play').text;
          delete WG.flags.tilda_joined; let k = 0; while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: 'goblin', lvl: 1, n: 'Fill' + k++ }, 'tavern'));
          const r = wSay('gf_shed', 'play'); wRunAct(r.act, 'gf_shed'); const asked = !document.getElementById('modal').hidden;
          const no = [...document.querySelectorAll('#modalBox button')].find(b => /No thanks|Not now|Keep/i.test(b.textContent)) || [...document.querySelectorAll('#modalBox button')].pop(); if (no) no.click();
          const camp = WG.wwait.filter(p => p.n === 'Tilda Spindle').length, flag = wFlag('tilda_joined'), campSay = wSay('gf_shed', 'play').text;
          // (room made: asking again sends you to camp; signed there, she joins once, and only once)
          wRelease(wRoster().find(p => /^Fill/.test(p.n)).id); const r2 = wSay('gf_shed', 'play'); wRunAct(r2.act, 'gf_shed'); const before = wRoster().filter(p => p.n === 'Tilda Spindle').length;
          wSignWaiting(WG.wwait.findIndex(p => p.n === 'Tilda Spindle')); const one = wRoster().filter(p => p.n === 'Tilda Spindle').length;
          return { gone: /let me go/.test(gone), asked, camp, flag, campSay: /camp/.test(campSay), before, one, joined: wFlag('tilda_joined'), left: WG.wwait.filter(p => p.n === 'Tilda Spindle').length }; })()""")
        check(f['gone'], 'let go, she is back on Hennock\'s brooms (not on your team)', f)
        check(f['asked'] and f['camp'] == 1 and not f['flag'] and f['campSay'], 'a full roster asks who goes; turned down, she waits at camp and says so', f)
        check(f['before'] == 0 and f['one'] == 1 and f['joined'] and f['left'] == 0, 'signed from camp she joins once, and only once', f)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wHelpShedGame'); return !!h && /Tilda Spindle/.test(h.textContent); })()")
        check(hp, 'How to play names her', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
