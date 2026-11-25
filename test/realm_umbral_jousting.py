# Realm: jousting in the Umbral (issue #117, phase 11). Tier U at the Lists (tier 4: the rating bonus, the Lich riding
# for them, a full bag), jousting's hexes (each does what it says, none changes a match without them), the Hollow Lists
# (the Tilting Lists' dark mirror, with its guards and gate) and its champion end to end: PLAY opens the card with the
# hexes, the match starts the Realm's jousting match at tier U with them (named in the log, before the first course, on
# the lists, on the bar and in the board's caption), the Lists' ways off, always three courses a heat; it saves and
# resumes (after a reload too); a win pays the Splintered Lance and a loss counts a try; the toll is paid once, as the
# match starts; backing away from the card costs nothing; Simulate and LAB settle at once; a finale round plays through
# the same adapter; a Hardcore journey lost in a finale round ends on the end screen with no result card over it.
# And the Seal's count: a new Umbral asks for all ten pieces; one opened before (no WG.umbral.need) asks for the nine it
# opened with, mid-Seal too. The champion's feat and the piece's song, and the redeemed champion's own ultimate.
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

HELP = r"""
window.__T = (ks, nm) => ({ name: nm, short: nm.slice(0, 3).toUpperCase(), roster: ks.map((k, i) => ({ n: nm + i, kind: k })) });
window.__A = () => __T(['elf', 'werewolf', 'spider', 'kobold'], 'Mine'); window.__B = () => __T(['wraith', 'vampire', 'spider', 'witch'], 'Other');
window.__to = (f, max) => { let n = 0; while (!f() && n++ < (max || 40000)) wJT.tick(0.05); return !!f(); };
// the live match's last course, side `lead` five up: whatever the course does, the match is theirs; it rides out in Watch
window.__last = lead => { wJT.pause(true); const G = wJT.G, n = G.courses; G.sc = [[Array(n).fill(0), Array(n).fill(0)], [Array(n).fill(0), Array(n).fill(0)]];
  G.sc[lead][0][0] = 3; G.sc[lead][0][1] = 2; G.sc[0][1][n - 1] = null; G.sc[1][1][n - 1] = null; G.heat = 1; G.course = n - 1; G.ended = [null, null];
  wJT.setMode('watch'); let k = 0; while (wListsLive() && k++ < 40000) wJT.tick(0.05); return !wListsLive(); };
0"""
SKIP = "(() => { let i = 0; while (!document.getElementById('modal').hidden && i++ < 20) { const b = [...document.querySelectorAll('#modalBox button')].find(x => /^(Skip|Done|Later|Not now|Home, then)$/.test(x.textContent.trim())); if (!b) break; b.click(); } })()"
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
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbJtFour === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false; for (const k in MAPS) delete MAPS[k]")
        await pg.evaluate(HELP)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("""wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 200; RUN.gold = 500; SET.listsCourses = 5;
          const ks = ['elf', 'spider', 'gorgon', 'dwarf'].filter(k => !wRoster().some(p => p.kind === k));
          while (wRoster().length < 4) wRecruit({ kind: ks.pop(), lvl: 6 }, 'tavern');
          for (const p of wRoster()) p.lvl = 6; WG.lists = null; wListsSync(); wSave()""")

        # ---------- tier U in the tables ----------
        tb = await pg.evaluate("""({ bonus: Object.assign({}, W_JTG.oppBonus), skill: [1, 2, 3, 4].map(t => wListsSkillOf(t)), name: W_BALL_SKILL[wListsSkillOf(4)[1]], eng: wJT.lich.n,
          skills: wJT.skills.length, bag: W_LISTS_KIT.opp[4], pots: Object.keys(wJT.potions), tiers: [1, 2, 3].map(t => JSON.stringify(W_LISTS_KIT.opp[t])),
          lich: { aim: wJT.lich.aim, couch: wJT.lich.couch, lean: wJT.lich.lean }, arch: wJT.skills[2] })""")
        check(tb['bonus']['1'] == 1 and tb['bonus']['2'] == 1 and tb['bonus']['3'] == 1 and '4' in tb['bonus'] and tb['skill'] == [[1, 0], [1, 1], [1, 2], [1, 3]] and tb['name'] == 'Lich' and tb['eng'] == 'Lich' and tb['skills'] == 3,
              'tier U is a fourth row: its rating bonus, the Lich (skill 3, its own row: the exhibition still offers three skills); tiers 1 to 3 as they were', tb)
        check(sorted(tb['bag'].keys()) == sorted(tb['pots']) and all(v >= 1 for v in tb['bag'].values()), 'their squires bring a full bag at tier U', tb)
        check(tb['lich']['aim'] < tb['arch']['aim'] and tb['lich']['couch'] < tb['arch']['couch'] and tb['lich']['lean'] > tb['arch']['lean'], 'the Lich rides with surer hands than an Archmage: a steadier tip, a truer couch, a surer lean', tb)

        # ---------- the Lich: its own row, and its own reckoning ----------
        lc = await pg.evaluate("""(() => { const out = { plans: 0, diff: 0, why: 0 }, J = p => [p.aim, p.guard, p.pace].join('|');
          for (let i = 0; i < 8; i++) { wJT.start({ seed: 70 + i, teams: [__A(), __B()], skill: [1, 3], mode: 'watch' }); wJT.hide(); const G = wJT.G;
            out.g = { skill: G.skill.slice(), lich: G.lich.slice() };
            for (let k = 0; k < 20 && !G.over; k++) { const L = G.lich; delete G.lich; const a = J(wJT.plan(1)); G.lich = L; const P = wJT.plan(1); out.plans++; if (J(P) !== a) out.diff++; if (/a Lich/.test(P.why)) out.why++; wJT.turn(); } }
          wJT.start({ seed: 9, teams: [__A(), __B()], skill: [1, 3], mode: 'watch' }); wJT.hide(); const o = wJT.rideOpts(1), m = wJT.rideOpts(0);
          out.hands = [o.hands.aim, o.hands.couch, o.hands.lean, m.hands.aim];
          out.card = wJT.card(0).skill; wJT.start({ seed: 9, teams: [__A(), __B()], skill: [1, 2], mode: 'watch' }); wJT.hide(); out.plain = { lich: wJT.G.lich === undefined, card: wJT.card(0).skill };
          return out; })()""")
        check(lc['g'] == {'skill': [1, 2], 'lich': [0, 1]} and lc['plain']['lich'] and lc['card'] == 'Lich' and lc['plain']['card'] == 'Archmage', 'skill 3 is the Lich: its side reads 2 for every table by skill, marked G.lich, named on the herald\'s card; none without it', lc)
        check(lc['hands'][:3] == [tb['lich']['aim'], tb['lich']['couch'], tb['lich']['lean']] and lc['hands'][3] == 1, 'its rider rides with the Lich\'s hands; yours with your own', lc['hands'])
        check(lc['plans'] >= 20 and lc['diff'] >= 1 and lc['why'] == lc['plans'], 'it reckons with the rider it meets: its reason says so, and now and then it rides another plan than an Archmage would', lc)

        # ---------- hexes ----------
        hx = await pg.evaluate("""(() => { const out = {}, J = x => JSON.stringify(x), base = { teams: [__A(), __B()], powers: true, bags: [{ draught: 1 }, { draught: 1, jtoil: 1 }], ground: true, skill: [1, 2] };
          const sim = o => J(wJT.simMatch(Object.assign({}, base, o)));
          out.ids = Object.keys(wJT.hexes);
          out.same = sim({ seed: 21 }) === sim({ seed: 21, hexes: [] }) && sim({ seed: 22 }) === sim({ seed: 22, hexes: ['nothing', 'toString'] });
          wJT.start({ seed: 5, mode: 'watch', teams: [__A(), __B()] }); wJT.hide(); out.noHex = wJT.hex(); out.noFx = [wJT.hexFx(0), wJT.hexFx(1)];
          const fx = (h, on) => { wJT.start({ seed: 5, mode: 'watch', teams: [__A(), __B()], hexes: [h], hexOn: on }); wJT.hide(); return [wJT.hexFx(0), wJT.hexFx(1)]; };
          const H = wJT.hexes, m = fx('mist'), n = fx('nag'), c = fx('cold'), s = fx('shroud'), s1 = fx('shroud', 1);
          out.mist = [m[0].sway, m[1] ? m[1].sway : 1, H.mist.sway]; out.nag = [n[0].wind, n[1] ? n[1].wind : 1, H.nag.wind, n[0].speed, H.nag.speed]; out.cold = [c[0].hold, c[1] ? c[1].hold : 0, H.cold.hold];
          out.shroud = [s[1].turn, s[0] ? s[0].turn : 1, H.shroud.turn, s1[0].turn];
          // they act in the model: a lance on their shield breaks less often, your seat holds worse, your tip sways more
          const ride = { aim: 'shield', guard: 'square', pace: 'canter', speed: 9, couch: 0, tip: { x: -4, y: 4 }, rs: wJT.rs('elf'), mount: 'destrier' }, d = { guard: 'square', rs: wJT.rs('wraith'), mount: 'destrier' };
          const pb = f => wJT.strike(ride, Object.assign({}, d, f ? { fx: f } : {}), () => .5).pb;
          out.pb = [pb(null), pb(s[1])];
          const st = { broke: true, rock: .5 }, hold = f => wJT.seat(st, Object.assign({}, d, f ? { fx: f } : {}), .5, () => .5).hold;
          out.hold = [hold(null), hold(c[0])];
          const sw = f => wJT.sway(Object.assign({ pace: 'canter', mount: 'destrier', rs: wJT.rs('elf'), wind: 1, couch: 0, hands: 1 }, f ? { fx: f } : {})).sigma;
          out.sway = [sw(null), sw(m[0])];
          // a match with hexes is a different match; side 1's hexes are its own
          out.differ = sim({ seed: 23 }) !== sim({ seed: 23, hexes: ['mist', 'cold'] });
          return out; })()""")
        check(hx['same'] and hx['noHex'] is None and hx['noFx'] == [None, None], 'no hexes (or none the engine knows) and the match is the same match, seed for seed', hx)
        check(sorted(hx['ids']) == ['cold', 'mist', 'nag', 'shroud'], 'jousting has four hexes', hx['ids'])
        check(abs(hx['mist'][0] - hx['mist'][2]) < 1e-9 and hx['mist'][1] == 1 and hx['sway'][1] > hx['sway'][0] * 1.1, 'Grave Mist: your tip sways more (theirs not), in the model too', [hx['mist'], hx['sway']])
        check(abs(hx['nag'][0] - hx['nag'][2]) < 1e-9 and hx['nag'][1] == 1 and abs(hx['nag'][3] - hx['nag'][4]) < 1e-9 and hx['nag'][4] < 1, 'Hollow Mounts: your mounts charge slower and each course costs them more wind (theirs not)', hx['nag'])
        check(abs(hx['cold'][0] - hx['cold'][2]) < 1e-9 and hx['cold'][1] == 0 and hx['hold'][1] < hx['hold'][0] - .05, 'The Cold Saddle: your riders sit a hit worse (theirs not)', [hx['cold'], hx['hold']])
        check(abs(hx['shroud'][0] - hx['shroud'][2]) < 1e-9 and hx['shroud'][1] == 1 and abs(hx['shroud'][3] - hx['shroud'][2]) < 1e-9 and abs(hx['pb'][1] / hx['pb'][0] - hx['shroud'][2]) < 1e-6,
              'Shrouded Shields: their side drinks your lance (a lance on them breaks less often); on the other side, the other way', [hx['shroud'], hx['pb']])
        check(hx['differ'], 'a match with hexes is a different match', hx)

        # ---------- the champion and the Hollow Lists ----------
        ch = await pg.evaluate("""(() => { const C = W_NADIR.lists, ch = DB.chars[C.char], T = wUmbJtFour(6), m = MAPS['u:g_lists'];
          const ids = Object.values(wJT.ult).concat(Object.values(wJT.pow).flat(), Object.values(wJT.pow2).flat()).map(x => x.id);
          return { C, greet: ch.greet, play: ch.topics.play.act, map: !!m && m.npcs.some(n => n.id === C.char), mapName: m && m.name, grounds: Object.keys(W_UMB4.grounds).length, inMaps: W_UMB.maps.includes('g_lists'),
            guards: [0, 1].map(i => !!m && m.npcs.some(n => n.id === wUmbGuardOf('g_lists', i))), gate: W_UMB4.gate[C.region], wall: !!(m && m.gauntlet), team: T.name, shade: T.shade,
            champ: T.roster.filter(x => x.ult).map(x => [x.n, x.ult]), riders: T.riders, best: T.best, heat2: T.roster[T.riders[1]].n, ult: wJT.ultOwn.palecharge && wJT.ultOwn.palecharge.n, clash: ids.includes('palecharge'),
            n: T.roster.length, h1: wUmbJtHexes('lists', 1), h2: wUmbJtHexes('lists', 1), piece: W_UMB_PIECES.jousting, five: W_UMB5.engine.jousting, audit: wAudit() }; })()""")
        C = ch['C']
        check(C['ground'] == 'g_lists' and C['map'] == 'u:g_lists' and C['region'] == 'bloom' and C['engine'] == 'lists' and C['piece'] == 'jousting' and C['hexes'] in (1, 2) and ch['map'] and ch['five'] == 'lists',
              'the Hollow Lists\' champion holds the Splintered Lance, stands on the dark ground, and jousting has its way to play in the Seal', ch)
        check(ch['mapName'] == 'The Hollow Lists' and ch['inMaps'] and ch['grounds'] == 9 and all(ch['guards']) and ch['gate'] == 'mossberry' and ch['wall'],
              'the Tilting Lists has its dark mirror, the Hollow Lists: built by the transform, with its two guards, the Rotwold\'s gate and the bone wall', ch)
        check('PLAY' in ch['greet'] and 'RULES' in ch['greet'] and ch['play'] == 'unadir:lists' and ch['n'] == 4 and ch['champ'] == [['Isolde Grave', 'palecharge']] and ch['heat2'] == 'Isolde Grave' and ch['best'] == 1 and ch['ult'] == 'The Pale Charge' and not ch['clash'] and ch['shade'],
              'she says PLAY and RULES, fields the Nadir four in shadow, riding the second heat and the tilt for the crown, with an ultimate of her own (an id nobody else has)', ch)
        check(ch['piece']['n'] == 'The Splintered Lance' and ch['h1'] == ch['h2'] and len(ch['h1']) == C['hexes'], 'the piece, and the hexes for a try are fixed (a reload draws the same)', ch)
        check(ch['audit'] == [], 'the audit is clean', ch['audit'])
        uo = await pg.evaluate("""(() => { wJT.start({ seed: 3, mode: 'watch', powers: true, teams: [wListsMine(), wUmbJtFour(6)], riders: [[0, 1], [0, 1]] }); wJT.hide();
          const out = { champ: wJT.ultOf(1, 1).id, first: wJT.ultOf(1, 0).id, kind: wJT.ult.wraith.id, mine: wJT.ultOf(0, 0).id };
          wJT.start({ seed: 3, mode: 'watch', powers: true, teams: [__A(), __B()] }); wJT.hide(); out.plain = wJT.ultOf(1, 1).id; out.plainKind = wJT.ult[__B().roster[1].kind].id; return out; })()""")
        check(uo['champ'] == 'palecharge' and uo['first'] == uo['kind'] and uo['mine'] != 'palecharge' and uo['plain'] == uo['plainKind'], 'the champion casts her own ultimate when she rides; any other rider their kind\'s, as before', uo)

        # PLAY, past the guards and the gate: the card, then the match
        await pg.evaluate("WG.umbral.guards = { 'g_lists:0': WG.dayAbs, 'g_lists:1': WG.dayAbs }; WG.umbral.gates = { lists: WG.dayAbs }; " + HEXCAP + "; wRunAct('unadir:lists', 'nadir_lists')")
        await pg.wait_for_function("!!document.querySelector('[data-ujt]')")
        cd = await pg.evaluate("""(() => { const t = document.getElementById('modalBox').textContent, hx = wUmbJtHexes('lists', W_NADIR.lists.hexes);
          return { tierU: t.includes('tier U'), lich: t.includes('Lich'), hexes: hx.every(h => t.includes(wJT.hexes[h].n)), hx, free: t.includes('first match is free'), feat: t.includes('three points'), three: t.includes('two heats of 3') }; })()""")
        check(cd['tierU'] and cd['lich'] and cd['hexes'] and cd['free'] and cd['feat'] and cd['three'], 'PLAY opens the game card: tier U, the Lich, the hexes for this try, the first match free, the feat, always three courses a heat', cd)
        await pg.click('[data-ujt="manage"]')
        await pg.wait_for_function("UI.view === 'lists' && wListsLive() && !!WG.jtg.live.snap")
        gm = await pg.evaluate("""(() => { wJT.pause(true); const G = wJT.G, W = WG.jtg.live.world;
          return { tier: W.tier, kind: W.kind, club: W.club, skill: G.skill, lich: G.lich, hex: wJT.hex(), opp: G.teams[1].name, bag: G.bags[1], ground: G.ground || null, courses: G.courses, set: SET.listsCourses,
            log: WLOG.slice(-6).map(l => l[0]).join(' | '), champ: G.teams[1].roster.some(m => m.ult === 'palecharge'), shade: !!G.teams[1].shade,
            note: document.getElementById('wListsNote').textContent, cap: (document.querySelector('#wListsBoard caption') || {}).textContent || '' }; })()""")
        check(gm['tier'] == 4 and gm['kind'] == 'unadirjt' and gm['skill'] == [1, 2] and gm['lich'] == [0, 1] and gm['opp'] == 'Hollow Lists Nadir' and sorted(gm['bag'].keys()) == sorted(tb['pots']) and gm['champ'] and gm['shade'],
              'the match starts the Realm\'s jousting match at tier U against the Nadir four, in shadow: the Lich riding, a full bag, the champion\'s own ultimate', gm)
        check(gm['ground'] is None and gm['courses'] == 3 and gm['set'] == 5 and 'next match' not in gm['note'], 'the Lists\' ways are off on the Hollow Lists, and it is always three courses a heat (Settings left as it was, and no "from the next match" note)', gm)
        names = await pg.evaluate("wJT.hex() ? wJT.hex().ids.map(h => wJT.hexes[h].n) : []")
        check(gm['hex'] and gm['hex']['ids'] == cd['hx'] and gm['hex']['on'] == 0 and 'draws the hexes' in gm['log'] and 'Hexes' in gm['note'] and all(n in gm['cap'] for n in names),
              'the drawn hexes are on the match, named in the log, on the bar and in the board\'s caption', [gm['note'][-200:], gm['cap'], gm['hex']])
        await pg.evaluate("wJT.pause(false)")
        await pg.wait_for_function("window.__ft.some(t => t.includes('Hexes on'))")
        ft = await pg.evaluate("window.__ft.filter(t => t.includes('Hexes on')).slice(-1)[0]")
        check(all(n.split(' ')[0] in ft for n in names), 'the hexes are on the lists, top right', ft)
        first = await pg.evaluate("""(() => { wJT.pause(true); const G = wJT.G, sn = wJT.snapshot(); wJT.start({ teams: G.teams.map(t => ({ name: t.name, short: t.short, roster: t.roster })), mode: 'watch', hexes: G.hex.ids }); const m = wJT.msg;
          wJT.resume(sn); wJT.pause(true); return m; })()""")
        check('Hexes on' in first and all(n in first for n in names), 'they are named before the first course', first)

        # save and leave, then resume: the hexes and the Lich come back with it
        rs = await pg.evaluate("""(() => { wListsLeaveGame(); const out = { left: UI.view, live: wListsLive() }; wResumeLists(); wJT.pause(true); const G = wJT.G;
          return Object.assign(out, { back: UI.view, lich: G.lich, hex: wJT.hex() && wJT.hex().ids, kind: WG.jtg.live && WG.jtg.live.world.kind }); })()""")
        check(rs['live'] and rs['left'] != 'lists' and rs['back'] == 'lists' and rs['lich'] == [0, 1] and rs['hex'] == cd['hx'] and rs['kind'] == 'unadirjt', 'save and leave keeps the match; resumed, it is still tier U with its hexes', rs)
        # ...and after a reload too
        await pg.evaluate("wListsLeaveGame(); wSave()")
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbJtFour === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)
        await pg.evaluate("wStart(wLoadSave())"); await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate("for (let i = 0; i < 4 && !document.getElementById('modal').hidden; i++) { const b = document.getElementById('wJtLater'); if (b) b.click(); else break; }")
        rl = await pg.evaluate("""(() => { const live = wListsLive(), g0 = RUN.gold; RUN.gold = 0; const why = wNadirMatch('lists'); const card = !!document.querySelector('[data-ujt]'); RUN.gold = g0; wJT.pause(true);
          return { live, why, card, view: UI.view, lich: wJT.G.lich, hex: wJT.hex() && wJT.hex().ids, need: WG.umbral.need.length }; })()""")
        check(rl['live'] and rl['why'] == '' and not rl['card'] and rl['view'] == 'lists' and rl['lich'] == [0, 1] and rl['hex'] == cd['hx'] and rl['need'] == 10,
              'after a reload the match is waiting: PLAY picks it up (no card, no toll asked), tier U with its hexes; this Umbral still asks for all ten pieces', rl)

        # a loss (five down going into the last course) counts a try, and pays no piece
        ls = await pg.evaluate("(() => { const done = __last(1); return { done, tries: WG.umbral.tries.lists || 0, pieces: WG.umbral.pieces.slice(), last: WG.jtg.games[0] }; })()")
        check(ls['done'] and ls['tries'] == 1 and 'jousting' not in ls['pieces'] and ls['last']['r'] == 'lose' and ls['last']['tier'] == 4, 'a loss counts a try, and the lance stays with her', ls)
        await pg.evaluate("wLeaveLists(); wDrain()")

        # backing away from the card costs nothing, even on a retry
        bk = await pg.evaluate("""(() => { RUN.gold = 200; const g0 = RUN.gold; const why = wNadirMatch('lists'); const card = !!document.querySelector('[data-ujt]'); const toll = document.getElementById('modalBox').textContent.includes('toll, 20 gold');
          document.getElementById('wUjtNo').click(); return { why, card, toll, back: RUN.gold - g0, live: wListsLive() }; })()""")
        check(bk['why'] == '' and bk['card'] and bk['toll'] and bk['back'] == 0 and not bk['live'], 'on a retry the card names the toll, and backing away costs nothing', bk)

        # a win pays the Splintered Lance (and its gold); the toll is paid once, as the match starts
        await pg.evaluate("RUN.gold = 200; window.__g1 = RUN.gold; window.__l0 = WLOG.length; wNadirMatch('lists')")
        await pg.wait_for_function("!!document.querySelector('[data-ujt]')")
        await pg.click('[data-ujt="play"]')
        await pg.wait_for_function("UI.view === 'lists' && wListsLive() && wJT.mode === 'play'")
        tl = await pg.evaluate("({ paid: window.__g1 - RUN.gold, lines: WLOG.slice(window.__l0).filter(l => /pay the toll/.test(l[0])).length })")
        wn = await pg.evaluate("(() => { const done = __last(0); return { done, pieces: WG.umbral.pieces.slice(), beaten: !!WG.umbral.beaten.lists, gold: RUN.gold - window.__g1, paid: WG.umbral.paid && WG.umbral.paid.lists, again: wNadirMatch('lists'), log: WLOG.slice(-12).map(l => l[0]).join(' | ') }; })()")
        check(tl['paid'] == 20 and tl['lines'] == 1 and wn['paid'] == 1, 'the retry\'s toll is paid as the match starts, once', [tl, wn])
        check(wn['done'] and 'jousting' in wn['pieces'] and wn['beaten'] and wn['gold'] >= 100 - 20 and 'yours' in wn['again'] and '1 of 10 pieces' in wn['log'], 'a win pays the Splintered Lance and the gold (1 of 10), and she has nothing left to play for', wn)
        await pg.evaluate("wLeaveLists(); wDrain()")

        sm = await pg.evaluate("""(() => { const U = WG.umbral; U.pieces = []; U.tries = {}; U.paid = {}; delete U.beaten.lists; wDrain(); const n0 = WG.jtg.games.length; const why = wNadirMatch('lists');
          document.querySelector('[data-ujt="sim"]').click(); const g = WG.jtg.games[0], card = !!document.getElementById('wListsOk'); if (card) document.getElementById('wListsOk').click();
          return { why, played: WG.jtg.games.length - n0, live: wListsLive(), r: g.r, tier: g.tier, level: g.us !== g.them, card, settled: g.r === 'win' ? U.pieces.includes('jousting') : (U.tries.lists || 0) === 1 }; })()""")
        check(sm['why'] == '' and sm['played'] == 1 and not sm['live'] and sm['tier'] == 4 and sm['level'] and sm['card'] and sm['settled'], 'Simulate plays the champion\'s match at once, never level, shows the final, and settles it', sm)

        lb = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.pieces = []; U.tries = {}; delete U.beaten.lists; LAB = true; const n0 = WG.jtg.games.length; const why = wNadirMatch('lists'); LAB = false;
          return { why, played: WG.jtg.games.length - n0, settled: U.pieces.includes('jousting') || (U.tries.lists || 0) === 1 }; })()""")
        check(lb['why'] == '' and lb['played'] == 1 and lb['settled'], 'in LAB mode (the realm bot) PLAY simulates at once', lb)

        # the feat and the piece's song
        ft2 = await pg.evaluate("""(() => { const F = wUmbFeat('lists'), U = WG.umbral, b = W_UMB8J.boons.jousting; U.pieces = []; const s0 = wUmbBoon('jousting'); U.pieces = ['jousting']; U.well = {}; const s1 = wUmbBoon('jousting'); U.well = { jousting: 1 }; const s2 = wUmbBoon('jousting');
          return { F, s: [s0, s1, s2], b, panel: wUmbSealPanel().includes('The Splintered Lance') }; })()""")
        check(ft2['F'] and ft2['F']['k'] == 'margin' and ft2['F']['by'] == 3 and ft2['s'] == [0, 3, 4] and ft2['panel'], 'the champion\'s feat (win by three points), and the piece sings: the cold on the dark grounds bites every 3 steps, or 4 won well', ft2)
        cold = await pg.evaluate("""(() => { const U = WG.umbral, m = MAPS['u:g_lists']; let x0 = null;
          for (let y = 1; y < m.h - 1 && !x0; y++) for (let x = 1; x < m.w - 2 && !x0; x++) if ([0, 1, 2].every(d => walkCh(m.t[y][x + d]) && !m.npcs.some(n => n.x === x + d && n.y === y))) x0 = [x, y];
          const walk = n => { WG.map = 'u:g_lists'; WG.x = x0[0]; WG.y = x0[1]; WG.umbCold = 0; RUN.hp = 100; let k = 0; for (let i = 0; i < n; i++) { wTryMove(i % 2 ? -1 : 1, 0); } return 100 - RUN.hp; };
          U.pieces = []; const a = walk(12); U.pieces = ['jousting']; U.well = {}; const b = walk(12); U.pieces = []; WG.map = 'world'; return [a, b]; })()""")
        check(cold[0] == 6 and cold[1] == 4, 'held, the Splintered Lance makes the cold bite every third step, not every second', cold)

        # a finale round through the same adapter, as the realm bot drives it: no piece, no toll, the finale's own count
        fn = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.pieces = Object.keys(W_UMB_PIECES); U.finaleSports = ['jousting', 'baseball', 'football']; U.finale = 0; U.tries = { lists: 2 }; U.sealed = 0; RUN.gold = 300;
          const g0 = RUN.gold, n0 = WG.jtg.games.length, l0 = WLOG.length; LAB = true; let why; try { why = wUmbFinale(); } finally { LAB = false; }
          const F = W_NADIR.finale, g = WG.jtg.games[0];
          return { why, engine: F.engine, piece: F.piece, toll: F.toll, played: WG.jtg.games.length - n0, tier: g.tier, name: g.name, r: g.r, finale: U.finale, tf: U.tries.finale || 0,
            tolled: WLOG.slice(l0).some(l => /pay the toll/.test(l[0])), gold: RUN.gold - g0 }; })()""")
        check(fn['why'] == '' and fn['engine'] == 'lists' and fn['piece'] is None and fn['toll'] == 0 and fn['played'] == 1 and fn['tier'] == 4 and fn['name'] == 'Nadir Athletic' and not fn['tolled']
              and ((fn['r'] == 'win' and fn['finale'] == 1) or (fn['r'] == 'lose' and fn['finale'] == 0 and fn['tf'] == 1)), 'in LAB a finale round of jousting plays through the real adapter at once: Nadir Athletic, tier U, no toll, and the round is settled', fn)
        fc = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral; U.finale = 0; wUmbFinaleEntry(); const F = W_NADIR.finale, hx = wUmbJtHexes('finale', F.hexes); const why = W_UMB4.start.lists(F, 'finale'); const t = document.getElementById('modalBox').textContent;
          const out = { why, card: !!document.querySelector('[data-ujt]'), toll: /toll/.test(t), round: t.includes('a round of the Seal'), seal: t.includes('The Seal: jousting'), want: F.hexes, drawn: hx.length, named: hx.every(h => t.includes(wJT.hexes[h].n)) };
          const b = document.getElementById('wUjtNo'); if (b) b.click(); return out; })()""")
        check(fc['why'] == '' and fc['card'] and not fc['toll'] and fc['round'] and fc['seal'] and fc['drawn'] == fc['want'] and fc['named'], 'the finale\'s card plays for a round of the Seal, names no toll, and draws exactly the round\'s hexes', fc)

        # ---------- the Seal's count: ten for a new Umbral, nine for one opened before ----------
        sc = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral, out = {}; U.finale = 0; U.finaleSports = null; U.tries = {};
          U.pieces = W_UMB_NINE.slice(); out.newShort = wUmbFinale(); out.got = wUmbGot();
          // an Umbral from before: no need on it; loaded, it asks for the nine it opened with
          delete U.need; const save = JSON.parse(JSON.stringify({ WG, RUN })); wStart(save); const V = WG.umbral;
          out.need = V.need; out.journal = W_JTAB_FN.umbral()[0];
          LAB = true; try { out.old = wUmbFinale(); } finally { LAB = false; }
          out.sports = V.finaleSports; out.engine = W_NADIR.finale.engine;
          // ...mid-Seal too: the round it is on stays the round it was on
          V.finale = 1; V.finaleSports = ['baseball', 'card', 'football']; const s2 = JSON.parse(JSON.stringify({ WG, RUN })); delete s2.WG.umbral.need; wStart(s2);
          out.mid = { need: WG.umbral.need.length, entry: wUmbFinaleEntry().engine, sports: WG.umbral.finaleSports };
          // its jousting piece can still be won: it sings, and the Seal never counted it
          WG.umbral.pieces = W_UMB_NINE.concat('jousting'); out.got2 = wUmbGot(); out.boon = wUmbBoon('jousting');
          return out; })()""")
        check('9 of the ten pieces' in sc['newShort'] and 'The Splintered Lance' in sc['newShort'] and sc['got'] == 9, 'a new Umbral asks for all ten: with the old nine, Hollow Aurelia names the Splintered Lance still out', sc)
        check(sc['need'] == ['card', 'baseball', 'basketball', 'golf', 'bowling', 'curling', 'football', 'boxing', 'hockey'] and sc['journal'] == '9/9' and sc['old'] == '' and 'jousting' not in (sc['sports'] or []),
              'an Umbral opened before jousting\'s champion asks for the nine it opened with: loaded with them, the Seal plays, and never picks jousting for a round', sc)
        check(sc['mid'] == {'need': 9, 'entry': None, 'sports': ['baseball', 'card', 'football']} and sc['got2'] == 9 and sc['boon'] == 3,
              'mid-Seal it carries on with the round it was on; its jousting piece, won, sings but isn\'t counted', sc)
        # (phase 11's review) an Umbral opened before: a Legend's Shard can still be spent in the Seal, and every word of the
        # count reads its own nine (the jousting piece isn't "still out" for it: it can be won, but the Seal doesn't need it)
        os_ = await pg.evaluate("""(() => { wDrain(); const U = WG.umbral, out = {}; U.pieces = W_UMB_NINE.slice(); U.finale = 0; U.finaleSports = null; U.sealed = 0; U.shards = 1; U.shardOn = null;
          const say = k => (wSay('uherald', k).text || ''); out.seal = say('seal'); out.pieces = say('pieces');
          out.panel = wUmbSealPanel(); out.lanceOut = /Splintered Lance<\\/b> <small>still out/.test(out.panel); out.rows = (out.panel.match(/<li/g) || []).length;
          wUmbFinale(); out.shard = !document.getElementById('modal').hidden && /Legend's Shard/.test(document.getElementById('modalBox').textContent);
          for (let i = 0; i < 6 && !document.getElementById('modal').hidden; i++) { const b = document.querySelector('#modalBox [data-ushard=""], #wUjtNo, #modalBox [data-close], #modalBox button.ghost'); if (!b) break; b.click(); }
          wDrain(); U.finale = 0; U.finaleSports = null; U.shards = 0;
          // the Seal forged with the lance won too: nine pieces lock together
          U.pieces = W_UMB_NINE.concat('jousting'); const keepEnter = wEnterMap; wEnterMap = () => {}; LAB = true; try { wUmbSeal(); } finally { LAB = false; wEnterMap = keepEnter; }
          out.forged = (WLOG.slice(-6).find(l => /The Seal is forged/.test(l[0])) || [''])[0];
          wUmbSealScene(); out.scene = /Nine pieces, from nine games/.test(document.getElementById('modalBox').textContent); const sb = document.getElementById('wUmbSealed'); if (sb) sb.click();
          U.sealed = 0; U.sealScene = 0; U.finale = 0; U.sealedYear = null; wUmbHeraldSync();
          return out; })()""")
        check(os_['shard'], 'an Umbral opened before: holding its nine pieces and a Legend\'s Shard, the Seal offers to spend it', os_)
        check('Nine' in os_['seal'] and 'Ten' not in os_['seal'] and os_['pieces'].startswith('Nine.') and 'Ten' not in os_['pieces'], 'the herald counts the nine an older Umbral asks for (the SEAL and the PIECES)', [os_['seal'], os_['pieces']])
        check(not os_['lanceOut'] and os_['rows'] == 9, 'the Seal panel of an older Umbral lists its nine, and never the jousting piece as still out', os_['rows'])
        check('The nine pieces lock together' in os_['forged'] and os_['scene'], 'forged with the lance won as well, an older Umbral\'s Seal is nine pieces, in the log and the scene', os_['forged'])
        # (#120, phase 3) the rest of the count's words: the herald's GATE, the opening scene replayed from the Journal
        # (its clock run past the speech) and How to play's door, pieces and Seal; and a new Umbral still says ten
        async def words():
            return await pg.evaluate("""(async () => { wDrain(); const out = {}; out.gate = wSay('uherald', 'gate').text || ''; out.aurelia = wSay('nadir_aurelia', 'pieces').text || ''; out.journal = wUmbJournal()[1];
              const keepSp = WUS.speed; WUS.speed = 60; out.opened = wUmbScene(true) !== false;
              for (let i = 0; i < 60 && document.querySelectorAll('#wUmbLines p').length < 5 + W_UMB1.speech.length; i++) await new Promise(r => setTimeout(r, 100));
              WUS.speed = keepSp;
              out.scene = (document.getElementById('wUmbLines') || {}).textContent || ''; const sk = document.getElementById('wUmbSkip'); if (sk) sk.click(); wDrain();
              const h = document.getElementById('wHelpUmbral'); if (h) h.remove(); renderHelp(); out.help = (document.getElementById('wHelpUmbral') || {}).textContent || '';
              return out; })()""")
        old_w = await words()
        check('the nine' in old_w['gate'] and 'ten' not in old_w['gate'], 'an older Umbral: the herald\'s GATE is the gentlest of the nine', old_w['gate'])
        check('into nine pieces' in old_w['scene'] and 'Nine champions' in old_w['scene'] and 'ten' not in old_w['scene'].lower().replace('often', ''),
              'an older Umbral: the opening scene, replayed, says the Seal broke into nine pieces held by nine champions', old_w['scene'][-500:])
        check('into nine pieces, one for every way there was to play when it broke' in old_w['help'] and 'your Seal asks for nine of them' in old_w['help'] and 'With all nine' in old_w['help'] and 'into ten' not in old_w['help'],
              'an older Umbral: How to play counts nine pieces at the door, the pieces and the Seal (ten champions, nine of them its Seal\'s)', old_w['help'][:900])
        check(old_w['aurelia'].startswith('Nine') and 'there was to play' in old_w['aurelia'] and 'into nine pieces, one for every way there was to play when it broke' in old_w['journal'],
              'an older Umbral: Hollow Aurelia\'s PIECES and the Journal speak of the nine there were when it broke', [old_w['aurelia'], old_w['journal'][:300]])
        await pg.evaluate("(() => { WG.umbral.need = Object.keys(W_UMB_PIECES); })()")
        new_w = await words()
        await pg.evaluate("(() => { WG.umbral.need = W_UMB_NINE.slice(); })()")
        check('the ten' in new_w['gate'] and 'into ten pieces' in new_w['scene'] and 'Ten champions' in new_w['scene'] and 'into ten pieces' in new_w['help'] and 'Ten Nadir champions hold them' in new_w['help'] and 'With all ten' in new_w['help'] and new_w['aurelia'].startswith('One for every way to play') and 'pieces, one for every way to play,' in new_w['journal'],
              'a new Umbral: the GATE, the scene and How to play still count ten', [new_w['gate'], new_w['help'][:300]])

        # ---------- the redeemed champion ----------
        rd = await pg.evaluate("""(() => { const s = wStar('nadir_lists'), p = wMakePlayer({ kind: s.kind, n: s.name, num: s.num, lvl: 6, star: s.id }, 'redeemed'), m = wListsPlayer(p);
          return { s: [s.name, s.kind, s.home, s.ult && s.ult.id, s.num, !!CARDS[s.sig], CARDS[s.sig].sport], ult: m.ult, plain: wListsPlayer(wMakePlayer({ kind: 'vampire', lvl: 6 }, 'tavern')).ult || null, inStars: !!(W_STARS || {}).nadir_lists }; })()""")
        check(rd['s'] == ['Isolde Grave', 'vampire', 'lists', 'palecharge', 6, True, 'jousting'] and rd['ult'] == 'palecharge' and rd['plain'] is None and not rd['inStars'],
              'redeemed after the Seal, she is a superstar with her own card, and rides for you with her own ultimate at the Lists (a plain vampire does not)', rd)

        # a Hardcore journey lost in a finale round: the end screen, and no result card over it
        hc = await pg.evaluate("""(() => { wDrain(); WG.umbral.need = Object.keys(W_UMB_PIECES); const U = WG.umbral; U.pieces = Object.keys(W_UMB_PIECES); U.finaleSports = ['jousting', 'baseball', 'football']; U.finale = 0; U.sealed = 0; WG.hardcore = true; const keep = wJT.simMatch;
          wJT.simMatch = o => { const g = keep(o); g.win = 1; g.tot = [0, 5]; g.text = '5 to 0'; return g; };
          try { wRunAct('ufinale'); document.querySelector('[data-ujt="sim"]').click(); } finally { wJT.simMatch = keep; }
          return { screen: UI.screen, card: !!document.getElementById('wListsOk') && !document.getElementById('modal').hidden, over: !!(RUN && RUN.over) }; })()""")
        check(hc['screen'] == 'end' and not hc['card'], 'a Hardcore journey lost in a finale round ends on the end screen, with no result card over it', hc)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
