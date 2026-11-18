# Realm links cup and fixtures (issue #92, phase 9). The Divot Cup: Agatha Divot's CUP topic opens it; entry costs the
# fee and draws a field of eight (you first, rivals and regional sides). Your quarter-final (Simulate) settles, and back
# in the world the rest of the round is played out on the golf engine, with holes won and a winner every time (no match
# ends level); the semi-final is played on the course (the standing nine) and the round catches up when you're back;
# winning the final pays the prize (gold, fans, a pick of golf cards, a piece of golf gear), the journal and the Wall of
# Awards. Once a week; lose and the bracket is played to a champion. League fixtures at Mossgate Links: your fixture
# there is a golf match (Play, Manage or Simulate) that counts on the table, and the clubs' matches there get real golf
# results. The Links tab's and the match card's buttons, How to play, and the save. Asserts; exits nonzero on failure.
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
  const b = document.querySelector('#modalBox [data-close], #modalBox #wLinksOk, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
UNTIL_BRACKET = """(async () => { for (let i = 0; i < 30 && !document.querySelector('#modalBox .wdcb'); i++) {
  if (document.getElementById('modal').hidden) { wDrain(); } else { const b = document.querySelector('#modalBox .card, #modalBox [data-close], #modalBox #wLinksOk, #modalBox .btn, #modalBox button'); if (b) b.click(); }
  await new Promise(r => setTimeout(r, 100)); } return !!document.querySelector('#modalBox .wdcb'); })()"""
CUP = "(() => { const D = WG.lkcup; return D && { round: D.round, out: D.out, done: D.done, champ: D.champ, pending: D.pending, field: D.field, games: D.games }; })()"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wOpenDivot === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; SET.linksHoles = 3")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # Agatha's CUP; too few players at first
        t = await pg.evaluate("(() => { const K = DB.chars.gk_links; return { act: K.topics.cup && K.topics.cup.act, job: /CUP/.test(K.topics.job.t) }; })()")
        check(t == {'act': 'lkcup', 'job': True}, 'Agatha Divot runs the Divot CUP', t)
        off = await pg.evaluate("(() => { const R = WG.roster; WG.roster = R.slice(0, 1); const why = wDivotProblems().join(' '); WG.roster = R; return why; })()")
        check('Recruit' in off, 'with one player of your own you can\'t enter', off)
        await pg.evaluate("(() => { for (const kind of ['elf', 'spider', 'gorgon', 'dwarf']) if (wRoster().length < 6) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); RUN.gold = 500; wFourAuto(); })()")

        # entry
        await pg.evaluate("wRunAct('lkcup')"); await pg.wait_for_selector('#modalBox #wDivotEnter:not([disabled])')
        await pg.click('#wDivotEnter'); await pg.wait_for_selector('#modalBox [data-divothow]')
        D = await pg.evaluate(CUP); f = D['field']
        check(len(f) == 8 and len(set(f)) == 8 and f[0] == 'me' and any(x.startswith('wild:') for x in f), 'entry: a field of eight, you first, rivals and regional sides', f)
        check(await pg.evaluate("RUN.gold") == 460, 'the fee is paid')

        # quarter-final: simulate, forced to a win; the Final card, then the bracket
        await pg.evaluate("W_DIVOT.force = 'win'")
        await pg.click('#modalBox [data-divothow="sim"]')
        await pg.wait_for_selector('#wLinksOk'); await pg.click('#wLinksOk')
        check(await pg.evaluate(UNTIL_BRACKET), 'after the Final card, the bracket shows')
        D = await pg.evaluate(CUP); qf = D['games'][0]
        check(D['round'] == 1 and not D['pending'] and len(qf) == 4 and qf[0]['w'] == 'me', 'the quarter-final: yours settles, and the rest of the round is played out', qf)
        others = qf[1:]
        check(all(isinstance(g['ra'], int) and isinstance(g['rb'], int) and g['w'] in (g['a'], g['b']) and g['end'] in ('', 'po') and (g['ra'] != g['rb'] or g['end'] == 'po') for g in others), 'no match ends level: every one has a winner, by holes won (or a playoff)', others)

        # semi-final: on the course, the standing nine
        await pg.evaluate("W_DIVOT.force = 'win'")
        await pg.click('#modalBox [data-divothow="manage"]')
        await pg.wait_for_function("UI.view === 'links' && WG.lkg.live && WG.lkg.live.world.kind === 'lkcup'", timeout=15000)
        sm = await pg.evaluate("({ tier: WG.lkg.live.world.tier, wild: wGL.G.wild, cs: wGL.G.cs === wGL.stand })")
        check(sm == {'tier': 2, 'wild': False, 'cs': True}, 'the semi-final is tier 2 (a Knight), on the standing nine', sm)
        await pg.evaluate("(() => { wGL.setMode('watch'); wGL.pause(true); let i = 0; while (wLinksLive() && i++ < 60000) wGL.tick(0.05); })()")
        await pg.click('#wLinksBack')
        check(await pg.evaluate(UNTIL_BRACKET), 'back in the world, the bracket shows')
        D = await pg.evaluate(CUP)
        check(D['round'] == 2 and len(D['games'][1]) == 2 and D['games'][1][0]['w'] == 'me', 'the semi-finals are in: on to the final', D['games'][1])
        sv = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(wSaveKey())); return s.WG.lkcup && s.WG.lkcup.round; })()")
        check(sv == 2, 'the cup is in the save', sv)

        # the final, won
        g0 = await pg.evaluate("RUN.gold")
        await pg.evaluate("(() => { window.__offers = []; const o = wCardOffer; wCardOffer = function (spec) { __offers.push(spec); return o.apply(this, arguments); }; })()")
        await pg.evaluate("W_DIVOT.force = 'win'")
        await pg.click('#modalBox [data-divothow="sim"]')
        await pg.wait_for_selector('#wLinksOk'); await pg.click('#wLinksOk')
        await pg.evaluate(UNTIL_BRACKET)
        await pg.wait_for_function("WG.lkcup.done")
        D = await pg.evaluate(CUP)
        won = await pg.evaluate("({ wins: WG.lkcupWins, journal: wJ().wins.map(w => w.t) })")
        check(D['champ'] == 'me' and won['wins'] == 1 and await pg.evaluate("RUN.gold") - g0 >= 150, 'win the final: the Divot Cup, and its gold', [D['champ'], won])
        offers = await pg.evaluate("__offers.map(o => ({ pick: o.pick, pool: (o.pool || []).length, golf: (o.pool || []).every(id => CARDS[id].sport === 'golf') }))")
        check(any(o['pick'] == 3 and o['pool'] >= 3 and o['golf'] for o in offers), 'the prize includes a pick of 3 golf cards', offers)
        check('Won the Divot Cup' in won['journal'], 'it goes in the journal', won['journal'])
        gear = await pg.evaluate("W_LINKS_CUP.gear.filter(id => (WG.items[id] || 0) > 0)")
        check(gear == ['gl_putter'], 'and a piece of golf gear you did not have', gear)
        await pg.evaluate(CLOSE_ALL)
        wall = await pg.evaluate("(() => { wWallText(); return WLOG.slice(-2).map(l => l[0]).join(' '); })()")
        check('Divot Cup' in wall, 'and on the Wall of Awards', wall)
        check('once a week' in await pg.evaluate("wDivotEnter()"), 'the next cup is next week')

        # a new week: lose, and the rest is played to a champion
        await pg.evaluate("WG.dayAbs += 7; WG.day += 7; WG.lkg.met = {}")
        await pg.evaluate("wDivotEnter(); W_DIVOT.force = 'lose'; wDivotPlay('sim')")
        await pg.evaluate(CLOSE_ALL); await pg.evaluate("wDrain()")
        await pg.wait_for_function("WG.lkcup.done", timeout=60000)
        D = await pg.evaluate(CUP)
        check(D['out'] and D['done'] and D['champ'] != 'me' and len(D['games'][2]) == 1 and len(D['games'][1]) == 2, 'lose, and the rest of the bracket is played to a champion', D)
        await pg.evaluate(CLOSE_ALL)

        # ---------- league fixtures at Mossgate Links ----------
        fx = await pg.evaluate("""(() => { const F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me'); f.g = 'g_links'; f.done = 0; wSave();
          wOpenGrdCard('g_links'); const hows = [...document.querySelectorAll('#modalBox [data-lkfixhow]')].map(b => b.dataset.lkfixhow);
          return { hows, text: document.getElementById('modalBox').textContent.includes('Played on the course with your four') }; })()""")
        check(fx['hows'] == ['play', 'manage', 'sim'] and fx['text'], 'your fixture at the Links is a golf match on the course: Play, Manage or Simulate', fx)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("""(() => { const L = wLeague(), me0 = L.me.w + L.me.l; const r = wLkfixPlay('sim'); const g = WG.lkg.games[0], F = wFixtures(), f = F.games.find(x => x.a === 'me' || x.b === 'me');
          return { r, res: g.r, done: !!f.done, top: L.results[0], me: L.me.w + L.me.l - me0 }; })()""")
        top = r['top'] or {}
        check(r['r'] == '' and r['res'] in ('win', 'lose') and r['done'] and r['me'] == 1 and top.get('sport') == 'golf' and top.get('g') == 'g_links', 'Simulate the fixture: it counts once on the table, as golf at the Links', r)
        await pg.evaluate(CLOSE_ALL)
        c = await pg.evaluate("""(() => { const cl = wLeagueClubs(), L = wLeague(), a = cl[0], b = cl[1], w0 = L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l;
          let sims = 0; const sim0 = wGL.simGame; wGL.simGame = o => { sims++; return sim0(o); };
          wLinksOpp(a, 3); const mine = JSON.stringify(WG.lkg.opp[a]);
          const res = wSimAt(a, b, 'g_links'); wGL.simGame = sim0; res.sims = sims; res.kept = JSON.stringify(WG.lkg.opp[a]) === mine; const other = wSimAt(a, b, 'g_court'); return { res, other: other.sport, played: L.table[a].w + L.table[b].w + L.table[a].l + L.table[b].l - w0 }; })()""")
        check(c['res']['sport'] == 'golf' and c['res']['sa'] >= c['res']['sb'] and c['played'] == 4 and c['res']['sims'] == 1 and c['res']['kept'] and c['other'] == 'basketball',
              'the clubs\' fixtures at the Links are played on the golf engine, and a rival\'s four for its matches against you is left alone; the Court\'s are still basketball', c)

        bt = await pg.evaluate("""(() => { wOpenCamp('links'); const tab = !!document.querySelector('#wCampBody [data-lkcup]'); WCAMP.close();
          wOpenLinksCard(); const card = !!document.querySelector('#modalBox [data-lkcup]'); return { tab, card }; })()""")
        check(bt['tab'] and bt['card'], 'the Links tab and the match card have a Divot Cup button', bt)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const t = (document.getElementById('wHelpLinksCup') || {}).textContent || ''; return ['Divot Cup', 'CUP', 'standing nine', 'playoff', 'League fixtures'].map(s => t.includes(s)); })()")
        check(all(hp), 'How to play explains the Divot Cup and the fixtures at the Links', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
