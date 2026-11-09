# Daily balance (issue #60, phase 3). Two readings, both from the skilled bot (test/lab.js):
#
#   python3 test/daily_lab.py twists [days] [diff]   each twist against no twist, on the same days (paired): every day
#                                                    is played once with each twist forced and once with none, all at
#                                                    one difficulty (default 1, Contender), so the twist is the only
#                                                    thing that changes. Prints win rate, fights won and score by
#                                                    twist, and the change from no twist with its standard error.
#   python3 test/daily_lab.py week [weeks]           the real dailies, day after day, at their own difficulties:
#                                                    win rate by weekday, against the plain game's rates.
#
# Days start at START (default 2026-01-04, a Sunday). Runs are split over JOBS pages (default 4). Writes the logs to
# /tmp/daily_lab.json. TWISTS=none,scouted limits the twists; PATCH tries a tuning first. A reading, not a check: it is not in test/all.sh.
import asyncio, json, sys, os, collections, math, datetime
from paths import ROOT, GAME_URL
from playwright.async_api import async_playwright

MODE = sys.argv[1] if len(sys.argv) > 1 else 'twists'
N = int(sys.argv[2]) if len(sys.argv) > 2 else (100 if MODE == 'twists' else 26)
DIFF = int(sys.argv[3]) if len(sys.argv) > 3 else 1
START = datetime.date.fromisoformat(os.environ.get('START', '2026-01-04'))
JOBS = int(os.environ.get('JOBS', '4'))
PATCH = os.environ.get('PATCH', '')   # JS run after load, to try a tuning, e.g. PATCH="DAILY_TWISTS.purse.go = () => { RUN.gold = 300; }"
TWISTS = os.environ.get('TWISTS', '').split(',') if os.environ.get('TWISTS') else ['none', 'purse', 'heirloom', 'lean', 'glass', 'iron', 'scouted', 'medicine', 'free']
DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

def jobs():
    if MODE == 'twists':
        return [{'daily': (START + datetime.timedelta(days=i)).isoformat(), 'twist': t, 'diff': DIFF} for i in range(N) for t in TWISTS]
    return [{'daily': (START + datetime.timedelta(days=i)).isoformat()} for i in range(N * 7)]

async def worker(br, chunk):
    pg = await br.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script('window.__SD_LAB = true;')
    await pg.goto(GAME_URL)
    if PATCH: await pg.evaluate("(() => { " + PATCH + "\n; return 0; })()")
    await pg.add_script_tag(path=os.path.join(ROOT, 'test', 'lab.js'))
    out = []
    for i in range(0, len(chunk), 20):   # in batches, so one evaluate never runs for minutes
        out += await pg.evaluate("""J => J.map(o => { try { const l = LABRUN(o); return { daily: o.daily, twist: l.twist || 'none', diff: RUN.diff, result: l.result,
          won: l.won, score: l.score, act: l.act, club: l.club }; } catch (e) { return { daily: o.daily, twist: o.twist, err: String(e.stack || e).slice(0, 300) }; } })""", chunk[i:i + 20])
    await pg.close()
    return out, errs

def se(p, n): return math.sqrt(max(p * (1 - p), 1e-9) / n) if n else 0

async def main():
    J = jobs()
    async with async_playwright() as p:
        br = await p.chromium.launch()
        parts = await asyncio.gather(*[worker(br, J[k::JOBS]) for k in range(JOBS)])
        await br.close()
    logs = [l for o, _ in parts for l in o]; perr = [e for _, es in parts for e in es]
    json.dump(logs, open('/tmp/daily_lab.json', 'w'))
    bad = [l for l in logs if 'err' in l]
    print(f'{len(logs)} runs, {len(bad)} run errors {[b["err"] for b in bad[:2]]}, page errors {perr[:2]}')
    ok = [l for l in logs if 'err' not in l]
    if MODE == 'twists':
        by = collections.defaultdict(dict)
        for l in ok: by[l['twist']][l['daily']] = l
        base = by['none']
        print(f'\n{N} days, each twist and none on every day, difficulty {DIFF}')
        print(f"{'twist':10s} {'win%':>6s} {'±':>5s} {'fights':>7s} {'score':>6s}   {'vs none':>8s} {'±':>5s}")
        for t in TWISTS:
            L = list(by[t].values()); n = len(L)
            if not n: continue
            w = sum(l['result'] == 'win' for l in L) / n
            d = [(by[t][k]['result'] == 'win') - (base[k]['result'] == 'win') for k in by[t] if k in base]
            md = sum(d) / len(d) if d else 0
            sd = math.sqrt(sum((x - md) ** 2 for x in d) / max(1, len(d) - 1) / max(1, len(d))) if d else 0
            print(f"{t:10s} {100*w:6.1f} {100*se(w, n):5.1f} {sum(l['won'] for l in L)/n:7.1f} {sum(l['score'] for l in L)/n:6.0f}   {'' if t == 'none' else f'{100*md:+8.1f}'} {'' if t == 'none' else f'{100*sd:5.1f}'}")
    else:
        print(f'\n{N} weeks of dailies from {START}, each at its own difficulty')
        print(f"{'day':4s} {'diff':>4s} {'runs':>5s} {'win%':>6s} {'±':>5s} {'fights':>7s}")
        for d in range(7):
            L = [l for l in ok if datetime.date.fromisoformat(l['daily']).isoweekday() % 7 == d]; n = len(L)
            w = sum(l['result'] == 'win' for l in L) / n if n else 0
            print(f"{DAYS[d]:4s} {L[0]['diff'] if L else '':>4} {n:5d} {100*w:6.1f} {100*se(w, n):5.1f} {sum(l['won'] for l in L)/max(1,n):7.1f}")
        tw = collections.defaultdict(list)
        for l in ok: tw[l['twist']].append(l['result'] == 'win')
        print('twist days:', {k: f'{len(v)} days, {100*sum(v)/len(v):.0f}%' for k, v in sorted(tw.items())})

asyncio.run(main())
