# Where the built game lives, for every check. Tests run as `python3 test/<name>.py`, so this imports as `paths`.
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
GAME = os.path.join(ROOT, 'dist', 'sudden-death.html')
GAME_URL = 'file://' + GAME
