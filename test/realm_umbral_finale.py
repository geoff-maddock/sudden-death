# Realm: the finale (issue #99, phase 5). Hollow Aurelia waits in the Hollow Coliseum and won't play for the Seal
# without all nine pieces. With them, three rounds in the three ways to play where your Umbral record is weakest, chosen
# once; a card round is an Umbral card match against her, an engine round goes to the sport's adapter (stand-ins here);
# a piece won at the first try takes a hex off its round. Lose a round and you try it again; win the third and the Seal
# is forged: back in the Crown Coliseum, the portal shut, the eclipse over, a closing scene. In Hardcore, a lost engine
# round ends the journey. Asserts; exits nonzero on failure.
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbFinale === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("""wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 400; wSave();
          // (the sports' adapters as stand-ins: record the call, start nothing)
          window.__ad = []; for (const e of Object.values(W_UMB5.engine)) if (e) { window['__real_' + e] = W_UMB4.start[e]; W_UMB4.start[e] = (C, id, hx) => { __ad.push({ e, id, hx: hx.length }); return ''; }; } 0""")

        fn = await pg.evaluate("""(() => { const out = {}, m = MAPS['u:coliseum'], a = m.npcs.find(n => n.id === 'nadir_aurelia'); out.placed = !!a;
          wEnterMap('u:coliseum', m.spawn[0], m.spawn[1]); const U = WG.umbral;
          U.pieces = Object.keys(W_UMB_PIECES).slice(0, 8); out.short = wUmbFinale();
          U.pieces = Object.keys(W_UMB_PIECES); U.tries = { gate: 3 }; out.sports = wUmbFinaleSports().slice();
          U.tries.gate = 0; out.fixed = wUmbFinaleSports().slice();
          return out; })()""")
        check(fn['placed'], 'Hollow Aurelia waits in the Hollow Coliseum', fn)
        check('8 of the nine' in fn['short'] and 'still out' in fn['short'], 'without all nine pieces she won\'t play for the Seal, and says what is still out', fn)
        check(fn['sports'][0] == 'card' and len(fn['sports']) == 3 and fn['fixed'] == fn['sports'], 'the three rounds are where your record is weakest (the most tries first), chosen once', fn)

        r1 = await pg.evaluate("""(() => { const U = WG.umbral, out = {}, keep = beginFight; beginFight = enc => { UI.busy = false; startCombat(enc.ids, enc.type, enc.sport, enc.trait); }; LAB = true;
          wRunAct('ufinale', 'nadir_aurelia'); out.card = { kind: RUN.pending.world.kind, ids: RUN.pending.ids.slice(), hexes: RUN.pending.world.hexes.length, umb: !!B.umb };
          B = null; RUN.pending = null;
          // (a piece won cleanly: one hex fewer in its round)
          U.clean = { card: 1 }; wUmbFinale(); out.clean = RUN.pending.world.hexes.length; B = null; RUN.pending = null; LAB = false; beginFight = keep;
          W_ON_END.nadir('win', { id: 'finale' }); out.after1 = U.finale;
          __ad.length = 0; wUmbFinale(); out.r2 = __ad.slice(); W_ON_END.nadir('lose', { id: 'finale' }); out.lost = [U.finale, U.tries.finale];
          // (a reload mid-round loses the in-memory entry: the result still finds its round)
          wUmbFinale(); delete W_NADIR.finale; W_ON_END.nadir('win', { id: 'finale' }); out.after2 = U.finale;
          wUmbFinale(); W_ON_END.nadir('win', { id: 'finale' });
          out.sealed = { sealed: !!U.sealed, year: U.sealedYear, map: WG.map, scene: !!document.getElementById('wUmbSealed'), portal: wTileAt(MAPS.umbralden, ...W_UMB.portal.umbralden), eclipse: wUmbEclipse(), again: wUmbFinale() };
          document.getElementById('wUmbSealed').click();
          return out; })()""")
        check(r1['card']['kind'] == 'nadir' and r1['card']['ids'][0] == 'u_aurelia' and r1['card']['hexes'] == 2 and r1['card']['umb'], 'a card round is an Umbral card match against Hollow Aurelia, with two hexes', r1)
        check(r1['clean'] == 1, 'a piece won at the first try takes a hex off its round', r1)
        check(r1['after1'] == 1 and len(r1['r2']) == 1 and r1['r2'][0]['id'] == 'finale' and r1['lost'] == [1, 1] and r1['after2'] == 2, 'an engine round goes to its sport\'s adapter; a lost round is tried again, from that round', r1)
        S = r1['sealed']
        check(S['sealed'] and S['map'] == 'coliseum' and S['scene'] and S['portal'] != 'D' and not S['eclipse'] and 'forged' in S['again'], 'win the third and the Seal is forged: back in the Crown Coliseum, the portal shut, no more eclipses, a closing scene', r1)

        hc = await pg.evaluate("""(() => { const U = WG.umbral; U.sealed = 0; U.finale = 1; WG.hardcore = true; let ended = null; const r0 = recordRun, s0 = showEnd; recordRun = k => { ended = k; }; showEnd = () => {};
          wUmbFinale(); W_ON_END.nadir('lose', { id: 'finale' }); recordRun = r0; showEnd = s0; WG.hardcore = false; return { ended }; })()""")
        check(hc['ended'] == 'lose', 'in a Hardcore journey, a lost engine round ends the journey', hc)
        aud = await pg.evaluate("wAudit()")
        check(aud == [], 'the audit is clean', aud)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
