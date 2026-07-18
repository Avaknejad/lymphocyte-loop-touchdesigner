# lymphocyte_loop

A single-shader TouchDesigner piece: a black & white, microscopic view of
**lymphocytes pulsing through an asymmetric, golden-ratio-structured blood
vessel** that disintegrates, explodes into platelet-like "plaquette" fragments,
and reconstructs itself — as a **seamless video loop**.

Everything is generated procedurally inside one GLSL TOP. No source footage.

![concept](docs/preview.png) <!-- optional: drop a screenshot here -->

## Concept → implementation

| Idea | How it's done |
| --- | --- |
| Lymphocytes contracting in a narrow vessel, **asymmetric rhythm** | Irregular systolic/diastolic pulse (sharp attack, slow decay) with a period that wobbles via noise, so the beat never repeats symmetrically. |
| Cells moving **up/down like a heartbeat** | Cells drift along the vessel with a traveling pulse wave; radius pulses with it. |
| **Black & white**, microscopic | Grayscale-only output + fine photographic grain, plus a Monochrome TOP safety pass. |
| Connective tissue **disintegrating with limited movement** | A noise field inside the walls only shifts its *threshold* over time (no positional motion) — holes open, nothing translates. |
| Pumping reaches nothing → **explosion → plaquette reconstruction → loop** | Near the end of each cycle the frame fractures into scattered chunks, peaks, then reassembles exactly by loop wrap. |
| **Golden ratio 1.618 everywhere** | Drives fbm lacunarity/gain, vessel-wave harmonics, cell spacing, chunk-grid density, and the explosion timing thresholds (0.618, 0.764). |
| **No symmetry** | Distinct phases, irrational phase offsets, and hash-based jitter throughout. |

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
