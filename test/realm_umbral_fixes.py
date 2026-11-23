# Realm: the Umbral's small things (issue #111, phase A). Hoarfrost says so on curling's status line when it freezes a
# stone; boxing's pairing shows Brakka's own nature (the one the engine boxes with), not a minotaur's; The Hollow
# Whistle calls interference more often too (the same seeds: never fewer calls, some more), and with no hex the odds
# are as before; a champion's game of golf, bowling or basketball (and a round of the Seal in it) is the standard
# length whatever Settings says, and the card says so (Settings are left as they were); How to play at phone width
# doesn't scroll sideways: its wide tables scroll inside themselves (and stay tables on a wide screen).
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

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wUmbFixedLen === 'function' && !!W_UMB4.start.ring")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")

        # ---------- A1: Hoarfrost is announced ----------
        ho = await pg.evaluate("""(() => {
          // headless: the stone it froze on carries froze (their side), once an end at most
          wCR.start({ seed: 12, mode: 'watch', hexes: ['hoar'], skill: [1, 1], ends: 4 }); const evs = [];
          for (let k = 0; k < 200 && !wCR.G.over; k++) { const ev = wCR.turn(); if (!ev) break; if (ev.froze != null) evs.push([ev.end, ev.froze]); }
          // on the page: the status line after the stone says Hoarfrost froze one (and names whose)
          wCR.start({ seed: 12, mode: 'watch', hexes: ['hoar'], skill: [1, 1], ends: 4 }); const said = [], team = wCR.G.teams[1].name; let last = '';
          for (let n = 0; n < 60000 && wCR.phase !== 'over' && !said.length; n++) { wCR.tick(.1); const m = wCR.msg; if (m !== last) { last = m; if (m.includes('Hoarfrost:')) said.push(m); } }
          // and with no hex, never
          wCR.start({ seed: 12, mode: 'watch', skill: [1, 1], ends: 4 }); let none = 0;
          for (let n = 0; n < 6000 && wCR.phase !== 'over'; n++) { wCR.tick(.1); if (wCR.msg.includes('Hoarfrost')) none++; }
          return { evs, said, team, none }; })()""")
        ends = [e for e, _ in ho['evs']]
        check(len(ho['evs']) >= 1 and all(s == 1 for _, s in ho['evs']) and len(ends) == len(set(ends)), 'Hoarfrost marks the stone it froze on, their side\'s, once an end at most', ho['evs'])
        check(len(ho['said']) == 1 and ho['team'] in ho['said'][0] and 'freezes' in ho['said'][0], 'Hoarfrost says so on the status line when it freezes their stone, naming whose', ho['said'])
        check(ho['none'] == 0, 'with no hex the status line never mentions it', ho['none'])

        # ---------- A3: hockey's interference under The Hollow Whistle ----------
        hk = await pg.evaluate("""(() => {
          const was = wHK.foulsNow.interfere;
          // the same seed, the same moment: your skater's lunge misses, the nearest of theirs a stride away; is it called?
          const run = (seed, hx) => { wHK.start({ seed, skill: [1, 1], hexes: hx, powers: false }); let n = 0; while (wHK.phase !== 'live' && n++ < 400) wHK.step();
            const L = wHK.play, sk = L.pl.filter(q => q.side === 0 && q.pos !== 'G'), d = sk[0], c = sk[1], o = L.pl.find(q => q.side === 1 && q.pos !== 'G');
            wHK.give(L.pl.indexOf(c)); o.x = d.x + .5; o.y = d.y; o.vx = o.vy = 0; L.lunge = { i: L.pl.indexOf(d), t: .001 }; const e0 = L.evN || 0;
            wHK.step(); const ne = (L.evN || 0) - e0; return (ne > 0 ? wHK.ev.slice(-ne) : []).some(e => e.k === 'foul' && e.o === 'interference'); };
          wHK.setFouls({ interfere: .45 }); const none = [], whis = [];
          try { for (let s = 1; s <= 40; s++) { none.push(run(s, [])); whis.push(run(s, ['whistle'])); } } finally { wHK.setFouls({ interfere: was }); }
          return { none, whis, was, now: wHK.foulsNow.interfere, load: wHK.fouls.interfere, d: wHK.hexes.whistle.d, k: wHK.hexRules.whistle.k, max: wHK.hexRules.whistle.max }; })()""")
        nN, nW = sum(hk['none']), sum(hk['whis'])
        check(all(w or not n for n, w in zip(hk['none'], hk['whis'])) and nW > nN and any(w and not n for n, w in zip(hk['none'], hk['whis'])),
              'The Hollow Whistle: the same seeded lunge is called for interference at least as often, and some only under the hex', [nN, nW])
        check(nN >= 8 and nW >= nN * 1.4, 'interference under the hex is called far more often (about twice, up to its cap)', [nN, nW, hk['k'], hk['max']])
        check('up to twice' in hk['d'] and hk['k'] * .6 > hk['max'], 'The Hollow Whistle\'s words say up to twice as often (interference is capped)', hk['d'])
        check(hk['was'] == hk['load'] == .6 and hk['now'] == .6 and hk['max'] < 1, 'with no hex, interference is called as before (its odds unchanged)', hk)

        # ---------- a journey, the Umbral open ----------
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("""(() => { wSetFlag('champion'); WG.umbral.seen = WG.dayAbs; RUN.hp = RUN.maxhp = 200; RUN.gold = 900;
          const ks = ['elf', 'harpy', 'goblin', 'troll', 'dwarf', 'spider', 'gorgon', 'witch', 'vampire', 'kobold'].filter(k => !wRoster().some(p => p.kind === k));
          while (wRoster().length < 5 + W_BKG.bench && ks.length) wRecruit({ kind: ks.pop(), lvl: 6 }, 'tavern');
          for (const p of wRoster()) p.lvl = 6;
          WG.umbral.guards = {}; WG.umbral.gates = {}; WG.min = 23 * 60;   // (after dark: two of these champions play only then)
          for (const g of ['ring', 'links', 'lanes', 'court']) { WG.umbral.guards['g_' + g + ':0'] = WG.umbral.guards['g_' + g + ':1'] = WG.dayAbs; WG.umbral.gates[g] = WG.dayAbs; }
          wSave(); })()""")

        # ---------- A2: Brakka's own nature on the pairing ----------
        await pg.evaluate("wRunAct('unadir:ring', 'nadir_ring')")
        await pg.wait_for_selector('#wRingPairT')
        bx = await pg.evaluate("""(() => { const rows = [...document.querySelectorAll('#wRingPairT tr:not(.wrtape)')], X = W_UMB4C.champ, K = wBX.traits[X.kind];
          const i = rows.findIndex(tr => tr.textContent.includes(X.n)), line = i >= 0 ? rows[i].querySelector('td small').textContent : '', row = i >= 0 ? rows[i].querySelector('td').textContent : '';
          const other = rows.filter((tr, j) => j !== i).map(tr => tr.querySelector('td small') ? tr.querySelector('td small').textContent : '');
          const sec = W_UMB4C.seconds.map(([n, k]) => wBX.traits[k] ? wBX.traits[k].n : '');
          // each boxer's special on their own bout's row (none on the tale-of-the-tape rows between)
          const sp = W_UMB4C.seconds.map(([n, k]) => { const tr = rows.find(r => r.textContent.includes(n)), e = tr && tr.querySelector('[data-rsppair]'), B = wBX.powerBook[k];
            return { n, want: B ? B.sp.n : null, got: e ? e.textContent : null }; });
          const onTape = document.querySelectorAll('#wRingPairT tr.wrtape [data-rsppair]').length;
          return { line, row, own: X.tr.n, kind: K ? K.n : '', other, sec, sp, onTape }; })()""")
        check(bx['own'] in bx['line'] and bx['kind'] and bx['kind'] not in bx['row'], 'the pairing names Brakka\'s own nature (the engine\'s) and not a minotaur\'s', bx)
        check(all((not s) or s in o for s, o in zip(bx['sec'], bx['other'])), 'the undercard still shows their kinds\' natures', bx)
        check(all(x['want'] and x['got'] and x['want'] in x['got'] for x in bx['sp']) and bx['onTape'] == 0, 'each undercard boxer\'s special is on their own bout\'s row, none on the tape rows', bx['sp'])
        await pg.click('#modalBox [data-close]')

        # ---------- A4: a champion's game is the standard length ----------
        ln = await pg.evaluate("""(async () => {
          const out = {}, S = { links: ['linksHoles', 3, 'holes', 'ugl', 'nadir_links', wGL], lanes: ['lanesFrames', 5, 'frames', 'ubl', 'nadir_lanes', wBL], court: ['courtMins', 3, 'mins', 'ubk', 'nadir_court', wBK] };
          const std = { links: wGL.rules.holes, lanes: wBL.rules.frames, court: wBK.rules.mins };
          for (const [e, [key, short, opt, btn, char, E]] of Object.entries(S)) {
            wDrain(); SET[key] = short; const seen = [], keep = E.simGame; E.simGame = o => { seen.push(o[opt]); return keep(o); };
            let note = '', set;
            try { wRunAct('unadir:' + e, char); const n = document.querySelector('#modalBox [data-u8alen]'); note = n ? n.textContent : '';
              document.querySelector(`[data-${btn}="sim"]`).click(); set = SET[key]; } finally { E.simGame = keep; }
            out[e] = { short, std: std[e], seen, note, set };
          }
          // a round of the Seal in each: the same
          const U = WG.umbral; U.pieces = Object.keys(W_UMB_PIECES);
          for (const [e, sport] of [['links', 'golf'], ['lanes', 'bowling'], ['court', 'basketball']]) {
            const [key, short, opt, btn, , E] = S[e];
            wDrain(); U.finaleSports = [sport, 'card', 'boxing']; U.finale = 0; U.tries.finale = 0; SET[key] = short;
            const seen = [], keep = E.simGame; E.simGame = o => { seen.push(o[opt]); return keep(o); };
            let note = '', set;
            try { wRunAct('ufinale'); const n = document.querySelector('#modalBox [data-u8alen]'); note = n ? n.textContent : '';
              const b = document.querySelector(`[data-${btn}="sim"]`); if (b) b.click(); set = SET[key]; } finally { E.simGame = keep; }
            out['finale_' + e] = { short, std: std[e], seen, note, set };
          }
          wDrain(); return out; })()""")
        for e, words in (('links', 'holes'), ('lanes', 'frames'), ('court', 'minutes')):
            r = ln[e]
            check(r['seen'] == [r['std']] and r['std'] != r['short'], f'{e}: with Settings at its shortest, the champion\'s game is the standard length', r)
            check(f"Always {r['std']} {words}" in r['note'], f'{e}: the champion\'s card says so', r['note'])
            check(r['set'] == r['short'], f'{e}: Settings are left as they were', r)
            f = ln['finale_' + e]
            check(f['seen'] == [f['std']] and f"Always {f['std']} {words}" in f['note'] and f['set'] == f['short'], f'{e}: a round of the Seal is the standard length too, and its card says so', f)

        # the bar, during a champion's game with Settings at their shortest: no "from the next game" length note (the
        # bar without this part's wrap does show it, so the check can fail); curling's six ends (u4h) too
        bar = await pg.evaluate("""(() => { const out = {}, U = WG.umbral; U.tries = {};
          const S = [['links', 'linksHoles', 3, 'wLinksNote', wUmbGlKick, wLinksBarNote, wWU8ALinksBarNote, wLinksCallOff], ['lanes', 'lanesFrames', 5, 'wLanesNote', wUmbBlKick, wLanesBarNote, wWU8ALanesBarNote, wLanesCallOff],
            ['shed', 'shedEnds', 4, 'wShedNote', wUmbCrKick, wShedBarNote, wWU8AShedBarNote, wShedCallOff]];
          for (const [id, key, short, note, kick, bar, raw, off] of S) {
            wDrain(); SET[key] = short; const why = kick(W_NADIR[id], id, [], 'manage'); bar(); const mine = $(note).textContent;
            raw(); const bare = $(note).textContent; off('test: called off');
            out[id] = { why, mine, bare, set: SET[key] };
          }
          showView('world'); wDrain(); return out; })()""")
        for e in ('links', 'lanes', 'shed'):
            b = bar[e]
            check(b['why'] == '' and 'from the next game' in b['bare'] and 'from the next game' not in b['mine'] and b['set'] in (3, 4, 5),
                  f'{e}: during a champion\'s game the bar leaves off the "from the next game" length note', b)

        # How to play's Umbral section says so
        hp = await pg.evaluate("showPage('help'); (document.getElementById('wHelpU8aLen') || {}).textContent || ''")
        check('standard length' in hp and 'Settings' in hp, 'How to play\'s Umbral section says a champion\'s game is the standard length', hp)

        # ---------- A5: How to play at phone width ----------
        wide = await pg.evaluate("""(() => { const t = [...document.querySelectorAll('#wHelp table')]; return { n: t.length, disp: [...new Set(t.map(x => getComputedStyle(x).display))], sw: document.scrollingElement.scrollWidth }; })()""")
        check(wide['n'] >= 1 and wide['disp'] == ['table'] and wide['sw'] <= 1280, 'on a wide screen How to play\'s tables are tables, as before', wide)
        await pg.set_viewport_size({'width': 400, 'height': 800})
        await pg.evaluate("showPage('play'); showPage('help')"); await pg.wait_for_selector('#wHelp')
        ph = await pg.evaluate("""(() => { const t = [...document.querySelectorAll('#wHelp table')], rk = t.filter(x => x.classList.contains('wrpow'));
          return { sw: document.scrollingElement.scrollWidth, iw: innerWidth, n: t.length, inner: t.filter(x => x.scrollWidth > x.clientWidth + 1).length, out: t.filter(x => x.getBoundingClientRect().right > innerWidth + 1).length, pow: rk.length }; })()""")
        check(ph['sw'] <= 400, 'at 400px How to play does not scroll sideways', ph)
        check(ph['pow'] >= 1 and ph['inner'] >= 1 and ph['out'] == 0, 'its wide tables (the powers tables) scroll inside themselves, none past the edge', ph)

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
