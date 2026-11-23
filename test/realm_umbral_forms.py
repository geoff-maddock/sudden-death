# Realm: corrupted forms (issue #111, phase E). The Wraith is Half There (the first hit against it each turn does
# nothing; the second lands; it comes back next turn; the damage breakdown says why), the Ogre Won't Flinch (Weak and
# Exposed don't take on it, not even inside the card that put them there), the Spider Queen Webs the Bench (a card in
# your hand costs 1 more this turn, marked Webbed); in the light the same players are themselves. Every Nadir side goes
# to its engine with shade (baseball, football, basketball, hockey, golf, bowling, curling; boxing's fighters in umbral
# form), your side never; a pixel check on the rink: the Nadir's players are drawn differently with it, yours exactly
# the same. How to play and the Quick start name the traits. Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:900]))
    if not ok: FAILS.append(what)
    return ok

# a card match started straight (no card, no scene): the players of ids, on map, the fight's B
FIGHT = """window.__fight = (map, ids, type) => { const keep = beginFight; beginFight = enc => { UI.busy = false; startCombat(enc.ids, enc.type, enc.sport, enc.trait); };
  try { wEnterMap(map, map === 'graftonbury' ? 5 : 40, map === 'graftonbury' ? 11 : 40); RUN.pending = null; B = null; LAB = true;
    startMatch({ type: type || 'normal', ids, tier: 2, world: { kind: 'wild', ref: null, region: 'plains' } }); } finally { LAB = false; beginFight = keep; }
  B.P.block = 0; for (const e of B.enemies) e.block = 0; return B; }; 0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbShrug === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 999; RUN.gold = 500; wSave()")
        await pg.evaluate(FIGHT)

        # ---------- the Wraith: Half There ----------
        wr = await pg.evaluate("""(() => { const out = {};
          const hit = () => { const e = B.enemies[0]; B.energy = 9; B.hand.unshift(mkCard('check')); const h0 = e.hp; playCard(0, 0); return h0 - e.hp; };
          __fight('u:world', ['winger']); const e = B.enemies[0];
          out.umb = !!B.umb; out.phase0 = e.st.u_phase || 0; B.hand.unshift(mkCard('check')); const w = dmgWhy(B.hand[0], e); out.why = w && w.parts.some(p => p[0] === 'Half There' && p[2] === 0) && w.n === 0;
          out.first = hit(); out.phase1 = e.st.u_phase || 0; out.second = hit(); out.log = B.log.map(l => l.t).join(' ');
          runSteps(endTurn()); out.back = e.st.u_phase || 0; out.third = hit();
          __fight('graftonbury', ['winger']); out.light = { phase: B.enemies[0].st.u_phase || 0, first: hit() };
          B = null; RUN.pending = null; return out; })()""")
        check(wr['umb'] and wr['phase0'] == 1 and wr['why'], 'a Wraith on the dark side is Half There, and the damage breakdown shows the first hit is nothing (Half There ×0)', wr)
        check(wr['first'] == 0 and wr['phase1'] == 0 and wr['second'] > 0 and 'Half There' in wr['log'], 'the first hit against it does nothing and spends Half There; the second lands; the log says so', wr)
        check(wr['back'] == 1 and wr['third'] == 0, 'Half There comes back at the start of your next turn', wr)
        check(wr['light']['phase'] == 0 and wr['light']['first'] > 0, 'in the light the same Wraith takes the first hit', wr)

        # ---------- the Ogre: Won't Flinch ----------
        og = await pg.evaluate("""(() => { const out = {};
          __fight('u:world', ['gorlak'], 'elite'); const e = B.enemies[0]; out.still = e.st.u_still || 0;
          B.energy = 9; B.hand.unshift(mkCard('kob_brush')); playCard(0, 0); out.vuln = e.st.vuln || 0;
          B.hand.unshift(mkCard('gob_bunt')); playCard(0, 0); out.weak = e.st.weak || 0;
          // (Exposed laid on inside a card doesn't swell the hit that follows it)
          const c = mkCard('check'), base = atkDmg(6, e, c); addSt(e, 'vuln', 2); out.within = [atkDmg(6, e, c), base, e.st.vuln || 0];
          addSt(e, 'weak', 2); out.swing = [enemyHitDmg(e, 10), e.st.weak || 0];
          out.log = B.log.map(l => l.t).join(' ');
          __fight('graftonbury', ['gorlak'], 'elite'); B.energy = 9; B.hand.unshift(mkCard('kob_brush')); playCard(0, 0); out.light = B.enemies[0].st.vuln || 0;
          B = null; RUN.pending = null; return out; })()""")
        check(og['still'] == 1 and og['vuln'] == 0 and og['weak'] == 0 and "Won't Flinch" in og['log'], "an Ogre on the dark side Won't Flinch: Exposed and Weak from a card don't take, and the log says so", og)
        check(og['within'][0] == og['within'][1] and og['within'][2] == 0 and og['swing'][1] == 0, 'Exposed laid on just before a hit adds nothing to it, and Weak never touches its swing', og)
        check(og['light'] > 0, 'in the light the same Ogre can be Exposed', og)

        # ---------- the Spider Queen: Webs the Bench ----------
        sp = await pg.evaluate("""(() => { const out = {};
          __fight('u:world', ['netspider']); const c = B.hand.find(x => x.uid === B.uWeb);
          out.web = !!c; out.cost = c ? [cardCost(c), def(c).cost] : null; out.others = B.hand.filter(x => x !== c && def(x).cost >= 0).every(x => cardCost(x) === def(x).cost);
          const h = c ? cardHTML(c, { live: true }) : ''; out.face = h.includes('uwebbed') && h.includes('Webbed +1') && h.includes('class="cost');
          out.plain = B.hand.filter(x => x !== c).every(x => !cardHTML(x, { live: true }).includes('uwebbed'));
          out.log = B.log.map(l => l.t).join(' ');
          runSteps(endTurn()); out.next = B.uWeb != null && B.hand.some(x => x.uid === B.uWeb);
          out.snap = JSON.parse(JSON.stringify(B)).uWeb === B.uWeb;
          __fight('graftonbury', ['netspider']); out.light = B.uWeb == null && B.hand.every(x => def(x).cost < 0 || cardCost(x) === def(x).cost);
          B = null; RUN.pending = null; return out; })()""")
        check(sp['web'] and sp['cost'][0] == sp['cost'][1] + 1 and sp['others'] and 'Webs the Bench' in sp['log'], 'a Spider Queen Webs the Bench: one card in your hand costs 1 more this turn, the rest as they were', sp)
        check(sp['face'] and sp['plain'], 'the webbed card says so on its face (Webbed +1); no other card does', sp)
        check(sp['next'] and sp['snap'], 'each of your turns webs a card of the new hand, and it is plain data a save keeps', sp)
        check(sp['light'], 'in the light the same Spider webs nothing', sp)

        # ---------- the Nadir in shadow, in every engine ----------
        en = await pg.evaluate("""(() => { const out = {}, sh = G => G && G.teams ? G.teams.map(t => !!t.shade) : null;
          out.ball = !!wBallOpp(W_UMB4A.club, 4).shade && !wNineDef().shade;
          const gf = wGridOpp(W_UMB4B.club, 4); wGF.start({ teams: [wGridTeams()[0], gf], mode: 'watch', seed: 3 }); out.gf = sh(wGF.G);
          const bk = wCourtOpp(W_UMB4D.club, 4); wBK.start({ teams: [wCourtTeams()[0], bk], seed: 3 }); out.bk = sh(wBK.G);
          const bkf = wCourtOpp(W_UMB4D.finaleClub, 4); out.bkFinale = !!bkf.shade;
          const hk = wRinkOpp(W_UMB4E.club, 4); wHK.start({ teams: [wRinkTeams()[0], hk], seed: 3 }); out.hk = sh(wHK.G);
          const gl = wLinksOpp(W_UMB4F.club, 4); wGL.start({ teams: [wLinksTeams()[0], gl], holes: 3, seed: 3, mode: 'watch' }); out.gl = sh(wGL.G);
          const bl = wLanesOpp(W_UMB4G.club, 4); wBL.start({ teams: [wLanesTeams()[0], bl], seed: 3, mode: 'watch' }); out.bl = sh(wBL.G);
          out.blFinale = !!wLanesOpp(W_UMB4G.finaleClub, 4).shade;
          const cr = wShedOpp(W_UMB4H.club, 4); wCR.start({ teams: [wShedTeams()[0], cr], seed: 3, mode: 'watch' }); out.cr = sh(wCR.G);
          out.crFinale = !!wShedOpp(W_UMB4H.finaleClub, 4).shade;
          // (a light game: nobody in shadow)
          wHK.start({ teams: wRinkTeams(), seed: 3 }); out.light = sh(wHK.G);
          const taken = new Set(), th = wUmbRingSide(W_NADIR.ring, taken); out.ring = th.fighters.every(f => f.umb);
          return out; })()""")
        two = [False, True]
        check(en['ball'] and en['gf'] == two and en['bk'] == two and en['hk'] == two and en['gl'] == two and en['bl'] == two and en['cr'] == two,
              'every Nadir side goes to its engine in shadow (baseball, football, basketball, hockey, golf, bowling, curling), and your side never', en)
        check(en['bkFinale'] and en['blFinale'] and en['crFinale'] and en['ring'], "the finale's Nadir Athletic is in shadow too, and boxing's Nadir fighters are in umbral form", en)
        check(en['light'] == [False, False], 'a light game has nobody in shadow', en)

        # ---------- a pixel check on the rink: theirs drawn differently in shadow, yours the same ----------
        px = await pg.evaluate("""(async () => { const opp = wRinkOpp(W_UMB4E.club, 4), mine = wRinkTeams()[0], plain = Object.assign({}, opp); delete plain.shade;
          const cv = document.querySelector('#v-rink canvas'), out = {};
          const shot = T => { wRinkGame({ seed: 7, teams: [mine, T], mode: 'watch' }); wHK.pause(true); let i = 0; while (wHK.phase !== 'drop' && i++ < 400) wHK.step(1); wHK.step(24); wHK.render();
            const k = cv.width / 960, pl = wHK.play.pl.map(p => ({ side: p.side, s: wHK.scr(p.x, p.y) }));
            const box = s => { const x = Math.round((s.x - 9) * k), y = Math.round((s.y - 44) * k); return Array.from(cv.getContext('2d').getImageData(x, y, Math.round(18 * k), Math.round(40 * k)).data); };
            return { pl, box }; };
          const A = shot(opp), sa = A.pl.map(p => A.box(p.s)), B2 = shot(plain), sb = B2.pl.map(p => B2.box(p.s));
          const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
          // (a player well clear of the other side's, so nothing of theirs is in the box)
          const clear = (i) => A.pl.every((q, j) => q.side === A.pl[i].side || Math.hypot(q.s.x - A.pl[i].s.x, q.s.y - A.pl[i].s.y) > 30);
          out.pos = JSON.stringify(A.pl.map(p => p.s)) === JSON.stringify(B2.pl.map(p => p.s));
          out.mine = A.pl.map((p, i) => [p.side, clear(i), same(sa[i], sb[i])]).filter(r => r[0] === 0 && r[1]).map(r => r[2]);
          out.theirs = A.pl.map((p, i) => [p.side, clear(i), same(sa[i], sb[i])]).filter(r => r[0] === 1 && r[1]).map(r => r[2]);
          wHK.pause(false); showView('world'); return out; })()""")
        check(px['pos'] and len(px['mine']) >= 2 and all(px['mine']), 'on the rink your players are drawn exactly as they were', px)
        check(len(px['theirs']) >= 2 and not any(px['theirs']), "and the Nadir's are drawn differently: in shadow", px)

        # ---------- How to play and the Quick start ----------
        hp = await pg.evaluate("""(() => { renderHelp(); const u = document.getElementById('wHelpUmbForms'), q = wUmbQuick();
          return { help: u ? u.textContent : '', quick: q.steps.map(s => s.h + ': ' + s.t).join(' | ') }; })()""")
        check(all(w in hp['help'] for w in ['Half There', "Won't Flinch", 'Webs the Bench', 'shadow']), 'How to play names the true forms and the three traits', hp)
        check(all(w in hp['quick'] for w in ['Half There', 'Flinch', 'Webs the Bench']), "the Quick start's Umbral tab lists them", hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    if FAILS: print(f'{len(FAILS)} failed'); sys.exit(1)
    print('all ok')

asyncio.run(main())
