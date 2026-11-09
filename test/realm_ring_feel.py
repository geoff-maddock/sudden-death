# Realm ring, the feel (issue #23, phase 8). Sound: the bell at the start of each round (once, not again after a
# knockdown) and twice at its end, the punches (a slap for a jab, a crunch for a big one), blocks, slips, the groan and
# the crowd for a knockdown, a shimmer for a power (a bright one for an ultimate), the count's ticks, three bells at the
# end with the horn for your win or a groan for your loss; nothing with Sound effects off, and nothing from a headless
# bout. Coach's notes when your team can box and once you've won a card; medals for cards won, knockouts and the Anvil
# Belt; How to play. Asserts; exits nonzero on failure.
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

# every sound counted: sfx's effects by name, and the bell's (and the count's) tones by pitch
SPY = """(() => { window.__snd = []; for (const k of Object.keys(sfx)) { const f = sfx[k]; sfx[k] = function () { __snd.push(k); }; }
  const t = tone; window.tone = function (f) { __snd.push(f === 1660 ? 'bell' : f === 900 ? 'tick' : 'tone'); }; 0; })()"""
COUNT = "(k => __snd.filter(x => x === k).length)"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBX !== 'undefined'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate(SPY)
        await pg.evaluate(f"window.__n = {COUNT}; 0")

        # ---------- a bout's sounds ----------
        await pg.evaluate("SET.sfx = true; W_RING_MODE = 'play'; wRingBout({ kinds: ['gorgon', 'ogre'], seed: 9 }); wBX.pause(true)")
        s1 = await pg.evaluate("""(() => { __snd.length = 0; if (wBX.wait) wBX.call(wBX.wait.plan); let n = 0; while (wBX.phase !== 'round' && n++ < 100) wBX.step();
          const bell = __n('bell'); const G = wBX.G; G.F[0].x = -1; G.F[1].x = 1; G.F[0].y = G.F[1].y = 0;
          for (const f of G.F) { f.a = { k: 'idle', t: 0, dur: 0, id: 0 }; f.think = 99; f.spirit = 100; }
          // a jab and a big hook that land, a block, a slip
          G.F[1].a = { k: 'stun', t: 0, dur: 9, id: 0 }; let L = 0; while (__n('hit') + __n('crunch') < 2 && L++ < 80) { G.F[0].r.pow = L % 2 ? 1 : 12; wBX.land(0, L % 2 ? 'jab' : 'hook'); }
          G.F[1].a = { k: 'guard', t: 0, dur: 9, id: 0 }; L = 0; while (!__n('block') && L++ < 40) wBX.land(0, 'jab');
          G.F[1].a = { k: 'slip', t: .1, dur: .38, id: 0 }; wBX.land(0, 'jab');
          G.F[0].a = { k: 'idle', t: 0, dur: 0, id: 0 }; G.F[1].a = { k: 'idle', t: 0, dur: 0, id: 0 }; wBX.cast(0, 'sp'); G.F[1].a = { k: 'idle', t: 0, dur: 0, id: 0 }; wBX.cast(0, 'ult');
          return { bell, hit: __n('hit'), crunch: __n('crunch'), block: __n('block'), slip: __n('card'), magic: __n('magic'), crit: __n('crit') }; })()""")
        check(s1['bell'] == 1, 'the bell rings once to start the round', s1)
        check(s1['hit'] >= 1 and s1['crunch'] >= 1 and s1['block'] >= 1 and s1['slip'] == 1, 'a slap for a jab, a crunch for a big punch, a knock for a block, a swish for a slip', s1)
        check(s1['magic'] == 1 and s1['crit'] == 1, 'a shimmer for a special, a bright one for an ultimate', s1)
        kd = await pg.evaluate("""(async () => { __snd.length = 0; const G = wBX.G; for (const f of G.F) f.a = { k: 'idle', t: 0, dur: 0, id: 0 }; G.F[1].hp = .1; G.F[1].a = { k: 'stun', t: 0, dur: 9, id: 0 }; G.F[1].fx = [];
          let L = 0; while (G.down == null && L++ < 40) wBX.land(0, 'hook'); wBX.step(); const r = { hurt: __n('hurt'), crowd: __n('crowd'), ph: wBX.phase };
          for (let i = 0; i < 60 && wBX.phase === 'kd'; i++) { wBX.step(); await new Promise(res => setTimeout(res, 15)); } r.ticks = __n('tick'); r.after = wBX.phase;
          __snd.length = 0; for (let i = 0; i < 60 && wBX.phase === 'rise'; i++) wBX.step(); r.bellAgain = __n('bell'); return r; })()""")
        check(kd['ph'] == 'kd' and kd['hurt'] >= 1 and kd['crowd'] >= 1, 'a knockdown: a groan and the crowd', kd)
        check(kd['ticks'] >= 1, 'the count ticks', kd)
        check(kd['after'] != 'rise' or kd['bellAgain'] == 0, 'boxing on after a knockdown rings no bell', kd)
        en = await pg.evaluate("""(() => { const G = wBX.G; for (const f of G.F) f.r.chin = 60; __snd.length = 0; let n = 0;
          while (wBX.phase !== 'corner' && n++ < 4000) wBX.step(); const corner = __n('bell');
          // into the last round, then only its end is counted
          n = 0; while (!(wBX.phase === 'round' && G.round === G.rounds) && n++ < 4000) { if (wBX.wait) wBX.call(wBX.wait.plan); wBX.step(); }
          wBX.step(); __snd.length = 0; n = 0; while (wBX.phase !== 'over' && n++ < 20000) wBX.step();
          const v = G.over; return { corner, ph: wBX.phase, end: __n('bell'), horn: __n('horn'), bad: __n('bad'), win: v.win, how: v.how, you: wBX.you }; })()""")
        check(en['corner'] == 2, 'the bell twice at the end of a round', en)
        mine_won, mine_lost = en['win'] == en['you'], en['win'] is not None and en['win'] != en['you']
        check(en['ph'] == 'over' and en['end'] == 3 and ((mine_won and en['horn'] == 1) or (mine_lost and en['bad'] == 1) or (en['win'] is None and en['horn'] == 0 and en['bad'] == 0)),
              'three bells at the end, and the horn for your win or a groan for your loss', en)
        await pg.evaluate("wBX.pause(false); wLeaveRing()")

        # ---------- silence ----------
        q = await pg.evaluate("""(() => { SET.sfx = false; W_RING_MODE = 'watch'; wRingBout({ kinds: ['ogre', 'elf'], seed: 3 }); wBX.pause(true); __snd.length = 0;
          for (let i = 0; i < 1500 && wBX.phase !== 'over'; i++) wBX.step(); const off = __snd.length; wBX.pause(false); wLeaveRing(); SET.sfx = true;
          __snd.length = 0; wBX.simBout({ fighters: [{ n: 'A', kind: 'ogre' }, { n: 'B', kind: 'elf' }], seed: 4 }); return { off, sim: __snd.length }; })()""")
        check(q == {'off': 0, 'sim': 0}, 'nothing with Sound effects off, and nothing from a headless bout', q)

        # ---------- coach's notes ----------
        tp = await pg.evaluate("""(() => { const seen = []; const t = tip; window.tip = function (id) { seen.push(id); }; wRingTips();
          const before = seen.slice(); WG.bxg = WG.bxg || { live: null, met: {}, opp: {}, cards: [], w: 0, l: 0, t: 0 }; WG.bxg.w = 1; wRingTips(); window.tip = t;
          return { before, after: seen.slice(before.length), both: !!TIPS.w_ring && !!TIPS.w_bcup, n: wRoster().length }; })()""")
        check(tp['both'] and (('w_ring' in tp['before']) == (tp['n'] >= 2)) and 'w_bcup' in tp['after'], 'a coach\'s note once your team can box, and another about the Belt once you\'ve won a card', tp)

        # ---------- medals ----------
        md = await pg.evaluate("""(() => { const got = []; const a = achAdd; window.achAdd = function (k, n) { got.push([k, n]); };
          const ids = ACH.filter(x => ['w_ring', 'w_ringko', 'w_bcup'].includes(x.id)).map(x => x.id);
          const R = wRoster(), wids = R.map(p => p.id).slice(0, 3); while (wids.length < 3) wids.push(null); RUN.hp = RUN.maxhp;
          WG.bxg.live = { world: { kind: 'bxcard', ref: null, club: 'local', tier: 1, how: 'sim', day: WG.dayAbs, name: 'X', ids: wids, cup: true }, snap: null };
          const b = (win, how) => ({ over: { how, win, kind: null, round: 2, kd: [0, 3], pts: [0, 0] }, stats: [{}, {}], kd: [0, 3] });
          wRingSettle({ win: 0, by: 'bouts', won: [2, 1] }, [b(0, 'tko'), b(0, 'ko'), b(1, 'dec')], [[0, 0], [1, 1], [2, 2]]);
          WG.bcup = { week: 0, field: ['me'], round: 2, cards: [[], [], [{ a: 'me', b: 'local', ra: 2, rb: 1, w: 'me', toss: false }]], done: true, champ: 'me' };
          wBcupWon(); window.achAdd = a; WG.cardOffer = null; return { ids, got }; })()""")
        got = dict((k, n) for k, n in md['got'])
        check(md['ids'] == ['w_ring', 'w_ringko', 'w_bcup'] and got.get('realmRingWins') == 1 and got.get('realmRingKos') == 2 and got.get('realmBcups') == 1,
              'medals: cards won, wins inside the distance (two here) and the Anvil Belt', md)
        await pg.evaluate("for (let i = 0; i < 8 && !document.getElementById('modal').hidden; i++) { const b = document.querySelector('#modalBox [data-close], #modalBox button'); if (!b) break; b.click(); }")

        # ---------- How to play ----------
        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpRingFeel'); return e ? e.textContent : ''; })()")
        check('bell' in h and 'Sound effects' in h and 'medals' in h, 'How to play explains the sounds and the medals', h)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
