# Vanguard Champions: The Complete Chronicles

A static, browser-playable 13-game franchise for GitHub Pages.

The campaigns are playable, self-contained adaptations with a shared tactical engine and a separate action-adventure engine for Rebirth. They are still prototypes rather than a full cinematic production: visuals, combat depth, and narrative sequences are streamlined.

## Run

Open `index.html` through a local static server:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`.

On GitHub Pages, deploy the repository root. No build step or backend is required.

## Controls

- Select a hero or squad unit.
- Drag to move or click a destination.
- `1`-`6`: select heroes.
- `Q`, `W`, `E`: cast active abilities.
- `R`: deploy reinforcements.
- `Space`: pause.
- `G`: toggle game speed between 1× and 2×.
- Click a support tower to spend 50 gold and upgrade it (maximum tier 3).
- Touch and pointer controls are supported.

Tactical campaigns use authored wave formations, stage-specific lane paths, elite inserts, and boss waves. Some missions also add objectives such as convoy escort, crystal capture, or siphon-channeling.

## Rebirth

- `WASD` / Arrow keys: move.
- `1`-`4`: switch party leader.
- `X`: attack.
- `C`: use the current leader's unique skill.
- `Z`: interact with crystals, scrolls, and Orb sanctums.
- Interact at a campfire to heal and save a Rebirth checkpoint.

Each Rebirth region now has its own authored gate puzzle: pressure plates, beam mirrors, ordered water valves, a Wren-only sky-bridge mechanism, or character-attuned Orbs. Defeat the local guardian before interacting with puzzle objects.
