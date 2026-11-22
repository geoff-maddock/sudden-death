# Realm: golf in the Umbral (issue #99, phase 4f). Tier U on the course (tier 4: the rating bonus, the Lich caddying,
# a full bag), golf's hexes (each does what it says, none changes a round without them), and the Hollow Links' champion
# end to end: PLAY opens the card with the hexes, the first tee starts the Realm's golf match at tier U with them (named
# in the log, over the first tee and on the hole card), it saves and resumes, a win pays the Hollow Flag and a loss
# counts a try; the toll is paid once, at the first tee; backing away from the card costs nothing; and a finale round
# plays through the same adapter.
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

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbGlFour === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; for (const k in MAPS) delete MAPS[k]")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("""wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 200; RUN.gold = 500;
          const ks = ['elf', 'spider', 'gorgon', 'dwarf'].filter(k => !wRoster().some(p => p.kind === k));
          while (wRoster().length < 4) wRecruit({ kind: ks.pop(), lvl: 6 }, 'tavern');
          for (const p of wRoster()) { p.lvl = 6; delete p.gl; wGlOf(p); } wFourAuto(); wSave()""")

        # ---------- tier U in the tables ----------
        tb = await pg.evaluate("""({ bonus: Object.assign({}, W_LKG.oppBonus), skill: [1, 2, 3, 4].map(t => wLinksSkill(t)), name: W_BALL_SKILL[wLinksSkill(4)[1]], eng: wGL.skills.names[3],
          bag: W_LINKS_KIT.opp[4], pots: Object.keys(wGL.potions), read: wGL.skills.read, tiers: [1, 2, 3].map(t => JSON.stringify(W_LINKS_KIT.opp[t])) })""")
        check(tb['bonus']['1'] == 2 and tb['bonus']['2'] == 4 and tb['bonus']['3'] == 7 and '4' in tb['bonus'] and tb['skill'] == [[1, 0], [1, 1], [1, 2], [1, 3]] and tb['name'] == 'Lich' and tb['eng'] == 'Lich',
              'tier U is a fourth row: its rating bonus, the Lich (skill 3, the engine\'s fourth caddie); tiers 1 to 3 as they were', tb)
        check(sorted(tb['bag'].keys()) == sorted(tb['pots']) and all(v >= 1 for v in tb['bag'].values()), 'their caddie brings a full bag at tier U', tb)
        check(tb['read'][3] < tb['read'][2], 'the Lich reads greens better than the Archmage', tb['read'])

        # ---------- the Lich decides, not just a label ----------
        lc = await pg.evaluate(SEEDR + """(4242), (() => { const kinds = ['elf', 'spider', 'gorgon', 'dwarf'], four = () => ({ name: 'T', roster: kinds.map(k => wLinksPlayer(wMakePlayer({ kind: k, lvl: 3 }, 'opp'))), roles: { tee: 0, approach: 1, short: 2, putt: 3 } });
          const out = { diff: 0, plans: 0, strokes: {} }, base = { holes: 9, weather: 'breeze', wood: true, powers: true, enchant: true };
          // the same moments, two caddies: the Lich often plays another shot than the Archmage would (another line, aim or pace)
          for (let i = 0; i < 12; i++) { wGL.start(Object.assign({ seed: 70 + i, teams: [four(), four()], skill: [1, 3], mode: 'watch' }, base)); const G = wGL.G;
            for (let k = 0; k < 30 && !G.over; k++) { const n = wGL.away ? null : null; const s = G.ball && (() => { const H = wGL.hole(); const d = [0, 1].map(x => Math.hypot(G.ball[x].x - H.pin.x, G.ball[x].y - H.pin.y)); return wGL.away(d); })();
              if (s === 1) { const J = p => JSON.stringify([p.club, p.line, p.aim && [p.aim.x.toFixed(1), p.aim.y.toFixed(1)], p.v && p.v.toFixed(2)]); G.skill[1] = 2; const a = J(wGL.plan(1)); G.skill[1] = 3; const b = J(wGL.plan(1)); out.plans++; if (a !== b) out.diff++; }
              if (!wGL.turn()) break; } }
          // and over the same 160 seeded rounds against a Knight, it takes fewer strokes a hole than the Archmage
          for (const sk of [2, 3]) { let st = 0, h = 0; for (let i = 0; i < 160; i++) { const r = wGL.simGame(Object.assign({ seed: 3000 + i, teams: [four(), four()], skill: [1, sk] }, base)); for (const c of r.card) { st += c.up[1] ? c.par + 4 : c.done[1] ? c.st[1] : c.st[1] + 1; h++; } } out.strokes[sk] = +(st / h).toFixed(3); }
          return out; })()""")
        check(lc['plans'] >= 20 and lc['diff'] >= lc['plans'] * 0.2, 'the Lich weighs its shots: at the same moments it often plays another line, aim or pace than an Archmage', lc)
        check(lc['strokes']['3'] < lc['strokes']['2'], 'and it takes fewer strokes a hole than the Archmage, round for round', lc['strokes'])

        # ---------- hexes ----------
        hx = await pg.evaluate(SEEDR + """(99), (() => { const out = {}, J = x => JSON.stringify(x), sim = o => { const g = wGL.simGame(o); return J([g.win, g.text, g.card, g.stat, g.log.length]); };
          out.ids = Object.keys(wGL.hexes);
          out.same = sim({ seed: 21, skill: [1, 3], powers: true, enchant: true, wood: true }) === sim({ seed: 21, skill: [1, 3], powers: true, enchant: true, wood: true, hexes: [] })
            && sim({ seed: 22 }) === sim({ seed: 22, hexes: ['nothing'] });
          wGL.start({ seed: 5, mode: 'watch' }); out.noHex = wGL.hex();
          // The Restless Green: a tilt under your putts only, that changes the roll
          wGL.start({ seed: 5, mode: 'watch', hexes: ['tilt'] }); const t0 = wGL.hexTilt(0), t1 = wGL.hexTilt(1), H = wGL.hole();
          const from = { x: H.pin.x - 6, y: H.pin.y }, p0 = wGL.putt({ hole: H, from, a: 0, v: 3, noCup: true }), p1 = wGL.putt({ hole: H, from, a: 0, v: 3, noCup: true, tilt: t0 });
          out.tilt = { mine: !!t0, theirs: t1, g: t0 ? +Math.hypot(t0[0], t0[1]).toFixed(4) : 0, want: wGL.hexes.tilt.g, moved: +Math.hypot(p1.end.x - p0.end.x, p1.end.y - p0.end.y).toFixed(3) };
          // The Grey Fog: you see the flag a few yards off; they see it where it is
          wGL.start({ seed: 5, mode: 'watch', hexes: ['fog'] }); const Hf = wGL.hole(), s0 = wGL.hexSeen(0), s1 = wGL.hexSeen(1), F = wGL.hexes.fog.yd;
          out.fog = { off: +Math.hypot(s0.pin.x - Hf.pin.x, s0.pin.y - Hf.pin.y).toFixed(2), theirs: Math.hypot(s1.pin.x - Hf.pin.x, s1.pin.y - Hf.pin.y), F, aim: (() => { const pl = wGL.plan(0); return +Math.hypot(pl.aim.x - s0.pin.x, pl.aim.y - s0.pin.y).toFixed(1); })() };
          // The Turning Wind: your full shots fly in a turned, harder wind; theirs in the wind as it is
          wGL.start({ seed: 5, mode: 'watch', hexes: ['gust'] }); const w = { s: 8, d: 1 }, g0 = wGL.hexWind(0, w), g1 = wGL.hexWind(1, w);
          out.gust = { s: g0.s - w.s, turn: +Math.abs(g0.d - w.d).toFixed(3), want: wGL.hexes.gust, theirs: g1 };
          // The Wandering Cup: over a round the cup creeps, never off the green, and only away from your balls
          wGL.start({ seed: 8, mode: 'watch', hexes: ['wander'], skill: [2, 2] }); const G = wGL.G; let crept = 0, onGreen = true, away = true;
          for (let k = 0; k < 400 && !G.over; k++) { const before = G.hex.pin ? J(G.hex.pin) : '', h0 = G.h, n = G.log.length; const H0 = wGL.hole(); const ev = wGL.turn(); if (!ev) break;
            if (ev.hex === 'wander') { crept++; const H1 = wGL.hole(), g = H1.green; if (((H1.pin.x - g.x) / g.rx) ** 2 + ((H1.pin.y - g.y) / g.ry) ** 2 > 0.81) onGreen = false; if (ev.side !== 0) away = false;
              const b = G.ball[0]; if (Math.hypot(H1.pin.x - b.x, H1.pin.y - b.y) < Math.hypot(H0.pin.x - b.x, H0.pin.y - b.y) - 1e-6) away = false; } }
          out.wander = { crept, onGreen, away };
          return out; })()""")
        check(hx['same'] and hx['noHex'] is None, 'no hexes (or none the engine knows) and the round is the same round, seed for seed', hx)
        check(sorted(hx['ids']) == ['fog', 'gust', 'tilt', 'wander'], 'golf has four hexes', hx['ids'])
        T = hx['tilt']
        check(T['mine'] and T['theirs'] is None and abs(T['g'] - T['want']) < 1e-3 and T['moved'] > 0.05, 'The Restless Green tilts your putts (theirs not), and the tilt moves the ball', T)
        F = hx['fog']
        check(F['F'][0] - 0.01 <= F['off'] <= F['F'][1] + 0.01 and F['theirs'] < 1e-9, 'The Grey Fog shows you the flag a few yards from where it is; they see it true', F)
        Gu = hx['gust']
        check(Gu['s'] == Gu['want']['mph'] and abs(Gu['turn'] - Gu['want']['turn']) < 1e-3 and Gu['theirs'] == {'s': 8, 'd': 1}, 'The Turning Wind turns and stiffens the wind on your shots only', Gu)
        W = hx['wander']
        check(W['crept'] >= 1 and W['onGreen'] and W['away'], 'The Wandering Cup creeps away from your ball after your approaches, and stays on the green', W)

        # ---------- the champion ----------
        ch = await pg.evaluate("""(() => { const C = W_NADIR.links, ch = DB.chars[C.char], T = wUmbGlFour(6);
          return { C, greet: ch.greet, play: ch.topics.play.act, words: JSON.stringify(ch), map: !!MAPS[C.map] && MAPS[C.map].npcs.some(n => n.id === C.char), team: T.name,
            champ: T.roster.filter(m => m.ult).map(m => [m.n, m.ult]), ult: wGL.ultOwn.hollowflag && wGL.ultOwn.hollowflag.n, clash: Object.values(wGL.ult).concat(Object.values(wGL.pow).flat(), Object.values(wGL.pow2).flat()).some(x => x.id === 'hollowflag'),
            n: T.roster.length, h1: wUmbGlHexes('links', 1), h2: wUmbGlHexes('links', 1), audit: wAudit() }; })()""")
        C = ch['C']
        check(C['ground'] == 'g_links' and C['map'] == 'u:g_links' and C['region'] == 'bloom' and C['engine'] == 'links' and C['piece'] == 'golf' and C['hexes'] in (1, 2) and ch['map'],
              'the Hollow Links\' champion holds the Hollow Flag and stands on the dark ground', ch)
        check('PLAY' in ch['greet'] and 'RULES' in ch['greet'] and ch['play'] == 'unadir:links' and ch['n'] == 4 and ch['champ'] == [['Sexton Vale', 'hollowflag']] and ch['ult'] == 'The Hollow Flag' and not ch['clash'],
              'they say PLAY and RULES, field the Nadir four, the champion with an ultimate of their own (an id nobody else has)', ch)
        check(ch['h1'] == ch['h2'] and len(ch['h1']) == C['hexes'], 'the hexes for a try are fixed (a reload draws the same)', ch)
        check(ch['audit'] == [], 'the audit is clean', ch['audit'])

        # PLAY, past the guards and the gate: the card, then the first tee
        await pg.evaluate("""WG.umbral.guards = { 'g_links:0': WG.dayAbs, 'g_links:1': WG.dayAbs }; WG.umbral.gates = { links: WG.dayAbs };
          window.__ft = []; const ft = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t) { if (typeof t === 'string' && t.includes('Hex')) window.__ft.push(t); return ft.apply(this, arguments); };
          wRunAct('unadir:links', 'nadir_links')""")
        await pg.wait_for_function("!!document.querySelector('[data-ugl]')")
        cd = await pg.evaluate("""(() => { const t = document.getElementById('modalBox').textContent, hx = wUmbGlHexes('links', W_NADIR.links.hexes);
          return { tierU: t.includes('tier U'), lich: t.includes('Lich'), hexes: hx.every(h => t.includes(wGL.hexes[h].n)), hx, free: t.includes('first round is free') }; })()""")
        check(cd['tierU'] and cd['lich'] and cd['hexes'] and cd['free'], 'PLAY opens the game card: tier U, the Lich, the hexes for this try, the first round free', cd)
        await pg.click('[data-ugl="manage"]')
        await pg.wait_for_function("UI.view === 'links' && wLinksLive() && !!WG.lkg.live.snap")
        gm = await pg.evaluate("""(() => { const G = wGL.G, W = WG.lkg.live.world;
          return { tier: W.tier, kind: W.kind, club: W.club, skill: G.skill, hex: wGL.hex(), opp: G.teams[1].name, bag: G.bags[1], log: WLOG.slice(-6).map(l => l[0]).join(' | '), champ: G.teams[1].roster.some(m => m.ult === 'hollowflag'),
            note: document.getElementById('wLinksNote').textContent }; })()""")
        check(gm['tier'] == 4 and gm['kind'] == 'unadirgl' and gm['skill'] == [1, 3] and gm['opp'] == 'Hollow Links Nadir' and sorted(gm['bag'].keys()) == sorted(tb['pots']) and gm['champ'],
              'the first tee starts the Realm\'s golf match at tier U against the Nadir four: the Lich caddying, a full bag, the champion\'s own ultimate', gm)
        check(gm['hex'] and gm['hex']['ids'] == cd['hx'] and gm['hex']['on'] == 0 and 'draws the hexes' in gm['log'] and 'Hexes' in gm['note'], 'the drawn hexes are on the match, named in the log and on the bar', gm)
        await pg.wait_for_function("window.__ft.some(t => t.includes('Hexes on'))")
        ft = await pg.evaluate("window.__ft.filter(t => t.includes('Hexes on')).slice(-1)[0]")
        names = await pg.evaluate("wGL.hex().ids.map(h => wGL.hexes[h].n)")
        check(all(n in ft for n in names), 'the hexes are on the hole card', ft)
        first = await pg.evaluate("""(() => { const G = wGL.G; wGL.start({ teams: G.teams.map(t => ({ name: t.name, roster: t.roster })), mode: 'watch', hexes: G.hex.ids }); const m = wGL.msg; return m; })()""")
        check('Hexes on' in first and all(n in first for n in names), 'they are named over the first tee', first)

        # save and leave, then resume: the hexes and the Lich come back with it
        rs = await pg.evaluate("""(() => { wLinksLeaveGame(); const out = { left: UI.view, live: wLinksLive() }; wResumeLinks(); const G = wGL.G;
          return Object.assign(out, { back: UI.view, skill: G.skill, hex: wGL.hex() && wGL.hex().ids, kind: WG.lkg.live && WG.lkg.live.world.kind }); })()""")
        check(rs['live'] and rs['left'] != 'links' and rs['back'] == 'links' and rs['skill'] == [1, 3] and rs['hex'] == cd['hx'] and rs['kind'] == 'unadirgl', 'save and leave keeps the match; resumed, it is still tier U with its hexes', rs)
        # ...and after a reload too
        await pg.evaluate("wLinksLeaveGame(); wSave()")
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbGlFour === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate("wStart(wLoadSave())"); await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate("for (let i = 0; i < 4 && !document.getElementById('modal').hidden; i++) { const b = document.getElementById('wLkLater'); if (b) b.click(); else break; }")
        rl = await pg.evaluate("""(() => { const live = wLinksLive(), g0 = RUN.gold; RUN.gold = 0; const why = wNadirMatch('links'); const card = !!document.querySelector('[data-ugl]'); RUN.gold = g0;
          return { live, why, card, view: UI.view, skill: wGL.G.skill, hex: wGL.hex() && wGL.hex().ids }; })()""")
        check(rl['live'] and rl['why'] == '' and not rl['card'] and rl['view'] == 'links' and rl['skill'] == [1, 3] and rl['hex'] == cd['hx'],
              'after a reload the match is waiting: PLAY picks it up (no card, no toll asked), tier U with its hexes', rl)
        await pg.evaluate("window.__ft = []; const ft = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t) { if (typeof t === 'string' && t.includes('Hex')) window.__ft.push(t); return ft.apply(this, arguments); }; 0")

        # a loss (they are dormie on the last hole and win it) counts a try, and pays no piece
        await pg.evaluate("""const G = wGL.G; G.res = [1, 1, 1, 1, 1, 1, 1, 1].slice(0, G.holes - 1); G.won = [0, G.holes - 1]; G.h = G.holes - 1; G.hole.st = [0, 0]; G.hole.done = [false, false]; G.hole.par = wGL.parOf(G.h);
          wGL.speed = 8; wGL.setMode('watch')""")
        await pg.wait_for_function("!wLinksLive()", timeout=90000)
        ls = await pg.evaluate("({ tries: WG.umbral.tries.links || 0, pieces: WG.umbral.pieces.slice(), last: WG.lkg.games[0] })")
        check(ls['tries'] == 1 and 'golf' not in ls['pieces'] and ls['last']['r'] == 'lose' and ls['last']['tier'] == 4, 'a loss counts a try, and the flag stays with them', ls)
        await pg.evaluate("wLeaveLinks(); wDrain()")

        # backing away from the card costs nothing, even on a retry
        bk = await pg.evaluate("""(() => { RUN.gold = 200; const g0 = RUN.gold; const why = wNadirMatch('links'); const card = !!document.querySelector('[data-ugl]'); const toll = document.getElementById('modalBox').textContent.includes('toll, 30 gold');
          document.getElementById('wUglNo').click(); return { why, card, toll, back: RUN.gold - g0, live: wLinksLive() }; })()""")
        check(bk['why'] == '' and bk['card'] and bk['toll'] and bk['back'] == 0 and not bk['live'], 'on a retry the card names the toll, and backing away costs nothing', bk)

        # a win pays the Hollow Flag (and its gold); the toll is paid once, at the first tee
        await pg.evaluate("RUN.gold = 200; window.__g1 = RUN.gold; window.__l0 = WLOG.length; wNadirMatch('links')")
        await pg.wait_for_function("!!document.querySelector('[data-ugl]')")
        await pg.click('[data-ugl="play"]')
        await pg.wait_for_function("UI.view === 'links' && wLinksLive() && wGL.mode === 'play'")
        tl = await pg.evaluate("({ paid: window.__g1 - RUN.gold, lines: WLOG.slice(window.__l0).filter(l => /pay the toll/.test(l[0])).length })")
        await pg.evaluate("""const G = wGL.G; G.res = [0, 0, 0, 0, 0, 0, 0, 0].slice(0, G.holes - 1); G.won = [G.holes - 1, 0]; G.h = G.holes - 1; G.hole.st = [0, 0]; G.hole.done = [false, false]; G.hole.par = wGL.parOf(G.h);
          wGL.speed = 8; wGL.setMode('watch')""")
        await pg.wait_for_function("!wLinksLive()", timeout=90000)
        wn = await pg.evaluate("({ pieces: WG.umbral.pieces.slice(), beaten: !!WG.umbral.beaten.links, gold: RUN.gold - window.__g1, paid: WG.umbral.paid && WG.umbral.paid.links, again: wNadirMatch('links') })")
        check(tl['paid'] == 30 and tl['lines'] == 1 and wn['paid'] == 1, 'the retry\'s toll is paid at the first tee, once', [tl, wn])
        check('golf' in wn['pieces'] and wn['beaten'] and wn['gold'] >= 100 - 30 and 'yours' in wn['again'], 'a win pays the Hollow Flag and the gold, and they have nothing left to play for', wn)
        await pg.evaluate("wLeaveLinks(); wDrain()")

        sm = await pg.evaluate("""(() => { const U = WG.umbral; U.pieces = []; U.tries = {}; U.paid = {}; delete U.beaten.links; wDrain(); const n0 = WG.lkg.games.length; const why = wNadirMatch('links');
          document.querySelector('[data-ugl="sim"]').click(); const g = WG.lkg.games[0];
          return { why, played: WG.lkg.games.length - n0, live: wLinksLive(), r: g.r, tier: g.tier, settled: g.r === 'win' ? U.pieces.includes('golf') : (U.tries.links || 0) === 1 }; })()""")
        check(sm['why'] == '' and sm['played'] == 1 and not sm['live'] and sm['tier'] == 4 and sm['settled'], 'Simulate plays the champion\'s match at once, and settles it', sm)
        await pg.evaluate("wDrain(); for (let i = 0; i < 3 && !document.getElementById('modal').hidden; i++) { const b = document.getElementById('wLinksOk'); if (b) b.click(); }")

        lb = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.pieces = []; U.tries = {}; LAB = true; const n0 = WG.lkg.games.length; const why = wNadirMatch('links'); LAB = false;
          return { why, played: WG.lkg.games.length - n0, settled: U.pieces.includes('golf') || (U.tries.links || 0) === 1 }; })()""")
        check(lb['why'] == '' and lb['played'] == 1 and lb['settled'], 'in LAB mode (the realm bot) PLAY simulates at once', lb)

        # a finale round through the same adapter: no piece, no toll, the finale's hexes
        fn = await pg.evaluate("""(() => { const U = WG.umbral; U.pieces = Object.keys(W_UMB_PIECES); U.finaleSports = ['golf', 'baseball', 'football']; U.finale = 0; U.tries = { links: 2 }; U.sealed = 0; RUN.gold = 300;
          const g0 = RUN.gold, n0 = WG.lkg.games.length, l0 = WLOG.length; LAB = true; let why; try { why = wUmbFinale(); } finally { LAB = false; }
          const F = W_NADIR.finale, g = WG.lkg.games[0];
          return { why, engine: F.engine, piece: F.piece, toll: F.toll, played: WG.lkg.games.length - n0, tier: g.tier, r: g.r, finale: U.finale, tf: U.tries.finale || 0,
            tolled: WLOG.slice(l0).some(l => /pay the toll/.test(l[0])) }; })()""")
        check(fn['why'] == '' and fn['engine'] == 'links' and fn['piece'] is None and fn['toll'] == 0 and fn['played'] == 1 and fn['tier'] == 4 and not fn['tolled']
              and ((fn['r'] == 'win' and fn['finale'] == 1) or (fn['r'] == 'lose' and fn['finale'] == 0 and fn['tf'] == 1)), 'a finale round plays through the golf adapter: tier U, no toll, and the round is settled', fn)
        fc = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.finale = 0; wUmbFinaleEntry(); const why = W_UMB4.start.links(W_NADIR.finale, 'finale'); const t = document.getElementById('modalBox').textContent;
          const out = { why, card: !!document.querySelector('[data-ugl]'), toll: /toll/.test(t), round: t.includes('a round of the Seal'), hexes: (t.match(/\\(/g) || []).length };
          const b = document.getElementById('wUglNo'); if (b) b.click(); return out; })()""")
        check(fc['why'] == '' and fc['card'] and not fc['toll'] and fc['round'], 'the finale\'s card plays for a round of the Seal, and names no toll', fc)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
