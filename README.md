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
npm test        # scoring, clock, drive, field layout, AI decisions
npm run build   # tsc and vite build → dist/
npm run preview
```

## GitHub Pages

`.github/workflows/pages.yml` builds on every push to `main` and deploys the `dist/` folder with GitHub Actions. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

The production build sets Vite `base` to `/ftc-sim/`, so the live site is [https://soul080.github.io/ftc-sim/](https://soul080.github.io/ftc-sim/). `npm run dev` still serves the app at the server root.

## What you can do

- Drive a mecanum or tank robot, field-centric or robot-centric, or set either alliance’s first robot to AI. The AI plays the whole match: it collects pollen and its own nectar, shoots the hive, deposits nectar once flowers open, ejects pollen into its garden when that is closer, stays on its own half in auto, backs off instead of pinning, and parks in its loading zone at endgame. Pace is Gentle, Standard, or Challenging. Blue starts on Standard.
- Acceleration scales with mass. Top speed, turn rate, strafe efficiency, and braking are separate settings. The chassis stays inside the R102 18 in starting cube.
- Collide with walls, the hive frame, flowers, game pieces, and the other robot. Rapier steps at 60 Hz with CCD on the balls.
- Intake pollen (and your own nectar), launch with a hood angle, drop a piece into a nearby flower, or eject it.
- Run a match: 30 s autonomous, 8 s transition with the robots unpowered, then 2:00 teleop. The scoreboard shows the Table 9-1 clock, which starts at 2:30.
- Score live from Table 10-2: leave, auto and teleop park, hive tips, upward-cell elements, flowers, gardens, and a subset of fouls. Ranking points use the Table 10-3 “all other events” thresholds.
- Hand the human player’s job to a key: nectar enters through that alliance’s loading zone, early entries are a G426 minor, and nectar that left the field can always come back.
- Script a short autonomous. Paths are robot-centric even if teleop is field-centric.
- Use one or two gamepads for the second robot on each alliance. An idle gamepad does not steal the keyboard.
- Switch among overview, overhead, driver, and orbit cameras. Field of view, colors, a colourblind palette, shadows, and the HUD are in the Look tab.
- Rebind every driving key. Gamepad deadzone, response curve, invert, and precision scale are saved with the rest of the setup.

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

Enter starts the match. C cycles cameras. M mutes the synthesized match sounds (stand-ins for Table 9-1, not the official recordings). T toggles field-centric and robot-centric (that key can be rebound). Hold Shift for precision. F1–F5 select overview, overhead, red driver, blue driver, and free orbit. Drag orbits, Shift-drag or right-drag pans, the wheel zooms.

The setup panel (Match, Robot, Look, Controls, Physics, Auto) writes `localStorage` key `biobuzz-sim-config`. Old saves still load; missing fields keep the defaults.

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

[BioBuzz3D](https://pandara.org/BioBuzz3D/) is an in-development Godot 4.5 practice sim from FTC team 506 Pandara. The public page is a canvas export. Its settings live in the game, not in the HTML, so the list below is taken from that build (settings, garage, controls, and opponent screens). Each row is how this field matches it.

| Pandara option | How this field matches it |
| --- | --- |
| Audio: master, robot & field SFX, crowd | Look → Audio sliders. Mute still exists. Crowd is a soft loop that starts after the first gesture. |
| All sounds generated, flywheel tied to spin-up | Match tones are oscillators. A shot plays a short rising flywheel tone. |
| Cameras: chase, driver, overhead, overview | Overview (broadcast), overhead (top), red and blue driver cams, plus orbit. |
| Field of view | Look → Field of view, 30°–90°. |
| Colourblind palette | Look → Colourblind swaps the red body for orange and keeps blue. |
| Match HUD hidden / visible | Look → Match HUD. |
| Opponent overlay (route and current action) | A line under the scoreboard shows each alliance’s driver and, for an AI robot, what it is doing. |
| Windowed / fullscreen | Look → Fullscreen. |
| V-sync | Look → Sharp pixels. A page cannot disable display vsync; off forces a 1× pixel ratio. |
| Anti-aliasing (MSAA) | Look → Anti-aliasing. Changing it rebuilds the WebGL context. |
| Shadows, with a note to turn them off if the frame rate drops | Look → Shadows. |
| Drive forward/back, strafe, turn | Controls → Keys, per alliance. Defaults stay WASD / arrows. |
| Precision hold | Hold the bound key (Shift) or click the left stick. Scale is the Precision slider. |
| Field-centric toggle | The red “Field / robot” binding (T by default). |
| Fire (hold to empty), spit one out, intake, stop intake | Launch, eject, and intake bindings. Releasing intake stops it. |
| Hood up/down, more/less launcher power | Hood keys, and the launch-speed slider. |
| Aim assist, recalibrate turret | Look → Auto-aim turret. The hood yaws on its own and tracks that alliance’s raised hive cell. Turn it off and `[` / `]` (red) or O / P (blue), or the D-pad, swing it by hand. |
| Start match, reset field, skip auto | Start match, Reset, and an empty auto script (or AI, which replaces the script). |
| Pause / menu | The setup panel. There is no separate pause; Reset returns to practice. |
| Save situation, retry scenario | Not ported. Reset reloads the standard setup. |
| Gamepad deadzone, curves, invert move X/Y, invert turn, precision scale | Controls → Gamepad feel. |
| Profiles (duplicate, rename, delete) and live stick graphs | One profile, stored with the other settings. Connected pad names are listed. There is no profile library or stick graph. |
| Seats: one person per robot, or driver + operator | Local two-keyboard play, plus gamepads for the second robot on each alliance. No online lobby. |
| AI teammate needs no controller | Match → Drivers. Human or AI for red and for blue, with Gentle / Standard / Challenging pace. |
| Stock mecanum vs measured profile | Robot → Profile. Stock is the shared 1.6 m/s tune. |
| Motors: REV HD Hex 20:1, 40:1, NeveRest 40 | Those three presets, plus stock and measured. Speed is free rpm × wheel circumference. |
| Derived acceleration, force, braking, strafe penalty, turn rate | The robot tab prints in/s, strafe penalty, turn °/s, and 0–top time. Force-per-wheel is not shown; acceleration still scales with mass. |
| Calibration: forward, strafe, accel time, stopping distance, full-spin time, weight | Measured-profile sliders, plus mass. “Apply measurements” copies them into speed, strafe efficiency, turn rate, and braking. |
| Intake: front only, or front and rear | Robot → Intake. Double-sided picks up from the front mouth and the back mouth. The 4-piece limit is unchanged. |
| Collects: pollen only, or pollen and nectar | Robot → Collects. Opponent nectar is still refused (G408). |
| Robot name, colors | Name, red body color, blue body color. |
| Import GLB / glTF / STL, scale, tip, turn, roll | Not ported. Pandara limits import to its downloadable build, and collision there stays an 18 in cube. Here the cube is the robot you sized. |
| Wheels, turret, alliance bumpers drawn on the model | Mecanum rollers, an independent turret and barrel, headlights, a front chevron, and FRONT / BACK / LEFT / RIGHT bumpers. Front is yellow, back is dark, the sides wear the alliance color. |
| Autonomous: record inputs, replay, test, delete, run no auto, named routines | Auto → Record red / Record blue. Drive up to 30 seconds in practice, name the routine, and it is armed for that alliance’s next auto. Several routines stay in `localStorage`. Use disarms one, Delete removes it. The old text scripts are still in the collapsed Script editor. An AI driver ignores both and plays the match itself. |
| Opponent behaviors: collect and score, stationary, route, defend, back and forth, stop at end | One match brain instead of scenario bots. It collects and scores, and it stops to park at endgame. Stationary, waypoint routes, and defend-an-area are not separate modes. |
| Collect-and-score: nearest pollen, up to 4, then a shooting spot, then fire | Same order, plus own nectar to a flower after 1:00, garden ejects when the tape is closer than the hive, and a loading-zone nectar when the entry is legal. |
| Difficulty: Gentle, Standard, Challenging, and a pace that is a share of full stick | Same three names. Gentle uses 55% stick and parks with 28 s left, Standard 85% and 20 s, Challenging full stick and 12 s. |
| Driving pace never exceeds the robot | Stick output is at most the pace gain, then the chassis speed, turn rate, and acceleration caps still apply. |
| Do not model pinning | The AI steers away inside 16 in and will not chase across the midline in auto. |
| Settings save automatically, reset to defaults | `localStorage`, and Look → Reset settings. |

Pandara’s AI is a practice opponent with waypoints and a defend radius. This one plays a scored match. It does not pin on purpose, and it will not cross the midline during auto. **AI vs AI** in the header puts both alliances on Standard and starts the match. Each robot drives to a spot in front of its raised cell, shoots with the turret, collects another hopper, and parks in its loading zone at endgame.

## Known gaps

- Several flower and hive numbers exist only in figures. They are marked **estimate** above: middle ring 10 in, pivot separation 25.5 in, tilt 28°, flower inset 6.5 in, cell-center arm 15.4 in.
- The hive is a kinematic body that tips when the captured mass crosses 0.200 kg. Masses are not in the manual (pollen 26 g, nectar 42 g) and were chosen so the setup guide §12.3 rows behave: 7 pollen and 3 nectar + 2 pollen do not tip; 8 pollen and 3 nectar + 3 pollen do. Impact-only tips (“tossed” pieces) are not modeled. Points are awarded when the animation reaches the opposite stop.
- Quadratic drag (`k = 0.05`) is an estimate and can be turned off. The trajectory line uses the same integrator.
- Robots cannot tip (G420 is not called). R105 expansion is not modeled. AprilTag ids are decorative; the manual’s HTML text layer drops the digits, so none are asserted.
- Pins (G421) require direct robot-to-robot contact. Transitive pins, strategic referee judgment, G427 outside the loading zone, and red-card score zeroing are not simulated. G402 is a simplified midline-plus-distance check. G405 fires when a non-lob (hood under 35°) leaves the field within 2.5 s. G408 rejects opponent nectar and issues one yellow card on the second try; cards do not change the score. G410 is one major per nectar that reaches a flower scoring volume before 1:00, and the nectar still scores.
- The human player is a button that drops nectar in the loading zone. There is no network multiplayer.
- Frame diagonal struts are visual. Foot rails and posts collide.
