# Realm league table and rivals who act: the rivals and Apex play a round every 2 days; inns post the table (TABLE,
# and a button in the room menu) with your row from cup and rival games; a second win against a rival brings a bid
# for your best bench player: sell for the fee, or refuse and they come for a grudge match on the road (win it for
# gold and fans); a rival who beat you last taunts you at the cup sign-up, and beating them in round 3 pays a revenge
# bonus. Asserts; exits nonzero on failure. Screenshots: /tmp/realm-league-*.png.
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
window.__wend = function () { consumeFx(); renderFightHUD(); finishFight(); };
window.__town = function (t) { const at = wInnSpot(t); wEnterMap(t, at[0], at[1]); };
window.__wild = function () { const m = MAPS.world; for (let y = 2; y < m.h - 2; y++) for (let x = 2; x < m.w - 2; x++) { if (regionAt(x, y) !== 'plains') continue; const c = wTileAt(m, x, y), td = DB.tiles[c]; if (td && td.walk && !td.enter && td.enc > 0) { wEnterMap('world', x, y); return [x, y]; } } };
window.__clear = function () { WG.cardOffer = null; WG.wprompts = []; const m = document.getElementById('modal'); m.hidden = true; m.onclick = null; };
window.__bench = function () { const R = wRoster(), kind = ['ogre', 'troll', 'elf', 'dwarf'].find(k => !R.some(p => p.kind === k));
  const p = wMakePlayer({ kind, lvl: 3 }, 'tavern'); wAddPlayer(p); return p.id; };
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"

async def boot(pg):
    await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL); await pg.wait_for_function("typeof wStart === 'function' && typeof wLeague === 'function'")
    await pg.add_script_tag(content=HELP)
    await pg.evaluate(NOTIPS)

async def new_journey(pg):
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

async def play_win(pg):
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
            await pg.evaluate("for (const k in W_PARTY.recruitOdds) W_PARTY.recruitOdds[k] = 0")
            if tag == 'desk':
                # ---------- the league plays while you travel ----------
                lg = await pg.evaluate("""(() => { const L = wLeague(), d0 = WG.dayAbs; for (let i = 0; i < 4; i++) wNewDay();
                  const rounds = [d0 + 1, d0 + 2, d0 + 3, d0 + 4].filter(d => d % W_LEAGUE.every === 0).length, cl = wLeagueClubs();
                  const w = cl.reduce((a, c) => a + L.table[c].w, 0), l = cl.reduce((a, c) => a + L.table[c].l, 0);
                  return { clubs: cl.length, apex: cl.includes('apex'), mine: cl.includes(RUN.club), rounds, games: L.results.length, w, l, per: Math.floor(cl.length / 2), rows: wLeagueRows().length }; })()""")
                check(lg['apex'] and not lg['mine'] and lg['clubs'] >= 3, 'the league is your rivals and Apex Athletic, not you', lg)
                check(lg['rounds'] == 2 and lg['games'] == 2 * lg['per'] and lg['w'] == lg['games'] == lg['l'], 'a round every 2 days, everyone but one club playing', lg)
                check(lg['rows'] == lg['clubs'] + 1, 'the table has a row for you too', lg)
                inn = await pg.evaluate("""(() => { __town('graftonbury'); const r = wSay('hq_inn', 'table'); wRunAct(r.act, 'hq_inn');
                  return { act: r.act, greet: wChar('hq_inn').greet.includes('TABLE'), rows: document.querySelectorAll('#modalBox .wlg tbody tr').length, me: !!document.querySelector('#modalBox .wlg tr.wme'), res: document.querySelectorAll('#modalBox .wlgres li').length }; })()""")
                check(inn['act'] == 'league' and inn['greet'] and inn['rows'] == lg['rows'] and inn['me'] and inn['res'] == lg['games'], 'ask the innkeeper about the TABLE: the table, your row, the latest results', inn)
                await pg.screenshot(path='/tmp/realm-league-table-desk.png')
                await pg.evaluate("document.querySelectorAll('#modalBox [data-close]').forEach(b => b.click()); wOpenInn(12, 'Tess')")
                await pg.click('#wInnLeague'); await pg.wait_for_selector('#modalBox .wlg')
                check(True, 'the inn room menu has a League table button')
                await pg.evaluate("document.querySelectorAll('#modalBox [data-close]').forEach(b => b.click())")

                # ---------- a second win against a rival: a bid for your bench player ----------
                club = await pg.evaluate("Object.values(WG.rivals)[0]")
                bench = await pg.evaluate("__bench()")
                await pg.evaluate(f"""(() => {{ __wild(); WG.h2h = {{ {json.dumps(club)}: {{ w: 1, l: 0 }} }}; WG.grace = 99;
                  startMatch({{ type: 'rival', tier: 1, card: false, name: 'Them', world: {{ kind: 'event', ref: {{ rival: {json.dumps(club)} }}, region: 'plains' }} }}); }})()""")
                over = await play_win(pg)
                await pg.wait_for_selector('#wBidSell')
                bid = await pg.evaluate(f"({{ me: WG.league.me, h: WG.h2h[{json.dumps(club)}], text: document.getElementById('modalBox').textContent, n: wPlayer({bench}).n }})")
                check(over == 'win' and bid['me']['w'] == 1 and bid['h']['w'] == 2, 'a win against a rival counts in your row and the head to head', bid)
                check(bid['n'] in bid['text'] and 'grudge' in bid['text'], 'their second loss to you: they bid for your best bench player', bid['text'][:200])
                await pg.screenshot(path='/tmp/realm-league-bid-desk.png')
                await pg.click('#wBidNo')
                gr = await pg.evaluate(f"({{ g: WG.grudge, still: !!wPlayer({bench}), day: WG.dayAbs }})")
                check(gr['g'] and gr['g']['club'] == club and gr['g']['day'] == gr['day'] + 1 and gr['still'], 'refuse: you keep them, and the club has a grudge from tomorrow', gr)

                # ---------- the grudge on the road ----------
                none = await pg.evaluate("(() => { __clear(); __wild(); WG.grace = 0; W_LEAGUE.grudgeP = 1; const r = wEncounterHook('plains', '.', null); const b = !!B && !!RUN.pending; return b; })()")
                check(not none or await pg.evaluate("!(RUN.pending && RUN.pending.world.ref && RUN.pending.world.ref.grudge)"), 'not on the same day')
                # (that roll may instead have put a roadside event up; one left open stops a grudge turning up, so it goes too)
                await pg.evaluate("document.querySelectorAll('#modalBox #wNotYet, #modalBox #wRun').forEach(b => b.click()); RUN.pending = null; B = null; WG.event = null")
                await pg.evaluate("__clear(); WG.dayAbs = WG.grudge.day; __wild(); WG.grace = 0; wEncounterHook('plains', '.', null)")
                await pg.wait_for_selector('#modalBox .wtaunt')
                t = await pg.evaluate("document.querySelector('#modalBox .wtaunt').textContent")
                g0 = await pg.evaluate("RUN.gold")
                await pg.click('#wPlay')
                await pg.wait_for_function("UI.view === 'fight' && !!B && !!RUN.pending")
                pre = await pg.evaluate("({ ref: RUN.pending.world.ref, type: RUN.pending.type })")
                check(pre['ref'].get('grudge') == 1 and pre['ref']['rival'] == club and pre['type'] == 'rival' and 'grudge' in t, 'the next day they block the road: a rival grudge match, and the pre-game card says why', [pre, t])
                over = await play_win(pg)
                after = await pg.evaluate("({ g: WG.grudge, gold: RUN.gold, me: WG.league.me, log: WLOG.slice(-10).map(l => l[0]).join(' | ') })")
                check(over == 'win' and after['g'] is None and 'Grudge settled' in after['log'] and after['gold'] >= g0 + 60 and after['me']['w'] == 2, 'win the grudge match: settled, for gold and fans', after)

                # ---------- sell instead ----------
                await pg.evaluate("W_LEAGUE.grudgeP = 0")
                await pg.evaluate(f"__clear(); WG.wprompts.push({{ t: 'bid', club: {json.dumps(club)}, pid: {bench} }}); wNextPrompt()")
                await pg.wait_for_selector('#wBidSell')
                s0 = await pg.evaluate(f"({{ gold: RUN.gold, fee: W_LEAGUE.fee(wPlayer({bench}).lvl) }})")
                await pg.click('#wBidSell')
                s1 = await pg.evaluate(f"({{ gold: RUN.gold, gone: !wPlayer({bench}), g: WG.grudge }})")
                check(s1['gone'] and s1['gold'] == s0['gold'] + s0['fee'] and s1['g'] is None, 'sell: they leave, you get the fee, no grudge', [s0, s1])

                # ---------- the taunt and the revenge ----------
                tc = await pg.evaluate("""(() => { const club = wCupRival('moss'); WG.h2h[club] = { w: 0, l: 1, last: { r: 'lose', us: 1, them: 3, sport: 'golf', day: 1 } };
                  __clear(); __town('mossgate'); RUN.gold = 300; WG.cup = null; wCupEnter('moss');
                  return { club, rev: WG.cup && WG.cup.revenge, t: (document.querySelector('#modalBox .wtaunt') || {}).textContent || '', log: WLOG.slice(-4).map(l => l[0]).join(' | ') }; })()""")
                check(tc['rev'] == tc['club'] and 'round 3' in tc['t'] and 'sign-up' in tc['log'], 'enter the cup of a rival who beat you last: their captain taunts you, and round 3 is for revenge', tc)
                await pg.screenshot(path='/tmp/realm-league-taunt-desk.png')
                rv = await pg.evaluate("""(() => { document.querySelectorAll('#modalBox #wNotYet').forEach(b => b.click()); const club = WG.cup.revenge; WG.cup.round = 2; const g0 = RUN.gold;
                  W_ON_END.cup('win', { cup: 'moss', round: 2, club }, { region: 'bloom' }); return { log: WLOG.slice(-6).map(l => l[0]).join(' | '), gain: RUN.gold - g0, prize: W_CUP.prize.gold }; })()""")
                check('Revenge' in rv['log'] and rv['gain'] == rv['prize'] + 50, 'beat them in round 3: the revenge bonus on top of the prize', rv)
                document_close = await pg.evaluate("document.querySelectorAll('#modalBox [data-close]').forEach(b => b.click()); WG.cardOffer = null; true")
                saved = await pg.evaluate("(() => { wSave(); const s = JSON.parse(localStorage.getItem(pkey('sd-realm'))); return !!(s && s.WG && s.WG.league && s.WG.league.results.length); })()")
                check(saved, 'the league is saved with the journey')
                await pg.evaluate("renderHelp()")
                check(await pg.evaluate("!!document.getElementById('wHelpLeague')"), 'How to play explains the league and rivals')
            else:
                await pg.evaluate("(() => { wLeague(); for (let i = 0; i < 6; i++) wNewDay(); __town('graftonbury'); wRunAct('league', 'hq_inn'); })()")
                await pg.wait_for_selector('#modalBox .wlg')
                await pg.screenshot(path='/tmp/realm-league-table-phone.png')
                over = await pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
                check(not over, '[phone] the League table does not widen the page')

            sd = await pg.evaluate('window.__sdErrs || []')
            check(not sd, f'[{tag}] no __sdErrs', sd)
            await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    print('ok: realm league passed' if not FAILS else f'FAILED: {len(FAILS)} checks')
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
