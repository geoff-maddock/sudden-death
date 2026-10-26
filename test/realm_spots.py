# Realm training spots (issue #6, phase 4): every city has a spot for each sport its region plays, with a coach, both
# within reach. Using a spot (or asking its coach to DRILL) drills a card that suits the sport (Practice ★, free, an
# hour), once a week; the coach's CHALLENGE asks how the sport scores, with three answers, once a week: right pays
# gold and fans, wrong tells you the answer. A new week opens both again, the save keeps them, every spot draws,
# How to play says so, and the audit is clean.
# Asserts; exits nonzero on failure. Screenshots: /tmp/realm-spots-*.png.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close]'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""
# stand next to a spot, on a tile you can walk to
STAND = """(id => { const s = wSpot(id), m = MAPS[s.city], seen = bfsReach(m, m.spawn[0], m.spawn[1]);
  for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) { const x = s.at[0] + dx, y = s.at[1] + dy; if (seen[y * m.w + x] && wOpenTile(m, x, y)) { wEnterMap(s.city, x, y); wCloseTalk(); wDrain(); return [x, y]; } }
  return null; })"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_SPOTS !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- where they are ----------
        lay = await pg.evaluate("""(() => { const per = {}, out = [];
          for (const s of W_SPOTS) {
            const m = MAPS[s.city], seen = bfsReach(m, m.spawn[0], m.spawn[1]), near = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(y + dy) * m.w + x + dx]);
            const n = m.npcs.find(n => n.id === s.coach.id), mt = m.meta[s.at.join(',')] || {};
            (per[s.city] = per[s.city] || []).push(s.sport);
            out.push({ id: s.id, tile: m.t[s.at[1]][s.at[0]] === '!' && mt.spot === s.id, spot: near(...s.at), coach: !!n && near(n.x, n.y) });
          }
          const want = {}; for (const c in per) want[c] = DB.regions[W_GRD_REG[c]].sports.map(x => x[0]).sort();
          return { out, per: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, v.sort()])), want }; })()""")
        check(len(lay['out']) == 10 and lay['per'] == lay['want'], 'every city has a spot for each sport its region plays', lay['per'])
        check(all(o['tile'] and o['spot'] and o['coach'] for o in lay['out']), 'each spot and its coach can be reached', lay['out'])
        talk = await pg.evaluate("""W_SPOTS.map(s => { const j = wSay(s.coach.id, 'job').text, k = wSay(s.coach.id, s.sport).text;
          return [s.id, j.includes('DRILL') && j.includes('CHALLENGE') && j.includes(s.sport.toUpperCase()), k.includes(SPORTS[s.sport].desc), wSay(s.coach.id, 'drill').act, wSay(s.coach.id, 'challenge').act]; })""")
        check(all(t[1] and t[2] and t[3] == 'spot' and t[4] == 'spot' for t in talk), 'every coach explains the scoring and offers a DRILL and a CHALLENGE', talk)

        # ---------- a drill at the batting cage ----------
        at = await pg.evaluate(STAND + "('sp_cage')")
        look = await pg.evaluate("wLookText(44, 14)")
        check('batting cage' in look, 'looking at a spot describes it', look)
        await pg.evaluate("wUse(44, 14)")
        await pg.wait_for_selector('#wSpotDrill')
        await pg.wait_for_timeout(1200)
        await pg.screenshot(path='/tmp/realm-spots-card.png')
        await pg.click('#wSpotDrill')
        await pg.wait_for_selector('#modalBox .cardgrid .card')
        pick = await pg.evaluate("""(() => { const uids = [...document.querySelectorAll('#modalBox .cardgrid .card')].map(e => +e.dataset.uid), cards = uids.map(u => RUN.deck.find(c => c.uid === u));
          const anyFit = RUN.deck.some(c => practicable(c) && sportFits(def(c)).includes('baseball'));
          return { n: cards.length, ok: cards.every(c => practicable(c) && (!anyFit || sportFits(def(c)).includes('baseball'))), anyFit, first: uids[0], min: WG.min }; })()""")
        check(pick['n'] > 0 and pick['ok'], 'the drill offers cards that suit baseball', pick)
        await pg.click('#modalBox .cardgrid .card')
        await pg.wait_for_selector('#wSpotDrill')
        d = await pg.evaluate(f"({{ sk: RUN.deck.find(c => c.uid === {pick['first']}).sk, min: WG.min, dis: document.getElementById('wSpotDrill').disabled, msg: document.getElementById('modalBox').textContent }})")
        check(d['sk'] == 1 and d['dis'] and 'Practice' in d['msg'] and d['min'] - pick['min'] == 60, 'the card gains Practice ★, in an hour, and the drill is done for the week', d)
        again = await pg.evaluate("wSpotDrill('sp_cage', RUN.deck.find(c => practicable(c)))")
        check('this week' in again, 'one drill a week at a spot', again)
        await pg.evaluate(CLOSE_ALL)

        # ---------- the challenge: right at the cage, wrong at the hoop ----------
        g0 = await pg.evaluate("({ gold: RUN.gold, fans: RUN.fans || 0 })")
        await pg.evaluate("wOpenSpot('sp_cage')"); await pg.click('#wSpotQuiz')
        await pg.wait_for_selector('[data-quiz]')
        q = await pg.evaluate("[...document.querySelectorAll('[data-quiz]')].map(b => [b.dataset.quiz, b.textContent])")
        check(len(q) == 3 and sum(1 for k, t in q if k == 'baseball') == 1 and len(set(k for k, _ in q)) == 3, 'the challenge: three answers, one of them baseball\'s', q)
        await pg.screenshot(path='/tmp/realm-spots-quiz.png')
        await pg.click('[data-quiz="baseball"]')
        await pg.wait_for_selector('#wSpotQuiz')
        g1 = await pg.evaluate("({ gold: RUN.gold, fans: RUN.fans || 0, dis: document.getElementById('wSpotQuiz').disabled, right: WG.spots.sp_cage.right })")
        check(g1['gold'] - g0['gold'] == 20 and g1['fans'] - g0['fans'] == 5 and g1['dis'] and g1['right'] == 1, 'the right answer pays 20 gold and 5 fans, once a week', [g0, g1])
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate(STAND + "('sp_hoop')")
        await pg.evaluate("wRunAct(wSay('tc_hoop', 'challenge').act, 'tc_hoop')"); await pg.click('#wSpotQuiz')
        await pg.wait_for_selector('[data-quiz]')
        wrong = await pg.evaluate("[...document.querySelectorAll('[data-quiz]')].map(b => b.dataset.quiz).find(k => k !== 'basketball')")
        await pg.click(f'[data-quiz="{wrong}"]')
        await pg.wait_for_selector('#wSpotQuiz')
        g2 = await pg.evaluate("({ gold: RUN.gold, log: WLOG.slice(-3).map(l => l[0]).join(' '), dis: document.getElementById('wSpotQuiz').disabled, brief: SPORT_BRIEF.basketball })")
        check(g2['gold'] == g1['gold'] and g2['brief'] in g2['log'] and g2['dis'], 'a wrong answer pays nothing, and the coach tells you the right one', g2)
        await pg.evaluate(CLOSE_ALL)

        # ---------- the save, then a new week ----------
        await pg.evaluate("wSave()")
        await pg.reload(); await pg.wait_for_selector('#bResume'); await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate(CLOSE_ALL)
        sv = await pg.evaluate("({ s: WG.spots, wk: wWeek() })")
        check(sv['s']['sp_cage']['drill'] == sv['wk'] and sv['s']['sp_cage']['quiz'] == sv['wk'] and sv['s']['sp_hoop']['quiz'] == sv['wk'], 'the save keeps the week\'s drills and challenges', sv)
        await pg.evaluate("WG.dayAbs += 7; WG.day += 7; wOpenSpot('sp_cage')")
        nw = await pg.evaluate("({ d: document.getElementById('wSpotDrill').disabled, q: document.getElementById('wSpotQuiz').disabled })")
        check(not nw['d'] and not nw['q'], 'a new week opens both again', nw)
        await pg.evaluate(CLOSE_ALL)

        # ---------- every spot draws ----------
        for sid in await pg.evaluate("W_SPOTS.map(s => s.id)"):
            await pg.evaluate(STAND + f"('{sid}')"); await pg.wait_for_timeout(900)
            await pg.screenshot(path=f'/tmp/realm-spots-{sid}.png')
        help_ = await pg.evaluate("(() => { renderHelp(); const h = document.getElementById('wHelpSpots'); return h ? h.textContent : ''; })()")
        check('Training spots' in help_ and 'Practice' in help_, 'How to play explains the training spots', help_)
        check(await pg.evaluate("wAudit().length === 0 && worldProblems().length === 0"), 'the audit is clean', await pg.evaluate("wAudit().concat(worldProblems())"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors or drawing errors', errs + await pg.evaluate("window.__sdErrs"))
        await br.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm spots passed')

asyncio.run(main())
