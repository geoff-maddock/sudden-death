# Realm shed cup and fixtures (issue #102, phase 9). The Brass Broom: Brush Hennock's CUP topic opens it; entry costs
# the fee and draws a field of eight (you first, rivals and regional sides). Your quarter-final (Simulate) settles, and
# back in the world the rest of the round is played out on the curling engine, with points and a winner every time (no
# game ends level: an extra end); the semi-final is curled on the ice (Manage, tier 2) and the round catches up when
# you're back. Winning the final pays the prize (gold, fans, a pick of cards, a piece of curling gear), the journal and
# the Wall of Awards. Once a week; lose and the bracket is played to a champion. League fixtures at the Curling Shed:
# your fixture there is a curling match (Play, Manage or Simulate) that counts on the table, and the clubs' matches
# there get real curling results. The Shed tab's and the match card's buttons, How to play, and the save. Asserts;
# exits nonzero on failure.
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
  const b = document.querySelector('#modalBox [data-close], #modalBox #wShedOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
UNTIL_BRACKET = """(async () => { for (let i = 0; i < 30 && !document.querySelector('#modalBox .wdcb'); i++) {
  if (document.getElementById('modal').hidden) { wDrain(); } else { const b = document.querySelector('#modalBox .card, #modalBox [data-close], #modalBox #wShedOk, #modalBox .btn, #modalBox button'); if (b) b.click(); }
  await new Promise(r => setTimeout(r, 100)); } return !!document.querySelector('#modalBox .wdcb'); })()"""
CUP = "(() => { const D = WG.crcup; return D && { round: D.round, out: D.out, done: D.done, champ: D.champ, pending: D.pending, field: D.field, games: D.games }; })()"
FAIR = "(g => Number.isInteger(g.ra) && Number.isInteger(g.rb) && [g.a, g.b].includes(g.w) && ['', 'xe'].includes(g.end) && g.ra !== g.rb && (g.w === g.a ? g.ra > g.rb : g.rb > g.ra))"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wOpenBroom === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; SET.shedEnds = 4")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        t = await pg.evaluate("(() => { const K = DB.chars.gk_shed; return { act: K.topics.cup && K.topics.cup.act, job: /CUP/.test(K.topics.job.t) }; })()")
        check(t == {'act': 'crcup', 'job': True}, 'Brush Hennock runs the Brass Broom CUP', t)
        off = await pg.evaluate("(() => { const R = WG.roster; WG.roster = R.slice(0, 1); const why = wBroomProblems().join(' '); WG.roster = R; return why; })()")
        check('Recruit' in off, 'with one player of your own you can\'t enter', off)
        await pg.evaluate("(() => { for (const kind of ['elf', 'spider', 'gorgon', 'dwarf']) if (wRoster().length < 6) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); RUN.gold = 500; })()")

        await pg.evaluate("wRunAct('crcup')"); await pg.wait_for_selector('#modalBox #wBroomEnter:not([disabled])')
        await pg.click('#wBroomEnter'); await pg.wait_for_selector('#modalBox [data-broomhow]')
        D = await pg.evaluate(CUP); f = D['field']
        check(len(f) == 8 and len(set(f)) == 8 and f[0] == 'me' and any(x.startswith('wild:') for x in f), 'entry: a field of eight, you first, rivals and regional sides', f)
        check(await pg.evaluate("RUN.gold") == 460, 'the fee is paid')

        await pg.evaluate("W_BROOM.force = 'win'")
        await pg.click('#modalBox [data-broomhow="sim"]')
        await pg.wait_for_selector('#wShedOk'); await pg.click('#wShedOk')
        check(await pg.evaluate(UNTIL_BRACKET), 'after the Final card, the bracket shows')
        D = await pg.evaluate(CUP); qf = D['games'][0]
        check(D['round'] == 1 and not D['pending'] and len(qf) == 4 and qf[0]['w'] == 'me', 'the quarter-final: yours settles, and the rest of the round is played out', qf)
        fair = await pg.evaluate(f"WG.crcup.games[0].slice(1).every({FAIR})")
        check(fair, 'no game ends level: every one has a winner, by points (an extra end if need be)', qf[1:])

        await pg.evaluate("W_BROOM.force = 'win'")
        await pg.click('#modalBox [data-broomhow="manage"]')
        await pg.wait_for_function("UI.view === 'shed' && WG.shg.live && WG.shg.live.world.kind === 'crcup'", timeout=15000)
        sm = await pg.evaluate("({ tier: WG.shg.live.world.tier, mode: wCR.mode, cup: WG.shg.live.world.cup, bag: !!wCR.G.bags[1] })")
        check(sm == {'tier': 2, 'mode': 'manage', 'cup': True, 'bag': True}, 'the semi-final is tier 2 (a Knight), curled on the ice, and they bring their bag', sm)
        await pg.evaluate("(() => { wCR.pause(true); let i = 0; while (wShedLive() && i++ < 80000) wCR.tick(0.1); })()")
        await pg.click('#wShedBack')
        check(await pg.evaluate(UNTIL_BRACKET), 'back in the world, the bracket shows')
        D = await pg.evaluate(CUP)
        check(D['round'] == 2 and len(D['games'][1]) == 2 and D['games'][1][0]['w'] == 'me', 'the semi-finals are in: on to the final', D['games'][1])
        sv = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(wSaveKey())); return s.WG.crcup && s.WG.crcup.round; })()")
        check(sv == 2, 'the cup is in the save', sv)
        await pg.evaluate(CLOSE_ALL)

        await pg.evaluate("(() => { window.__offers = []; const o = wCardOffer; wCardOffer = function (spec) { __offers.push(spec); return o.apply(this, arguments); }; })()")
        g0 = await pg.evaluate("RUN.gold")
        have = await pg.evaluate("W_SHED_CUP.gear.filter(id => (WG.items[id] || 0) > 0)")
        await pg.evaluate("(() => { W_BROOM.force = 'win'; wBroomPlay('sim'); WG.cardOffer = null; wBroomCatchUp(); WG.cardOffer = null; })()")
        await pg.evaluate(CLOSE_ALL)
        D = await pg.evaluate(CUP)
        won = await pg.evaluate("({ wins: WG.crcupWins, journal: wJ().wins.map(w => w.t) })")
        check(D['champ'] == 'me' and D['done'] and won['wins'] == 1 and await pg.evaluate("RUN.gold") - g0 >= 150, 'win the final: the Brass Broom, and its gold', [D['champ'], won])
        offers = await pg.evaluate("__offers.map(o => ({ pick: o.pick }))")
        check(any(o['pick'] == 3 for o in offers), 'the prize includes a pick of 3 cards', offers)
        check('Won the Brass Broom' in won['journal'], 'it goes in the journal', won['journal'])
        gear = await pg.evaluate("W_SHED_CUP.gear.filter(id => (WG.items[id] || 0) > 0)")
        check(len(gear) == len(have) + 1, 'and a piece of curling gear you did not have', [have, gear])
        wall = await pg.evaluate("(() => { wWallText(); return WLOG.slice(-3).map(l => l[0]).join(' '); })()")
        check('Brass Broom' in wall, 'and on the Wall of Awards', wall)
        check('once a week' in await pg.evaluate("wBroomEnter()"), 'the next cup is next week')

        await pg.evaluate("WG.dayAbs += 7; WG.day += 7; WG.shg.met = {}")
        await pg.evaluate("wBroomEnter(); W_BROOM.force = 'lose'; wBroomPlay('sim')")
        await pg.evaluate(CLOSE_ALL); await pg.evaluate("wDrain()")
        await pg.wait_for_function("WG.crcup.done", timeout=60000)
        D = await pg.evaluate(CUP)
        check(D['out'] and D['done'] and D['champ'] != 'me' and len(D['games'][2]) == 1 and len(D['games'][1]) == 2, 'lose, and the rest of the bracket is played to a champion', D)
        await pg.evaluate(CLOSE_ALL)

        # ---------- league fixtures at the Curling Shed ----------
        fx = await pg.evaluate("""(() => { const F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me'); f.g = 'g_shed'; f.done = 0; wSave();
          wOpenGrdCard('g_shed'); const hows = [...document.querySelectorAll('#modalBox [data-crfixhow]')].map(b => b.dataset.crfixhow);
          return { hows, text: document.getElementById('modalBox').textContent.includes('Curled on the ice with your four') }; })()""")
        check(fx['hows'] == ['play', 'manage', 'sim'] and fx['text'], 'your fixture at the Shed is a curling match: Play, Manage or Simulate', fx)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("""(() => { const L = wLeague(), me0 = L.me.w + L.me.l; const r = wCrfixPlay('sim'); const g = WG.shg.games[0], F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me');
          return { r, res: g.r, done: !!f.done, top: L.results[0], me: L.me.w + L.me.l - me0 }; })()""")
        top = r['top'] or {}
        check(r['r'] == '' and r['res'] in ('win', 'lose') and r['done'] and r['me'] == 1 and top.get('sport') == 'curling' and top.get('g') == 'g_shed', 'Simulate the fixture: it counts once on the table, as curling at the Shed', r)
        await pg.evaluate(CLOSE_ALL)
        c = await pg.evaluate("""(() => { const cl = wLeagueClubs(), L = wLeague(), a = cl[0], b = cl[1], w0 = L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l;
          let sims = 0; const sim0 = wCR.simGame; wCR.simGame = o => { sims++; return sim0(o); };
          wShedOpp(a, 3); const mine = JSON.stringify(WG.shg.opp[a]);
          const res = wSimAt(a, b, 'g_shed'); wCR.simGame = sim0; res.sims = sims; res.kept = JSON.stringify(WG.shg.opp[a]) === mine; const other = wSimAt(a, b, 'g_lanes');
          return { res, other: other.sport, played: L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l - w0 }; })()""")
        check(c['res']['sport'] == 'curling' and c['res']['sa'] > c['res']['sb'] and c['played'] == 4 and c['res']['sims'] == 1 and c['res']['kept'] and c['other'] == 'bowling',
              'the clubs\' fixtures at the Shed are played on the curling engine, and a rival\'s four for its matches against you is left alone; the Lanes\' are still bowling', c)

        bt = await pg.evaluate("""(() => { wOpenCamp('shed'); const tab = !!document.querySelector('#wCampBody [data-crcup]'); WCAMP.close();
          wOpenShedCard(); const card = !!document.querySelector('#modalBox [data-crcup]'); return { tab, card }; })()""")
        check(bt['tab'] and bt['card'], 'the Shed tab and the match card have a Brass Broom button', bt)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const t = (document.getElementById('wHelpShedCup') || {}).textContent || ''; return ['Brass Broom', 'CUP', 'extra end', 'league fixture'].map(s => t.includes(s)); })()")
        check(all(hp), 'How to play explains the Brass Broom and the fixtures at the Shed', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
