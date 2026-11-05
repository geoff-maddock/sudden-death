# Realm superstars, phase 3 (issue #24): the Hydra. A kind in every scope, never on a CPU side or a call-up; met
# through Dr. Pell in Graftonbury (locked: the story and the feat; unlocked: 300 gold, or a Moss Egg and a Brine Egg),
# joining at the team's average level with its signature card. Regrow: in a card-game match while it starts, HP grow
# back at the start of a turn after a hit (not from the bench); its captain's Plague; in the ring it grows back far
# more between rounds. Whole games in each engine. How to play. Asserts; exits nonzero.
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
# a match: Team HP falls at the end of turn 1 (a hit), the next turn starts; did Regrow fire, and the captain's Plague
REGROW = """(() => { startMatch({ type: 'normal', tier: 1, card: false, world: { kind: 'wild' } }); RUN.hp = 999; B.hydHp = 999; const psn = alive().every(e => (e.st.psn || 0) >= 3); const n0 = B.log.length;
  RUN.hp -= 10; runSteps(endTurn()); const r = { turn: B.turn, regrow: B.log.slice(n0).some(l => /Regrow: two heads/.test(l.t)), psn };
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
          try { drawFig(cv.getContext('2d'), 'hydra', 100, 190, 160, { color: '#3f8a6a', light: '#d8f0e0', short: 'H' }, { num: 33 }); } catch (e) { drew = String(e); }
          return { drew, name: KIND_NAME.hydra, sig: SIG.hydra, cards: Object.values(CARDS).filter(c => c.kind === 'hydra').length, bx: wBX.kinds.includes('hydra'), gf: wGF.kinds.includes('hydra'),
            bd: wBD.rate('hydra').ult, pos: wBD.rate('hydra').pos, calls: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].some(pos => wBD.kindsAt(pos).includes('hydra')),
            trait: (wBX.traits.hydra || {}).n, gfb: wGF.powerBook.hydra && wGF.powerBook.hydra.ult.n, cap: W_CAPTAIN.hydra && W_CAPTAIN.hydra.n }; })()""")
        check(k['drew'] is True and k['name'] == 'Hydra' and k['sig'] == 'hyd_bite' and k['cards'] == 6, 'the Hydra is a kind: drawn, named, a signature card and five more', k)
        check(k['bx'] and k['gf'] and k['bd'] == 'manyheads' and k['pos'] == 'C' and not k['calls'], 'every engine knows it (catcher, Many Heads on the diamond), and no call-up is ever one', k)
        check(k['trait'] == 'Regrow' and k['gfb'] == 'Regrow' and k['cap'] == 'Venom', 'its nature in the ring, its football ultimate, its captain\'s bonus', k)

        # ---------- the meeting ----------
        lk = await pg.evaluate("""(() => { const t = DB.chars.pell.topics; wRunAct('star:hydra', 'pell'); const b = document.getElementById('modalBox');
          return { job: t.job.t.includes('HYDRA'), act: t.hydra.act, story: b.textContent.includes('shell'), feat: b.textContent.includes('five rare eggs'), buy: !!document.getElementById('wStarGold') }; })()""")
        check(lk == {'job': True, 'act': 'star:hydra', 'story': True, 'feat': True, 'buy': False}, 'Dr. Pell in Graftonbury knows what five shells make; locked, the story and the feat, nothing to buy', lk)
        await pg.evaluate(CLOSE)
        await pg.evaluate("(() => { const S = wStarsAll(); S.un.hydra = '2026-11-05'; localStorage.setItem(wStarsKey(), JSON.stringify(S)); const R = wRoster(); [5, 5, 6].forEach((l, i) => { R[i].lvl = l; }); RUN.gold = 50; wAddItem('mossegg', 1); wAddItem('brineegg', 1); wRunAct('star:hydra', 'pell'); })()")
        pr = await pg.evaluate("({ gold: document.getElementById('wStarGold').disabled, eggs: !document.getElementById('wStarItems').disabled, eggTxt: document.getElementById('wStarItems').textContent })")
        check(pr['gold'] and pr['eggs'] and '1 Moss Egg and 1 Brine Egg' in pr['eggTxt'], 'unlocked: 300 gold (too dear for 50) or a Moss Egg and a Brine Egg', pr)
        await pg.click('#wStarItems')
        sg = await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'hydra'); return { p: p && [p.n, p.lvl, p.star], gold: RUN.gold, eggs: (WG.items.mossegg || 0) + (WG.items.brineegg || 0), star: WG.star, card: !!p && wCardsOf(p.id).some(c => c.id === 'hyd_bite') }; })()")
        check(sg == {'p': ['Threefold', 5, 'hydra'], 'gold': 50, 'eggs': 0, 'star': 'hydra', 'card': True}, 'Threefold joins at level 5 (16 / 3, rounded) for the two eggs, with Triple Bite', sg)
        await pg.evaluate(CLOSE)

        # ---------- Regrow in a match, and the captain ----------
        await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'hydra'); wMovePlayer(p.id, 0); WG.captain = p.id; })()")
        r = await pg.evaluate(REGROW)
        check(r['turn'] == 2 and r['regrow'], 'Regrow: after a hit, HP grow back at the start of your next turn', r)
        check(r['psn'], 'Venom: as captain, every enemy starts with 3 Plague', r)
        await pg.evaluate(CLOSE)
        bn = await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'hydra'); wMovePlayer(p.id, wRoster().length - 1); WG.captain = wRoster()[0].id; const r = " + REGROW + "; wMovePlayer(p.id, 0); return r; })()")
        check(not bn['regrow'], 'from the bench, nothing grows back', bn)
        await pg.evaluate(CLOSE)

        # ---------- the ring: it grows back far more between rounds ----------
        rg = await pg.evaluate("""(() => { W_RING_MODE = 'watch'; wRingBout({ kinds: ['hydra', 'elf'], seed: 8 }); wBX.pause(true); let n = 0;
          while (wBX.phase !== 'round' && n++ < 200) { if (wBX.wait) wBX.call(wBX.wait.plan); wBX.step(); }
          const G = wBX.G; G.powers = false; for (const f of G.F) { f.r.chin = 60; f.think = 99; f.x = f.side ? 6 : -6; f.patches = 0; } G.clock = .2;  // (no cut-man: only the corner's own mending)
          n = 0; while (wBX.phase === 'round' && n++ < 100) { for (const f of G.F) { f.hp = 40; f.hpMax = 100; } wBX.step(); }
          const r = { ph: wBX.phase, hydra: Math.round(G.F[0].hp - 40), elf: Math.round(G.F[1].hp - 40) }; wBX.pause(false); wLeaveRing(); return r; })()""")
        check(rg['ph'] == 'corner' and rg['hydra'] > rg['elf'] * 1.5, 'in the ring it grows back far more between rounds than an elf', rg)
        await pg.evaluate(CLOSE)

        gm = await pg.evaluate("""(() => { const out = {}; const p = wRoster().find(x => x.kind === 'hydra'); wMovePlayer(p.id, 0);
          out.nine = wNineDef().roster.filter(r => r.kind === 'hydra').map(r => [r.pos, r.ult]);
          const opp = wGridOpp('local', 1), sq = wGridSquad(opp); out.seven = sq.team.roster.some(r => r.kind === 'hydra'); out.gf = Array.isArray(wGF.simGame({ teams: [sq.team, opp], skill: [1, 1] }).score);
          const side = wRingSide(new Set()); out.card = !!wBX.simCard({ sides: [side, wRingOpp(Object.values(WG.rivals)[0], 1, new Set())], skill: [1, 1] }).result;
          while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: 'dwarf' }, 'tavern')); out.ball = wStartBall({ club: 'local', how: 'sim' }); return out; })()""")
        check(gm['nine'] == [['C', 'manyheads']] and gm['seven'] and gm['gf'] and gm['card'] and gm['ball'] == '', 'it plays catcher with Many Heads, makes the seven, and whole games run in every engine', gm)
        await pg.evaluate(CLOSE)

        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpHydra'); return e ? e.textContent : ''; })()")
        check('Dr. Pell' in h and 'Regrow' in h, 'How to play explains the Hydra', h)
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
