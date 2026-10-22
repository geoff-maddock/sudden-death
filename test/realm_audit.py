# Realm: build dist/realm.html, build every map, and assert the ported world data is sound
# (worldProblems, dungeonProblems, wAudit, maps for every location, NPC kinds, region sports, no page errors).
import asyncio, json, sys, subprocess
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

CHECK = r'''() => {
  const out = {};
  buildAllMaps();
  out.maps = Object.keys(MAPS);
  out.world = worldProblems();
  out.dungeons = Object.values(MAPS).filter(m => m.kind === 'dungeon').flatMap(m => dungeonProblems(m));
  out.audit = wAudit();
  const P = [];
  for (const L of DB.locs) if ((L.kind === 'town' || L.kind === 'dungeon' || L.kind === 'coliseum') && !MAPS[L.map]) P.push('no map for ' + L.id);
  for (const m of Object.values(MAPS)) {
    if (!(m.t.length === m.h && m.t.every(r => r.length === m.w))) P.push(m.id + ' tile grid is not ' + m.w + 'x' + m.h);
    if (!Array.isArray(m.spawn) || !DB.tiles[m.t[m.spawn[1]][m.spawn[0]]] || !DB.tiles[m.t[m.spawn[1]][m.spawn[0]]].walk) P.push(m.id + ' spawn is not walkable');
    for (const row of m.t) for (const c of row) if (!DB.tiles[c]) { P.push(m.id + ' unknown tile ' + c); break; }
    for (const n of m.npcs || []) {
      const ch = DB.chars[n.id];
      if (!ch) P.push(m.id + ' npc ' + n.id + ' not in DB.chars');
      else if (!KIND[ch.kind]) P.push(m.id + ' npc ' + n.id + ' has bad kind ' + ch.kind);
    }
  }
  if (!(MAPS.world.region && MAPS.world.region.length === WW * WH)) P.push('world region array wrong size');
  for (const r in DB.regions) {
    const rg = DB.regions[r];
    if (!rg.sports || !rg.sports.length) P.push('region ' + r + ' has no sports');
    for (const [sp] of rg.sports || []) if (!SPORTS[sp]) P.push('region ' + r + ' sport ' + sp + ' not in SPORTS');
    for (const k of rg.kinds || []) if (!KIND_NAME[k]) P.push('region ' + r + ' kind ' + k + ' not in KIND_NAME');
  }
  // deterministic: a second build gives the same world
  const a = JSON.stringify(MAPS.world.t); buildAllMaps();
  if (JSON.stringify(MAPS.world.t) !== a) P.push('buildAllMaps is not deterministic');
  out.other = P;
  out.sdErrs = window.__sdErrs || [];
  return out;
}'''

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1300, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL)
        await pg.wait_for_timeout(1200)
        r = await pg.evaluate(CHECK)
        await b.close()
    print('maps:', ' '.join(r['maps']))
    bad = {k: r[k] for k in ('world', 'dungeons', 'audit', 'other', 'sdErrs') if r[k]}
    if errs: bad['pageErrors'] = errs
    if bad:
        print('FAIL', json.dumps(bad, indent=1))
        sys.exit(1)
    print('ok: worldProblems, dungeonProblems, wAudit and map/NPC/region checks all clean;', len(r['maps']), 'maps')

asyncio.run(main())
