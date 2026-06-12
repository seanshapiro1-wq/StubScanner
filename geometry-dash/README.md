# Geometric Dash

A Geometry Dash style game in plain HTML5 canvas — no dependencies, no build step.

## Play

Open `index.html` in any browser, or serve the folder:

```sh
cd geometry-dash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Controls

| Input | Action |
|---|---|
| Click / tap / Space / Up | Jump · flip · teleport (hold for ship & wave) |
| R | Restart attempt |
| Esc | Back to level select |

## Gamemodes

- **Cube** — tap (or hold) to jump
- **Ship** — hold to fly up, release to fall
- **Ball** — tap to flip gravity while rolling
- **UFO** — tap for a flappy-style boost
- **Wave** — hold to glide up, release to glide down; touching blocks is fatal
- **Spider** — tap to instantly teleport to the opposite surface

Plus **gravity portals** (upside-down sections), **mini/big portals**, **jump pads**,
and **jump orbs** (tap while overlapping).

## Levels

1. **Breezy Lane** (easy, ★2) — a gentle tour through every gamemode
2. **Neon Inferno** (hard, ★8) — triple spikes, upside-down cube & UFO, mini cube and mini wave

Best progress per level is saved in your browser (localStorage).
