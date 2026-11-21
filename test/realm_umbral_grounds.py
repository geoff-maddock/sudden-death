# Realm: the dark grounds (issue #99, phase 4's frame). Each engine sport's ground is on the dark world under its dark
# name, entered from it; two guards and the champion stand at its far end. The cold costs HP as you walk it. The
# champion won't play until both guards are beaten (each an Umbral card match) and something from the light side of
# the region is handed over; then PLAY goes to the sport's adapter with its hexes, a lost game costs a toll next time,
# and a won one pays the piece. A stand-in champion and adapter (the sports' own come in 4a..4h).
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

STUB = """W_NADIR.ztest = { piece: 'baseball', char: 'nadir_ztest', ground: 'g_ballpark', map: 'u:g_ballpark', region: 'plains', engine: 'zstub', toll: 20, gold: 50, hexes: 1 };
  DB.chars.nadir_ztest = { name: 'The Test Champion', kind: 'goblin', greet: 'Hello.', topics: { play: { t: 'Go.', act: 'unadir:ztest' } } };
  W_UMB4.start.zstub = (C, id, hx) => { window.__stub = (window.__stub || []).concat([{ id, hx }]); return ''; }; 0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbNadirEnd === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; for (const k in MAPS) delete MAPS[k]; " + STUB)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 200; wSave()")

        gd = await pg.evaluate("""(() => { const out = { names: Object.keys(W_UMB4.grounds).map(g => (MAPS['u:' + g] || {}).name) }, G = wGrd('g_ballpark');
          wEnterMap('u:world', G.at[0], G.at[1] + 1); wTryMove(0, -1); wDrain(); out.in = WG.map;
          const m = MAPS['u:g_ballpark'], d = wUmbFarEnd(m), at = id => m.npcs.find(n => n.id === id), c = at('nadir_ztest'), g0 = at(wUmbGuardOf('g_ballpark', 0)), g1 = at(wUmbGuardOf('g_ballpark', 1));
          out.placed = !!c && !!g0 && !!g1 && d[c.y * m.w + c.x] > d[g0.y * m.w + g0.x] && d[c.y * m.w + c.x] > d[g1.y * m.w + g1.x];
          return out; })()""")
        check(all(gd['names']) and gd['names'][0] == 'The Bone Diamond' and gd['in'] == 'u:g_ballpark', 'the eight engine grounds are on the dark world under their dark names, and you walk into one', gd)
        check(gd['placed'], 'the champion stands at the far end, the two guards nearer the way in', gd)

        cd = await pg.evaluate("""(() => { const m = MAPS['u:g_ballpark']; WG.x = m.spawn[0]; WG.y = m.spawn[1]; const h0 = RUN.hp; let steps = 0;
          for (const [dx, dy] of [[0, -1], [0, 1], [0, -1], [0, 1]]) if (wTryMove(dx, dy)) steps++; return { lost: h0 - RUN.hp, steps }; })()""")
        check(cd['lost'] == cd['steps'] // 2 and cd['steps'] >= 2, 'the cold costs a point of HP every second step on a dark ground', cd)

        gt = await pg.evaluate("""(() => { const out = {}; RUN.hp = RUN.maxhp;
          out.early = wNadirMatch('ztest');
          const keep = beginFight; beginFight = enc => { UI.busy = false; startCombat(enc.ids, enc.type, enc.sport, enc.trait); }; LAB = true;
          wRunAct('uguard:g_ballpark:0', wUmbGuardOf('g_ballpark', 0)); out.guard = { kind: RUN.pending.world.kind, umb: !!RUN.pending.world.umbral, type: RUN.pending.type, lead: B.enemies[0].n };
          B = null; RUN.pending = null; LAB = false; beginFight = keep;
          W_ON_END.uguard('win', { g: 'g_ballpark', i: 0 }); out.one = wNadirMatch('ztest');
          W_ON_END.uguard('win', { g: 'g_ballpark', i: 1 }); out.again = wUmbGuardMatch('g_ballpark', 1);
          WG.items.grain = 0; out.gate = wNadirMatch('ztest');
          wAddItem('grain', 1); window.__stub = []; out.go = wNadirMatch('ztest'); out.stub = window.__stub.slice(); out.grain = WG.items.grain || 0;
          wUmbNadirEnd('ztest', 'lose'); RUN.gold = 5; out.poor = wNadirMatch('ztest'); RUN.gold = 100; out.paid = wNadirMatch('ztest') === '' && RUN.gold === 80;
          wUmbNadirEnd('ztest', 'win'); out.pieces = WG.umbral.pieces.slice(); out.done = wNadirMatch('ztest');
          out.audit = wAudit(); return out; })()""")
        check('Left Hand' in gt['early'] and 'Right Hand' in gt['early'], 'the champion won\'t play until both guards are beaten, and says who is left', gt)
        check(gt['guard']['kind'] == 'uguard' and gt['guard']['umb'] and gt['guard']['type'] == 'elite' and 'Hand' in gt['guard']['lead'], 'a guard plays an Umbral card match, an elite', gt)
        check('Right Hand' in gt['one'] and 'Left Hand' not in gt['one'] and 'steps aside' in gt['again'], 'a beaten guard stands aside for good', gt)
        check('Grain' in gt['gate'] and gt['go'] == '' and gt['grain'] == 0 and len(gt['stub']) == 1 and len(gt['stub'][0]['hx']) == 1, 'then it wants something from the light side of the region (handed over once), and PLAY goes to the sport\'s adapter with its hexes', gt)
        check('toll' in gt['poor'] and gt['paid'] and gt['pieces'] == ['baseball'] and 'yours' in gt['done'], 'a lost game costs a toll next time; a won one pays the piece', gt)
        check(gt['audit'] == [], 'the audit is clean: every dark ground has its guards and champion where they can be reached', gt)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
