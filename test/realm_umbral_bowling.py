# Realm: bowling in the Umbral (issue #99, phase 4g). Tier U at the lanes (tier 4: the rating bonus, the Lich bowling,
# a full bag), bowling's hexes (each does what it says, none changes a game without them), and the Drowned Lanes'
# champion end to end: PLAY opens the card with the hexes, the first frame starts the Realm's bowling match at tier U
# with them (named in the log, before the first frame, on the scoreboard and the bar), it saves and resumes (after a
# reload too), a win pays the Drowned Pin and a loss counts a try; the toll is paid once, at the first ball; backing
# away from the card costs nothing; Simulate plays the same game; a finale round plays through the same adapter with the
# finale's count of hexes; and a Hardcore journey lost in a finale round ends on the end screen, uncovered.
# Asserts; exits nonzero on failure.
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

# seeded Math.random for the page: the fives drawn for a check are the same every run
SEEDR = "(n => { let q = n >>> 0; Math.random = () => { q = (Math.imul(q, 1103515245) + 12345) >>> 0; return (q >>> 8) / 16777216; }; })"
# a five of kinds the engine knows, as the engine takes them
FIVE = "const five = (n, kinds) => ({ name: n, short: n, roster: (kinds || ['elf', 'spider', 'gorgon', 'dwarf', 'witch']).map(k => ({ n: n + ' ' + k, kind: k })) });"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbBlFive === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; for (const k in MAPS) delete MAPS[k]")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("""wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 200; RUN.gold = 500;
          const ks = ['elf', 'spider', 'gorgon', 'dwarf'].filter(k => !wRoster().some(p => p.kind === k));
          while (wRoster().length < 5 && ks.length) wRecruit({ kind: ks.pop(), lvl: 6 }, 'tavern');
          for (const p of wRoster()) { p.lvl = 6; delete p.bl; wBlOf(p); } wFiveSync(); wSave()""")

        # ---------- tier U in the tables ----------
        tb = await pg.evaluate("""({ bonus: Object.assign({}, W_LNG.oppBonus), skill: [1, 2, 3, 4].map(t => wLanesSkillOf(t)), name: W_BALL_SKILL[wLanesSkillOf(4)[1]], eng: wBL.skills[3] && wBL.skills[3].n,
          bag: W_LANES_KIT.opp[4], pots: Object.keys(wBL.potions), tiers: [1, 2, 3].map(t => JSON.stringify(W_LANES_KIT.opp[t])),
          spread: [2, 3].map(k => [wBL.skills[k].ang, wBL.skills[k].mph, wBL.skills[k].rpm]) })""")
        check(tb['bonus']['1'] == 1 and tb['bonus']['2'] == 1 and tb['bonus']['3'] == 1 and '4' in tb['bonus'] and tb['skill'] == [[1, 0], [1, 1], [1, 2], [1, 3]] and tb['name'] == 'Lich' and tb['eng'] == 'Lich',
              'tier U is a fourth row: its rating bonus, the Lich (skill 3, the engine\'s fourth bowler); tiers 1 to 3 as they were', tb)
        check(sorted(tb['bag'].keys()) == sorted(tb['pots']) and all(v >= 1 for v in tb['bag'].values()), 'their side brings a full bag at tier U', tb)
        check(tb['spread'][0] == tb['spread'][1], 'the Lich\'s release strays exactly as an Archmage\'s (it decides better, it throws no better)', tb['spread'])

        # ---------- the Lich decides, not just a label ----------
        lc = await pg.evaluate(FIVE + """(() => { const out = { diff: 0, plans: 0, lines: {} };
          // the same moments, two bowlers: the Lich often bowls another ball than the Archmage would (another stand, aim, speed or line)
          for (let i = 0; i < 6; i++) { wBL.start({ seed: 40 + i, teams: [five('A'), five('B')], skill: [1, 3], hall: true, powers: true, mode: 'watch' }); const G = wBL.G;
            for (let k = 0; k < 40 && !G.over; k++) {
              if (wBL.up() === 1) { const J = q => JSON.stringify([q.x0.toFixed(2), q.ang.toFixed(3), (+q.mph).toFixed(2), q.ball]); const ln = G.line[1];
                G.skill[1] = 2; const a = J(wBL.plan(1)); G.skill[1] = 3; const b = J(wBL.plan(1)); G.line[1] = ln; out.plans++; if (a !== b) out.diff++; }
              if (!wBL.turn()) break; if (wBL.up() !== 1 && G.line) out.lines[G.line[1]] = (out.lines[G.line[1]] || 0) + 1; } }
          // and over the same seeded games against a Knight it strikes more, and scores more, than the Archmage
          for (const sk of [2, 3]) { let x = 0, f = 0, sc = 0, sp = 0, st = 0; for (let i = 0; i < 90; i++) { const r = wBL.simGame({ seed: 2000 + i, teams: [five('A'), five('B')], skill: [1, sk], hall: true, powers: true }); x += r.st[1].strikes; f += r.st[1].firsts; sc += r.game[1]; sp += r.st[1].spares; st += r.st[1].spareTries; }
            out[sk] = { strikes: +(100 * x / f).toFixed(1), score: +(sc / 90).toFixed(1), spares: +(100 * sp / st).toFixed(1) }; }
          return out; })()""")
        check(lc['plans'] >= 30 and lc['diff'] >= lc['plans'] * 0.2, 'the Lich weighs its balls: at the same moments it often bowls another stand, aim or speed than an Archmage', lc)
        check(lc['3']['strikes'] > lc['2']['strikes'] and lc['3']['score'] > lc['2']['score'], 'and over the same seeded games it strikes more and scores more than the Archmage', lc)

        # ---------- hexes ----------
        hx = await pg.evaluate(SEEDR + "(99); " + FIVE + """(() => { const out = {}, J = x => JSON.stringify(x), T = () => [five('A'), five('B', ['zombie', 'wraith', 'lich', 'skeleton', 'troll'])];
          const sim = o => { const g = wBL.simGame(Object.assign({ teams: T() }, o)); return J([g.win, g.game, g.marks, g.st, g.casts, g.pots, g.balls]); };
          out.ids = Object.keys(wBL.hexes);
          out.same = sim({ seed: 21, skill: [1, 3], powers: true, hall: true }) === sim({ seed: 21, skill: [1, 3], powers: true, hall: true, hexes: [] })
            && sim({ seed: 22, skill: [1, 2], hall: true }) === sim({ seed: 22, skill: [1, 2], hall: true, hexes: ['nothing'] });
          wBL.start({ seed: 5, teams: T(), mode: 'watch' }); out.noHex = wBL.hex();
          // each changes the game it is in (on your side), and none changes it on the other side's balls alone
          out.changes = {}; for (const h of out.ids) out.changes[h] = [31, 32, 33, 34, 35, 36].some(sd => sim({ seed: sd, skill: [1, 2], hall: true, hexes: [h] }) !== sim({ seed: sd, skill: [1, 2], hall: true }));
          // The Ichor Oil: your ball takes about three times the oil off the lane; theirs as ever
          const took = (hexes, on) => { wBL.start({ seed: 7, teams: T(), lead: 0, mode: 'watch', hexes, hexOn: on }); const G = wBL.G, sum = a => a.reduce((x, y) => x + y, 0), l = wBL.lane(0), b0 = sum(G.oil[l]); wBL.turn(); return b0 - sum(G.oil[l]); };
          out.ichor = { plain: +took([]).toFixed(3), mine: +took(['ichor'], 0).toFixed(3), theirs: +took(['ichor'], 1).toFixed(3) };
          // The Black Tide: your ball skids on heavier oil than it looks (the same throw comes in elsewhere); theirs not
          const first = (hexes, on) => { wBL.start({ seed: 9, teams: T(), lead: 0, mode: 'watch', hexes, hexOn: on }); return wBL.turn().ball.x; };
          out.tide = { plain: first([]), mine: first(['tide'], 0), theirs: first(['tide'], 1) };
          // The Hungry Gutters: a ball near the edge drifts into the gutter; one up the middle doesn't feel it
          const oil = wBL.house(), edge = { x0: -18, ang: -.05, mph: 17, rpm: 300, ball: 'spare', hand: 1 }, mid = { x0: 0, ang: 0, mph: 17, rpm: 300, ball: 'spare', hand: 1 }, P = { pull: { w: wBL.hexes.pull.w, k: wBL.hexes.pull.k } };
          const e0 = wBL.ball(edge, oil, 'mid'), e1 = wBL.ball(Object.assign({}, edge, P), oil, 'mid'), m0 = wBL.ball(mid, oil, 'mid'), m1 = wBL.ball(Object.assign({}, mid, P), oil, 'mid');
          out.pull = { edge0: [e0.x, e0.gutter], edge1: [e1.x, e1.gutter], mid: m0.x === m1.x && m0.gutter === m1.gutter };
          // The Waterlogged Pin: one pin of your frame, the same for both its balls; heavier, it stays up more often
          wBL.start({ seed: 11, teams: T(), lead: 0, mode: 'watch', hexes: ['drown'] }); const G = wBL.G, pins = [];
          for (let k = 0; k < 60 && !G.over; k++) { if (wBL.up() === 0) pins.push([wBL.frameNo(0), wBL.hexPin(0)]); wBL.turn(); }
          const byF = {}; for (const [f, n] of pins) (byF[f] = byF[f] || new Set()).add(n);
          out.drown = { frames: Object.keys(byF).length, onePerFrame: Object.values(byF).every(s => s.size === 1), kinds: new Set(pins.map(x => x[1])).size, inRack: pins.every(x => x[1] >= 1 && x[1] <= 10) };
          let up0 = 0, up1 = 0; for (let s = 0; s < 60; s++) { const b = { m: 0, v: 9 * 17.6, spin: 0, hand: 1 }; if (!wBL.deck([10], Object.assign({ x: -18 + 5.5 + (s % 12) * .09 }, b), s).down.length) up0++; if (!wBL.deck([10], Object.assign({ x: -18 + 5.5 + (s % 12) * .09, drown: 10, drownK: wBL.hexes.drown.k }, b), s).down.length) up1++; }
          out.drown.up = [up0, up1];
          // named before the first frame, and kept in the snapshot
          wBL.start({ seed: 12, teams: T(), mode: 'watch', hexes: ['tide', 'drown'] }); out.msg = wBL.msg; out.line = wBL.hexLine(); out.snap = wBL.snapshot().G.hex;
          return out; })()""")
        check(hx['same'] and hx['noHex'] is None, 'no hexes (or none the engine knows) and the game is the same game, seed for seed', hx)
        check(sorted(hx['ids']) == ['drown', 'ichor', 'pull', 'tide'], 'bowling has four hexes', hx['ids'])
        check(all(hx['changes'].values()), 'each hex changes the game it is in', hx['changes'])
        I = hx['ichor']
        check(I['mine'] > I['plain'] * 1.6 and abs(I['theirs'] - I['plain']) < 1e-9, 'The Ichor Oil: your ball takes far more oil off the lane; their side\'s hex leaves your ball as it was', I)
        Tt = hx['tide']
        check(Tt['mine'] != Tt['plain'] and Tt['theirs'] == Tt['plain'], 'The Black Tide: the same throw of yours comes in elsewhere on the heavier oil; on their side it leaves yours alone', Tt)
        Pu = hx['pull']
        check(Pu['mid'] and (Pu['edge1'][1] is not None and Pu['edge0'][1] is None or abs(Pu['edge1'][0]) > abs(Pu['edge0'][0]) + 1), 'The Hungry Gutters: a ball near the edge is pulled toward the gutter; one up the middle is not', Pu)
        D = hx['drown']
        check(D['frames'] >= 5 and D['onePerFrame'] and D['kinds'] >= 3 and D['inRack'] and D['up'][1] > D['up'][0], 'The Waterlogged Pin: one pin a frame (the same for both balls, a different one from frame to frame), heavier, and it stays up more', D)
        check('Hexes on' in hx['msg'] and 'The Black Tide' in hx['msg'] and 'The Waterlogged Pin' in hx['line'] and hx['snap'] == {'ids': ['tide', 'drown'], 'on': 0}, 'the hexes are named before the first frame, and kept in the snapshot', hx)

        # ---------- the champion ----------
        ch = await pg.evaluate("""(() => { const C = W_NADIR.lanes, ch = DB.chars[C.char], T = wUmbBlFive(6);
          const ids = Object.values(wBL.ult).map(x => x.id).concat(Object.values(wBL.pow).flat().map(x => x.id), Object.values(wBL.pow2).flat().map(x => x.id), Object.values(wBL.potions).map(x => x.id).filter(Boolean));
          wBL.start({ teams: [{ name: 'Us', roster: T.roster }, T], mode: 'watch' }); const ci = T.roster.findIndex(m => m.ult);
          return { C, greet: ch.greet, play: ch.topics.play.act, words: JSON.stringify(ch).toLowerCase(), map: !!MAPS[C.map] && MAPS[C.map].npcs.some(n => n.id === C.char), team: T.name,
            champ: T.roster.filter(m => m.ult).map(m => [m.n, m.ult]), ult: wBL.ultOwn.drownbell && wBL.ultOwn.drownbell.n, cast: wBL.ultOf(1, ci).id, plain: wBL.ultOf(1, (ci + 1) % 5).id,
            clash: ids.includes('drownbell') || Object.keys(wBL.hexes).some(h => ids.includes(h)), n: T.roster.length, h1: wUmbBlHexes('lanes', 1), h2: wUmbBlHexes('lanes', 1), audit: wAudit() }; })()""")
        C = ch['C']
        check(C['ground'] == 'g_lanes' and C['map'] == 'u:g_lanes' and C['region'] == 'tide' and C['engine'] == 'lanes' and C['piece'] == 'bowling' and C['hexes'] in (1, 2) and ch['map'],
              'the Drowned Lanes\' champion holds the Drowned Pin and stands on the dark ground', ch)
        check('PLAY' in ch['greet'] and 'RULES' in ch['greet'] and ch['play'] == 'unadir:lanes' and ch['n'] == 5 and ch['champ'] == [['Ossery Brine', 'drownbell']] and ch['ult'] == 'The Drowning Bell' and ch['cast'] == 'drownbell' and ch['plain'] != 'drownbell' and not ch['clash'],
              'they say PLAY and RULES, field the Nadir five, the champion with an ultimate of their own (an id nobody else has)', ch)
        check(not any(w in ch['words'] for w in ['chimera', 'snare', 'handler', 'gene lab', 'species', 'specimen', 'company']), 'the champion speaks in realm words', ch['words'][:200])
        check(ch['h1'] == ch['h2'] and len(ch['h1']) == C['hexes'], 'the hexes for a try are fixed (a reload draws the same)', ch)
        check(ch['audit'] == [], 'the audit is clean', ch['audit'])

        # PLAY, past the guards and the gate: the card, then the first frame
        await pg.evaluate("""WG.umbral.guards = { 'g_lanes:0': WG.dayAbs, 'g_lanes:1': WG.dayAbs }; WG.umbral.gates = { lanes: WG.dayAbs };
          window.__ft = []; const ft = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t) { if (typeof t === 'string' && t.includes('Hex')) window.__ft.push(t); return ft.apply(this, arguments); };
          wRunAct('unadir:lanes', 'nadir_lanes')""")
        await pg.wait_for_function("!!document.querySelector('[data-ubl]')")
        cd = await pg.evaluate("""(() => { const t = document.getElementById('modalBox').textContent, hx = wUmbBlHexes('lanes', W_NADIR.lanes.hexes);
          return { tierU: t.includes('tier U'), lich: t.includes('Lich'), hexes: hx.every(h => t.includes(wBL.hexes[h].n)), hx, free: t.includes('first game is free'), bell: t.includes('The Drowning Bell') }; })()""")
        check(cd['tierU'] and cd['lich'] and cd['hexes'] and cd['free'] and cd['bell'], 'PLAY opens the game card: tier U, the Lich, the champion\'s bell, the hexes for this try, the first game free', cd)
        await pg.click('[data-ubl="manage"]')
        await pg.wait_for_function("UI.view === 'lanes' && wLanesLive() && !!WG.lng.live.snap", timeout=30000)
        gm = await pg.evaluate("""(() => { const G = wBL.G, W = WG.lng.live.world;
          return { tier: W.tier, kind: W.kind, club: W.club, skill: G.skill, hex: wBL.hex(), opp: G.teams[1].name, bag: G.bags[1], log: WLOG.slice(-8).map(l => l[0]).join(' | '), champ: G.teams[1].roster.some(m => m.ult === 'drownbell'),
            note: document.getElementById('wLanesNote').textContent, snap: WG.lng.live.snap.G.hex }; })()""")
        check(gm['tier'] == 4 and gm['kind'] == 'unadirbl' and gm['skill'] == [1, 3] and gm['opp'] == 'Drowned Lanes Nadir' and sorted(gm['bag'].keys()) == sorted(tb['pots']) and gm['champ'],
              'the first frame starts the Realm\'s bowling match at tier U against the Nadir five: the Lich, a full bag, the champion\'s own ultimate', gm)
        check(gm['hex'] and gm['hex']['ids'] == cd['hx'] and gm['hex']['on'] == 0 and gm['snap'] == gm['hex'] and 'draws the hexes' in gm['log'] and 'Hexes' in gm['note'], 'the drawn hexes are on the match (and its snapshot), named in the log and on the bar', gm)
        await pg.wait_for_function("window.__ft.some(t => t.includes('Hexes on'))")
        ft = await pg.evaluate("window.__ft.filter(t => t.includes('Hexes on')).slice(-1)[0]")
        names = await pg.evaluate("wBL.hex().ids.map(h => wBL.hexes[h].n)")
        check(all(n in ft for n in names), 'the hexes are on the scoreboard', ft)

        # save and leave, then resume: the hexes and the Lich come back with it
        rs = await pg.evaluate("""(() => { wLanesLeaveGame(); const out = { left: UI.view, live: wLanesLive() }; wResumeLanes(); const G = wBL.G;
          return Object.assign(out, { back: UI.view, skill: G.skill, hex: wBL.hex() && wBL.hex().ids, kind: WG.lng.live && WG.lng.live.world.kind }); })()""")
        check(rs['live'] and rs['left'] != 'lanes' and rs['back'] == 'lanes' and rs['skill'] == [1, 3] and rs['hex'] == cd['hx'] and rs['kind'] == 'unadirbl', 'save and leave keeps the match; resumed, it is still tier U with its hexes', rs)
        # ...and after a reload too
        await pg.evaluate("wLanesLeaveGame(); wSave()")
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbBlFive === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate("wStart(wLoadSave())"); await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate("for (let i = 0; i < 4 && !document.getElementById('modal').hidden; i++) { const b = document.getElementById('wLnLater'); if (b) b.click(); else break; }")
        rl = await pg.evaluate("""(() => { const live = wLanesLive(), g0 = RUN.gold; RUN.gold = 0; const why = wNadirMatch('lanes'); const card = !!document.querySelector('[data-ubl]'); RUN.gold = g0;
          return { live, why, card, view: UI.view, skill: wBL.G.skill, hex: wBL.hex() && wBL.hex().ids }; })()""")
        check(rl['live'] and rl['why'] == '' and not rl['card'] and rl['view'] == 'lanes' and rl['skill'] == [1, 3] and rl['hex'] == cd['hx'],
              'after a reload the match is waiting: PLAY picks it up (no card, no toll asked), tier U with its hexes', rl)

        # a loss counts a try, and pays no piece
        ls = await pg.evaluate("""(() => { const s = wBL.summary(); s.win = 1; s.text = 'conceded'; wLanesSettle(s); WBL = null; wLeaveLanes(); wDrain();
          return { tries: WG.umbral.tries.lanes || 0, pieces: WG.umbral.pieces.slice(), last: WG.lng.games[0], live: wLanesLive() }; })()""")
        check(ls['tries'] == 1 and 'bowling' not in ls['pieces'] and ls['last']['r'] == 'lose' and ls['last']['tier'] == 4 and not ls['live'], 'a loss counts a try, and the pin stays with them', ls)

        # backing away from the card costs nothing, even on a retry
        bk = await pg.evaluate("""(() => { RUN.gold = 200; const g0 = RUN.gold; const why = wNadirMatch('lanes'); const card = !!document.querySelector('[data-ubl]'); const toll = document.getElementById('modalBox').textContent.includes('toll, 30 gold');
          document.getElementById('wUblNo').click(); return { why, card, toll, back: RUN.gold - g0, live: wLanesLive() }; })()""")
        check(bk['why'] == '' and bk['card'] and bk['toll'] and bk['back'] == 0 and not bk['live'], 'on a retry the card names the toll, and backing away costs nothing', bk)

        # a win pays the Drowned Pin (and its gold); the toll is paid once, at the first ball
        await pg.evaluate("RUN.gold = 200; window.__g1 = RUN.gold; window.__l0 = WLOG.length; wNadirMatch('lanes')")
        await pg.wait_for_function("!!document.querySelector('[data-ubl]')")
        await pg.click('[data-ubl="play"]')
        await pg.wait_for_function("UI.view === 'lanes' && wLanesLive() && wBL.mode === 'play'")
        tl = await pg.evaluate("({ paid: window.__g1 - RUN.gold, lines: WLOG.slice(window.__l0).filter(l => /pay the toll/.test(l[0])).length })")
        wn = await pg.evaluate("""(() => { const s = wBL.summary(); s.win = 0; s.text = '250 to 180'; wLanesSettle(s); WBL = null; wLeaveLanes(); wDrain();
          return { pieces: WG.umbral.pieces.slice(), beaten: !!WG.umbral.beaten.lanes, gold: RUN.gold - window.__g1, paid: WG.umbral.paid && WG.umbral.paid.lanes, again: wNadirMatch('lanes') }; })()""")
        check(tl['paid'] == 30 and tl['lines'] == 1 and wn['paid'] == 1, 'the retry\'s toll is paid at the first ball, once', [tl, wn])
        check('bowling' in wn['pieces'] and wn['beaten'] and wn['gold'] >= 100 - 30 and 'yours' in wn['again'], 'a win pays the Drowned Pin and the gold, and they have nothing left to play for', wn)

        # Simulate: the same game (the Lich against your Knight, the same hexes), at once, settled
        sm = await pg.evaluate("""(() => { const U = WG.umbral; U.pieces = []; U.tries = {}; U.paid = {}; delete U.beaten.lanes; wDrain(); const n0 = WG.lng.games.length, hx = wUmbBlHexes('lanes', W_NADIR.lanes.hexes); const why = wNadirMatch('lanes');
          const keep = wBL.simGame; let seen = null; wBL.simGame = o => { seen = { skill: o.skill, hexes: WU4G.next && WU4G.next.slice(), bag: WLNK.next && WLNK.next[1], opp: o.teams[1].name }; return keep(o); };
          try { document.querySelector('[data-ubl="sim"]').click(); } finally { wBL.simGame = keep; }
          const g = WG.lng.games[0];
          return { why, seen, hx, played: WG.lng.games.length - n0, live: wLanesLive(), r: g.r, tier: g.tier, settled: g.r === 'win' ? U.pieces.includes('bowling') : (U.tries.lanes || 0) === 1 }; })()""")
        check(sm['why'] == '' and sm['played'] == 1 and not sm['live'] and sm['tier'] == 4 and sm['settled'], 'Simulate plays the champion\'s match at once, and settles it', sm)
        check(sm['seen'] and sm['seen']['skill'] == [1, 3] and sm['seen']['hexes'] == sm['hx'] and sm['seen']['opp'] == 'Drowned Lanes Nadir' and sorted(sm['seen']['bag'].keys()) == sorted(tb['pots']),
              'Simulate is no easier: your five as a Knight against the Lich, with the same hexes and their full bag', sm)
        await pg.evaluate("wDrain(); for (let i = 0; i < 3 && !document.getElementById('modal').hidden; i++) { const b = document.getElementById('wLanesOk'); if (b) b.click(); }")

        lb = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.pieces = []; U.tries = {}; LAB = true; const n0 = WG.lng.games.length; let why; try { why = wNadirMatch('lanes'); } finally { LAB = false; }
          return { why, played: WG.lng.games.length - n0, settled: U.pieces.includes('bowling') || (U.tries.lanes || 0) === 1, card: !!document.querySelector('[data-ubl]') }; })()""")
        check(lb['why'] == '' and lb['played'] == 1 and lb['settled'] and not lb['card'], 'in LAB mode (the realm bot) PLAY simulates at once, with no card', lb)

        # a finale round through the same adapter: no piece, no toll, the finale's count of hexes
        fn = await pg.evaluate("""(() => { const U = WG.umbral; U.pieces = Object.keys(W_UMB_PIECES); U.finaleSports = ['bowling', 'baseball', 'football']; U.finale = 0; U.tries = { lanes: 2 }; U.sealed = 0; RUN.gold = 300;
          const g0 = RUN.gold, n0 = WG.lng.games.length, l0 = WLOG.length, keep = wBL.simGame; let seen = null; wBL.simGame = o => { seen = { hexes: WU4G.next && WU4G.next.slice(), opp: o.teams[1].name, skill: o.skill }; return keep(o); };
          LAB = true; let why; try { why = wUmbFinale(); } finally { LAB = false; wBL.simGame = keep; }
          const F = W_NADIR.finale, g = WG.lng.games[0];
          return { why, engine: F.engine, piece: F.piece, toll: F.toll, want: F.hexes, seen, played: WG.lng.games.length - n0, tier: g.tier, r: g.r, finale: U.finale, tf: U.tries.finale || 0, gold: RUN.gold - g0,
            tolled: WLOG.slice(l0).some(l => /pay the toll/.test(l[0])) }; })()""")
        check(fn['why'] == '' and fn['engine'] == 'lanes' and fn['piece'] is None and fn['toll'] == 0 and fn['played'] == 1 and fn['tier'] == 4 and not fn['tolled']
              and ((fn['r'] == 'win' and fn['finale'] == 1) or (fn['r'] == 'lose' and fn['finale'] == 0 and fn['tf'] == 1)), 'a finale round plays through the bowling adapter: tier U, no toll, and the round is settled', fn)
        check(fn['seen'] and len(fn['seen']['hexes']) == fn['want'] and fn['seen']['opp'] == 'Nadir Athletic' and fn['seen']['skill'] == [1, 3], 'the finale\'s round draws exactly its count of hexes, against Nadir Athletic and the Lich', fn)
        fc = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.finale = 0; wUmbFinaleEntry(); const why = W_UMB4.start.lanes(W_NADIR.finale, 'finale'); const t = document.getElementById('modalBox').textContent;
          const out = { why, card: !!document.querySelector('[data-ubl]'), toll: /toll/.test(t), round: t.includes('a round of the Seal'), seal: t.includes('The Seal: bowling') };
          const b = document.getElementById('wUblNo'); if (b) b.click(); return out; })()""")
        check(fc['why'] == '' and fc['card'] and not fc['toll'] and fc['round'] and fc['seal'], 'the finale\'s card plays for a round of the Seal, and names no toll', fc)

        # a Hardcore journey lost in a finale round: the end screen, and no result card over it
        hc = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.finale = 0; WG.hardcore = true; const keep = wBL.simGame;
          wBL.simGame = o => { const g = keep(o); g.win = 1; return g; };
          try { wRunAct('ufinale'); document.querySelector('[data-ubl="sim"]').click(); } finally { wBL.simGame = keep; }
          return { screen: UI.screen, card: !!document.getElementById('wLanesOk') && !document.getElementById('modal').hidden, over: !!(RUN && RUN.over) }; })()""")
        check(hc['screen'] == 'end' and not hc['card'], 'a Hardcore journey lost in a finale round ends on the end screen, with no result card over it', hc)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
