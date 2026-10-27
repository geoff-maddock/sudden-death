# Realm phase 6, cups, rivals and the Crown: entering a town cup through its registrar starts round 1 (fee paid,
# the region's sports); a win leads to round 2 (an elite with a scouting trait), then round 3 against the cup's rival
# club in its colours; winning the cup sets cup_<id> and cupsN, pays the prize, goes on the wall, and wCupsWon() goes
# up; a loss knocks you out; the head-to-head record updates, shows on the pre-game card and the Camp, and survives a
# save and reload; the Crown refuses outside championship week or with fewer than four cups (and so does WAIT), and
# in championship week with four cups runs rival, rival, then an Apex final against an Act 3 boss, whose win sets
# 'champion' and shows the champion ending with Keep exploring. Asserts; exits nonzero on failure. Waits on state.
# Screenshots: /tmp/realm-cups-*.png at 1280x800.
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
'''
NOTIPS = "TIPS_SEEN.push(...Object.keys(TIPS))"
T = 30000

async def boot(pg, clear=False):
    if clear:
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
    await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof wStart === 'function' && !!document.getElementById('bNew')", timeout=T)
    await pg.add_script_tag(content=HELP)
    await pg.evaluate(NOTIPS)

async def new_journey(pg):
    await pg.click('#bNew')
    await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')", timeout=T)
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo', timeout=T)
    await pg.click('#wGo')
    await pg.wait_for_function("WG && RUN && UI.view === 'world'", timeout=T)

async def modal_text(pg):
    return await pg.evaluate("document.getElementById('modal').hidden ? null : document.getElementById('modalBox').textContent")

async def clear_prompts(pg):
    # level-up picks, recruits and prize cards queue up after wins; settle them so the next thing is the cup's
    # closing one panel can raise the next: a queued prompt (closed too), or the next round's card (left up for
    # next_round). Stop at the cup's card or when nothing is left.
    for _ in range(8):
        await pg.evaluate("WG.wprompts = []; WG.cardOffer = null")
        if await pg.evaluate("document.getElementById('modal').hidden || !!document.getElementById('wPlay')"): break
        await pg.evaluate("(document.querySelector('#modalBox [data-close]') || document.querySelector('#modalBox #wWake') || document.querySelector('#modalBox #wNotYet') || document.getElementById('modal')).click()")
        await pg.wait_for_timeout(50)
    await pg.wait_for_function("document.getElementById('modal').hidden || !!document.getElementById('wPlay')", timeout=T)
    await pg.evaluate("WG.wprompts = []; WG.cardOffer = null")

async def play_card(pg):
    """the pre-game card is open: read it and press Play"""
    await pg.wait_for_selector('#wPlay', timeout=T)
    txt = await modal_text(pg)
    await pg.click('#wPlay')
    await pg.wait_for_function("B && !B.over && B.phase === 'player' && UI.view === 'fight'", timeout=T)
    return txt

async def win(pg):
    await pg.wait_for_function("B && B.phase === 'player'", timeout=T)
    over = await pg.evaluate("(() => { RUN.maxhp = Math.max(RUN.maxhp, 400); RUN.hp = RUN.maxhp; for (const e of alive()) e.hp = Math.min(e.hp, 4); return __wbot(150); })()")
    await pg.evaluate('__wend()')
    await pg.wait_for_selector('#bCont', timeout=T)
    await pg.click('#bCont')
    await pg.wait_for_function("UI.view === 'world' || !document.getElementById('scr-end').hidden", timeout=T)
    return over

async def lose(pg):
    await pg.wait_for_function("B && B.phase === 'player'", timeout=T)
    over = await pg.evaluate('__wlose()')
    await pg.evaluate('__wend()')
    await pg.wait_for_function("UI.view === 'world' && !RUN.pending", timeout=T)
    await clear_prompts(pg)
    return over

async def next_round(pg):
    """after a won round: the next round's card comes up by itself once the world is free (at once when the win
    queued nothing; after the level-ups and card picks, which are settled here, when it did)"""
    if not await pg.evaluate("!!document.getElementById('wPlay')"):
        await clear_prompts(pg)
        await pg.evaluate("wDrain()")
    return await play_card(pg)

async def checks(pg):
    await pg.evaluate("RUN.gold = 500; WG.day = 1")
    rv = await pg.evaluate("WG.rivals")
    check(isinstance(rv, dict) and len(rv) == 4, 'four rival clubs are mapped', rv)

    # ---------- the Mosswold Cup, all three rounds ----------
    await pg.evaluate("wRunAct('cup:moss', 'moss_reg'); wDrain()")
    st = await pg.evaluate("({ cup: WG.cup, gold: RUN.gold })")
    check(st['cup'] and st['cup']['id'] == 'moss' and st['cup']['round'] == 0 and st['gold'] == 470, 'entering the Mosswold Cup through its registrar pays the fee and opens round 1', st)
    txt = await play_card(pg)
    check(txt and 'Mosswold Cup' in txt and 'Round 1 of 3' in txt, 'the pre-game card names the cup and the round', txt and txt[:300])
    r1 = await pg.evaluate("({ w: RUN.pending.world, type: B.type, sport: B.sport })")
    check(r1['w']['kind'] == 'cup' and r1['w']['ref']['cup'] == 'moss' and r1['w']['ref']['round'] == 0 and r1['type'] == 'normal', 'round 1 is a normal match, kind cup', r1)
    check(r1['sport'] in ['golf', 'jousting'], 'round 1 is played in a Mosswold sport', r1['sport'])
    over = await win(pg)
    s = await pg.evaluate("({ cup: WG.cup, view: UI.view })")
    check(over == 'win' and s['cup'] and s['cup']['round'] == 1 and s['view'] == 'world', 'winning round 1 moves you to round 2', s)

    txt = await next_round(pg)
    r2 = await pg.evaluate("({ type: B.type, trait: RUN.pending.trait || null, round: RUN.pending.world.ref.round, tier: RUN.pending.world.tier })")
    check(r2['type'] == 'elite' and r2['trait'] and r2['round'] == 1, 'round 2 is an elite with a scouting trait', r2)
    check(txt and 'Scouting report' in txt and 'Round 2 of 3' in txt, 'round 2\'s card shows the scouting report', txt and txt[:300])
    await win(pg)

    txt = await next_round(pg)
    club = rv['wildgraft']
    r3 = await pg.evaluate("({ type: B.type, club: RUN.pending.world.ref.club, team: B.enemies[0].team.short, lead: B.enemies[0].n })")
    want = await pg.evaluate(f"({{ short: CLUBS['{club}'].short, cap: CLUBS['{club}'].roster[0][0], name: CLUBS['{club}'].name }})")
    check(r3['type'] == 'rival' and r3['club'] == club and r3['team'] == want['short'], 'round 3 is a rivalry game against the cup\'s rival club, in its colours', [r3, want])
    check(txt and want['name'] in txt and 'First meeting' in txt, 'round 3\'s card names the club and says it is a first meeting', txt and txt[:300])
    await pg.screenshot(path='/tmp/realm-cups-round3.png')
    g0 = await pg.evaluate("RUN.gold")
    await win(pg)
    done = await pg.evaluate(f"""({{ cup: WG.cup, flags: ['cup_moss', 'cups1', 'cups2'].map(f => !!WG.flags[f]), won: wCupsWon(), h2h: WG.h2h && WG.h2h['{club}'],
      gold: RUN.gold, log: WLOG.slice(-12).map(l => l[0]).join(' | '), offer: !!WG.cardOffer }})""")
    check(done['cup'] is None and done['flags'] == [True, True, False] and done['won'] == 1, 'winning the cup sets cup_moss and cups1, and wCupsWon() is 1', done)
    check(done['gold'] >= g0 + 120 and 'Wall of Awards' in done['log'], 'the cup pays its prize and goes on the Wall of Awards', done)
    check(done['h2h'] and done['h2h']['w'] == 1 and done['h2h']['l'] == 0 and done['h2h']['last']['r'] == 'win', 'the head-to-head against the rival club records the win', done['h2h'])
    await clear_prompts(pg)
    wall = await pg.evaluate("wRunAct('wall', 'steward'); WLOG[WLOG.length - 1][0]")
    check('Mosswold Cup (year 1)' in wall, 'the wall lists the cup and its year', wall)
    again = await pg.evaluate("wCupProblem('moss')")
    check('already on your wall' in again, 'a cup you hold cannot be entered again', again)

    # ---------- a loss knocks you out (round 3 of Brinefen, so the rival record takes the loss) ----------
    await pg.evaluate("WG.cup = { id: 'salt', round: 2 }; wCupPlay({ card: false })")
    salt = rv['cauldron']
    await pg.wait_for_function("B && RUN.pending && RUN.pending.world.kind === 'cup'", timeout=T)
    await lose(pg)
    ko = await pg.evaluate(f"({{ cup: WG.cup, flag: !!WG.flags.cup_salt, won: wCupsWon(), h2h: WG.h2h['{salt}'], blackouts: WG.blackouts, log: WLOG.slice(-6).map(l => l[0]).join(' | ') }})")
    check(ko['cup'] is None and not ko['flag'] and ko['won'] == 1 and 'Knocked out' in ko['log'], 'a loss knocks you out of the cup, and it is not won', ko)
    check(ko['h2h'] and ko['h2h']['l'] == 1 and ko['h2h']['last']['r'] == 'lose' and ko['blackouts'] >= 1, 'the rival record takes the loss, and you black out as usual', ko)
    # they remember on the next card
    await pg.evaluate("RUN.gold = 500; WG.cup = { id: 'salt', round: 2 }; wCupPlay(); wDrain()")
    await pg.wait_for_selector('#wNotYet', timeout=T)
    txt = await modal_text(pg)
    check(txt and 'They remember last time: they won' in txt and 'Head to head: 0–1' in txt, 'the pre-game card remembers the last game against that rival', txt and txt[:400])
    await pg.click('#wNotYet')
    await pg.wait_for_function("document.getElementById('modal').hidden", timeout=T)
    check(await pg.evaluate("WG.cup && WG.cup.id === 'salt' && !RUN.pending"), 'Not yet keeps your place in the cup')
    reenter = await pg.evaluate("(() => { WG.cup = null; const g = RUN.gold; wCupEnter('salt', { card: false }); return { g: g - RUN.gold, cup: WG.cup, kind: RUN.pending && RUN.pending.world.kind }; })()")
    check(reenter['g'] == 30 and reenter['cup']['round'] == 0 and reenter['kind'] == 'cup', 'after a knockout you can pay and enter again, from round 1', reenter)
    await lose(pg)

    # ---------- the Camp shows the head to head; it survives save and reload ----------
    camp = await pg.evaluate("wCampTeam()")
    check('Head to head' in camp and 'Mosswold Cup' in camp, 'the Camp shows cups and the head-to-head record', camp[-400:])
    h_before = await pg.evaluate("JSON.stringify(WG.h2h)")
    await pg.evaluate("wSave()")
    await pg.reload()
    await pg.wait_for_selector('#bResume', timeout=T)
    await pg.click('#bResume')
    await pg.wait_for_function("WG && UI.view === 'world'", timeout=T)
    await pg.add_script_tag(content=HELP); await pg.evaluate(NOTIPS)
    await clear_prompts(pg)
    h_after = await pg.evaluate("JSON.stringify(WG.h2h)")
    check(h_before == h_after and json.loads(h_after), 'head-to-head records survive a save and reload', [h_before, h_after])

    # ---------- the Crown: refusals ----------
    ref = await pg.evaluate("""(() => { WG.day = 1; const o = {};
      wRunAct('cup:crown', 'steward'); o.few = { cup: WG.cup, pending: !!RUN.pending, log: WLOG[WLOG.length - 1][0] };
      wRunAct('waitweek', 'steward'); o.wait = { day: WG.day, log: WLOG[WLOG.length - 1][0] };
      WG.day = DB.meta.yearDays; o.weekFew = wCupProblem('crown');
      WG.day = 1; for (const c of ['cup_salt', 'cup_cind', 'cup_rime', 'cups2', 'cups3', 'cups4']) wSetFlag(c);
      wRunAct('cup:crown', 'steward'); o.early = { cup: WG.cup, pending: !!RUN.pending, log: WLOG[WLOG.length - 1][0] };
      wRunAct('waitweek', 'steward'); o.waited = { week: wChampWeek(), day: WG.day };
      return o; })()""")
    check(ref['few']['cup'] is None and not ref['few']['pending'] and 'Four regional cups' in ref['few']['log'], 'the Crown refuses with fewer than four cups', ref['few'])
    check(ref['wait']['day'] == 1 and 'four cups' in ref['wait']['log'], 'the steward\'s WAIT is for teams with four cups', ref['wait'])
    check('Four regional cups' in ref['weekFew'], 'in championship week, fewer than four cups is still refused', ref['weekFew'])
    check(ref['early']['cup'] is None and not ref['early']['pending'] and 'championship week' in ref['early']['log'], 'with four cups, the Crown refuses outside championship week', ref['early'])
    check(ref['waited']['week'], 'with four cups, WAIT takes you to championship week', ref['waited'])

    # ---------- the Crown: rival, rival, then Apex with an Act 3 boss ----------
    await pg.evaluate("wRunAct('cup:crown', 'steward'); wDrain()")
    txt = await play_card(pg)
    c1 = await pg.evaluate("({ cup: WG.cup, type: B.type, tier: RUN.pending.world.tier, club: RUN.pending.world.ref.club })")
    check(c1['cup']['id'] == 'crown' and c1['type'] == 'rival' and c1['tier'] == 3 and c1['club'] == c1['cup']['clubs'][0], 'the Crown opens with a rival club at tier 3', c1)
    check(c1['cup']['clubs'][0] == salt, 'the rival with the best record against you comes first', [c1['cup']['clubs'], salt])
    check(txt and 'The Crown' in txt, 'the card says The Crown', txt and txt[:200])
    await win(pg)
    await next_round(pg)
    c2 = await pg.evaluate("({ type: B.type, club: RUN.pending.world.ref.club, clubs: WG.cup.clubs })")
    check(c2['type'] == 'rival' and c2['club'] == c2['clubs'][1], 'round 2 of the Crown is the second rival', c2)
    await win(pg)
    txt = await next_round(pg)
    c3 = await pg.evaluate("({ type: B.type, bosses: B.enemies.filter(e => ENEMIES[e.id].boss).map(e => e.id), act3: ENCOUNTERS[2].boss, club: RUN.pending.world.ref.club })")
    check(c3['type'] == 'boss' and c3['club'] == 'apex' and any(b in c3['act3'] for b in c3['bosses']), 'the final is Apex Athletic with a Sudden Death Act 3 boss', c3)
    check(txt and 'the final' in txt and 'Apex Athletic' in txt, 'the final\'s card names Apex Athletic', txt and txt[:300])
    await pg.screenshot(path='/tmp/realm-cups-final.png')
    await win(pg)
    await pg.wait_for_function("!document.getElementById('scr-end').hidden", timeout=T)
    end = await pg.evaluate("""({ champ: !!WG.flags.champion, h2: document.querySelector('#scr-end h2').textContent, btn: document.getElementById('bAgain').textContent,
      title: !!document.getElementById('wEndTitle'), apex: WG.h2h.apex, crowns: WG.crowns, cup: WG.cup })""")
    check(end['champ'] and end['h2'] == 'Champions of the realm' and end['cup'] is None, 'winning the final sets champion and shows the champion ending', end)
    check(end['btn'] == 'Keep exploring' and end['title'] and end['apex']['w'] == 1 and end['crowns'] == [1], 'the ending offers Keep exploring, and the Apex record is kept', end)
    await pg.screenshot(path='/tmp/realm-cups-champion.png')
    await pg.click('#bAgain')
    await pg.wait_for_function("UI.view === 'world' && WG && WG.flags.champion", timeout=T)
    check(True, 'Keep exploring goes back to the world with the save intact')
    check('hold the crown' in await pg.evaluate("wCupProblem('crown')"), 'the crown is won once a year')

    # ---------- the road rival is one of yours ----------
    ev = await pg.evaluate("""(() => { WG.event = null; wRoadEvent('rival'); const r = WG.event && WG.event.rival; return { r, ok: Object.values(WG.rivals).includes(r) }; })()""")
    check(ev['ok'], 'the road\'s rival event is one of your rival clubs', ev)
    await clear_prompts(pg)
    await pg.evaluate("WG.event = null")

    # ---------- help ----------
    await pg.evaluate("showPage('help')")
    check(await pg.evaluate("!!document.getElementById('wHelpCups') && ['Town cups', 'Rivals', 'The Crown'].every(s => document.getElementById('wHelpCups').textContent.includes(s))"), 'How to play explains cups, rivals and the Crown')
    await pg.evaluate("showPage('play')")

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs = []
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await boot(pg, clear=True)
        await new_journey(pg)
        await checks(pg)
        sd = await pg.evaluate('window.__sdErrs || []')
        check(not sd, 'no __sdErrs', sd)
        await ctx.close()
        check(not errs, 'no page errors', errs)
        await b.close()
    if FAILS:
        print('FAILED:', len(FAILS), 'checks'); sys.exit(1)
    print('ok: realm cups passed')

asyncio.run(main())
