"""The weekly cup bracket, once (issue #86): the Cinder Cup, the Anvil Belt, the Charter Net and the Pond Kettle
register in W_BRACKETS and call w45b's bracket; none keeps its own copy. Entering draws eight sides with you first,
the rounds pair winners in order, the round is finished once your game is in, and the bracket marks how a game ended."""
import asyncio, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAILS = []
def check(ok, what, got=None):
    if not ok:
        FAILS.append(what); print('FAIL', what + ':', str(got)[:500])
    else:
        print('ok', what)
CUPS = [('gcup', 'wGcup', 'games', 'w46-gfcup.js', 'Cinder Cup'), ('bcup', 'wBcup', 'cards', 'w54-ringcup.js', 'Anvil Belt'),
        ('bkcup', 'wNet', 'games', 'w84-courtnet.js', 'Charter Net'), ('hkcup', 'wKettle', 'games', 'w95-rinkkettle.js', 'Pond Kettle')]
JS = """([key, P, store, name]) => { const f = n => window.eval(P + n), C = W_BRACKETS[key], out = {};
  out.cfg = !!C && C.name === name && C.store === store && ['live', 'base', 'sim', 'won', 'mark'].every(k => typeof C[k] === 'function') && C.K.rounds.length === 3 && C.K.size === 8;
  WG[key] = null; RUN.gold = C.K.fee - 1; out.poor = f('Problems')().join(' '); RUN.gold = 999;
  out.enter = f('Enter')(); const D = WG[key]; out.gold = RUN.gold === 999 - C.K.fee;
  out.field = D.field.length === 8 && D.field[0] === 'me' && new Set(D.field).size === 8; out.same = f('')() === D && wBrk(key) === D && f('On')();
  const pairs = f('Pairs')(0); out.pairs = pairs.length === 4 && pairs[0][0] === 'me' && JSON.stringify(pairs) === JSON.stringify(wBrkPairs(key, 0));
  out.mine = f('Mine')() === pairs[0][1]; out.again = f('Problems')().length === C.base().length;
  // your quarter-final lost: the rest of the cup is played to a champion
  const opp = pairs[0][1]; D[store][0].push({ a: 'me', b: opp, ra: 1, rb: 2, w: opp }); D.out = true; D.pending = true;
  out.caught = f('CatchUp')(); out.done = D.done && !!D.champ && D.champ !== 'me' && D[store].map(r => r.length).join() === '4,2,1' && !f('On')() && f('Mine')() === null;
  out.winners = [1, 2].every(r => f('Pairs')(r).every(([a, b]) => D[store][r - 1].some(g => g.w === a) && D[store][r - 1].some(g => g.w === b)));
  out.json = JSON.stringify(JSON.parse(JSON.stringify(D))) === JSON.stringify(D);
  const br = f('Bracket')(); out.br = C.K.rounds.every(n => br.includes(n)) && (br.match(/<ol class="wdcg">/g) || []).length === 7 && br.includes('wme');
  out.week = f('Problems')().join(' '); return out; }"""
async def main():
    core = open(f'{ROOT}/src/realm/w45b-bracket.js').read()
    check(all(f'function {n}(' in core for n in ['wBrk', 'wBrkOn', 'wBrkPairs', 'wBrkGame', 'wBrkMine', 'wBrkProblems', 'wBrkEnter', 'wBrkCatchUp', 'wBrkBracket']), 'w45b has the bracket')
    for key, P, store, f, name in CUPS:
        s = open(f'{ROOT}/src/realm/{f}').read()
        check(f'W_BRACKETS.{key} = ' in s and 'shuffle(' not in s and 'class="wdcg"' not in s and not re.search(r'for \(;;\)', s), f'{name}: registers in W_BRACKETS and keeps no bracket of its own')
    async with async_playwright() as p:
        br = await p.chromium.launch(); pg = await br.new_page(viewport={'width': 1200, 'height': 900}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL); await pg.evaluate('localStorage.clear()'); await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wBrkEnter === 'function'"); await pg.evaluate("TIPS_SEEN.push(...Object.keys(TIPS)); SET.tips = false")
        await pg.click('#bNew'); await pg.wait_for_function("!!document.getElementById('cfYes') || !!document.getElementById('wGo')")
        if await pg.evaluate("!!document.getElementById('cfYes')"): await pg.click('#cfYes')
        await pg.wait_for_selector('#wGo'); await pg.click('#wGo'); await pg.wait_for_function("UI.view === 'world' && !!WG && document.getElementById('modal').hidden")
        await pg.evaluate("(() => { const kinds = ['troll', 'harpy', 'spider', 'lich', 'witch', 'vampire', 'werewolf']; let i = 0; while (wRoster().length < W_PARTY.max) wAddPlayer(wMakePlayer({ kind: kinds[i++], lvl: 2 }, 'tavern')); })()")
        for key, P, store, f, name in CUPS:
            r = await pg.evaluate(JS, [key, P, store, name])
            check(r['cfg'], f'{name}: its table has its numbers, words and hooks', r)
            check('entry fee' in r['poor'] and r['enter'] == '' and r['gold'] and r['field'] and r['same'], f'{name}: entering takes the fee and draws eight sides, you first', r)
            check(r['pairs'] and r['mine'] and r['again'], f"{name}: the cup's own functions are the bracket's", r)
            check(r['caught'] and r['done'] and r['winners'] and r['json'], f'{name}: once your game is in the rest is played to a champion, winners paired in order, plain JSON', r)
            check(r['br'] and f'The {name} is' in r['week'] and 'once a week' in r['week'], f'{name}: the bracket shows three rounds and seven games; one cup a week', r)
        check(await pg.evaluate("wAudit().length === 0"), 'the audit is clean', await pg.evaluate("wAudit()"))
        check(not errs and await pg.evaluate("window.__sdErrs.length === 0"), 'no page errors', errs)
        await br.close()
    print('errors:', FAILS)
    sys.exit(1 if FAILS else 0)
asyncio.run(main())
