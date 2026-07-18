// Uniforms wired from glslTOP: uTime, uLoopDur, uBeatFreq, uPhi, uExplosionAmt, uSeed
uniform float uTime;
uniform float uLoopDur;
uniform float uBeatFreq;
uniform float uPhi;
uniform float uExplosionAmt;
uniform float uSeed;

out vec4 fragColor;

float hash1(float n) { return fract(sin(n) * 43758.5453123); }
float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
vec2 hash2(vec2 p) {
    float n = dot(p, vec2(127.1, 311.7));
    return fract(sin(vec2(n, n + 57.31)) * vec2(43758.5453, 22578.145));
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash1(i);
    float b = hash1(i + vec2(1.0, 0.0));
    float c = hash1(i + vec2(0.0, 1.0));
    float d = hash1(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// fbm lacunarity/gain both derived from the golden ratio, tying every
// spatial octave to 1.618 as requested.
float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
        v += amp * vnoise(p);
        p *= uPhi;
        amp /= uPhi;
    }
    return v;
}

// Irregular systolic/diastolic beat: sharp attack, slow decay, period
// itself wobbling so the rhythm never repeats symmetrically.
float heartbeat(float t) {
    float freq = uBeatFreq * (1.0 + 0.35 * vnoise(vec2(t * 0.07, uSeed)));
    float phase = fract(t * freq);
    float systole = pow(max(sin(phase * 3.14159265), 0.0), 6.0);
    float diastole = exp(-phase * 4.0) * 0.4;
    return clamp(systole + diastole, 0.0, 1.3);
}

// Wavy, asymmetric vessel centerline: each harmonic's frequency and
// amplitude step by uPhi, phases offset by an irrational increment so
// nothing mirrors.
float vesselPath(float y, float t) {
    float x = 0.0;
    float amp = 0.24;
    float freq = 1.3;
    float ph = uSeed * 6.2831 + 0.7;
    for (int i = 0; i < 4; i++) {
        x += amp * sin(freq * y + ph + t * 0.15 * float(i + 1));
        freq *= uPhi;
        amp /= uPhi;
        ph += 2.399963;
    }
    return x;
}

float vesselWidth(float y, float pulse) {
    float base = 0.16 + 0.025 * vnoise(vec2(y * 0.55, uSeed + 3.1));
    float contraction = 1.0 - 0.35 * pulse;
    return base * contraction;
}

void main() {
    vec2 res = uTDOutputInfo.res.zw;
    vec2 uv = (vUV.st * 2.0 - 1.0);
    uv.x *= res.x / res.y;

    float loopT = fract(uTime / uLoopDur);
    // All periodic motion is driven from this loop-local time instead of
    // raw uTime: keeps trig arguments small (avoids float32 precision
    // breakdown at large absolute times) and guarantees the animation
    // completes exact whole cycles, so the loop is truly seamless.
    float tLoop = loopT * uLoopDur;

    // Explosion/reconstruction arc lives entirely inside the loop so
    // frame(loopT=1) == frame(loopT=0): rises 0.618->0.86 (phi-derived),
    // falls back to 0 by loopT==1, giving a seamless burst + reform.
    float expStart = 1.0 - 1.0 / (uPhi * uPhi);   // ~0.618
    float expPeak  = 1.0 - 1.0 / (uPhi * uPhi * uPhi); // ~0.764
    float explosionT;
    if (loopT < expStart) {
        explosionT = 0.0;
    } else if (loopT < expPeak) {
        explosionT = smoothstep(expStart, expPeak, loopT);
    } else {
        explosionT = 1.0 - smoothstep(expPeak, 1.0, loopT);
    }
    float flashBoost = smoothstep(expStart, expPeak, loopT) * (1.0 - smoothstep(expPeak, 0.94, loopT));

    // Fragment the frame into "plaquette" chunks; each chunk samples
    // from an offset position, scattering it outward during explosionT.
    vec2 chunkUV = uv * (3.0 * uPhi);
    vec2 chunkId = floor(chunkUV);
    vec2 chunkHash = hash2(chunkId + uSeed * 11.0);
    vec2 dir = normalize(chunkHash - 0.5 + 0.0001);
    vec2 wuv = uv - dir * explosionT * uExplosionAmt * (0.4 + 0.8 * chunkHash.x);

    float y = wuv.y;
    float centerX = vesselPath(y, tLoop);
    float dx = wuv.x - centerX;

    float travelPulse = heartbeat(tLoop - y * 0.8);
    float w = vesselWidth(y, travelPulse);

    float aaV = fwidth(dx) * 1.5 + 0.001;
    float vesselMask = smoothstep(w + aaV, w - aaV, abs(dx));
    float wallMask = smoothstep(w + 0.02 + aaV, w + 0.02 - aaV, abs(dx)) - vesselMask;

    // Lymphocytes: golden-ratio-spaced along the vessel, drifting like
    // blood flow, radius pulsing with the traveling heartbeat wave.
    float cellSpacing = 0.35 * uPhi;
    float flow = tLoop * 0.12;
    float yFlow = y - flow;
    float cellIndex = floor(yFlow / cellSpacing);
    float yLocal = yFlow - cellIndex * cellSpacing - cellSpacing * 0.5;
    vec2 cellHash = hash2(vec2(cellIndex, uSeed * 7.0));
    float jitterX = (cellHash.x - 0.5) * 0.09;
    float cellPhase = cellHash.y;
    float cellCenterX = vesselPath(y, tLoop) + jitterX;
    float cellDx = wuv.x - cellCenterX;
    float cellPulse = heartbeat(tLoop - y * 0.8 + cellPhase * 2.0);
    float cellR = (0.045 + 0.02 * cellHash.x) * (0.6 + 0.8 * cellPulse);
    float dCell = length(vec2(cellDx, yLocal)) - cellR;
    float aaC = fwidth(dCell) * 1.5 + 0.001;
    float cellMask = smoothstep(aaC, -aaC, dCell);

    // Connective tissue disintegrating: only the noise threshold shifts
    // over loopT (no positional movement), opening more holes near the
    // explosion phase.
    float tissueNoise = fbm(wuv * 6.0 + vec2(0.0, tLoop * 0.05));
    float erosion = smoothstep(0.35, expStart, loopT);
    float tissueMask = smoothstep(0.5 - 0.45 * erosion, 0.52, tissueNoise);

    float v = 0.0;
    v += vesselMask * (0.15 + 0.25 * tissueMask);
    v += wallMask * 0.6;
    v += cellMask * (0.9 + 0.5 * flashBoost);

    // Fine photographic grain, kept black & white throughout.
    float grain = hash1(uv * res.xy * 0.001 + tLoop * 60.0);
    v += (grain - 0.5) * 0.03;

    v = clamp(v, 0.0, 1.4);

    fragColor = TDOutputSwizzle(vec4(vec3(v), 1.0));
}
