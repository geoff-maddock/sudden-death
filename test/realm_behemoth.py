# Realm superstars, phase 3 (issue #24): the Behemoth. A kind in every scope, never on a CPU side or a call-up; met
# through Sister Fern in Mossgate (locked: the story and the feat; unlocked: 300 gold or 2 Moss Eggs), joining at the
# team's average level with its signature card. Earthquake: in a card-game match while it starts, on your third and
# sixth turns every enemy is Stunned (not from the bench). Its captain's 12 Block; in the ring, body shots do little; whole
# games in each engine. How to play. Asserts; exits nonzero.
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
# a match to the start of turn 7: on which turns the enemies were Stunned by the quake, and the Block at kickoff
# (against a fixed pair of Kobold Cheer Squads: a random tier-1 draw is sometimes a Goblin Base Thief, who steals home
# on turn 5 and ends the match before the second quake)
QUAKE = """(() => { startMatch({ type: 'normal', tier: 1, card: false, ids: ['cheer', 'cheer'], world: { kind: 'wild' } }); const kick = B.P.block, n0 = B.log.length, at = []; RUN.hp = 999;
  for (let t = 0; t < 6 && !B.over; t++) { runSteps(endTurn()); if (alive().length && alive().every(e => (e.st.stun || 0) > 0)) at.push(B.turn); }
  const r = { kick, at, quake: B.log.slice(n0).filter(l => /Earthquake: the Behemoth stamps/.test(l.t)).length };
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
          try { drawFig(cv.getContext('2d'), 'behemoth', 100, 190, 160, { color: '#3f8a5a', light: '#e8f4c8', short: 'B' }, { num: 70 }); } catch (e) { drew = String(e); }
          return { drew, name: KIND_NAME.behemoth, sig: SIG.behemoth, cards: Object.values(CARDS).filter(c => c.kind === 'behemoth').length, bx: wBX.kinds.includes('behemoth'), gf: wGF.kinds.includes('behemoth'),
            bd: wBD.rate('behemoth').ult, pos: wBD.rate('behemoth').pos, calls: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].some(pos => wBD.kindsAt(pos).includes('behemoth')),
            trait: (wBX.traits.behemoth || {}).n, gfb: wGF.powerBook.behemoth && wGF.powerBook.behemoth.ult.n, cap: W_CAPTAIN.behemoth && W_CAPTAIN.behemoth.n }; })()""")
        check(k['drew'] is True and k['name'] == 'Behemoth' and k['sig'] == 'bhm_stomp' and k['cards'] == 6, 'the Behemoth is a kind: drawn, named, a signature card and five more', k)
        check(k['bx'] and k['gf'] and k['bd'] == 'earthquake' and k['pos'] == '3B' and not k['calls'], 'every engine knows it (third base, Earthquake on the diamond), and no call-up is ever one', k)
        check(k['trait'] == 'Living Wall' and k['gfb'] == 'Earthquake' and k['cap'] == 'Bulwark', 'its nature in the ring, its football ultimate, its captain\'s bonus', k)

        # a superstar's name is its own: on no other kind's list, so the draft class (taverns use it) always finishes
        # (Mossback, the troll's, hung every journey at its first tavern)
        nm = await pg.evaluate("""(() => { const own = W_STARS.filter(s => s.kind).map(s => [s.kind, s.name]);
          const clash = own.filter(([k, n]) => Object.entries(FA_NAMES).some(([k2, L]) => k2 !== k && L.includes(n))).map(x => x[1]);
          let n = 0; for (let i = 0; i < 30; i++) n += genDraftClass().length; return { clash, drafts: n / 30, kinds: Object.keys(KIND_NAME).length }; })()""")
        check(not nm['clash'] and nm['drafts'] == nm['kinds'], 'every superstar\'s name is its own, and the draft class always finishes', nm)

        # ---------- the meeting ----------
        lk = await pg.evaluate("""(() => { const t = DB.chars.fern.topics; wRunAct('star:behemoth', 'fern'); const b = document.getElementById('modalBox');
          return { job: t.job.t.includes('BEHEMOTH'), act: t.behemoth.act, story: b.textContent.includes('breathes'), feat: b.textContent.includes('three legends'), buy: !!document.getElementById('wStarGold') }; })()""")
        check(lk == {'job': True, 'act': 'star:behemoth', 'story': True, 'feat': True, 'buy': False}, 'Sister Fern in Mossgate knows the story; locked, the story and the feat, nothing to buy', lk)
        await pg.evaluate(CLOSE)
        await pg.evaluate("(() => { const S = wStarsAll(); S.un.behemoth = '2026-11-05'; localStorage.setItem(wStarsKey(), JSON.stringify(S)); const R = wRoster(); [5, 5, 6].forEach((l, i) => { R[i].lvl = l; }); RUN.gold = 400; wRunAct('star:behemoth', 'fern'); })()")
        pr = await pg.evaluate("({ gold: !document.getElementById('wStarGold').disabled, eggs: document.getElementById('wStarItems').disabled, eggTxt: document.getElementById('wStarItems').textContent })")
        check(pr['gold'] and pr['eggs'] and 'Moss Egg' in pr['eggTxt'], 'unlocked: 300 gold (400 is enough) or two Moss Eggs (none in the bag)', pr)
        await pg.click('#wStarGold')
        sg = await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'behemoth'); return { p: p && [p.n, p.lvl, p.star], gold: RUN.gold, star: WG.star, card: !!p && wCardsOf(p.id).some(c => c.id === 'bhm_stomp') }; })()")
        check(sg == {'p': ['Hillbreath', 5, 'behemoth'], 'gold': 100, 'star': 'behemoth', 'card': True}, 'Hillbreath joins at level 5 (16 / 3, rounded) for 300 gold, with Stomp', sg)
        await pg.evaluate(CLOSE)

        # ---------- Earthquake in a match, and the captain ----------
        await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'behemoth'); wMovePlayer(p.id, 0); WG.captain = p.id; })()")
        q = await pg.evaluate(QUAKE)
        check(q['at'] == [3, 6] and q['quake'] == 2, 'Earthquake: on your third and sixth turns every enemy is Stunned', q)
        check(q['kick'] >= 12, 'Bulwark: its captain\'s 12 Block at kickoff', q)
        await pg.evaluate(CLOSE)
        bn = await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'behemoth'); wMovePlayer(p.id, wRoster().length - 1); WG.captain = wRoster()[0].id; return " + QUAKE + "; })()")
        check(bn['quake'] == 0, 'from the bench, no quake', bn)
        await pg.evaluate(CLOSE)

        # ---------- the ring: body shots do little ----------
        rg = await pg.evaluate("""(() => { const hit = kind => { let d = 0; for (let i = 0; i < 30; i++) { W_RING_MODE = 'watch'; wRingBout({ kinds: ['minotaur', kind], seed: 40 + i }); wBX.pause(true);
            const G = wBX.G; G.powers = false; G.F[0].x = -1; G.F[1].x = 1; G.F[0].y = G.F[1].y = 0; for (const f of G.F) { f.a = { k: 'idle', t: 0, dur: 0, id: 0 }; f.think = 99; }
            G.F[1].a = { k: 'stun', t: 0, dur: 9, id: 0 }; const h0 = G.F[1].hp; wBX.land(0, 'body'); d += h0 - G.F[1].hp; wBX.pause(false); wLeaveRing(); } return d / 30; };
          return { beh: hit('behemoth'), ogre: hit('ogre') }; })()  // the ogre has the same chin (8)""")
        check(rg['beh'] < rg['ogre'] * .9, 'in the ring body shots do it less harm (Living Wall) than to an ogre of the same chin', rg)
        await pg.evaluate(CLOSE)

        gm = await pg.evaluate("""(() => { const out = {}; const p = wRoster().find(x => x.kind === 'behemoth'); wMovePlayer(p.id, 0);
          out.nine = wNineDef().roster.filter(r => r.kind === 'behemoth').map(r => [r.pos, r.ult]);
          const opp = wGridOpp('local', 1), sq = wGridSquad(opp); out.seven = sq.team.roster.some(r => r.kind === 'behemoth'); out.gf = Array.isArray(wGF.simGame({ teams: [sq.team, opp], skill: [1, 1] }).score);
          const side = wRingSide(new Set()); out.card = !!wBX.simCard({ sides: [side, wRingOpp(Object.values(WG.rivals)[0], 1, new Set())], skill: [1, 1] }).result;
          while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: 'dwarf' }, 'tavern')); out.ball = wStartBall({ club: 'local', how: 'sim' }); return out; })()""")
        check(gm['nine'] == [['3B', 'earthquake']] and gm['seven'] and gm['gf'] and gm['card'] and gm['ball'] == '', 'it plays third base with Earthquake, makes the seven, and whole games run in every engine', gm)
        await pg.evaluate(CLOSE)

        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpBehemoth'); return e ? e.textContent : ''; })()")
        check('Sister Fern' in h and 'Earthquake' in h, 'How to play explains the Behemoth', h)
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
