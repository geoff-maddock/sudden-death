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
        c = await pg.evaluate("({ view: UI.view, live: WG.bxg.live, r: WG.bxg.cards[0].r, by: WG.bxg.cards[0].by })")
        check(mode == 'play' and title == 'Concede the card?' and c == {'view': 'world', 'live': None, 'r': 'lose', 'by': 'conceded'}, 'Play opens on You box; Concede asks, then counts it as a loss', [mode, title, c])
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
