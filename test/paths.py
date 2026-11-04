# Where the built game lives, for every check. Tests run as `python3 test/<name>.py`, so this imports as `paths`.
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
GAME = os.path.join(ROOT, 'dist', 'sudden-death.html')
GAME_URL = 'file://' + GAME
# Champions of the Realm, built with ./build.sh src/realm/manifest.txt
REALM = os.path.join(ROOT, 'dist', 'realm.html')
REALM_URL = 'file://' + REALM
# A check builds what it needs first, unless the suite has already built both pages (test/all.sh sets SD_BUILT=1), so
# a run of many checks builds once rather than once a check
BUILT = bool(os.environ.get('SD_BUILT'))
REALM_BUILD = ['true'] if BUILT else ['./build.sh', 'src/realm/manifest.txt']
GAME_BUILD = ['true'] if BUILT else ['./build.sh']
