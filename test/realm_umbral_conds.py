# Realm: the champions' conditions (issue #99). Vesper Gloam (basketball) and Sexton Vale (golf) play only after
# dark: PLAY by day is turned away, by night their card opens and names the condition. Vesper Quill (baseball) and
# Hollis Grael (hockey) want it won by two or more: a win by one keeps the piece with them and counts a try, a win by
# two pays it. The Seal's final rounds carry no condition. Asserts; exits nonzero on failure.
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_UMB4I === 'object'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("""wSetFlag('champion'); const U = WG.umbral; U.seen = WG.dayAbs; U.guards = {}; U.gates = {}; RUN.gold = 9999;
          for (const id of ['court', 'links', 'diamond', 'rink']) { const C = W_NADIR[id]; U.guards[C.ground + ':0'] = U.guards[C.ground + ':1'] = 1; U.gates[id] = 1; } 0""")

        c = await pg.evaluate("""Object.fromEntries(Object.keys(W_UMB4I.conds).map(id => [id, (W_NADIR[id].cond || {}).k]))""")
        check(c == {'court': 'night', 'links': 'night', 'diamond': 'margin', 'rink': 'margin'}, 'four champions carry a condition', c)

        o = await pg.evaluate("""(() => { const U = WG.umbral, C = W_NADIR.court; delete U.guards[C.ground + ':0']; WG.map = C.map; WG.min = 12 * 60;
          const why = wNadirMatch('court'); U.guards[C.ground + ':0'] = 1; return why; })()""")
        check('will not play you until' in (o or '') and 'after dark' not in (o or ''), 'by day, a night champion\'s other asks come first (the guards)', o)

        n = await pg.evaluate("""(() => { const out = {}, close = () => { for (let i = 0; i < 6 && !document.getElementById('modal').hidden; i++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); document.getElementById('modal').hidden = true; };
          for (const id of ['court', 'links']) { WG.map = W_NADIR[id].map;
            WG.min = 12 * 60; const day = wNadirMatch(id), dayModal = !document.getElementById('modal').hidden;
            WG.min = 23 * 60; const night = wNadirMatch(id), box = document.getElementById('modalBox'), named = !!box.querySelector('.wumbcond') && /after dark/.test(box.querySelector('.wumbcond').textContent);
            out[id] = { day, dayModal, isNightAtNight: wIsNight(), night, open: !document.getElementById('modal').hidden, named }; close(); }
          return out; })()""")
        for id in ('court', 'links'):
            r = n[id]
            check('after dark' in (r['day'] or '') and not r['dayModal'], f'{id}: by day PLAY is turned away', r)
            check(r['isNightAtNight'] and not r['night'] and r['open'] and r['named'], f'{id}: by night the card opens and names the condition', r)

        m = await pg.evaluate("""(() => { const out = {}, U = WG.umbral, close = () => { for (let i = 0; i < 6 && !document.getElementById('modal').hidden; i++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); if (typeof closePause === 'function') closePause(); };
          for (const id of ['diamond', 'rink']) { const C = W_NADIR[id], kind = W_UMB4I.kinds[id], n0 = WLOG.length, t0 = U.tries[id] || 0;
            W_ON_END[kind]('win', { id }, { us: 5, them: 4 });
            const by1 = { piece: U.pieces.includes(C.piece), tries: (U.tries[id] || 0) - t0, said: WLOG.slice(n0).some(l => /wanted it by 2/.test(l[0])) };
            close();
            W_ON_END[kind]('win', { id }, { us: 6, them: 4 });
            out[id] = { by1, by2: U.pieces.includes(C.piece) };
            close(); WG.cardOffer = null; }
          return out; })()""")
        for id in ('diamond', 'rink'):
            r = m[id]
            check(not r['by1']['piece'] and r['by1']['tries'] == 1 and r['by1']['said'], f'{id}: a win by one keeps the piece with them, counts a try and says why', r)
            check(r['by2'], f'{id}: a win by two pays the piece', r)

        st = await pg.evaluate("""(() => { const n0 = WLOG.length, fake = wUmbCondSettle(function () { W_ON_END[W_UMB4I.kinds.rink]('win', { id: 'rink' }, { us: 3, them: 2 }); wLog('Final: you win 3-2.', 'g'); return 'Final: you win 3-2.'; });
          const m = fake(); const L = WLOG.slice(n0).map(l => l[0]); for (let i = 0; i < 6 && !document.getElementById('modal').hidden; i++) document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
          return { m, fin: L.findIndex(t => /^Final/.test(t)), note: L.findIndex(t => /wanted it by 2/.test(t)), card: W_UMB4I.note, settling: W_UMB4I.settling }; })()""")
        check(st['m'].startswith('Final') and 'wanted it by 2' in st['m'] and 0 <= st['fin'] < st['note'] and st['card'] is None and st['settling'] == 0, "in a settle, the margin's words follow the final, on the result card and in the log", st)

        f = await pg.evaluate("""(() => { WG.umbral.pieces = Object.keys(W_UMB_PIECES); const seen = [];
          for (let r = 0; r < 3; r++) { WG.umbral.finale = r; wUmbFinaleEntry(); seen.push([W_NADIR.finale.engine || 'card', W_NADIR.finale.cond || null]); }
          return seen; })()""")
        check(all(x[1] is None for x in f), "the Seal's final rounds carry no condition", f)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
