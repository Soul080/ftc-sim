# BIOBUZZ Field

A browser simulator for the **2026–2027 FIRST Tech Challenge game, BIOBUZZ presented by RTX** (FIRST CANOPY). It is a static site: Vite, TypeScript, Three.js, and Rapier. Both alliances can be driven on one computer, with a real match clock and live scoring.

The current season was checked against [firstinspires.org](https://www.firstinspires.org/robotics/ftc) on 10 October 2026. BIOBUZZ kicked off 12 September 2026. DECODE was the 2025–2026 game and is not what this field models.

## Run it

```bash
npm install
npm run dev
```

The dev server is [http://127.0.0.1:4317](http://127.0.0.1:4317).

```bash
npm test        # scoring, clock, drive, field layout
npm run build   # tsc and vite build → dist/
npm run preview
```

## GitHub Pages

`.github/workflows/pages.yml` builds on every push to `main` and deploys the `dist/` folder with GitHub Pages. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The site uses a relative `base`, so it works as a project page or a user page.

## What you can do

- Drive a mecanum or tank robot, field-centric or robot-centric. Acceleration scales with mass. Top speed is a separate setting. The chassis stays inside the R102 18 in starting cube.
- Collide with walls, the hive frame, flowers, game pieces, and the other robot. Rapier steps at 60 Hz with CCD on the balls.
- Intake pollen (and your own nectar), launch with a hood angle, drop a piece into a nearby flower, or eject it.
- Run a match: 30 s autonomous, 8 s transition with the robots unpowered, then 2:00 teleop. The scoreboard shows the Table 9-1 clock, which starts at 2:30.
- Score live from Table 10-2: leave, auto and teleop park, hive tips, upward-cell elements, flowers, gardens, and a subset of fouls. Ranking points use the Table 10-3 “all other events” thresholds.
- Hand the human player’s job to a key: nectar enters through that alliance’s loading zone, early entries are a G426 minor, and nectar that left the field can always come back.
- Script a short autonomous. Paths are robot-centric even if teleop is field-centric.
- Use one or two gamepads for the second robot on each alliance. An idle gamepad does not steal the keyboard.
- Switch among broadcast, top, chase, and orbit cameras.

## Controls

| | Red 1 | Blue 1 |
| --- | --- | --- |
| Drive | W A S D | Arrow keys |
| Turn | Q / E | K / L |
| Intake | F | ; |
| Launch | G | ' |
| Deposit in a flower | V | / |
| Eject | X | . |
| Enter nectar | Z | B |
| Hood angle | 1 / 2 | 9 / 0 |

W is toward the far wall in field-centric mode. D is toward blue. Robot-centric forward is the nose (the pale cone).

Gamepad (slots 2, and slots 1 if the stick is actually moved): left stick drive, right stick X turn, RT intake, LT launch, RB deposit, LB eject, Y nectar, D-pad up/down hood, Start starts the match.

Enter starts the match. C cycles cameras. M mutes the synthesized match sounds (stand-ins for Table 9-1, not the official recordings). F1–F5 select broadcast, top, red chase, blue chase, and free orbit. Drag orbits, Shift-drag or right-drag pans, the wheel zooms.

Auto commands, one per line, `#` comments allowed:

`forward 30` · `back 12` · `strafe -8` · `turn 32` · `wait 0.4` · `intake 0.5` · `launch` · `launch 4` · `deposit` · `eject` · `hood 52`

Distances are inches. Turns are degrees of yaw, positive toward +X (blue) when the robot faces the far wall. `launch 4` is four shots with a short wait between them.

## How the field was checked

Rules and layout numbers come from the 2026–2027 FTC Competition Manual and the Event Field Setup Guide Rev 1.0 (12 September 2026), both published on firstinspires.org.

| Item | Source | What the sim uses |
| --- | --- | --- |
| Season | FIRST season page, kickoff 12 Sep 2026 | BIOBUZZ, not DECODE |
| Field, 12 ft × 12 ft, 36 tiles of 24 in | Manual §9.2 | 144 in inside the perimeter. Tile grid is centered on the field |
| Tile letters and numbers | Setup guide §6 and manual §9.2 | From the audience, red is on the left. That is +X in this sim, because a camera looking toward the far wall (+Z) has +X on its left. Columns A–F run red to blue. Rows 1–6 count from the far wall |
| Walls | AndyMark am-0481 (12.3 in product height) and the 0.59 in tile | Wall colliders rise 11.7 in above the tiles. The manual does not print this height |
| Loading zones | Manual §9.3 and setup guide §8.3 | 11 in deep, seam-to-seam 24 in. Red is tile A5, blue is tile F2 |
| Gardens | Manual §9.3 | 23 in along the wall, 2 in deep. Red is tile A1 on the far wall, blue is tile F6 on the audience wall |
| Alliance areas | Manual §9.5 | 97 in wide, 54 in deep, outside the field |
| Hive frame | Manual §9.6.1 | 49.46 × 38.95 in footprint, pivot 43.95 in high |
| Hive separation and tilt | Figure 10-3, not a text callout | **Estimate:** pivots 25.5 in apart, stable tilt ±28° |
| Cell gap and body | Manual §9.6.2 | Gap about 18.8 in, opening 20 × 14 in, depth 12 in. Cell-center arm is **(18.8 + 12) / 2 = 15.4 in** |
| Hive orientation | Field reset guide §11.1 | Red starts with the audience cell up (3 red nectar). Blue starts with the far cell up (3 blue nectar). Down-facing cells point at the audience and far flowers |
| Flowers | Manual §9.7 | Top opening 21.5 in, mouth diameter 4 in, backstop 1.25 in, retrieval hole 3.55 in high and 3.57 in deep, lower hole 2.79 in |
| Flower middle ring | Figure 9-12 did not survive text extraction | **Estimate:** 10 in, high enough that a stack of 4 staged pollen is not in the scoring volume |
| Flower stations | Setup guide, one per wall, perimeter-pin mounts | **Estimate:** centered on each wall, inset 6.5 in, opening toward the field |
| Pollen and nectar size | Manual §9.8 | Pollen 2.8 in, nectar 3.6 in. Balls are perfect spheres; real ones vary |
| Piece counts | Manual §10.3.1 and G304 | 40 pollen (4 per flower, 4 per garden, 4 preloaded on each robot, absent robots’ pollen in the loading zone). 16 nectar (3 in each raised cell, 5 in each alliance area) |
| Match periods | Manual §10.4 and Table 9-1 | Auto 30 s, transition 8 s, teleop 2:00. Display starts at 2:30. Flowers open and remaining nectar may enter at 1:00. Endgame whistle at 0:20 |
| Points | Table 10-2 | Leave 3, park 5 (auto and teleop), hive tip 20, cell 2, flower elements 2, bottom nectar 5, garden 1 |
| Flower ownership | Manual §10.5 | Top nectar owns the flower. Bottom nectar takes the 5-point bonus. No nectar means the pollen in that flower scores 0 |
| Fouls | Table 10-4, §11.4 | Minor 5 and major 20, awarded to the opponent. See the gaps below for which rules are actually called |
| Ranking points | Table 10-3, “all other events” | Swarm at 16 movement points, Pollinator at 4 tips, Pollinator 2 at 7 tips, win 3, tie 1. Championship thresholds are still TBA |
| Robot size and weight | R102, R104, R105 | Starting cube is clamped to 18 in. There is no weight limit; the slider runs 4–30 kg. The 18 × 24 × 29 in expansion envelope is not modeled |

The AndyMark field is marketed with an 11 ft 9 in inside dimension. The manual’s nominal field is 144 in, and that is what the tile grid uses.

Tests in `src/rules/rules.test.ts` lock the point table, the loading-zone and garden coordinates, the piece counts, the clock, the pin counter, and the hive mass threshold against the setup-guide calibration rows.

## Compared with BioBuzz3D

[BioBuzz3D](https://pandara.org/BioBuzz3D/) is an in-development Godot practice sim from FTC team 506 Pandara. The public play page is a single canvas (about 38 MB of wasm) with a back link. This project is aimed at the same game and adds the things that page does not expose: an HTML scoreboard, the auto / transition / teleop clock, Table 10-2 scoring with cited thresholds, two-alliance local play, autonomous scripts, configurable robots, and tests you can rerun.

## Known gaps

- Several flower and hive numbers exist only in figures. They are marked **estimate** above: middle ring 10 in, pivot separation 25.5 in, tilt 28°, flower inset 6.5 in, cell-center arm 15.4 in.
- The hive is a kinematic body that tips when the captured mass crosses 0.200 kg. Masses are not in the manual (pollen 26 g, nectar 42 g) and were chosen so the setup guide §12.3 rows behave: 7 pollen and 3 nectar + 2 pollen do not tip; 8 pollen and 3 nectar + 3 pollen do. Impact-only tips (“tossed” pieces) are not modeled. Points are awarded when the animation reaches the opposite stop.
- Quadratic drag (`k = 0.05`) is an estimate and can be turned off. The trajectory line uses the same integrator.
- Robots cannot tip (G420 is not called). R105 expansion is not modeled. AprilTag ids are decorative; the manual’s HTML text layer drops the digits, so none are asserted.
- Pins (G421) require direct robot-to-robot contact. Transitive pins, strategic referee judgment, G427 outside the loading zone, and red-card score zeroing are not simulated. G402 is a simplified midline-plus-distance check. G405 fires when a non-lob (hood under 35°) leaves the field within 2.5 s. G408 rejects opponent nectar and issues one yellow card on the second try; cards do not change the score. G410 is one major per nectar that reaches a flower scoring volume before 1:00, and the nectar still scores.
- The human player is a button that drops nectar in the loading zone. There is no network multiplayer.
- Frame diagonal struts are visual. Foot rails and posts collide.
