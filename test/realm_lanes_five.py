# Realm lanes (issue #100, phase 3): bowling ratings, the five and their order, arm and nerve.
# The engine: every league kind has six bowling ratings (a troll's power, a spider's revs, a zombie's nerve, a witch's
# read); a bowler's speed and revs follow their power and revs, and their hand is their own; the ratings decide games
# (accurate bowlers beat wild ones, and two sides alike split them); an order left out comes from the ratings (the
# best anchor last). Arm: a ball costs the bowler some (a power ball more), and the rest of the side gets it back when a
# frame is done. Pressure: nothing early, the last frame, and more when the other side has finished and it is close.
# Your mark is wider for an accurate bowler and narrower for a tired arm or a big moment, where the meter falls quicker
# and shakes; a bowler of perfect nerve feels nothing.
# The Realm: every player has bowling ratings within a point of their kind and a hand, and each level adds a point; an
# older save's players get theirs when it loads. The five: your players first, call-ups at your level to fill it, an
# order by the ratings; slot changes swap, a reserve steps in, and the five go to the engine in order with their own
# ratings and hands. The Lanes tab, the practice game, the Stats tab's Bowling view and the card, and How to play.
# Asserts; exits nonzero on failure.
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

TEAM = r"""window.__team = (ks, r) => ({ name: ks.join(''), short: 'T', roster: ks.map((k, i) => Object.assign({ n: k + i, kind: k }, r ? { r: Object.assign(wBL.rate(k), r) } : {})) }); 0"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ENGINES !== 'undefined' && typeof wBL !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.evaluate(TEAM)

        # ---------- the engine ----------
        k = await pg.evaluate("""(() => { const stars = new Set(W_STARS.map(x => x.kind || x.id)), kinds = Object.keys(FA_NAMES).filter(k => !stars.has(k)), missing = kinds.filter(k => wBL.stats.some(s => wBL.rate(k)[s] === 6.5));
          const t = wBL.rate('troll'), sp = wBL.rate('spider'), z = wBL.rate('zombie'), w = wBL.rate('witch');
          return { stats: wBL.stats, cap: wBL.cap, missing, notes: [t.pow >= 11 && t.acc <= 4, sp.rev === 12, z.nrv >= 10 && z.rev <= 3, w.red === 10] }; })()""")
        check(k['stats'] == ['pow', 'rev', 'acc', 'spr', 'nrv', 'red'] and k['cap'] == 12 and not k['missing'] and all(k['notes']), 'every league kind has bowling ratings: a troll\'s power, a spider\'s revs, a zombie\'s nerve, a witch\'s read', k)
        st = await pg.evaluate("""(() => { const G = wBL.start({ seed: 4, teams: [__team(['troll', 'spider', 'zombie', 'elf', 'witch']), { name: 'B', short: 'B', roster: ['ogre', 'elf', 'elf', 'elf', 'elf'].map((k, i) => ({ n: 'b' + i, kind: k, hand: i === 1 ? -1 : 1 })) }] });
          const S = G.teams[0].roster.map(m => m.style), H = G.teams[1].roster.map(m => m.style.hand); return { mph: [S[0].mph, S[3].mph], rpm: [S[1].rpm, S[2].rpm], hand: H.slice(0, 2), order: G.order[0] }; })()""")
        check(st['mph'][0] > st['mph'][1] and st['rpm'][0] > st['rpm'][1] and st['hand'] == [1, -1], 'speed follows power and revs follow revs (a troll throws harder than an elf, a spider spins more than a zombie); a bowler\'s hand is their own', st)
        check(st['order'][4] == 2, 'an order left out comes from the ratings: the zombie\'s nerve anchors', st['order'])
        w = await pg.evaluate("""(() => { let a = 0, e = 0;
          for (let i = 0; i < 40; i++) if (wBL.simGame({ seed: 60 + i, teams: [__team(['dwarf', 'dwarf', 'dwarf', 'dwarf', 'dwarf'], { acc: 12, spr: 12 }), __team(['dwarf', 'dwarf', 'dwarf', 'dwarf', 'dwarf'], { acc: 1, spr: 1 })] }).win === 0) a++;
          for (let i = 0; i < 80; i++) if (wBL.simGame({ seed: 200 + i, teams: [__team(['dwarf', 'gorgon', 'wraith', 'vampire', 'goblin']), __team(['dwarf', 'gorgon', 'wraith', 'vampire', 'goblin'])] }).win === 0) e++;
          return { acc: a / 40, even: e / 80 }; })()""")
        check(w['acc'] >= .8 and .3 < w['even'] < .7, 'the ratings decide games: accurate bowlers beat wild ones, and two sides alike split them', w)
        ar = await pg.evaluate("""(() => { const G = wBL.start({ seed: 8, teams: [__team(['dwarf', 'elf', 'witch', 'troll', 'zombie']), __team(['dwarf', 'elf', 'witch', 'troll', 'zombie'])] }), A = wBL.armRules;
          const ri = wBL.bowler(0); wBL.turn(); const one = wBL.arm[0][ri]; G.arm[0] = [.5, .5, .5, .5, .5]; G.arm[0][ri] = one;
          let n = 0; while (wBL.up() === 0 && n++ < 3) wBL.turn(); const after = wBL.arm[0];
          return { one, A, others: after.filter((v, i) => i !== ri), me: after[ri] }; })()""")
        check(abs(ar['one'] - (1 - ar['A']['ball'])) < 1e-9, 'a ball costs the bowler arm', ar)
        check(all(abs(v - (.5 + ar['A']['back'])) < 1e-9 for v in ar['others']) and ar['me'] < ar['one'], 'when the frame is done the rest of the side gets some back; the bowler does not', ar)
        pr = await pg.evaluate("""(() => { const G = wBL.start({ seed: 9, frames: 5 }); const early = wBL.pressure(0);
          for (let i = 0; i < 8; i++) { wBL.roll(wBL.up(), 3); wBL.roll(wBL.up(), 4); } const last = wBL.pressure(0);
          wBL.roll(0, 3); wBL.roll(0, 4); const close = wBL.pressure(1); return { early, last, close }; })()""")
        check(pr == {'early': 0, 'last': 1, 'close': 1.5}, 'pressure: nothing early, the last frame, and more when the other side has finished and it is close', pr)
        mt = await pg.evaluate("""(() => { const T = (r) => __team(['dwarf', 'dwarf', 'dwarf', 'dwarf', 'dwarf'], r);
          const m = (r, f) => { wBL.start({ seed: 3, mode: 'play', teams: [T(r), T()] }); wBL.pause(true); if (f) f(); let i = 0; while (wBL.phase !== 'aim' && i++ < 400) wBL.tick(.05); wBL.press(); return wBL.view.meter; };
          const hi = m({ acc: 12 }), lo = m({ acc: 1 }), tired = m({ acc: 12 }, () => { wBL.G.arm[0] = [.2, .2, .2, .2, .2]; });
          const nervy = m({ nrv: 1 }, () => { for (let i = 0; i < 36; i++) wBL.roll(wBL.up(), 4 - (i % 2) * 4); }), cool = m({ nrv: 12 }, () => { for (let i = 0; i < 36; i++) wBL.roll(wBL.up(), 4 - (i % 2) * 4); });
          return { hi: hi.win, lo: lo.win, tired: tired.win, nervy: [nervy.win, nervy.fall, nervy.shake], cool: [cool.win, cool.fall, cool.shake], base: wBL.meterRules }; })()""")
        check(mt['hi'] > mt['lo'] and mt['tired'] < mt['hi'], 'your mark: wider for an accurate bowler, narrower for a tired arm', mt)
        check(mt['nervy'][1] > mt['base']['fall'] and mt['nervy'][2] > .5 and mt['cool'][2] == 0, 'in the last frame the meter falls quicker and a nervy bowler\'s mark shakes; perfect nerve feels nothing of the shake', mt)

        # ---------- the Realm ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        r = await pg.evaluate("""(() => { const R = wRoster(), st = wBL.stats;
          const ok = R.every(p => p.bl && st.every(s => p.bl[s] >= 1 && p.bl[s] <= 12) && p.bl.lv === (p.lvl || 1) && (p.bl.hand === 1 || p.bl.hand === -1));
          const near = R.every(p => { const k = wBL.rate(p.kind); return st.every(s => Math.abs(p.bl[s] - (p.bl.got[s] || 0) - k[s]) <= 1.5); });
          const p = R[0], sum = () => st.reduce((a, s) => a + p.bl[s], 0), lv0 = p.lvl, s0 = sum(); p.lvl = lv0 + 3; wBlOf(p); const grew = sum() - s0; p.lvl = lv0;
          return { ok, near, grew }; })()""")
        check(r['ok'] and r['near'] and r['grew'] == 3, 'every player has bowling ratings within a point of their kind and a hand; each level adds a point', r)
        o = await pg.evaluate("""(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); for (const p of save.WG.roster) delete p.bl; delete save.WG.lanes;
          wStart(save); return wRoster().every(p => p.bl && p.bl.lv === (p.lvl || 1)); })()""")
        check(o, 'an older save\'s players get their bowling ratings when it loads', o)
        f = await pg.evaluate("""(() => { const C = wFiveSync(), keys = C.five, own = keys.filter(k => typeof k !== 'string').length;
          return { roster: wRoster().length, own, cu: C.cu.length, distinct: new Set(keys).size === 5, cuRated: C.cu.every(c => c.bl && c.lvl === wNineTier()), json: JSON.stringify(JSON.parse(JSON.stringify(WG.lanes))) === JSON.stringify(WG.lanes) }; })()""")
        check(f['own'] == min(5, f['roster']) and f['cu'] == 5 - f['own'] and f['distinct'] and f['cuRated'] and f['json'], 'the five: your players first, call-ups at your level fill it, plain JSON', f)
        a = await pg.evaluate("""(() => { const kinds = ['zombie', 'spider', 'troll', 'witch', 'gorgon', 'lich', 'ogre']; let i = 0;
          while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern'));
          wFiveAuto(); const C = WG.lanes, res = wFiveReserves(C), fit = (k, s) => wBlFit(wFiveWho(k), s);
          return { cu: C.cu.length, own: C.five.every(k => typeof k !== 'string'), res: res.length, roster: wRoster().length, anchor: res.every(k => fit(C.five[4], 4) >= fit(k, 4)), mine: !!C.mine }; })()""")
        check(a['cu'] == 0 and a['own'] and a['res'] == a['roster'] - 5 and a['anchor'] and not a['mine'], 'with a full roster the five are yours, the rest reserves, and the captain anchors the best anchor', a)
        ch = await pg.evaluate("""(() => { const C = wFiveSync(), a0 = C.five[0], a4 = C.five[4], res = wFiveReserves(C)[0];
          const r1 = wFiveSetSlot(a0, 4), swap = C.five[4] === a0 && C.five[0] === a4;
          const m2 = C.five[2]; const r2 = wFiveSetSlot(res, 2), inn = C.five[2] === res && wFiveReserves(C).includes(m2);
          const m1 = C.five[1]; const r3 = wFiveSetSlot(m1, 'reserve'), out = wFiveReserves(C).includes(m1) && C.five[1] !== m1;
          const T = wFiveMine(); return { r: [r1, r2, r3], swap, inn, out, mine: !!C.mine, team: { n: T.roster.length, order: T.order, first: T.roster[0].n === wFiveWho(C.five[0]).n, r: Object.keys(T.roster[0].r), hand: T.roster.every(m => m.hand === 1 || m.hand === -1) } }; })()""")
        check(ch['r'] == ['', '', ''] and ch['swap'] and ch['inn'] and ch['out'] and ch['mine'], 'a slot change swaps; a reserve into a slot takes it; to the reserves, the best reserve for that slot steps in', ch)
        check(ch['team'] == {'n': 5, 'order': [0, 1, 2, 3, 4], 'first': True, 'r': ['pow', 'rev', 'acc', 'spr', 'nrv', 'red'], 'hand': True}, 'your five go to the engine in order, with their own ratings and hands', ch['team'])

        await pg.evaluate("wOpenCamp('lanes')")
        await pg.wait_for_selector('#wCampBody .wlanesfive')
        t = await pg.evaluate("""(() => { const b = document.getElementById('wCampBody'); return { five: b.querySelectorAll('.wlanesfive [data-nslot]').length, res: b.querySelectorAll('.wlanesres [data-nslot]').length,
          auto: !!b.querySelector('[data-nauto]'), practice: !!b.querySelector('[data-npractice]'), tab: !!document.querySelector('[data-ctab="lanes"][aria-pressed="true"]'), links: !!document.querySelector('[data-ctab="links"]') }; })()""")
        check(t['five'] == 5 and t['res'] >= 1 and t['auto'] and t['practice'] and t['tab'] and t['links'], 'the Lanes tab (beside the Links tab): the five in order, the reserves, the captain\'s pick and a practice game', t)
        sel = await pg.evaluate("""(() => { const s = document.querySelector('#wCampBody .wlanesres [data-nslot]'), k = +s.closest('[data-nid]').dataset.nid; s.value = '0'; s.dispatchEvent(new Event('change')); return { k, lead: WG.lanes.five[0] }; })()""")
        check(sel['k'] == sel['lead'], 'picking a slot on the tab moves the player into it', sel)
        await pg.click('#wCampBody [data-npractice]')
        await pg.wait_for_function("UI.view === 'lanes' && !!wBL.G")
        pt = await pg.evaluate("(() => { const T = wBL.G.teams[0]; return { clash: T.roster.filter(m => wBL.G.teams[1].roster.some(o => o.n === m.n)).length, names: T.roster.map(m => m.n), want: WG.lanes.five.map(k => wFiveWho(k).n), order: wBL.G.order[0], title: document.getElementById('wLanesTitle').textContent }; })()")
        check(pt['clash'] == 0 and pt['names'] == pt['want'] and pt['order'] == [0, 1, 2, 3, 4] and 'practice' in pt['title'], 'the practice game plays your five, in their order, against Saltmere\'s', pt)
        await pg.evaluate("wLeaveLanes()")
        await pg.wait_for_function("UI.view === 'world'")
        sv = await pg.evaluate("""(() => { WSTAT.view = 'bowling'; const h = wCampStats(); const p = wRoster()[0]; return { btn: /data-wsview="bowling"/.test(h), cols: ['Pow', 'Rev', 'Acc', 'Spr', 'Nrv', 'Red'].every(c => h.includes('>' + c + '<')), rows: (h.match(/data-wsp="/g) || []).length, card: /<h5>Bowling<\\/h5>/.test(wStatsCard(p)), n: wRoster().length }; })()""")
        check(sv['btn'] and sv['cols'] and sv['rows'] == sv['n'] and sv['card'], 'the Stats tab has a Bowling view (every player\'s ratings), and a player\'s card a Bowling block', sv)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("({ tab: !!document.getElementById('wHelpLanesTab'), how: ['Ratings.', 'The order.', 'Arm.', 'Nerve.'].every(w => (document.getElementById('wLanesHow') || {}).textContent.includes(w)) })")
        check(hp == {'tab': True, 'how': True}, 'How to play explains the ratings, the five and their order, arm and nerve', hp)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
