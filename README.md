# lymphocyte_loop

A single-shader TouchDesigner piece rendered to look like a **scanning-electron-
microscope (SEM) micrograph**: black & white 3D relief, dramatic edge-lit
grayscale, spiky microvilli-studded **lymphocytes** flowing along an asymmetric,
golden-ratio-structured **vessel network**, with **connective tissue** decaying
into pores. The tissue ruptures into spiky **platelets ("plaquettes")**, then
reconstructs — as a **seamless video loop**.

Everything is generated procedurally inside one GLSL TOP — a heightfield relief
lit with SEM-style shading (directional key + edge-brightening on steep slopes +
crevice occlusion). No source footage.

![concept](docs/preview.png) <!-- optional: drop a screenshot here -->

**Rendered loop:** [`lymphocyte_loop.mp4`](lymphocyte_loop.mp4) — 1280×720, 60 fps,
exactly 12.0 s (720 frames), H.264. Rendered deterministically (uniform stepped
frame-by-frame, not realtime-captured) so every frame is exact and the loop is
seam-free.

## Concept → implementation

| Idea | How it's done |
| --- | --- |
| **SEM micrograph** look | Procedural heightfield relief; normal from height gradient; shaded with a directional key light, SEM edge-brightening (`pow(1 - N.z, k)` glows steep slopes), and crevice occlusion. |
| Spiky **lymphocytes** | Hemisphere domes on the vessel, surface studded with high-frequency fbm "microvilli"; radius pulses with the heartbeat. |
| **Asymmetric rhythm / heartbeat** | Systolic/diastolic beat (sharp attack, slow decay) traveling along the vessel; per-cell phase offsets so no two pulse together. |
| Connective tissue **decay** | A Worley pore field whose pits deepen/widen as `gDecay` rises, opening holes in the tissue sheet. |
| Pumping → **rupture → plaquettes → reconstruction → loop** | The vessel/fibre network tears (ragged remnants remain) while a dense field of craggy, filopodia-spiked platelets emerges, then everything reforms by loop wrap. |
| **Golden ratio 1.618 everywhere** | Drives fbm lacunarity/gain, vessel-wave harmonics, cell spacing, and the explosion timing thresholds (0.618, 0.764). |
| **No symmetry** | Diagonal framing, irrational harmonic phase offsets, and hash-based per-cell jitter throughout. |
| **Seamless loop** | *All* motion is periodic in `loopT`: meander/flow sway via `sin`, a whole number of heartbeats per loop (`fract`), and decay/rupture are arcs that return to zero at the wrap. Verified frame-identical at `loopT≈0` and `loopT≈1`. |

## Files

- `lymphocyte_loop.frag` — the GLSL pixel shader (the whole piece).
- `build_network.py` — rebuilds the full TouchDesigner network from scratch.

## Network

```
vessel_shader (GLSL TOP) → bw_safety (Monochrome TOP) → out_null (Null TOP) → out1 (Out TOP)
```

The GLSL TOP exposes 6 vector uniforms you can tweak live:

| Uniform | Default | Meaning |
| --- | --- | --- |
| `uTime` | `absTime.seconds` | Global clock (expression-driven) |
| `uLoopDur` | `12.0` | Seconds per seamless loop |
| `uBeatFreq` | `1.618` | Heartbeat frequency (φ-tied) |
| `uPhi` | `1.618034` | Golden ratio |
| `uExplosionAmt` | `0.6` | Fragment scatter distance |
| `uSeed` | `0.0` | Randomization seed |

## Usage

1. Open TouchDesigner (built/tested on 099 2023.11880).
2. Open a Textport (`Alt+T`) and run:
   ```python
   exec(open('/absolute/path/to/build_network.py').read())
   ```
3. View `/lymphocyte_loop/out1`.

To export the loop, route `out1` into a **Movie File Out TOP** (or Export Movie)
for `uLoopDur` seconds.

## Notes

- All periodic motion is driven from a **loop-local time** (`fract(uTime/uLoopDur) * uLoopDur`)
  rather than raw `absTime`. This keeps trig arguments small (avoiding float32
  precision breakdown at large absolute times) **and** guarantees exact whole
  cycles, so the loop is genuinely seamless.
