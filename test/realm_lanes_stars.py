# Realm lanes: superstars on the lanes, and the look (issue #100, phase 8). Each of the six superstars has a bowling kind
# in the engine: six ratings, a strike and a spare power and a second of each, and an ultimate, with ids that clash with
# nothing (the engine's own or each other's: a clash would silently replace a power). The Kraken has the most revs in
# the realm, the Behemoth the most power. A superstar's bowling ratings are seeded from their own kind and marked; one
# signed before this (seeded as an average player) is made again once when the journey loads, keeping their hand, and
# not twice. A side with a superstar casts their power and their ultimate and plays a game to the end. The other clubs
# never field one. The Lanes tab offers a superstar their own two pairs, and How to play has each one's game.
# The look: the bowler at the foul line is the bowler up, as their own kind (every kind, the superstars too, draws
# without an error); Moll's glass says what each ball was (a strike, a double, a turkey, a spare, a split, the gutter,
# the count) and shows over the lane while the pins rest. Asserts; exits nonzero on failure.
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
window.__tickTo = (pred, max) => { let n = 0; while (!pred() && n++ < (max || 4000)) wBL.tick(0.05); return pred(); };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wBL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")

        # ---------- the engine's tables ----------
        t = await pg.evaluate("""(() => { const K = W_STARS.filter(s => s.kind).map(s => s.kind);
          const each = K.map(k => ({ k, rate: wBL.stats.every(s => wBL.rate(k)[s] !== 6.5 && wBL.rate(k)[s] >= 1 && wBL.rate(k)[s] <= 12), pow: wBL.pow[k] && wBL.pow[k].length === 2, pow2: wBL.pow2[k] && wBL.pow2[k].length === 2, ult: !!wBL.ult[k] }));
          const ids = []; for (const k in wBL.pow) for (const P of wBL.pow[k].concat(wBL.pow2[k])) ids.push(P.id); for (const k in wBL.ult) ids.push(wBL.ult[k].id); for (const k in wBL.sit) ids.push(k);
          const dup = ids.filter((x, i) => ids.indexOf(x) !== i), kinds = Object.keys(wBL.pow);
          const top = st => Math.max(...kinds.map(k => wBL.rate(k)[st]));
          return { n6: K.length, ok: each.every(e => e.rate && e.pow && e.pow2 && e.ult), each, n: ids.length, dup, kraken: wBL.rate('kraken').rev, revTop: top('rev'), behemoth: wBL.rate('behemoth').pow, powTop: top('pow') }; })()""")
        check(t['n6'] == 6 and t['ok'], 'each of the six superstars has bowling ratings, a strike and a spare power, a second of each, and an ultimate', t['each'])
        check(not t['dup'] and t['n'] > 100, 'every power id is its own (the engine\'s and the superstars\'): nothing silently replaced', t)
        check(t['kraken'] == t['revTop'] == 12 and t['behemoth'] == t['powTop'] == 12, 'each bowls as itself: the Kraken the most revs in the realm, the Behemoth the most power', t)

        # ---------- in a game ----------
        g = await pg.evaluate("""(() => { const out = {}; for (const s of W_STARS.filter(x => x.kind)) {
            wBL.start({ seed: 7, powers: true, mode: 'watch', teams: [{ name: 'A', roster: [s.kind, 'elf', 'dwarf', 'goblin', 'troll'].map((k, i) => ({ n: 'a' + i, kind: k })), order: [0, 1, 2, 3, 4] }, { name: 'B', roster: ['goblin', 'kobold', 'dwarf', 'troll', 'elf'].map((k, i) => ({ n: 'b' + i, kind: k })) }] });
            const G = wBL.G; let n = 0; while (wBL.up() !== 0 && n++ < 5) wBL.turn();
            const ri = wBL.bowler(0); G.mana[0] = 5; G.roar[0] = 70; const P = wBL.powNow(0, ri), u = wBL.cast(0, 'ult', ri), a = wBL.cast(0, 'pow', ri);
            n = 0; while (!G.over && n++ < 400) wBL.turn();
            out[s.kind] = { star: G.teams[0].roster[ri].kind === s.kind, pow: P && P.n, a, u, over: !!G.over, cast: G.casts.filter(c => c.side === 0).length }; } return out; })()""")
        check(all(v['star'] and v['a'] == '' and v['u'] == '' and v['over'] and v['cast'] >= 2 for v in g.values()), 'a side with each superstar casts their power and their ultimate, and plays a game to the end', g)

        # ---------- in the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        r = await pg.evaluate("""(() => { const p = wMakePlayer({ kind: 'kraken', lvl: 3, n: 'Inkwell' }, 'star'); wAddPlayer(p); const k = wBL.rate('kraken');
          const near = wBL.stats.every(s => Math.abs(p.bl[s] - (p.bl.got[s] || 0) - k[s]) <= 1.5);
          // an older save: the superstar seeded as an average player, unmarked, left-handed
          const save = JSON.parse(JSON.stringify({ WG, RUN })), sp = save.WG.roster.find(x => x.kind === 'kraken'); sp.bl = { pow: 6, rev: 6, acc: 6, spr: 6, nrv: 6, red: 6, hand: -1, lv: 3, got: {} };
          wStart(save); const q = wRoster().find(x => x.kind === 'kraken'), fixed = q.bl.rev >= 11 && q.bl.st === 1 && q.bl.hand === -1 && q.bl.lv === (q.lvl || 1), once = JSON.stringify(q.bl);
          const save2 = JSON.parse(JSON.stringify({ WG, RUN })); wStart(save2); const again = JSON.stringify(wRoster().find(x => x.kind === 'kraken').bl) === once;
          return { mark: p.bl.st, near, fixed, again, bl: q.bl }; })()""")
        check(r['mark'] == 1 and r['near'], 'a superstar\'s bowling ratings come from their own kind, and are marked', r)
        check(r['fixed'] and r['again'], 'one signed before this (seeded as an average player) is made again once when the journey loads, keeping their hand, and not twice', r)
        o = await pg.evaluate("""(() => { const stars = new Set(W_STARS.map(s => s.kind)); let any = false; for (const c of wBallClubs()) for (const t of [1, 2, 3]) { const T = wLanesOpp(c, t); if (T.roster.some(m => stars.has(m.kind))) any = true; } return any; })()""")
        check(not o, 'the other clubs never field a superstar', o)
        lt = await pg.evaluate("""(() => { const p = wRoster().find(x => x.kind === 'kraken'); wFiveSync(); const C = WG.lanes; if (!C.five.includes(p.id)) C.five[0] = p.id; C.mine = true; wOpenCamp('lanes');
          const row = document.querySelector(`#wCampBody [data-nid="${p.id}"]`), opts = row ? [...row.querySelectorAll('[data-npw] option')].map(o => o.textContent) : []; document.getElementById('modal').hidden = true; return opts; })()""")
        check(set(['Tentacle Hook', 'Ink Cloud', 'Eight-arm Pickup', 'Undertow']) <= set(lt), 'the Lanes tab offers a superstar their own two pairs of powers', lt)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const t = (document.getElementById('wHelpLanesStars') || {}).textContent || ''; return ['Phoenix', 'Kraken', 'Behemoth', 'Djinn', 'Hydra', 'Frost Wyrm'].map(n => t.includes(n)); })()")
        check(all(hp), 'How to play has each superstar\'s game on the lanes', hp)
        await pg.evaluate("showPage('play')")

        # ---------- the look: the bowler at the line ----------
        b = await pg.evaluate("""(() => { W_LANES_MODE = 'play'; wRunAct('lanesbowl'); wBL.pause(true); wLanesGame({ seed: 5, mode: 'play' }); wBL.pause(true); window.__tickTo(() => wBL.phase === 'aim');
          const s = wBL.view.you, ri = wBL.bowler(s), A = wBL.atLine(), mine = { s: A.s, ri: A.ri, kind: A.kind, hold: !!A.hold, want: wBL.G.teams[s].roster[ri].kind };
          // every kind draws at the line, the superstars too, through the swing
          const bad = []; for (const k of Object.keys(wBL.pow)) { wBL.G.teams[s].roster[ri].kind = k; try { wBL.render(.05); wBL.press(); wBL.tick(.3); wBL.render(.05); } catch (e) { bad.push(k + ': ' + e.message); } wBL.press(); window.__tickTo(() => wBL.phase === 'aim' || wBL.phase === 'over'); if (wBL.phase !== 'aim') { wLanesGame({ seed: 6, mode: 'play' }); wBL.pause(true); window.__tickTo(() => wBL.phase === 'aim'); } }
          const sw = (() => { wBL.press(); wBL.tick(.4); return wBL.atLine(); })();
          return { mine, bad, sw: { th: sw.th, ball: sw.ball } }; })()""")
        check(b['mine']['s'] == 0 and b['mine']['kind'] == b['mine']['want'] and b['mine']['hold'], 'at the line is the bowler up, as their own kind, holding the ball while you set up', b['mine'])
        check(not b['bad'] and b['sw']['th'] < -.3 and b['sw']['ball'], 'every kind (the superstars too) draws at the line through the swing; the backswing takes the arm back', b)

        # ---------- the look: Moll's glass ----------
        m = await pg.evaluate("""(() => { W_LANES_MODE = 'watch'; wLanesGame({ seed: 11, mode: 'watch' }); wBL.pause(true); const seen = {}, wrong = []; let games = 0, n = 0, pix = null;
          while (n++ < 3000 && Object.keys(seen).length < 5) {
            window.__tickTo(() => wBL.phase === 'rest' || wBL.phase === 'over', 400);
            const S = wBL.screen(), L = wBL.last, R = L.roll;
            if (S) { seen[S.k] = (seen[S.k] || 0) + 1;
              const want = R.strike ? ['strike', 'turkey'] : R.spare ? ['spare', 'splitmade'] : L.ball.gutter != null ? ['gutter'] : R.split ? ['split'] : ['count'];
              if (!want.includes(S.k)) wrong.push({ S, R });
              if (S.k === 'strike' && !pix) { for (let i = 0; i < 8; i++) wBL.render(.05); const cv = document.querySelector('#v-lanes canvas'), d = cv.width / 960, c = cv.getContext('2d');
                const at = (x, y) => Array.from(c.getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data).slice(0, 3); pix = { frame: at(320 - wBL.screenRules.w / 2 - 12, 250), text: S.text }; } }
            if (wBL.phase === 'over') { games++; wLanesGame({ seed: 100 + games, mode: 'watch' }); wBL.pause(true); }
            else window.__tickTo(() => wBL.phase !== 'rest', 400);
          }
          return { seen, wrong: wrong.slice(0, 3), pix }; })()""")
        check(not m['wrong'] and {'strike', 'count', 'spare'} <= set(m['seen']), 'Moll\'s glass says what each ball was: a strike, a spare, the count (and splits, gutters, turkeys)', m)
        f = m['pix'] and m['pix']['frame']
        check(bool(f) and abs(f[0] - 0x3a) < 12 and abs(f[1] - 0x24) < 12 and abs(f[2] - 0x16) < 12 and m['pix']['text'] in ('STRIKE!', 'DOUBLE!'), 'the glass shows over the lane in its carved frame while the pins rest', m['pix'])
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
