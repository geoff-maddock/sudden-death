# Realm reloads (issue #120, phase 1), bowling: a reload never takes back a ball settled. Reloaded right after the first
# result the match comes back with it, still met today (never called off), and the club can't be played again that day;
# a few turns on every result settled comes back; reloaded as the deciding result is on its way, the match is settled on
# load, never left waiting; calls, powers and a swing's power are never given back. The check is test/reload_turns.py's, for bowling alone (one engine a check, for
# time). Asserts; exits nonzero on failure.
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from reload_turns import run

run(['lanes'])
