# Realm adventures, phase 1 (issue #47): the plumbing. Throwaway adventures registered at runtime (no story ships in
# this phase) check: the profile store (corrupt data reads as empty; other profiles keep their own), starting from the
# right conversation (and not restarting), visit and talk steps with adventure items kept off the journey's bag, the
# any-order chapter, chapter pay, matches with conditions in the card game and baseball (a tie fails, a stale result
# is ignored), the pinnacle warning and a pinnacle loss that survives a reload and a new journey, the choice step, a
# superstar feat from an ending, the reward character recruited again on a new journey, the journal's Adventures tab,
# the Bag, rumours and How to play. Asserts; exits nonzero on failure.
import asyncio, json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

FAILS = []
def check(ok, what, detail=None):
    print(('ok   ' if ok else 'FAIL ') + what + ('' if ok or detail is None else ': ' + json.dumps(detail)[:600]))
    if not ok: FAILS.append(what)
    return ok

CLOSE_ALL = """(() => { for (let i = 0; i < 12 && !document.getElementById('modal').hidden; i++) {
  const b = document.getElementById('wAdvNo') || document.querySelector('#modalBox [data-close]') || document.querySelector('#modalBox button'); if (!b) break; b.click(); } WG.cardOffer = null; })()"""
WIN = r'''(() => { RUN.maxhp = Math.max(RUN.maxhp, 900); RUN.hp = RUN.maxhp; let g = 0;
  while (B && !B.over && g++ < 160) { let k = 0; while (B.phase === 'player' && !B.over && k++ < 30) { const al = alive(); if (!al.length) break; const t = al.slice().sort((a, b) => a.hp - b.hp)[0];
    const i = B.hand.findIndex(c => canPlay(c) && def(c).type === 'atk'), j = i >= 0 ? i : B.hand.findIndex(c => canPlay(c) && def(c).type !== 'junk' && def(c).type !== 'curse'); if (j < 0) break; playCard(j, B.enemies.indexOf(t)); }
    if (B.over) break; for (const e of alive()) e.hp = Math.max(1, Math.floor(e.hp * .4)); runSteps(endTurn()); }
  consumeFx(); renderFightHUD(); finishFight(); return UI.view; })()'''

# the throwaway adventures (registered again after every page load)
TEST_ADV = r"""(() => { if (wAdv('adv_t1')) return;
  W_ADV_ITEMS.adv_tok = { n: 'Test Token', d: 'A token.' };
  W_ADV.push({ id: 'adv_t1', title: 'Test One', teaser: 'A test.', regions: ['hq', 'tide'], rumours: ['Foss has been asking odd questions.'],
    starter: { who: 'clerk', kw: 'testcase', t: 'Funny you should ask.', learn: 'Foss has a job.' }, lostText: 'Test One went wrong.',
    chapters: [
      { t: 'The token', sum: 'Find the token.', pay: { gold: 30 }, steps: [
        { k: 'visit', loc: 'saltmere', give: { adv_tok: 1 }, learn: 'Found a token.' },
        { k: 'talk', who: 'rowe', kw: 'token', take: { adv_tok: 1 }, t: 'Ah, my token.' }] },
      { t: 'The games', sum: 'Win two games.', steps: [
        { k: 'match', who: 'clerk', kw: 'friendly', engine: 'card', tier: 1, ids: ['cheer', 'cheer'], cond: { margin: 1 }, win: 'Well played.', lose: 'Try again.' },
        { k: 'match', who: 'clerk', kw: 'diamond', engine: 'ball', tier: 1, club: 'local', win: 'Nice.', lose: 'Again.' }] },
      { t: 'Two questions', sum: 'Either order.', any: true, steps: [
        { k: 'talk', who: 'rowe', kw: 'alpha', t: 'Alpha.' }, { k: 'talk', who: 'clerk', kw: 'beta', t: 'Beta.' }] },
      { t: 'The verdict', sum: 'Choose.', steps: [
        { k: 'choice', who: 'clerk', kw: 'verdict', q: 'Who?', opts: ['A', 'B', 'C'], right: 1, pinnacle: true, win: 'Right.', lose: 'Wrong.' }] }],
    end: { t: 'Done.', pay: { gold: 50 }, unlock: { at: 'rowe', kw: 'veteran', recruit: { kind: 'dwarf', n: 'Old Testa' }, t: 'Testa joins.' } } });
  W_ADV.push({ id: 'adv_t2', title: 'Test Two', starter: { who: 'rowe', kw: 'starquest', t: 'Stars.' },
    chapters: [{ t: 'One', steps: [{ k: 'talk', who: 'rowe', kw: 'finish', t: 'Finished.' }] }], end: { t: 'Done.', feat: 'djinn' } });
  W_ADV.push({ id: 'adv_t3', title: 'Test Three', starter: { who: 'clerk', kw: 'grudge', t: 'A grudge.' }, lostText: 'It ended badly.',
    chapters: [{ t: 'One', steps: [{ k: 'match', who: 'clerk', kw: 'showdown', engine: 'card', tier: 1, ids: ['cheer', 'cheer'], pinnacle: true, win: 'Won.', lose: 'Lost.' }] }] });
})()"""
ST = "((id) => { const A = wAdvState(id); return A && { st: A.st, ch: A.ch, done: A.done, items: A.items, why: A.why || '' }; })"
def st(i): return f"{ST}('{i}')"
SET = "((id, o) => { const S = wAdvAll(); S.a[id] = Object.assign({ st: 'active', ch: 0, done: [], items: {}, learned: [], since: '2026-11-06' }, o); wAdvSave(S); })"

async def new_journey(pg, clear=False):
    await pg.goto(REALM_URL)
    if clear: await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
    await pg.wait_for_function("typeof W_ADV !== 'undefined'")
    await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS))")
    await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
    if await pg.evaluate("!!document.getElementById('cfYes')"):
        await pg.click('#cfYes')
    await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
    await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
    await pg.evaluate(TEST_ADV)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1200, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await new_journey(pg, clear=True)
        check(await pg.evaluate("W_ADV.length === 3 && W_ADV_CFG.key === 'sd-realm-adv'"), 'the test adventures are registered (the game ships none)')

        # ---------- the store ----------
        r = await pg.evaluate("(() => { localStorage.setItem(wAdvKey(), '{bad'); let ok = true, v; try { v = wAdvAll(); } catch (e) { ok = String(e); } localStorage.removeItem(wAdvKey()); return { ok, v }; })()")
        check(r['ok'] is True and r['v'] == {'a': {}, 'rec': {}}, 'corrupt adventure data reads as empty', r)
        r = await pg.evaluate(f"(() => {{ const a = wAdvBegin('adv_t1'), b = wAdvBegin('adv_t1'); return {{ a, b, s: {st('adv_t1')}, live: wAdvLive('adv_t1').map(L => L.si) }}; }})()")
        check(r['a'] and not r['b'] and r['s']['st'] == 'active' and r['s']['ch'] == 0 and r['live'] == [0], 'an adventure begins once, at chapter 0, step 0', r)
        r = await pg.evaluate(f"(() => {{ const g0 = RUN.gold; wAdvDone('adv_t1', 0); const a = {st('adv_t1')}, bag = !!WG.items.adv_tok; wAdvDone('adv_t1', 1); return {{ a, bag, b: {st('adv_t1')}, gold: RUN.gold - g0 }}; }})()")
        check(r['a']['items'] == {'adv_tok': 1} and not r['bag'], 'a found item is kept on the profile, not in the journey\'s bag', r)
        check(r['b']['ch'] == 1 and r['b']['items'] == {} and r['gold'] == 30, 'handing it over finishes the chapter, which pays 30 gold', r)
        r = await pg.evaluate(f"(() => {{ PROFILES.cur = 'advB'; const other = wAdvState('adv_t1'); PROFILES.cur = 'guest'; return {{ other, back: {st('adv_t1')} }}; }})()")
        check(r['other'] is None and r['back']['ch'] == 1, 'another profile has its own adventures', r)
        r = await pg.evaluate(f"(() => {{ wAdvBegin('adv_t2'); wAdvDone('adv_t2', 0); return {{ s: {st('adv_t2')}, star: wStarOn('djinn') }}; }})()")
        check(r['s']['st'] == 'won' and r['star'], 'an ending can be a superstar\'s feat (the Djinn unlocks)', r)

        # ---------- talk, visits, starting ----------
        await pg.evaluate("localStorage.removeItem(wAdvKey())")
        r = await pg.evaluate("(() => { const a = wSay('clerk', 'friendly'); return { t: a.text, act: a.act || '' }; })()")
        check(r['t'] != 'Well played.' and not r['act'].startswith('adv:'), 'a step\'s keyword says nothing before the adventure reaches it', r)
        r = await pg.evaluate(f"(() => {{ const a = wSay('clerk', 'testcase').text; return {{ a, s: {st('adv_t1')} }}; }})()")
        check(r['a'] == 'Funny you should ask.' and r['s']['st'] == 'active', 'the right conversation starts it', r)
        r = await pg.evaluate(f"(() => {{ wAdvDone('adv_t1', 0); wSay('clerk', 'testcase'); return {st('adv_t1')}; }})()")
        check(r['done'] == [0], 'asking again doesn\'t start it over', r)
        await pg.evaluate(f"{SET}('adv_t1', {{}})")
        r = await pg.evaluate(f"(() => {{ const m = MAPS.saltmere; wEnterMap('saltmere', m.spawn[0], m.spawn[1]); return {st('adv_t1')}; }})()")
        check(r['done'] == [0] and r['items'] == {'adv_tok': 1}, 'going to Saltmere does the visit step and finds the token', r)
        r = await pg.evaluate(f"(() => {{ const t = wSay('rowe', 'toke').text; return {{ t, s: {st('adv_t1')} }}; }})()")
        check(r['t'] == 'Ah, my token.' and r['s']['ch'] == 1, 'a talk step answers to the first four letters too', r)
        r = await pg.evaluate("wSay('clerk', 'friendly').act")
        check(r == 'adv:adv_t1:0', 'a live match step offers the game', r)
        r = await pg.evaluate(f"(() => {{ {SET}('adv_t1', {{ ch: 2 }}); wSay('clerk', 'beta'); const a = {st('adv_t1')}; wSay('rowe', 'alpha'); return {{ a, b: {st('adv_t1')} }}; }})()")
        check(r['a']['done'] == [1] and r['b']['ch'] == 3, 'an any-order chapter takes its steps in either order', r)
        r = await pg.evaluate(f"""(() => {{ {SET}('adv_t1', {{ st: 'won', ch: 4 }}); const n0 = wRoster().length, a = wSay('rowe', 'veteran').text, n1 = wRoster().length, b = wSay('rowe', 'veteran').text;
          return {{ a, b, add: n1 - n0, again: wRoster().length - n1, testa: wRoster().some(p => p.n === 'Old Testa') }}; }})()""")
        check(r['a'] == 'Testa joins.' and r['add'] == 1 and r['again'] == 0 and r['testa'], 'the reward character joins once a journey', r)
        await pg.evaluate("wSave()")
        await new_journey(pg)
        r = await pg.evaluate(f"(() => {{ const s = {st('adv_t1')}, had = wRoster().some(p => p.n === 'Old Testa'); wSay('rowe', 'veteran'); return {{ s, had, now: wRoster().some(p => p.n === 'Old Testa') }}; }})()")
        check(r['s']['st'] == 'won' and not r['had'] and r['now'], 'a new journey keeps the finished adventure, and the reward character joins again', r)

        # ---------- matches ----------
        await pg.evaluate(f"{SET}('adv_t1', {{ ch: 1 }})")
        r = await pg.evaluate("(() => { wRunAct('adv:adv_t1:0', 'clerk'); const b = document.getElementById('modalBox'); return { open: !!document.getElementById('wAdvPlay'), cond: b.textContent.includes('Win by at least 1.'), warn: !!document.getElementById('wAdvWarn') }; })()")
        check(r['open'] and r['cond'] and not r['warn'], 'the match card lists the conditions, with no warning for an ordinary game', r)
        r = await pg.evaluate(f"(() => {{ document.getElementById('wAdvNo').click(); return {{ open: !document.getElementById('modal').hidden, s: {st('adv_t1')}, b: !!B && !B.over && UI.view === 'fight' }}; }})()")
        check(not r['open'] and r['s']['done'] == [] and not r['b'], '"Not yet" isn\'t an attempt', r)
        await pg.evaluate("(() => { wRunAct('adv:adv_t1:0', 'clerk'); document.getElementById('wAdvPlay').click(); })()")
        r = await pg.evaluate("({ fight: !!B && !B.over, kind: RUN.pending && RUN.pending.world.kind, ref: RUN.pending && RUN.pending.world.ref })")
        check(r['fight'] and r['kind'] == 'adv' and r['ref'] == 'adv_t1:1:0', 'Play starts the card game as an adventure match', r)
        view = await pg.evaluate(WIN)
        check(view == 'panel', 'the adventure match is won', view)
        await pg.click('#bCont'); await pg.wait_for_function("UI.view === 'world'")
        r = await pg.evaluate(f"(() => {{ const g = RUN.games[RUN.games.length - 1]; return {{ us: g.us, them: g.them, s: {st('adv_t1')} }}; }})()")
        check((r['us'] - r['them'] >= 1) == (r['s']['done'] == [0]), 'a win meeting the margin does the step (and one short of it doesn\'t)', r)
        r = await pg.evaluate(f"(() => {{ {SET}('adv_t1', {{ ch: 1 }}); RUN.games.push({{ us: 3, them: 3, sport: 'soccer' }}); W_ON_END.adv('win', 'adv_t1:1:0', {{ kind: 'adv' }}); return {st('adv_t1')}; }})()")
        check(r['done'] == [] and r['st'] == 'active', 'a win short of the margin doesn\'t count, and it can be tried again', r)
        r = await pg.evaluate(f"(() => {{ {SET}('adv_t1', {{ ch: 1, done: [0] }}); W_ON_END.adv('tie', 'adv_t1:1:1', {{ kind: 'adv', us: 2, them: 2 }}); return {st('adv_t1')}; }})()")
        check(r['done'] == [0] and r['st'] == 'active', 'a tie is a failure, not a pass or a crash', r)
        r = await pg.evaluate(f"(() => {{ W_ON_END.adv('win', 'adv_t1:0:0', {{ kind: 'adv' }}); return {st('adv_t1')}; }})()")
        check(r['ch'] == 1 and r['done'] == [0], 'a result for another chapter is ignored', r)
        await pg.evaluate("(() => { while (wRoster().length < 5) wAddPlayer(wMakePlayer({ kind: 'dwarf' }, 'tavern')); })()")
        r = await pg.evaluate(f"""(() => {{ const out = []; for (let i = 0; i < 8; i++) {{ const why = wAdvStartMatch('adv_t1', 1, 'sim'); WG.ball && WG.ball.met && (WG.ball.met.local = -1);
            if (WG.gfg) WG.gfg.met = {{}}; out.push(why); const b = document.querySelector('#modalBox [data-close], #modalBox .btn'); if (b) b.click(); if ({st('adv_t1')}.ch === 2) break; }}
          return {{ out, s: {st('adv_t1')} }}; }})()""")
        check(r['s']['ch'] == 2, 'a simulated baseball game settles through the adventure (a win moves on)', r)
        await pg.evaluate(CLOSE_ALL)

        # ---------- a pinnacle ----------
        await pg.evaluate("wSay('clerk', 'grudge')")
        r = await pg.evaluate("(() => { wRunAct(wSay('clerk', 'showdown').act, 'clerk'); const w = document.getElementById('wAdvWarn'); return w && w.textContent; })()")
        check(r == "This can't be retried.", 'a pinnacle game warns plainly that it can\'t be retried', r)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate(f"(() => {{ W_ON_END.adv('lose', 'adv_t3:0:0', {{ kind: 'adv' }}); const s = {st('adv_t3')}; const act = wSay('clerk', 'showdown').act || ''; return {{ s, act }}; }})()")
        check(r['s']['st'] == 'lost' and r['s']['why'] == 'Lost.' and not r['act'].startswith('adv:'), 'losing a pinnacle loses the adventure, and the game is gone', r)
        await pg.evaluate("wSave()")
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof W_ADV !== 'undefined' && !!document.getElementById('bResume')")
        await pg.click('#bResume')
        await pg.wait_for_function("UI.view === 'world' && !!WG")
        await pg.evaluate(TEST_ADV)
        r = await pg.evaluate(f"(() => {{ wSay('clerk', 'grudge'); return {st('adv_t3')}; }})()")
        check(r['st'] == 'lost', 'a reload doesn\'t undo a pinnacle, and asking again doesn\'t restart it', r)

        # ---------- the choice ----------
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate(f"""(() => {{ {SET}('adv_t1', {{ ch: 3 }}); const g0 = RUN.gold; wRunAct(wSay('clerk', 'verdict').act, 'clerk');
          const n = document.querySelectorAll('[data-advopt]').length, warn = !!document.getElementById('wAdvWarn'); document.querySelector('[data-advopt="1"]').click();
          return {{ n, warn, s: {st('adv_t1')}, gold: RUN.gold - g0 }}; }})()""")
        check(r['n'] == 3 and r['warn'] and r['s']['st'] == 'won' and r['gold'] == 50, 'the right answer finishes the adventure and pays the ending', r)
        r = await pg.evaluate(f"""(() => {{ {SET}('adv_t1', {{ ch: 3 }}); wRunAct(wSay('clerk', 'verdict').act, 'clerk'); document.querySelector('[data-advopt="0"]').click(); return {st('adv_t1')}; }})()""")
        check(r['st'] == 'lost' and r['why'] == 'Wrong.', 'a wrong answer at a pinnacle loses it', r)

        # ---------- the journal, the Bag, rumours, How to play ----------
        await pg.evaluate(CLOSE_ALL)
        await pg.evaluate(f"(() => {{ {SET}('adv_t1', {{ ch: 1, items: {{ adv_tok: 1 }} }}); {SET}('adv_t2', {{ st: 'won', ch: 1 }}); }})()")
        r = await pg.evaluate("""(() => { wOpenJournal(); document.querySelector('[data-jadv]').click(); const t = document.getElementById('wJBody').textContent;
          const n = document.querySelector('[data-jadv] small').textContent; document.querySelector('[data-jtab=\"people\"]').click(); const back = document.getElementById('wJBody').textContent !== t;
          return { t, n, back }; })()""")
        check(all(w in r['t'] for w in ['Under way', 'Finished', 'Ended badly', 'Test One', 'Test Two', 'Test Three', 'It ended badly.', 'Win by at least 1.']), 'the Adventures tab shows under way, finished and ended badly', r)
        check(r['n'] == '1' and r['back'], 'the tab counts the active adventures, and the other tabs still work', r)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("(() => { wOpenCamp('bag'); const e = document.getElementById('wBagAdv'); return e ? e.textContent : ''; })()")
        check('Test Token' in r and 'Test One' in r, 'the Bag lists the profile\'s adventure items', r)
        await pg.evaluate(CLOSE_ALL)
        r = await pg.evaluate("""(() => { PROFILES.cur = 'advC'; const a = wSay('hq_inn', 'rumours'); const n0 = WLOG.length; wRunAct(a.act, 'hq_inn'); const said = WLOG.slice(n0).map(l => l[0]).join(' ');
          wAdvBegin('adv_t1'); wAdvBegin('adv_t2'); wAdvBegin('adv_t3'); const n1 = WLOG.length; wRunAct('advrumour', 'hq_inn'); const quiet = WLOG.slice(n1).map(l => l[0]).join(' '); PROFILES.cur = 'guest'; return { act: a.act, said, quiet }; })()""")
        check(r['act'] == 'advrumour' and 'Foss has been asking odd questions.' in r['said'], 'an innkeeper passes on a rumour pointing at an adventure', r)
        check('Nothing worth repeating.' in r['quiet'], 'with every adventure started, there\'s nothing to repeat', r)
        r = await pg.evaluate("(() => { renderHelp(); const e = document.getElementById('wHelpAdventures'); return e ? e.textContent : ''; })()")
        check("can't" in r and 'RUMOURS' in r and 'Test' not in r, 'How to play explains adventures without naming any', r)
        check(not errs, 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
