# Realm links: superstars on the course (issue #92, phase 8). Each of the six superstars has a golf kind in the engine:
# six ratings, a long-game and a short-game power and a second of each, and an ultimate, with ids that clash with nothing
# (the engine's own or each other's: a clash would silently replace a power). A superstar's golf ratings are seeded from
# their own kind and marked; one signed before this (and seeded as an average player) is made again once when the
# journey loads, and not twice. A side with a superstar plays, casts their power and their ultimate, with no errors.
# The other clubs never field one. The Links tab offers a superstar their own two pairs, and How to play has each one's
# game on the course. Asserts; exits nonzero on failure.
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
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wGL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")

        # ---------- the engine's tables ----------
        t = await pg.evaluate("""(() => { const K = W_STARS.map(s => s.kind);
          const each = K.map(k => ({ k, rate: wGL.stats.every(s => wGL.rate(k)[s] !== 6.5 && wGL.rate(k)[s] >= 1 && wGL.rate(k)[s] <= 12), pow: wGL.pow[k] && wGL.pow[k].length === 2, pow2: wGL.pow2[k] && wGL.pow2[k].length === 2, ult: !!wGL.ult[k] }));
          const ids = []; for (const k in wGL.pow) for (const P of wGL.pow[k].concat(wGL.pow2[k])) ids.push(P.id); for (const k in wGL.ult) ids.push(wGL.ult[k].id); for (const k in wGL.sit) ids.push(k);
          const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
          return { ok: each.every(e => e.rate && e.pow && e.pow2 && e.ult), each, n: ids.length, dup, behemoth: wGL.rate('behemoth').pow, kraken: wGL.rate('kraken').put }; })()""")
        check(t['ok'], 'each of the six superstars has golf ratings, a long and a short power, a second of each, and an ultimate', t['each'])
        check(not t['dup'] and t['n'] > 100, 'every power id is its own (the engine\'s and the superstars\'): nothing silently replaced', t)
        check(t['behemoth'] == 12 and t['kraken'] == 10, 'each plays as itself: the Behemoth the longest hitter there is, the Kraken the best putter', t)

        # ---------- in a game ----------
        g = await pg.evaluate("""(() => { const out = {}; for (const s of W_STARS) { const G = wGL.start({ seed: 7, powers: true, teams: [{ kinds: [s.kind, 'elf', 'dwarf', 'goblin'], roles: { tee: 0, approach: 1, short: 2, putt: 3 } }, { kinds: ['goblin', 'kobold', 'dwarf', 'troll'] }] });
            G.mana[0] = 5; G.roar[0] = 70; const P = wGL.powNow(0, 0), a = wGL.cast(0, 'pow', 0), u = wGL.cast(0, 'ult', 0); let n = 0; while (wGL.turn() && n++ < 3000);
            out[s.kind] = { pow: P && P.n, a, u, over: !!wGL.G.over }; } return out; })()""")
        check(all(v['a'] == '' and v['u'] == '' and v['over'] for v in g.values()), 'a side with each superstar casts their power and their ultimate, and plays a game to the end', g)

        # ---------- in the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        r = await pg.evaluate("""(() => { const p = wMakePlayer({ kind: 'behemoth', lvl: 3, n: 'Grumm' }, 'star'); wAddPlayer(p); const k = wGL.rate('behemoth');
          const near = wGL.stats.every(s => Math.abs(p.gl[s] - (p.gl.got[s] || 0) - k[s]) <= 1.5);
          // an older save: the superstar seeded as an average player, unmarked
          const save = JSON.parse(JSON.stringify({ WG, RUN })), sp = save.WG.roster.find(x => x.kind === 'behemoth'); sp.gl = { pow: 6, acc: 6, tch: 6, put: 6, nrv: 6, scr: 6, lv: 3, got: {} };
          wStart(save); const q = wRoster().find(x => x.kind === 'behemoth'), fixed = q.gl.pow >= 10 && q.gl.st === 1, once = JSON.stringify(q.gl);
          const save2 = JSON.parse(JSON.stringify({ WG, RUN })); wStart(save2); const again = JSON.stringify(wRoster().find(x => x.kind === 'behemoth').gl) === once;
          return { mark: p.gl.st, near, fixed, again }; })()""")
        check(r['mark'] == 1 and r['near'], 'a superstar\'s golf ratings come from their own kind, and are marked', r)
        check(r['fixed'] and r['again'], 'one signed before this (seeded as an average player) is made again once when the journey loads, and not twice', r)
        o = await pg.evaluate("""(() => { const stars = new Set(W_STARS.map(s => s.kind)); let any = false; for (const c of wBallClubs()) for (const t of [1, 2, 3]) { const T = wLinksOpp(c, t); if (T.roster.some(m => stars.has(m.kind))) any = true; } return any; })()""")
        check(not o, 'the other clubs never field a superstar', o)
        lt = await pg.evaluate("""(() => { const p = wRoster().find(x => x.kind === 'behemoth'); wFourSync(); WG.links.four.tee = p.id; WG.links.mine = true; wOpenCamp('links'); const row = document.querySelector(`#wCampBody [data-gid="${p.id}"]`);
          const opts = row ? [...row.querySelectorAll('[data-gpw] option')].map(o => o.textContent) : []; document.getElementById('modal').hidden = true; return opts; })()""")
        check(set(['Earthshaker', 'Moss Plough', 'Stomp', 'Mountain Putt']) <= set(lt), 'the Links tab offers a superstar their own two pairs of powers', lt)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const t = (document.getElementById('wHelpLinksStars') || {}).textContent || ''; return ['Phoenix', 'Kraken', 'Behemoth', 'Djinn', 'Hydra', 'Frost Wyrm'].map(n => t.includes(n)); })()")
        check(all(hp), 'How to play has each superstar\'s game on the course', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
