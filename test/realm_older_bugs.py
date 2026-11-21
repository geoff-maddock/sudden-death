# Older bugs found during the pets work (issue #107), each fixed in Sudden Death's code (so both builds) or the Realm's:
# 1. a card drag the game has moved on from (Escape, the end of the turn) ends at once, with no pointer event, so a card
#    let go outside the frame never hangs there; a drop let go outside the page plays nothing;
# 2. a second finger is ignored while a drag is live, its press and its tap, until the first lifts;
# 3. one Escape closes one window: a window opened over another takes its Escape off, and its close() leaves the
#    window on screen alone; its onClose runs only by its own close(), so a card pick covered for a moment comes back;
# 4. click to walk squeezes past a person who wanders into the only way through, and walks round one who doesn't.
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

ESC = "document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));"

async def main():
    subprocess.run(REALM_BUILD, cwd=ROOT, check=True, capture_output=True)
    async with async_playwright() as p:
        br = await p.chromium.launch()
        pg = await br.new_page(viewport={'width': 1280, 'height': 1000})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' else None)
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()')
        await pg.goto(REALM_URL); await pg.wait_for_function("typeof modal === 'function' && typeof wPathStep === 'function'")
        await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.sfx = false; SET.music = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo')
        await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")

        # 3. stacked windows
        md = await pg.evaluate("""(async () => { const tick = () => new Promise(r => setTimeout(r, 30)), shut = () => document.getElementById('modal').hidden, out = {};
          let a = 0, b = 0, c = 0;
          modal('<p>A</p>', () => a++); modal('<p>B</p>', () => b++); """ + ESC + """ out.one = { shut: shut(), a, b }; await tick(); out.later = { a, b };
          """ + ESC + """ await tick(); out.again = { a, b };
          a = b = 0; const closeA = modal('<p>A</p>', () => a++); modal('<p>B</p>', () => b++); closeA(); out.stale = { shut: shut(), a, b };
          """ + ESC + """ await tick(); out.stale2 = { shut: shut(), a, b };
          a = b = c = 0; modal('<p>A</p>', () => a++); modal('<p>B</p>', () => { b++; modal('<p>C</p>', () => c++); }); """ + ESC + """ await tick();
          out.chain = { shut: shut(), a, b, c, text: document.getElementById('modalBox').textContent }; """ + ESC + """ await tick(); out.chain2 = { shut: shut(), a, b, c };
          a = 0; let yes = 0; modal('<p>A</p>', () => a++); askConfirm('Sure?', 'Really.', 'Yes', () => yes++); document.getElementById('cfYes').click(); await tick(); out.confirm = { shut: shut(), a, yes };
          // (a card pick covered by another window is set aside and comes back once that one closes: covering it isn't declining it)
          if (UI.paused) closePause(); // (an Escape above, with nothing open, paused the game: the pick waits for a free world)
          WG.cardOffer = { list: wCardOffer({}), why: 'a test', pid: wRoster()[0].id }; wShowCardOffer(); wOpenBallCard(); const offer = WG.cardOffer;
          document.querySelector('#modalBox [data-close]').click(); await new Promise(r => setTimeout(r, 800));
          out.buried = { kept: !!WG.cardOffer && WG.cardOffer === offer, back: !shut() && /card/i.test(document.querySelector('#modalBox h3').textContent) };
          WG.cardOffer = null; for (let k = 0; k < 4 && !shut(); k++) """ + ESC + """
          return out; })()""")
        check(md['one'] == {'shut': True, 'a': 0, 'b': 1} and md['later'] == {'a': 0, 'b': 1} and md['again'] == {'a': 0, 'b': 1}, 'one Escape closes the window on top; the one it replaced keeps its onClose to itself, and no later Escape runs it', md)
        check(md['stale'] == {'shut': False, 'a': 1, 'b': 0} and md['stale2'] == {'shut': True, 'a': 1, 'b': 1}, 'a replaced window\'s close() runs its onClose but leaves the window on screen alone', md)
        check(md['chain'] == {'shut': False, 'a': 0, 'b': 1, 'c': 0, 'text': 'C'} and md['chain2'] == {'shut': True, 'a': 0, 'b': 1, 'c': 1}, 'a window opened as another closes is the one the next Escape closes', md)
        check(md['confirm'] == {'shut': True, 'a': 0, 'yes': 1}, 'a confirm over a window: Yes does its thing, and nothing else runs', md)
        check(md.get('buried') == {'kept': True, 'back': True}, 'a card pick covered by another window comes back when that one closes, still waiting', md)

        # 1 and 2. card drags
        dr = await pg.evaluate("""(async () => { const out = {}, wait = ms => new Promise(r => setTimeout(r, ms));
          if (UI.paused) closePause(); RUN.pet = null; beginFight({ ids: ['skelss'], type: 'normal', sport: 'baseball' }); B.enemies[0].hp = B.enemies[0].max = 999; B.energy = 30; renderHand();
          const card = i => document.querySelector('#hand .card[data-i="' + i + '"]'), at = el => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
          const down = (el, pid, o) => { const [x, y] = at(el); el.dispatchEvent(new PointerEvent('pointerdown', Object.assign({ clientX: x, clientY: y, button: 0, bubbles: true, pointerId: pid }, o || {}))); return [x, y]; };
          const move = (x, y, pid, o) => window.dispatchEvent(new PointerEvent('pointermove', Object.assign({ clientX: x, clientY: y, pointerId: pid }, o || {})));
          const upE = (x, y, pid) => window.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: pid }));
          // (played: the card held is no longer in the hand)
          let held = null; const grab = i => { held = B.hand[i]; return card(i); }, gone = () => B.hand.includes(held) ? 0 : 1;
          // (a second finger, mid-drag: its press and tap on another card change nothing; the first finger's drop plays)
          let [x, y] = down(grab(1), 1); move(x, y - 150, 1); const sel = UI.sel;
          down(card(0), 2); upE(0, 0, 2); card(0).click(); out.second = { sel, after: UI.sel };
          upE(x, y - 300, 1); out.played = gone(); await wait(30);
          // (Escape mid-drag, the pointer away: the card comes back with no pointer event)
          [x, y] = down(grab(1), 3, { pointerType: 'mouse', buttons: 1 }); move(x, y - 150, 3, { pointerType: 'mouse', buttons: 1 }); const live = card(1).classList.contains('drag');
          """ + ESC + """ await wait(400); out.escape = { live, drag: !!document.querySelector('#hand .card.drag'), now: DRAG_NOW, sel: UI.sel, paused: !!UI.paused };
          upE(x, y - 300, 3); out.escapePlayed = gone();
          // (the end of the turn mid-drag ends it too)
          [x, y] = down(card(0), 4); move(x, y - 150, 4); UI.acts = (UI.acts || 0) + 1; await wait(400); out.acted = { drag: !!document.querySelector('#hand .card.drag'), now: DRAG_NOW };
          // (let go outside the page: nothing played)
          [x, y] = down(grab(0), 5); move(x, y - 150, 5); upE(x, -40, 5); out.outside = { played: gone(), sel: UI.sel, now: DRAG_NOW };
          // (and a plain drag still plays)
          [x, y] = down(grab(0), 6); move(x, y - 150, 6); upE(x, y - 300, 6); out.plain = gone();
          B = null; showView('world'); return out; })()""")
        check(dr['second'] == {'sel': 1, 'after': 1} and dr['played'] == 1, 'a second finger mid-drag is ignored, its press and its tap; the first finger\'s drop still plays', dr)
        check(dr['escape'] == {'live': True, 'drag': False, 'now': None, 'sel': -1, 'paused': False} and dr['escapePlayed'] == 0 and dr['acted'] == {'drag': False, 'now': None}, 'a drag the game has moved on from (Escape, an action) ends by itself, with no pointer event, and plays nothing; that Escape doesn\'t pause the game too', dr)
        check(dr['outside'] == {'played': 0, 'sel': -1, 'now': None} and dr['plain'] == 1, 'a drop let go outside the page plays nothing; a plain drag still plays', dr)

        # 4. a person in the way
        wk = await pg.evaluate("""(() => { const out = {}, keep = { map: WG.map, x: WG.x, y: WG.y, bump: WG.bump, goto: WUI.goto }, who = Object.keys(DB.chars)[0];
          const run = (rows, npc, goal) => { MAPS.__t = { id: '__t', kind: 'town', w: rows[0].length, h: rows.length, t: rows, meta: {}, npcs: [Object.assign({ id: who }, npc)], spawn: [1, 1] };
            WG.map = '__t'; WG.x = 1; WG.y = 1; WG.bump = null; WG.step = 1; const path = [];
            WUI.goto = [goal[0], goal[1], null, null]; for (let k = 0; k < 12 && WUI.goto; k++) { wGotoStep(); path.push([WG.x, WG.y]); }
            return { at: [WG.x, WG.y], path, npc: [MAPS.__t.npcs[0].x, MAPS.__t.npcs[0].y], talk: !!WUI.talk }; };
          const rnd = Math.random; Math.random = () => .1; // (the wanderer holds still: wWanderNpcs skips a person on < .5)
          try {
            out.gap = run(['#######', '#.....#', '#######'], { x: 3, y: 1 }, [5, 1]);
            out.round = run(['#######', '#.....#', '#.....#', '#######'], { x: 3, y: 1 }, [5, 1]);
            out.fixed = run(['#######', '#.....#', '#######'], { x: 3, y: 1, fixed: true }, [5, 1]);
          } finally { Math.random = rnd; if (WUI.talk) wCloseTalk(); delete MAPS.__t; Object.assign(WG, { map: keep.map, x: keep.x, y: keep.y, bump: keep.bump }); WUI.goto = null; wResetParty(); }
          return out; })()""")
        check(wk['gap']['at'] == [5, 1] and wk['gap']['npc'] == [2, 1] and not wk['gap']['talk'], 'a person who wanders into the only way through is squeezed past on a click to walk', wk)
        check(wk['round']['at'] == [5, 1] and [3, 1] not in wk['round']['path'] and wk['round']['npc'] == [3, 1], 'one with a way round them is walked round', wk)
        check(wk['fixed']['at'] == [1, 1], 'someone who stays put is not squeezed past (no way through, no walk)', wk)
        check(not errs, 'no page errors', errs[:5])
        await br.close()
    print('\n' + ('all ok' if not FAILS else f'{len(FAILS)} failed: ' + '; '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
