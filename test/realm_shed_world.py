# Realm shed (issue #102, phase 5): curling from the world, and the Shed's own ways.
# The engine: a game with the Shed's ways has the frost (thicker each end, lying along the boards, nothing in the
# middle; a stone near the boards runs shorter than one in the middle), the frost sprites (now and then a stone in
# play creeps an inch or two, never off the sheet) and Hennock's pebble at the half (the worn ice half fresh); a game
# without them has none. Manage: the draw game throws more draws and guards than the hitting game, which throws more
# takeouts. A snapshot between stones is plain JSON, resumes as it was, and plays on to the end.
# The Realm: Brush Hennock's MATCH opens the match card (the clubs, the day's ice); Simulate settles a match at once
# (the result, XP and gold on a win, the head to head and the lines); Play puts it on the ice with Save and leave and
# Concede on the bar; Save and leave keeps it between stones, and it comes back after a reload with a prompt to resume;
# Concede counts as a loss; the Shed tab has Curl a match and the last matches; the Stats tab's Curling view has the
# lines; How to play explains matches and the Shed. Asserts; exits nonzero on failure.
import asyncio, json, sys, os, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:800]))
    if not ok: FAILS.append(what)
    return ok

HELP = r"""
window.__team = (ks, r) => ({ name: ks.join(''), short: 'T', roster: ks.map((k, i) => Object.assign({ n: k + i, kind: k }, r ? { r: Object.assign(wCR.rate(k), r) } : {})) });
window.__D = () => __team(['dwarf', 'dwarf', 'dwarf', 'dwarf']);
window.__to = (ph, max) => { let n = 0; while (wCR.phase !== ph && n++ < (max || 20000)) wCR.tick(0.05); return wCR.phase === ph; };
0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(HELP)

        # ---------- the Shed's ways ----------
        h = await pg.evaluate("""(() => { const out = {}; wCR.start({ seed: 3, ends: 6, hall: true, teams: [__D(), __D()] }); const G = wCR.G;
          let n = 0; while (G.end < 3 && n++ < 200) wCR.turn(); out.frost = G.frost; out.at = [wCR.frostAt(0), wCR.frostAt(wCR.sheet.halfW - 6)];
          const mid = wCR.run([], { id: 't', s: 0, x0: 0, ang: 0, v: 132, h: 0 }, { ice: wCR.iceNew(), cold: 'mid' }).stop.y;
          const edge = (() => { const a = Math.atan2(wCR.sheet.halfW - 14, 1100) * 180 / Math.PI; const r = wCR.run([], { id: 't', s: 0, x0: 0, ang: a, v: 132, h: 0 }, { ice: wCR.iceNew(), cold: 'mid' }); return r.stop ? r.stop.y : null; })();
          out.drag = [mid, edge];
          // the half: Hennock's pebble (worn ice half fresh)
          wCR.start({ seed: 4, ends: 4, hall: true, teams: [__D(), __D()] }); const H = wCR.G; H.ice = H.ice.map(() => .97); n = 0; while (H.end < 2 && n++ < 200) wCR.turn(); out.pebble = Math.min(...H.ice);
          wCR.start({ seed: 4, ends: 4, teams: [__D(), __D()] }); const N = wCR.G; n = 0; while (N.end < 3 && n++ < 200) wCR.turn(); out.none = [N.frost || 0, !!N.hall];
          return out; })()""")
        check(h['frost'] > 0 and h['at'][0] == 0 and h['at'][1] > 0, 'the frost thickens each end and lies along the boards, nothing in the middle', h)
        check(h['drag'][1] is not None and h['drag'][1] < h['drag'][0], 'a stone along the frosted boards runs shorter than one down the middle', h['drag'])
        check(h['pebble'] > .98 and h['none'] == [0, False], 'at the half Hennock pebbles the sheet again (the worn ice half fresh); a game without the Shed\'s ways has none', h)
        sp = await pg.evaluate("""(() => { const R = wCR.hallRules, keep = R.sprite; R.sprite = 1; let moved = 0, off = 0;
          for (let i = 0; i < 12; i++) { wCR.start({ seed: 30 + i, hall: true, teams: [__D(), __D()] }); const G = wCR.G; wCR.turn(); const before = JSON.stringify(G.stones); wCR.turn();
            if (G.hallSaid && /frost sprite/.test(G.hallSaid)) moved++; if (G.stones.some(s => !wCR.onSheet(s))) off++; }
          R.sprite = keep; return { moved, off }; })()""")
        check(sp['moved'] >= 3 and sp['off'] == 0, 'a frost sprite now and then breathes on a stone and it creeps, never off the sheet', sp)

        # ---------- Manage, the snapshot ----------
        mg = await pg.evaluate("""(() => { const count = style => { const t = { draw: 0, hit: 0 };
            for (let i = 0; i < 3; i++) { wCR.start({ seed: 40 + i, ends: 4, mode: 'manage', teams: [__D(), __D()] }); wCR.pause(true); wCR.manage({ style }); let n = 0; while (!wCR.G.over && n++ < 60000) wCR.tick(.1);
              const S = wCR.G.st[0].shots; t.draw += (S.draw || 0) + (S.guard || 0) + (S.freeze || 0); t.hit += (S.takeout || 0) + (S.peel || 0) + (S.hitroll || 0); } return t; };
          return { draw: count('draw'), hit: count('hit') }; })()""")
        check(mg['draw']['draw'] > mg['hit']['draw'] and mg['hit']['hit'] > mg['draw']['hit'], 'Manage: the draw game throws more draws and guards, the hitting game more takeouts', mg)
        sn = await pg.evaluate("""(() => { wCR.start({ seed: 8, ends: 4, mode: 'watch', hall: true, teams: [__D(), __D()] }); wCR.pause(true); let n = 0; while (wCR.G.n < 9 && n++ < 30000) wCR.tick(.05); __to('next');
          const S = wCR.snapshot(), json = JSON.stringify(S) === JSON.stringify(JSON.parse(JSON.stringify(S))), want = JSON.stringify(S.G);
          wCR.start({ seed: 99 }); wCR.resume(S); const same = JSON.stringify(wCR.G) === want; const again = JSON.stringify(wCR.snapshot().paths) === JSON.stringify(S.paths) && S.paths.length >= 8 && S.paths.every(q => q.path.length >= 3); n = 0; while (!wCR.G.over && n++ < 60000) wCR.tick(.1);
          return { json, same, again, over: !!wCR.G.over }; })()""")
        check(sn == {'json': True, 'same': True, 'again': True, 'over': True}, 'a snapshot between stones is plain JSON, resumes as it was (its paths thinned once, not again), and plays on to the end', sn)

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(HELP)
        await pg.evaluate("(() => { for (const kind of ['elf', 'spider', 'gorgon']) if (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); SET.shedEnds = 4; })()")
        k = await pg.evaluate("""(() => { const K = DB.chars.gk_shed, r = wSay('gk_shed', 'match'); wRunAct(r.act, 'gk_shed'); const box = document.getElementById('modalBox');
          return { act: K.topics.match.act, rows: box.querySelectorAll('[data-shclub]').length, ice: /The ice today/.test(box.textContent) }; })()""")
        check(k['act'] == 'shcard' and k['rows'] >= 3 and k['ice'], 'Brush Hennock\'s MATCH opens the match card: the clubs, each with Play, Manage and Simulate, and the day\'s ice', k)
        await pg.evaluate("document.querySelector('#modalBox [data-close]').click()")
        sm = await pg.evaluate("""(() => { const g0 = RUN.gold; let r = '', tries = 0; const B = wShg();
          while (tries++ < 6) { B.met = {}; r = wStartShed({ club: 'local', how: 'sim' }); const G = B.games[0]; if (G && G.r === 'win') break; }
          const G = B.games[0], lines = Object.keys(WG.crstats || {}).length; for (let i = 0; i < 6 && !document.getElementById('modal').hidden; i++) document.querySelector('#modalBox .btn, #modalBox button').click();
          return { r, res: G && G.r, gold: RUN.gold - g0, lines, live: wShedLive(), text: G && G.text }; })()""")
        check(sm['r'] == '' and sm['res'] in ('win', 'lose') and sm['lines'] >= 2 and not sm['live'], 'Simulate settles a match at once: the result, and your curlers\' lines', sm)
        check(sm['res'] != 'win' or sm['gold'] > 0, 'a win pays gold', sm)
        pl = await pg.evaluate("""(() => { wShg().met = {}; const r = wStartShed({ club: 'local', how: 'play' }); wCR.pause(true); __to('aim');
          return { r, view: UI.view, save: !$('wShedSave').hidden, give: !$('wShedGive').hidden, back: $('wShedBack').hidden, live: wShedLive() }; })()""")
        check(pl == {'r': '', 'view': 'shed', 'save': True, 'give': True, 'back': True, 'live': True}, 'Play puts the match on the ice, with Save and leave and Concede on the bar', pl)
        lv = await pg.evaluate("""(() => { wCR.press(); let n = 0; while (wCR.view.meter && wCR.view.meter.v < 1 && n++ < 2000) wCR.tick(.002); wCR.press(); __to('slide'); $('wShedSave').click();
          const L = WG.shg.live; return { view: UI.view, kept: !!(L && L.snap), n: L && L.snap ? L.snap.G.n : -1 }; })()""")
        check(lv['view'] == 'world' and lv['kept'] and lv['n'] >= 1, 'Save and leave keeps the match (after the stone it left sliding)', lv)
        await pg.evaluate("(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); WSHG.asked = false; wStart(save); })()")
        await pg.wait_for_function("!!document.getElementById('wShRes') || !document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const b = document.getElementById('wShRes'); if (b) b.click(); })()")
        rs = await pg.evaluate("({ view: UI.view, n: wCR.G ? wCR.G.n : -1, live: wShedLive() })")
        check(rs['view'] == 'shed' and rs['n'] == lv['n'] and rs['live'], 'after a reload the match is waiting: Resume puts it back as it was', rs)
        await pg.evaluate("(() => { wCR.pause(true); $('wShedGive').click(); })()")
        await pg.wait_for_function("!document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const b = [...document.querySelectorAll('#modalBox button')].find(x => x.textContent.trim() === 'Concede'); b.click(); })()")
        cd = await pg.evaluate("({ live: wShedLive(), last: WG.shg.games[0].r, text: WG.shg.games[0].text, view: UI.view })")
        check(cd == {'live': False, 'last': 'lose', 'text': 'conceded', 'view': 'world'}, 'Concede counts as a loss, and leaves the Shed', cd)
        # a match played out to a win is a win (the page's summary, not Simulate's)
        pw = await pg.evaluate("""(() => { wShg().met = {}; const keepMode = W_SHED_MODE, g0 = RUN.gold, w0 = WG.shg.w; wStartShed({ club: 'local', how: 'play' }); wCR.pause(true);
          const G = wCR.G, n = G.ends - 1; G.end = n; G.sc = [Array(n).fill(0), Array(n).fill(0)]; G.sc[0][0] = 5; G.k = 15; G.stones = [];
          $('wShedModes').querySelector('[data-cmode="watch"]').click(); let i = 0; while (wShedLive() && i++ < 40000) wCR.tick(.05);
          const r = { live: wShedLive(), last: WG.shg.games[0].r, wins: WG.shg.w - w0, gold: RUN.gold - g0 }; wLeaveShed(); W_SHED_MODE = keepMode; return r; })()""")
        check(pw['live'] is False and pw['last'] == 'win' and pw['wins'] == 1 and pw['gold'] > 0, 'a match played out to a win is settled as a win, with its gold', pw)
        st = await pg.evaluate("""(() => { const style = st => { let t = 0, all = 0; for (let i = 0; i < 10; i++) { wCR.start({ seed: 60 + i, ends: 4, mode: 'manage', teams: [__D(), __D()] }); wCR.pause(true); wCR.manage({ style: st });
              let n = 0; while (!wCR.G.over && n++ < 40000) wCR.tick(.1); const S = wCR.G.st[0].shots; t += (S.takeout || 0) + (S.peel || 0) + (S.hitroll || 0); all += wCR.G.st[0].stones; } return +(t / all).toFixed(3); };
          return { hit: style('hit'), draw: style('draw') }; })()""")
        check(st['hit'] >= st['draw'] + .08, 'Manage\'s hitting game throws a clearly larger share of hits than the draw game', st)
        await pg.evaluate("wOpenCamp('shed')")
        await pg.wait_for_selector('#wCampBody .wshedfour')
        tb = await pg.evaluate("(() => { const b = $('wCampBody'); return { play: !!b.querySelector('[data-shplay]'), recent: /Last curling matches/.test(b.textContent) }; })()")
        check(tb == {'play': True, 'recent': True}, 'the Shed tab: Curl a match, and the last matches', tb)
        await pg.evaluate("WCAMP.close && WCAMP.close()")
        sv = await pg.evaluate("""(() => { WSTAT.view = 'curling'; const h = wCampStats(); return { cols: ['>G<', '>St<', '>Made<', '>Ends<'].every(c => h.includes(c)) }; })()""")
        check(sv['cols'], 'the Stats tab\'s Curling view has each player\'s lines', sv)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("({ game: !!$('wHelpShedGame'), how: ['Matches.', 'The Shed.'].every(w => ($('wShedHow') || {}).textContent.includes(w)) })")
        check(hp == {'game': True, 'how': True}, 'How to play explains matches and the Shed', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
