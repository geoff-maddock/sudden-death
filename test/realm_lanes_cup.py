# Realm lanes cup and fixtures (issue #100, phase 9). The Gutter Cup: Moll Gutter's CUP topic opens it; entry costs the
# fee and draws a field of eight (you first, rivals and regional sides). Your quarter-final (Simulate) settles, and back
# in the world the rest of the round is played out on the bowling engine, with pins and a winner every time (no game
# ends level); the semi-final is bowled on the lanes (Manage) and the round catches up when you're back. The final is
# best of three: each game is kept in the series until one side has two, the bracket shows the games won, and a final
# you're not in is a best of three too. Winning the final pays the prize (gold, fans, a pick of cards, a piece of bowling
# gear), the journal and the Wall of Awards. Once a week; lose and the bracket is played to a champion. League fixtures
# at the Saltmere Lanes: your fixture there is a bowling match (Play, Manage or Simulate) that counts on the table, and
# the clubs' matches there get real bowling results. The Lanes tab's and the match card's buttons, How to play, and the
# save. Asserts; exits nonzero on failure.
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

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox #wLanesOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
UNTIL_BRACKET = """(async () => { for (let i = 0; i < 30 && !document.querySelector('#modalBox .wdcb'); i++) {
  if (document.getElementById('modal').hidden) { wDrain(); } else { const b = document.querySelector('#modalBox .card, #modalBox [data-close], #modalBox #wLanesOk, #modalBox .btn, #modalBox button'); if (b) b.click(); }
  await new Promise(r => setTimeout(r, 100)); } return !!document.querySelector('#modalBox .wdcb'); })()"""
CUP = "(() => { const D = WG.lncup; return D && { round: D.round, out: D.out, done: D.done, champ: D.champ, pending: D.pending, field: D.field, games: D.games, ser: D.ser || null }; })()"
FAIR = "(g => Number.isInteger(g.ra) && Number.isInteger(g.rb) && [g.a, g.b].includes(g.w) && ['', 'ro'].includes(g.end) && (g.ra !== g.rb || g.end === 'ro') && (g.w === g.a ? g.ra >= g.rb : g.rb >= g.ra))"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wOpenGutter === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; SET.lanesFrames = 3")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # Moll's CUP; too few players at first
        t = await pg.evaluate("(() => { const K = DB.chars.gk_lanes; return { act: K.topics.cup && K.topics.cup.act, job: /CUP/.test(K.topics.job.t) }; })()")
        check(t == {'act': 'lncup', 'job': True}, 'Moll Gutter runs the Gutter CUP', t)
        off = await pg.evaluate("(() => { const R = WG.roster; WG.roster = R.slice(0, 1); const why = wGutterProblems().join(' '); WG.roster = R; return why; })()")
        check('Recruit' in off, 'with one player of your own you can\'t enter', off)
        await pg.evaluate("(() => { for (const kind of ['elf', 'spider', 'gorgon', 'dwarf']) if (wRoster().length < 6) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); RUN.gold = 500; })()")

        # entry
        await pg.evaluate("wRunAct('lncup')"); await pg.wait_for_selector('#modalBox #wGutterEnter:not([disabled])')
        await pg.click('#wGutterEnter'); await pg.wait_for_selector('#modalBox [data-gutterhow]')
        D = await pg.evaluate(CUP); f = D['field']
        check(len(f) == 8 and len(set(f)) == 8 and f[0] == 'me' and any(x.startswith('wild:') for x in f), 'entry: a field of eight, you first, rivals and regional sides', f)
        check(await pg.evaluate("RUN.gold") == 460, 'the fee is paid')

        # quarter-final: simulate, forced to a win; the Final card, then the bracket
        await pg.evaluate("W_GUTTER.force = 'win'")
        await pg.click('#modalBox [data-gutterhow="sim"]')
        await pg.wait_for_selector('#wLanesOk'); await pg.click('#wLanesOk')
        check(await pg.evaluate(UNTIL_BRACKET), 'after the Final card, the bracket shows')
        D = await pg.evaluate(CUP); qf = D['games'][0]
        check(D['round'] == 1 and not D['pending'] and len(qf) == 4 and qf[0]['w'] == 'me', 'the quarter-final: yours settles, and the rest of the round is played out', qf)
        fair = await pg.evaluate(f"WG.lncup.games[0].slice(1).every({FAIR})")
        check(fair, 'no game ends level: every one has a winner, by pins (or a roll-off)', qf[1:])

        # semi-final: on the lanes, managed
        await pg.evaluate("W_GUTTER.force = 'win'")
        await pg.click('#modalBox [data-gutterhow="manage"]')
        await pg.wait_for_function("UI.view === 'lanes' && WG.lng.live && WG.lng.live.world.kind === 'lncup'", timeout=15000)
        sm = await pg.evaluate("({ tier: WG.lng.live.world.tier, mode: wBL.mode, cup: WG.lng.live.world.cup })")
        check(sm == {'tier': 2, 'mode': 'manage', 'cup': True}, 'the semi-final is tier 2 (a Knight), bowled on the lanes', sm)
        await pg.evaluate("(() => { wBL.pause(true); let i = 0; while (wLanesLive() && i++ < 60000) wBL.tick(0.05); })()")
        await pg.click('#wLanesBack')
        check(await pg.evaluate(UNTIL_BRACKET), 'back in the world, the bracket shows')
        D = await pg.evaluate(CUP)
        check(D['round'] == 2 and len(D['games'][1]) == 2 and D['games'][1][0]['w'] == 'me', 'the semi-finals are in: on to the final', D['games'][1])
        sv = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(wSaveKey())); return s.WG.lncup && s.WG.lncup.round; })()")
        check(sv == 2, 'the cup is in the save', sv)
        await pg.evaluate(CLOSE_ALL)

        # the final: best of three, game by game
        g0 = await pg.evaluate("RUN.gold")
        await pg.evaluate("(() => { window.__offers = []; const o = wCardOffer; wCardOffer = function (spec) { __offers.push(spec); return o.apply(this, arguments); }; })()")
        s1 = await pg.evaluate("""(() => { wGutterPlay('sim'); const D = WG.lncup; return { round: D.round, row: D.games[2].length, ser: D.ser && D.ser.gs.length, show: D.show }; })()""")
        await pg.evaluate(CLOSE_ALL)
        check(s1 == {'round': 2, 'row': 0, 'ser': 1, 'show': True}, 'game 1 of the final is kept in the series, and the match goes on', s1)
        card = await pg.evaluate("(() => { wOpenGutter(); const t = document.getElementById('modalBox').textContent; return { two: t.includes('game 2'), btn: !!document.querySelector('#modalBox [data-gutterhow]') }; })()")
        check(card['two'] and card['btn'], 'the card offers game 2, with the series so far', card)
        await pg.evaluate(CLOSE_ALL)
        fin = await pg.evaluate("""(() => { let n = 0; while (!WG.lncup.games[2].length && n++ < 3) { wGutterPlay('sim'); for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) { const b = document.querySelector('#modalBox [data-close], #modalBox #wLanesOk, #modalBox .btn'); if (!b) break; b.click(); } WG.cardOffer = null; }
          const D = WG.lncup; wGutterCatchUp(); const g = D.games[2][0]; return { n: n + 1, g, done: D.done, champ: D.champ, ser: D.ser || null }; })()""")
        g = fin['g']
        check(g and max(g['ra'], g['rb']) == 2 and g['ra'] + g['rb'] == len(g['gs']) and 2 <= len(g['gs']) <= 3 and fin['done'] and fin['ser'] is None and fin['champ'] == g['w'],
              'the final ends when one side has two games; the bracket shows the games won, and each game\'s pins', fin)
        await pg.evaluate(CLOSE_ALL)

        # a final you are not in is a best of three too
        o = await pg.evaluate("(() => { const s = wGutterSim('wild:' + Object.keys(W_WILD_TEAM)[0], 'wild:' + Object.keys(W_WILD_TEAM)[1], 2, 2), q = wGutterSim('wild:' + Object.keys(W_WILD_TEAM)[0], 'wild:' + Object.keys(W_WILD_TEAM)[1], 2, 1); return { s, q }; })()")
        check(max(o['s']['ra'], o['s']['rb']) == 2 and len(o['s']['gs']) in (2, 3) and o['q']['ra'] > 50 and 'gs' not in o['q'], 'a final between two others is best of three; an earlier round is one game, in pins', o)

        # a new week: won outright
        await pg.evaluate("WG.dayAbs += 7; WG.day += 7; WG.lng.met = {}")
        g0 = await pg.evaluate("RUN.gold")
        have = await pg.evaluate("W_LANES_CUP.gear.filter(id => (WG.items[id] || 0) > 0)")
        await pg.evaluate("""(() => { wGutterEnter(); for (let r = 0; r < 3; r++) { W_GUTTER.force = 'win'; wGutterPlay('sim'); WG.cardOffer = null; wGutterCatchUp(); WG.cardOffer = null; } })()""")
        await pg.evaluate(CLOSE_ALL)
        D = await pg.evaluate(CUP)
        won = await pg.evaluate("({ wins: WG.lncupWins, journal: wJ().wins.map(w => w.t) })")
        check(D['champ'] == 'me' and won['wins'] >= 1 and await pg.evaluate("RUN.gold") - g0 + 40 >= 150, 'win the final: the Gutter Cup, and its gold', [D['champ'], won])
        offers = await pg.evaluate("__offers.map(o => ({ pick: o.pick }))")
        check(any(o['pick'] == 3 for o in offers), 'the prize includes a pick of 3 cards', offers)
        check('Won the Gutter Cup' in won['journal'], 'it goes in the journal', won['journal'])
        gear = await pg.evaluate("W_LANES_CUP.gear.filter(id => (WG.items[id] || 0) > 0)")
        check(len(gear) == len(have) + 1, 'and a piece of bowling gear you did not have', [have, gear])
        wall = await pg.evaluate("(() => { wWallText(); return WLOG.slice(-3).map(l => l[0]).join(' '); })()")
        check('Gutter Cup' in wall, 'and on the Wall of Awards', wall)
        check('once a week' in await pg.evaluate("wGutterEnter()"), 'the next cup is next week')

        # another week: lose, and the rest is played to a champion
        await pg.evaluate("WG.dayAbs += 7; WG.day += 7; WG.lng.met = {}")
        await pg.evaluate("wGutterEnter(); W_GUTTER.force = 'lose'; wGutterPlay('sim')")
        await pg.evaluate(CLOSE_ALL); await pg.evaluate("wDrain()")
        await pg.wait_for_function("WG.lncup.done", timeout=60000)
        D = await pg.evaluate(CUP)
        check(D['out'] and D['done'] and D['champ'] != 'me' and len(D['games'][2]) == 1 and len(D['games'][1]) == 2 and len(D['games'][2][0].get('gs', [])) in (2, 3), 'lose, and the rest of the bracket is played to a champion, the final best of three', D)
        await pg.evaluate(CLOSE_ALL)

        # ---------- league fixtures at the Saltmere Lanes ----------
        fx = await pg.evaluate("""(() => { const F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me'); f.g = 'g_lanes'; f.done = 0; wSave();
          wOpenGrdCard('g_lanes'); const hows = [...document.querySelectorAll('#modalBox [data-lnfixhow]')].map(b => b.dataset.lnfixhow);
          return { hows, text: document.getElementById('modalBox').textContent.includes('Bowled on the lanes with your five') }; })()""")
        check(fx['hows'] == ['play', 'manage', 'sim'] and fx['text'], 'your fixture at the Lanes is a bowling match: Play, Manage or Simulate', fx)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("""(() => { const L = wLeague(), me0 = L.me.w + L.me.l; const r = wLnfixPlay('sim'); const g = WG.lng.games[0], F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me');
          return { r, res: g.r, done: !!f.done, top: L.results[0], me: L.me.w + L.me.l - me0 }; })()""")
        top = r['top'] or {}
        check(r['r'] == '' and r['res'] in ('win', 'lose') and r['done'] and r['me'] == 1 and top.get('sport') == 'bowling' and top.get('g') == 'g_lanes', 'Simulate the fixture: it counts once on the table, as bowling at the Lanes', r)
        await pg.evaluate(CLOSE_ALL)
        c = await pg.evaluate("""(() => { const cl = wLeagueClubs(), L = wLeague(), a = cl[0], b = cl[1], w0 = L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l;
          let sims = 0; const sim0 = wBL.simGame; wBL.simGame = o => { sims++; return sim0(o); };
          wLanesOpp(a, 3); const mine = JSON.stringify(WG.lng.opp[a]);
          const res = wSimAt(a, b, 'g_lanes'); wBL.simGame = sim0; res.sims = sims; res.kept = JSON.stringify(WG.lng.opp[a]) === mine; const other = wSimAt(a, b, 'g_links'); return { res, other: other.sport, played: L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l - w0 }; })()""")
        check(c['res']['sport'] == 'bowling' and c['res']['sa'] >= c['res']['sb'] and c['played'] == 4 and c['res']['sims'] == 1 and c['res']['kept'] and c['other'] == 'golf',
              'the clubs\' fixtures at the Lanes are played on the bowling engine, and a rival\'s five for its matches against you is left alone; the Links\' are still golf', c)

        bt = await pg.evaluate("""(() => { wOpenCamp('lanes'); const tab = !!document.querySelector('#wCampBody [data-lncup]'); WCAMP.close();
          wOpenLanesCard(); const card = !!document.querySelector('#modalBox [data-lncup]'); return { tab, card }; })()""")
        check(bt['tab'] and bt['card'], 'the Lanes tab and the match card have a Gutter Cup button', bt)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const t = (document.getElementById('wHelpLanesCup') || {}).textContent || ''; return ['Gutter Cup', 'CUP', 'best of three', 'roll-off', 'League fixtures'].map(s => t.includes(s)); })()")
        check(all(hp), 'How to play explains the Gutter Cup and the fixtures at the Lanes', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
