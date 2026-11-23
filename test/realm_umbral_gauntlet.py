# Realm: the gauntlet on the dark grounds (issue #111, phase D). Each dark ground's guards' row is walled off with a
# bone railing, the two guards in the gap either side of a shut gate. The champion can't be walked to until both guards
# are beaten (each steps one tile back off the line) and the gate is opened with the region's item (handed over once,
# open for good, after a reload too). Nobody squeezes past a guard. u4's refusal stays as a backstop, a gate it opens
# reads open, and a save from before the wall (guards beaten, gates handed over, or standing behind the line) still
# plays. The audit is clean, and How to play says so.
# Asserts; exits nonzero on failure.
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

# helpers in the page: walk by the game's own pathfinding and steps; where everyone on a ground stands
HELP = """window.__close = () => { if (WUI.talk) wCloseTalk(); for (let i = 0; i < 8 && !document.getElementById('modal').hidden; i++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); };
  window.__walk = (tx, ty) => { for (let i = 0; i < 80 && !(WG.x === tx && WG.y === ty); i++) { const s = wPathStep(tx, ty); if (!s) break; wTryMove(s[0], s[1]); __close(); } return WG.x === tx && WG.y === ty; };
  window.__at = (g, i) => { const n = MAPS['u:' + g].npcs.find(k => k.id === wUmbGuardOf(g, i)); return [n.x, n.y]; };
  window.__champ = g => { const id = wUmbGroundChamps(g)[0], C = W_NADIR[id], n = MAPS['u:' + g].npcs.find(k => k.id === C.char); return { id, C, x: n.x, y: n.y }; };
  window.__logs = k => WLOG.slice(-(k || 3)).map(l => l[0]).join(' | '); 0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        pg.set_default_timeout(120000)   # (loading the 6 MB page on a busy machine can take longer than the 30 s default)
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbBuildGauntlet === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 900; wSave(); " + HELP)

        # every dark ground has the wall, the gate and two guards in the gap
        st = await pg.evaluate("""(() => { const out = {};
          for (const g in W_UMB4.grounds) { const m = MAPS['u:' + g], G = m.gauntlet; if (!G) { out[g] = 'no wall: ' + m.gauntletWhy; continue; }
            const row = m.t[G.row], c = __champ(g), wall = G.wall.every(x => row[x] === W_UMB8D.wall), edges = !walkCh(row[Math.min(...G.wall) - 1]) && !walkCh(row[Math.max(...G.wall) + 1]);
            const gap = [0, 1].every(i => __at(g, i).join() === G.line[i].join() && G.line[i][1] === G.row && Math.abs(G.line[i][0] - G.gate[0]) === 1);
            out[g] = wall && edges && row[G.gate[0]] === W_UMB8D.gate && G.gate[1] === G.row && gap && !walkCh(W_UMB8D.gate) && !walkCh(W_UMB8D.wall) && walkCh(W_UMB8D.open) && c.y !== G.row ? 'ok' : JSON.stringify({ G, wall, edges, gap }); }
          return out; })()""")
        check(all(v == 'ok' for v in st.values()) and len(st) == 8, 'every dark ground has the bone railing from stand to stand, the shut gate in the middle of the gap, and a guard either side of it', st)

        # before anything: the champion can't be walked to (by the game's own pathfinding, nor straight up the middle)
        b = await pg.evaluate("""(() => { const g = 'g_ballpark', m = MAPS['u:' + g], G = m.gauntlet, c = __champ(g), out = {};
          WG.umbral.guards = {}; WG.umbral.gates = {}; wEnterMap(m.id, m.spawn[0], m.spawn[1]); wDrain();
          out.path = wPathStep(c.x, c.y + 1); out.walk = __walk(c.x, c.y + 1);
          out.raw = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => wUmbGauntletReach(m, g)[(c.y + dy) * m.w + c.x + dx]);
          __walk(G.gate[0], G.gate[1] + 1); for (let i = 0; i < 3; i++) wTryMove(0, -1); out.up = WG.y; out.row = G.row;
          // no squeezing past a guard: the first bump talks, the second is refused
          __walk(G.line[0][0], G.row + 1); WG.bump = null; wTryMove(0, -1); __close(); wTryMove(0, -1); out.budge = __logs(2); out.still = [WG.x, WG.y].join() === [G.line[0][0], G.row + 1].join();
          WG.face = 'u'; wUse(G.gate[0], G.gate[1]); out.gate = __logs(1); out.shut = wTileAt(m, G.gate[0], G.gate[1]) === W_UMB8D.gate;
          return out; })()""")
        check(b['path'] is None and not b['walk'] and not b['raw'], 'before anything, the champion can\'t be reached by walking', b)
        check(b['up'] == b['row'] + 1, 'walking straight up the middle stops at the gate', b)
        check('will not budge' in b['budge'] and b['still'], 'nobody squeezes past a guard standing in the gap', b)
        check(b['shut'] and 'Left Hand' in b['gate'] and 'Right Hand' in b['gate'], 'the gate stays shut while the guards stand, and says who is left, in the champion\'s words', b)

        # a guard beaten steps one tile back off the line; the gap they leave is a pocket, the gate still the only way
        g1 = await pg.evaluate("""(() => { const g = 'g_ballpark', m = MAPS['u:' + g], G = m.gauntlet, c = __champ(g), out = {};
          WG.x = m.spawn[0]; WG.y = m.spawn[1];
          W_ON_END.uguard('win', { g, i: 0 }); out.a0 = __at(g, 0); out.line0 = G.line[0]; out.a1 = __at(g, 1);
          out.pocket = __walk(G.line[0][0], G.line[0][1]); wTryMove(0, -1); __close(); out.inPocket = [WG.x, WG.y];
          out.walk1 = __walk(c.x, c.y + 1);
          W_ON_END.uguard('win', { g, i: 1 }); out.b1 = __at(g, 1);
          const it = W_UMB4.gate[c.C.region]; WG.items[it] = 0; delete WG.items[it];
          __walk(G.gate[0], G.gate[1] + 1); wUse(G.gate[0], G.gate[1]); out.want = __logs(1); out.item = DB.items[it].name;
          out.shut = wTileAt(m, G.gate[0], G.gate[1]) === W_UMB8D.gate; out.walk2 = __walk(c.x, c.y + 1);
          return out; })()""")
        check(g1['a0'] == [g1['line0'][0], g1['line0'][1] - 1] and g1['a1'] != g1['a0'] and g1['pocket'], 'a beaten guard steps one tile back off the line, and the other stands', g1)
        check(g1['inPocket'] == g1['line0'] and not g1['walk1'], 'the gap they leave is a dead end: the champion still can\'t be reached', g1)
        check(g1['item'] in g1['want'] and g1['shut'] and not g1['walk2'], 'with both beaten, the gate wants the item from the light side, and stays shut without it', g1)

        # with the item: one handed over, the gate opens for good, the guards step clear, and the champion can be reached
        op = await pg.evaluate("""(() => { const g = 'g_ballpark', m = MAPS['u:' + g], G = m.gauntlet, c = __champ(g), out = {}, it = W_UMB4.gate[c.C.region];
          wAddItem(it, 2); __walk(G.gate[0], G.gate[1] + 1); WG.face = 'u'; wInteract(); __close();
          out.left = WG.items[it] || 0; out.gates = !!WG.umbral.gates[c.id]; out.tile = wTileAt(m, G.gate[0], G.gate[1]) === W_UMB8D.open; out.raw = m.t[G.row][G.gate[0]] === W_UMB8D.gate;
          out.look = wLookText(G.gate[0], G.gate[1]); out.clear = [__at(g, 0), __at(g, 1)]; out.want = G.clear;
          out.walk = __walk(c.x, c.y + 1);
          // u4's refusal, the backstop, asks for nothing more
          const E = c.C.engine, keep = W_UMB4.start[E]; W_UMB4.start[E] = () => ''; out.play = wNadirMatch(c.id); W_UMB4.start[E] = keep; out.left2 = WG.items[it] || 0;
          out.audit = wAudit(); return out; })()""")
        check(op['left'] == 1 and op['gates'] and op['tile'] and op['raw'] and 'open' in op['look'], 'with the item, using the gate takes one and opens it for good (the map keeps the gate; it reads open)', op)
        check(op['clear'] == op['want'] and op['walk'], 'the guards step clear, and the champion can be walked to', op)
        check(op['play'] == '' and op['left2'] == 1, 'the champion\'s own refusal stays as a backstop and asks for nothing more', op)
        check(op['audit'] == [], 'the audit is clean', op['audit'])

        # a reload keeps the gate open and the guards clear
        await pg.evaluate("wSave(); wStart(wLoadSave())"); await pg.wait_for_function("UI.view === 'world' && !!WG")
        rl = await pg.evaluate("""(() => { const g = 'g_ballpark', m = MAPS['u:' + g], G = m.gauntlet, c = __champ(g);
          return { map: WG.map, at: [WG.x, WG.y], want: [c.x, c.y + 1], open: wTileAt(m, G.gate[0], G.gate[1]) === W_UMB8D.open, clear: [__at(g, 0), __at(g, 1)], c: G.clear }; })()""")
        check(rl['open'] and rl['clear'] == rl['c'] and rl['map'] == 'u:g_ballpark' and rl['at'] == rl['want'], 'after a reload the gate is still open, the guards still clear, and you stand where you were', rl)

        # loaded standing on a guard's spot past the open gate: you stay put (no railing line), the guard keeps off you,
        # and takes the spot once you step off
        await pg.evaluate("(() => { const G = MAPS['u:g_ballpark'].gauntlet; WG.x = G.clear[0][0]; WG.y = G.clear[0][1]; WLOG.length = 0; wSave(); for (const k in MAPS) delete MAPS[k]; wStart(wLoadSave()); })()")  # (the maps built afresh, as on opening the page)
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        sp = await pg.evaluate("""(() => { const g = 'g_ballpark', G = MAPS['u:' + g].gauntlet, out = { at: [WG.x, WG.y], spot: G.clear[0], g0: __at(g, 0), log: WLOG.map(l => l[0]).join(' | ') };
          wTryMove(0, -1); __close(); out.moved = [WG.x, WG.y]; out.g0after = __at(g, 0); return out; })()""")
        check(sp['at'] == sp['spot'] and sp['g0'] != sp['spot'] and 'railing of bone' not in sp['log'], 'loaded standing on a guard\'s spot past the open gate, you stay where you were', sp)
        check(sp['moved'] != sp['spot'] and sp['g0after'] == sp['spot'], 'and the guard takes the spot once you step off it', sp)

        # a tile marked behind the line counts as reached with the gate open (the older checks would call it unreachable)
        mt = await pg.evaluate("""(() => { const m = MAPS['u:g_ballpark'], c = __champ('g_ballpark'), k = (c.x - 3) + ',' + c.y; m.meta[k] = { text: 'test' };
          const a = wAudit(); delete m.meta[k]; return a; })()""")
        check(mt == [], 'a marked tile behind the line is checked with the gate open, and the audit stays clean', mt)

        # the local map shows an open gate open, and a shut one shut
        mp = await pg.evaluate("""(() => { const keepCol = wMapTileCol, keepFog = wFogSeen, seen = []; wFogSeen = () => true; wMapTileCol = function (ch) { seen.push(ch); return keepCol.apply(this, arguments); };
          const cv = document.createElement('canvas'), out = {};
          try { for (const g of ['g_ballpark', 'g_rink']) { const m = MAPS['u:' + g]; seen.length = 0; cv.width = m.w * 4; cv.height = m.h * 4; wMapPaint(cv.getContext('2d'), m, 4, m.id);
            out[g] = { open: seen.includes(W_UMB8D.open), shut: seen.includes(W_UMB8D.gate), raw: m.t[m.gauntlet.row][m.gauntlet.gate[0]] === W_UMB8D.gate }; } }
          finally { wMapTileCol = keepCol; wFogSeen = keepFog; } return out; })()""")
        check(mp['g_ballpark']['open'] and not mp['g_ballpark']['shut'] and mp['g_rink']['shut'] and not mp['g_rink']['open'] and mp['g_ballpark']['raw'], 'the local map shows an open gate open and a shut one shut (the map itself keeps the gate)', mp)

        # u4's backstop opening a gate (the bot never walks): the gate reads open for every champion behind it (a stub
        # second one here), and the guards step clear
        bs = await pg.evaluate("""(() => { const g = 'g_court', m = MAPS['u:' + g], G = m.gauntlet, c = __champ(g), it = W_UMB4.gate[c.C.region], E = c.C.engine, keep = W_UMB4.start[E];
          W_ON_END.uguard('win', { g, i: 0 }); W_ON_END.uguard('win', { g, i: 1 }); wAddItem(it, 1); const n0 = WG.items[it] || 0;
          W_NADIR.zgate = Object.assign({}, c.C, { char: 'nadir_zgate', piece: 'zgate' }); W_UMB4.start[E] = () => '';
          try { const r = wNadirMatch(c.id), both = !!WG.umbral.gates[c.id] && !!WG.umbral.gates.zgate;
            return { r, both, open: wTileAt(m, G.gate[0], G.gate[1]) === W_UMB8D.open, clear: [__at(g, 0), __at(g, 1)], c: G.clear, took: n0 - (WG.items[it] || 0) }; }
          finally { W_UMB4.start[E] = keep; delete W_NADIR.zgate; delete WG.umbral.gates.zgate; } })()""")
        check(bs['r'] == '' and bs['open'] and bs['clear'] == bs['c'] and bs['took'] == 1 and bs['both'], 'a gate opened through the champion\'s refusal reads open for every champion behind it, and its guards step clear', bs)

        # a gate already open (given for one champion) is given for a second one behind it too: u4 asks for nothing
        two = await pg.evaluate("""(() => { const g = 'g_shed', c = __champ(g), U = WG.umbral, it = W_UMB4.gate[c.C.region], E = c.C.engine, keep = W_UMB4.start[E];
          const snap = JSON.stringify({ gates: U.gates, guards: U.guards, items: WG.items });
          U.guards[g + ':0'] = U.guards[g + ':1'] = 1; U.gates[c.id] = WG.dayAbs; wAddItem(it, 1); const n0 = WG.items[it];
          W_NADIR.zgate2 = Object.assign({}, c.C, { char: 'nadir_zgate2', piece: 'zgate2' }); W_UMB4.start[E] = () => '';
          try { const r = wNadirMatch('zgate2'); return { r, entry: !!U.gates.zgate2, took: n0 - (WG.items[it] || 0) }; }
          finally { W_UMB4.start[E] = keep; delete W_NADIR.zgate2; const o = JSON.parse(snap); U.gates = o.gates; U.guards = o.guards; WG.items = o.items; wUmbGauntletSync(g); } })()""")
        check(two['r'] == '' and two['entry'] and two['took'] == 0, 'a gate already open counts as given for every champion behind it: nobody asks for the item twice', two)

        # a save from before the wall where the piece is already yours but the gate has no entry: it is open, and free
        pc = await pg.evaluate("""(() => { const g = 'g_links', m = MAPS['u:' + g], G = m.gauntlet, c = __champ(g), U = WG.umbral, it = W_UMB4.gate[c.C.region];
          const snap = JSON.stringify({ gates: U.gates, guards: U.guards, items: WG.items, pieces: U.pieces });
          try { delete U.gates[c.id]; U.guards[g + ':0'] = U.guards[g + ':1'] = 1; U.pieces = U.pieces.concat([c.C.piece]); wAddItem(it, 2); const n0 = WG.items[it];
            wEnterMap(m.id, G.gate[0], G.gate[1] + 1); wDrain(); wUse(G.gate[0], G.gate[1]); wUmbUseGate(m, g); __close();
            return { open: wTileAt(m, G.gate[0], G.gate[1]) === W_UMB8D.open, took: n0 - (WG.items[it] || 0), walk: __walk(c.x, c.y + 1) }; }
          finally { const o = JSON.parse(snap); U.gates = o.gates; U.guards = o.guards; WG.items = o.items; U.pieces = o.pieces; wEnterMap(m.id, m.spawn[0], m.spawn[1]); wDrain(); wUmbGauntletSync(g); } })()""")
        check(pc['open'] and pc['took'] == 0 and pc['walk'], 'with the champion\'s piece already yours (an old save, no gate entry), the gate is open and takes nothing', pc)

        # winning the piece opens the gate then and there: its picture is redrawn and the guards step clear
        pw = await pg.evaluate("""(() => { const g = 'g_lanes', m = MAPS['u:' + g], G = m.gauntlet, c = __champ(g), U = WG.umbral;
          const snap = JSON.stringify({ gates: U.gates, guards: U.guards, pieces: U.pieces, beaten: U.beaten, tries: U.tries, items: WG.items, gold: RUN.gold, deck: RUN.deck, offer: WG.cardOffer || null });
          const keepGain = wGainCard; wGainCard = () => {};   // (the champion's card pick is not this check's business)
          try { U.guards[g + ':0'] = U.guards[g + ':1'] = 1; delete U.gates[c.id]; wUmbGauntletSync(g); const out = { before: wTileAt(m, G.gate[0], G.gate[1]) === W_UMB8D.gate, aside: [__at(g, 0), __at(g, 1)], a: G.aside };
            wLayer(m, 1); wUmbNadirEnd(c.id, 'win'); __close();
            Object.assign(out, { piece: U.pieces.includes(c.C.piece), open: wTileAt(m, G.gate[0], G.gate[1]) === W_UMB8D.open, redrawn: !WLAY[m.id], entry: !!U.gates[c.id], clear: [__at(g, 0), __at(g, 1)], c: G.clear }); return out; }
          finally { wGainCard = keepGain; const o = JSON.parse(snap); Object.assign(U, { gates: o.gates, guards: o.guards, pieces: o.pieces, beaten: o.beaten, tries: o.tries }); WG.items = o.items; RUN.gold = o.gold; RUN.deck = o.deck; if (o.offer) WG.cardOffer = o.offer; else delete WG.cardOffer; wUmbGauntletSync(g); wInvalidate(m.id); } })()""")
        check(pw['before'] and pw['aside'] == pw['a'] and pw['piece'] and pw['open'] and pw['redrawn'] and pw['entry'] and pw['clear'] == pw['c'], 'winning the piece opens the gate there and then: redrawn, given, and the guards step clear', pw)

        # a save from before the wall: guards beaten and the gate handed over through u4 (no other keys), or standing
        # behind the line at a ground whose guards still stand
        await pg.evaluate("""(() => { const U = WG.umbral, b = __champ('g_bowl');
          WG.umbral = { at: U.at, year: U.year, crossed: 3, pieces: [], beaten: {}, tries: {}, finale: 0, sealed: 0, seen: U.seen, guards: { 'g_bowl:0': 5, 'g_bowl:1': 6 }, gates: { [b.id]: 7 } };
          const m = MAPS['u:g_rink'], c = __champ('g_rink'); WG.map = m.id; WG.x = c.x + 1; WG.y = c.y; wSave(); })()""")
        await pg.evaluate("wStart(wLoadSave())"); await pg.wait_for_function("UI.view === 'world' && !!WG")
        old = await pg.evaluate("""(() => { const bm = MAPS['u:g_bowl'], rm = MAPS['u:g_rink'];
          return { bowl: wTileAt(bm, bm.gauntlet.gate[0], bm.gauntlet.gate[1]) === W_UMB8D.open, bclear: [__at('g_bowl', 0), __at('g_bowl', 1)], bc: bm.gauntlet.clear,
            rink: wTileAt(rm, rm.gauntlet.gate[0], rm.gauntlet.gate[1]) === W_UMB8D.gate, rline: [__at('g_rink', 0), __at('g_rink', 1)], rl: rm.gauntlet.line,
            map: WG.map, at: [WG.x, WG.y], spawn: rm.spawn, log: __logs(4) }; })()""")
        check(old['bowl'] and old['bclear'] == old['bc'], 'a save from before the wall: a gate handed over through the champion reads open, its guards clear', old)
        check(old['rink'] and old['rline'] == old['rl'] and old['map'] == 'u:g_rink' and old['at'] == old['spawn'] and 'railing of bone' in old['log'], 'one saved standing behind the line, guards standing, wakes at the way in, the gate shut', old)

        # a railing that would seal a marked tile off (reachable before it stood, not after) isn't built: no wall there,
        # and the audit says which ground
        sw = await pg.evaluate("""(() => { const g = 'g_ring', m = MAPS['u:' + g], G = m.gauntlet, out = {};
          for (const x of G.wall.concat([G.gate[0]])) m.t[G.row][x] = 'd'; delete m.gauntlet;
          [0, 1].forEach(i => { const n = m.npcs.find(k => k.id === wUmbGuardOf(g, i)); n.x = G.line[i][0]; n.y = G.line[i][1]; });
          const sx = G.wall[1], sy = G.row - 1; for (const [x, y] of [[sx - 1, sy], [sx + 1, sy], [sx, sy - 1]]) m.t[y][x] = 'J'; m.t[sy][sx] = 'S'; m.meta[sx + ',' + sy] = { text: 'test' };
          out.built = wUmbBuildGauntlet(g); out.why = m.gauntletWhy; out.row = m.t[G.row].includes(W_UMB8D.wall); out.audit = wAudit().filter(s => s.startsWith('u:' + g));
          buildAllMaps(); out.back = !!MAPS['u:' + g].gauntlet; out.clean = wAudit(); return out; })()""")
        check(sw['built'] is False and not sw['row'] and 'tile' in sw['why'] and any('no wall' in a for a in sw['audit']), 'a railing that would seal off a marked tile reachable before it is not built, and the audit names the ground', sw)
        check(sw['back'] and sw['clean'] == [], 'built afresh, the ground has its wall again and the audit is clean', sw)

        # How to play says so
        hp = await pg.evaluate("""(() => { showPage('help'); const p = document.getElementById('wHelpUmbGate'), prev = p && p.previousElementSibling;
          return { text: p ? p.textContent : '', after: prev ? prev.textContent.slice(0, 11) : '' }; })()""")
        check('railing of bone' in hp['text'] and 'gate' in hp['text'] and hp['after'] == 'The pieces.', 'How to play\'s Umbral section explains the wall and the gate, after the pieces', hp)
        await pg.evaluate("showPage('play')")
        check(await pg.evaluate("wAudit()") == [], 'the audit is clean at the end')
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
