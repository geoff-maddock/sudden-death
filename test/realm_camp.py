# Realm camping out: Make camp (Bag tab) only works in the wild and uses a Trail Ration; a quiet night sleeps until
# 7 and heals half your max HP; cover is riskier than the open or the road; caught asleep, a match starts at 2 in the
# morning after a quarter's healing, they are a score ahead and your team is Weak; win and you sleep on for the other
# quarter, lose and you black out. Asserts; exits nonzero on failure. Screenshots: /tmp/realm-camp-*.png.
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

HELP = r'''window.__wbot = function (maxTurns) {
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
window.__wlose = function () { let g = 0; while (B && !B.over && g++ < 40) { RUN.hp = 1; runSteps(endTurn()); } return B && B.over; };
window.__wend = function () { consumeFx(); renderFightHUD(); finishFight(); };
// a walkable tile in a region: in cover (wild teams roam it, off the road) or on the road
window.__spot = function (rg, cover) { const m = MAPS.world; for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) { if (regionAt(x, y) !== rg) continue; const c = wTileAt(m, x, y), td = DB.tiles[c]; if (!td || !td.walk || td.enter) continue; const road = c === '=' || c === 'b'; if (cover ? !road && td.enc > 0 : road) return [x, y]; } return null; };
window.__camp = function (cover) { const p = __spot('plains', cover); wEnterMap('world', p[0], p[1]); WG.min = 21 * 60; WG.grace = 99; RUN.relics = []; WG.meal = null; WG.charm = null; return p; };
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"

async def boot(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wStart === 'function' && typeof wMakeCamp === 'function'")
    await pg.add_script_tag(content=HELP)
    await pg.evaluate(NOTIPS)

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        for vp, tag in [({'width': 1280, 'height': 800}, 'desk'), ({'width': 390, 'height': 844}, 'phone')]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if tag == 'phone' else 1, is_mobile=tag == 'phone', has_touch=tag == 'phone')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, tag=tag: errs.append(tag + ': ' + str(e)))
            pg.on('console', lambda m, tag=tag: errs.append(tag + ' console: ' + m.text) if m.type == 'error' else None)
            await boot(pg)
            await new_journey(pg)
            if tag == 'desk':
                # ---------- where you can camp, and what it needs ----------
                where = await pg.evaluate("""(() => { const at = wInnSpot('graftonbury'); wEnterMap('graftonbury', at[0], at[1]); WG.items.ration = 2; const town = wCanCamp();
                  const d = MAPS.hatchery; wEnterMap('hatchery', d.spawn[0], d.spawn[1]); const dg = wCanCamp();
                  __camp(true); WG.items.ration = 0; const none = wCanCamp(); WG.items.ration = 2; const ok = wCanCamp();
                  return { town, dg, none, ok }; })()""")
                check(where['town'].startswith('You are in town') and where['dg'].startswith('Not in here') and 'Trail Ration' in where['none'] and where['ok'] == '', 'you can camp in the wild with a Trail Ration, not in town, a dungeon, or without one', where)
                rk = await pg.evaluate("""(() => { __camp(true); const cover = wCampRisk(); __camp(false); const open = wCampRisk(); return { cover, open }; })()""")
                check(rk['cover'] == 0.33 and rk['open'] == 0.2, 'cover is riskier than the road', rk)

                # ---------- a quiet night ----------
                q = await pg.evaluate("""(() => { __camp(true); RUN.maxhp = 100; RUN.hp = 10; WG.items.ration = 2; const d0 = WG.dayAbs;
                  const r = wMakeCamp(0.99); return { r, hp: RUN.hp, min: WG.min, day: WG.dayAbs - d0, rations: WG.items.ration, view: UI.view, b: !!B }; })()""")
                check(q['r'] == '' and q['hp'] == 60 and q['min'] == 7 * 60 and q['day'] == 1 and q['rations'] == 1 and q['view'] == 'world' and not q['b'], 'a quiet night uses a ration, sleeps until 7, and heals half your max HP', q)

                # ---------- caught asleep, and you win ----------
                a = await pg.evaluate("""(() => { __camp(true); RUN.maxhp = 100; RUN.hp = 10; WG.items.ration = 1; wMakeCamp(0);
                  const W = RUN.pending && RUN.pending.world;
                  return { kind: W && W.kind, night: W && W.night, ambush: !!(B && B.wAmbush), camp: !!(B && B.wCamp), weak: B ? sv(B.P, 'weak') : 0, phase: B && B.phase, turn: B && B.turn,
                    hp: RUN.hp, min: WG.min, view: UI.view, modal: document.getElementById('modal').hidden, rations: WG.items.ration || 0 }; })()""")
                check(a['kind'] == 'camp' and a['view'] == 'fight' and a['modal'] and a['rations'] == 0, 'caught asleep, the match starts at once, with no pre-game card', a)
                check(a['night'] == 1 and a['min'] == 2 * 60 and a['hp'] == 35, 'they come at 2 in the morning, after a quarter of the healing', a)
                check(a['ambush'] and a['camp'] and a['weak'] >= 1 and a['phase'] == 'player' and a['turn'] == 1, 'they start a score ahead, and your team is Weak on the first turn', a)
                await pg.screenshot(path='/tmp/realm-camp-caught-desk.png')
                await pg.evaluate("RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = 300; for (const e of alive()) e.hp = Math.min(e.hp, 6)")
                over = await pg.evaluate("__wbot(120)")
                await pg.evaluate("__wend()"); await pg.wait_for_selector('#bCont'); await pg.click('#bCont')
                await pg.wait_for_function("UI.view === 'world' && !RUN.pending")
                w = await pg.evaluate("({ min: WG.min, hp: RUN.hp, max: RUN.maxhp, log: WLOG.slice(-6).map(l => l[0]).join(' | ') })")
                check(over == 'win' and w['min'] == 7 * 60 and 'sleep until morning' in json.dumps(w['log']), 'win, and you sleep on until 7', {'over': over, **w})

                # ---------- caught asleep, and you lose ----------
                await pg.evaluate("document.querySelectorAll('#modalBox [data-close]').forEach(b => b.click())")
                l = await pg.evaluate("""(() => { WG.home = 'mossgate'; WG.wprompts = []; __camp(true); RUN.hp = 30; WG.items.ration = 1; wMakeCamp(0); __wlose(); __wend();
                  const wake = document.getElementById('wWake'); if (wake) wake.click(); return { map: WG.map, view: UI.view, blackouts: WG.blackouts }; })()""")
                check(l['map'] == 'mossgate' and l['view'] == 'world' and l['blackouts'] >= 1, 'lose, and it is a blackout like any other', l)

                await pg.evaluate("renderHelp()")
                check(await pg.evaluate("!!document.getElementById('wHelpCampOut')"), 'How to play explains camping out')

            # ---------- the Bag tab ----------
            await pg.evaluate("document.querySelectorAll('#modalBox [data-close]').forEach(b => b.click()); __camp(true); WG.items.ration = 1; RUN.hp = Math.floor(RUN.maxhp / 2); wOpenCamp('bag')")
            await pg.wait_for_selector('#wMakeCamp:not([disabled])')
            await pg.screenshot(path=f'/tmp/realm-camp-bag-{tag}.png')
            check('half asleep' in await pg.evaluate("document.querySelector('.wcampout').textContent"), f'[{tag}] the Bag tab offers Make camp and says what it risks')
            await pg.evaluate("Math.random = () => 0.99")
            await pg.click('#wMakeCamp'); await pg.wait_for_function("document.getElementById('modal').hidden && WG.min === 7 * 60")
            check(await pg.evaluate("UI.view === 'world' && !(WG.items.ration > 0)"), f'[{tag}] Make camp closes the Team screen and you wake in the morning')
            await pg.evaluate("const at = wInnSpot('graftonbury'); wEnterMap('graftonbury', at[0], at[1]); WG.items.ration = 1; wOpenCamp('bag')")
            await pg.wait_for_selector('#wMakeCamp[disabled]')
            check(True, f'[{tag}] in town, Make camp is off')

            sd = await pg.evaluate('window.__sdErrs || []')
            check(not sd, f'[{tag}] no __sdErrs', sd)
            await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    print('ok: realm camp passed' if not FAILS else f'FAILED: {len(FAILS)} checks')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
