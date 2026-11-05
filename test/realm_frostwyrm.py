# Realm superstars, phase 3 (issue #24): the Frost Wyrm (id wyrm, kind frostwyrm). A kind in every scope, never on a CPU side or a call-up; met
# through Jory Farsight in Rimewatch (locked: the story and the feat; unlocked, the costliest: 500 gold or 3 Rime
# Eggs), joining at the team's average level with its signature card. Blizzard: in a card-game match while it starts,
# every enemy Weak and Exposed at kickoff (not from the bench); its captain's kickoff; its own portrait, not the Seam
# Wyrm boss's. Whole games in each engine. How to play. Asserts; exits nonzero.
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
# a match: is every enemy Weak and Exposed at kickoff, and the captain's kickoff
SNOW = """(() => { startMatch({ type: 'normal', tier: 1, card: false, world: { kind: 'wild' } });
  const r = { snow: alive().every(e => (e.st.weak || 0) >= 2 && (e.st.vuln || 0) >= 2), block: B.P.block, str: B.P.st.str || 0, dex: B.P.st.dex || 0 };
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
          try { drawFig(cv.getContext('2d'), 'frostwyrm', 100, 190, 160, { color: '#4a7ab8', light: '#d8ecff', short: 'W' }, { num: 9 }); } catch (e) { drew = String(e); }
          return { drew, name: KIND_NAME.frostwyrm, sig: SIG.frostwyrm, cards: Object.values(CARDS).filter(c => c.kind === 'frostwyrm').length, bx: wBX.kinds.includes('frostwyrm'), gf: wGF.kinds.includes('frostwyrm'),
            bd: wBD.rate('frostwyrm').ult, pos: wBD.rate('frostwyrm').pos, calls: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].some(pos => wBD.kindsAt(pos).includes('frostwyrm')),
            trait: (wBX.traits.frostwyrm || {}).n, gfb: wGF.powerBook.frostwyrm && wGF.powerBook.frostwyrm.ult.n, cap: W_CAPTAIN.frostwyrm && W_CAPTAIN.frostwyrm.n }; })()""")
        check(k['drew'] is True and k['name'] == 'Frost Wyrm' and k['sig'] == 'wyr_breath' and k['cards'] == 6, 'the Frost Wyrm is a kind: drawn, named, a signature card and five more', k)
        check(k['bx'] and k['gf'] and k['bd'] == 'whiteout' and k['pos'] == 'RF' and not k['calls'], 'every engine knows it (right field, Whiteout on the diamond), and no call-up is ever one', k)
        check(k['trait'] == 'Frozen Heart' and k['gfb'] == 'Whiteout' and k['cap'] == "Winter's Crown", 'its nature in the ring, its football ultimate, its captain\'s bonus', k)

        # ---------- the meeting ----------
        lk = await pg.evaluate("""(() => { const t = DB.chars.watcher.topics; wRunAct('star:wyrm', 'watcher'); const b = document.getElementById('modalBox');
          return { job: t.job.t.includes('WYRM'), act: t.wyrm.act, story: b.textContent.includes('peaks'), feat: b.textContent.includes('Win the Crown'), buy: !!document.getElementById('wStarGold') }; })()""")
        check(lk == {'job': True, 'act': 'star:wyrm', 'story': True, 'feat': True, 'buy': False}, 'Jory Farsight in Rimewatch has seen it circle the peaks; locked, the story and the feat, nothing to buy', lk)
        await pg.evaluate(CLOSE)
        await pg.evaluate("(() => { const S = wStarsAll(); S.un.wyrm = '2026-11-05'; localStorage.setItem(wStarsKey(), JSON.stringify(S)); const R = wRoster(); [5, 5, 6].forEach((l, i) => { R[i].lvl = l; }); RUN.gold = 450; wAddItem('rimeegg', 3); wRunAct('star:wyrm', 'watcher'); })()")
        pr = await pg.evaluate("({ gold: document.getElementById('wStarGold').disabled, eggs: !document.getElementById('wStarItems').disabled, gtxt: document.getElementById('wStarGold').textContent, eggTxt: document.getElementById('wStarItems').textContent })")
        check(pr['gold'] and pr['eggs'] and '3 Rime Eggs' in pr['eggTxt'] and '500 gold' in pr['gtxt'], 'unlocked, the costliest: 500 gold (too dear for 450) or three Rime Eggs', pr)
        await pg.click('#wStarItems')
        sg = await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'frostwyrm'); return { p: p && [p.n, p.lvl, p.star], gold: RUN.gold, eggs: WG.items.rimeegg || 0, star: WG.star, card: !!p && wCardsOf(p.id).some(c => c.id === 'wyr_breath') }; })()")
        check(sg == {'p': ['Hoarfang', 5, 'wyrm'], 'gold': 450, 'eggs': 0, 'star': 'wyrm', 'card': True}, 'Hoarfang joins at level 5 (16 / 3, rounded) for the three eggs, with Frost Breath', sg)
        await pg.evaluate(CLOSE)

        # ---------- Blizzard in a match, and the captain ----------
        await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'frostwyrm'); wMovePlayer(p.id, 0); WG.captain = p.id; })()")
        r = await pg.evaluate(SNOW)
        check(r['snow'], 'Blizzard: every enemy starts Weak and Exposed for two turns', r)
        check(r['block'] >= 5 and r['str'] >= 1 and r['dex'] >= 1, "Winter's Crown: as captain, 1 Strength, 1 Footwork and 5 Block at kickoff", r)
        await pg.evaluate(CLOSE)
        bn = await pg.evaluate("(() => { const p = wRoster().find(x => x.kind === 'frostwyrm'); wMovePlayer(p.id, wRoster().length - 1); WG.captain = wRoster()[0].id; const r = " + SNOW + "; wMovePlayer(p.id, 0); return r; })()")
        check(not bn['snow'], 'from the bench, no snow', bn)
        await pg.evaluate(CLOSE)

        # ---------- its own portrait, not the Seam Wyrm boss's ----------
        pt = await pg.evaluate("(() => ({ differ: portraitURL('frostwyrm', wPartyTeam(), 9, 64) !== portraitURL('wyrm', wPartyTeam(), 9, 64) }))()")
        check(pt['differ'], "its portrait is its own, not the Seam Wyrm boss's", pt)

        gm = await pg.evaluate("""(() => { const out = {}; const p = wRoster().find(x => x.kind === 'frostwyrm'); wMovePlayer(p.id, 0);
          out.nine = wNineDef().roster.filter(r => r.kind === 'frostwyrm').map(r => [r.pos, r.ult]);
          const opp = wGridOpp('local', 1), sq = wGridSquad(opp); out.seven = sq.team.roster.some(r => r.kind === 'frostwyrm'); out.gf = Array.isArray(wGF.simGame({ teams: [sq.team, opp], skill: [1, 1] }).score);
          const side = wRingSide(new Set()); out.card = !!wBX.simCard({ sides: [side, wRingOpp(Object.values(WG.rivals)[0], 1, new Set())], skill: [1, 1] }).result;
          while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: 'dwarf' }, 'tavern')); out.ball = wStartBall({ club: 'local', how: 'sim' }); return out; })()""")
        check(gm['nine'] == [['RF', 'whiteout']] and gm['seven'] and gm['gf'] and gm['card'] and gm['ball'] == '', 'it plays right field with Whiteout, makes the seven, and whole games run in every engine', gm)
        await pg.evaluate(CLOSE)

        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpWyrm'); return e ? e.textContent : ''; })()")
        check('Jory Farsight' in h and 'Blizzard' in h and 'Whiteout' in h, 'How to play explains the Frost Wyrm', h)
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
