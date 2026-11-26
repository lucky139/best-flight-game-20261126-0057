# Sky Courier: Ember Isles

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/lucky139/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/lucky139/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Fly the Kestrel, a single-prop courier plane, over the Ember Isles: thread glowing sky rings, mind the fuel gauge, and put her down gentle on island strips. Three sorties — Ring Run, Island Hop and the gusty Storm Courier — each with its own rings, runways and weather. Throttle and turn discipline decide the score; a stall, a terrain strike or an empty tank ends the flight.

## Run it

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

## Play

- Arrows / WASD — fly (pitch and bank)
- Shift / Ctrl — throttle up / down (mouse wheel works too)
- Mouse — steer toward the pointer
- 1–3 — choose a sortie · Enter — fly / take off again · P — pause · R — fly again · M — mute

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library. The game is plain static files under `game/` with no build step and no network request; every sound is synthesised with WebAudio.

---

<sub>Entered on [make.fun](https://make.fun/?ref=zpha5r25&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
