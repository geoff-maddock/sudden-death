# Realm: curling in the Umbral (issue #99, phase 4h). Tier U at the Shed (tier 4: the rating bonus, the Lich skipping,
# a full bag), curling's hexes (each does what it says, none changes a game without them), and the Sunken Shed's
# champion end to end: PLAY opens the card with the hexes, the first stone starts the Realm's curling match at tier U
# with them (named in the log, before the first stone, under the end board and on the bar), it saves and resumes (after
# a reload too), a win pays the Sunken Stone and a loss counts a try; the toll is paid once, at the first stone; backing
# away from the card costs nothing; Simulate and LAB settle at once; a finale round plays through the same adapter; and a
# Hardcore journey lost in a finale round ends on the end screen with no result card over it.
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

# seeded Math.random for the page: the fours drawn for a check are the same every run
SEEDR = "(n => { let q = n >>> 0; Math.random = () => { q = (Math.imul(q, 1103515245) + 12345) >>> 0; return (q >>> 8) / 16777216; }; })"
# the last end of the live match, side 1 (or 0) five up: it plays out at speed in Watch
LAST_END = """(lead => { const G = wCR.G, n = G.ends - 1; G.sc = [Array(n).fill(0), Array(n).fill(0)]; G.sc[lead][0] = 5; G.end = n; G.k = 14; G.stones = [];
  wCR.speed = 8; wCR.setMode('watch'); })"""
HEXCAP = "window.__ft = []; const ft = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t) { if (typeof t === 'string' && t.includes('Hex')) window.__ft.push(t); return ft.apply(this, arguments); }; 0"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbCrFour === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; for (const k in MAPS) delete MAPS[k]")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("""wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 200; RUN.gold = 500;
          const ks = ['elf', 'spider', 'gorgon', 'dwarf'].filter(k => !wRoster().some(p => p.kind === k));
          while (wRoster().length < 4) wRecruit({ kind: ks.pop(), lvl: 6 }, 'tavern');
          for (const p of wRoster()) { p.lvl = 6; delete p.cr; wCrOf(p); } WG.shed = null; wFourSyncCr(); wSave()""")

        # ---------- tier U in the tables ----------
        tb = await pg.evaluate("""({ bonus: Object.assign({}, W_SHG.oppBonus), skill: [1, 2, 3, 4].map(t => wShedSkillOf(t)), name: W_BALL_SKILL[wShedSkillOf(4)[1]], eng: wCR.lich.n,
          skills: wCR.skills.length, bag: W_SHED_KIT.opp[4], pots: Object.keys(wCR.potions), take: wCR.kitRules.take, tiers: [1, 2, 3].map(t => JSON.stringify(W_SHED_KIT.opp[t])),
          lich: { ang: wCR.lich.ang, hitAng: wCR.lich.hitAng, v: wCR.lich.v }, arch: { ang: wCR.skills[2].ang, hitAng: wCR.skills[2].hitAng, v: wCR.skills[2].v } })""")
        check(tb['bonus']['1'] == 1 and tb['bonus']['2'] == 1 and tb['bonus']['3'] == 1 and '4' in tb['bonus'] and tb['skill'] == [[1, 0], [1, 1], [1, 2], [1, 3]] and tb['name'] == 'Lich' and tb['eng'] == 'Lich' and tb['skills'] == 3,
              'tier U is a fourth row: its rating bonus, the Lich (skill 3, its own row: the exhibition still offers three skips); tiers 1 to 3 as they were', tb)
        check(sorted(tb['bag'].keys()) == sorted(tb['pots']) and all(v >= 1 for v in tb['bag'].values()) and tb['take'][3] is not None, 'their rink brings a full bag at tier U, and the Lich gives from it', tb)
        check(tb['lich'] == tb['arch'], 'the Lich throws no better than an Archmage: the same miss', tb)

        # ---------- the Lich decides, not just a label ----------
        lc = await pg.evaluate(SEEDR + """(4242), (() => { const kinds = ['elf', 'spider', 'gorgon', 'dwarf'], four = () => ({ name: 'T', short: 'T', roster: kinds.map(k => wShedPlayer(wMakePlayer({ kind: k, lvl: 3 }, 'opp'))) });
          const out = { plans: 0, diff: 0, shots: {}, sweep: {} }, J = p => JSON.stringify([p.shot, p.target || null, Math.round(p.x), Math.round(p.y), p.h]);
          // the same moments, two skips: the Lich often calls another shot than the Archmage would (another shot, spot or handle)
          for (let i = 0; i < 4; i++) { wCR.start({ seed: 70 + i, teams: [four(), four()], skill: [1, 3], mode: 'watch', ends: 4, hall: true }); const G = wCR.G;
            for (let k = 0; k < 40 && !G.over; k++) { if (wCR.up() === 1) { G.skill[1] = 2; const a = J(wCR.plan(1)); G.skill[1] = 3; const b = J(wCR.plan(1)); out.plans++; if (a !== b) out.diff++; out.shots[JSON.parse(b)[0]] = 1; } wCR.turn(); } }
          // its sweepers read the stone: the same twelve releases to the button, a little light or on the weight and off the line
          // either way (a heavy stone no broom can save), swept as an Archmage's would and as the Lich's
          wCR.start({ seed: 9, teams: [four(), four()], skill: [2, 3], mode: 'watch' }); const G = wCR.G, aim = wCR.solveDraw(0, 0, 1, G.ice, G.cold);
          for (const s of [0, 1]) { let d = 0, n = 0;
            for (let i = 0; i < 12; i++) { const plan = { shot: 'draw', x: 0, y: 0, h: 1, aim, s }, th = { id: 'new', s, x0: 0, ang: aim.ang + ((i % 3) - 1) * 0.15, v: aim.v * (1 - Math.floor(i / 3) * 0.012), h: 1 };
              G.legs = [1, 1]; const r = wCR.run([], th, { ice: G.ice, cold: G.cold, sweep: wCR.sweeper(s, plan), legs: true, side: s }); d += r.stop ? Math.hypot(r.stop.x, r.stop.y) : 200; n++; }
            out.sweep[s ? 'lich' : 'archmage'] = +(d / n).toFixed(2); }
          return out; })()""")
        check(lc['plans'] >= 20 and lc['diff'] >= lc['plans'] * 0.25, 'the Lich weighs more: at the same moments it often calls another shot, spot or handle than an Archmage', lc)
        check(lc['sweep']['lich'] < lc['sweep']['archmage'] * 0.85, 'and its sweepers read the stone: the same missed draws end nearer the button than an Archmage\'s sweep them', lc['sweep'])

        # ---------- hexes ----------
        hx = await pg.evaluate(SEEDR + """(99), (() => { const out = {}, J = x => JSON.stringify(x), sim = o => J(wCR.simGame(o));
          out.ids = Object.keys(wCR.hexes);
          out.same = sim({ seed: 21, ends: 4, skill: [1, 2], powers: true, hall: true }) === sim({ seed: 21, ends: 4, skill: [1, 2], powers: true, hall: true, hexes: [] })
            && sim({ seed: 22, ends: 4 }) === sim({ seed: 22, ends: 4, hexes: ['nothing'] });
          wCR.start({ seed: 5, mode: 'watch' }); out.noHex = wCR.hex();
          // Rime on the Pebble: your stones curl more (theirs as ever), and a stone that curls more ends further across
          wCR.start({ seed: 5, mode: 'watch', hexes: ['rime'] }); const G = wCR.G, f0 = wCR.hexFx(0), f1 = wCR.hexFx(1), aim = wCR.solveDraw(0, 0, 1, G.ice, G.cold), th = { id: 'new', s: 0, x0: 0, ang: aim.ang, v: aim.v, h: 1 };
          const a = wCR.run([], th, { ice: G.ice, cold: G.cold, plan: true }), b = wCR.run([], th, { ice: G.ice, cold: G.cold, plan: true, fx: { stiff: f0.stiff } });
          out.rime = { mine: f0.stiff, theirs: f1.stiff, want: wCR.hexes.rime.curl, across: +(b.stop.x - a.stop.x).toFixed(2) };
          // Leaden Brooms: your sweepers tire faster and do less
          wCR.start({ seed: 5, mode: 'watch', hexes: ['lead'] }); const l0 = wCR.hexFx(0), l1 = wCR.hexFx(1); out.lead = { legs: l0.legs, sweep: l0.sweep, theirs: [l1.legs, l1.sweep], want: wCR.hexes.lead };
          // The Drifting House: over a game your stones that rest in the house slide out, theirs never
          wCR.start({ seed: 8, mode: 'watch', hexes: ['drift'], skill: [1, 1], ends: 4 }); let dr = { mine: 0, theirs: 0, by: [] };
          for (let k = 0; k < 200 && !wCR.G.over; k++) { const ev = wCR.turn(); if (!ev) break; if (ev.drift) { dr[ev.side ? 'theirs' : 'mine']++; dr.by.push(ev.drift); } }
          out.drift = Object.assign(dr, { want: wCR.hexes.drift.in });
          // Hoarfrost: the first of their stones each end to lie in the four-foot is set like granite, the one nearest it; yours never
          wCR.start({ seed: 12, mode: 'watch', hexes: ['hoar'], skill: [1, 1], ends: 4 }); const ho = { ends: [], mine: 0, late: 0 }, lim = wCR.hexes.hoar.r + wCR.sheet.stoneR;
          for (let k = 0; k < 200 && !wCR.G.over; k++) { const e = wCR.G.end, was = wCR.G.hex.froze === e;
            if (!wCR.turn()) break; if (wCR.G.end !== e) continue; const G = wCR.G, now = G.stones.filter(st => st.s === 1 && st.g);
            if (G.stones.some(st => st.s === 0 && st.g)) ho.mine++; ho.ends[e] = Math.max(ho.ends[e] || 0, now.length);
            // (once one froze, it stays the only one this end; before, a stone of theirs in the four-foot now is frozen)
            if (!was && G.stones.some(st => st.s === 1 && Math.hypot(st.x, st.y) <= lim) && !now.length) ho.late++; }
          out.hoar = ho;
          return out; })()""")
        check(hx['same'] and hx['noHex'] is None, 'no hexes (or none the engine knows) and the game is the same game, seed for seed', hx)
        check(sorted(hx['ids']) == ['drift', 'hoar', 'lead', 'rime'], 'curling has four hexes', hx['ids'])
        R = hx['rime']
        check(abs(R['mine'] - R['want']) < 1e-9 and R['theirs'] == 1 and abs(R['across']) > 1, 'Rime on the Pebble curls your stones more (theirs not), and they end further across', R)
        L = hx['lead']
        check(L['legs'] == L['want']['legs'] and L['sweep'] == L['want']['sweep'] and L['theirs'] == [1, 1], 'Leaden Brooms tire your sweepers faster and cut what they do (theirs not)', L)
        D = hx['drift']
        check(D['mine'] >= 1 and D['theirs'] == 0 and all(x == D['want'] for x in D['by']), 'The Drifting House slides your stones at rest in the house further out, never theirs', D)
        H = hx['hoar']
        check(any(x == 1 for x in H['ends'] if x) and all((x or 0) <= 1 for x in H['ends']) and H['late'] == 0 and H['mine'] == 0, 'Hoarfrost sets the first of their stones in the four-foot each end like granite (one an end), never yours', H)

        # ---------- the champion ----------
        ch = await pg.evaluate("""(() => { const C = W_NADIR.shed, ch = DB.chars[C.char], T = wUmbCrFour(6);
          const ids = Object.values(wCR.ult).concat(Object.values(wCR.pow).flat(), Object.values(wCR.pow2).flat()).map(x => x.id);
          return { C, greet: ch.greet, play: ch.topics.play.act, words: JSON.stringify(ch), map: !!MAPS[C.map] && MAPS[C.map].npcs.some(n => n.id === C.char), team: T.name, order: T.order,
            champ: T.roster.filter(m => m.ult).map(m => [m.n, m.ult]), skip: T.roster[T.order[3]].n, ult: wCR.ultOwn.sunkenstone && wCR.ultOwn.sunkenstone.n, clash: ids.includes('sunkenstone'),
            n: T.roster.length, lvl: T.roster.map(m => m.r), h1: wUmbCrHexes('shed', 1), h2: wUmbCrHexes('shed', 1), audit: wAudit() }; })()""")
        C = ch['C']
        check(C['ground'] == 'g_shed' and C['map'] == 'u:g_shed' and C['region'] == 'tide' and C['engine'] == 'shed' and C['piece'] == 'curling' and C['hexes'] in (1, 2) and ch['map'],
              'the Sunken Shed\'s champion holds the Sunken Stone and stands on the dark ground', ch)
        check('PLAY' in ch['greet'] and 'RULES' in ch['greet'] and ch['play'] == 'unadir:shed' and ch['n'] == 4 and ch['champ'] == [['Grisel Mourne', 'sunkenstone']] and ch['skip'] == 'Grisel Mourne' and ch['ult'] == 'The Sunken Stone' and not ch['clash'],
              'they say PLAY and RULES, field the Nadir four, the champion skipping with an ultimate of their own (an id nobody else has)', ch)
        check(ch['h1'] == ch['h2'] and len(ch['h1']) == C['hexes'], 'the hexes for a try are fixed (a reload draws the same)', ch)
        check(ch['audit'] == [], 'the audit is clean', ch['audit'])
        uo = await pg.evaluate("""(() => { wCR.start({ seed: 3, mode: 'watch', powers: true, teams: [wFourMineCr(), wUmbCrFour(6)] }); const a = wCR.ultOf(1, 0).id, b = wCR.ultOf(0, 0).id;
          wCR.start({ seed: 3, mode: 'watch', powers: true }); return { theirs: a, mine: b, plain: wCR.ultOf(1, 0).id, kind: (wCR.ult[wCR.G.teams[1].roster[wCR.thrower(1)].kind] || wCR.ult.goblin).id }; })()""")
        check(uo['theirs'] == 'sunkenstone' and uo['mine'] != 'sunkenstone' and uo['plain'] == uo['kind'], 'the champion\'s rink casts their own ultimate; any other rink its thrower\'s kind\'s, as before', uo)

        # PLAY, past the guards and the gate: the card, then the first stone
        await pg.evaluate("WG.umbral.guards = { 'g_shed:0': WG.dayAbs, 'g_shed:1': WG.dayAbs }; WG.umbral.gates = { shed: WG.dayAbs }; " + HEXCAP + "; wRunAct('unadir:shed', 'nadir_shed')")
        await pg.wait_for_function("!!document.querySelector('[data-ucr]')")
        cd = await pg.evaluate("""(() => { const t = document.getElementById('modalBox').textContent, hx = wUmbCrHexes('shed', W_NADIR.shed.hexes);
          return { tierU: t.includes('tier U'), lich: t.includes('Lich'), hexes: hx.every(h => t.includes(wCR.hexes[h].n)), hx, free: t.includes('first match is free') }; })()""")
        check(cd['tierU'] and cd['lich'] and cd['hexes'] and cd['free'], 'PLAY opens the game card: tier U, the Lich, the hexes for this try, the first match free', cd)
        await pg.click('[data-ucr="manage"]')
        await pg.wait_for_function("UI.view === 'shed' && wShedLive() && !!WG.shg.live.snap")
        gm = await pg.evaluate("""(() => { const G = wCR.G, W = WG.shg.live.world;
          return { tier: W.tier, kind: W.kind, club: W.club, skill: G.skill, hex: wCR.hex(), opp: G.teams[1].name, bag: G.bags[1], log: WLOG.slice(-6).map(l => l[0]).join(' | '), champ: G.teams[1].roster.some(m => m.ult === 'sunkenstone'),
            note: document.getElementById('wShedNote').textContent, cap: (document.querySelector('#wShedBoard caption') || {}).textContent || '' }; })()""")
        check(gm['tier'] == 4 and gm['kind'] == 'unadircr' and gm['skill'] == [1, 3] and gm['opp'] == 'Sunken Shed Nadir' and sorted(gm['bag'].keys()) == sorted(tb['pots']) and gm['champ'],
              'the first stone starts the Realm\'s curling match at tier U against the Nadir four: the Lich skipping, a full bag, the champion\'s own ultimate', gm)
        names = [n for n in await pg.evaluate("wCR.hex() ? wCR.hex().ids.map(h => wCR.hexes[h].n) : []")]
        check(gm['hex'] and gm['hex']['ids'] == cd['hx'] and gm['hex']['on'] == 0 and 'draws the hexes' in gm['log'] and 'Hexes' in gm['note'] and all(n in gm['cap'] for n in names),
              'the drawn hexes are on the match, named in the log, on the bar and in the board\'s caption', gm)
        await pg.wait_for_function("window.__ft.some(t => t.includes('Hexes on'))")
        ft = await pg.evaluate("window.__ft.filter(t => t.includes('Hexes on')).slice(-1)[0]")
        check(all(n in ft for n in names), 'the hexes are under the end board', ft)
        first = await pg.evaluate("""(() => { const G = wCR.G, sn = wCR.snapshot(); wCR.start({ teams: G.teams.map(t => ({ name: t.name, short: t.short, roster: t.roster })), mode: 'watch', hexes: G.hex.ids }); wCR.tick(0.01); const m = wCR.msg;
          wCR.resume(sn); return m; })()""")
        check('Hexes on' in first and all(n in first for n in names), 'they are named before the first stone', first)

        # save and leave, then resume: the hexes and the Lich come back with it
        rs = await pg.evaluate("""(() => { wShedLeaveGame(); const out = { left: UI.view, live: wShedLive() }; wResumeShed(); const G = wCR.G;
          return Object.assign(out, { back: UI.view, skill: G.skill, hex: wCR.hex() && wCR.hex().ids, kind: WG.shg.live && WG.shg.live.world.kind }); })()""")
        check(rs['live'] and rs['left'] != 'shed' and rs['back'] == 'shed' and rs['skill'] == [1, 3] and rs['hex'] == cd['hx'] and rs['kind'] == 'unadircr', 'save and leave keeps the match; resumed, it is still tier U with its hexes', rs)
        # ...and after a reload too
        await pg.evaluate("wShedLeaveGame(); wSave()")
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbCrFour === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate("wStart(wLoadSave())"); await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate("for (let i = 0; i < 4 && !document.getElementById('modal').hidden; i++) { const b = document.getElementById('wShLater'); if (b) b.click(); else break; }")
        rl = await pg.evaluate("""(() => { const live = wShedLive(), g0 = RUN.gold; RUN.gold = 0; const why = wNadirMatch('shed'); const card = !!document.querySelector('[data-ucr]'); RUN.gold = g0;
          return { live, why, card, view: UI.view, skill: wCR.G.skill, hex: wCR.hex() && wCR.hex().ids }; })()""")
        check(rl['live'] and rl['why'] == '' and not rl['card'] and rl['view'] == 'shed' and rl['skill'] == [1, 3] and rl['hex'] == cd['hx'],
              'after a reload the match is waiting: PLAY picks it up (no card, no toll asked), tier U with its hexes', rl)

        # a loss (five down going into the last end's last two stones) counts a try, and pays no piece
        await pg.evaluate(LAST_END + "(1)")
        await pg.wait_for_function("!wShedLive()", timeout=90000)
        ls = await pg.evaluate("({ tries: WG.umbral.tries.shed || 0, pieces: WG.umbral.pieces.slice(), last: WG.shg.games[0] })")
        check(ls['tries'] == 1 and 'curling' not in ls['pieces'] and ls['last']['r'] == 'lose' and ls['last']['tier'] == 4, 'a loss counts a try, and the stone stays with them', ls)
        await pg.evaluate("wLeaveShed(); wDrain()")

        # backing away from the card costs nothing, even on a retry
        bk = await pg.evaluate("""(() => { RUN.gold = 200; const g0 = RUN.gold; const why = wNadirMatch('shed'); const card = !!document.querySelector('[data-ucr]'); const toll = document.getElementById('modalBox').textContent.includes('toll, 20 gold');
          document.getElementById('wUcrNo').click(); return { why, card, toll, back: RUN.gold - g0, live: wShedLive() }; })()""")
        check(bk['why'] == '' and bk['card'] and bk['toll'] and bk['back'] == 0 and not bk['live'], 'on a retry the card names the toll, and backing away costs nothing', bk)

        # a win pays the Sunken Stone (and its gold); the toll is paid once, at the first stone
        await pg.evaluate("RUN.gold = 200; window.__g1 = RUN.gold; window.__l0 = WLOG.length; wNadirMatch('shed')")
        await pg.wait_for_function("!!document.querySelector('[data-ucr]')")
        await pg.click('[data-ucr="play"]')
        await pg.wait_for_function("UI.view === 'shed' && wShedLive() && wCR.mode === 'play'")
        tl = await pg.evaluate("({ paid: window.__g1 - RUN.gold, lines: WLOG.slice(window.__l0).filter(l => /pay the toll/.test(l[0])).length })")
        await pg.evaluate(LAST_END + "(0)")
        await pg.wait_for_function("!wShedLive()", timeout=90000)
        wn = await pg.evaluate("({ pieces: WG.umbral.pieces.slice(), beaten: !!WG.umbral.beaten.shed, gold: RUN.gold - window.__g1, paid: WG.umbral.paid && WG.umbral.paid.shed, again: wNadirMatch('shed') })")
        check(tl['paid'] == 20 and tl['lines'] == 1 and wn['paid'] == 1, 'the retry\'s toll is paid at the first stone, once', [tl, wn])
        check('curling' in wn['pieces'] and wn['beaten'] and wn['gold'] >= 100 - 20 and 'yours' in wn['again'], 'a win pays the Sunken Stone and the gold, and they have nothing left to play for', wn)
        await pg.evaluate("wLeaveShed(); wDrain()")

        sm = await pg.evaluate("""(() => { const U = WG.umbral; U.pieces = []; U.tries = {}; U.paid = {}; delete U.beaten.shed; wDrain(); const n0 = WG.shg.games.length; const why = wNadirMatch('shed');
          document.querySelector('[data-ucr="sim"]').click(); const g = WG.shg.games[0], card = !!document.getElementById('wShedOk'); if (card) document.getElementById('wShedOk').click();
          return { why, played: WG.shg.games.length - n0, live: wShedLive(), r: g.r, tier: g.tier, level: g.us !== g.them, card, settled: g.r === 'win' ? U.pieces.includes('curling') : (U.tries.shed || 0) === 1 }; })()""")
        check(sm['why'] == '' and sm['played'] == 1 and not sm['live'] and sm['tier'] == 4 and sm['level'] and sm['card'] and sm['settled'], 'Simulate plays the champion\'s match at once, never level, shows the final, and settles it', sm)

        lb = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.pieces = []; U.tries = {}; delete U.beaten.shed; LAB = true; const n0 = WG.shg.games.length; const why = wNadirMatch('shed'); LAB = false;
          return { why, played: WG.shg.games.length - n0, settled: U.pieces.includes('curling') || (U.tries.shed || 0) === 1 }; })()""")
        check(lb['why'] == '' and lb['played'] == 1 and lb['settled'], 'in LAB mode (the realm bot) PLAY simulates at once', lb)

        # a finale round through the same adapter, as the realm bot drives it: no piece, no toll, the finale's own count
        fn = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.pieces = Object.keys(W_UMB_PIECES); U.finaleSports = ['curling', 'baseball', 'football']; U.finale = 0; U.tries = { shed: 2 }; U.sealed = 0; RUN.gold = 300;
          const g0 = RUN.gold, n0 = WG.shg.games.length, l0 = WLOG.length; LAB = true; let why; try { why = wUmbFinale(); } finally { LAB = false; }
          const F = W_NADIR.finale, g = WG.shg.games[0];
          return { why, engine: F.engine, piece: F.piece, toll: F.toll, played: WG.shg.games.length - n0, tier: g.tier, name: g.name, r: g.r, finale: U.finale, tf: U.tries.finale || 0,
            tolled: WLOG.slice(l0).some(l => /pay the toll/.test(l[0])), gold: RUN.gold - g0 }; })()""")
        check(fn['why'] == '' and fn['engine'] == 'shed' and fn['piece'] is None and fn['toll'] == 0 and fn['played'] == 1 and fn['tier'] == 4 and fn['name'] == 'Nadir Athletic' and not fn['tolled']
              and ((fn['r'] == 'win' and fn['finale'] == 1) or (fn['r'] == 'lose' and fn['finale'] == 0 and fn['tf'] == 1)), 'in LAB a finale round of curling plays through the real adapter at once: Nadir Athletic, tier U, no toll, and the round is settled', fn)
        fc = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.finale = 0; wUmbFinaleEntry(); const F = W_NADIR.finale, hx = wUmbCrHexes('finale', F.hexes); const why = W_UMB4.start.shed(F, 'finale'); const t = document.getElementById('modalBox').textContent;
          const out = { why, card: !!document.querySelector('[data-ucr]'), toll: /toll/.test(t), round: t.includes('a round of the Seal'), seal: t.includes('The Seal: curling'), want: F.hexes, drawn: hx.length, named: hx.every(h => t.includes(wCR.hexes[h].n)) };
          const b = document.getElementById('wUcrNo'); if (b) b.click(); return out; })()""")
        check(fc['why'] == '' and fc['card'] and not fc['toll'] and fc['round'] and fc['seal'] and fc['drawn'] == fc['want'] and fc['named'], 'the finale\'s card plays for a round of the Seal, names no toll, and draws exactly the round\'s hexes', fc)

        # a Hardcore journey lost in a finale round: the end screen, and no result card over it
        hc = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.finale = 0; WG.hardcore = true; const keep = wCR.simGame;
          wCR.simGame = o => { const g = keep(o); g.win = 1; g.tot = [0, 5]; g.text = '5 to 0'; return g; };
          try { wRunAct('ufinale'); document.querySelector('[data-ucr="sim"]').click(); } finally { wCR.simGame = keep; }
          return { screen: UI.screen, card: !!document.getElementById('wShedOk') && !document.getElementById('modal').hidden, over: !!(RUN && RUN.over) }; })()""")
        check(hc['screen'] == 'end' and not hc['card'], 'a Hardcore journey lost in a finale round ends on the end screen, with no result card over it', hc)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
