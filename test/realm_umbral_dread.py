# Realm: the Dread (issue #111, phase C). The stage follows the pieces held (0, 3, 6, 8 give 0 to 3; sealed gives 0); a
# stage reached queues its scene once (never in LAB), and an old save past a stage sees only the highest. Hazards on
# the dark world: spikes cost 2 HP and never take you below 1, pits (from the Stirring) cost 3 and move you, none on a
# road or beside a place, and the audit is clean. The hungry shadows: the count follows the stage, one in sight comes
# toward you and one out of sight doesn't, one that reaches you (or you walk into) starts a 'shadow' match, none goes
# into a lantern's light, Shadow Salt hides you, a win dissolves one, and they keep their spots through a reload. A
# step through the portal with a shadow beside you starts nothing. Asserts; exits nonzero on failure.
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbDread === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; WG.hardcore = false; wSave()")

        st = await pg.evaluate("""(() => { const U = WG.umbral, ps = Object.keys(W_UMB_PIECES), out = {};
          for (const n of [0, 2, 3, 5, 6, 7, 8, 9]) { U.pieces = ps.slice(0, n); out[n] = wUmbDread(); }
          U.sealed = 1; out.sealed = wUmbDread(); U.sealed = 0; U.pieces = []; return out; })()""")
        check(st == {'0': 0, '2': 0, '3': 1, '5': 1, '6': 2, '7': 2, '8': 3, '9': 3, 'sealed': 0}, 'the stage follows the pieces: 0, 3, 6 and 8 start the four stages; sealed is 0', st)

        sc = await pg.evaluate("""(() => { const U = WG.umbral, ps = Object.keys(W_UMB_PIECES), out = {};
          U.dreadSeen = 0; U.dreadScene = 0; U.pieces = ps.slice(0, 3); wUmbDreadCheck(); out.one = U.dreadScene; U.dreadScene = 0; wUmbDreadCheck(); out.again = U.dreadScene;
          // an old save already at 7 pieces, with no dreadSeen: only the highest stage's scene, once
          delete U.dreadSeen; U.pieces = ps.slice(0, 7); wUmbDreadCheck(); out.old = U.dreadScene; out.seen = U.dreadSeen;
          LAB = true; U.dreadSeen = 0; U.dreadScene = 0; wUmbDreadCheck(); out.lab = U.dreadScene; LAB = false;
          U.dreadScene = 0; U.dreadSeen = 3; U.pieces = []; return out; })()""")
        check(sc == {'one': 1, 'again': 0, 'old': 2, 'seen': 2, 'lab': 0}, 'a stage reached queues its scene once; an old save sees only the highest; never in LAB', sc)

        hz = await pg.evaluate("""(() => { const m = MAPS['u:world'], H = m.hazards || {}, ks = Object.keys(H), bad = [];
          for (const k of ks) { const [x, y] = k.split(',').map(Number), c = m.t[y][x];
            if (c === '=' || c === 'b' || !DB.tiles[c].walk || DB.tiles[c].enter || m.meta[k]) bad.push(k + ' on ' + c);
            if (DB.locs.some(L => Math.abs(L.x - x) + Math.abs(L.y - y) <= 2)) bad.push(k + ' by a place'); }
          return { spikes: ks.filter(k => H[k] === 'spike').length, pits: ks.filter(k => H[k] === 'pit').length, bad, light: Object.keys(MAPS.world.hazards || {}).length, audit: wAudit() }; })()""")
        check(hz['spikes'] >= 20 and hz['pits'] >= 10 and not hz['bad'] and hz['light'] == 0, 'spikes and pits on the dark world (none on the light one), none on a road, a place or beside one', hz)
        check(hz['audit'] == [], 'the audit is clean', hz['audit'])

        # a spike: walk onto one from a free side
        sp = await pg.evaluate("""(() => { const m = MAPS['u:world'], U = WG.umbral; U.shadows = []; U.shadowWait = [0]; U.pieces = []; W_UMB8C.shadows = [0, 0, 0, 0];
          const out = {};
          const step = (want) => { for (const k in m.hazards) { if (m.hazards[k] !== want) continue; const [x, y] = k.split(',').map(Number);
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (wUmbFreeAt(m, x + dx, y + dy)) { wEnterMap('u:world', x + dx, y + dy); WG.grace = 0; return [x, y, -dx, -dy]; } } } };
          let [x, y, dx, dy] = step('spike'); RUN.hp = 30; wTryMove(dx, dy); out.spike = [WG.x === x && WG.y === y, RUN.hp];
          wEnterMap('u:world', x - dx, y - dy); WG.grace = 0; RUN.hp = 1; wTryMove(dx, dy); out.floor = RUN.hp;
          [x, y, dx, dy] = step('pit'); RUN.hp = 30; wTryMove(dx, dy); out.closed = [WG.x === x && WG.y === y, RUN.hp];
          U.pieces = Object.keys(W_UMB_PIECES).slice(0, 3); U.dreadSeen = 3;
          wEnterMap('u:world', x - dx, y - dy); WG.grace = 0; RUN.hp = 30; wTryMove(dx, dy); out.open = [WG.x === x && WG.y === y, RUN.hp, Math.abs(WG.x - x) + Math.abs(WG.y - y)];
          U.pieces = []; return out; })()""")
        check(sp['spike'] == [True, 28] and sp['floor'] == 1, 'a spike costs 2 HP, and never takes you below 1', sp)
        check(sp['closed'] == [True, 30] and not sp['open'][0] and sp['open'][1] == 27 and 2 <= sp['open'][2] <= 8, 'a pit holds in the Quiet; from the Stirring it costs 3 HP and you come up somewhere else', sp)

        # the shadows
        sh = await pg.evaluate("""(() => { const m = MAPS['u:world'], U = WG.umbral, out = {}; W_UMB8C.shadows = [3, 6, 10, 14];
          U.shadows = []; U.shadowWait = []; U.pieces = []; wEnterMap('u:world', 40, 40); WG.grace = 0; wUmbShadowsSync(); out.n0 = U.shadows.length;
          U.pieces = Object.keys(W_UMB_PIECES).slice(0, 6); wUmbShadowsSync(); out.n2 = U.shadows.length; U.pieces = [];
          wUmbShadowsSync(); out.back = U.shadows.length;
          // a free open row: you, and a shadow three steps east in plain sight
          let spot = null;
          for (let y = 5; y < m.h - 5 && !spot; y++) for (let x = 5; x < m.w - 9 && !spot; x++) { let ok = true; for (let i = 0; i <= 6 && ok; i++) ok = wUmbShadowOk(m, x + i, y) && wUmbFreeAt(m, x + i, y - 1) && !wUmbLanternLit(m, x + i, y); if (ok) spot = [x, y]; }
          const [x, y] = spot; U.shadows = [{ id: 'sa', x: x + 4, y, hx: x + 4, hy: y }]; wEnterMap('u:world', x, y); WG.grace = 0; U.salt = 0;
          const n0 = W_UMB8C.started; wTryMove(0, -1); out.closer = U.shadows[0].x; out.started = W_UMB8C.started - n0;
          // out of sight: far away, it stays near home
          U.shadows = [{ id: 'sb', x: x + 30 < m.w ? x + 30 : x - 30, y, hx: 0, hy: 0 }]; U.shadows[0].hx = U.shadows[0].x; U.shadows[0].hy = y;
          for (let i = 0; i < 6; i++) { wEnterMap('u:world', x, y); WG.grace = 0; wTryMove(0, -1); }
          out.home = Math.abs(U.shadows[0].x - U.shadows[0].hx) + Math.abs(U.shadows[0].y - U.shadows[0].hy);
          // salt: in sight, but it can't find you
          U.shadows = [{ id: 'sc', x: x + 3, y, hx: x + 3, hy: y }]; wEnterMap('u:world', x, y); WG.grace = 0; U.salt = 5; wTryMove(0, -1); out.salted = U.shadows[0].x === x + 3 || Math.abs(U.shadows[0].x - (x + 3)) + Math.abs(U.shadows[0].y - y) <= 1; out.saltLeft = U.salt; U.salt = 0;
          // walking into one: a shadow match, and you stay put
          U.shadows = [{ id: 'sd', x: x + 1, y, hx: x + 1, hy: y }]; wEnterMap('u:world', x, y); WG.grace = 0; 
          const n1 = W_UMB8C.started, at = [WG.x, WG.y]; wTryMove(1, 0); out.into = [W_UMB8C.started - n1, WG.x === at[0] && WG.y === at[1]];
          out.kind = (document.querySelector('#modalBox') || {}).textContent ? 'card' : ''; document.getElementById('modal').hidden = true; MODAL_NOW = null;
          return out; })()""")
        check(sh['n0'] == 3 and sh['n2'] == 10 and sh['back'] == 3, 'the shadows number 3 in the Quiet and 10 in the Raging', sh)
        check(sh['started'] == 0 and sh['closer'] < 999 and sh['home'] <= 3, 'a shadow in sight comes closer; one out of sight drifts near home', sh)
        check(sh['salted'] and sh['saltLeft'] == 4, 'Shadow Salt: a shadow in sight cannot find you, and the salt counts down', sh)
        check(sh['into'] == [1, True], 'walking into a shadow starts a match, and you stay where you were', sh)
        await pg.evaluate("document.getElementById('modal').hidden = true; MODAL_NOW = null")

        # a shadow that reaches you, through the LAB kickoff (no match card): a 'shadow' match on the dark side; a win dissolves it
        rc = await pg.evaluate("""(() => { const m = MAPS['u:world'], U = WG.umbral, out = {};
          let spot = null;
          for (let y = 5; y < m.h - 5 && !spot; y++) for (let x = 5; x < m.w - 9 && !spot; x++) { let ok = true; for (let i = 0; i <= 3 && ok; i++) ok = wUmbShadowOk(m, x + i, y) && !wUmbLanternLit(m, x + i, y) && wUmbShadowOk(m, x + i, y + 1); if (ok) spot = [x, y]; }
          const [x, y] = spot; U.shadows = [{ id: 'se', x: x + 1, y: y + 1, hx: x + 1, hy: y + 1 }]; wEnterMap('u:world', x, y); WG.grace = 0; const em = W_UMB8C.encMult; W_UMB8C.encMult = 0;
          LAB = true; RUN.pending = null; try { wTryMove(0, 1); } finally { LAB = false; W_UMB8C.encMult = em; }
          const W = RUN.pending && RUN.pending.world; out.kind = W && W.kind; out.umbral = W && W.umbral; out.ref = W && W.ref && W.ref.id;
          if (W) { W_ON_END.shadow('win', W.ref, W); out.left = U.shadows.filter(s => s.id === 'se').length; out.wait = (U.shadowWait || []).length; }
          RUN.pending = null; B = null; showView('world'); return out; })()""")
        check(rc.get('kind') == 'shadow' and rc.get('umbral') == 1 and rc.get('ref') == 'se', 'a shadow that reaches you starts an Umbral match of kind shadow', rc)
        check(rc.get('left') == 0 and rc.get('wait') == 1, 'a win dissolves the shadow, and another gathers the next day', rc)

        lt = await pg.evaluate("""(() => { const m = MAPS['u:world'], U = WG.umbral, k = Object.keys(m.meta).find(k => m.meta[k].lantern), [lx, ly] = k.split(',').map(Number);
          W_UMB8C.shadows = [14, 14, 14, 14]; U.shadows = []; U.shadowWait = []; wEnterMap('u:world', 2, 2); wUmbShadowsSync();
          const lit = U.shadows.filter(s => wUmbLanternLit(m, s.x, s.y)).length;
          // one beside the light, you inside it: it won't step in
          let st = null; for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) if (wUmbShadowOk(m, lx + dx, ly + dy) && !wUmbLanternLit(m, lx + dx, ly + dy)) { st = [lx + dx, ly + dy, dx, dy]; break; }
          let stayed = null;
          if (st) { U.shadows = [{ id: 'sl', x: st[0], y: st[1], hx: st[0], hy: st[1] }]; const s = U.shadows[0];
            const px = lx + Math.sign(st[2]), py = ly + Math.sign(st[3]); WG.x = px; WG.y = py; WG.map = 'u:world'; WG.grace = 0;
            for (let i = 0; i < 4; i++) wUmbShadowMove(m, s, Math.random); stayed = !wUmbLanternLit(m, s.x, s.y); }
          W_UMB8C.shadows = [3, 6, 10, 14]; U.shadows = []; return { lit, stayed }; })()""")
        check(lt['lit'] == 0 and lt['stayed'] is not False, 'no shadow spawns or steps into a lantern light', lt)

        pt = await pg.evaluate("""(() => { const U = WG.umbral, w = MAPS['u:world'], den = DB.locs.find(l => l.id === 'umbralden');
          // the place's way in, and a shadow right beside you: stepping in starts nothing
          U.shadows = [{ id: 'sp', x: den.x + 1, y: den.y + 1, hx: den.x + 1, hy: den.y + 1 }]; wEnterMap('u:world', den.x, den.y + 1); WG.grace = 0;
          const n0 = W_UMB8C.started; wTryMove(0, -1); return { map: WG.map, started: W_UMB8C.started - n0 }; })()""")
        check(pt['map'] == 'u:umbralden' and pt['started'] == 0, 'stepping into a place with a shadow beside you starts nothing', pt)

        rl = await pg.evaluate("""(() => { const U = WG.umbral; U.shadows = [{ id: 'sr', x: 30, y: 31, hx: 30, hy: 31 }]; U.salt = 7; wSave(); return 1; })()""")
        await pg.evaluate("wStart(wLoadSave())")
        rl = await pg.evaluate("({ s: WG.umbral.shadows, salt: WG.umbral.salt })")
        check(rl['s'] == [{'id': 'sr', 'x': 30, 'y': 31, 'hx': 30, 'hy': 31}] and rl['salt'] == 7, 'the shadows and the salt keep through a reload', rl)

        hp = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpDread'); return h ? h.textContent : ''; })()")
        check('Dread' in hp and 'Shadow Salt' in hp, 'How to play explains the Dread', hp[:200])
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\nall ok' if not FAILS else f'\n{len(FAILS)} FAILED'); sys.exit(1 if FAILS else 0)

asyncio.run(main())
