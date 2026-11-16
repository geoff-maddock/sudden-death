# Realm rink: ratings, the six and the lines (issue #83, phase 4).
# Every Realm player has hockey ratings (p.hk, 1 to 12), seeded within a point of their kind, a point more a level; an
# older save gets them on load. The six: your players first, call-ups at your level to fill it, the rest on the bench;
# spots swap, the bench reorders, and the coach's pick puts the best reflexes in goal. The Rink tab on the Team screen
# sets it; the Stats tab has a Hockey view and each player's card a Hockey block; Practice game plays your six.
# In the engine: stamina starts full, runs down on the ice (faster for skating fast) and comes back on the bench; a
# spent skater is slower and shoots worse. With a bench the lines change through a game and the bench gets ice time;
# with none nobody comes off. On the fly: a tired skater is sent to the door when it is safe and the next fresh player
# comes on in their spot, your bench in your order and the CPU's by fit; never the puck carrier, never the goalie, and
# not when the other side has the puck in your end. At a whistle everybody tired changes, but not the side that iced
# it. Between periods everyone is fresh. By hand, C sends your tired skaters off now.
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

# two clubs of eight: six and two on the bench (roster indices 6 and 7)
SETUP = """window.__eight = name => ({ name, short: name[0], color: '#3a6ab8', light: '#fff', kinds: ['vampire', 'harpy', 'witch', 'werewolf', 'troll', 'wraith', 'skeleton', 'lich'] });
window.__game = (seed, o) => { wHK.start(Object.assign({ seed, teams: [__eight('Aces'), __eight('Bears')], powers: false }, o || {})); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step(); return wHK.play; };
window.__away = (P, keep) => { P.pl.forEach((p, i) => { if (!keep.includes(i)) { p.x = 2.5; p.y = 8.5 - (i % 6) * .2; p.vx = p.vy = 0; } }); };
window.__put = (P, i, x, y) => { const p = P.pl[i]; p.x = x; p.y = y; p.vx = p.vy = 0; p.stun = 0; p.cd = 0; p.act = ''; return p; }; 0"""

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
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false"); await pg.evaluate(SETUP)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- ratings ----------
        r = await pg.evaluate("""(() => { const R = wRoster(), st = wHK.stats;
          const ok = R.every(p => p.hk && st.every(s => p.hk[s] >= 1 && p.hk[s] <= 12) && p.hk.lv === (p.lvl || 1));
          const near = R.every(p => { const k = wHK.rate(p.kind); return st.every(s => Math.abs(p.hk[s] - (p.hk.got[s] || 0) - k[s]) <= 1); });
          const p = R[0], sum = () => st.reduce((a, s) => a + p.hk[s], 0), lv0 = p.lvl, s0 = sum();
          p.lvl = lv0 + 3; wHkOf(p); const grew = sum() - s0, lv = p.hk.lv; p.lvl = lv0;
          return { n: R.length, ok, near, grew, lv, want: lv0 + 3, st }; })()""")
        check(r['ok'] and r['near'] and r['st'] == ['spd', 'siz', 'hnd', 'sht', 'def', 'ref'], 'every player has hockey ratings (speed, size, hands, shot, defense, reflexes), 1 to 12, seeded within a point of their kind', r)
        check(r['grew'] == 3 and r['lv'] == r['want'], 'each level adds a point', r)
        o = await pg.evaluate("""(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); for (const p of save.WG.roster) delete p.hk; delete save.WG.rink;
          wStart(save); return { all: wRoster().every(p => p.hk && p.hk.lv === (p.lvl || 1)), bk: wRoster().every(p => !!p.bk) }; })()""")
        check(o['all'] and o['bk'], 'an older save\'s players get their hockey ratings when it loads', o)

        # ---------- the six ----------
        s = await pg.evaluate("""(() => { const C = wSixSync(), R = wRoster(), keys = wHK.pos.map(p => C.six[p]);
          const own = keys.filter(k => typeof k !== 'string').length, cus = keys.filter(k => typeof k === 'string').length;
          return { roster: R.length, own, cus, cu: C.cu.length, bench: C.bench.length, distinct: new Set(keys.concat(C.bench)).size === 6 + C.bench.length,
            all: R.every(p => keys.includes(p.id) || C.bench.includes(p.id)), cuRated: C.cu.every(c => c.hk && c.lvl === wNineTier()), json: JSON.stringify(JSON.parse(JSON.stringify(WG.rink))) === JSON.stringify(WG.rink), court: !!WG.court || true }; })()""")
        check(s['own'] == min(6, s['roster']) and s['cus'] == 6 - s['own'] == s['cu'] and s['bench'] == max(0, s['roster'] - 6) and s['distinct'] and s['all'] and s['cuRated'] and s['json'],
              'the six: your players first, call-ups at your level fill it, the rest on the bench, plain JSON', s)
        a = await pg.evaluate("""(() => { const kinds = ['ogre', 'harpy', 'spider', 'lich', 'dwarf', 'gorgon', 'vampire']; let i = 0;
          while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern'));
          const C = wSixSync(), keys = wHK.pos.map(p => C.six[p]);
          return { roster: wRoster().length, cu: C.cu.length, inSix: keys.every(k => typeof k !== 'string'), bench: C.bench.length, mine: !!C.mine }; })()""")
        check(a['roster'] == 8 and a['cu'] == 0 and a['inSix'] and a['bench'] == 2, 'with eight players the six is all yours and two sit on the bench; no call-ups', a)
        ch = await pg.evaluate("""(() => { const C = wSixSync(), c0 = C.six.C, g0 = C.six.G, b0 = C.bench.slice();
          const r1 = wSixSetSpot(c0, 'G'), swap = C.six.G === c0 && C.six.C === g0;
          const lw = C.six.LW; const r2 = wSixSetSpot(b0[1], 'LW'), in2 = C.six.LW === b0[1] && C.bench.includes(lw);
          const out = C.bench.slice(); const r3 = wSixMove(out[1], -1), moved = C.bench[0] === out[1] && C.bench[1] === out[0];
          const first = C.bench[0], k = C.six.RD; const r4 = wSixSetSpot(k, 'bench'), benched = C.bench[0] === k && C.six.RD === first;
          return { r: [r1, r2, r3, r4], swap, in2, moved, benched, mine: !!C.mine }; })()""")
        check(ch['r'] == ['', '', '', ''] and ch['swap'] and ch['in2'] and ch['moved'] and ch['benched'] and ch['mine'],
              'a spot change swaps; a bench player into a spot swaps with whoever had it; the bench reorders; to the bench, the first on it takes the spot', ch)
        au = await pg.evaluate("""(() => { wSixAuto(); const C = WG.rink; const fit = pos => wHK.fit(wHkOf(wSixWho(C.six[pos])), pos);
          const benchFit = pos => Math.max(...C.bench.map(k => wHK.fit(wHkOf(wSixWho(k)), pos))), T = wSixMine();
          return { mine: !!C.mine, gOk: fit('G') >= benchFit('G'), dOk: fit('LD') >= benchFit('LD'), sums: C.bench.map(k => wHK.stats.reduce((a, s) => a + wHkOf(wSixWho(k))[s], 0)),
            team: { n: T.roster.length, spot: T.spot, r: Object.keys(T.roster[0].r), first: T.roster[0].n === wSixWho(C.six.C).n, bench: T.roster[6].n === wSixWho(C.bench[0]).n } }; })()""")
        check(not au['mine'] and au['gOk'] and au['dOk'] and au['sums'] == sorted(au['sums'], reverse=True), 'the coach\'s pick: the goalie and the defenders suit their spots better than the bench would, and the bench is in order of who\'s best', au)
        check(au['team'] == {'n': 8, 'spot': {'C': 0, 'LW': 1, 'RW': 2, 'LD': 3, 'RD': 4, 'G': 5}, 'r': ['spd', 'siz', 'hnd', 'sht', 'def', 'ref'], 'first': True, 'bench': True}, 'your team goes to the engine as the six in spot order, then the bench in your order, with their own ratings', au)

        # ---------- stamina in the engine ----------
        st = await pg.evaluate("""(() => { const P = __game(4), G = wHK.G, R = wHK.staRules; const s0 = wHK.sta(), on0 = G.on[0].slice(), bench0 = wHK.bench(0);
          G.sta[0][6] = .5; wHK.step(30 * 8); const s1 = wHK.sta(); const stayed = on0.slice(0, 5).filter(ri => G.on[0].includes(ri));
          const q = (ri) => s0[0][ri] - s1[0][ri];
          return { start: s0[0].every(v => v === 1), bench0, drop: stayed.map(q), goalie: q(on0[5]), bench: s1[0][6] > .5, R }; })()""")
        check(st['start'] and st['bench0'] == [6, 7] and len(st['drop']) >= 3 and all(d > .05 for d in st['drop']) and st['goalie'] == 0 and st['bench'], 'stamina starts full, runs down for the skaters on the ice, not for the goalie, and comes back on the bench', st)
        td = await pg.evaluate("""(() => { const P = __game(5), G = wHK.G, i = 1, p = P.pl[i]; __away(P, [i]); wHK.loose(38, -9, 0, 0);
          const run = sta => { G.sta[0][p.ri] = sta; __put(P, i, 8, 0); for (let t = 0; t < 45; t++) { G.sta[0][p.ri] = sta; wHK.skate(i, 38, 0); } return p.x - 8; };
          const fresh = run(1), spent = run(.15); const gx = wHK.goalX(0);
          G.sta[0][p.ri] = 1; const q1 = wHK.shotOdds(i, 'wrist', gx - 6, 0); G.sta[0][p.ri] = .15; const q2 = wHK.shotOdds(i, 'wrist', gx - 6, 0);
          return { fresh, spent, q: [q1.q, q2.q], miss: [q1.miss, q2.miss] }; })()""")
        check(td['spent'] < td['fresh'] * .9 and td['q'][1] < td['q'][0] and td['miss'][1] > td['miss'][0], 'a spent skater is slower, and shoots a little worse', td)

        # ---------- the lines through a game ----------
        g = await pg.evaluate("""(() => { let sh = 0, benchSec = 0, n = 0; for (let i = 0; i < 6; i++) { const s = wHK.simGame({ seed: 40 + i, teams: [__eight('Aces'), __eight('Bears')] });
            for (const b of s.box) for (const r of b.rows) { if (r.pos !== 'G' || !r.on) { sh += r.sh; n++; } if (r.ri >= 6) benchSec += r.sec; } }
          const none = wHK.simGame({ seed: 40 }); const one = none.box.every(b => b.rows.every(r => r.sh === 1)), g = wHK.simGame({ seed: 41, teams: [__eight('Aces'), __eight('Bears')] });
          return { shifts: sh / n, benchSec: benchSec / 12, one, goalies: g.box.map(b => b.rows.filter(r => r.sec >= g.secs - 1).length) }; })()""")
        check(g['shifts'] >= 3 and g['benchSec'] > 120 and g['one'], 'with a bench, the lines change through a game and the bench gets ice time; with nobody on it, nobody comes off', g)
        fly = await pg.evaluate("""(() => { const go = (ordered, tiredI, puckSide, puckX, secs) => { const P = __game(7, { ordered: [ordered, false] }), G = wHK.G, p = P.pl[tiredI], was = p.ri;
            __away(P, [tiredI]); __put(P, tiredI, 16, -6); const c = puckSide === 0 ? 0 : 6; __put(P, c, puckX, 4); wHK.give(c); G.sta[0][was] = .2; G.sta[0][6] = .85; G.sta[0][7] = 1;
            let sent = null, n = 0; while (n++ < 30 * (secs || 6) && G.on[0].includes(was)) { wHK.step(); if (!sent && wHK.changing().length) sent = wHK.changing()[0]; if (wHK.phase !== 'live') break; }
            return { sent, came: G.on[0][tiredI], was, off: !G.on[0].includes(was), sh: G.stat[0][G.on[0][tiredI]].sh, kind: P.pl[tiredI].kind === G.teams[0].roster[G.on[0][tiredI]].kind }; };
          const yours = go(true, 1, 0, 30), fit = go(false, 3, 0, 30), unsafe = go(true, 1, 1, 10, .8);
          const P = __game(8, { ordered: [true, false], mode: 'play' }), G = wHK.G; __away(P, [1]); __put(P, 1, 26, 0); wHK.give(1); P.me = 1; G.sta[0][P.pl[1].ri] = .2; wHK.input({ steer: [0, 0] }); wHK.step(30); const carrier = { chg: wHK.changing().some(x => x[0] === 1), on: G.on[0].includes(P.pl[1].ri) };
          G.sta[0][G.on[0][5]] = .1; wHK.step(60); const goalie = G.on[0][5];
          return { yours, fit, unsafe, carrier, goalie }; })()""")
        y = fly['yours']
        check(y['sent'] == [1, 6] and y['off'] and y['came'] == 6 and y['sh'] == 1 and y['kind'], 'on the fly: a tired skater is sent to the door when their side has the puck, and the first fresh player in your order comes on in their spot', fly)
        check(fly['fit']['off'] and fly['fit']['came'] in (6, 7), 'the CPU\'s bench comes on by who suits the spot', fly)
        check(fly['unsafe']['sent'] is None and not fly['unsafe']['off'], 'nobody is sent off in the moment the other side has the puck in your end', fly)
        check(not fly['carrier']['chg'] and fly['carrier']['on'] and fly['goalie'] == 5, 'the puck carrier is not sent off, and the goalie never changes', fly)
        wh = await pg.evaluate("""(() => { const P = __game(9, { mode: 'play', ordered: [true, false], auto: false }), G = wHK.G; for (const s of [0, 1]) for (const i of G.on[s].slice(0, 5)) G.sta[s][i] = .3;
          const on0 = G.on.map(a => a.slice()); __away(P, [3]); __put(P, 3, 8, 6); wHK.give(3); P.me = 3; wHK.input({ steer: [1, 0] }); wHK.input({ pass: true }); wHK.step(10); wHK.input({ pass: false }); wHK.input({ steer: [0, 0] });
          __away(P, []); let n = 0; while (wHK.phase === 'live' && n++ < 90) wHK.puckStep(); const iced = wHK.phase, msg = wHK.msg; n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
          const icing = { iced, msg, same0: JSON.stringify(G.on[0]) === JSON.stringify(on0[0]), changed1: G.on[1].filter(i => i >= 6).length, breather: G.sta[0][on0[0][0]] > .3 };
          G.clock = .05; n = 0; while (wHK.phase !== 'break' && n++ < 400) wHK.step(); const rest = G.sta.every(a => a.every(v => v === 1));
          return { icing, rest }; })()""")
        check(wh['icing']['iced'] == 'dead' and 'may not change' in wh['icing']['msg'] and wh['icing']['same0'] and wh['icing']['changed1'] == 2 and wh['icing']['breather'], 'at a whistle the tired change at once, but not the side that iced it; everyone on the ice gets a breather', wh)
        check(wh['rest'], 'between periods everyone is fresh again', wh)
        hd = await pg.evaluate("""(() => { const P = __game(10, { mode: 'play', ordered: [true, false], auto: false }), G = wHK.G; __away(P, [0, 1, 2]); __put(P, 0, 22, 4); __put(P, 1, 18, -6); __put(P, 2, 20, -5); wHK.give(0); P.me = 0;
          G.sta[0][P.pl[1].ri] = .3; G.sta[0][P.pl[2].ri] = .4; wHK.input({ steer: [0, 0] }); wHK.step(45); const coach = wHK.changing().length;
          const r = wHK.input({ act: 'change' }), going = wHK.changing(); const r2 = wHK.input({ act: 'change' });
          let n = 0; while (wHK.changing().length && n++ < 30 * 6) { wHK.input({ steer: [0, 0] }); wHK.step(); }
          return { auto: wHK.auto, coach, r, going, r2, on: [G.on[0][1], G.on[0][2]].sort() }; })()""")
        check(hd['auto'] is False and hd['coach'] == 0 and hd['r'] == 'change' and sorted(x[0] for x in hd['going']) == [1, 2] and hd['r2'] == '' and hd['on'] == [6, 7], 'by hand (auto off) the coach leaves your lines alone, and C sends your tired skaters off for the bench', hd)

        # ---------- the page ----------
        await pg.evaluate("wOpenCamp('rink')")
        await pg.wait_for_selector('#wCampBody .wrinksix')
        tb = await pg.evaluate("""({ tab: document.querySelector('[data-ctab="rink"]').getAttribute('aria-selected'), court: !!document.querySelector('[data-ctab="court"]'), six: document.querySelectorAll('.wrinksix li').length, bench: document.querySelectorAll('.wrinkbench li').length,
          spots: [...document.querySelectorAll('.wrinksix .wno')].map(x => x.textContent), opts: [...document.querySelector('.wrinksix [data-hspot]').options].map(o => o.value), btns: !!document.querySelector('[data-hauto]') && !!document.querySelector('[data-hpractice]') })""")
        check(tb == {'tab': 'true', 'court': True, 'six': 6, 'bench': 2, 'spots': ['C', 'LW', 'RW', 'LD', 'RD', 'G'], 'opts': ['C', 'LW', 'RW', 'LD', 'RD', 'G', 'bench'], 'btns': True},
              'the Team screen has a Rink tab beside the Court tab: the six by spot, the bench, a spot picker each, the coach\'s pick and Practice game', tb)
        before = await pg.evaluate("[WG.rink.six.C, WG.rink.six.LW]")
        await pg.select_option('.wrinksix li:first-child [data-hspot]', 'LW')
        after = await pg.evaluate("({ six: [WG.rink.six.C, WG.rink.six.LW], mine: !!WG.rink.mine, saved: !!JSON.parse(localStorage.getItem(pkey('sd-realm')) || '{}') })")
        check(after['six'] == before[::-1] and after['mine'], 'changing a spot on the tab swaps the two players, and it is yours from then on', [before, after])
        await pg.click('[data-ctab="stats"]'); await pg.click('[data-wsview="hockey"]')
        sv = await pg.evaluate("({ heads: [...document.querySelectorAll('#wCampBody table.wstats thead th')].map(x => x.textContent.trim()), rows: document.querySelectorAll('#wCampBody table.wstats tbody tr').length })")
        await pg.click('#wCampBody [data-wsp-open]')
        card = await pg.evaluate("({ hk: !!document.querySelector('#wCampBody .whkc'), text: (document.querySelector('#wCampBody .whkc') || {}).textContent || '' })")
        check(sv['heads'] == ['Player', 'Spot', 'GP', 'Min', 'G', 'A', 'Pts', 'SOG', 'Hits', 'Blk', 'PIM', 'FO', 'Sv'] and sv['rows'] == 8 and card['hk'] and 'Hockey' in card['text'] and 'Spd' in card['text'], 'the Stats tab has a Hockey view (each player\'s line from games in the world, w91), and a player\'s card a Hockey block with their ratings', [sv, card])
        await pg.click('[data-ctab="rink"]'); await pg.click('[data-hpractice]')
        await pg.wait_for_function("UI.view === 'rink' && wHK.on && document.getElementById('modal').hidden")
        pr = await pg.evaluate("({ title: document.getElementById('wRinkTitle').textContent, mine: wHK.G.teams[0].name === wPartyTeam().name, n: wHK.G.teams[0].roster.length, ordered: wHK.G.ordered, other: wHK.G.teams[1].name, c: wHK.G.teams[0].roster[0].n === wSixWho(WG.rink.six.C).n })")
        check(pr == {'title': 'A practice game at the Pond Rink', 'mine': True, 'n': 8, 'ordered': [True, False], 'other': 'Cinderhold Hockey Club', 'c': True}, 'Practice game plays your six, with your bench in your order, against Cinderhold', pr)
        await pg.wait_for_function("wHK.phase === 'live' && !document.getElementById('wRinkPad').hidden")
        await pg.evaluate("(() => { wHK.pause(true); const G = wHK.G, P = wHK.play; G.sta[0][P.pl[1].ri] = .3; wHK.give(6); })()")
        await pg.keyboard.press('c'); kc = await pg.evaluate("({ going: wHK.changing().map(x => x[0]), pad: [...document.querySelectorAll('#wRinkPad button')].map(x => x.textContent).includes('Change') })")
        check(kc['going'] == [1] and kc['pad'], 'the C key sends your tired skater off, and the pad has Change', kc)
        await pg.evaluate("showPage('help')"); hp = await pg.evaluate("({ tab: !!document.getElementById('wHelpRinkTab'), how: document.getElementById('wRinkHow').textContent.includes('Stamina and shifts') })"); await pg.evaluate("showPage('play')")
        check(hp == {'tab': True, 'how': True}, 'How to play explains the ratings, the six and the Rink tab, and stamina and shifts', hp)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
