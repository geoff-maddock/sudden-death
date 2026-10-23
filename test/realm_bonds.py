# Realm personal quests and bonds: every player has a hometown; from level 2 they tell you about HOME and a YES
# makes it their quest; a win that fits moves it on; done, they want to go home, and talking to them there gives a
# nickname and their kind's Hall of Fame card, upgraded and theirs. Starters build chemistry (2 a win, 1 a loss); a
# strong pair picks a combo card that plays only when both start, and goes if either is released. The Team screen
# has a Talk button on each row, the quest line and a Chemistry list; How to play explains it. Asserts; exits
# nonzero on failure. Screenshots: /tmp/realm-bonds-*.png.
import asyncio, json, sys, subprocess, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL, REALM_BUILD
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

HELP = r'''window.__wbot = function (maxTurns) {
  let g = 0;
  while (B && !B.over && g++ < (maxTurns || 60)) {
    let guard = 0;
    while (B.phase === 'player' && !B.over && guard++ < 30) {
      const al = alive(); if (!al.length) break;
      const tgt = al.slice().sort((a, b) => (a.hp + a.block) - (b.hp + b.block))[0];
      let best = -1, bs = -1;
      B.hand.forEach((c, i) => { if (!canPlay(c)) return; const d = def(c); if (d.type === 'junk' || d.type === 'curse') return; const s = d.type === 'atk' ? 3 : d.type === 'pow' ? 2 : 1; if (s > bs) { bs = s; best = i; } });
      if (best < 0) break;
      playCard(best, B.enemies.indexOf(tgt));
    }
    if (B.over) break;
    runSteps(endTurn());
  }
  return B && B.over;
};
window.__wlose = function () { let g = 0; while (B && !B.over && g++ < 40) { RUN.hp = 1; runSteps(endTurn()); } return B && B.over; };
window.__wend = function () { consumeFx(); renderFightHUD(); finishFight(); };
window.__match = function (sport, region) { WG.grace = 99; for (const k in W_PARTY.recruitOdds) W_PARTY.recruitOdds[k] = 0;
  startMatch({ type: 'normal', tier: 1, card: false, sport, world: { kind: 'wild', region: region || 'plains' } }); };
window.__town = function (t) { const at = wInnSpot(t); wEnterMap(t, at[0], at[1]); };
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"

async def boot(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wStart === 'function' && typeof wQuestOffer === 'function'")
    await pg.add_script_tag(content=HELP)
    await pg.evaluate(NOTIPS)

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def win(pg, sport, region='plains'):
    await pg.evaluate(f"__match('{sport}', '{region}')")
    await pg.wait_for_function("UI.view === 'fight' && !!B")
    await pg.evaluate("RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = 300; for (const e of alive()) e.hp = Math.min(e.hp, 6)")
    over = await pg.evaluate("__wbot(120)")
    await pg.evaluate("__wend()")
    await pg.wait_for_selector('#bCont'); await pg.click('#bCont')
    await pg.wait_for_function("UI.view === 'world' && !RUN.pending")
    return over

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        for vp, tag in [({'width': 1280, 'height': 800}, 'desk'), ({'width': 390, 'height': 844}, 'phone')]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if tag == 'phone' else 1, is_mobile=tag == 'phone', has_touch=tag == 'phone')
            pg = await ctx.new_page()
            pg.on('pageerror', lambda e, tag=tag: errs.append(tag + ': ' + str(e)))
            pg.on('console', lambda m, tag=tag: errs.append(tag + ' console: ' + m.text) if m.type == 'error' else None)
            await boot(pg)
            await new_journey(pg)
            if tag == 'desk':
                # ---------- hometowns, and the quest offer ----------
                h = await pg.evaluate("""(() => { const R = wRoster(); R.forEach(wEnsureHome);
                  return R.map(p => ({ home: p.home, fits: DB.regions[wTownRegion(p.home)].kinds.includes(p.kind) || !Object.keys(W_GROUND.inns).some(t => DB.regions[wTownRegion(t)].kinds.includes(p.kind)) })); })()""")
                check(all(x['home'] in ['graftonbury', 'mossgate', 'saltmere', 'cinderhold', 'rimewatch'] and x['fits'] for x in h), 'every founder has a hometown where their kind lives', h)
                lk = await pg.evaluate("(() => { const p = wStarters()[0]; p.lvl = 1; const r = wSay('p:' + p.id, 'home'); return { text: r.text, pq: p.pq || null }; })()")
                check('Ask me again' in lk['text'] and lk['pq'] is None, 'at level 1 a player keeps their quest to themselves', lk)
                of = await pg.evaluate("""(() => { const p = wStarters()[0]; p.lvl = 2; const r = wSay('p:' + p.id, 'home');
                  const ch = wChar('p:' + p.id); return { text: r.text, st: p.pq && p.pq.st, yes: 'yes' in ch.topics }; })()""")
                check(of['st'] == 'offer' and 'YES' in of['text'] and of['yes'], 'at level 2, HOME tells you what they want, and YES is a word they answer to', of)
                ac = await pg.evaluate("""(() => { const p = wStarters()[0]; const r = wSay('p:' + p.id, 'yes'); return { text: r.text, st: p.pq.st, log: WLOG.slice(-3).map(l => l[0]).join(' | ') }; })()""")
                check(ac['st'] == 'go' and "quest" in ac['log'], 'YES makes it their quest, and the log says what it is', ac)

                # ---------- progress: a win that fits ----------
                await pg.evaluate("(() => { const p = wStarters()[0]; p.home = 'mossgate'; p.pq = { t: 'sport', sport: 'baseball', n: 0, need: 1, st: 'go' }; })()")
                over = await win(pg, 'baseball')
                st = await pg.evaluate("wStarters()[0].pq.st")
                check(over == 'win' and st == 'home', 'a baseball win with them starting finishes a baseball quest', {'over': over, 'st': st})
                away = await pg.evaluate("(() => { __town('saltmere'); const p = wStarters()[0]; const r = wSay('p:' + p.id, 'home'); return { text: r.text, st: p.pq.st, nick: p.nick || null }; })()")
                check(away['st'] == 'home' and 'take me home to Mossgate' in away['text'] and away['nick'] is None, 'away from home, they ask you to take them there', away)
                home = await pg.evaluate("""(() => { __town('mossgate'); const p = wStarters()[0], n0 = wCardsOf(p.id).length; const r = wSay('p:' + p.id, 'home');
                  const hof = wCardsOf(p.id).find(c => c.id === 'hof_' + p.kind); return { text: r.text, st: p.pq.st, nick: p.nick, name: wNameOf(p), n: wCardsOf(p.id).length - n0, hof: hof ? { up: !!hof.up } : null, kind: p.kind }; })()""")
                check(home['st'] == 'done' and home['nick'] and home['nick'] in home['name'] and home['nick'] in home['text'], 'home, they finish the quest and earn a nickname', home)
                check(home['hof'] is not None and home['hof']['up'] and home['n'] == 1, 'and their kind\'s Hall of Fame card, upgraded and their own', home)

                # ---------- other quest kinds ----------
                qk = await pg.evaluate("""(() => { const [a, b, c] = wStarters(); const g = { mvp: a.kind, sport: 'hockey' };
                  a.pq = { t: 'mvp', n: 0, need: 2, st: 'go' }; b.pq = { t: 'big', n: 0, need: 1, st: 'go' }; c.home = 'rimewatch'; c.pq = { t: 'home', n: 0, need: 1, st: 'go' };
                  wQuestTick([a, b, c], { region: 'plains' }, 'win', g, 'normal'); const one = [a.pq.n, b.pq.n, c.pq.n];
                  wQuestTick([a, b, c], { region: 'rime' }, 'win', g, 'elite'); const two = [a.pq.st, b.pq.st, c.pq.st];
                  wQuestTick([a, b, c], { region: 'rime' }, 'lose', g, 'elite');
                  return { one, two }; })()""")
                check(qk['one'] == [1, 0, 0] and qk['two'] == ['home', 'home', 'home'], 'player of the game twice, an elite win, and a win in their home region each count', qk)

                # ---------- chemistry ----------
                bd = await pg.evaluate("""(() => { const st = wStarters(), K = [[0, 1], [0, 2], [1, 2]].map(([i, j]) => wBondKey(st[i].id, st[j].id));
                  return K.map(k => (WG.bonds[k] || {}).n || 0); })()""")
                check(bd == [2, 2, 2], 'a win together gives each pair of starters 2 chemistry', bd)
                await pg.evaluate("(() => { const st = wStarters(); WG.bonds[wBondKey(st[0].id, st[1].id)].n = 11; for (const p of wRoster()) p.pq = p.pq && p.pq.st === 'done' ? p.pq : null; })()")
                await pg.evaluate("RUN.hp = 30; __match('hockey')")
                await pg.wait_for_function("UI.view === 'fight' && !!B")
                await pg.evaluate("__wlose(); __wend(); const wk = document.getElementById('wWake'); if (wk) wk.click();")
                await pg.wait_for_function("UI.view === 'world'")
                await pg.wait_for_selector('#modalBox .wbondb')
                off = await pg.evaluate("({ list: (WG.cardOffer || {}).list || [], banner: document.querySelector('#modalBox .wbondb').textContent, pair: WG.wbondOffer })")
                check(len(off['list']) == 3 and all(c['id'].startswith('wb_') for c in off['list']), 'a strong pair (a loss adds 1) picks one of three combo cards, shown once you are up from the blackout', off)
                await pg.screenshot(path='/tmp/realm-bonds-combo-desk.png')
                await pg.click('#modalBox [data-wco="0"]')
                cb = await pg.evaluate("""(() => { const c = wComboCards()[0], st = wStarters(); return c ? { wb: c.wb, wp: c.wp == null, pair: [st[0].id, st[1].id], inNext: wNextMatchDeck().includes(c), league: wLeagueCards().includes(c) } : null; })()""")
                check(cb and sorted(cb['wb']) == sorted(cb['pair']) and cb['wp'] and cb['inNext'] and not cb['league'], 'the combo card belongs to the pair, not to one player, and plays while both start', cb)
                bn = await pg.evaluate("""(() => { const R = wRoster(), extra = { ...R[0], id: WG.pid++, n: 'Benchley', kind: R.some(p => p.kind === 'ogre') ? 'troll' : 'ogre', lvl: 1, xp: 0, from: 'tavern', joined: 1, pq: null, nick: null };
                  WG.roster.push(extra); const st = wStarters(); wSwap(st[1].id, extra.id); const c = wComboCards()[0];
                  const inNext = wNextMatchDeck().includes(c); wBenchCards(); const benched = RUN.wbench.includes(c) && !RUN.deck.includes(c); wRestoreBench();
                  return { inNext, benched }; })()""")
                check(not bn['inNext'] and bn['benched'], 'bench one of the pair and the combo card sits out at kickoff', bn)
                rl = await pg.evaluate("""(() => { const c = wComboCards()[0], pid = c.wb.find(id => !wIsStarter(id)); const why = wRelease(pid);
                  return { why, left: wComboCards().length, bonds: Object.keys(WG.bonds).filter(k => k.split('-').map(Number).includes(pid)).length }; })()""")
                check(rl['why'] == '' and rl['left'] == 0 and rl['bonds'] == 0, 'release one of the pair and the combo card and their chemistry go', rl)
                cap = await pg.evaluate("""(() => { const st = wStarters(), k = wBondKey(st[0].id, st[1].id); WG.wprompts = [];
                  for (let i = 0; i < W_BOND.maxCombos; i++) RUN.deck.push(Object.assign(mkCard('wb_cover'), { wb: [st[1].id, st[2].id] }));
                  WG.bonds[k] = { n: 11, combo: false }; wBondTick(st, 'win'); const full = WG.wprompts.filter(P => P.t === 'bond').length;
                  const c = wComboCards()[0]; RUN.deck = RUN.deck.filter(x => x !== c); wBondTick(st, 'win'); const room = WG.wprompts.filter(P => P.t === 'bond').length;
                  WG.wprompts = []; RUN.deck = RUN.deck.filter(x => !x.wb); return { full, room, max: W_BOND.maxCombos }; })()""")
                check(cap['max'] == 2 and cap['full'] == 0 and cap['room'] == 1, 'a team holds 2 combo cards at most; a strong pair that waited picks once a place opens', cap)
                saved = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(pkey('sd-realm'))); return !!(s && s.WG && s.WG.bonds && s.WG.roster.some(p => p.nick)); })()")
                check(saved, 'nicknames and chemistry are saved with the journey')
                await pg.evaluate("renderHelp()")
                check(await pg.evaluate("!!document.getElementById('wHelpBonds')"), 'How to play explains quests and chemistry')
            else:
                await pg.evaluate("(() => { const p = wStarters()[0]; p.lvl = 2; p.nick = 'Clutch'; })()")

            # ---------- the Team screen ----------
            await pg.evaluate("document.querySelectorAll('#modalBox [data-close]').forEach(b => b.click()); wOpenCamp('team')")
            await pg.wait_for_selector('li[data-pid] [data-ptalk]')
            ui = await pg.evaluate("""(() => ({ talks: document.querySelectorAll('li[data-pid] [data-ptalk]').length, rows: wRoster().length,
              lines: document.querySelectorAll('li[data-pid] .wpq').length, chem: document.querySelectorAll('.wchem li').length,
              nick: [...document.querySelectorAll('li[data-pid] .wpn b')].some(b => /"|, the /.test(b.textContent)) }))()""")
            check(ui['talks'] == ui['rows'] and ui['lines'] == ui['rows'], f'[{tag}] every row has a Talk button and a quest line', ui)
            check(ui['chem'] >= 3 and ui['nick'], f'[{tag}] the Chemistry list shows the starting pairs, and nicknames show on the roster', ui)
            await pg.screenshot(path=f'/tmp/realm-bonds-team-{tag}.png')
            if tag == 'phone':
                over = await pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
                check(not over, '[phone] the Team screen does not widen the page')
            await pg.evaluate("(() => { const p = wRoster().find(p => !p.pq || p.pq.st !== 'done'); if (p) { p.lvl = 2; p.pq = null; } wRenderCamp(); })()")
            await pg.click('li[data-pid] .wnews')
            await pg.wait_for_selector('#wTalk:not([hidden]) [data-kw="home"]')
            tk = await pg.evaluate("""(() => { const pid = wTalkPid(WUI.talk.id), p = wPlayer(pid); return { modal: document.getElementById('modal').hidden, port: document.querySelector('#wTalk .wtport').src === wPlayerPort(p, 96), name: document.querySelector('#wTalk h3').textContent === wNameOf(p) }; })()""")
            check(tk['modal'] and tk['port'] and tk['name'], f'[{tag}] Talk closes the Team screen and opens a talk with that player, in their own colours', tk)
            await pg.click('#wTalk [data-kw="home"]')
            await pg.wait_for_selector('#wTalk [data-kw="yes"]')
            await pg.screenshot(path=f'/tmp/realm-bonds-talk-{tag}.png')
            await pg.click('#wTalk .wkw[data-kw="yes"]')
            st = await pg.evaluate("wPlayer(wTalkPid(WUI.talk.id)).pq.st")
            check(st == 'go', f'[{tag}] clicking HOME, then YES, takes the quest on', st)
            await pg.evaluate("wTalkSay('bye')")
            check(await pg.evaluate("!WUI.talk"), f'[{tag}] Bye ends the talk')

            sd = await pg.evaluate('window.__sdErrs || []')
            check(not sd, f'[{tag}] no __sdErrs', sd)
            await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    print('ok: realm bonds passed' if not FAILS else f'FAILED: {len(FAILS)} checks')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
