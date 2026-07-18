// ---------------------------------------------------------------------------
// lymphocyte_loop  --  SEM (scanning-electron-microscope) relief render
//
// Black & white micrograph look: 3D organic relief lit like an SEM detector
// (strong edge-brightening on steep slopes, crevice occlusion). A meandering,
// asymmetric fibrous vessel network carries spiky lymphocytes that pulse with
// an irregular heartbeat; the connective tissue decays into pores, the frame
// ruptures into spiky platelets ("plaquettes"), then reconstructs -> loop.
//
// Everything keyed to the golden ratio (uPhi = 1.618). No symmetry.
// ---------------------------------------------------------------------------
uniform float uTime;
uniform float uLoopDur;
uniform float uBeatFreq;
uniform float uPhi;
uniform float uExplosionAmt;
uniform float uSeed;

out vec4 fragColor;

#define TAU 6.2831853
#define BEATS 8.0     // whole heartbeats per loop -> seamless wrap

// loop-scoped globals (set in main, read by the height field H)
float gLoopT;    // 0..1 phase through the loop
float gAng;      // TAU * gLoopT  (loop angle, for periodic motion)
float gExp;      // explosion amount 0..1
float gDecay;    // connective-tissue decay 0..1

// ---------------------------------------------------------------------------
// hashing / noise
// ---------------------------------------------------------------------------
float hash1(float n) { return fract(sin(n) * 43758.5453123); }
float hash1(vec2 p)  { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
vec2  hash2(vec2 p) {
    float n = dot(p, vec2(127.1, 311.7));
    return fract(sin(vec2(n, n + 57.31)) * vec2(43758.5453, 22578.145));
}

float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float a = hash1(i);
    float b = hash1(i + vec2(1.0, 0.0));
    float c = hash1(i + vec2(0.0, 1.0));
    float d = hash1(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

// fbm: lacunarity & gain both = golden ratio, tying every octave to 1.618
float fbm(vec2 p) {
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 5; i++) {
        v += amp * vnoise(p);
        p *= uPhi;
        amp /= uPhi;
    }
    return v;
}

// Worley F1 (nearest feature-point distance) -- pores & platelet seeds
float worleyF1(vec2 p, float jitter) {
    vec2 ip = floor(p), fp = fract(p);
    float d = 1e9;
    for (int j = -1; j <= 1; j++)
    for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 o = hash2(ip + g);
        vec2 r = g + (0.5 + jitter * (o - 0.5)) - fp;
        d = min(d, dot(r, r));
    }
    return sqrt(d);
}

// ---------------------------------------------------------------------------
// asymmetric meandering vessel centreline (golden-ratio harmonic stack)
// ---------------------------------------------------------------------------
float vesselPath(float y) {
    float x = 0.0, amp = 0.40, freq = 1.0, ph = uSeed * 6.2831 + 0.7;
    for (int i = 0; i < 4; i++) {
        // periodic sway (sin of loop angle) keeps the meander seamless
        x += amp * sin(freq * y + ph + 0.5 * sin(gAng + float(i)));
        freq *= uPhi;
        amp  /= uPhi;
        ph   += 2.399963;      // irrational offset -> never mirrors
    }
    return x;
}

// irregular systolic/diastolic heartbeat. Argument is in *beat units*
// (1.0 = one beat); fract() makes it exactly periodic, so a whole number of
// beats per loop wraps seamlessly. Asymmetry comes from the spatial phase.
float heartbeat(float beatPos) {
    float x = fract(beatPos);
    float systole  = pow(max(sin(x * 3.14159265), 0.0), 6.0);
    float diastole = exp(-x * 4.0) * 0.4;
    return clamp(systole + diastole, 0.0, 1.3);
}

// ---------------------------------------------------------------------------
// height field  --  the 3D relief the SEM "sees"
// ---------------------------------------------------------------------------
float H(vec2 p) {
    // --- connective-tissue sheet with pores (decay opens holes) -----------
    float sheet = 0.08 + 0.03 * fbm(p * 1.4 + 5.0);
    float pore  = worleyF1(p * 1.25 + 3.0, 1.0);
    // deeper, wider pits as tissue decays
    float pit   = smoothstep(0.0, 0.10 + 0.22 * gDecay, pore);
    sheet *= mix(1.0, pit, 0.55 + 0.45 * gDecay);

    // --- fibrous vessel network (thin ropey strands) ----------------------
    vec2 w = vec2(fbm(p * 0.5 + 11.0), fbm(p * 0.5 + 27.0));
    vec2 q = p + 1.15 * (w - 0.5);
    float n = fbm(q * 0.95);
    float ridge = 1.0 - abs(2.0 * n - 1.0);
    ridge = smoothstep(0.55, 1.0, clamp(ridge, 0.0, 1.0));   // thin ropes, dark gaps
    float fibreH = ridge * 0.32;

    // main pulsing vessel following the meander, thicker & bright
    float cx = vesselPath(p.y);
    float dxv = p.x - cx;
    float beat = heartbeat(gLoopT * BEATS - p.y * 0.13);
    float vw = 0.34 * (1.0 - 0.22 * beat);
    float tube = smoothstep(vw, 0.0, abs(dxv));
    float vesselH = pow(tube, 0.7) * 0.5;      // rounded tube cross-section

    // fibres/vessels tear during the rupture (ragged remnants stay), rebuild
    float tear = 1.0 - 0.6 * gExp * (0.4 + 0.6 * fbm(p * 3.0 + 40.0));
    float structure = max(fibreH, vesselH) * tear;

    float h = max(sheet, structure);

    // --- lymphocytes: spheres w/ microvilli, golden-spaced, drifting ------
    float cellSpacing = 0.42 * uPhi;
    float flow = 0.16 * sin(gAng);             // gentle periodic sway (seamless)
    float yF = p.y - flow;
    float baseIdx = floor(yF / cellSpacing);
    for (int k = -1; k <= 1; k++) {
        float ci = baseIdx + float(k);
        vec2  ch = hash2(vec2(ci, uSeed * 7.0));
        float cy = (ci + 0.5) * cellSpacing + flow;             // world y
        float cxc = vesselPath(cy) + (ch.x - 0.5) * 0.10;       // on the vessel
        // scatter outward during rupture (each cell its own direction)
        vec2 dir = normalize(ch - 0.5 + 0.001);
        vec2 cc = vec2(cxc, cy) + dir * gExp * uExplosionAmt * (0.4 + 0.7 * ch.x);
        float cpulse = heartbeat(gLoopT * BEATS - cy * 0.13 + ch.y);
        float cr = (0.15 + 0.11 * ch.x) * (0.9 + 0.2 * cpulse) * (1.0 - 0.35 * gExp);
        float d = length(p - cc);
        if (d < cr) {
            float rim  = smoothstep(cr, cr * 0.8, d);           // fade to edge (no disk)
            float dome = sqrt(max(cr * cr - d * d, 0.0)) / cr;  // 0..1 hemisphere
            // microvilli: fine radial roughness studding the cell surface
            float villi = fbm((p - cc) * 30.0 + ci) - 0.5;
            float add = (0.34 + dome * 0.95 + villi * 0.18 * dome) * rim;
            h = max(h, add);
        }
    }

    // --- platelets ("plaquettes"): small spiky bodies with filopodia ------
    if (gExp > 0.02) {
        float amt = smoothstep(0.05, 0.5, gExp);
        float pf  = worleyF1(p * 3.8 + 71.0, 1.0);
        float body = smoothstep(0.46, 0.02, pf);            // compact blob
        // filopodia / spikes: craggy high-freq ridging pulls bright peaks out
        float rough = fbm(p * 24.0 + 9.0);
        float spikes = pow(clamp(1.0 - abs(2.0 * rough - 1.0), 0.0, 1.0), 2.0);
        float platelet = body * (0.55 + 0.55 * pow(body, 1.5) + 0.5 * spikes);
        h = max(h, platelet * 0.85 * amt);
    }

    return h;
}

// ---------------------------------------------------------------------------
void main() {
    vec2 res = uTDOutputInfo.res.zw;
    vec2 uv = (vUV.st * 2.0 - 1.0);
    uv.x *= res.x / res.y;
    vec2 p = uv * 1.8;                         // world scale / zoom
    float ca = cos(0.42), sa = sin(0.42);      // diagonal framing (asymmetry)
    p = mat2(ca, -sa, sa, ca) * p;

    // ---- loop timing -----------------------------------------------------
    gLoopT = fract(uTime / uLoopDur);
    gAng   = TAU * gLoopT;                      // loop angle (periodic motion)

    // explosion arc lives inside the loop: rise ~0.618 -> peak ~0.764 -> 0
    float expStart = 1.0 - 1.0 / (uPhi * uPhi);
    float expPeak  = 1.0 - 1.0 / (uPhi * uPhi * uPhi);
    if (gLoopT < expStart)      gExp = 0.0;
    else if (gLoopT < expPeak)  gExp = smoothstep(expStart, expPeak, gLoopT);
    else                        gExp = 1.0 - smoothstep(expPeak, 1.0, gLoopT);
    // decay rises then heals back to 0 by loop end -> pores don't pop on wrap
    gDecay = smoothstep(0.30, expPeak, gLoopT) * (1.0 - smoothstep(expPeak, 1.0, gLoopT));

    // ---- height + normal (forward differences) ---------------------------
    float eps = 1.6 / res.y;
    float hC = H(p);
    float hX = H(p + vec2(eps, 0.0));
    float hY = H(p + vec2(0.0, eps));
    float relief = 0.9;
    vec3 nrm = normalize(vec3(-(hX - hC) / eps, -(hY - hC) / eps, relief));

    // ---- SEM-style shading ----------------------------------------------
    // primary electron-beam / detector direction (top-left, toward viewer)
    vec3 L = normalize(vec3(-0.55, 0.65, 0.55));
    float diff = clamp(dot(nrm, L), 0.0, 1.0);

    // SEM signature: edges facing away from the surface plane glow (steep
    // slopes brighten) -- the "edge effect". Kept as a rim, not a blowout.
    float edge = pow(1.0 - nrm.z, 2.2);

    // crevice / height occlusion: low sunken areas read dark
    float ao = smoothstep(0.02, 0.5, hC);

    // secondary fill so shadows aren't pure black (dark background)
    float fill = 0.05 + 0.10 * clamp(nrm.z, 0.0, 1.0);

    float v = ao * (fill + 0.80 * diff) + 0.45 * edge * mix(0.25, 1.0, ao);

    // gentle "charging" hotspots only on the very brightest rims (SEM look)
    v += smoothstep(0.9, 1.3, v) * 0.25;

    // fine detector grain (static -> stays seamless across the wrap)
    float grain = hash1(uv * res.xy * 0.7311) - 0.5;
    v += grain * 0.04;

    // subtle vignette (micrograph framing)
    v *= 1.0 - 0.25 * dot(uv, uv) * 0.35;

    v = clamp(v, 0.0, 1.0);
    v = pow(v, 0.9);                           // slight lift in the mids

    fragColor = TDOutputSwizzle(vec4(vec3(v), 1.0));
}
