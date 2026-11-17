# Realm places (issue #90): each city builds in its own style and its grounds take it; every building has a kind and
# a front that shows it (a sign with its icon, windows, awnings, pennants, chimneys); each city's landmarks stand where
# they can be reached and do what they say, once a day where they should. Each dungeon has its own terrain and keeps
# every room, strongbox and the alpha reachable, with the famous teams in the same rooms as before; the lever opens
# the gate to the side vault, a cracked wall breaks through for a shortcut, the survey stone shows the whole map, the
# pennants name the teams and tear when beaten, vents scald on the beat, shallow water is slow, the ore seam and kelp
# bed pay and then rest. Levers and broken walls survive a save and reload. The audit is clean, How to play says so.
# Waits on state, not fixed sleeps. Asserts; exits nonzero on failure.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

HELP = r'''
// stand beside the first tile of a map matching pred, facing it; returns [x, y] of the tile
window.__at = function (mapId, pred) { const m = MAPS[mapId];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { if (!pred(wTileAt(m, x, y), x, y)) continue;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const c = wTileAt(m, x + dx, y + dy);
      if (c && DB.tiles[c] && DB.tiles[c].walk && !DB.tiles[c].enter && !(m.npcs || []).some(n => n.x === x + dx && n.y === y + dy)) {
        wEnterMap(mapId, x + dx, y + dy); WG.grace = 99; WG.face = dx > 0 ? 'l' : dx < 0 ? 'r' : dy > 0 ? 'u' : 'd'; return [x, y]; } } }
  return null; };
// what can be walked to from the spawn, by what the player really sees (overlays included)
window.__reach = function (mapId) { const m = MAPS[mapId], seen = new Uint8Array(m.w * m.h), q = [m.spawn.slice()]; seen[m.spawn[1] * m.w + m.spawn[0]] = 1;
  while (q.length) { const [x, y] = q.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue; const i = ny * m.w + nx, c = wTileAt(m, nx, ny);
    if (seen[i] || !c || !DB.tiles[c] || !DB.tiles[c].walk) continue; seen[i] = 1; q.push([nx, ny]); } }
  return seen; };
window.__near = function (mapId, seen, x, y) { const m = MAPS[mapId]; return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(y + dy) * m.w + x + dx]); };
window.__count = function (mapId, chs) { const m = MAPS[mapId]; let n = 0; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (chs.includes(wTileAt(m, x, y))) n++; return n; };
window.__last = function () { return WLOG.slice(-1)[0][0]; };
'''

async def boot(pg):
    await pg.wait_for_function("typeof W_DELVE !== 'undefined' && !!document.getElementById('bNew')")
    await pg.add_script_tag(content=HELP)
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await boot(pg)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        check(await pg.evaluate("wAudit()") == [], 'the audit is clean', await pg.evaluate("wAudit()"))

        # ---------- city styles ----------
        styles = await pg.evaluate("Object.fromEntries(['graftonbury','mossgate','saltmere','cinderhold','rimewatch','coliseum','g_ballpark','g_bowl','g_rink'].map(id => [id, (wStyleOf(MAPS[id]) || {}).id || null]))")
        want = {'graftonbury': 'brick', 'mossgate': 'bark', 'saltmere': 'clapboard', 'cinderhold': 'basalt', 'rimewatch': 'stone', 'coliseum': 'marble', 'g_ballpark': 'brick', 'g_bowl': 'basalt', 'g_rink': 'stone'}
        check(styles == want, 'each city builds in its own style, and its grounds take it', styles)

        # ---------- building kinds and fronts ----------
        kinds = await pg.evaluate("Object.fromEntries(['graftonbury','mossgate','saltmere','cinderhold','rimewatch'].map(id => [id, MAPS[id].bldK.map(b => b[4])]))")
        check({'office', 'workshop', 'canteen', 'chapel', 'shop', 'inn', 'home'} <= set(kinds['graftonbury']), 'Graftonbury has an office, workshop, canteen, chapel, shop, inn and homes', kinds['graftonbury'])
        check('smithy' in kinds['cinderhold'] and 'arena' in kinds['cinderhold'], 'Cinderhold has its smithy and arena', kinds['cinderhold'])
        check('tower' in kinds['saltmere'] and 'warehouse' in kinds['saltmere'], 'Saltmere has its lighthouse and warehouse', kinds['saltmere'])
        check('apiary' in kinds['mossgate'] and 'chapel' in kinds['rimewatch'], 'Mossgate has its apiary, Rimewatch its abbey', [kinds['mossgate'], kinds['rimewatch']])
        fronts = await pg.evaluate("""(() => { const out = {};
          for (const id of ['graftonbury','mossgate','saltmere','cinderhold','rimewatch']) { const m = MAPS[id], f = Object.values(m.fac), k = {}; for (const x of f) k[x.k] = (k[x.k] || 0) + 1;
            // every building with a keeper has a sign by its door, with its kind's icon
            const signs = f.filter(x => x.k === 'sign').map(x => x.kind + ':' + x.icon);
            const onWall = Object.keys(m.fac).every(key => { const [x, y] = key.split(',').map(Number); return m.t[y][x] === '#' || m.t[y][x] === '+'; });
            out[id] = { k, signs, keepers: m.bldK.filter(b => b[4] !== 'home').length, onWall }; }
          return out; })()""")
        for c, r in fronts.items():
            check(len(r['signs']) == r['keepers'] and r['onWall'], f'{c}: every building with a keeper has a sign with its icon, and every front feature is on a wall', r)
            check(r['k'].get('win', 0) >= 6 and r['k'].get('chimney', 0) >= 2 and r['k'].get('door', 0) == len(kinds[c]), f'{c}: windows, chimneys and a door per building', r['k'])
        check('inn:tankard' in fronts['graftonbury']['signs'] and 'smithy:anvil' in fronts['cinderhold']['signs'] and 'chapel:bell' in fronts['rimewatch']['signs'], 'a tankard over the inn, an anvil over the smithy, a bell over the abbey')
        check(await pg.evaluate("Object.values(MAPS.graftonbury.fac).some(f => f.awn && f.kind === 'shop')"), 'shops have awnings')
        check(await pg.evaluate("Object.values(MAPS.cinderhold.fac).some(f => f.k === 'pennant' && f.kind === 'arena')"), 'arenas fly pennants')

        # ---------- landmarks ----------
        lm = await pg.evaluate("""(() => { const out = {};
          for (const id in W_LANDMARKS) { const m = MAPS[id], seen = __reach(id), placed = [];
            for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const c = m.t[y][x]; if (W_LANDMARKS[id].some(l => l[0] === c)) placed.push([c, __near(id, seen, x, y)]); }
            out[id] = { want: W_LANDMARKS[id].length, placed: placed.length, reach: placed.every(p => p[1]) }; }
          return out; })()""")
        for c, r in lm.items():
            check(r['placed'] == r['want'] and r['reach'], f'{c}: every landmark is placed and can be walked up to', r)
        # the clock
        await pg.evaluate("__at('graftonbury', c => c === 'æ'); wInteract()")
        check('Charter Clock says' in await pg.evaluate("__last()") and 'championship week' in await pg.evaluate("__last()"), 'the Charter Clock tells the hour and the days to the Crown', await pg.evaluate("__last()"))
        # the wishing well costs a coin
        r = await pg.evaluate("(() => { __at('graftonbury', c => c === 'ø'); const g = RUN.gold; wInteract(); return [g, RUN.gold, __last()]; })()")
        check(r[1] == r[0] - 1 and r[2] in await pg.evaluate("W_FORTUNES"), 'a coin in the wishing well buys a fortune', r)
        # the mushroom ring heals, once a day
        r = await pg.evaluate("(() => { __at('mossgate', c => c === 'ð'); RUN.hp = Math.max(1, RUN.maxhp - 30); const h0 = RUN.hp, t0 = WG.min; wInteract(); const h1 = RUN.hp, t1 = WG.min; RUN.hp = h0; wInteract(); return [h0, h1, RUN.hp, t1 - t0, __last()]; })()")
        check(r[1] > r[0] and r[2] == r[0] and r[3] == 30, 'the mushroom ring heals the team, takes half an hour, and only once a day', r)
        # the fishing spot, once a day
        r = await pg.evaluate("(() => { __at('saltmere', c => c === 'þ'); const n0 = (WG.items.saltfish || 0) + (WG.items.brinekelp || 0); wInteract(); const n1 = (WG.items.saltfish || 0) + (WG.items.brinekelp || 0); wInteract(); const n2 = (WG.items.saltfish || 0) + (WG.items.brinekelp || 0); return [n0, n1, n2]; })()")
        check(r[1] > r[0] and r[2] == r[1], 'the pier-end fishing spot lands a catch, once a day', r)
        # the forge stack rests legs, once a day
        r = await pg.evaluate("(() => { __at('cinderhold', c => c === 'ñ'); const p = wRoster()[0]; p.legs = 3; wInteract(); const a = wLegs(p); p.legs = 3; wInteract(); return [a, wLegs(p)]; })()")
        check(r[0] < 3 and r[1] == 3, 'the forge stack rests tired legs, once a day', r)
        # the next day it works again
        r = await pg.evaluate("(() => { wAdvance(1440); __at('mossgate', c => c === 'ð'); RUN.hp = Math.max(1, RUN.maxhp - 30); const h0 = RUN.hp; wInteract(); return [h0, RUN.hp]; })()")
        check(r[1] > r[0], 'a day later the mushroom ring works again', r)
        await pg.evaluate("__at('rimewatch', c => c === 'é'); wInteract()")
        check('statue' in await pg.evaluate("__last()"), 'the ice statue says who it is of', await pg.evaluate("__last()"))

        # ---------- dungeons: terrain ----------
        terr = await pg.evaluate("""({ vault: [__count('genevault', ['`']), __count('genevault', ['¦']), __count('genevault', ['ô'])],
          ember: [__count('emberdeep', [',']), __count('emberdeep', ['L']), __count('emberdeep', ['>'])],
          hatch: [__count('hatchery', [';']), __count('hatchery', ['~']), __count('hatchery', ['?']), __count('hatchery', ['@'])],
          seam: [__count('deepseam', ['6']), __count('deepseam', ['ÿ']), __count('deepseam', ['|']), __count('deepseam', ['ç'])] })""")
        check(all(n > 0 for n in terr['vault']), 'the Sealed Vault has rune tiles, conduits and sealed pillars', terr['vault'])
        check(all(n > 0 for n in terr['ember']) and terr['ember'][2] >= 5, 'Emberdeep has ash floors, lava pools and steam vents', terr['ember'])
        check(all(n > 0 for n in terr['hatch']), 'the Hatchery has shallows, deep pools, kelp beds and shell drifts', terr['hatch'])
        check(all(n > 0 for n in terr['seam']), 'the Deep Seam has chasms, cart rails, ore seams and crystals', terr['seam'])
        reach = await pg.evaluate("""(() => { const out = {};
          for (const d of DB.dungeons) { const m = MAPS[d.id], seen = __reach(d.id), bad = [];
            for (const R of m.rooms) { let any = false; for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) any = any || !!seen[y * m.w + x]; if (!any) bad.push('room ' + R.x + ',' + R.y); }
            for (const k in m.meta) { const [x, y] = k.split(',').map(Number), mt = m.meta[k]; if (mt.chest && /_vault$/.test(mt.chest)) continue; if (!__near(d.id, seen, x, y)) bad.push(m.t[y][x] + ' at ' + k); }
            out[d.id] = bad; }
          return out; })()""")
        for d, bad in reach.items():
            check(bad == [], f'{d}: every room, strongbox, well and the alpha can be reached through the terrain (gate shut)', bad)
        same = await pg.evaluate("""(() => { const out = {};
          for (const d of DB.dungeons) {
            const now = wDungeonRooms(d.id).map(R => [R.x, R.y, R.team.short]);
            const keep = MAPS[d.id], cache = W10.rooms[d.id]; buildDungeon(d); delete W10.rooms[d.id];
            const raw = wDungeonRooms(d.id).map(R => [R.x, R.y, R.team.short]);
            MAPS[d.id] = keep; W10.rooms[d.id] = cache; out[d.id] = JSON.stringify(now) === JSON.stringify(raw) && now.length > 0; }
          return out; })()""")
        check(all(same.values()), 'every famous team is in the same room as before the terrain', same)

        # ---------- the lever and the gate ----------
        for d in ['genevault', 'emberdeep', 'hatchery', 'deepseam']:
            r = await pg.evaluate(f"""(() => {{ const id = '{d}', m = MAPS[id];
              const gate = Object.keys(m.ovr).find(k => m.ovr[k].ch === '['), chest = Object.keys(m.meta).find(k => m.meta[k].chest === id + '_vault');
              const lever = Object.keys(m.meta).find(k => m.meta[k].lever);
              if (!gate || !chest || !lever) return {{ gate, chest, lever }};
              const [cx, cy] = chest.split(',').map(Number), [gx, gy] = gate.split(',').map(Number);
              const before = __near(id, __reach(id), cx, cy), shut = wTileAt(m, gx, gy);
              const leverReach = (() => {{ const [lx, ly] = lever.split(',').map(Number); return __near(id, __reach(id), lx, ly); }})();
              __at(id, (c, x, y) => x + ',' + y === lever); wInteract();
              const open = wTileAt(m, gx, gy), after = __near(id, __reach(id), cx, cy), msg = __last();
              wInteract(); const again = __last();
              return {{ before, shut, leverReach, open, after, msg, again, flag: wFlag('lever_' + id) }}; }})()""")
            check(r.get('shut') == '[' and not r.get('before') and r.get('leverReach'), f'{d}: the side vault is behind a shut gate, and the lever can be reached', r)
            check(r.get('open') != '[' and r.get('after') and r.get('flag') and 'gate' in r.get('msg', '') and 'pulled' in r.get('again', ''), f'{d}: the lever opens the gate and stays pulled', r)

        # ---------- cracked walls ----------
        cracks = await pg.evaluate("Object.fromEntries(DB.dungeons.map(d => [d.id, new Set(Object.values(MAPS[d.id].ovr).filter(o => o.ch === '{').map(o => o.flag)).size]))")
        check(all(1 <= n <= 2 for n in cracks.values()), 'one or two cracked walls in every dungeon', cracks)
        d = next(k for k, n in cracks.items() if n)
        r = await pg.evaluate(f"""(() => {{ const id = '{d}', m = MAPS[id], k = Object.keys(m.ovr).find(k => m.ovr[k].ch === '{{'), [x, y] = k.split(',').map(Number);
          const t0 = WG.min, d0 = WG.dayAbs; __at(id, (c, xx, yy) => xx === x && yy === y); wInteract();
          const c = wTileAt(m, x, y); return {{ c, walk: !!DB.tiles[c].walk, mins: (WG.dayAbs - d0) * 1440 + WG.min - t0, flag: wFlag(m.ovr[k].flag), k }}; }})()""")
        check(r['walk'] and r['mins'] == 60 and r['flag'], 'breaking through a cracked wall takes an hour and opens a way through', r)

        # ---------- survey stone, pennants ----------
        r = await pg.evaluate("(() => { __at('emberdeep', c => c === '*'); wInteract(); const m = MAPS.emberdeep; return [wMapSeenCount('emberdeep'), m.w * m.h, __last()]; })()")
        check(r[0] == r[1] and 'survey stone' in r[2], 'the survey stone shows the whole dungeon on the map', r)
        r = await pg.evaluate("""(() => { const out = {}; for (const d of DB.dungeons) { const m = MAPS[d.id]; out[d.id] = [Object.values(m.meta).filter(x => x.pennant != null).length, wDungeonRooms(d.id).length]; } return out; })()""")
        check(all(a == b and a > 0 for a, b in r.values()), 'a pennant in every famous team\'s room', r)
        r = await pg.evaluate("""(() => { const R = wDungeonRooms('hatchery')[0], m = MAPS.hatchery, k = Object.keys(m.meta).find(k => m.meta[k].pennant === 0), [x, y] = k.split(',').map(Number);
          const v0 = wTileVariant(m, x, y, '}'); __at('hatchery', (c, xx, yy) => xx === x && yy === y); wInteract(); const l0 = __last();
          wSetFlag(R.flag); const v1 = wTileVariant(m, x, y, '}'); wInteract(); const l1 = __last(); delete WG.flags[R.flag]; return [v0, v1, l0, l1, R.team.name]; })()""")
        check(r[0] == '1' and r[1] == '0' and r[4] in r[2] and 'torn' in r[3], 'the pennant names the team, and hangs torn once they are beaten', r)

        # ---------- vents and shallow water ----------
        r = await pg.evaluate("""(() => { const m = MAPS.emberdeep; let v = null;
          for (let y = 1; y < m.h - 1 && !v; y++) for (let x = 1; x < m.w - 1 && !v; x++) if (m.t[y][x] === '>') for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = wTileAt(m, x + dx, y + dy); if (!v && DB.tiles[c].walk && !DB.tiles[c].enter && !wRoomAt('emberdeep', x + dx, y + dy) === !wRoomAt('emberdeep', x, y)) v = [x, y, dx, dy]; }
          if (!v) return null; const [x, y, dx, dy] = v, enc = W_ENC.mult; W_ENC.mult = 0; const out = [];
          for (const blow of [true, false]) { wEnterMap('emberdeep', x + dx, y + dy); WG.grace = 99; RUN.hp = RUN.maxhp;
            let s = WG.step; while (wVentOn(x, y, s + 1) !== blow) s++; WG.step = s; wTryMove(-dx, -dy); out.push([WG.x === x && WG.y === y, RUN.maxhp - RUN.hp]); }
          W_ENC.mult = enc; return out; })()""")
        check(r and r[0][0] and r[0][1] == 2 and r[1][0] and r[1][1] == 0, 'crossing a vent as it blows scalds the team for 2 HP; between puffs it is safe', r)
        r = await pg.evaluate("""(() => { const m = MAPS.hatchery; const steps = {};
          for (const want of [';', 'g']) { let v = null;
            for (let y = 1; y < m.h - 1 && !v; y++) for (let x = 1; x < m.w - 1 && !v; x++) if (m.t[y][x] === want && !wRoomAt('hatchery', x, y)) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const c = wTileAt(m, x + dx, y + dy); if (!v && DB.tiles[c].walk && !DB.tiles[c].enter && !wRoomAt('hatchery', x + dx, y + dy)) v = [x, y, dx, dy]; }
            if (!v) return null; const [x, y, dx, dy] = v, enc = W_ENC.mult; W_ENC.mult = 0; wEnterMap('hatchery', x + dx, y + dy); WG.grace = 99; WG.min = 600; wTryMove(-dx, -dy); steps[want] = WG.min - 600; W_ENC.mult = enc; }
          return steps; })()""")
        check(r and r[';'] - r['g'] == 4, 'a step through shallow water takes 4 minutes longer', r)

        # ---------- ore and kelp ----------
        r = await pg.evaluate("(() => { __at('deepseam', c => c === '|'); const g0 = RUN.gold; wInteract(); const g1 = RUN.gold; wInteract(); return [g0, g1, RUN.gold, __last()]; })()")
        check(25 <= r[1] - r[0] <= 40 and r[2] == r[1] and 'worked-out' in r[3], 'the ore seam pays 25 to 40 gold, then rests for a week', r)
        r = await pg.evaluate("(() => { __at('hatchery', c => c === '?'); const n0 = WG.items.brinekelp || 0; wInteract(); const n1 = WG.items.brinekelp || 0; wInteract(); return [n0, n1, WG.items.brinekelp || 0]; })()")
        check(2 <= r[1] - r[0] <= 3 and r[2] == r[1], 'the kelp bed gives brinekelp, then needs to grow back', r)

        # ---------- save and reload ----------
        await pg.evaluate("wEnterMap('graftonbury', MAPS.graftonbury.spawn[0], MAPS.graftonbury.spawn[1]); wSave()")
        await pg.reload()
        await pg.wait_for_function("!!document.getElementById('bResume')")
        await pg.click('#bResume')
        await pg.wait_for_function("!!WG && UI.view === 'world'")
        await pg.add_script_tag(content=HELP)
        crack_k = (await pg.evaluate(f"Object.keys(MAPS['{d}'].ovr).find(k => MAPS['{d}'].ovr[k].ch === '{{')"))
        r = await pg.evaluate(f"""(() => {{ const m = MAPS.hatchery, g = Object.keys(m.ovr).find(k => m.ovr[k].ch === '['), [gx, gy] = g.split(',').map(Number);
          const [cx, cy] = '{crack_k}'.split(',').map(Number); return [wTileAt(m, gx, gy), !!DB.tiles[wTileAt(MAPS['{d}'], cx, cy)].walk]; }})()""")
        check(r[0] != '[' and r[1], 'a pulled lever and a broken wall survive a save and reload', r)

        # ---------- drawing, the map screen, How to play ----------
        r = await pg.evaluate("""(() => { const bad = []; for (const id of ['graftonbury', 'saltmere', 'hatchery', 'emberdeep', 'deepseam', 'genevault', 'world']) { const m = MAPS[id];
            const cv = document.createElement('canvas'); cv.width = 320; cv.height = 240; const c = cv.getContext('2d');
            try { for (let i = 0; i < 4; i++) wDrawMap(c, id, (i * 11) % Math.max(1, m.w - 10), (i * 7) % Math.max(1, m.h - 8), 320, 240, i, {}); } catch (e) { bad.push(id + ': ' + e.message); } }
          const codes = 'æøðþßñüéöåï`¦,;6ÿ>[]{}*|?ô@ç'.split('').filter(ch => !WOBJ[ch] && !WGND[ch]); if (codes.length) bad.push('undrawn ' + codes.join(''));
          const nocol = 'æøðþßñüéöåï`¦,;6ÿ>[]{}*|?ô@ç'.split('').filter(ch => !W_MAP_COL[ch]); if (nocol.length) bad.push('no map colour ' + nocol.join(''));
          return bad; })()""")
        check(r == [], 'every new tile is drawn, has a map colour, and the maps draw without errors', r)
        await pg.evaluate("renderHelp()")
        check(await pg.evaluate("!!document.getElementById('wHelpPlaces') && /Charter Clock/.test(document.getElementById('wHelpPlaces').textContent)"), 'How to play explains the places')

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
