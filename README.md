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

## Rebirth

- `WASD` / Arrow keys: move.
- `1`-`4`: switch party leader.
- `X`: attack.
- `Z`: interact with crystals, scrolls, and Orb sanctums.
