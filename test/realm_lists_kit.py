# Realm lists (issue #117, phase 7): jousting gear and potions.
# The engine: a rider's gear reaches the model as its effects (an Ironwood Lance's steadier tip, a Kite Shield that
# turns more when angled, a Crested Helm that a lance breaks on less often, a War Saddle's firmer seat, Rowelled Spurs'
# cheaper courses, a Lucky Favour that takes some of the pressure off); a squire's gear does nothing; a match without
# bags has no potions, and with empty bags it rides exactly as without; the Stamina Draught gives the mount's wind back,
# Ruddock's Liniment the arm's strength, a Steadying Tonic takes the pressure off a course that weighs on them (and only
# then), Squire's Oil makes the lance break far more often, for that course only; one potion a side a course; a CPU with a bag
# gives at its skill, with a reason, and a side without one never does. The Realm: six pieces of jousting gear (three
# on Sir Ruddock's rack and at the Mossgate grocer's, three in chests) and three jousting potions on sale; Sir Ruddock's
# KIT opens his rack; a piece worn reaches the engine's copy of the rider (not p.jt), and can't be changed mid-match; in
# a real match their bag goes in by tier and yours stays your own; the Bag row gives a potion from your bag (it comes
# out), a refused one stays (and the refusal goes with its course); a potion given and then a reload: the saved bag and
# the saved match agree; Simulate leaves your bag alone; an exhibition takes no potions; their potions are in the course
# log; the match card says what each club brings; How to play explains it. Asserts; exits nonzero on failure.
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
window.__T = (ks, gear, at) => ({ name: ks.join(''), short: ks[0].slice(0, 3), roster: ks.map((k, i) => Object.assign({ n: k + i, kind: k }, gear && (at == null || at === i) ? { gear } : {})) });
window.__A = (g, at) => __T(['elf', 'golem', 'spider', 'kobold'], g, at); window.__B = () => __T(['ogre', 'wraith', 'lich', 'gorgon']);
window.__g = id => ({ id, name: W_GEAR[id].name, fx: JSON.parse(JSON.stringify(W_GEAR[id].fx)) });
window.__to = (f, max) => { let n = 0; while (!f() && n++ < (max || 20000)) wJT.tick(0.05); return !!f(); };
window.__ride = (o, fx) => Object.assign({ aim: 'shield', guard: 'square', pace: 'gallop', mount: 'destrier', rs: wJT.rs(''), speed: 12, couch: 0, tip: { x: -4, y: 4 } }, o || {}, fx ? { fx: Object.assign({}, wJT.fx0, fx) } : {});
0"""
SKIP = "(() => { let i = 0; while (!document.getElementById('modal').hidden && !document.getElementById('wJtRes') && i++ < 20) { const b = [...document.querySelectorAll('#modalBox button')].find(x => /^(Skip|Done|Later|Not now)$/.test(x.textContent.trim())); if (!b) break; b.click(); } })()"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wJT !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- gear ----------
        g = await pg.evaluate("""(() => { const out = {};
          wJT.start({ seed: 1, teams: [__A(), __B()] }); wJT.pause(true); out.none = wJT.rideFx(0);
          wJT.start({ seed: 1, teams: [__A(__g('jt_ironwood')), __B()] }); wJT.pause(true); out.gx = wJT.G.teams[0].roster[0].gx; out.sway = wJT.rideFx(0).sway;
          // (a squire's gear: the squires are the last two)
          wJT.start({ seed: 1, teams: [__A(__g('jt_ironwood'), 2), __B()], riders: [[0, 1], null] }); wJT.pause(true); out.squire = wJT.rideFx(0);
          const pb = (a, d) => wJT.strike(a, d, () => .5).pb, kite = { kite: .85 }, helm = { helmTurn: .8 };
          out.kite = [pb(__ride(), __ride({ guard: 'angled' }, kite)) / pb(__ride(), __ride({ guard: 'angled' })), pb(__ride(), __ride({ guard: 'square' }, kite)) / pb(__ride(), __ride({ guard: 'square' }))];
          const H = { tip: { x: 0, y: 20 } }; out.helm = [pb(__ride(H), __ride(null, helm)) / pb(__ride(H), __ride()), pb(__ride(), __ride(null, helm)) / pb(__ride(), __ride())];
          out.saddle = wJT.seat({ broke: true, rock: 1 }, __ride(null, { hold: .05 }), .5, () => .5).hold - wJT.seat({ broke: true, rock: 1 }, __ride(), .5, () => .5).hold;
          // a Lucky Favour takes a third of the pressure off (the heat's last course, behind)
          const press = gear => { wJT.start({ seed: 2, teams: [__A(gear), __B()] }); wJT.pause(true); const G = wJT.G; G.course = G.courses - 1; G.sc[1][0][0] = 1; return wJT.rideOpts(0).press; };
          out.press = [press(null), press(__g('jt_favour'))];
          // (a course that doesn't end the heat: an unhorsing gives fresh mounts)
          const wind = (gear, seed) => { wJT.start({ seed, teams: [__A(gear), __B()], fix: [{ aim: 'body', guard: 'square', pace: 'gallop' }, null] }); wJT.pause(true); wJT.G.wind[0] = .5; wJT.turn(); return wJT.G.heat === 0 ? .5 - wJT.G.wind[0] : null; };
          let sd = 3; while (sd < 40 && (wind(null, sd) == null || wind(__g('jt_spurs'), sd) == null)) sd++;
          out.spurs = [wind(null, sd), wind(__g('jt_spurs'), sd), wJT.rideFx(0).wind];
          return out; })()""")
        check(g['none'] is None and g['gx'] == {'sway': 0.95} and abs(g['sway'] - .95) < 1e-9, 'a rider\'s gear reaches the model as its effects: an Ironwood Lance steadies the tip', g)
        check(g['squire'] is None, 'a squire\'s gear does nothing at the tilt', g)
        check(abs(g['kite'][0] - .85) < 1e-9 and abs(g['kite'][1] - 1) < 1e-9, 'a Kite Shield turns more when angled (and only then)', g['kite'])
        check(abs(g['helm'][0] - .8) < 1e-9 and abs(g['helm'][1] - 1) < 1e-9 and abs(g['saddle'] - .05) < 1e-9, 'a lance on a Crested Helm breaks less often (on the helm only); a War Saddle sits firmer', g)
        check(g['press'][0] == 1 and abs(g['press'][1] - .65) < 1e-9, 'a Lucky Favour takes a third of the pressure off', g['press'])
        check(g['spurs'][0] is not None and g['spurs'][1] < g['spurs'][0] and abs(g['spurs'][2] - .9) < 1e-9, 'Rowelled Spurs make a course cost the mount less wind', g['spurs'])

        # ---------- potions ----------
        pt = await pg.evaluate("""(() => { const out = {}, T = [__A(), __B()];
          wJT.start({ seed: 4, teams: T, mode: 'play' }); wJT.pause(true); __to(() => wJT.phase === 'plan'); out.none = wJT.potion('jtoil');
          const a = wJT.simMatch({ seed: 21, skill: [1, 1], teams: T }), b = wJT.simMatch({ seed: 21, skill: [1, 1], teams: T, bags: [null, null] });
          out.same = JSON.stringify(a.log) === JSON.stringify(b.log) && JSON.stringify(a.st) === JSON.stringify(b.st);
          wJT.start({ seed: 4, teams: T, mode: 'play', bags: [null, null] }); wJT.pause(true); __to(() => wJT.phase === 'plan'); const G = wJT.G;
          G.wind[0] = .4; out.draught = [wJT.potion('draught'), G.wind[0]]; out.again = wJT.potion('jtliniment');
          G.n++; G.arm[0] = .5; out.lin = [wJT.potion('jtliniment'), G.arm[0]];
          G.n++; out.tonicNo = wJT.potion('jttonic'); G.course = G.courses - 1; G.sc[1][0][0] = 1; out.tonic = [wJT.potion('jttonic'), wJT.rideOpts(0).press];
          G.n++; out.oil = [wJT.potion('jtoil'), wJT.rideFx(0).brk]; G.n++; out.after = wJT.rideFx(0);
          out.log = G.pots.map(x => x.id); return out; })()""")
        check(pt['none'] != '' and pt['same'], 'a match without bags has no potions; with empty bags it rides exactly as without', pt)
        check(pt['draught'][0] == '' and abs(pt['draught'][1] - .75) < 1e-9 and pt['again'] != '', 'the Stamina Draught gives the mount\'s wind back; one potion a side a course', pt)
        check(pt['lin'][0] == '' and abs(pt['lin'][1] - .9) < 1e-9, 'Ruddock\'s Liniment gives the lance arm\'s strength back', pt)
        check(pt['tonicNo'] != '' and pt['tonic'] == ['', 0], 'a Steadying Tonic takes the pressure off a course that weighs on them, and only then', pt)
        check(pt['oil'][0] == '' and abs(pt['oil'][1] - 1.3) < 1e-9 and pt['after'] is None, 'Squire\'s Oil: the lance breaks far more often, for that course only', pt)
        cpu = await pg.evaluate("""(() => { const out = { theirs: 0, mine: 0, why: true, sk: [] };
          for (let i = 0; i < 6; i++) { const s = wJT.simMatch({ seed: 40 + i, skill: [2, 1 + (i % 2)], teams: [__A(), __B()], bags: [null, { draught: 2, jtliniment: 2, jttonic: 1, jtoil: 1 }] });
            wJT.start({ seed: 40 + i, skill: [2, 1 + (i % 2)], teams: [__A(), __B()], bags: [null, { draught: 2, jtliniment: 2, jttonic: 1, jtoil: 1 }] }); wJT.pause(true); let n = 0; while (!wJT.G.over && n++ < 200) wJT.turn();
            const P = wJT.G.pots; out.theirs += P.filter(x => x.side === 1).length; out.mine += P.filter(x => x.side === 0).length; out.why = out.why && P.every(x => x.why); out.bagLeft = wJT.G.bags[1]; }
          return out; })()""")
        check(cpu['theirs'] >= 4 and cpu['mine'] == 0 and cpu['why'], 'a CPU with a bag gives potions at its skill, with a reason; a side without one never does', cpu)
        # (phase 7's review) a Squire's whims between courses (its potion, its corner) are the match's and the course's:
        # resumed from the same snapshot, again and again, it decides the same
        wh = await pg.evaluate("""(() => { const out = { sizes: [], gave: 0, n: 0 };
          for (let sd = 0; sd < 6; sd++) { wJT.start({ seed: 60 + sd, mode: 'play', skill: [1, 0], teams: [__A(), __B()], bags: [null, { draught: 3, jtliniment: 3 }] }); wJT.pause(true);
            __to(() => wJT.phase === 'plan'); wJT.press(); __to(() => wJT.phase === 'after'); if (wJT.G.heat !== 0) continue; wJT.G.wind[1] = .2; wJT.G.arm[1] = .3; const S = JSON.parse(JSON.stringify(wJT.snapshot()));
            const seen = new Set(); for (let i = 0; i < 8; i++) { wJT.resume(JSON.parse(JSON.stringify(S))); wJT.pause(true); __to(() => wJT.phase === 'plan'); const G = wJT.G, C = G.corners[1];
              const k = JSON.stringify([G.pots.filter(x => x.side === 1).map(x => x.id), C.length ? C[C.length - 1].jobs : null]); seen.add(k); if (G.pots.some(x => x.side === 1)) out.gave++; out.n++; }
            out.sizes.push(seen.size); }
          return out; })()""")
        check(len(wh['sizes']) >= 4 and all(x == 1 for x in wh['sizes']), 'a Squire\'s potion and corner between courses are decided once a course: a resume decides the same', wh)
        # a Piercing lance breaks on an angled Kite Shield as on a square one: Pierce wins
        kp = await pg.evaluate("""(() => { const pb = (a, d) => wJT.strike(a, d, () => .5).pb;
          return [pb(__ride(null, { pierce: 1 }), __ride({ guard: 'angled' }, { kite: .85 })), pb(__ride(null, { pierce: 1 }), __ride({ guard: 'angled' }))]; })()""")
        check(abs(kp[0] - kp[1]) < 1e-12, 'a Piercing lance breaks on an angled Kite Shield as on a square one (the kite doesn\'t turn it)', kp)

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); (() => { for (const kind of ['elf', 'spider', 'golem']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); SET.listsCourses = 3; })()")
        rg = await pg.evaluate("""(() => { const ids = Object.keys(W_GEAR).filter(k => W_GEAR[k].sport === 'lists'), store = ['jt_ironwood', 'jt_kite', 'jt_saddle', 'jttonic', 'jtliniment', 'jtoil'];
          const chest = ['jt_spurs', 'jt_helm', 'jt_favour'].every(id => Object.values(DB.chests).some(c => c.items && c.items[id]));
          const K = DB.chars.gk_lists, r = wSay('gk_lists', 'kit');
          const p = wRoster()[0], jt0 = JSON.stringify(p.jt), m0 = wListsPlayer(p); wAddItem('jt_saddle', 1); const put = wGearPutOn(p.id, 'jt_saddle'), m = wListsPlayer(p);
          return { n: ids.length, lists: store.every(id => DB.shops.lists[id] > 0), moss: store.every(id => DB.shops.moss[id] > 0), chest, kit: [K.shop, r.act, /KIT/.test(K.topics.job.t)], put, tag: m.gear && m.gear.id, plain: !m0.gear, jt: JSON.stringify(p.jt) === jt0, pid: p.id }; })()""")
        check(rg['n'] == 6 and rg['lists'] and rg['moss'] and rg['chest'], 'six pieces of jousting gear and three potions: Sir Ruddock\'s rack and the Mossgate grocer\'s sell three of each, chests hold the rest', rg)
        check(rg['kit'] == ['lists', 'shop', True], 'Sir Ruddock\'s KIT opens his rack', rg['kit'])
        check(rg['put'] == '' and rg['tag'] == 'jt_saddle' and rg['plain'] and rg['jt'], 'a piece worn reaches the engine\'s copy of the rider, never p.jt', rg)
        mt = await pg.evaluate("""(() => { wAddItem('jttonic', 2); wAddItem('jtliniment', 1); wJtg().met = {}; W_LISTS_MODE = 'play'; wStartLists({ club: 'local', how: 'play' }); wJT.pause(true); __to(() => wJT.phase === 'plan');
          const st0 = JSON.parse(localStorage.getItem(wSaveKey())), sn0 = st0.WG.jtg.live && st0.WG.jtg.live.snap;
          const planSaved = !!sn0 && sn0.G.n === wJT.G.n && !!sn0.G.cpuPlan && sn0.G.cpuPlan.n === wJT.G.n && !!sn0.G.cpuPlan.p[1];
          const G = wJT.G, bags = [G.bags[0], G.bags[1]], off = wGearTakeOff(wRoster()[0].id, 'lists'); wListsRows(); const row = $('wListsBagRow'), n0 = WG.items.jtliniment || 0, nt = WG.items.jttonic || 0;
          row.querySelector('[data-jtkuse="jttonic"]').click(); const refused = W_LISTS_KITMSG, keptT = (WG.items.jttonic || 0) === nt;
          G.arm[0] = .5; wListsRows(); row.querySelector('[data-jtkuse="jtliniment"]').click();
          const st = JSON.parse(localStorage.getItem(wSaveKey()));
          return { planSaved, tierBag: W_LISTS_KIT.opp[wBallTier('local')], mine: bags[0], theirs: bags[1], shown: !row.hidden, used: n0 - (WG.items.jtliniment || 0), pots: G.pots.filter(x => x.side === 0).length, refused, keptT, off,
            saved: { items: st.WG.items.jtliniment || 0, itemsNow: WG.items.jtliniment || 0, pots: st.WG.jtg.live.snap.G.pots.filter(x => x.side === 0).length, arm: st.WG.jtg.live.snap.G.arm[0] }, arm: G.arm[0] }; })()""")
        check(mt['mine'] is None and mt['theirs'] == mt['tierBag'] and mt['theirs'], 'in a real match their bag goes in by tier, and yours stays your own', mt)
        check(mt['off'] != '', 'gear can\'t be changed while a jousting match is on', mt)
        check(mt['shown'] and mt['used'] == 1 and mt['pots'] == 1, 'the Bag row gives a potion from your bag, and it comes out', mt)
        check(mt['refused'] == 'Nothing weighs on them this course.' and mt['keptT'], 'a potion that can do nothing now is refused, and stays in the bag', mt)
        check(mt['planSaved'], 'your plan beat is saved as it opens: what was decided before it (their plan, corner and potion) comes back on a reload', mt)
        check(mt['saved']['items'] == mt['saved']['itemsNow'] and mt['saved']['pots'] == 1 and abs(mt['saved']['arm'] - mt['arm']) < 1e-9, 'the bag and the match are saved with the potion at once', mt['saved'])
        # a potion given, then a reload: the saved bag and the saved match agree
        await pg.reload(); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wJT !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false"); await pg.evaluate(HELP)
        await pg.evaluate("wStart(wLoadSave())"); await pg.wait_for_function("UI.view === 'world' && !!WG"); await pg.evaluate(SKIP)
        rl = await pg.evaluate("""(() => { const b = document.getElementById('wJtRes'); if (b) b.click(); else wResumeLists(); wJT.pause(true); __to(() => wJT.phase === 'plan');
          const G = wJT.G; return { items: WG.items.jtliniment || 0, pots: G.pots.filter(x => x.side === 0).length, arm: G.arm[0], again: wJT.potionWhy(0, 'jtliniment') }; })()""")
        check(rl['items'] == mt['saved']['items'] and rl['pots'] == 1 and abs(rl['arm'] - mt['arm']) < 1e-9 and rl['again'] == 'One potion a course.',
              'a potion given, then a reload: the bag and the match agree (it is out of the bag, in the match, and not given twice)', [mt['saved'], rl])
        lg = await pg.evaluate("""(() => { wJT.G.bags[1] = { draught: 3, jtliniment: 3 }; wJT.G.skill[1] = 2; wJT.G.arm[1] = .4; wJT.G.wind[1] = .3; wJT.G.potAsk[1] = -1; $('wListsModes').querySelector('[data-jmode="watch"]').click(); wJT.pause(true); let n = 0;
          // (until the course their potion was given before has been ridden)
          while (!wJT.G.pots.some(x => x.side === 1 && x.at < wJT.G.n) && !wJT.G.over && n++ < 60000) wJT.tick(.05); wListsBoard();
          const out = { theirs: wJT.G.pots.filter(x => x.side === 1).length, mine: wJT.G.pots.filter(x => x.side === 0).length, log: /⚗/.test($('wListsLog').textContent) };
          if (wListsLive()) { const s = wJT.summary() || {}; s.win = 1; s.text = 'conceded'; wListsSettle(s); WJT = null; wListsModeBack(); wW150LeaveLists(); }
          return out; })()""")
        check(lg['theirs'] >= 1 and lg['mine'] == 1 and lg['log'], 'their squire gives from their bag (never yours, even in Watch), and the course log shows it', lg)
        await pg.evaluate(SKIP)
        sm = await pg.evaluate("""(() => { wAddItem('jtoil', 2); const before = JSON.stringify(wMatchBag('lists')); wJtg().met = {}; wStartLists({ club: 'local', how: 'sim' });
          for (let i = 0; i < 9 && !document.getElementById('modal').hidden; i++) document.querySelector('#modalBox .btn, #modalBox button').click();
          return JSON.stringify(wMatchBag('lists')) === before; })()""")
        check(sm, 'Simulate leaves your bag alone', sm)
        # (phase 12's review) a Simulate whose two hours roll the day over onto a league round day: the clubs' own matches
        # at the Lists that round are jousted on the engine with no bag on either side (the other club's bag is for your
        # match only); your match had theirs
        ro = await pg.evaluate("""(() => { const L = wLeague(), cl = wLeagueClubs().filter(c => L.table[c]), seen = [], keep = wJT.simMatch;
          WG.rivals = WG.rivals || true; while ((WG.dayAbs + 1) % W_LEAGUE.every) WG.dayAbs++; WG.min = 1440 - 30;
          L.next = { day: WG.dayAbs + 1, games: [{ a: cl[0], b: cl[1], g: 'g_lists' }, { a: cl[2], b: cl[3], g: 'g_lists' }] };
          wJT.simMatch = o => { const r = keep(o); seen.push({ teams: [r.teams[0].name, r.teams[1].name], pots: r.pots ? r.pots.length : null }); return r; };
          try { wJtg().met = {}; wStartLists({ club: 'local', how: 'sim' }); } finally { wJT.simMatch = keep; }
          for (let i = 0; i < 9 && !document.getElementById('modal').hidden; i++) document.querySelector('#modalBox .btn, #modalBox button').click();
          return { seen, live: wListsLive(), day: WG.dayAbs % W_LEAGUE.every }; })()""")
        check(len(ro['seen']) == 3 and ro['seen'][0]['pots'] is not None and all(x['pots'] is None for x in ro['seen'][1:]) and not ro['live'] and ro['day'] == 0,
              'a Simulate that rolls the day over onto a league round: the clubs\' own matches at the Lists carry no bag, only your match had theirs', ro)
        ex = await pg.evaluate("(() => { W_LISTS_MODE = 'play'; wListsGame({ seed: 6, mode: 'play' }); wJT.pause(true); __to(() => wJT.phase === 'plan'); const r = wListsPotion('jtoil'); wListsRows(); const h = $('wListsBagRow').hidden; wLeaveLists(); return { r, h, bags: wJT.G.bags || null }; })()")
        check(ex['r'] != '' and ex['h'] and ex['bags'] is None, 'an exhibition takes no potions, and has no Bag row', ex)
        cd = await pg.evaluate("(() => { wOpenListsCard(); const t = $('modalBox').textContent; document.querySelector('#modalBox [data-close]').click(); return /What their squires bring/.test(t); })()")
        check(cd, 'the match card says what each club brings', cd)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("({ help: !!$('wHelpListsKit') && /gear/.test($('wHelpListsKit').textContent) && /potion/.test($('wHelpListsKit').textContent), how: ($('wListsHowKit') || {}).textContent ? $('wListsHowKit').textContent.includes('Gear and potions.') : false })")
        check(hp == {'help': True, 'how': True}, 'How to play explains gear and potions', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
