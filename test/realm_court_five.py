# Realm court, ratings and the five (issue #77, phase 3). Every Realm player has basketball ratings (p.bk), seeded within
# a point of their kind and grown a point a level, and an older save's players get them on load. The five: your players
# first, call-ups at your level fill it when the roster is short, a new player takes a call-up's spot or the end of the
# bench; a spot change swaps, the bench goes in order and can be reordered, the coach's pick. In the engine: stamina
# drains on the floor (more for hard running and moves; scaled to the length) and comes back on the bench and at
# stoppages; a tired player is slower and shoots worse; the coaches sub tired players at stoppages, yours in your bench
# order; rested starters come back at breaks; a swap by hand only at a stoppage; a foul-out brings on your next in line.
# Ratings matter: a side several points better wins most games. In the Realm: the Court tab, a practice game with your
# five, the Basketball view on the Stats tab, the Basketball block on a player's stats, stamina in the box score, and How
# to play. Asserts; exits nonzero on failure. Screenshot: /tmp/realm-court-five.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:700]))
    if not ok: FAILS.append(what)
    return ok

SEVEN = "(r) => ({ name: r.name, kinds: ['goblin', 'elf', 'werewolf', 'minotaur', 'troll', 'kobold', 'zombie'] })"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- ratings ----------
        r = await pg.evaluate("""(() => { const R = wRoster(), st = wBK.stats;
          const ok = R.every(p => p.bk && st.every(s => p.bk[s] >= 1 && p.bk[s] <= 12) && p.bk.lv === (p.lvl || 1));
          const near = R.every(p => { const k = wBK.rate(p.kind); return st.every(s => Math.abs(p.bk[s] - (p.bk.got[s] || 0) - k[s]) <= 1); });
          const p = R[0], sum = () => st.reduce((a, s) => a + p.bk[s], 0), lv0 = p.lvl, s0 = sum();
          p.lvl = lv0 + 3; wBkOf(p); const grew = sum() - s0, lv = p.bk.lv; p.lvl = lv0;
          return { n: R.length, ok, near, grew, lv, want: lv0 + 3 }; })()""")
        check(r['ok'] and r['near'], 'every player has basketball ratings, 1 to 12, seeded within a point of their kind', r)
        check(r['grew'] == 3 and r['lv'] == r['want'], 'each level adds a point', r)
        o = await pg.evaluate("""(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); for (const p of save.WG.roster) delete p.bk; delete save.WG.court;
          wStart(save); return { all: wRoster().every(p => p.bk && p.bk.lv === (p.lvl || 1)) }; })()""")
        check(o['all'], 'an older save\'s players get their basketball ratings when it loads', o)

        # ---------- the five ----------
        s = await pg.evaluate("""(() => { const C = wCourtSync(), R = wRoster(), keys = wBK.pos.map(p => C.five[p]);
          const own = keys.filter(k => typeof k !== 'string').length, cus = keys.filter(k => typeof k === 'string').length;
          return { roster: R.length, own, cus, cu: C.cu.length, bench: C.bench.length, distinct: new Set(keys.concat(C.bench)).size === 5 + C.bench.length,
            all: R.every(p => keys.includes(p.id) || C.bench.includes(p.id)), cuRated: C.cu.every(c => c.bk && c.lvl === wNineTier()), json: JSON.stringify(JSON.parse(JSON.stringify(WG.court))) === JSON.stringify(WG.court) }; })()""")
        check(s['own'] == min(5, s['roster']) and s['cus'] == 5 - s['own'] == s['cu'] and s['bench'] == max(0, s['roster'] - 5) and s['distinct'] and s['all'] and s['cuRated'] and s['json'],
              'the five: your players first, call-ups at your level fill it, the rest on the bench, plain JSON', s)
        # fill the roster to eight: new players take the call-ups' spots, then go to the bench
        a = await pg.evaluate("""(() => { const kinds = ['ogre', 'harpy', 'spider', 'lich', 'dwarf', 'gorgon', 'vampire']; const added = [];
          while (wRoster().length < W_PARTY.max) added.push(wAddPlayer(wMakePlayer({ kind: kinds[added.length], lvl: 2 }, 'tavern')).id || wRoster()[wRoster().length - 1].id);
          const C = wCourtSync(), keys = wBK.pos.map(p => C.five[p]);
          return { roster: wRoster().length, cu: C.cu.length, inFive: keys.every(k => typeof k !== 'string'), bench: C.bench.length, mine: !!C.mine }; })()""")
        check(a['roster'] == 8 and a['cu'] == 0 and a['inFive'] and a['bench'] == 3, 'with eight players the five is all yours and three sit on the bench; no call-ups', a)
        ch = await pg.evaluate("""(() => { const C = wCourtSync(), pg0 = C.five.PG, c0 = C.five.C, b0 = C.bench.slice();
          const r1 = wCourtSetSpot(pg0, 'C'), swap = C.five.C === pg0 && C.five.PG === c0;
          const r2 = wCourtSetSpot(b0[1], 'SG'), sg = C.five.SG === b0[1];
          const out = C.bench.slice(); const r3 = wCourtMove(out[2], -1), moved = C.bench[1] === out[2] && C.bench[2] === out[1];
          const first = C.bench[0], k = C.five.SF; const r4 = wCourtSetSpot(k, 'bench'), benched = C.bench[0] === k && C.five.SF === first;
          return { r: [r1, r2, r3, r4], swap, sg, moved, benched, mine: !!C.mine }; })()""")
        check(ch['r'] == ['', '', '', ''] and ch['swap'] and ch['sg'] and ch['moved'] and ch['benched'] and ch['mine'],
              'a spot change swaps; a bench player into a spot swaps with whoever had it; the bench reorders; to the bench, the first on it takes the spot', ch)
        au = await pg.evaluate("""(() => { wCourtAuto(); const C = WG.court; const fit = pos => wBK.fit(wBkOf(wCourtWho(C.five[pos])), pos);
          const benchFit = pos => Math.max(...C.bench.map(k => wBK.fit(wBkOf(wCourtWho(k)), pos)));
          return { mine: !!C.mine, cOk: fit('C') >= benchFit('C'), pgOk: fit('PG') >= benchFit('PG'), sums: C.bench.map(k => wBK.stats.reduce((a, s) => a + wBkOf(wCourtWho(k))[s], 0)) }; })()""")
        check(not au['mine'] and au['cOk'] and au['pgOk'] and au['sums'] == sorted(au['sums'], reverse=True), 'the coach\'s pick: the five suit their spots better than the bench would, and the bench is in order of who\'s best', au)

        # ---------- stamina and the bench in the engine ----------
        st = await pg.evaluate(f"""(() => {{ const T = [({SEVEN})({{ name: 'A' }}), ({SEVEN})({{ name: 'B' }})];
          wBK.start({{ teams: T, seed: 4 }}); let n = 0; while (wBK.phase !== 'live' && n++ < 300) wBK.step();
          const s0 = wBK.stam(), on0 = wBK.onFloor(); wBK.step(30 * 20); const s1 = wBK.stam(), on1 = wBK.onFloor();
          const onDrop = on0[0].filter(ri => on1[0].includes(ri)).map(ri => s0[0][ri] - s1[0][ri]), benchSame = [5, 6].every(ri => s1[0][ri] >= s0[0][ri]);
          return {{ onDrop, benchSame, start: s0[0][0] }}; }})()""")
        check(st['start'] == 100 and all(d > 2 for d in st['onDrop']) and st['benchSame'], 'stamina starts full, drains for the five on the floor, and the bench keeps theirs', st)
        td = await pg.evaluate("""(() => { wBK.start({ seed: 6 }); let n = 0; while (wBK.phase !== 'live' && n++ < 300) wBK.step();
          const P = wBK.play, i = P.pl.findIndex(p => p.side === wBK.G.poss && p.pos === 'SF'), G = wBK.G, x = wBK.hoopX(G.poss) - wBK.dir(G.poss) * 5;
          const fresh = { p: wBK.shotP(i, x, 0).p, t: wBK.tired(i) }; G.stam[P.pl[i].side][P.pl[i].ri] = 5; const tired = { p: wBK.shotP(i, x, 0).p, t: wBK.tired(i) };
          return { fresh, tired }; })()""")
        check(td['fresh']['t'] == 0 and td['tired']['t'] > .8 and td['tired']['p'] < td['fresh']['p'] - .06, 'a spent player shoots worse (and is slower): tired runs from 0 to 1', td)
        sb = await pg.evaluate(f"""(() => {{ const T = [({SEVEN})({{ name: 'A' }}), ({SEVEN})({{ name: 'B' }})]; let subs = 0, bench = 0, back = 0;
          for (let i = 0; i < 6; i++) {{ const s = wBK.simGame({{ teams: T, seed: 40 + i }}); subs += s.subs[0] + s.subs[1]; bench += s.box[0].rows.filter(r => r.ri >= 5).reduce((a, r) => a + r.sec, 0); }}
          const none = wBK.simGame({{ seed: 40 }}).subs;
          return {{ subs: subs / 6, bench: bench / 6, none }}; }})()""")
        check(sb['subs'] >= 3 and sb['bench'] > 60 and sb['none'] == [0, 0], 'with a bench, the coaches sub tired players in CPU games; with none, nobody comes off', sb)
        od = await pg.evaluate(f"""(() => {{ const T = [({SEVEN})({{ name: 'A' }}), ({SEVEN})({{ name: 'B' }})];
          wBK.start({{ teams: T, seed: 8, mode: 'play' }}); let n = 0; while (wBK.phase !== 'live' && n++ < 300) wBK.step();
          const G = wBK.G, livesub = wBK.sub(0, G.on[0][0], 5);
          // tire the point guard, and let the next dead ball come: the coach brings on your first on the bench (5), not the 'best fit'
          G.stam[0][G.on[0][0]] = 20; const pg = G.on[0][0]; n = 0; while (wBK.phase !== 'dead' && wBK.phase !== 'break' && n++ < 30 * 60) wBK.step();
          const came = G.on[0][0], order = came === 5;
          return {{ livesub, came, order, pg, phase: wBK.phase, note: (wBK.G && true) }}; }})()""")
        check(od['livesub'] != '' and od['order'], 'a swap by hand only at a stoppage; the coach brings your first on the bench on for a tired player', od)
        hs = await pg.evaluate(f"""(() => {{ const T = [({SEVEN})({{ name: 'A' }}), ({SEVEN})({{ name: 'B' }})]; wBK.start({{ teams: T, seed: 9 }});
          const G = wBK.G, out = G.on[0][2], r = wBK.sub(0, out, 6); return {{ r, on: G.on[0][2], ph: wBK.phase }}; }})()""")
        check(hs == {'r': '', 'on': 6, 'ph': 'intro'}, 'at a stoppage a swap by hand puts the bench player in that spot', hs)
        # a swap by hand stays: the coach doesn't put the old starter back at the next break
        kb = await pg.evaluate(f"""(() => {{ const T = [({SEVEN})({{ name: 'A' }}), ({SEVEN})({{ name: 'B' }})]; wBK.start({{ teams: T, seed: 12 }});
          const G = wBK.G, out = G.on[0][1]; wBK.sub(0, out, 5); let n = 0; while (G.q < 2 && n++ < 30 * 400) wBK.step(); while (wBK.phase !== 'break' && wBK.phase !== 'walk' && wBK.phase !== 'live' && n++ < 30 * 400) wBK.step();
          return {{ q: G.q, still: G.on[0][1] === 5 || G.stam[0][5] < wBK.stamRules.sub, starter: G.starters[0][1] }}; }})()""")
        check(kb['q'] >= 2 and kb['still'] and kb['starter'] == 5, 'a swap by hand makes that player the starter at that spot, so the next break doesn\'t undo it', kb)
        # your bench order holds in Watch too (ordered), the CPU's by fit
        ow = await pg.evaluate(f"""(() => {{ const T = [({SEVEN})({{ name: 'A' }}), ({SEVEN})({{ name: 'B' }})]; wBK.start({{ teams: T, seed: 13, mode: 'watch', ordered: [true, false] }});
          let n = 0; while (wBK.phase !== 'live' && n++ < 300) wBK.step(); const G = wBK.G; G.stam[0][G.on[0][4]] = 10; G.stam[0][5] = 90; G.stam[0][6] = 100;
          while (wBK.phase !== 'dead' && wBK.phase !== 'break' && n++ < 30 * 90) wBK.step(); return {{ c: G.on[0][4] }}; }})()""")
        check(ow['c'] == 5, 'with an ordered bench the coach brings on the first in line even in Watch', ow)
        rt = await pg.evaluate("""(() => { const mk = d => ({ name: 'X', roster: ['goblin', 'elf', 'werewolf', 'minotaur', 'troll'].map(k => { const r = wBK.rate(k); for (const s of wBK.stats) r[s] = Math.max(1, Math.min(12, r[s] + d)); return { n: k + d, kind: k, r }; }) });
          let w = 0; for (let i = 0; i < 20; i++) { const s = wBK.simGame({ teams: [mk(3), mk(0)], seed: 500 + i }); if (s.win === 0) w++; } return w; })()""")
        check(rt >= 15, 'ratings matter: a side three points better everywhere wins most games', rt)

        # ---------- the Realm ----------
        await pg.evaluate("wOpenCamp('court')"); await pg.wait_for_selector('#modalBox .wcourt')
        ct = await pg.evaluate("""({ five: document.querySelectorAll('#modalBox .wcourt > li').length, bench: document.querySelectorAll('#modalBox .wcourtb > li').length,
          sel: document.querySelectorAll('#modalBox [data-kspot]').length, prac: !!document.querySelector('#modalBox [data-kpractice]') })""")
        check(ct == {'five': 5, 'bench': 3, 'sel': 8, 'prac': True}, 'the Court tab: the five and the bench, a spot for each, and a practice game', ct)
        k = await pg.evaluate("""(() => { const C = WG.court, b0 = C.bench[0]; const row = document.querySelector(`#modalBox [data-kid="${b0}"]`); const s = row.querySelector('[data-kspot]'); s.value = 'PG'; s.dispatchEvent(new Event('change')); return { pg: WG.court.five.PG === b0, mine: !!WG.court.mine }; })()""")
        check(k == {'pg': True, 'mine': True}, 'picking a spot on the Court tab puts the player there', k)
        await pg.screenshot(path='/tmp/realm-court-five.png')
        await pg.click('#modalBox [data-kpractice]')
        await pg.wait_for_function("UI.view === 'court' && wBK.on")
        pr = await pg.evaluate("""(() => { const C = WG.court, names = wBK.pos.map(p => wCourtWho(C.five[p]).n).concat(C.bench.map(k => wCourtWho(k).n));
          return { mine: wBK.G.teams[0].roster.map(m => m.n).join() === names.join(), title: document.getElementById('wCourtTitle').textContent, bench: wBK.bench(0).length, sta: !!document.querySelector('#wCourtBox th[title^="Stamina"]') }; })()""")
        check(pr['mine'] and 'practice' in pr['title'] and pr['bench'] == 3 and pr['sta'], 'Practice game plays your five with your bench, and the box score shows stamina', pr)
        await pg.click('#wCourtAgain')
        ag = await pg.evaluate("({ title: document.getElementById('wCourtTitle').textContent, mine: wBK.G.teams[0].roster[0].n === wCourtWho(WG.court.five.PG).n, how: WBK.how, ordered: wBK.G.ordered })")
        check('practice' in ag['title'] and ag['mine'] and ag['how'] == 'practice' and ag['ordered'] == [True, False], 'Another game after a practice game is another practice game, with your five and your bench order', ag)
        await pg.click('#wCourtBack')
        await pg.evaluate("WSTAT.view = 'basketball'; wOpenCamp('stats')")
        await pg.wait_for_selector('#modalBox [data-wsview="basketball"]')
        sv = await pg.evaluate("""(() => { const p = wRoster()[0]; return { rows: document.querySelectorAll('#modalBox table.wstats tbody tr').length, head: [...document.querySelectorAll('#modalBox table.wstats thead th')].map(t => t.textContent.trim()), card: wStatsCard(p).includes('<h5>Basketball</h5>') }; })()""")
        check(sv['rows'] == 8 and 'Spot' in sv['head'] and 'Tch' in sv['head'] and sv['card'], 'the Stats tab has a Basketball view (ratings and spots), and a player\'s stats a Basketball block', sv)
        await pg.evaluate("WCAMP.close && WCAMP.close(); showPage('help')")
        hp = await pg.evaluate("(() => { const h = document.getElementById('wHelpCourtTab'); return !!h && /Court tab/.test(h.textContent) && /stamina/.test(h.textContent); })()")
        check(hp, 'How to play explains the ratings, the Court tab and stamina', hp)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
