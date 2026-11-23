# Realm: dark shops that take a trophy (issue #111, phase H). The trophy list sells the Umbral's own wares; buying one
# takes the trophy for good and adds the ware; the Seal of the Crown, a club's trophy and one with a lasting gain can't
# be traded. The Hex Ward takes one hex off the next Nadir game's draw (a 1-hex champion plays with none) and is used up
# when that game ends; the Ichor Draught starts the next dark card match with 2 Strength; Lantern Oil rests you where
# you stand, only on the dark side. Shadow Salt is sold for fans in the dark shops and in none of the light ones. The
# audit is clean. Asserts; exits nonzero on failure.
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

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbTrade === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; WG.hardcore = false; WG.umbral.dreadSeen = 3; wSave()")

        tr = await pg.evaluate("""(() => { const plain = Object.keys(RELICS).find(k => !RELICS[k].gain && !RELICS[k].club && k !== 'umbseal'), club = Object.keys(RELICS).find(k => RELICS[k].club), gain = Object.keys(RELICS).find(k => RELICS[k].gain && !RELICS[k].club);
          RUN.relics = [plain, club, gain, 'umbseal'].filter(Boolean);
          const out = { tradable: wUmbTradable(), plain, club, gain };
          out.seal = wUmbTrade('uward', 'umbseal'); out.clubTry = club ? wUmbTrade('uward', club) : 'none';
          out.ok = wUmbTrade('uward', plain); out.relics = RUN.relics.slice(); out.wards = WG.items.uward || 0; return out; })()""")
        check(tr['tradable'] == [tr['plain']], 'only a plain trophy can be traded: not the Seal, a club trophy or one with a lasting gain', tr)
        check(tr['seal'] != '' and tr['clubTry'] != '' and tr['ok'] == '' and tr['plain'] not in tr['relics'] and tr['wards'] == 1, 'a trade takes the trophy for good and gives the ware; the Seal and a club trophy refuse', tr)

        ui = await pg.evaluate("""(() => { RUN.relics.push(Object.keys(RELICS).find(k => !RELICS[k].gain && !RELICS[k].club && k !== 'umbseal' && !RUN.relics.includes(k)));
          wUmbShop('general', 'A dark shop'); const sec = document.getElementById('wUmbTrade'), rows = sec ? sec.querySelectorAll('[data-uware]').length : 0;
          const fans = [...document.querySelectorAll('#wUmbShopBody [data-ubuy]')].map(b => b.dataset.ubuy);
          sec.querySelector('[data-uware="uichor"]').click(); const pick = sec.querySelectorAll('[data-utrade]').length; sec.querySelector('[data-utrade]:not([data-utrade=""])').click();
          const got = WG.items.uichor || 0; document.querySelector('#modalBox [data-close]').click();
          const light = Object.keys(DB.shops).filter(k => !k.startsWith('u_') && DB.shops[k].shadowsalt != null), dark = Object.keys(DB.shops).filter(k => k.startsWith('u_') && DB.shops[k].shadowsalt != null).length;
          return { rows, salt: fans.includes('shadowsalt'), pick, got, light, dark }; })()""")
        check(ui['rows'] == 3 and ui['pick'] >= 2 and ui['got'] == 1, 'the dark shop shows the trophy list, asks which trophy, and the ware is yours', ui)
        check(ui['salt'] and ui['light'] == [] and ui['dark'] >= 5, 'Shadow Salt is on the dark shops fans list and in no light shop', ui)

        wd = await pg.evaluate("""(() => { const U = WG.umbral, out = {};
          // the Hockey champion draws 1 hex; the Gatekeeper 2
          out.hk0 = wUmbHkHexes('rink', 1).length; out.gate0 = wUmbHexes('gate', 2).length;
          out.use = wUseItem('uward'); out.ready = U.ward; out.again = wUseItem('uward') !== '';
          out.hk1 = wUmbHkHexes('rink', 1).length; out.gate1 = wUmbHexes('gate', 2).length;
          out.bk = wUmbBkHexes('court', 1).length; out.cr = wUmbCrHexes('shed', 1).length;
          // a game ends (lost): the ward is used up
          W_ON_END.nadir('lose', { id: 'gate' }); out.after = U.ward; out.gate2 = wUmbHexes('gate', 2).length; U.tries.gate = 0;
          return out; })()""")
        check(wd['hk0'] == 1 and wd['gate0'] == 2 and wd['use'] == '' and wd['ready'] == 1 and wd['again'], 'a Hex Ward readies from the Bag (one at a time)', wd)
        check(wd['hk1'] == 0 and wd['gate1'] == 1 and wd['bk'] == 0 and wd['cr'] == 0, 'with it readied, every draw has a hex fewer, a 1-hex champion none', wd)
        check(wd['after'] == 0 and wd['gate2'] == 2, 'the ward is used up when the game ends', wd)

        ic = await pg.evaluate("""(() => { const U = WG.umbral, out = {}; out.use = wUseItem('uichor'); out.ready = U.ichor;
          wEnterMap('u:umbralden', 5, 5); LAB = true; RUN.pending = null; try { startMatch({ type: 'normal', tier: 3, world: { kind: 'wild', region: 'rime', umbral: 1 } }); } finally { LAB = false; }
          out.str = B && B.P && (B.P.st || {}).str; out.left = U.ichor; finishFight && (B.over = 'win', B.phase = 'done'); RUN.pending = null; B = null; showView('world'); return out; })()""")
        check(ic['use'] == '' and ic['ready'] == 1 and ic['left'] == 0 and (ic['str'] or 0) >= 2, 'the Ichor Draught starts the next dark card match with 2 Strength, and is used up', ic)

        lo = await pg.evaluate("""(() => { const out = {}; WG.items.ulampoil = 2; wEnterMap('world', 20, 20); out.light = wUseItem('ulampoil'); RUN.hp = 10;
          wEnterMap('u:umbralden', 5, 5); out.dark = wUseItem('ulampoil'); out.hp = RUN.hp === RUN.maxhp; out.left = WG.items.ulampoil; return out; })()""")
        check(lo['light'] != '' and lo['dark'] == '' and lo['hp'] and lo['left'] == 1, 'Lantern Oil rests you where you stand, only on the dark side', lo)

        au = await pg.evaluate("wAudit()")
        check(au == [], 'the audit is clean', au)
        hp = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpUmbTrade'); return h ? h.textContent : ''; })()")
        check('Hex Ward' in hp and 'trophy' in hp, 'How to play explains the trophy wares', hp[:160])
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\nall ok' if not FAILS else f'\n{len(FAILS)} FAILED'); sys.exit(1 if FAILS else 0)

asyncio.run(main())
