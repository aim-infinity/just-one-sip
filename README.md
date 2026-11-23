# Just One Sip 🛺💧

You're in the back seat of an auto-rickshaw on Indian roads with a 250 ml water bottle.
Finish it before your stop. The potholes have other plans.

**One control:** press and hold anywhere to raise the bottle and drink. Let go to lower it.
Sip on smooth road, lower before bumps.

- **Win:** drink all 250 ml before your stop.
- **Spills never take water away from you.** They fill a separate mess meter; at
  **50 ml spilled** the ride ends.
- **Lose:** mess meter full, or reaching your stop with water left.
- **Lose (spectacularly):** drink through a *massive pothole* and the passenger is launched
  through the roof. *Bro unlocked flight mode.*

Before each ride, pick a **driver** and the **weather** (*Choose your ride* screen):

| Driver | Behaviour |
| --- | --- |
| 🧘 Shankar (Careful) | Slows down before bumps, so hits are softer. Gentle brakes |
| 😤 Raju (Impatient) | Faster; scooters cut in and he slams the brakes |
| 😎 Manju (Overconfident) | Fastest, never slows, says *"Road super saar!"* right before potholes |

| Weather | Effect |
| --- | --- |
| ☀️ Sunny | Clear road |
| 🌧️ Rainy | Puddles partly hide potholes, more waterlogged roads, slippery braking (longer stop + skid), rain and spray |
| 🌙 Night | Darkness; the headlight, street lamps, cabin light and reflective paint light the way |

The auto speeds up from 6 to a capped 9 m/s over the ~40 s ride. Road blockers:

| Blocker | What it does |
| --- | --- |
| Pothole | Front wheel dips and rebounds, then the rear follows |
| Massive pothole | Rare (≈1 in 4 rides, at most one, never in the opening or tutorial), marked by a barricade, blinking lamp and ⚠ sign. Lowered bottle: a big bounce. Bottle up at the rebound: passenger ejected through the roof, ride over |
| Speed breaker | Slow rolling rise, then a jolt as the auto comes down |
| Waterlogged pothole | Looks the same every time, but its hidden depth varies from shallow to brutal |
| Repair patch | Small vibrations: you can usually keep sipping |
| Manhole | Small, sharp clank |
| Rumble strip | Fast rattle: sippable at a small cost |
| Metro-work gravel | Long, loose and rattly |
| Cow crossing | Sudden brake: the passenger is thrown forward |
| Scooter cut-in | Impatient driver only: a hard sudden brake |
| Traffic signal | Full stop (free sip!), amber warning, then a lurch on green |

Built with Phaser 3, TypeScript and Vite. No backend, no accounts, no network calls
during play (the only external request is the Google Font, and the game falls back
to a system font if it fails).

---

## Local development

```bash
npm install
npm run dev          # http://localhost:8080 (debug panel enabled)
npm test             # unit + balance tests (Vitest)
npm run typecheck
```

Handy URL parameters (work in production too):

| Param       | Effect                                           |
| ----------- | ------------------------------------------------ |
| `?seed=123` | Replay an exact road layout (deterministic)      |
| `?debug`    | Show the tuning/debug panel in a production build |
| `?massive`  | Always put a massive pothole on the route (QA for the ejection) |

Reset the tutorial or best score by clearing `localStorage` keys `jos.settings.v1` / `jos.best.v1`.

## Production build

```bash
npm run build        # type-checks, then bundles to dist/
npm run preview      # serve dist/ at http://localhost:8081
```

`dist/` is fully static (~1.2 MB, mostly Phaser; ~75 KB of game code).

## Deployment

Cloudflare Pages settings: **build command** `npm run build`, **output directory** `dist`.

### Manual deploy (direct upload)

```bash
npx wrangler login
npx wrangler pages deploy dist --project-name=just-one-sip --branch=main
```

### Automatic deploy on every push to `main`

The workflow is parked at `ci/github-deploy.yml` until the GitHub token has `workflow` scope
(`gh auth refresh -s workflow`, then `git mv ci/github-deploy.yml .github/workflows/deploy.yml`).
It runs tests and builds on every push and PR. On pushes to `main`
it deploys to Cloudflare Pages once these two repository secrets exist:

1. Cloudflare dashboard → My Profile → API Tokens → **Create Token** → template
   *"Edit Cloudflare Workers"*, or a custom token with **Account → Cloudflare Pages → Edit**.
2. Add the secrets:
   ```bash
   gh secret set CLOUDFLARE_API_TOKEN      # paste the token
   gh secret set CLOUDFLARE_ACCOUNT_ID     # from the dashboard sidebar / `wrangler whoami`
   ```

Without the secrets the deploy step is skipped with a notice. CI still tests and builds.

*Alternative:* in the Cloudflare dashboard, **Workers & Pages → just-one-sip → Settings → Git
integration** can connect the GitHub repo directly with the same build settings.

### Vercel (fallback)

`npx vercel --prod` from the repo root. Vercel auto-detects Vite (build `npm run build`, output `dist`).

> Behind a corporate TLS-inspecting proxy, Node tools may fail with
> `SELF_SIGNED_CERT_IN_CHAIN`. Export the macOS keychain roots and point Node at them:
> `security find-certificate -a -p /Library/Keychains/System.keychain /System/Library/Keychains/SystemRootCertificates.keychain > ca.pem && export NODE_EXTRA_CA_CERTS=$PWD/ca.pem`

---

## Architecture

Game logic is pure TypeScript with no Phaser or DOM dependencies, so it is unit-testable
and deterministic. Phaser only renders the simulation's state.

```
src/
  main.ts                    entry: boots Phaser, audio unlock, gesture guards, debug panel
  game/
    main.ts                  Phaser config (720px tall, width adapts 16:9 → 19.5:9, FIT scaling)
    config/
      tuning.ts              ★ every feel/physics/difficulty constant, documented
      hazards.ts             ★ hazard types: size, depth, impact, kicks, spacing
      difficulty.ts          ★ the three route sections (opening / middle / final)
    core/                    — pure logic, no Phaser —
      simulation.ts          RideSimulation: fixed-step ride, emits events
      road.ts                road profile, seeded constrained generator, fairness estimate
      collisions.ts          world-space wheel ↔ hazard edge/kick detection
      suspension.ts          two damped-spring wheel corners → body height + pitch
      passengerRig.ts        torso / head / hand springs (+ rough-road head rattle)
      arm.ts                 hold/release arm state machine (400 ms up, 250 ms down)
      drinking.ts            flow into mouth, miss-spill, slosh on jolts
      bottle.ts              remaining / consumed / spilled bookkeeping (conserved)
                             (simulation.ts also owns the PASSENGER_EJECTED state)
      scoring.ts             score, stars, funny verdicts
      spring.ts, rng.ts      damped spring, mulberry32 PRNG
    systems/
      input.ts               one-finger hold, multi-touch safe, cancel/blur handling
      sound.ts               Web Audio synth (engine, rumble, bumps, splash, gulp, jingles)
      settings.ts            mute / reduced motion / haptics / tutorial flag + personal best
      haptics.ts             navigator.vibrate wrapper
      share.ts               1200×630 result card + Web Share API (WhatsApp-friendly)
    render/
      textures.ts            procedural Canvas2D art → Phaser textures (placeholder art)
      ParallaxView.ts        sky, skyline, shops/trees, roadside props
      RoadView.ts            road surface, hazard visuals, destination sign
      AutoView.ts            auto, wheels, driver, passenger, IK arm, bottle + water level
      WorldView.ts           composes the world + passenger mood logic
      SplashFx.ts            pooled droplet particles
      EjectionController.ts  passenger-ejection sequence: flight, bottle, camera follow, sky
      RoofBreakEffect.ts     canopy stretch, crop-open hole, torn flaps, fragments
      Hud.ts, ui.ts          HUD and reusable buttons/panels
    scenes/
      Boot → Home → Play (ride | tutorial) → Results (overlay)
    debug/DebugPanel.ts      dev-only sliders (speed, drink rate, capacity, arm times,
                             spacing, suspension, spill sensitivity…)
tests/                       water conservation, state transitions, collision timing,
                             obstacle spacing/fairness, balance (scripted players)
scripts/probe.ts, sweep.ts   balancing tools: `npm run probe`, `npm run balance`
```

### How a frame works

1. `Play.update` accumulates real time and calls `sim.step(1/120, holding)` in fixed steps.
2. The sim moves the auto's world x forward, then checks the **front and rear wheel world
   positions** against hazard edges/kick points. Each kick impulses that wheel's suspension
   spring and the passenger rig.
3. The springs integrate. The head is loose and the hand is braced, so a jolt pulls mouth and
   bottle apart vertically (`rig.misalign`).
4. If the bottle is at the lips, water flows in proportion to alignment. Misaligned flow
   gushes onto the face. Jolts while the bottle is tipped slosh extra water out.
5. Events (`kick`, `slosh`, `gulp`, `sipEnd`, `end`…) drive sound, haptics, particles,
   floating "+12 ml / −8 ml" text and the passenger's expression.

### Fairness guarantees

The generator is seeded and constrained. Every gap between hazard blocks leaves time for the
rear wheel to clear plus a reaction window. The opening is beginner-only, and the final
section is tighter with combos. Each route is checked so that a player who **never drinks
over a hazard** still has at least 1.05× the drinking time needed. `tests/balance.test.ts`
checks that good timing wins at least 90% of seeded routes and that holding the bottle up
the whole way usually loses.

## Where to change physics and feel

| What                                   | Where                                              |
| -------------------------------------- | -------------------------------------------------- |
| Speed curve, route length (≈40 s ride)  | `tuning.ts` → `SPEED_PROFILE`, `speedScale`, `routeMeters` |
| Braking jolts (cows, signals)           | `tuning.ts` → `brake*`, `hazards.ts` → `brake`     |
| Spill limit                             | `tuning.ts` → `spillLimitMl`                       |
| Driver personalities                    | `config/drivers.ts`                                |
| Weather                                 | `config/weather.ts`, visuals in `render/WeatherView.ts` |
| Drink rate, capacity                    | `tuning.ts` → `drinkRateMlPerSec`, `capacityMl`    |
| Arm timings                             | `tuning.ts` → `raiseMs`, `lowerMs`                 |
| Bounce / pitch                          | `tuning.ts` → `suspension*`, `kickBasePxPerSec`    |
| How much bumps break alignment          | `tuning.ts` → `head*`, `hand*`, `alignTolerancePx` |
| Spill amounts                           | `tuning.ts` → `sloshMlPerImpact`, `missSpillMlPerSec`, `spillSensitivity` |
| Individual hazards                      | `hazards.ts`                                       |
| Massive pothole rarity / run-up         | `difficulty.ts` → `MASSIVE_POTHOLE`                |
| Ejection threshold (how raised = launch) | `tuning.ts` → `ejectArmThreshold`                 |
| Ejection animation timings              | `render/EjectionController.ts` → `EJECT_TIMING`    |
| Difficulty curve                        | `difficulty.ts`                                    |

After changing balance, run `npm run balance` to see scripted-player win rates and `npm test`.

## Replacing the placeholder art

All art is drawn procedurally at boot in `src/game/render/textures.ts`, keyed by name:
`sky, sun, cloud, skyline, midrow, props, road, wheel, autoBack, autoRoof, autoFront, driverHead, zebu, autoIcon`.
The canopy (`autoRoof`) is a separate layer so it can break open; keep it separate if you swap in sprites.
The auto, wheel and cow art lives in `src/game/render/autoArt.ts`; hazard art in `src/game/render/hazardArt.ts`.
Textures are drawn at the device's render scale (`render/resolution.ts`) and displayed with `TEX_SCALE`.

To use illustrated sprites:

1. Put PNGs in `public/assets/` at the same pixel sizes (see each `canvasTex(...)` call).
   The auto textures are 400×236 with the **axle midpoint at (200, 204)**, drawn for a
   190 px wheelbase. The game scales them to `TUNING.wheelbasePx`.
2. In `scenes/Boot.ts`, add a `preload()` with `this.load.image('autoFront', 'assets/autoFront.png')` etc.
   `makeTextures` skips any key that already exists.
3. The passenger (body, face expressions, arm and bottle) is drawn per frame in `AutoView.ts`.
   Its anchor points (`HIP`, `SHOULDER`, `HEAD`, `HAND_UP`…) are constants at the top of that
   file. Keep the mouth (`HEAD + MOUTH_OFF`) and bottle tip lined up at full raise.
4. Hazards are drawn in `RoadView.ts` (`drawHazard`). Swap in sprites there if needed.

## Known limitations

- Placeholder vector art; one passenger and one auto design.
- iOS Safari has no Fullscreen API on iPhone and no `navigator.vibrate`, so the game runs
  in the browser chrome and without haptics there. "Add to Home Screen" gives full screen.
- Screen orientation lock only works on Android in fullscreen. Elsewhere a "Rotate your
  phone" screen is shown and the ride auto-pauses in portrait.
- Web Share with image files depends on the browser (Android Chrome and iOS Safari support it).
  Desktop falls back to downloading the PNG card and copying the share text.
- The Baloo 2 web font loads from Google Fonts. Offline, it falls back to a system font.
- Personal best is per device and browser (localStorage). There is no global leaderboard by design.

## License

MIT. Started from the official [Phaser Vite TypeScript template](https://github.com/phaserjs/template-vite-ts).
