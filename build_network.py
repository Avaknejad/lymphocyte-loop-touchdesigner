"""
Rebuilds the "lymphocyte_loop" TouchDesigner network from scratch.

This reconstructs the exact GPU pipeline used for the black & white,
golden-ratio-structured lymphocyte / vessel loop:

    vessel_shader (GLSL TOP)  ->  bw_safety (Monochrome TOP)
                              ->  out_null (Null TOP)  ->  out1 (Out TOP)

Usage (inside TouchDesigner):
  1. Open TouchDesigner.
  2. Open a Textport (Alt+T) or a Text DAT.
  3. Run:
         exec(open('/absolute/path/to/build_network.py').read())
     (or paste the contents into the Textport)

The GLSL pixel shader is loaded from `lymphocyte_loop.frag` sitting next to
this script. Everything is created under /lymphocyte_loop.
"""

import os

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_PATH = '/lymphocyte_loop'
RES_W, RES_H = 1280, 720
LOOP_DUR = 12.0          # seconds per seamless loop

# uniform name -> constant default value (uTime is driven by an expression)
UNIFORMS = [
    ('uTime',         0.0),        # overwritten with absTime.seconds expression
    ('uLoopDur',      LOOP_DUR),
    ('uBeatFreq',     1.618),      # golden-ratio-tied beat frequency
    ('uPhi',          1.618034),   # golden ratio
    ('uExplosionAmt', 0.6),
    ('uSeed',         0.0),
]

def _script_dir():
    """Directory holding this script, however it's run.

    When exec'd from a Textport the module-level ``__file__`` may be absent or
    clobbered, so fall back to searching common locations for the .frag.
    """
    try:
        return os.path.dirname(os.path.abspath(__file__))
    except NameError:
        for cand in (project.folder,
                     os.path.join(project.folder, 'lymphocyte-loop-touchdesigner')):
            if os.path.isfile(os.path.join(cand, 'lymphocyte_loop.frag')):
                return cand
        return project.folder

FRAG_PATH = os.path.join(_script_dir(), 'lymphocyte_loop.frag')


def build():
    root = op('/')

    # Fresh start: remove any previous build.
    existing = op(BASE_PATH)
    if existing is not None:
        existing.destroy()

    base = root.create(baseCOMP, 'lymphocyte_loop')

    # --- GLSL TOP -----------------------------------------------------------
    shader = base.create(glslTOP, 'vessel_shader')
    shader.par.outputresolution = 'custom'
    shader.par.resolutionw = RES_W
    shader.par.resolutionh = RES_H
    shader.par.format = 'rgba8fixed'

    # expand the vector-uniform sequence to hold all our uniforms
    shader.seq['vec'].numBlocks = len(UNIFORMS)
    for i, (name, val) in enumerate(UNIFORMS):
        getattr(shader.par, f'vec{i}name').val = name
        getattr(shader.par, f'vec{i}valuex').val = val

    # drive uTime from the global clock
    shader.par.vec0valuex.mode = ParMode.EXPRESSION
    shader.par.vec0valuex.expr = 'absTime.seconds'

    # load the pixel shader source into the docked pixel DAT
    with open(FRAG_PATH, 'r') as f:
        shader.op('vessel_shader_pixel').text = f.read()

    # --- downstream chain ---------------------------------------------------
    bw = base.create(monochromeTOP, 'bw_safety')   # grayscale safety pass
    nul = base.create(nullTOP, 'out_null')
    out1 = base.create(outTOP, 'out1')

    bw.inputConnectors[0].connect(shader)
    nul.inputConnectors[0].connect(bw)
    out1.inputConnectors[0].connect(nul)

    # layout + flags
    for i, o in enumerate((shader, bw, nul, out1)):
        o.nodeX = i * 250
        o.nodeY = 0
        o.viewer = True

    base.cook(force=True, recurse=True)
    print('Built', BASE_PATH, '- errors:', repr(base.errors(recurse=True) or 'none'))
    return base


build()
