# Realm ring, the card (issue #23, phase 3): three bouts, one fighter a bout, a fighter boxes once. The corner's pairing
# takes the best total edge (it will send its weakest against their best to win the other two). A card boxes its bouts
# in order, each with the right two fighters, keeps each result, and is settled after the third (bouts, then knockdowns,
# then points); nothing comes after it. A headless card is the same twice and leaves the card in the ring alone. In the
# Realm: Ma Gristle's CARD names the visitors' order and asks who faces each (the corner's pick to start with, the same
# fighter twice refused, call-ups when the team is short); the bar has Next bout between bouts and Another card at the
# end, and a change of mode carries on with the card. How to play explains it. Asserts; exits nonzero on failure.
# Screenshots: /tmp/realm-ring-card-*.png.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

# a bout boxed to its end on the engine's clock, with the page's own loop held still
TO_END = "(() => { wBX.pause(true); for (let i = 0; i < 20000 && wBX.phase !== 'over'; i++) { if (wBX.wait) wBX.call(wBX.wait.plan); wBX.step(); } wBX.pause(false); return wBX.phase; })()"
R = lambda v: {s: v for s in ['reach', 'pow', 'spd', 'chin', 'sta', 'gui']}

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBX !== 'undefined'"); await pg.evaluate("wBX.speed = 4")

        # ---------- the corner's pairing ----------
        a = await pg.evaluate("([s, m, w]) => wBX.cardAuto([{ kind: 'elf', r: s }, { kind: 'elf', r: m }, { kind: 'elf', r: w }], [{ kind: 'elf', r: s }, { kind: 'elf', r: m }, { kind: 'elf', r: w }])", [R(9), R(5), R(2)])
        check(a == [2, 0, 1], 'the corner\'s pairing sends its weakest against their best, to win the other two', a)

        # ---------- a card in the engine ----------
        SIDES = """[{ name: 'Reds', short: 'RED', color: '#b8231e', light: '#fff', fighters: [{ n: 'Ash', kind: 'ogre' }, { n: 'Bea', kind: 'harpy' }, { n: 'Cob', kind: 'dwarf' }, { n: 'Dot', kind: 'elf' }] },
          { name: 'Blues', short: 'BLU', color: '#2a5fb8', light: '#fff', fighters: [{ n: 'Eel', kind: 'spider' }, { n: 'Fen', kind: 'golem' }, { n: 'Gil', kind: 'witch' }] }]"""
        c = await pg.evaluate(f"""(() => {{ const S = {SIDES}; const C = wBX.cardStart({{ sides: S, picks: [3, 0, 1], order: [2, 0, 1], mode: 'watch', seed: 9 }});
          const names = [], plain = [];
          for (let i = 0; i < 3; i++) {{ names.push(wBX.G.F.map(f => f.n)); {TO_END}; plain.push(JSON.stringify(wBX.card) === JSON.stringify(JSON.parse(JSON.stringify(wBX.card))));
            if (i < 2) wBX.cardNext(); }}
          const K = wBX.card; return {{ pairs: C.pairs, names, bouts: K.bouts.map(b => b.over), result: K.result, again: wBX.cardNext(), plain: plain.every(Boolean),
            check: wBX.cardResult(K.bouts.map(b => b.over)), score: wBX.cardScore() }}; }})()""")
        check(c['pairs'] == [[3, 2], [0, 0], [1, 1]] and c['names'] == [['Dot', 'Gil'], ['Ash', 'Eel'], ['Bea', 'Fen']], 'the card boxes its bouts in order, each with the two fighters picked for it', c)
        check(len(c['bouts']) == 3 and all(b['how'] in ('ko', 'tko', 'dec') for b in c['bouts']), 'each bout\'s result is kept on the card', c['bouts'])
        check(c['result'] == c['check'] and c['score']['done'] == 3 and c['result']['won'] == c['score']['won'], 'after the third bout the card is settled (bouts, then knockdowns, then points)', c)
        check(c['again'] is False and c['plain'], 'nothing comes after the last bout, and the card is plain JSON throughout', c)
        h = await pg.evaluate(f"""(() => {{ const S = {SIDES}; wBX.cardStart({{ sides: S, mode: 'watch', seed: 3 }}); const before = JSON.stringify(wBX.card);
          const x = wBX.simCard({{ sides: S, seed: 21 }}), y = wBX.simCard({{ sides: S, seed: 21 }});
          return {{ same: JSON.stringify(x) === JSON.stringify(y), left: JSON.stringify(wBX.card) === before, n: x.bouts.length, ok: JSON.stringify(x.result) === JSON.stringify(wBX.cardResult(x.bouts.map(b => b.over))) }}; }})()""")
        check(h == {'same': True, 'left': True, 'n': 3, 'ok': True}, 'a headless card is the same twice, settles from its bouts, and leaves the card in the ring alone', h)

        # ---------- in the Realm ----------
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wBX.speed = 4")
        t = await pg.evaluate("(() => { const K = DB.chars.gk_ring; return { card: K.topics.card && K.topics.card.act, job: /CARD/.test(K.topics.job.t) }; })()")
        check(t == {'card': 'rcard', 'job': True}, 'Ma Gristle puts on a CARD', t)
        await pg.evaluate("W_RING_MODE = 'watch'; wRunAct('rcard')")
        await pg.wait_for_selector('[data-rslot]')
        m = await pg.evaluate("""(() => { const S = [...document.querySelectorAll('[data-rslot]')]; return { n: S.length, picks: S.map(s => +s.value), opts: S[0].options.length,
          roster: wRoster().length, go: !document.getElementById('wRingCardGo').disabled, rate: !!document.querySelector('[data-rrate="0"]').textContent }; })()""")
        check(m['n'] == 3 and len(set(m['picks'])) == 3 and m['opts'] == max(3, m['roster']) and m['go'] and m['rate'], 'the visitors\' three in order, each with your corner\'s pick of your team against them', m)
        await pg.screenshot(path='/tmp/realm-ring-card-pick.png')
        d = await pg.evaluate("""(() => { const S = [...document.querySelectorAll('[data-rslot]')]; S[1].value = S[0].value; S[1].dispatchEvent(new Event('change', { bubbles: true }));
          const r = { go: document.getElementById('wRingCardGo').disabled, warn: document.getElementById('wRingCardWarn').textContent };
          document.getElementById('wRingCardAuto').click(); r.back = !document.getElementById('wRingCardGo').disabled; return r; })()""")
        check(d['go'] and 'boxes once' in d['warn'] and d['back'], 'the same fighter twice is refused, and Your corner\'s pick puts the pairing back', d)
        picks = await pg.evaluate("[...document.querySelectorAll('[data-rslot]')].map(s => +s.value)")
        await pg.click('#wRingCardGo')
        await pg.wait_for_function("UI.view === 'ring' && wBX.on && !!wBX.card")
        b1 = await pg.evaluate("({ title: document.getElementById('wRingTitle').textContent, mine: wBX.G.F[0].n, want: wBX.card.sides[0].fighters[wBX.card.pairs[0][0]].n, picked: wBX.card.pairs.map(p => p[0]) })")
        check(b1['title'] == 'A card at the Anvil Ring: bout 1 of 3' and b1['mine'] == b1['want'] and b1['picked'] == picks, 'the card goes in the ring with your picks, bout 1 of 3', b1)
        await pg.evaluate(TO_END)
        await pg.wait_for_function("WBX && WBX.over && !document.getElementById('wRingNext').hidden")
        bt = await pg.evaluate("({ next: !document.getElementById('wRingNext').hidden, again: document.getElementById('wRingAgain').hidden, note: document.getElementById('wRingNote').textContent })")
        check(bt['next'] and bt['again'] and 'The card:' in bt['note'], 'between bouts the bar has Next bout and the card so far', bt)
        await pg.screenshot(path='/tmp/realm-ring-card-between.png')
        await pg.click('[data-rmode="call"]')
        mc = await pg.evaluate("({ card: !!wBX.card, i: wBX.card.i, mode: wBX.card.mode })")
        check(mc == {'card': True, 'i': 0, 'mode': 'call'}, 'a change of mode between bouts carries on with the card', mc)
        await pg.click('#wRingNext')
        b2 = await pg.evaluate("({ title: document.getElementById('wRingTitle').textContent, mode: wBX.mode, mine: wBX.G.F[0].n, want: wBX.card.sides[0].fighters[wBX.card.pairs[1][0]].n })")
        check(b2['title'] == 'A card at the Anvil Ring: bout 2 of 3' and b2['mode'] == 'call' and b2['mine'] == b2['want'], 'Next bout boxes bout 2, in the mode picked', b2)
        for _ in range(2):
            await pg.evaluate(TO_END)
            await pg.wait_for_function("WBX && WBX.over")
            if await pg.evaluate("!document.getElementById('wRingNext').hidden"):
                await pg.click('#wRingNext')
        await pg.wait_for_function("!!wBX.card.result && !document.getElementById('wRingAgain').hidden")
        end = await pg.evaluate("({ again: document.getElementById('wRingAgain').textContent, next: document.getElementById('wRingNext').hidden, note: document.getElementById('wRingNote').textContent, result: wBX.card.result })")
        check(end['again'] == 'Another card' and end['next'] and ('wins the card' in end['note'] or 'draw' in end['note']), 'after the third bout the card is settled on the bar, with Another card', end)
        await pg.wait_for_timeout(300); await pg.screenshot(path='/tmp/realm-ring-card-end.png')
        await pg.click('#wRingAgain')
        await pg.wait_for_selector('[data-rslot]')
        check(True, 'Another card asks for the next pairing')
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")
        # a team of one: call-ups make up the card
        cu = await pg.evaluate("""(() => { const keep = WG.roster; WG.roster = keep.slice(0, 1); wRingCard();
          const o = [...document.querySelectorAll('[data-rslot]')[0].options].map(x => x.textContent); WG.roster = keep; document.querySelector('#modalBox [data-close]').click(); return o; })()""")
        check(len(cu) == 3 and sum('(call-up)' in x for x in cu) == 2, 'with fewer than three players, call-ups make up the card', cu)

        # ---------- How to play ----------
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("({ ring: (document.getElementById('wHelpRing') || {}).textContent || '', how: (document.getElementById('wRingHowCard') || {}).textContent || '' })")
        check('CARD' in hp['ring'] and 'boxes once' in hp['how'] and 'knockdowns' in hp['how'], 'How to play explains the card', hp)
        await pg.evaluate("showPage('play')")

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
