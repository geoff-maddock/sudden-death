"""Realm bot sanity: a few scripted journeys (test/realm_lab.js) finish with no errors, stalls or page errors.
The balance numbers themselves come from test/realm_lab.py with 100+ runs."""
import asyncio, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

fails = 0
def check(ok, what, extra=None):
    global fails
    print(('ok   ' if ok else 'FAIL ') + what + (f': {extra}' if extra is not None and not ok else ''))
    if not ok: fails += 1

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wStart === 'function' && typeof DB !== 'undefined'")
        await pg.add_script_tag(path=ROOT + '/test/realm_lab.js')
        logs = await pg.evaluate('''(() => { const out = []; for (const o of [{ meals: true }, { meals: true }, { dumb: true }, { hardcore: true }]) { try { out.push(REALMLAB(o)); } catch (e) { out.push({ err: String(e.stack || e) }); } } return out; })()''')
        await b.close()
    bad = [l['err'] for l in logs if 'err' in l]
    check(not bad, 'four bot journeys run without throwing', bad[:1])
    ok = [l for l in logs if 'err' not in l]
    check(all(l['result'] in ('champion', 'stuck', 'dead') for l in ok), 'every journey ends as champion, stuck or dead', [l.get('result') for l in ok])
    check(all(len(l['matches']) >= 6 or l['result'] == 'dead' for l in ok), 'every journey plays the opening wild games (a Hardcore one may die in them)', [(len(l['matches']), l['result']) for l in ok])
    # a rare stall is a deck that cannot out-hit a regrowing Troll Grinder: about 1 match in 7,000, and a player concedes
    check(sum(1 for l in ok for m in l['matches'] if m['stall']) <= 1, 'no more than one match stalls')
    kinds = {m['kind'] for l in ok for m in l['matches']}
    check({'wild', 'cup', 'room'} <= kinds, 'the route reaches wild games, cups and dungeon rooms', sorted(kinds))
    check(not errs, 'no page errors', errs[:2])
    print('ok: realm bot passed' if not fails else f'FAILED: {fails} checks')
    sys.exit(1 if fails else 0)

asyncio.run(main())
