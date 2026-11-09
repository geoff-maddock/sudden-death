# Realm superstars, phase 3 (issue #24): the Djinn. A kind in every scope, never on a CPU side or a call-up; met
# through Ingrith Skarr in Rimewatch (locked: the story and the feat; unlocked: 300 gold or 2 Meadow Eggs), joining at
# the team's average level with its signature card. Three Wishes: in a card-game match while it starts, the wish the
# moment needs at kickoff (HP back when low, a storm against three, else Strength; not from the bench); in the ring,
# the ultimate grants health, a heavy blow or speed by the moment. Whole games in each engine. How to play. Asserts; exits nonzero.
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
# a match (three plain enemies when n is 3) and the wish the Djinn granted at kickoff: { wish, hp, str, foes (their HP lost) }
WISH = """(n => { const ids = n === 3 ? Object.keys(ENEMIES).filter(id => !ENEMIES[id].boss && !ENEMIES[id].elite && !ENEMIES[id].team && !ENEMIES[id].ai.quarters).slice(0, 3) : undefined;
  const hp0 = RUN.hp; startMatch(Object.assign({ type: 'normal', tier: 1, card: false, world: { kind: 'wild' } }, ids ? { ids } : {}));
  const r = { wish: B.djnWish || null, hp: RUN.hp - hp0, str: B.P.st.str || 0, foes: B.enemies.length, hurt: B.enemies.every(e => e.hp < e.max) };
  B.forfeit = 1; B.over = 'lose'; finishFight(); RUN.hp = RUN.maxhp; return r; })"""

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
          try { drawFig(cv.getContext('2d'), 'djinn', 100, 190, 160, { color: '#6a4ab8', light: '#e8dcff', short: 'D' }, { num: 3 }); } catch (e) { drew = String(e); }
          return { drew, name: KIND_NAME.djinn, sig: SIG.djinn, cards: Object.values(CARDS).filter(c => c.kind === 'djinn').length, bx: wBX.kinds.includes('djinn'), gf: wGF.kinds.includes('djinn'),
            bd: wBD.rate('djinn').ult, pos: wBD.rate('djinn').pos, calls: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].some(pos => wBD.kindsAt(pos).includes('djinn')),
            trait: (wBX.traits.djinn || {}).n, gfb: wGF.powerBook.djinn && wGF.powerBook.djinn.ult.n, cap: W_CAPTAIN.djinn && W_CAPTAIN.djinn.n }; })()""")
        check(k['drew'] is True and k['name'] == 'Djinn' and k['sig'] == 'djn_wish' and k['cards'] == 6, 'the Djinn is a kind: drawn, named, a signature card and five more', k)
        check(k['bx'] and k['gf'] and k['bd'] == 'threewishes' and k['pos'] == 'SS' and not k['calls'], 'every engine knows it (shortstop, Three Wishes on the diamond), and no call-up is ever one', k)
        check(k['trait'] == 'Smoke and Mirrors' and k['gfb'] == 'Three Wishes' and k['cap'] == 'Glamour', 'its nature in the ring, its football ultimate, its captain\'s bonus', k)

        # ---------- the meeting ----------
        lk = await pg.evaluate("""(() => { const t = DB.chars.ingrith.topics; wRunAct('star:djinn', 'ingrith'); const b = document.getElementById('modalBox');
          return { job: t.job.t.includes('DJINN'), act: t.djinn.act, story: b.textContent.includes('lamp'), feat: b.textContent.includes('Road to Nowhere'), buy: !!document.getElementById('wStarGold') }; })()""")
        check(lk == {'job': True, 'act': 'star:djinn', 'story': True, 'feat': True, 'buy': False}, 'Ingrith Skarr in Rimewatch knows of the lamp; locked, the story and the feat, nothing to buy', lk)
        await pg.evaluate(CLOSE)
        await pg.evaluate("(() => { const S = wStarsAll(); S.un.djinn = '2026-11-05'; localStorage.setItem(wStarsKey(), JSON.stringify(S)); const R = wRoster(); [5, 5, 6].forEach((l, i) => { R[i].lvl = l; }); RUN.gold = 400; wRunAct('star:djinn', 'ingrith'); })()")
        pr = await pg.evaluate("({ gold: !document.getElementById('wStarGold').disabled, eggs: document.getElementById('wStarItems').disabled, eggTxt: document.getElementById('wStarItems').textContent })")
        check(pr['gold'] and pr['eggs'] and 'Meadow Egg' in pr['eggTxt'], 'unlocked: 300 gold (400 is enough) or two Meadow Eggs (none in the bag)', pr)
        await pg.click('#wStarGold')
        sg = await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'djinn'); return { p: p && [p.n, p.lvl, p.star], gold: RUN.gold, star: WG.star, card: !!p && wCardsOf(p.id).some(c => c.id === 'djn_wish') }; })()")
        check(sg == {'p': ['Zarim', 5, 'djinn'], 'gold': 100, 'star': 'djinn', 'card': True}, 'Zarim joins at level 5 (16 / 3, rounded) for 300 gold, with Wish', sg)
        await pg.evaluate(CLOSE)

        # ---------- Three Wishes in a match ----------
        await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'djinn'); wMovePlayer(p.id, 0); WG.captain = wRoster()[1].id; })()")
        w = {}
        w['str'] = await pg.evaluate(WISH + "(1)"); await pg.evaluate(CLOSE)
        w['storm'] = await pg.evaluate(WISH + "(3)"); await pg.evaluate(CLOSE)
        w['heal'] = await pg.evaluate("(() => { RUN.hp = Math.floor(RUN.maxhp / 3); return " + WISH + "(1); })()"); await pg.evaluate(CLOSE)
        check(w['str']['wish'] == 'str' and w['str']['str'] >= 2, 'Three Wishes: with nothing else needed, 2 Strength at kickoff', w)
        check(w['storm']['wish'] == 'storm' and w['storm']['foes'] == 3 and w['storm']['hurt'], 'against three, a storm: damage to every enemy', w)
        check(w['heal']['wish'] == 'heal' and w['heal']['hp'] >= 12, 'with Team HP under half, 12 HP back', w)
        bn = await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'djinn'); wMovePlayer(p.id, wRoster().length - 1); const r = " + WISH + "(1); wMovePlayer(p.id, 0); return r; })()")
        check(bn['wish'] is None, 'from the bench, no wish', bn)
        await pg.evaluate(CLOSE)

        # ---------- the ring: the wish the moment needs ----------
        rg = await pg.evaluate("""(() => { const wish = set => { W_RING_MODE = 'watch'; wRingBout({ kinds: ['djinn', 'ogre'], seed: 6 }); wBX.pause(true); let n = 0;
            while (wBX.phase !== 'round' && n++ < 200) { if (wBX.wait) wBX.call(wBX.wait.plan); wBX.step(); }
            const G = wBX.G, f = G.F[0], o = G.F[1]; for (const x of G.F) { x.a = { k: 'idle', t: 0, dur: 0, id: 0 }; x.think = 99; x.fx = []; x.spirit = 100; } f.sta = f.staMax; set(f, o);
            const hp = [f.hp, o.hp]; wBX.cast(0, 'ult'); const r = { me: Math.round(f.hp - hp[0]), them: Math.round(hp[1] - o.hp), quick: f.fx.some(x => x.spd > 1) }; wBX.pause(false); wLeaveRing(); return r; };
          return { hurt: wish((f, o) => { f.hp = 30; }), theyHurt: wish((f, o) => { o.hp = 30; }), fine: wish(() => {}) }; })()""")
        check(rg['hurt']['me'] >= 20 and rg['theyHurt']['them'] >= 10 and rg['fine']['quick'] and not rg['fine']['me'] and not rg['fine']['them'],
              'in the ring Three Wishes grants health when it is hurt, a heavy blow when they are, and speed otherwise', rg)
        await pg.evaluate(CLOSE)

        gm = await pg.evaluate("""(() => { const out = {}; const p = wRoster().find(x => x.kind === 'djinn'); wMovePlayer(p.id, 0);
          out.nine = wNineDef().roster.filter(r => r.kind === 'djinn').map(r => [r.pos, r.ult]);
          const opp = wGridOpp('local', 1), sq = wGridSquad(opp); out.seven = sq.team.roster.some(r => r.kind === 'djinn'); out.gf = Array.isArray(wGF.simGame({ teams: [sq.team, opp], skill: [1, 1] }).score);
          const side = wRingSide(new Set()); out.card = !!wBX.simCard({ sides: [side, wRingOpp(Object.values(WG.rivals)[0], 1, new Set())], skill: [1, 1] }).result;
          while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: 'dwarf' }, 'tavern')); out.ball = wStartBall({ club: 'local', how: 'sim' }); return out; })()""")
        check(gm['nine'] == [['SS', 'threewishes']] and gm['seven'] and gm['gf'] and gm['card'] and gm['ball'] == '', 'it plays shortstop with Three Wishes, makes the seven, and whole games run in every engine', gm)
        await pg.evaluate(CLOSE)

        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpDjinn'); return e ? e.textContent : ''; })()")
        check('Ingrith Skarr' in h and 'Three Wishes' in h, 'How to play explains the Djinn', h)
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
