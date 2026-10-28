# Soccer (issue #10): the pass-and-move rule. Every card is a pass; an Attack with 2+ passes is a shot that hits +1
# per pass (up to 6) and scores at 10+ on one enemy; an enemy hit with 6+ through your Block is their goal; an enemy
# turn where every hit is blocked is a save (a goal prevented), and your next turn starts with a pass. Also the
# practiced and Stopper lines, the highlights, the scoreboard and the in-hand badge.
# Asserts; exits nonzero on failure.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import GAME_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

# a fresh soccer fight against two sturdy enemies, with a hand we choose; LAB keeps it quiet
START = r'''(hand) => { LAB = true; window.SKY_OFF = true;
  K('t_pass', 'Pass', 'any', 'skl', 0, 'c', 'self', [['b', 1]]); K('t_six', 'Six', 'any', 'atk', 0, 'c', 'one', [['d', 6]]); K('t_twelve', 'Twelve', 'any', 'atk', 0, 'c', 'one', [['d', 12]]); K('t_multi', 'Three Twos', 'any', 'atk', 0, 'c', 'one', [['d', 2, 3]]);
  newRun('ironmaw', [0, 3, 4]); RUN.path = [];
  beginFight({ ids: ['skelss', 'lb'], type: 'normal', sport: 'soccer' }); A.banner = null;
  for (const e of B.enemies) { e.hp = e.max = 999; e.block = 0; delete e.sp; } B.sp = null; // no random perk (a Stopper moves the goal line)
  B.energy = 20; B.hand = hand.map(id => mkCard(id)); B.draw = Array.from({ length: 10 }, () => mkCard('t_pass')); return B.sport; }'''
PLAY = "(id) => { const i = B.hand.findIndex(c => c.id === id); playCard(i, 0); return { passes: B.sc.passes, us: B.sc.us, them: B.sc.them, hand: B.hand.length }; }"

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(GAME_URL); await pg.wait_for_function("typeof beginFight === 'function'")

        check(await pg.evaluate("!!(SPORTS.soccer && SPORT_NAME.soccer && SPORT_BRIEF.soccer && PRACTICE.soccer)"), 'soccer has its rules, name, brief and practice line')
        sport = await pg.evaluate(START, ['t_pass', 't_pass', 't_pass', 't_six', 't_six'])
        check(sport == 'soccer', 'a soccer fight starts', sport)

        # ---------- passes and the shot ----------
        r = None
        for _ in range(3): r = await pg.evaluate(PLAY, 't_pass')
        check(r['passes'] == 3 and r['us'] == 0, 'three cards are three passes, and no score yet', r)
        why = await pg.evaluate("(() => { const c = B.hand.find(c => c.id === 't_six'); return dmgWhy(c, B.enemies[0]); })()")
        check(why and ['Passes', '+', 3] in why['parts'] and why['n'] == 9, 'the shot shows +3 for the passes in the damage breakdown (6 + 3 = 9)', why)
        badge = await pg.evaluate("sportBadge(B.hand.find(c => c.id === 't_six'), B.enemies[0])")
        check(badge in ('Shot', 'Goal'), 'a card in hand after three passes says Shot or Goal', badge)
        # a 6 + 3 passes = 9: under the line, so a save, and the passes start again
        r = await pg.evaluate(PLAY, 't_six')
        check(r['us'] == 0 and r['passes'] == 0, 'a shot under 10 is saved, and the passes reset', r)
        # an Attack with fewer than 2 passes is only a pass; with two, it is a shot
        r = await pg.evaluate(PLAY, 't_six')
        check(r['us'] == 0 and r['passes'] == 1, 'an Attack without two passes behind it is just a pass', r)
        await pg.evaluate("B.hand.push(mkCard('t_pass'))"); await pg.evaluate(PLAY, 't_pass')
        why2 = await pg.evaluate("dmgWhy(mkCard('t_six'), B.enemies[0])")
        check(why2 and ['Passes', '+', 2] in why2['parts'], 'two passes are enough for a shot (+2)', why2)

        # a goal: three passes, then a big hit
        await pg.evaluate(START, ['t_pass', 't_pass', 't_pass', 't_twelve'])
        for _ in range(3): await pg.evaluate(PLAY, 't_pass')
        h0 = await pg.evaluate("B.hand.length")
        r = await pg.evaluate(PLAY, 't_twelve')
        check(r['us'] == 1 and r['passes'] == 0 and r['hand'] == h0, 'a shot of 10+ on one enemy is a goal: a point, and a card drawn to replace it', [r, h0])
        line = await pg.evaluate("sportLine()")
        check('Passes' in line, 'the scoreboard shows the passes', line)
        check(await pg.evaluate("sportBadge(B.hand[0], B.enemies[0])") == 'Pass', 'with no passes, a card in hand says Pass')

        # a multi-hit shot gets the pass bonus once, on its first hit: 2 x 3 + 2 passes = 8, a save, not 12
        await pg.evaluate(START, ['t_pass', 't_pass', 't_multi'])
        for _ in range(2): await pg.evaluate(PLAY, 't_pass')
        m = await pg.evaluate("(() => { const e = B.enemies[0], c = B.hand.find(c => c.id === 't_multi'), badge = sportBadge(c, e), est = estDamage(c, e).top, hp = e.hp;" +
                              " playCard(B.hand.indexOf(c), 0); return { badge, est, dealt: hp - e.hp, us: B.sc.us }; })()")
        check(m == {'badge': 'Shot', 'est': 8, 'dealt': 8, 'us': 0}, 'a multi-hit shot gets the pass bonus once (2 x 3 + 2 = 8): the badge, the estimate and the hit agree, and it is saved', m)

        # ---------- their goals ----------
        g = await pg.evaluate("""(() => { B.P.block = 0; const t0 = B.sc.them; hurtPlayer(5, B.enemies[0]); const a = B.sc.them - t0;
          hurtPlayer(6, B.enemies[0]); const b = B.sc.them - t0 - a; return [a, b]; })()""")
        check(g == [0, 1], 'an enemy hit with 5 through is no goal, and 6 through is their goal', g)

        # ---------- saves ----------
        s = await pg.evaluate("""(() => { B.sc.eh = 0; B.sc.et = 0; B.P.block = 50; hurtPlayer(6, B.enemies[0]); hurtPlayer(6, B.enemies[1]);
          B.phase = 'player'; B.hand = []; runSteps([() => playerTurnStart()]); return { saves: B.sc.saves, passes: B.sc.passes }; })()""")
        check(s['saves'] == 1 and s['passes'] == 1, 'an enemy turn with every hit blocked is a save, and the next turn starts with a pass', s)
        s = await pg.evaluate("""(() => { B.P.block = 0; hurtPlayer(3, B.enemies[0]); playerTurnStart(); return { saves: B.sc.saves, passes: B.sc.passes }; })()""")
        check(s['saves'] == 1 and s['passes'] == 0, 'a hit that gets through means no save, and no pass to start', s)
        s = await pg.evaluate("(() => { playerTurnStart(); return { saves: B.sc.saves, passes: B.sc.passes }; })()")
        check(s['saves'] == 1 and s['passes'] == 0, 'an enemy turn with no hits at all is not a save', s)

        # ---------- practice and Stopper ----------
        k = await pg.evaluate("""(() => { const c = mkCard('t_six'), p = mkCard('t_six'); p.sk = 1; const a = [SKT(c).kick, SKT(p).kick];
          B.sp = 'stopper'; for (const e of B.enemies) e.sp = 'stopper'; const s = SKT(c).kick; B.sp = null; for (const e of B.enemies) delete e.sp; return a.concat([s]); })()""")
        check(k == [10, 8, 13], 'a goal needs 10, 8 when practiced, and 13 against a Stopper', k)

        # ---------- highlights ----------
        await pg.evaluate(START, ['t_pass'] * 6 + ['t_twelve'])
        for _ in range(6): await pg.evaluate(PLAY, 't_pass')
        await pg.evaluate(PLAY, 't_twelve')
        check(await pg.evaluate("B.sc.hl.includes('golazo')"), 'a goal from six passes is a golazo')
        cs = await pg.evaluate("(() => { B.sc.them = 0; B.sc.goals = 1; B.sc.us = 1; for (const e of B.enemies) { e.hp = 0; e.dead = true; } B.sc.done = false; sportFinal(); return [B.sc.win, B.sc.hl.includes('cleansheet')]; })()")
        check(cs == [True, True], 'a win with them on nothing is a clean sheet', cs)
        bw = await pg.evaluate("""(() => { B.sc.saves = 2; B.sc.eh = 1; B.sc.et = 0; playerTurnStart(); return B.sc.hl.includes('brickwall'); })()""")
        check(bw, 'three saves in a game is a brick wall')

        # ---------- cards, fits, the schedule ----------
        cards = await pg.evaluate("['scr_tiki', 'scr_overlap', 'scr_through', 'scr_volley', 'scr_captain', 'ply_onetouch'].map(id => CARDS[id] ? CARDS[id].sport : null)")
        check(cards == ['soccer'] * 6, 'six soccer cards: five to build with and a set play', cards)
        fits = await pg.evaluate("[sportFits(CARDS.scr_tiki), sportFits(CARDS.timeout)]")
        check('soccer' in fits[0] and 'soccer' in fits[1], 'soccer fits cards that cost nothing or draw', fits)
        check(await pg.evaluate("ACT_SPORTS.map(a => a.soccer)") == [2, 2, 3], 'soccer is on the schedule like a major sport: 2, 2 and 3', await pg.evaluate("ACT_SPORTS.map(a => a.soccer)"))
        check(await pg.evaluate("!!SPORT_GLYPH.soccer && sportSVG('soccer').includes('<svg')"), 'soccer has its glyph')
        await pg.evaluate(START, ['ply_onetouch'])
        r = await pg.evaluate(PLAY, 'ply_onetouch')
        check(r['passes'] == 3, 'One-Touch at home is three passes in one card (two from the play, one for the card)', r)
        txt = await pg.evaluate("String(cardText(mkCard('ply_onetouch')))")
        check('2 passes' in txt, 'the set play says what it does at home', txt)

        check(not errs and not await pg.evaluate("window.__sdErrs && window.__sdErrs.length"), 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
