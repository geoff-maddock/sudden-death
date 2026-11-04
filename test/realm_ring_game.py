# Realm ring, cards from the world (issue #23, phase 5). Your players box on their own ratings: the kind's give or take
# one, a point a level weighted by the kind, kept on the player. Ma Gristle's CARD lists the clubs at your tier (Play,
# Manage, Simulate) and the exhibition. A card needs two players of your own; each club boxes you once a day.
# Simulate: the pairing, then the result at once: XP for the three who boxed (half for the rest), gold and fans on a
# win only, a knockout of yours costing Team HP, box lines for your boxers, time passing, and a result card. Manage:
# the card in the ring with Save and leave and Concede on the bar; a save point at each corner; Save and leave pressed
# in a round leaves at the next corner; after a reload the card is offered once, and Resume puts it back where it was;
# played out, it settles in the world (and a rival's goes in the head to head). Concede is a loss. How to play explains
# it; WG.bxg and WG.bxstats are plain JSON. Asserts; exits nonzero on failure. Screenshots: /tmp/realm-ring-game-*.png.
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

CLOSE = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #wRingOk, #wEvWalk, #wEvDone, #wBxLater, #wGridOk'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""
PLAIN = "v => { const ok = x => x === null || ['number', 'string', 'boolean'].includes(typeof x) || (Array.isArray(x) ? x.every(ok) : typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype && Object.values(x).every(ok)); return ok(v); }"
# the bout boxed on to its next save point (a corner or the end), on the engine's clock, with iron chins so it gets there
TO_SAVE = """(() => { wBX.pause(true); for (const f of wBX.G.F) f.r.chin = 60; let n = 0; const ph0 = wBX.phase;
  while (n++ < 6000) { if (wBX.wait) wBX.call(wBX.wait.plan); wBX.step(); if ((wBX.phase === 'corner' || wBX.phase === 'over') && wBX.phase !== ph0) break; } wBX.pause(false); return wBX.phase; })()"""

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof wBX !== 'undefined'")
        await pg.evaluate(f"wBX.speed = 4; window.__plain = {PLAIN}; 0")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"):
            await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # ---------- your boxers' ratings ----------
        r = await pg.evaluate("""(() => { const p = wMakePlayer({ kind: 'harpy', lvl: 1 }, 'tavern'), K = wBX.rate('harpy'), b = wBxOf(p);
          const near = wBX.stats.every(s => Math.abs(b[s] - K[s]) <= 1), sum1 = wBX.stats.reduce((n, s) => n + b[s], 0);
          p.lvl = 6; const b6 = wBxOf(p), sum6 = wBX.stats.reduce((n, s) => n + b6[s], 0), again = JSON.stringify(wBxOf(p)) === JSON.stringify(b6);
          p.lvl = 99; const top = wBxOf(p); return { near, grew: sum6 - sum1, again, kept: p.bx === top, cap: Math.max(...wBX.stats.map(s => top[s])) }; })()""")
        check(r['near'] and r['grew'] == 5 and r['again'] and r['kept'] and r['cap'] <= 12, 'a player\'s boxing ratings: the kind\'s give or take one, a point a level, kept on them, never past 12', r)

        # ---------- a card needs two of your own ----------
        g0 = await pg.evaluate("(() => { const keep = WG.roster; WG.roster = keep.slice(0, 1); const probs = wRingProblems(), start = wStartRing({ club: 'local', how: 'sim' }); WG.roster = keep; return { probs, start }; })()")
        check(g0['probs'] and 'Recruit 1 more player' in g0['start'], 'a card needs two players of your own', g0)
        await pg.evaluate("(() => { for (const kind of ['elf', 'harpy', 'troll']) if (wRoster().length < 4) wAddPlayer(wMakePlayer({ kind, lvl: 1 }, 'tavern')); })()")

        # ---------- CARD: the clubs, and the exhibition ----------
        k = await pg.evaluate("(() => { const r = wSay('gk_ring', 'card'); wRunAct(r.act, 'gk_ring'); return { rows: document.querySelectorAll('#modalBox .wbclubs > li').length, how: [...document.querySelectorAll('#modalBox [data-bxclub=\"local\"]')].map(b => b.textContent), exhib: !!document.getElementById('wBxExhib') }; })()")
        check(k['rows'] >= 1 and k['how'] == ['Play', 'Manage', 'Simulate'] and k['exhib'], 'Ma Gristle\'s CARD lists the clubs (Play, Manage, Simulate) and the exhibition', k)
        await pg.screenshot(path='/tmp/realm-ring-game-card.png')

        # ---------- Simulate ----------
        await pg.click('[data-bxclub="local"][data-bxhow="sim"]')
        await pg.wait_for_selector('[data-rslot]')
        pr = await pg.evaluate("({ go: [...document.querySelectorAll('[data-rgo]')].map(b => b.textContent), lvl: /level \\d+/.test(document.querySelector('.wrcard td').textContent) })")
        check(pr['go'][0] == 'Simulate' and set(pr['go']) == {'Play', 'Manage', 'Simulate'} and pr['lvl'], 'the pairing, with the way picked first, and their fighters\' levels', pr)
        before = await pg.evaluate("({ xp: Object.fromEntries(wRoster().map(p => [p.id, p.xp + (p.lvl - 1) * 1000])), gold: RUN.gold, hp: RUN.hp, day: WG.dayAbs, min: WG.min, picks: [...document.querySelectorAll('[data-rslot]')].map(s => +s.value), ids: wRoster().map(p => p.id) })")
        await pg.click('[data-rgo="sim"]')
        await pg.wait_for_selector('#wRingOk')
        s = await pg.evaluate("""(b => { const B = WG.bxg, c = B.cards[0], boxed = b.picks.map(i => b.ids[i]).filter(id => id != null);
          return { live: B.live, r: c && c.r, tier: c && c.tier, kos: c && c.kos, gold: RUN.gold - b.gold, hp: b.hp - RUN.hp, met: B.met.local === WG.dayAbs,
            got: boxed.every(id => wPlayer(id).xp + (wPlayer(id).lvl - 1) * 1000 > b.xp[id]), lines: boxed.every(id => WG.bxstats[id] && WG.bxstats[id].bb === 1),
            time: WG.dayAbs > b.day || WG.min !== b.min, msg: document.querySelector('#modalBox .wmsg').textContent }; })""", before)
        paid = s['gold'] == (15 * s['tier'] if s['r'] == 'win' else 0)
        check(s['live'] is None and s['r'] in ('win', 'lose', 'tie') and s['got'] and s['lines'] and paid and s['time'] and s['met'] and 'The card:' in s['msg'],
              'Simulate: a result at once, XP for your fighters, gold on a win only, box lines for your boxers, time passes, and a result card', s)
        check(s['hp'] == min(s['kos'] * 5, before['hp'] - 1), 'a fighter of yours knocked out or stopped costs 5 Team HP', s)
        await pg.evaluate(CLOSE)
        again = await pg.evaluate("wStartRing({ club: 'local', how: 'sim' })")
        check('already boxed you today' in again, 'each club boxes you once a day', again)

        # ---------- the result, settled directly: lines by the pairing, the rest of the team's XP, a knockout's cost ----------
        st = await pg.evaluate("""(() => { const R = wRoster(), ids = R.map(p => p.id).slice(0, 3); while (ids.length < 3) ids.push(null);
          const xp = id => wPlayer(id).xp + (wPlayer(id).lvl - 1) * 1000, rest = R.filter(p => !ids.includes(p.id)).map(p => p.id), x0 = Object.fromEntries(R.map(p => [p.id, xp(p.id)]));
          WG.bxstats = {}; const hp0 = RUN.hp = RUN.maxhp;
          WG.bxg.live = { world: { kind: 'bxcard', ref: null, club: 'local', tier: 2, how: 'sim', day: WG.dayAbs, name: 'X', ids, cup: true }, snap: null };
          const bout = (win, how, kd) => ({ over: { how, win, kind: how === 'dec' ? 'split' : null, round: 3, kd, pts: [0, 0] }, stats: [{ landed: 20, thrown: 50, pw: 2 }, {}], kd });
          // pairs: your fighter 2 boxed bout 1, fighter 0 bout 2, fighter 1 bout 3
          const msg = wRingSettle({ win: 1, by: 'bouts', won: [1, 2] }, [bout(0, 'tko', [0, 3]), bout(1, 'ko', [2, 0]), bout(1, 'dec', [1, 0])], [[2, 0], [0, 1], [1, 2]]);
          const L = id => WG.bxstats[id] || null;
          return { msg, hp: hp0 - RUN.hp, a: ids[2] != null && L(ids[2]), b: ids[0] != null && L(ids[0]), c: ids[1] != null && L(ids[1]), base: 5,
            boxedXp: ids.filter(id => id != null).map(id => xp(id) - x0[id]), restXp: rest.map(id => xp(id) - x0[id]) }; })()""")
        a, b2, c3 = st['a'], st['b'], st['c']
        check(st['hp'] == 5 and 'A knockout cost 5 Team HP' in st['msg'], 'a fighter of yours knocked out costs 5 Team HP (their own win by stoppage costs nothing)', st)
        check(a and a['w'] == 1 and a['ko'] == 1 and a['kd'] == 3 and a['down'] == 0 and a['pw'] == 2 and a['landed'] == 20, 'box lines go to the fighter who boxed each bout: a win by stoppage, three knockdowns scored, powers and punches', a)
        check(b2 and b2['l'] == 1 and b2['down'] == 2 and c3 and c3['l'] == 1 and c3['ko'] == 0, 'and the losses, with the knockdowns taken, to the others by the pairing', [b2, c3])
        check(all(x == 5 for x in st['boxedXp']) and all(x == 3 for x in st['restXp']), 'XP: a quarter of a win for your fighters on a loss (5 at tier 2), and half that for the rest of the team', st)
        await pg.evaluate(CLOSE)

        # ---------- Manage: in the ring, Save and leave, a reload, Resume ----------
        club = await pg.evaluate("wBallClubs().find(c => c !== 'local') || 'local'")
        await pg.evaluate("WG.bxg.met = {}")
        await pg.evaluate(f"wStartRing({{ club: '{club}', how: 'manage' }})")
        await pg.wait_for_selector('[data-rslot]'); await pg.click('[data-rgo="manage"]')
        await pg.wait_for_function("UI.view === 'ring' && !!wBX.card && WBX && WBX.world")
        bar = await pg.evaluate("""({ save: !document.getElementById('wRingSave').hidden, give: !document.getElementById('wRingGive').hidden, again: document.getElementById('wRingAgain').hidden,
          back: document.getElementById('wRingBack').hidden, mode: wBX.mode, snap: !!WG.bxg.live.snap, ph: WG.bxg.live.snap && WG.bxg.live.snap.BD.ph })""")
        check(bar['save'] and bar['give'] and bar['again'] and bar['back'] and bar['mode'] == 'call', 'Manage: the card in the ring, your corner, with Save and leave and Concede on the bar (no Another, no plain Back)', bar)
        check(bar['snap'] and bar['ph'] == 'intro', 'a save point at the start of the bout', bar)
        await pg.evaluate("wBX.pause(true); if (wBX.wait) wBX.call(wBX.wait.plan); for (let i = 0; i < 40 && wBX.phase !== 'round'; i++) wBX.step(); wBX.pause(false)")
        await pg.click('#wRingSave')
        lw = await pg.evaluate("({ txt: document.getElementById('wRingSave').textContent, view: UI.view })")
        check(lw == {'txt': 'Leaving at the next corner…', 'view': 'ring'}, 'Save and leave in a round waits for the next corner', lw)
        await pg.evaluate(TO_SAVE)
        await pg.wait_for_function("UI.view === 'world'")
        lv = await pg.evaluate("({ on: wBX.on, ph: WG.bxg.live.snap.BD.ph, round: WG.bxg.live.snap.G.round, log: WLOG.map(l => l.t || l[0] || '').join(' | ').slice(-300) })")
        check(not lv['on'] and lv['ph'] == 'corner' and lv['round'] == 2 and 'saved' in lv['log'], 'at the corner it leaves: back in the world, the card kept at that corner', lv)
        await pg.screenshot(path='/tmp/realm-ring-game-left.png')
        rl = await pg.evaluate("""(() => { const save = JSON.parse(JSON.stringify({ WG, RUN })); wStart(save); WBXG.asked = false;
          const asked = wNextPrompt(), card = !!document.getElementById('wBxRes'); return { asked, card, plain: __plain(WG.bxg) && __plain(WG.bxstats || {}) }; })()""")
        check(rl['asked'] and rl['card'], 'after a reload, a waiting card is offered once', rl)
        check(rl['plain'], 'WG.bxg and WG.bxstats are plain JSON', None)
        await pg.click('#wBxRes')
        await pg.wait_for_function("UI.view === 'ring' && !!wBX.card && WBX && WBX.world")
        rs = await pg.evaluate("({ ph: wBX.phase, round: wBX.G.round, i: wBX.card.i, wait: !!wBX.wait, save: !document.getElementById('wRingSave').hidden })")
        check(rs == {'ph': 'corner', 'round': 2, 'i': 0, 'wait': True, 'save': True}, 'Resume puts the card back where it was: bout 1, the corner before round 2, waiting for your call', rs)
        # the end of a bout is saved at once (however recently the last save was), and it can be resumed from there
        await pg.evaluate("WBXG.saved = Date.now(); wBX.pause(true); for (const f of wBX.G.F) f.r.chin = 60; let n = 0; while (wBX.phase !== 'over' && n++ < 20000) { if (wBX.wait) wBX.call(wBX.wait.plan); wBX.step(); } wBX.pause(false)")
        ov = await pg.evaluate("(() => { const s = JSON.parse(localStorage.getItem(wSaveKey())); return s.WG.bxg.live && s.WG.bxg.live.snap && s.WG.bxg.live.snap.BD.ph; })()")
        check(ov == 'over', 'the end of a bout is saved at once, so a reload can\'t undo it', ov)
        await pg.evaluate("(() => { const save = JSON.parse(localStorage.getItem(wSaveKey())); WBX = null; wStart(save); wResumeRing(); })()")
        await pg.wait_for_function("UI.view === 'ring' && !!wBX.card")
        ro = await pg.evaluate("({ ph: wBX.phase, next: !document.getElementById('wRingNext').hidden, i: wBX.card.i })")
        check(ro == {'ph': 'over', 'next': True, 'i': 0}, 'resumed between bouts: bout 1 over, and Next bout on the bar', ro)
        await pg.click('#wRingNext')
        check(await pg.evaluate("wBX.card.i === 1 && wBX.phase === 'intro'"), 'Next bout boxes bout 2 after a resume')
        # box it out: three bouts, Next bout between them
        for _ in range(12):
            ph = await pg.evaluate(TO_SAVE)
            if await pg.evaluate("!WG.bxg.live"): break
            if ph == 'over' and await pg.evaluate("!document.getElementById('wRingNext').hidden"):
                await pg.click('#wRingNext')
        await pg.wait_for_function("!WG.bxg.live")
        f = await pg.evaluate(f"""({{ note: document.getElementById('wRingNote').textContent, back: !document.getElementById('wRingBack').hidden, save: document.getElementById('wRingSave').hidden,
          c: WG.bxg.cards[0], h2h: (WG.h2h['{club}'] || {{}}).last || null }})""")
        modes = await pg.evaluate("document.getElementById('wRingModes').hidden")
        check('The card:' in f['note'] and f['back'] and f['save'] and modes and f['c']['how'] == 'manage', 'a card boxed out in the ring settles in the world: the result on the bar, Back to the world, no more mode switching', f)
        check(club == 'local' or f['c']['r'] == 'tie' or (f['h2h'] and f['h2h']['sport'] == 'boxing' and f['h2h']['r'] == f['c']['r']), 'a rival\'s card goes in the head to head', f['h2h'])
        await pg.screenshot(path='/tmp/realm-ring-game-end.png')
        await pg.click('#wRingBack')
        await pg.evaluate(CLOSE)

        # ---------- Concede ----------
        await pg.evaluate("WG.bxg.met = {}")
        await pg.evaluate("wStartRing({ club: 'local', how: 'play' })")
        await pg.wait_for_selector('[data-rslot]'); await pg.click('[data-rgo="play"]')
        await pg.wait_for_function("UI.view === 'ring' && WBX && WBX.world")
        mode = await pg.evaluate("wBX.mode")
        await pg.click('#wRingGive')
        title = await pg.evaluate("(document.querySelector('#modal h3') || {}).textContent")
        await pg.click('#cfYes')
        c = await pg.evaluate("({ view: UI.view, live: WG.bxg.live, r: WG.bxg.cards[0].r, by: WG.bxg.cards[0].by, paused: wBX.paused, leaving: WBXG.leaving, msg: (document.querySelector('#modalBox .wmsg') || {}).textContent || '' })")
        check(mode == 'play' and title == 'Concede the card?' and {k: c[k] for k in ('view', 'live', 'r', 'by')} == {'view': 'world', 'live': None, 'r': 'lose', 'by': 'conceded'} and 'you concede' in c['msg'],
              'Play opens on You box; Concede asks, then counts it as a loss', [mode, title, c])
        check(not c['paused'] and not c['leaving'], 'after Concede the ring isn\'t left paused, and no leave is pending', c)
        await pg.evaluate(CLOSE)
        # Save and leave pressed in a round, then Concede: the next card stays in the ring
        await pg.evaluate("WG.bxg.met = {}; wStartRing({ club: 'local', how: 'manage' })")
        await pg.wait_for_selector('[data-rslot]'); await pg.click('[data-rgo="manage"]')
        await pg.wait_for_function("UI.view === 'ring' && WBX && WBX.world")
        await pg.evaluate("wBX.pause(true); if (wBX.wait) wBX.call(wBX.wait.plan); for (let i = 0; i < 40 && wBX.phase !== 'round'; i++) wBX.step(); wBX.pause(false)")
        await pg.click('#wRingSave'); await pg.click('#wRingGive'); await pg.click('#cfYes')
        await pg.evaluate(CLOSE)
        await pg.evaluate("WG.bxg.met = {}; wStartRing({ club: 'local', how: 'manage' })")
        await pg.wait_for_selector('[data-rslot]'); await pg.click('[data-rgo="manage"]')
        await pg.wait_for_timeout(300)
        nx = await pg.evaluate("({ view: UI.view, live: !!WG.bxg.live, paused: wBX.paused })")
        check(nx == {'view': 'ring', 'live': True, 'paused': False}, 'a leave pressed before a Concede doesn\'t throw the next card out, and it runs', nx)
        # conceding while your fighter is being counted: the bout in progress is a knockout (it costs Team HP)
        hp = await pg.evaluate("(() => { wBX.pause(true); if (wBX.wait) wBX.call(wBX.wait.plan); for (let i = 0; i < 40 && wBX.phase !== 'round'; i++) wBX.step(); const G = wBX.G; G.F[0].x = -1; G.F[1].x = 1; G.F[0].y = G.F[1].y = 0; G.F[0].fx = []; G.F[0].hp = .1; G.F[0].a = { k: 'stun', t: 0, dur: 9, id: 0 }; G.F[1].a = { k: 'idle', t: 0, dur: 0, id: 0 }; for (let i = 0; i < 40 && G.down == null; i++) wBX.land(1, 'hook'); wBX.step(); wBX.pause(false); RUN.hp = RUN.maxhp; return { ph: wBX.phase, down: G.down }; })()")
        await pg.click('#wRingGive'); await pg.click('#cfYes')
        kc = await pg.evaluate("({ hp: RUN.maxhp - RUN.hp, kos: WG.bxg.cards[0].kos })")
        check(hp['ph'] == 'kd' and hp['down'] == 0 and kc == {'hp': 5, 'kos': 1}, 'conceding during the count: the bout is a knockout, and costs the Team HP', [hp, kc])
        await pg.evaluate(CLOSE)
        bt = await pg.evaluate("(async () => { W_RING_MODE = 'watch'; wRingBout({ kinds: ['ogre', 'elf'], seed: 2 }); const c0 = wBX.G.clock; await new Promise(r => setTimeout(r, 2600)); const r = { ph: wBX.phase, moved: wBX.G.clock < c0 || wBX.phase !== 'intro', paused: wBX.paused }; wLeaveRing(); return r; })()")
        check(bt['moved'] and not bt['paused'], 'and a bout after it runs', bt)
        await pg.evaluate(CLOSE)

        # ---------- around the Realm ----------
        k2 = await pg.evaluate("(() => { wRunAct('rcard', 'gk_ring'); const t = document.getElementById('modalBox').textContent; return { lines: !!document.querySelector('#modalBox .wrcard'), last: /Last cards/.test(t) }; })()")
        check(k2 == {'lines': True, 'last': True}, 'the card shows your boxers\' lines and the last cards', k2)
        await pg.evaluate(CLOSE)
        h = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpRingGame'); return e ? e.textContent : ''; })()")
        check('Simulate' in h and 'quarter of the XP' in h and 'Team HP' in h, 'How to play explains cards from the world', h)

        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
