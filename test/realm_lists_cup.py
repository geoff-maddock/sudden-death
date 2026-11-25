# Realm lists cup (issue #117, phase 10). The Gilded Lance: Sir Ruddock's CUP topic opens it; entry costs the fee and
# draws a field of eight (you first, rivals and regional sides), registered in W_BRACKETS through w45b's bracket. Your
# quarter-final (Simulate) settles, and back in the world the rest of the round is jousted on the engine, with points and
# a winner every time (no match ends level: the tilt for the crown); the semi-final is jousted on the lists (Manage, tier
# 2, their bag in), saved and left mid-match, and after a reload the cup card's Resume puts it back; it rides to the end
# and the round catches up when you're back. The final is one match: winning it pays the prize (gold, fans, a pick of
# jousting cards, the first piece of W_LISTS_KIT.prize's gear you don't have, its potion), the journal and the Wall of
# Awards; with all the gear, gold instead. Once a week; with another jousting match waiting the card says so; Play and
# Concede, and the rest of the bracket is jousted to a champion, the concession marked. The Lists tab's and the match
# card's buttons, Jousting: how it works, How to play, and the save. Asserts; exits nonzero on failure.
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

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.querySelector('#modalBox [data-close], #modalBox #wListsOk, #modalBox #wJtLater, #modalBox .btn, #modalBox button'); if (!b) break; b.click(); }
  WG.cardOffer = null; })()"""
UNTIL_BRACKET = """(async () => { for (let i = 0; i < 30 && !document.querySelector('#modalBox .wdcb'); i++) {
  if (document.getElementById('modal').hidden) { wDrain(); } else { const b = document.querySelector('#modalBox .card, #modalBox [data-close], #modalBox #wListsOk, #modalBox .btn, #modalBox button'); if (b) b.click(); }
  await new Promise(r => setTimeout(r, 100)); } return !!document.querySelector('#modalBox .wdcb'); })()"""
CUP = "(() => { const D = WG.jtcup; return D && { round: D.round, out: D.out, done: D.done, champ: D.champ, pending: D.pending, field: D.field, games: D.games }; })()"
# a winner every time, by points; level only when the tilt for the crown ran to Sir Ruddock's count
FAIR = "(g => Number.isInteger(g.ra) && Number.isInteger(g.rb) && [g.a, g.b].includes(g.w) && ['', 'tc'].includes(g.end) && (g.ra === g.rb ? g.end === 'tc' : (g.w === g.a ? g.ra > g.rb : g.rb > g.ra)))"
TO_END = "(() => { wJT.pause(true); wJT.manage({ auto: true }); let i = 0; while (wListsLive() && i++ < 200000) wJT.tick(0.05); return !wListsLive(); })()"

async def boot(pg):
    await pg.wait_for_function("typeof wOpenLance === 'function' && typeof wJT !== 'undefined'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await boot(pg)
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        reg = await pg.evaluate("""(() => { const C = W_BRACKETS.jtcup; return { name: C.name, view: C.view, store: C.store, rounds: C.K.rounds.length, size: C.K.size,
          hooks: ['live', 'base', 'sim', 'won', 'mark'].every(k => typeof C[k] === 'function'), marks: [C.mark({ end: 'tc' }), C.mark({ end: 'c' }), C.mark({ end: '' })], four: WG.lists === undefined || !WG.lists || Array.isArray(WG.lists.four) }; })()""")
        check(reg == {'name': 'Gilded Lance', 'view': 'lists', 'store': 'games', 'rounds': 3, 'size': 8, 'hooks': True, 'marks': ['†', '‡', ''], 'four': True},
              "the Gilded Lance is a table in W_BRACKETS: its numbers, words and hooks (and WG.lists is still the four)", reg)
        t = await pg.evaluate("(() => { const K = DB.chars.gk_lists; return { act: K.topics.cup && K.topics.cup.act, job: /CUP/.test(K.topics.job.t) }; })()")
        check(t == {'act': 'jtcup', 'job': True}, 'Sir Ruddock runs the Gilded Lance CUP', t)
        off = await pg.evaluate("(() => { const R = WG.roster; WG.roster = R.slice(0, 1); const why = wLanceProblems().join(' '); WG.roster = R; return why; })()")
        check('Recruit' in off, 'with one player of your own you can\'t enter', off)
        await pg.evaluate("(() => { for (const kind of ['elf', 'spider', 'gorgon', 'dwarf']) if (wRoster().length < 6) wAddPlayer(wMakePlayer({ kind, lvl: 2 }, 'tavern')); RUN.gold = 500; })()")

        await pg.evaluate("wRunAct('jtcup')"); await pg.wait_for_selector('#modalBox #wLanceEnter:not([disabled])')
        await pg.click('#wLanceEnter'); await pg.wait_for_selector('#modalBox [data-lancehow]')
        D = await pg.evaluate(CUP); f = D['field']
        check(len(f) == 8 and len(set(f)) == 8 and f[0] == 'me' and any(x.startswith('wild:') for x in f), 'entry: a field of eight, you first, rivals and regional sides', f)
        check(await pg.evaluate("RUN.gold") == 460, 'the fee is paid')
        hows = await pg.evaluate("[...document.querySelectorAll('#modalBox [data-lancehow]')].map(b => b.dataset.lancehow)")
        check(hows == ['play', 'manage', 'sim'], 'each round: Play, Manage or Simulate', hows)

        # ---------- the quarter-final, simulated ----------
        await pg.evaluate("W_LANCE.force = 'win'")
        await pg.click('#modalBox [data-lancehow="sim"]')
        await pg.wait_for_selector('#wListsOk'); await pg.click('#wListsOk')
        check(await pg.evaluate(UNTIL_BRACKET), 'after the Final card, the bracket shows')
        D = await pg.evaluate(CUP); qf = D['games'][0]
        check(D['round'] == 1 and not D['pending'] and len(qf) == 4 and qf[0]['w'] == 'me' and qf[0]['ra'] > qf[0]['rb'], 'the quarter-final: yours settles, and the rest of the round is jousted', qf)
        fair = await pg.evaluate(f"WG.jtcup.games[0].slice(1).every({FAIR})")
        check(fair, 'no match ends level: every one has a winner, by points (the tilt for the crown if need be)', qf[1:])
        last = await pg.evaluate("({ tier: WG.jtg.games[0].tier, kind: WG.lastMatch.kind, met: WG.jtg.met[WG.jtg.games[0].club] == null, h2h: !CLUBS[WG.jtg.games[0].club] || ((WG.h2h || {})[WG.jtg.games[0].club] || {}).last.sport === 'jousting' })")
        check(last == {'tier': 1, 'kind': 'jtcup', 'met': True, 'h2h': True},'the quarter-final is tier 1 (a Squire), counts as a jousting match, and is not the club\'s match of the day', last)
        await pg.evaluate(CLOSE_ALL)

        # ---------- the semi-final, on the lists: saved and left, reloaded, resumed from the cup card ----------
        await pg.evaluate("wOpenLance()"); await pg.wait_for_selector('#modalBox [data-lancehow="manage"]')
        await pg.click('#modalBox [data-lancehow="manage"]')
        await pg.wait_for_function("UI.view === 'lists' && WG.jtg.live && WG.jtg.live.world.kind === 'jtcup'", timeout=15000)
        sm = await pg.evaluate("({ tier: WG.jtg.live.world.tier, mode: wJT.mode, cup: WG.jtg.live.world.cup, bag: !!(wJT.G.bags && wJT.G.bags[1]), save: !$('wListsSave').hidden, give: !$('wListsGive').hidden })")
        check(sm == {'tier': 2, 'mode': 'manage', 'cup': True, 'bag': True, 'save': True, 'give': True}, 'the semi-final is tier 2 (a Knight), on the lists, with Save and leave and Concede, and they bring their bag', sm)
        mid = await pg.evaluate("""(() => { wJT.pause(true); wJT.manage({ auto: true }); let i = 0; while (wJT.G.n < 1 && !wJT.G.over && i++ < 50000) wJT.tick(0.05); wJT.manage({ auto: false });
          const out = { n: wJT.G.n, over: !!wJT.G.over, ph: wJT.phase }; $('wListsSave').click(); out.after = wListsLive(); return out; })()""")
        n0 = mid['n']
        check(not mid['over'] and mid['after'], 'a course in (the match cannot be over: the second heat is to come), the semi-final is still on when you Save and leave', mid)
        sv = await pg.evaluate("(() => { const s = JSON.parse(localStorage.getItem(wSaveKey())); return { view: UI.view, live: !!(s.WG.jtg.live && s.WG.jtg.live.snap), kind: s.WG.jtg.live && s.WG.jtg.live.world.kind, round: s.WG.jtcup.round, games: s.WG.jtcup.games[1].length }; })()")
        check(sv == {'view': 'world', 'live': True, 'kind': 'jtcup', 'round': 1, 'games': 0}, 'Save and leave keeps the cup match: in the save, the round still open', sv)
        await pg.reload(); await boot(pg)
        await pg.evaluate("wStart(wLoadSave())"); await pg.wait_for_function("UI.view === 'world' && !!WG", timeout=20000)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("wRunAct('jtcup')"); await pg.wait_for_selector('#modalBox #wLanceRes')
        await pg.click('#wLanceRes')
        await pg.wait_for_function("UI.view === 'lists' && !!WJT && WJT.world", timeout=15000)
        rs = await pg.evaluate("({ n: wJT.G.n, kind: WG.jtg.live.world.kind, mode: wJT.mode })")
        check(rs['kind'] == 'jtcup' and rs['n'] == n0 and rs['mode'] == 'manage', 'after a reload the cup card\'s Resume puts the semi-final back where it was', [n0, rs])
        await pg.evaluate("W_LANCE.force = 'win'")
        check(await pg.evaluate(TO_END), 'the semi-final rides to its end')
        await pg.click('#wListsBack')
        check(await pg.evaluate(UNTIL_BRACKET), 'back in the world, the bracket shows')
        D = await pg.evaluate(CUP)
        check(D['round'] == 2 and len(D['games'][1]) == 2 and D['games'][1][0]['w'] == 'me', 'the semi-finals are in: on to the final', D['games'][1])
        sv = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(wSaveKey())); return s.WG.jtcup && s.WG.jtcup.round; })()")
        check(sv == 2, 'the cup is in the save', sv)
        await pg.evaluate(CLOSE_ALL)

        # ---------- the final: one match, and the prize ----------
        await pg.evaluate("(() => { window.__offers = []; const o = wCardOffer; wCardOffer = function (spec) { __offers.push(spec); return o.apply(this, arguments); }; })()")
        g0 = await pg.evaluate("RUN.gold"); fans0 = await pg.evaluate("RUN.fans || 0")
        have = await pg.evaluate("wLanceGear().filter(id => (WG.items[id] || 0) > 0)")
        oil0 = await pg.evaluate("WG.items.jtoil || 0")
        await pg.evaluate("(() => { W_LANCE.force = 'win'; wLancePlay('sim'); WG.cardOffer = null; wLanceCatchUp(); WG.cardOffer = null; })()")
        await pg.evaluate(CLOSE_ALL)
        D = await pg.evaluate(CUP)
        won = await pg.evaluate("({ wins: WG.jtcupWins, log: WG.jtcupLog.length, journal: wJ().wins.map(w => w.t), sport: (wJ().wins.find(w => w.t === 'Won the Gilded Lance') || {}).sport })")
        check(D['champ'] == 'me' and D['done'] and len(D['games'][2]) == 1 and won['wins'] == 1 and won['log'] == 1 and await pg.evaluate("RUN.gold") - g0 >= 150 and await pg.evaluate("RUN.fans") - fans0 >= 20,
              'the final is one match: win it, the Gilded Lance, its gold and fans', [D['champ'], D['games'][2], won])
        offers = await pg.evaluate("__offers.map(o => ({ pick: o.pick, pool: (o.pool || []).length }))")
        check(any(o['pick'] == 3 for o in offers), 'the prize includes a pick of 3 cards', offers)
        jp = await pg.evaluate("(p => p.length >= 3 && p.every(id => CARDS[id].sport === 'jousting'))(wSportPool(['jousting']))")
        check(jp, 'from the jousting cards')
        check('Won the Gilded Lance' in won['journal'] and won['sport'] == 'jousting', 'it goes in the journal', won)
        gear = await pg.evaluate("wLanceGear().filter(id => (WG.items[id] || 0) > 0)")
        check(len(gear) == len(have) + 1 and gear[0] == 'jt_spurs' and all(g in ['jt_spurs', 'jt_helm', 'jt_favour'] for g in gear), 'and the first piece of W_LISTS_KIT.prize\'s gear you did not have', [have, gear])
        check(await pg.evaluate("WG.items.jtoil || 0") == oil0 + 1, "and its potion: a Squire's Oil")
        wall = await pg.evaluate("(() => { wWallText(); return WLOG.slice(-3).map(l => l[0]).join(' '); })()")
        check('Gilded Lance' in wall, 'and on the Wall of Awards', wall)
        check('once a week' in await pg.evaluate("wLanceEnter()"), 'the next cup is next week')
        # with every piece already: gold instead
        allg = await pg.evaluate("""(() => { for (const id of wLanceGear()) WG.items[id] = 1; const g = RUN.gold, n = Object.keys(WG.items).length; const keep = wGainCard; wGainCard = () => {};
          try { wLanceWon(); } finally { wGainCard = keep; } return { gold: RUN.gold - g, items: Object.keys(WG.items).length - n }; })()""")
        check(allg['gold'] == 150 + 60 and allg['items'] == 0, 'with every piece of the gear, the Lance pays gold instead', allg)

        # ---------- next week: busy, then Play and Concede ----------
        await pg.evaluate("WG.dayAbs += 7; WG.day += 7; WG.jtg.met = {}")
        busy = await pg.evaluate("""(() => { wLanceEnter(); WG.jtg.live = { world: { kind: 'jtgame', club: 'local', tier: 1, how: 'play', ids: [], day: WG.dayAbs }, snap: { G: {} } }; wOpenLance();
          const dis = [...document.querySelectorAll('#modalBox [data-lancehow]')].every(b => b.disabled), say = document.getElementById('modalBox').textContent.includes('Finish the jousting match');
          WG.jtg.live = null; return { dis, say }; })()""")
        check(busy == {'dis': True, 'say': True}, 'with another jousting match waiting, the cup card says so and its buttons wait', busy)
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate("(() => { wLancePlay('play'); wJT.pause(true); $('wListsGive').click(); const b = [...document.querySelectorAll('#modalBox button')].find(x => x.textContent.trim() === 'Concede'); b.click(); })()")
        await pg.evaluate(CLOSE_ALL); await pg.evaluate("wDrain()")
        await pg.wait_for_function("WG.jtcup.done", timeout=60000)
        D = await pg.evaluate(CUP)
        check(D['out'] and D['done'] and D['champ'] != 'me' and len(D['games'][2]) == 1 and len(D['games'][1]) == 2, 'lose, and the rest of the bracket is jousted to a champion', D)
        check(D['games'][0][0]['end'] == 'c' and D['games'][0][0]['w'] != 'me', 'a conceded match is marked in the bracket', D['games'][0][0])
        fair = await pg.evaluate(f"WG.jtcup.games.flat().filter(g => g.a !== 'me').every({FAIR})")
        check(fair, 'every other match in the bracket has a winner', D['games'])
        br_html = await pg.evaluate("wLanceBracket()")
        check('‡' in br_html and 'Won by concession' in br_html and br_html.count('class="wdcg"') == 7, 'the bracket: seven matches, the concession marked and explained', br_html[:300])
        await pg.evaluate(CLOSE_ALL)

        # ---------- where it is ----------
        bt = await pg.evaluate("""(() => { wOpenCamp('lists'); const tab = !!document.querySelector('#wCampBody [data-jtcup]'); WCAMP.close();
          wOpenListsCard(); const card = !!document.querySelector('#modalBox [data-jtcup]'); return { tab, card }; })()""")
        check(bt['tab'] and bt['card'], 'the Lists tab and the match card have a Gilded Lance button', bt)
        await pg.evaluate(CLOSE_ALL)
        how = await pg.evaluate("(() => { const d = document.createElement('div'); d.innerHTML = wListsHowHTML(); const t = (d.querySelector('#wListsHowCup') || {}).textContent || ''; return ['Gilded Lance', 'CUP', 'tilt for the crown', 'Squire'].map(s => t.includes(s)); })()")
        check(all(how), 'Jousting: how it works explains the Gilded Lance', how)
        await pg.evaluate("showPage('help')")
        hp = await pg.evaluate("(() => { const t = (document.getElementById('wHelpListsCup') || {}).textContent || ''; return ['Gilded Lance', 'CUP', 'tilt for the crown', 'concede', 'Save and leave'].map(s => t.includes(s)); })()")
        check(all(hp), 'How to play explains the Gilded Lance', hp)
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))

        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('FAILURES: ' + str(len(FAILS)) if FAILS else 'all ok')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
