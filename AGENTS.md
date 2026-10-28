# AGENTS.md

The working context for this repo lives in [CLAUDE.md](CLAUDE.md): what the game is, the commands, the rules of the road, the Realm's rules and the current balance. Read it first, then `ARCHITECTURE.md` for the code map.

It is kept in one place so it can't drift. Agents that look for `AGENTS.md` should follow CLAUDE.md as if it were this file.

Project skills for agents that read `.agents/skills/`:

- `game-difficulty-probe`: measuring difficulty and reward creep with the headless bots.
- `single-file-game-hardening`: the failure modes of this single-file canvas game, and the fixes that held.
