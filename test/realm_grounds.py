# Realm sports grounds (issue #6, phase 1): every city has a ground for each of its region's sports, just outside it,
# in its region, on a road from the city gate. Placing them moves nothing else: every well, bush and nest is where the
# world without grounds has it. Walk in from the world: the ground's map has the field marked for its sport, stands,
# a scoreboard, a groundskeeper and a fan, all within reach; the keeper explains how the sport scores, and the
# Ballpark's keeper books a ball game and the Diamond Cup. Walk off the map and you are back outside its gate. The
# save keeps you inside a ground, and the journal has each ground's rules. Both maps draw without errors, the audit
# is clean, and How to play says so.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-grounds-*.png.
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
  const b = document.querySelector('#modalBox [data-close], #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""

async def new_journey(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_GRDS !== 'undefined'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await new_journey(pg)

        # ---------- on the world ----------
        G = await pg.evaluate("""(() => {
          const m = MAPS.world, out = [];
          for (const g of W_GRDS) {
            const L = DB.locs.find(l => l.id === g.id), C = DB.locs.find(l => l.id === g.city);
            // a road from the city gate to the ground's: road and bridge tiles (and other entrances on the way) only
            const ok = (x, y) => { const c = m.t[y][x]; return c === '=' || c === 'b' || (DB.tiles[c] && DB.tiles[c].enter); };
            const seen = new Set([C.x + ',' + (C.y + 1)]), q = [[C.x, C.y + 1]]; let road = false;
            while (q.length) { const [x, y] = q.pop(); if (x === L.x && y === L.y + 1) { road = true; break; }
              for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (seen.has(k) || !ok(nx, ny)) continue; seen.add(k); q.push([nx, ny]); } }
            out.push({ id: g.id, city: g.city, sport: g.sport, kind: L && L.kind, tile: L && m.t[L.y][L.x], reg: L && regionAt(L.x, L.y), creg: regionAt(C.x, C.y),
              dist: L && Math.max(Math.abs(L.x - C.x), Math.abs(L.y - C.y)), road, gate: L && walkCh(m.t[L.y + 1][L.x]), map: !!MAPS[g.id] });
          }
          const sports = {}; for (const id in W_GRD_REG) sports[id] = DB.regions[W_GRD_REG[id]].sports.map(s => s[0]);
          return { out, sports };
        })()""")
        gs = G['out']
        check(len(gs) == 10 and all(g['kind'] == 'ground' and g['tile'] == 'U' and g['map'] for g in gs), 'ten grounds on the world, each a location with its own map', gs)
        check(all(sorted(g['sport'] for g in gs if g['city'] == c) == sorted(sp) for c, sp in G['sports'].items()), 'every city has a ground for each of its region\'s sports', G['sports'])
        check(all(g['reg'] == g['creg'] and g['dist'] <= 8 for g in gs), 'each ground is just outside its city, in its region', [(g['id'], g['dist'], g['reg']) for g in gs])
        check(all(g['road'] and g['gate'] for g in gs), 'a road runs from each city gate to its grounds', [g['id'] for g in gs if not g['road']])
        same = await pg.evaluate("""(() => {
          const objs = m => Object.entries(m.meta).filter(([k, v]) => v.elem).map(([k, v]) => k + v.elem).sort().join(' ');
          const withGrounds = objs(MAPS.world);
          const locs = DB.locs; DB.locs = DB.locs.filter(l => l.kind !== 'ground'); wW21BuildWorld(); const without = objs(MAPS.world); DB.locs = locs;
          buildAllMaps(); return { same: withGrounds === without, n: withGrounds.split(' ').length, again: objs(MAPS.world) === withGrounds };
        })()""")
        check(same['same'] and same['again'] and same['n'] > 30, 'placing the grounds moves no well, bush or nest', same)
        check(await pg.evaluate("wAudit().length === 0 && worldProblems().length === 0"), 'the audit is clean', await pg.evaluate("wAudit().concat(worldProblems())"))

        # ---------- walk in ----------
        await pg.evaluate("(() => { const L = DB.locs.find(l => l.id === 'g_ballpark'); wEnterMap('world', L.x, L.y + 1); wDrain(); })()")
        look = await pg.evaluate("(() => { const L = DB.locs.find(l => l.id === 'g_ballpark'); return wLookText(L.x, L.y); })()")
        check('Ballpark' in look, 'looking at a ground on the world names it', look)
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path='/tmp/realm-grounds-world.png')
        await pg.evaluate("wTryMove(0, -1); wDrain()")
        st = await pg.evaluate("({ map: WG.map, kind: wCurMap().kind, log: WLOG.slice(-3).map(l => l[0]).join(' '), seen: wFlag('seen_g_ballpark') })")
        check(st['map'] == 'g_ballpark' and 'diamond is raked' in st['log'] and st['seen'], 'walk in from the world: the Ballpark, and its arrival line', st)
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path='/tmp/realm-grounds-ballpark.png')

        inside = await pg.evaluate("""(() => {
          const out = [];
          for (const g of W_GRDS) {
            const m = MAPS[g.id], F = m.field, seen = bfsReach(m, m.spawn[0], m.spawn[1]);
            const near = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(y + dy) * m.w + x + dx]);
            let field = 0, stands = 0, board = 0; for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) { const c = m.t[y][x]; field += c === 'd'; stands += c === 'J'; board += c === '%'; }
            const keeper = m.npcs.find(n => n.id === 'gk_' + g.id.slice(2)), fan = m.npcs.find(n => n.id === 'gf_' + g.id.slice(2));
            out.push({ id: g.id, sport: F && F.sport === g.sport, field: field === F.w * F.h, fieldIn: near(F.x + 1, F.y + 1), stands, board,
              keeper: !!keeper && near(keeper.x, keeper.y), fan: !!fan && near(fan.x, fan.y), kind: m.kind });
          }
          return out;
        })()""")
        check(all(g['sport'] and g['field'] and g['fieldIn'] for g in inside), 'each ground has its field, marked for its sport, and you can walk onto it', inside)
        check(all(g['stands'] >= 30 and g['board'] == 2 for g in inside), 'stands round the field and a scoreboard', [(g['id'], g['stands'], g['board']) for g in inside])
        check(all(g['keeper'] and g['fan'] for g in inside), 'a groundskeeper and a fan at every ground, within reach', inside)

        talk = await pg.evaluate("""(() => W_GRDS.map(g => { const id = 'gk_' + g.id.slice(2), job = wSay(id, 'job').text, sp = wSay(id, g.sport).text;
          return { id: g.id, job: job.includes(g.sport.toUpperCase()), sp: sp.includes(SPORTS[g.sport].desc) }; }))()""")
        check(all(t['job'] and t['sp'] for t in talk), 'every keeper explains how their sport scores (its keyword, then the rules)', talk)
        await pg.evaluate("wRecruit({ kind: 'troll', lvl: 2 }, 'tavern'); wRecruit({ kind: 'harpy', lvl: 2 }, 'tavern')")
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(() => { const r = wSay('gk_ballpark', 'game'); wRunAct(r.act, 'gk_ballpark'); })()")
        card = await pg.evaluate("(() => { const b = document.getElementById('modalBox'); return !document.getElementById('modal').hidden && !!b.querySelector('[data-bhow]') && b.textContent.includes('Play a ball game'); })()")
        check(card, 'the Ballpark keeper books a ball game (GAME)')
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(() => { const r = wSay('gk_ballpark', 'diamond'); wRunAct(r.act, 'gk_ballpark'); })()")
        check(await pg.evaluate("!!document.querySelector('#modalBox #wDcupEnter')"), 'and the Diamond Cup (DIAMOND)')
        await pg.evaluate(CLOSE_ALL)

        # ---------- the save, then walk out ----------
        await pg.evaluate("(() => { WG.x = 12; WG.y = 16; wSave(); })()")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        check(await pg.evaluate("WG.map === 'g_ballpark' && wCurMap().field && wCurMap().field.sport === 'baseball'"), 'the save keeps you inside a ground', await pg.evaluate("WG.map"))
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("WG.y = 17; wTryMove(0, 1); wDrain()")
        out = await pg.evaluate("(() => { const L = DB.locs.find(l => l.id === 'g_ballpark'); return { map: WG.map, at: [WG.x, WG.y], gate: [L.x, L.y + 1] }; })()")
        check(out['map'] == 'world' and out['at'] == out['gate'], 'walk off the map: back on the world outside its gate', out)

        # ---------- drawing every ground ----------
        for g in ['g_court', 'g_links', 'g_lists', 'g_lanes', 'g_shed', 'g_bowl', 'g_ring', 'g_rink', 'g_sheet']:
            await pg.evaluate(f"(() => {{ const m = MAPS['{g}']; wEnterMap('{g}', 12, 5); wDrain(); }})()")
            await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path='/tmp/realm-grounds-sheet.png')
        jr = await pg.evaluate("wJRules('g_links').join(' ')")
        check('Mossgate Links' in jr and 'Par 4' in jr, 'the journal gives a ground its sport\'s rules', jr)
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpGrounds'); return h ? h.textContent : ''; })()")
        check('Sports grounds' in help_ and 'Ballpark' in help_, 'How to play explains the grounds', help_)
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm grounds passed')

asyncio.run(main())
