# Realm rink: superstars on the ice (issue #83, phase 9).
# Each of the six superstars has a rink kind in the engine: six ratings, a puck power and a checking power and a second
# of each, and an ultimate, with ids that clash with nothing (the engine's own or each other's: a clash would silently
# replace a power). A superstar's hockey ratings are seeded from their own kind and marked; one signed before this (and
# seeded as a goblin) is made again once when the journey loads, and not twice. A side with a superstar plays, casts
# their powers and their ultimate, and is drawn, with no errors. The other clubs never field one. The Rink tab offers a
# superstar their own two pairs, and How to play has each one's game on the ice. Asserts; exits nonzero on failure.
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

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""

async def main():
    if not os.environ.get('SD_BUILT'): subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        stars = await pg.evaluate("W_STARS.filter(s => s.kind).map(s => s.kind)")

        # ---------- the tables ----------
        t = await pg.evaluate("""(() => { const K = W_STARS.filter(s => s.kind).map(s => s.kind), P = wHK.pows, keys = new Set(Object.keys(wHK.fx0)), ids = wHK.powerIds();
          const starIds = K.flatMap(k => P[k] ? P[k].one.concat(P[k].two).map(x => x.id).concat(P[k].ult.id) : []), own = wHK.kinds.filter(k => !K.includes(k)).flatMap(k => P[k].one.concat(P[k].two).map(x => x.id).concat(P[k].ult.id));
          return { K, in: K.every(k => wHK.kinds.includes(k)), rated: K.every(k => { const r = wHK.rate(k); return wHK.stats.every(s => r[s] >= 1 && r[s] <= 10); }), full: K.every(k => P[k] && P[k].one.length === 2 && P[k].two.length === 2 && P[k].ult.n),
            fx: K.every(k => P[k].one.concat(P[k].two).every(x => Object.keys(x.fx).length && Object.keys(x.fx).every(f => keys.has(f)) && x.desc.length > 15) && Object.keys(P[k].ult.o).concat(Object.keys(P[k].ult.d)).length > 0),
            ids: ids.length, uniq: new Set(ids).size, starIds: starIds.length, starUniq: new Set(starIds).size, clash: starIds.filter(id => own.includes(id)), wyrm: wHK.rate('frostwyrm'), kraken: wHK.rate('kraken').ref }; })()""")
        check(len(t['K']) == 6 and t['in'] and t['rated'] and t['full'] and t['fx'], 'each of the six superstars has a rink kind: six ratings, two puck powers, two checking powers and an ultimate, each with effects the play knows', t)
        check(t['ids'] == t['uniq'] == 120 and t['starIds'] == t['starUniq'] == 30 and t['clash'] == [], 'no power id is shared: not with the engine\'s own, and not among the superstars', t)
        check(sum(t['wyrm'].values()) >= 44 and t['kraken'] == 10, 'the Frost Wyrm is at home on the ice, and the Kraken has the best reflexes in goal', t)

        # ---------- ratings in the Realm ----------
        r = await pg.evaluate("""(() => { const out = []; for (const s of W_STARS.filter(x => x.kind)) { const p = wMakePlayer({ kind: s.kind, n: s.n, lvl: 4, num: s.num, star: s.id }, 'star'), k = wHK.rate(s.kind);
            out.push({ kind: s.kind, st: p.hk && p.hk.st, lv: p.hk.lv, near: wHK.stats.every(x => Math.abs(p.hk[x] - (p.hk.got[x] || 0) - k[x]) <= 1), sum: wHK.stats.reduce((a, x) => a + p.hk[x], 0), base: wHK.stats.reduce((a, x) => a + k[x], 0) }); }
          return out; })()""")
        check(all(x['st'] == 1 and x['lv'] == 4 and x['near'] and x['base'] - 6 <= x['sum'] - 3 <= x['base'] + 6 for x in r), 'a superstar\'s hockey ratings are seeded from their own kind, grown to their level, and marked', r)
        o = await pg.evaluate("""(() => { const s = W_STARS.find(x => x.kind === 'kraken'), p = wMakePlayer({ kind: s.kind, n: s.n, lvl: 3, num: s.num, star: s.id }, 'star'); while (wRoster().length >= W_PARTY.max) WG.roster.pop(); wAddPlayer(p);
          const gob = wHK.rate('goblin'); p.hk = { lv: 3, got: {} }; for (const x of wHK.stats) p.hk[x] = gob[x]; const before = p.hk.ref;
          const save = JSON.parse(JSON.stringify({ WG, RUN })); wStart(save); const q = wRoster().find(x => x.kind === 'kraken'), after = q.hk.ref, st = q.hk.st, snap = JSON.stringify(q.hk);
          const again = wRinkStarFix(q), same = snap === JSON.stringify(q.hk), six = wSixSync(), goalie = wSixWho(six.six.G);
          return { before, after, st, again, same, goalie: goalie && goalie.kind, mine: !!six.mine }; })()""")
        check(o['before'] == 6 and o['after'] >= 9 and o['st'] == 1 and o['again'] is False and o['same'] and o['goalie'] == 'kraken' and not o['mine'],
              'a superstar signed before this (seeded as a goblin) is made again once when the journey loads, not twice, and the coach picks the six again: the Kraken is in goal', o)
        await pg.evaluate(CLOSE_ALL)

        # ---------- on the ice ----------
        g = await pg.evaluate("""(() => { const K = W_STARS.filter(s => s.kind).map(s => s.kind), T = (name, kinds) => ({ name, short: name[0], color: '#3a6ab8', light: '#fff', roster: kinds.map((kind, i) => ({ kind, n: kind + i, num: i + 2 })) });
          const s = wHK.simGame({ seed: 5, teams: [T('Stars', K), T('Bears', ['witch', 'elf', 'goblin', 'ogre', 'troll', 'gorgon'])] }), casts = s.casts.filter(c => c.side === 0).map(c => c.id);
          wHK.start({ seed: 6, teams: [T('Stars', K), T('Bears', ['witch', 'elf', 'goblin', 'ogre', 'troll', 'gorgon'])], mode: 'manage', autoPow: false }); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
          const P = wHK.play, G = wHK.G; wHK.give(0); const opts = wHK.powerOptions(0).map(o => [P.pl[o.i].kind, o.id]), c1 = wHK.cast(0, opts.length ? wHK.powerOptions(0)[0].i : 0); G.spirit[0] = 80; const u = wHK.ultOptions(0), c2 = wHK.castUlt(0, u[0].i);
          wHK.show(); wHK.render(); const drawn = true; wHK.hide();
          return { score: s.score, win: s.win, casts: casts.length, starCasts: casts.filter(id => !['manup', 'killit', 'empty', 'sudden'].includes(id)).length, opts, c1, c2, fxs: wHK.fxs.map(x => x.k), marks: wHK.marks.length, drawn, on: G.teams[0].roster.map(m => m.kind) }; })()""")
        check(g['win'] in (0, 1) and g['starCasts'] >= 1 and len(g['opts']) == 5 and all(o[0] in stars for o in g['opts']) and g['c1'] == '' and g['c2'] == '' and g['fxs'] == ['pow', 'ult'] and g['marks'] == 1 and g['drawn'],
              'a side of superstars plays a game, casts their own powers and an ultimate, and is drawn', g)
        opp = await pg.evaluate("""(() => { const seen = new Set(); for (const c of wBallClubs().concat(Object.keys(CLUBS).slice(0, 6))) for (const tier of [1, 2, 3]) { try { for (const p of wRinkOpp(c, tier).roster) seen.add(p.kind); } catch (e) {} } WG.hkg.opp = {};
          return { kinds: [...seen], cu: W_HKR.cuKinds }; })()""")
        check(len(opp['kinds']) >= 4 and not any(k in stars for k in opp['kinds']) and not any(k in stars for k in opp['cu']), 'the other clubs, and the call-ups, never field a superstar', opp)

        # ---------- the page ----------
        await pg.evaluate("wOpenCamp('rink')"); await pg.wait_for_selector('#wCampBody .wrinksix [data-hpow]')
        tb = await pg.evaluate("""(() => { const C = WG.rink, k = C.six.G, li = document.querySelector(`.wrinksix [data-hid="${k}"]`), K = wHK.pows.kraken;
          return { opts: [...li.querySelectorAll('[data-hpow]')].map(x => [...x.options].map(o => o.textContent)), want: [[K.one[0], K.two[0]], [K.one[1], K.two[1]]].map(pr => pr.map(P => `${P.n} (${P.cost})`)), ult: li.querySelector('.whult').textContent, spot: li.querySelector('.wno').textContent }; })()""")
        check(tb['opts'] == tb['want'] and 'Eight Arms in Every Lane' in tb['ult'] and tb['spot'] == 'G', 'the Rink tab offers a superstar their own two pairs of powers, and names their ultimate', tb)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("""(() => { const el = document.getElementById('wHelpRinkStars'), txt = el ? el.textContent : ''; return { there: !!el, names: W_STARS.filter(s => s.kind && !txt.includes('The ' + s.n)).map(s => s.n), ults: W_STARS.filter(s => s.kind && !txt.includes(wHK.pows[s.kind].ult.n)).map(s => s.n), never: txt.includes('never field one'),
          after: el && el.previousElementSibling && el.previousElementSibling.id }; })()""")
        await pg.evaluate("showPage('play')")
        check(hp['there'] and hp['names'] == [] and hp['ults'] == [] and hp['never'] and hp['after'] == 'wHelpRinkKit', 'How to play has each superstar\'s game on the ice, after hockey\'s gear and potions', hp)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
