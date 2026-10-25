# Realm cities (issue #6, phase 3): the five cities at about twice the area, each with its own layout. Everyone who
# lived in the old towns still lives there; every person, sign, painting, shelf, bush and door can be reached from the
# way in, and so can every floor tile of every building; each city has homes you can walk into and the new decor
# (hedges, fences, flower beds, benches...), all drawn by the ink renderer. You can leave by an edge. A save made in an
# old town on what is now a wall continues on the nearest open tile, with the townsfolk back in their new places.
# The audit is clean, and How to play says so.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-cities-*.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

CITIES = ['graftonbury', 'mossgate', 'saltmere', 'cinderhold', 'rimewatch']
# who lived in each old town (its building keepers and its townsfolk)
PEOPLE = {
    'graftonbury': ['clerk', 'pell', 'tansy', 'quill', 'hq_shop', 'hq_inn', 'rival', 'vesper', 'almond', 'tallow', 'rowe'],
    'mossgate': ['moss_reg', 'moss_shop', 'moss_inn', 'brack', 'wenna', 'fern', 'moss_kid'],
    'saltmere': ['salt_reg', 'salt_shop', 'salt_inn', 'netter', 'anck', 'diver', 'marrowbone'],
    'cinderhold': ['cind_reg', 'cind_shop', 'cind_inn', 'smith', 'scout', 'grit', 'pyre'],
    'rimewatch': ['halvard', 'rime_reg', 'rime_shop', 'rime_inn', 'watcher', 'monk', 'ingrith'],
}
NEW_TILES = '1234578 90'.replace(' ', '')

PROBE = """(id => {
  const m = MAPS[id], seen = bfsReach(m, m.spawn[0], m.spawn[1]), at = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && seen[y * m.w + x];
  const near = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy));
  const bad = [];
  // a keeper behind a counter is talked to across it
  const counter = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => m.t[y + dy] && m.t[y + dy][x + dx] === '-' && near(x + dx, y + dy));
  for (const n of m.npcs) if (!near(n.x, n.y) && !counter(n.x, n.y)) bad.push('person ' + n.id);
  for (const k in m.meta) { const [x, y] = k.split(',').map(Number); if (!near(x, y)) bad.push('object ' + m.t[y][x] + ' at ' + k); }
  const floors = [], homes = [];
  for (const [bx, by, bw, bh] of m.blds) {
    let walk = 0, reach = 0, cy = -1, door = 's';
    for (let y = by + 1; y < by + bh - 1; y++) if (m.t[y][bx + 1] === '-') cy = y;
    for (let x = bx; x < bx + bw; x++) if (m.t[by][x] === '+') door = 'n';
    // behind a counter is the keeper's side
    const behind = y => cy >= 0 && (door === 's' ? y < cy : y > cy);
    for (let y = by + 1; y < by + bh - 1; y++) for (let x = bx + 1; x < bx + bw - 1; x++) { const c = m.t[y][x]; if (!walkCh(c) || c === '+' || behind(y)) continue; walk++; if (at(x, y)) reach++; }
    if (walk !== reach) floors.push([bx, by, walk, reach]);
    const keeper = m.npcs.some(n => n.x > bx && n.x < bx + bw - 1 && n.y > by && n.y < by + bh - 1);
    if (!keeper) homes.push([bx, by, reach]);
  }
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.t[y][x] === '+' && !at(x, y)) bad.push('door at ' + x + ',' + y);
  let edge = false; for (let x = 0; x < m.w; x++) edge = edge || at(x, 0) || at(x, m.h - 1); for (let y = 0; y < m.h; y++) edge = edge || at(0, y) || at(m.w - 1, y);
  const tiles = {}; for (const row of m.t) for (const c of row) tiles[c] = (tiles[c] || 0) + 1;
  return { w: m.w, h: m.h, ids: m.npcs.map(n => n.id), bad, floors, homes, edge, tiles, blds: m.blds.length, spawnOpen: wOpenTile(m, m.spawn[0], m.spawn[1]),
    inn: (() => { const s = wInnSpot(id); return walkCh(m.t[s[1]][s[0]]) && at(s[0], s[1]); })() };
})"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_CITIES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        old = await pg.evaluate("W_CITY_OLD")
        check(await pg.evaluate("wOpenTile(wCurMap(), WG.x, WG.y) && WG.map === 'graftonbury' && WG.cities === W_CITY_VER"), 'a new journey starts on an open tile in Graftonbury')

        sigs = []
        for c in CITIES:
            r = await pg.evaluate(PROBE + f"('{c}')")
            ratio = r['w'] * r['h'] / (old[c][0] * old[c][1])
            check(1.85 <= ratio <= 2.4, f'{c}: about twice the area ({r["w"]}x{r["h"]}, {ratio:.2f}x)')
            check(all(i in r['ids'] for i in PEOPLE[c]), f'{c}: everyone who lived there still does', [i for i in PEOPLE[c] if i not in r['ids']])
            check(not r['bad'] and r['spawnOpen'] and r['inn'], f'{c}: every person (or their counter), object and door can be reached, from an open way in, and the inn\'s wake-up spot too', r)
            check(not r['floors'], f'{c}: every floor tile of every building can be reached (this side of the counter)', r['floors'])
            check(len(r['homes']) >= 2 and all(h[2] > 0 for h in r['homes']), f'{c}: homes you can walk into', r['homes'])
            new = [t for t in NEW_TILES if r['tiles'].get(t)]
            check(len(new) >= 3, f'{c}: the new decor ({new})', r['tiles'])
            check(r['edge'], f'{c}: you can walk out by an edge')
            sigs.append((r['blds'], tuple(sorted(new))))
        check(len(set(sigs)) == 5, 'every city has its own layout', sigs)
        check(await pg.evaluate(f"[...'{NEW_TILES}'].every(t => DB.tiles[t] && WOBJ[t] && !DB.tiles[t].walk && DB.tiles[t].look)"), 'every new tile has a name, a look and a painter, and blocks the way')

        # ---------- every city draws ----------
        for c in CITIES:
            await pg.evaluate(f"(() => {{ const m = MAPS['{c}']; wEnterMap('{c}', m.spawn[0], m.spawn[1]); WG.min = 12 * 60; wDrain(); }})()")
            await pg.wait_for_timeout(1800)
            await pg.screenshot(path=f'/tmp/realm-cities-{c}.png')
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'all five draw without errors', errs + await pg.evaluate("window.__sdErrs"))

        # ---------- an old save ----------
        await pg.evaluate("""(() => { const m = MAPS.graftonbury; let wall = null;
          for (let y = 0; y < m.h && !wall; y++) for (let x = 0; x < m.w && !wall; x++) if (m.t[y][x] === '#') wall = [x, y];
          WG.map = 'graftonbury'; WG.x = wall[0]; WG.y = wall[1]; delete WG.cities;
          WG.npc.graftonbury = m.npcs.map(() => [0, 0]); WG.npc.saltmere = MAPS.saltmere.npcs.map(() => [1, 1]);
          localStorage.setItem(wSaveKey(), JSON.stringify({ v: REALM.v, WG, RUN })); })()""")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        mig = await pg.evaluate("""(() => { const m = wCurMap(); return { map: WG.map, open: wOpenTile(m, WG.x, WG.y), ver: WG.cities,
          people: ['graftonbury', 'saltmere'].every(id => MAPS[id].npcs.every(n => walkCh(MAPS[id].t[n.y][n.x]) && !(n.x === 0 && n.y === 0) && !(n.x === 1 && n.y === 1))),
          saved: JSON.parse(localStorage.getItem(wSaveKey())).WG.cities }; })()""")
        check(mig['map'] == 'graftonbury' and mig['open'] and mig['ver'] == 1 and mig['saved'] == 1, 'an old save standing on a new wall continues on the nearest open tile', mig)
        check(mig['people'], 'and the townsfolk start from their new places, not where the old town had them', mig)

        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpCities'); return h ? h.textContent : ''; })()")
        check('The cities' in help_, 'How to play describes the cities', help_)
        check(await pg.evaluate("wAudit().length === 0 && worldProblems().length === 0"), 'the audit is clean', await pg.evaluate("wAudit().concat(worldProblems())"))
        check(not errs, 'no page errors', errs)
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm cities passed')

asyncio.run(main())
