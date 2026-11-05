# Realm superstars, phase 3 (issue #24): the Kraken. A kind in every scope, never on a CPU side or a call-up; met
# through Ysolde Wrack in Saltmere (locked: the story and the feat; unlocked: 300 gold or 2 Brine Eggs), joining at the
# team's average level with its signature card. Eight Arms: in a card-game match while it starts, a tentacle lashes an
# enemy and catches Block at the start of each of your turns (and the Block lasts the turn: a Block drain that came
# after turnStart wiped it, and the elf and skeleton captains' too, which this also checks); from the bench, nothing.
# In the ring its jab reaches much further; whole games in each engine. How to play. Asserts; exits nonzero.
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

CLOSE = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #wRelNo, #modalBox button'); if (!b) break; b.click(); } })()"""
# a match, the next turn started (the enemies' turn played), and what the turn start did
TURN2 = """(() => { startMatch({ type: 'normal', tier: 1, card: false, world: { kind: 'wild' } }); B.sport = 'football'; const n0 = B.log.length;
  B.P.block = 0; runSteps(endTurn()); const r = { turn: B.turn, block: B.P.block, lash: B.log.slice(n0).some(l => /Eight Arms: a tentacle/.test(l.t)) };
  B.forfeit = 1; B.over = 'lose'; finishFight(); RUN.hp = RUN.maxhp; return r; })()"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wOpenStar === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- a kind in every scope ----------
        k = await pg.evaluate("""(() => { const cv = document.createElement('canvas'); cv.width = cv.height = 200; let drew = true;
          try { drawFig(cv.getContext('2d'), 'kraken', 100, 190, 160, { color: '#2a5fb8', light: '#d6e6ff', short: 'K' }, { num: 8 }); } catch (e) { drew = String(e); }
          return { drew, name: KIND_NAME.kraken, sig: SIG.kraken, cards: Object.values(CARDS).filter(c => c.kind === 'kraken').length, bx: wBX.kinds.includes('kraken'), gf: wGF.kinds.includes('kraken'),
            bd: wBD.rate('kraken').ult, pos: wBD.rate('kraken').pos, calls: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].some(pos => wBD.kindsAt(pos).includes('kraken')),
            trait: (wBX.traits.kraken || {}).n, gfb: wGF.powerBook.kraken && wGF.powerBook.kraken.ult.n, cap: W_CAPTAIN.kraken && W_CAPTAIN.kraken.n }; })()""")
        check(k['drew'] is True and k['name'] == 'Kraken' and k['sig'] == 'krk_grab' and k['cards'] == 6, 'the Kraken is a kind: drawn, named, a signature card and five more', k)
        check(k['bx'] and k['gf'] and k['bd'] == 'eightarms' and k['pos'] == '1B' and not k['calls'], 'every engine knows it (first base, Eight Arms on the diamond), and no call-up is ever one', k)
        check(k['trait'] == 'Eight Arms' and k['gfb'] == 'Eight Arms' and k['cap'] == 'Ink Cloud', 'its nature in the ring, its football ultimate, its captain\'s bonus', k)

        # ---------- the meeting ----------
        lk = await pg.evaluate("""(() => { const t = DB.chars.diver.topics; wRunAct('star:kraken', 'diver'); const b = document.getElementById('modalBox');
          return { job: t.job.t.includes('KRAKEN'), act: t.kraken.act, story: b.textContent.includes('hatchery'), feat: b.textContent.includes('Win the Rimewatch cup'), buy: !!document.getElementById('wStarGold') }; })()""")
        check(lk == {'job': True, 'act': 'star:kraken', 'story': True, 'feat': True, 'buy': False}, 'Ysolde Wrack in Saltmere knows of it; locked, the story and the feat, nothing to buy', lk)
        await pg.evaluate(CLOSE)
        await pg.evaluate("(() => { const S = wStarsAll(); S.un.kraken = '2026-11-05'; localStorage.setItem(wStarsKey(), JSON.stringify(S)); const R = wRoster(); [2, 4, 3].forEach((l, i) => { R[i].lvl = l; }); RUN.gold = 100; wAddItem('brineegg', 2); wRunAct('star:kraken', 'diver'); })()")
        pr = await pg.evaluate("({ gold: document.getElementById('wStarGold').disabled, eggs: !document.getElementById('wStarItems').disabled, eggTxt: document.getElementById('wStarItems').textContent })")
        check(pr['gold'] and pr['eggs'] and 'Brine Egg' in pr['eggTxt'], 'unlocked: 300 gold (too dear for 100) or two Brine Eggs', pr)
        await pg.click('#wStarItems')
        sg = await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'kraken'); return { p: p && [p.n, p.lvl, p.star], eggs: WG.items.brineegg || 0, star: WG.star, card: !!p && wCardsOf(p.id).some(c => c.id === 'krk_grab') }; })()")
        check(sg == {'p': ['Deepmaw', 3, 'kraken'], 'eggs': 0, 'star': 'kraken', 'card': True}, 'Deepmaw joins at level 3, the team\'s average, with Tentacle Grab', sg)
        await pg.evaluate(CLOSE)

        # ---------- Eight Arms in a match ----------
        await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'kraken'); wMovePlayer(p.id, 0); WG.captain = wRoster()[1].id; })()")
        t2 = await pg.evaluate(TURN2)
        check(t2['turn'] == 2 and t2['lash'] and t2['block'] >= 3, 'Eight Arms: at the start of your turn a tentacle lashes an enemy and catches Block, which lasts the turn', t2)
        await pg.evaluate(CLOSE)
        bn = await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'kraken'); wMovePlayer(p.id, wRoster().length - 1); return " + TURN2 + "; })()")
        check(not bn['lash'], 'from the bench, no tentacle', bn)
        await pg.evaluate(CLOSE)
        # the elf captain's Block at the start of turn 2 lasts the turn now (it was drained right after it was given)
        el = await pg.evaluate("(() => { const e = wAddPlayer(wMakePlayer({ kind: 'elf' }, 'tavern')) || wRoster()[wRoster().length - 1]; const p = wRoster().find(x => x.kind === 'elf'); wMovePlayer(p.id, 0); WG.captain = p.id; return " + TURN2 + "; })()")
        check(el['block'] >= 4, 'the elf captain\'s 4 Block on turn 2 lasts the turn (a turn-start Block drain fixed)', el)
        await pg.evaluate(CLOSE)

        # ---------- the ring, and whole games ----------
        rg = await pg.evaluate("""(() => { W_RING_MODE = 'watch'; wRingBout({ kinds: ['kraken', 'elf'], seed: 2 }); wBX.pause(true);
          const r = { kr: wBX.range(0, 'jab'), elf: wBX.range(1, 'jab') }; wBX.pause(false); wLeaveRing(); return r; })()""")
        check(rg['kr'] > rg['elf'] + .8, 'in the ring its jab lands from much further away', rg)
        await pg.evaluate(CLOSE)
        gm = await pg.evaluate("""(() => { const out = {}; const p = wRoster().find(x => x.kind === 'kraken'); wMovePlayer(p.id, 0);
          out.nine = wNineDef().roster.filter(r => r.kind === 'kraken').map(r => [r.pos, r.ult]);
          const opp = wGridOpp('local', 1), sq = wGridSquad(opp); out.seven = sq.team.roster.some(r => r.kind === 'kraken'); out.gf = Array.isArray(wGF.simGame({ teams: [sq.team, opp], skill: [1, 1] }).score);
          const side = wRingSide(new Set()); out.card = !!wBX.simCard({ sides: [side, wRingOpp(Object.values(WG.rivals)[0], 1, new Set())], skill: [1, 1] }).result;
          while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: 'dwarf' }, 'tavern')); out.ball = wStartBall({ club: 'local', how: 'sim' }); return out; })()""")
        check(gm['nine'] == [['1B', 'eightarms']] and gm['seven'] and gm['gf'] and gm['card'] and gm['ball'] == '', 'it plays first base with Eight Arms, makes the seven, and whole games run in every engine', gm)
        await pg.evaluate(CLOSE)

        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpKraken'); return e ? e.textContent : ''; })()")
        check('Ysolde Wrack' in h and 'Eight Arms' in h, 'How to play explains the Kraken', h)
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
