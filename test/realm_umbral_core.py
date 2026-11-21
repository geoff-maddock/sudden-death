# Realm: the Umbral Realm's plumbing (issue #99, phase 0). Before the Crown the light portal isn't there; winning it
# (the 'champion' flag) opens the Umbral (WG.umbral) and marks the Road to Nowhere. The dark maps are built from the
# light ones: the same ground under dark palettes, nothing to use, the portal reachable on both sides. Step into the
# portal and you cross; leave the dark road and you are on the dark world (in the Deadspire, never brighter than
# dusk), where other places are shut for now. A save on the dark side reloads there, and you can walk back through.
# A journey that won the Crown before the Umbral existed gets it on loading. Asserts; exits nonzero on failure.
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbralUnlock === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        b = await pg.evaluate("""(() => { const [x, y] = W_UMB.portal.umbralden, m0 = WG.map, x0 = WG.x, y0 = WG.y; wEnterMap('umbralden', 2, 6); const look = wLookText(x, y), raw = MAPS.umbralden.t[y][x], meta = !!MAPS.umbralden.meta[x + ',' + y];
          wEnterMap(m0, x0, y0); return { on: wUmbOn(), tile: wTileAt(MAPS.umbralden, x, y), raw, meta, look, dark: !!MAPS['u:world'] && !!MAPS['u:umbralden'] }; })()""")
        check(not b['on'] and b['tile'] != 'D' and b['raw'] != 'D' and not b['meta'] and 'tear' not in b['look'] and b['dark'], 'before the Crown the Umbral is shut, and nothing of the light portal shows: not its tile, not in the raw map (the local map), not to Look (the dark maps are built all the same)', b)

        u = await pg.evaluate("""(() => { const [x, y] = W_UMB.portal.umbralden; wSetFlag('champion'); const U = WG.umbral;
          return { umb: !!U && Array.isArray(U.pieces) && U.finale === 0, den: wFlag('clue_den'), tile: wTileAt(MAPS.umbralden, x, y), json: JSON.stringify(WG.umbral) === JSON.stringify(JSON.parse(JSON.stringify(WG.umbral))), again: wUmbralUnlock() }; })()""")
        check(u['umb'] and u['den'] and u['tile'] == 'D' and u['json'] and u['again'] is False, 'winning the Crown opens the Umbral once (WG.umbral, plain data), marks the Road to Nowhere, and shows the portal', u)

        mp = await pg.evaluate("""(() => { const out = {};
          for (const id of ['u:world', 'u:umbralden']) { const m = MAPS[id], used = []; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const c = m.t[y][x], td = DB.tiles[c] || {}; if (td.use && c !== 'S' && !(m.meta[x + ',' + y] || {}).loc) used.push(c + '@' + x + ',' + y); } out[id] = used.slice(0, 5); }
          out.pal = [wMapPal(MAPS['u:umbralden']).id, MAPS['u:world'].region[37 + 6 * WW]];
          const reach = (m) => { const P = m.uPortal || Object.keys(m.meta).find(k => m.meta[k].portal).split(',').map(Number), s = bfsReach(m, m.spawn[0], m.spawn[1]); return [[1,0],[-1,0],[0,1],[0,-1]].some(([dx, dy]) => s[(P[1] + dy) * m.w + P[0] + dx]); };
          out.reach = [reach(MAPS.umbralden), reach(MAPS['u:umbralden'])];
          out.names = [MAPS['u:world'].name, MAPS['u:umbralden'].name];
          out.audit = wAudit().filter(s => /u:|umbral|portal/i.test(s));
          return out; })()""")
        check(mp['u:world'] == [] and mp['u:umbralden'] == [], 'the dark maps have nothing to use yet (no wells, nests, bushes or eggs to take twice)', mp)
        check(mp['pal'] == ['urime', 'urime'] and mp['reach'] == [True, True] and mp['names'] == ['The Umbral Realm', 'The Road to Somewhere'] and mp['audit'] == [], 'they are drawn in the dark palettes, the portal can be walked to on both sides, and the audit is clean', mp)

        cr = await pg.evaluate("""(() => { const [x, y] = W_UMB.portal.umbralden, out = {};
          wEnterMap('umbralden', 2, 6); const [bx, by] = wUmbBeside(MAPS.umbralden, x, y); WG.x = bx; WG.y = by;
          wTryMove(x - bx, y - by); wDrain();
          out.saved = (wLoadSave().WG.umbral || {}).crossed;
          out.over = { map: WG.map, crossed: WG.umbral.crossed, region: wRegionHere(), name: wRegionName(), dusk: wDarkness() >= W_UMB.dusk, near: Math.abs(WG.x - x) + Math.abs(WG.y - y) };
          // (off the dark road's west end: the dark world, by the Road to Nowhere)
          WG.x = 0; WG.y = 6; wTryMove(-1, 0); wDrain(); const L = DB.locs.find(l => l.id === 'umbralden');
          out.world = { map: WG.map, at: [WG.x, WG.y], want: [L.x, L.y + 1], name: wRegionName() };
          // (a town on the dark world is shut)
          const T = DB.locs.find(l => l.id === 'rimewatch'); WG.x = T.x; WG.y = T.y + 1; wTryMove(0, -1); wDrain();
          out.shut = { map: WG.map, at: [WG.x, WG.y], want: [T.x, T.y + 1], log: WLOG.slice(-1)[0][0] };
          // (a border crossed on the dark world says the dark region; a light map's picture cleared clears its dark copy's)
          const n0 = WLOG.length; wAmbient(MAPS['u:world'], 'plains'); out.arrive = WLOG.slice(n0).map(l => l[0]).join(' ');
          WLAY['u:world'] = WLAY['u:world'] || { m: MAPS['u:world'] }; wInvalidate('world'); out.inval = !WLAY['u:world'];
          // (and an alpha's lair, used rather than walked into)
          const Z = DB.locs.find(l => l.kind === 'lair'); WG.x = Z.x; WG.y = Z.y + 1; const v0 = UI.view; wTryMove(0, -1); wDrain();
          out.lair = { map: WG.map, view: UI.view, fight: !!B, log: WLOG.slice(-1)[0][0] };
          WG.x = T.x; WG.y = T.y + 1;
          wSave(); return out; })()""")
        check(cr['saved'] == 1, 'the crossing is counted in the save the map change makes', cr)
        check(cr['over']['map'] == 'u:umbralden' and cr['over']['crossed'] == 1 and cr['over']['region'] == 'rime' and cr['over']['name'] == 'The Deadspire' and cr['over']['dusk'] and cr['over']['near'] == 1, 'stepping into the portal crosses to the dark road, beside its portal, in the Deadspire, at dusk or darker', cr)
        check(cr['world']['map'] == 'u:world' and cr['world']['at'] == cr['world']['want'] and cr['world']['name'] == 'The Deadspire', 'leaving the dark road comes out on the dark world, by the Road to Nowhere', cr)
        check(cr['shut']['map'] == 'u:world' and cr['shut']['at'] == cr['shut']['want'] and 'shut' in cr['shut']['log'], 'a town on the dark world is shut for now, and you stay outside it', cr)
        check('Deadspire' in cr['arrive'] and 'Frostspire' not in cr['arrive'] and cr['inval'], 'crossing a border on the dark world names the dark region; clearing the light world\'s picture clears the dark one\'s', cr)
        check(cr['lair']['map'] == 'u:world' and cr['lair']['view'] == 'world' and not cr['lair']['fight'] and 'shut' in cr['lair']['log'], 'so is an alpha\'s lair: no light match starts from the dark world', cr)

        await pg.wait_for_timeout(400)
        await pg.screenshot(path='/tmp/umbral_world.png')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbralUnlock === 'function'")
        tl = await pg.evaluate("(() => { renderTitle(); const sp = document.querySelector('#resumeRow span'); return sp ? sp.textContent : ''; })()")
        check(tl.startswith('The Umbral Realm.') and 'u:' not in tl, 'the title\'s Continue row names the dark place, not its map id', tl)
        ld = await pg.evaluate("""(() => { const s = wLoadSave(); wStart(s); return { map: WG.map, at: [WG.x, WG.y], umb: !!WG.umbral && WG.umbral.crossed === 1, view: UI.view }; })()""")
        check(ld['map'] == 'u:world' and ld['at'] == cr['shut']['want'] and ld['umb'] and ld['view'] == 'world', 'a save on the dark side loads back on the dark side, the Umbral as it was', ld)

        bk = await pg.evaluate("""(() => { const L = DB.locs.find(l => l.id === 'umbralden'), out = {}; WG.x = L.x; WG.y = L.y + 1; wTryMove(0, -1); wDrain();
          out.road = WG.map; const [x, y] = W_UMB.portal.umbralden, [bx, by] = wUmbBeside(MAPS['u:umbralden'], x, y); WG.x = bx; WG.y = by; wTryMove(x - bx, y - by); wDrain();
          out.back = { map: WG.map, name: wRegionName(), dark: wUmbDark(), crossed: WG.umbral.crossed }; return out; })()""")
        check(bk['road'] == 'u:umbralden' and bk['back']['map'] == 'umbralden' and bk['back']['name'] == 'The Frostspire' and not bk['back']['dark'] and bk['back']['crossed'] == 1, 'walking into the Road to Nowhere on the dark world, then the portal, brings you back to the light', bk)
        await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/umbral_light_portal.png')

        od = await pg.evaluate("""(() => { delete WG.umbral; WG.flags.champion = 1; wSave(); wStart(wLoadSave()); return { umb: !!WG.umbral, den: wFlag('clue_den') }; })()""")
        check(od == {'umb': True, 'den': True}, 'a journey that won the Crown before the Umbral existed has it open on loading', od)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
