# Realm shed (issue #102, phase 3): curling ratings, the four and their positions, the sweepers' legs and nerve.
# The engine: every league kind has six curling ratings (a spider's sweep, a golem's nerve, an ogre's hit and no touch, a
# wraith's read); the ratings decide games (a touch rink beats a wild one, and two rinks alike split them); an order
# left out comes from the ratings (the best skip throws last). The sweepers are the two not throwing and not holding the
# broom; a good pair carries a stone further; sweeping spends their legs, tired legs do less, and the legs are fresh at
# the next end. Pressure: nothing early or for the lead, the skip in the last end, more on the hammer's stone in a close
# game; nerve takes it off (a nervy skip's miss is bigger, a perfect nerve feels nothing).
# The Realm: every player has curling ratings within a point of their kind, and each level adds a point; an older save's
# players get theirs when it loads. The four: your players first, call-ups at your level to fill it, positions by the
# ratings; a position change swaps, a reserve steps in, and the four go to the engine in order with their own ratings.
# The Shed tab (beside the Lanes tab), the practice game, the Stats tab's Curling view and the card, the Curler row, and
# How to play. Asserts; exits nonzero on failure.
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

TEAM = r"""window.__team = (ks, r) => ({ name: ks.join(''), short: 'T', roster: ks.map((k, i) => Object.assign({ n: k + i, kind: k }, r ? { r: Object.assign(wCR.rate(k), r) } : {})) }); 0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wCR !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(TEAM)

        # ---------- the engine ----------
        k = await pg.evaluate("""(() => { const stars = new Set(W_STARS.map(x => x.kind || x.id)), kinds = Object.keys(FA_NAMES).filter(k => !stars.has(k)), missing = kinds.filter(k => wCR.stats.some(s => wCR.rate(k)[s] === 6.5));
          const sp = wCR.rate('spider'), go = wCR.rate('golem'), og = wCR.rate('ogre'), wr = wCR.rate('wraith');
          return { stats: wCR.stats, cap: wCR.cap, missing, notes: [sp.swp === 12, go.nrv >= 10, og.hit >= 10 && og.drw <= 4, wr.red >= 9] }; })()""")
        check(k['stats'] == ['drw', 'lin', 'hit', 'swp', 'nrv', 'red'] and k['cap'] == 12 and not k['missing'] and all(k['notes']), 'every league kind has curling ratings: a spider\'s sweep, a golem\'s nerve, an ogre\'s hit, a wraith\'s read', k)
        o = await pg.evaluate("""(() => { const G = wCR.start({ seed: 4, teams: [__team(['ogre', 'elf', 'lich', 'harpy']), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf'])] }); return { order: G.order[0], sw: wCR.sweepers(0) }; })()""")
        check(o['order'][3] == 2 and o['order'][0] == 1, 'an order left out comes from the ratings: the lich\'s nerve skips, the elf\'s touch leads', o)
        check(sorted(o['sw']) == sorted([o['order'][2], o['order'][1]]), 'the lead\'s stone is swept by the two not throwing and not holding the broom (the second and the third)', o)
        w = await pg.evaluate("""(() => { let a = 0, e = 0;
          for (let i = 0; i < 16; i++) if (wCR.simGame({ seed: 60 + i, ends: 4, teams: [__team(['dwarf', 'dwarf', 'dwarf', 'dwarf'], { drw: 12, lin: 12, hit: 12 }), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf'], { drw: 1, lin: 1, hit: 1 })] }).win === 0) a++;
          for (let i = 0; i < 24; i++) if (wCR.simGame({ seed: 200 + i, ends: 4, teams: [__team(['dwarf', 'gorgon', 'wraith', 'vampire']), __team(['dwarf', 'gorgon', 'wraith', 'vampire'])] }).win === 0) e++;
          return { touch: a / 16, even: e / 24 }; })()""")
        check(w['touch'] >= .8 and .2 < w['even'] < .8, 'the ratings decide games: a touch rink beats a wild one, and two rinks alike split them', w)
        sw = await pg.evaluate("""(() => { const run = (r, legs) => { wCR.start({ seed: 5, teams: [__team(['dwarf', 'dwarf', 'dwarf', 'dwarf'], r), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf'])], hammer: 1 }); wCR.G.legs = [legs, 1]; const eff = wCR.sweepEff(0);
            const ev = wCR.throwStone(0, { shot: 'draw', x: 0, y: 0, h: 1 }, { ang: 0, v: 128, h: 1 }, () => 1); return { eff, y: ev.stop ? ev.stop.y : null, legs: wCR.G.legs[0] }; };
          return { good: run({ swp: 12 }, 1), bad: run({ swp: 1 }, 1), tired: run({ swp: 12 }, .1) }; })()""")
        check(sw['good']['eff'] > 1 > sw['bad']['eff'] and sw['good']['y'] > sw['bad']['y'], 'a good pair of sweepers carries a stone further than a poor one', sw)
        check(sw['tired']['eff'] < sw['good']['eff'] and sw['good']['legs'] < 1, 'sweeping spends their legs, and tired legs do less', sw)
        le = await pg.evaluate("""(() => { wCR.start({ seed: 6, teams: [__team(['dwarf', 'dwarf', 'dwarf', 'dwarf']), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf'])] }); wCR.G.legs = [.3, .4]; let n = 0; const e0 = wCR.G.end;
          while (wCR.G.end === e0 && n++ < 20) wCR.turn(); return wCR.G.legs; })()""")
        check(le == [1, 1], 'the legs are fresh again at the next end', le)
        pr = await pg.evaluate("""(() => { const T = r => __team(['dwarf', 'dwarf', 'dwarf', 'dwarf'], r); wCR.start({ seed: 7, ends: 4, teams: [T({ nrv: 1 }), T({ nrv: 12 })] }); const G = wCR.G;
          const early = wCR.pressure(0); const calm = wCR.errK(1, 'draw').v; G.end = 3; G.k = 0; const lead = wCR.pressure(0); G.k = 12; const skip = wCR.pressure(0); G.k = 15; G.hammer = 1; const ham = wCR.pressure(1);
          G.k = 14; const nervy = wCR.errK(0, 'draw'), cool = (() => { G.k = 15; return wCR.errK(1, 'draw'); })(); G.sc = [[3, 0, 0], [0, 0, 0]]; G.k = 15; const wide = wCR.pressure(1);
          return { early, lead, skip, ham, wide, nervy: nervy.v, cool: cool.v, calm }; })()""")
        check(pr['early'] == 0 and pr['lead'] == 0 and pr['skip'] == 1 and pr['ham'] == 1.5 and pr['wide'] == 1, 'pressure: nothing early or for the lead; the skip in the last end, more on the hammer\'s stone when it is close', pr)
        check(pr['nervy'] > 1.4 and abs(pr['cool'] - pr['calm']) < 1e-9, 'a nervy skip misses more under it; a perfect nerve feels nothing', pr)

        # ---------- found in review ----------
        rv = await pg.evaluate("""(() => { const out = {};
          // ratings brought in part: the rest are the kind's, and the throw is a real number
          wCR.start({ seed: 3, teams: [{ name: 'P', roster: ['dwarf', 'dwarf', 'dwarf', 'dwarf'].map((k, i) => ({ n: 'p' + i, kind: k, r: { drw: 12 } })) }, __team(['dwarf', 'dwarf', 'dwarf', 'dwarf'])] });
          const ev = wCR.turn(); out.partial = [wCR.G.teams[0].roster[0].r.lin, Number.isFinite(ev.rel.ang) && Number.isFinite(ev.rel.v)];
          // a sweep held after the stone stops (others still rolling) costs nothing more
          wCR.start({ seed: 8, teams: [__team(['dwarf', 'dwarf', 'dwarf', 'dwarf']), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf'])], hammer: 1 }); wCR.G.stones = [{ id: '1:0', s: 1, x: 0, y: 0 }];
          wCR.G.k = 1; wCR.G.hammer = 0; const tk = wCR.solveHit(0, -9, 205, 1, null, 'mid'); const l0 = wCR.G.legs[1]; const hit = wCR.throwStone(1, { shot: 'takeout', x: 0, y: 0, h: 1, target: '1:0' }, tk, () => 1);
          out.afterHit = [l0 - wCR.G.legs[1]];
          // one stone swept hard the whole way leaves most of an end's legs for the rest
          wCR.start({ seed: 4, teams: [__team(['dwarf', 'dwarf', 'dwarf', 'dwarf']), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf'])], hammer: 1 });
          wCR.throwStone(0, { shot: 'draw', x: 0, y: 0, h: 1 }, { ang: 0, v: 128, h: 1 }, () => 1); out.legs = wCR.G.legs[0];
          // one curler the engine can't rate doesn't keep the others from their positions
          const G = wCR.start({ seed: 5, teams: [{ name: 'Q', roster: [{ n: 'x', kind: '' }, { n: 'l', kind: 'lich' }, { n: 'e', kind: 'elf' }, { n: 'o', kind: 'ogre' }] }, __team(['dwarf', 'dwarf', 'dwarf', 'dwarf'])] });
          out.order = G.order[0];
          return out; })()""")
        check(rv['partial'] == [8, True], 'ratings brought in part are filled from the kind, and the throw is a real number', rv)
        check(rv['legs'] > .6, 'one stone swept hard the whole way leaves most of an end\'s legs', rv)
        check(rv['afterHit'][0] < .2, 'a takeout swept only until it stops: the legs pay for the slide, not for stones rolling after', rv)
        check(rv['order'][3] == 1, 'one curler the engine can\'t rate doesn\'t keep the lich from skipping', rv)
        ws = await pg.evaluate("""(() => { wCR.start({ seed: 6, mode: 'play', hammer: 1, teams: [__team(['dwarf', 'dwarf', 'dwarf', 'dwarf']), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf'])] }); wCR.pause(true);
          let n = 0; while (wCR.phase !== 'aim' && n++ < 4000) wCR.tick(.05); wCR.select({ shot: 'draw', x: 0, y: 0 }); wCR.press(); n = 0; while (wCR.view.meter.v < .88 && n++ < 2000) wCR.tick(.002); wCR.press();
          wCR.setMode('watch'); let sw = 0; n = 0; while (wCR.phase === 'slide' && n++ < 4000) { wCR.tick(.05); const L = wCR.live; if (L && L.sw > sw) sw = L.sw; } return sw; })()""")
        check(ws > 0, 'a stone of yours handed to the CPU mid-slide is swept by its sweepers', ws)

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        r = await pg.evaluate("""(() => { const R = wRoster(), st = wCR.stats;
          const ok = R.every(p => p.cr && st.every(s => p.cr[s] >= 1 && p.cr[s] <= 12) && p.cr.lv === (p.lvl || 1));
          const near = R.every(p => { const k = wCR.rate(p.kind); return st.every(s => Math.abs(p.cr[s] - (p.cr.got[s] || 0) - k[s]) <= 1.5); });
          const p = R[0], sum = () => st.reduce((a, s) => a + p.cr[s], 0), lv0 = p.lvl, s0 = sum(); p.lvl = lv0 + 3; wCrOf(p); const grew = sum() - s0; p.lvl = lv0;
          return { ok, near, grew }; })()""")
        check(r['ok'] and r['near'] and r['grew'] == 3, 'every player has curling ratings within a point of their kind; each level adds a point', r)
        ol = await pg.evaluate("""(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); for (const p of save.WG.roster) delete p.cr; delete save.WG.shed;
          wStart(save); return wRoster().every(p => p.cr && p.cr.lv === (p.lvl || 1)); })()""")
        check(ol, 'an older save\'s players get their curling ratings when it loads', ol)
        cd = await pg.evaluate("""(() => { WG.shed = null; const p = wRoster()[0], h = wStatsCard(p); return { named: /In your four, the/.test(h), saved: !!JSON.parse(localStorage.getItem(wSaveKey())).WG.shed }; })()""")
        check(cd == {'named': True, 'saved': True}, 'a player\'s card names their position on a save with no four yet, and the four it made is saved', cd)
        f = await pg.evaluate("""(() => { const C = wFourSyncCr(), keys = C.four, own = keys.filter(k => typeof k !== 'string').length;
          return { roster: wRoster().length, own, cu: C.cu.length, distinct: new Set(keys).size === 4, cuRated: C.cu.every(c => c.cr && c.lvl === wNineTier() && /^r\d+$/.test(c.cid)), json: JSON.stringify(JSON.parse(JSON.stringify(WG.shed))) === JSON.stringify(WG.shed) }; })()""")
        check(f['own'] == min(4, f['roster']) and f['cu'] == 4 - f['own'] and f['distinct'] and f['cuRated'] and f['json'], 'the four: your players first, call-ups at your level fill it, plain JSON', f)
        a = await pg.evaluate("""(() => { const kinds = ['zombie', 'spider', 'troll', 'witch', 'gorgon', 'lich', 'ogre']; let i = 0;
          while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern'));
          wFourAutoCr(); const C = WG.shed, res = wFourCrReserves(C), fit = (k, s) => wCrFit(wFourCrWho(k), s);
          return { cu: C.cu.length, own: C.four.every(k => typeof k !== 'string'), res: res.length, roster: wRoster().length, skip: res.every(k => fit(C.four[3], 3) >= fit(k, 3)), mine: !!C.mine }; })()""")
        check(a['cu'] == 0 and a['own'] and a['res'] == a['roster'] - 4 and a['skip'] and not a['mine'], 'with a full roster the four are yours, the rest reserves, and the captain makes the best skip the skip', a)
        ch = await pg.evaluate("""(() => { const C = wFourSyncCr(), a0 = C.four[0], a3 = C.four[3], res = wFourCrReserves(C)[0];
          const r1 = wFourSetPos(a0, 3), swap = C.four[3] === a0 && C.four[0] === a3;
          const m2 = C.four[2]; const r2 = wFourSetPos(res, 2), inn = C.four[2] === res && wFourCrReserves(C).includes(m2);
          const m1 = C.four[1]; const r3 = wFourSetPos(m1, 'reserve'), out = wFourCrReserves(C).includes(m1) && C.four[1] !== m1;
          const T = wFourMineCr(); return { r: [r1, r2, r3], swap, inn, out, mine: !!C.mine, team: { n: T.roster.length, order: T.order, first: T.roster[0].n === wFourCrWho(C.four[0]).n, r: Object.keys(T.roster[0].r) } }; })()""")
        check(ch['r'] == ['', '', ''] and ch['swap'] and ch['inn'] and ch['out'] and ch['mine'], 'a position change swaps; a reserve into a position takes it; to the reserves, the best reserve for it steps in', ch)
        check(ch['team'] == {'n': 4, 'order': [0, 1, 2, 3], 'first': True, 'r': ['drw', 'lin', 'hit', 'swp', 'nrv', 'red']}, 'your four go to the engine in order, with their own ratings', ch['team'])

        await pg.evaluate("wOpenCamp('shed')")
        await pg.wait_for_selector('#wCampBody .wshedfour')
        t = await pg.evaluate("""(() => { const b = document.getElementById('wCampBody'); return { four: b.querySelectorAll('.wshedfour [data-cpos]').length, res: b.querySelectorAll('.wshedres [data-cpos]').length,
          auto: !!b.querySelector('[data-cauto]'), practice: !!b.querySelector('[data-cpractice]'), tab: !!document.querySelector('[data-ctab="shed"][aria-pressed="true"]'), lanes: !!document.querySelector('[data-ctab="lanes"]') }; })()""")
        check(t['four'] == 4 and t['res'] >= 1 and t['auto'] and t['practice'] and t['tab'] and t['lanes'], 'the Shed tab (beside the Lanes tab): the four in their positions, the reserves, the captain\'s pick and a practice game', t)
        sel = await pg.evaluate("""(() => { const s = document.querySelector('#wCampBody .wshedres [data-cpos]'), k = +s.closest('[data-cid]').dataset.cid; s.value = '0'; s.dispatchEvent(new Event('change')); return { k, lead: WG.shed.four[0] }; })()""")
        check(sel['k'] == sel['lead'], 'picking a position on the tab moves the player into it', sel)
        await pg.click('#wCampBody [data-cpractice]')
        await pg.wait_for_function("UI.view === 'shed' && !!wCR.G")
        pt = await pg.evaluate("(() => { const T = wCR.G.teams[0]; return { clash: T.roster.filter(m => wCR.G.teams[1].roster.some(o => o.n === m.n)).length, names: T.roster.map(m => m.n), want: WG.shed.four.map(k => wFourCrWho(k).n), order: wCR.G.order[0], title: document.getElementById('wShedTitle').textContent }; })()")
        check(pt['clash'] == 0 and pt['names'] == pt['want'] and pt['order'] == [0, 1, 2, 3] and 'practice' in pt['title'], 'the practice game plays your four, in their positions, against Saltmere\'s', pt)
        up = await pg.evaluate("""(() => { W_SHED_MODE = 'play'; wCR.setMode('play'); wCR.pause(true); let n = 0; while (wCR.phase !== 'aim' && n++ < 20000) wCR.tick(.05); wShedRows(); return (document.getElementById('wShedUp') || {}).textContent || ''; })()""")
        check('Sweepers' in up and 'legs' in up and '%' in up, 'your stone\'s rows say who throws, their sweepers and their legs', up)
        await pg.evaluate("wLeaveShed()")
        await pg.wait_for_function("UI.view === 'world'")
        sv = await pg.evaluate("""(() => { WSTAT.view = 'curling'; const h = wCampStats(); const p = wRoster()[0]; return { btn: /data-wsview="curling"/.test(h), cols: ['Drw', 'Lin', 'Hit', 'Swp', 'Nrv', 'Red'].every(c => h.includes('>' + c + '<')), rows: (h.match(/data-wsp="/g) || []).length, n: wRoster().length, card: /<h5>Curling<\\/h5>/.test(wStatsCard(p)) }; })()""")
        check(sv['btn'] and sv['cols'] and sv['rows'] == sv['n'] and sv['card'], 'the Stats tab has a Curling view (every player\'s ratings), and a player\'s card a Curling block', sv)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("({ tab: !!document.getElementById('wHelpShedTab'), how: ['Ratings.', 'The positions.', 'The sweepers', 'Nerve.'].every(w => (document.getElementById('wShedHow') || {}).textContent.includes(w)) })")
        check(hp == {'tab': True, 'how': True}, 'How to play explains the ratings, the four and their positions, the sweepers\' legs and nerve', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
