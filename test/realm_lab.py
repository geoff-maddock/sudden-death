"""Realm balance bot: N scripted journeys through dist/realm.html (wild games, cups, dungeons, lairs, the Crown).

  python3 test/realm_lab.py 100                      skilled bot, meals on
  python3 test/realm_lab.py 100 '{"dumb": true}'     careless bot
  python3 test/realm_lab.py 100 '{"hardcore": true}' a loss ends the journey
  python3 test/realm_lab.py 100 '{}' 'W_ROAD.hpPerLv = .12'   a tuning override, run in the page first

Writes every run to /tmp/realm_lab.json and prints win rates and HP cost by stage and match kind."""
import asyncio, json, sys, collections, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))
from paths import REALM_URL
from playwright.async_api import async_playwright

N = int(sys.argv[1]) if len(sys.argv) > 1 else 100
OPTS = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
OPTS.setdefault('meals', True)
PRE = sys.argv[3] if len(sys.argv) > 3 else ''


def pct(a, b): return f"{100 * a / b:5.1f}%" if b else '   - '


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(REALM_URL)
        await pg.wait_for_function("typeof wStart === 'function' && typeof DB !== 'undefined'")
        await pg.add_script_tag(path=ROOT + '/test/realm_lab.js')
        if PRE: await pg.evaluate(PRE + "\n;0")  # a trailing value, so a snippet that ends in a function is not called
        logs = []
        for i in range(0, N, 10):  # in batches, so a long run never hits one evaluate's timeout
            k = min(10, N - i)
            logs += await pg.evaluate(f'(() => {{ const out = []; for (let i = 0; i < {k}; i++) {{ try {{ out.push(REALMLAB({json.dumps(OPTS)})); }} catch (e) {{ out.push({{ err: String(e.stack || e) }}); }} }} return out; }})()')
        await b.close()
    json.dump(logs, open('/tmp/realm_lab.json', 'w'))
    bad = [l['err'] for l in logs if 'err' in l]
    ok = [l for l in logs if 'err' not in l]
    print('opts', OPTS, PRE or '')
    print('page errors', len(errs), errs[:2])
    print('run errors', len(bad), bad[:2])
    stalls = sum(1 for l in ok for m in l['matches'] if m['stall'])
    print('stalls', stalls, [(m['what'], m['ids'], m['lv']) for l in ok for m in l['matches'] if m['stall']][:5])
    res = collections.Counter(l['result'] for l in ok)
    print('results', dict(res), ' champion rate', pct(res['champion'], len(ok)))
    ends = collections.Counter(l['stage'] for l in ok if l['result'] != 'champion')
    print('ended at', ends.most_common())
    # how far runs get: share of runs that cleared each stage
    order = []
    for l in ok:
        for s in l['stages']:
            if s['stage'] not in order: order.append(s['stage'])
    print('\nstage                 reached  cleared   day  maxhp  gold  deck  starter lvls')
    for st in order:
        rows = [s for l in ok for s in l['stages'] if s['stage'] == st]
        cl = sum(1 for s in rows if s['ok'])
        avg = lambda k: sum(s[k] for s in rows) / len(rows)
        lv = sum(sum(s['lvls']) / len(s['lvls']) for s in rows) / len(rows)
        print(f"{st:22s} {len(rows):6d}  {pct(cl, len(rows))} {avg('day'):5.0f} {avg('maxhp'):6.0f} {avg('gold'):5.0f} {avg('deck'):5.0f}  {lv:4.1f}")
    # every match by what it was: win rate, HP lost (share of max), turns
    print('\nmatch                   n    win   hp lost  %max  turns  lv')
    agg = collections.defaultdict(list)
    for l in ok:
        for m in l['matches']:
            agg[m['what']].append(m)
    for k in sorted(agg, key=lambda k: min(i for i, l in enumerate(order) if any(m['stage'] == l for m in agg[k]))):
        v = agg[k]; w = sum(1 for m in v if m['res'] == 'win')
        print(f"{k:22s} {len(v):4d} {pct(w, len(v))} {sum(m['lost'] for m in v) / len(v):7.1f} {100 * sum(m['lost'] / m['max0'] for m in v) / len(v):5.1f} {sum(m['turns'] for m in v) / len(v):6.1f} {sum(m['lv'] for m in v) / len(v):4.1f}")
    bo = [l['blackouts'] for l in ok]
    print('\nblackouts per run', round(sum(bo) / len(bo), 2), ' days', round(sum(l['days'] for l in ok) / len(ok)), ' matches per run', round(sum(len(l['matches']) for l in ok) / len(ok), 1))
    cr = [l for l in ok if l['crownTries']]
    if cr: print('crown entries per run that got there', round(sum(l['crownTries'] for l in cr) / len(cr), 2))
    meal = [m for l in ok for m in l['matches'] if m['meal']]
    if meal: print('matches with a meal', len(meal), 'win', pct(sum(1 for m in meal if m['res'] == 'win'), len(meal)))
    amb = [m for l in ok for m in l['matches'] if m['ambush']]
    if amb: print('ambushes', len(amb), 'win', pct(sum(1 for m in amb if m['res'] == 'win'), len(amb)))
    killers = collections.Counter(m['ids'] for l in ok for m in l['matches'] if m['res'] != 'win')
    home = [m for l in ok for m in l['matches'] if m.get('home')]
    if home: print('home matches', len(home), 'win', pct(sum(1 for m in home if m['res'] == 'win'), len(home)), ' per run', round(len(home) / len(ok), 1))
    grounds = [l['ground'] for l in ok if l.get('ground')]
    if grounds:
        print('grounds', len(grounds), 'of', len(ok), collections.Counter(g['town'] for g in grounds).most_common(), ' upgrade levels per run', round(sum(sum(g['parts'].values()) for g in grounds) / len(grounds), 1))
    print('gold at the end', round(sum(l['gold'] for l in ok) / len(ok)))
    print('most losses to', killers.most_common(8))


asyncio.run(main())
