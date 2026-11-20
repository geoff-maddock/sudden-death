# Realm shed (issue #102, phase 8): superstars on the ice, and the players drawn.
# Each of the six superstars has a curling kind (ratings, two draw and two hit powers, an ultimate); every id they add
# ends in 'cr' and none is one of the engine's own; a superstar made now has curling ratings from its kind (marked), and
# one from an older save (an average player's) is made again from its kind once, on load; a game with a superstar
# curls (it casts its own powers); the figures: the curler holding the broom stands behind a called stone, the
# sweepers run beside a sliding one, each drawn as their own kind (the superstars' figures are in the engine's scope);
# How to play has each superstar's game on the ice. Screenshots go to /tmp. Asserts; exits nonzero on failure.
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

HELP = r"""
window.__to = (ph, max) => { let n = 0; while (wCR.phase !== ph && n++ < (max || 20000)) wCR.tick(0.05); return wCR.phase === ph; };
0"""
STARS = ['phoenix', 'kraken', 'behemoth', 'djinn', 'hydra', 'frostwyrm']

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        t = await pg.evaluate(f"""(() => {{ const stars = {json.dumps(STARS)}, own = new Set(), mine = [];
          for (const k of Object.keys(wCR.pow)) if (!stars.includes(k)) {{ for (const P of wCR.pow[k].concat(wCR.pow2[k])) own.add(P.id); own.add(wCR.ult[k].id); }}
          const each = stars.map(k => {{ const r = wCR.rate(k), P = (wCR.pow[k] || []).concat(wCR.pow2[k] || []), U = wCR.ult[k]; P.concat(U ? [U] : []).forEach(x => mine.push(x.id));
            return {{ k, rated: wCR.stats.every(s => r[s] !== 6.5 && r[s] >= 1 && r[s] <= wCR.cap), four: P.length === 4, ult: !!U }}; }});
          return {{ each: each.filter(e => !(e.rated && e.four && e.ult)), ends: mine.every(id => id.endsWith('cr')), clash: mine.filter(id => own.has(id)), uniq: new Set(mine).size === mine.length, figs: stars.filter(k => !wCR.figKinds().includes(k)) }}; }})()""")
        check(t['each'] == [], 'each superstar has a curling kind: ratings, two draw and two hit powers, an ultimate', t['each'])
        check(t['ends'] and t['clash'] == [] and t['uniq'], 'every superstar id ends in "cr", none is the engine\'s own, none repeats', t)
        check(t['figs'] == [], 'the superstars\' figures are in the engine\'s scope', t['figs'])

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        r = await pg.evaluate("""(() => { const p = wMakePlayer({ kind: 'kraken', lvl: 3, n: 'Kraken' }, 'tavern'); wAddPlayer(p);
          // (a short roster: the call-ups the captain's repick keeps, each in an open position)
          const allR = wRoster; wRoster = () => allR().slice(0, 2); WG.shed = null; const C = wFourSyncCr(); C.mine = false; const cus = C.cu.map(c => c.cid); wShedRepick(C);
          const keptCu = cus.length > 0 && cus.every(cid => WG.shed.cu.some(c => c.cid === cid) && WG.shed.four.includes(cid)); wRoster = allR; WG.shed = null; wFourSyncCr();
          // (a long one: an older save's Djinn, average till it is made again, makes the four on its own ratings)
          for (let i = 0; i < 4; i++) wAddPlayer(wMakePlayer({ kind: 'goblin', lvl: 1, n: 'Gob' + i }, 'tavern'));
          const q = wMakePlayer({ kind: 'djinn', lvl: 3, n: 'Djinn' }, 'tavern'); wAddPlayer(q); q.cr = { lv: 3, got: {}, drw: 2, lin: 2, hit: 2, swp: 2, nrv: 2, red: 2 };
          const C2 = wFourSyncCr(); C2.mine = false; wFourCrAutoPick(C2); wFourSyncCr(); const outBefore = !WG.shed.four.includes(q.id);
          const save = JSON.parse(JSON.stringify({ WG, RUN })); wStart(save); const Q = wPlayer(q.id), P = wPlayer(p.id);
          const copy = JSON.parse(JSON.stringify(WG.shed)), djinnIn = WG.shed.four.includes(q.id);
          return { made: !!(P.cr && P.cr.st), swp: P.cr.swp, fixed: !!(Q.cr && Q.cr.st), drw: Q.cr.drw, keptCu, outBefore, djinnIn, shed: !!copy.four }; })()""")
        check(r['made'] and r['swp'] >= 10, 'a superstar made now has curling ratings from its kind (the Kraken sweeps best)', r)
        check(r['fixed'] and r['drw'] >= 9 and r['outBefore'] and r['djinnIn'], 'a superstar from an older save is made again from its kind, once, on load, and the captain picks the four on the new ratings', r)
        check(r['keptCu'], 'the captain\'s repick keeps the call-ups, each in an open position', r)
        g = await pg.evaluate("""(() => { const T = { name: 'Stars', short: 'STA', roster: ['phoenix', 'kraken', 'behemoth', 'djinn'].map((k, i) => ({ n: k, kind: k })) }, U = { name: 'Dwarves', short: 'DWA', roster: [0, 1, 2, 3].map(i => ({ n: 'd' + i, kind: 'dwarf' })) };
          const s = wCR.simGame({ seed: 3, ends: 6, skill: [2, 1], powers: true, teams: [T, U] }); wCR.start({ seed: 3, ends: 6, skill: [2, 1], powers: true, teams: [T, U] }); let n = 0; while (!wCR.G.over && n++ < 300) wCR.turn();
          const ids = wCR.G.casts.filter(c => c.side === 0).map(c => c.id); return { over: !!s.over, own: ids.filter(id => id.endsWith('cr')).length }; })()""")
        check(g['over'] and g['own'] >= 2, 'a game with superstars curls, and they cast their own powers', g)

        # ---------- the players drawn ----------
        f = await pg.evaluate("""(async () => { W_SHED_MODE = 'play'; wShedGame({ seed: 5, mode: 'play', hammer: 1, teams: [{ name: 'Stars', short: 'STA', color: '#c84a2a', roster: ['phoenix', 'kraken', 'behemoth', 'djinn'].map(k => ({ n: k, kind: k })) }, { name: 'Dwarves', short: 'DWA', color: '#2a6ac8', roster: [0, 1, 2, 3].map(i => ({ n: 'd' + i, kind: 'dwarf' })) }] });
          wCR.pause(true); __to('aim'); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return { aim: wCR.figsNow() }; })()""")
        await pg.locator('#v-shed canvas').screenshot(path='/tmp/shed_figs_aim.png')
        s2 = await pg.evaluate("""(async () => { wCR.press(); let n = 0; while (wCR.view.meter && wCR.view.meter.v < 1 && n++ < 2000) wCR.tick(.002); wCR.press(); n = 0; while (wCR.phase === 'slide' && n++ < 30) wCR.tick(.05);
          wCR.sweep = true; wCR.tick(.05); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return wCR.figsNow(); })()""")
        await pg.locator('#v-shed canvas').screenshot(path='/tmp/shed_figs_slide.png')
        await pg.evaluate("wCR.sweep = false")
        check(f['aim'] == ['broom'] and s2 == ['sweeper'], 'the broom stands behind a called stone; the sweepers run beside a sliding one', [f, s2])
        await pg.evaluate("wCR.pause(true); showPage('help')")
        hp = await pg.evaluate("(() => { const h = $('wHelpShedStars'); return !!h && ['Phoenix', 'Kraken', 'Behemoth', 'Djinn', 'Hydra', 'Frost Wyrm'].every(n => h.textContent.includes(n)); })()")
        check(hp, 'How to play has each superstar\'s game on the ice', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
