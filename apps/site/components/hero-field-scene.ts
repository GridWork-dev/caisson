/**
 * Homepage signature piece — the ambient depth-fog lattice FIELD (ADR-0306, executes ADR-0078 §6).
 *
 * This is the imperative three.js scene: a barely-there instanced grid of thin structural columns
 * receding into depth fog behind the hero, with a slow accent scan-line sweep (the health-check
 * pulse) and pointer parallax. It is an ENVIRONMENT, not an object — Refero calibration (Dovetail
 * "wireframe grids are atmospheric backgrounds, not content"; Index "thin structure, ample void,
 * accent only as a small travelling indicator").
 *
 * Loaded ONLY via a dynamic import() from `hero-field-canvas.tsx` after the idle/lg/no-reduced-motion
 * gate passes — so it is the home-route-only lazy chunk ADR-0306 §3 budgets at ≤130KB gzip, and it
 * NEVER downloads on mobile. Named imports from "three" only, so the core tree-shakes (no R3F, no
 * drei, no postprocessing — all banned by ADR-0306).
 *
 * Colours are the sRGB conversions of the ADR-0042/0078 palette-A OKLCH tokens (three can't read the
 * `--cs-*` CSS vars) — computed once with culori, NOT eyeballed. Source OKLCH is noted at each value.
 * We feed raw sRGB vec3 uniforms and output them directly (no three colour-management round-trip), so
 * the canvas interpolates in the same sRGB space as the poster's CSS gradients — the two stay matched.
 */
import {
  BoxGeometry,
  Clock,
  getConsoleFunction,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  Quaternion,
  Scene,
  setConsoleFunction,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

export interface FieldHandle {
  pause(): void;
  resume(): void;
  /** Recolour in place on a live theme toggle — no teardown/remount. */
  setDark(dark: boolean): void;
  /** Waterline Descent (ADR-0334 §3a — the ONE scroll-fed input): 0 = surface (rest fog),
   *  1 = fully scrolled past — the depth fog thickens and far rods dissolve sooner. */
  setDescent(progress: number): void;
  dispose(): void;
}

interface Palette {
  /** Brightest structural tone (rod tops). */
  rod: string;
  /** Deep/waterline tone (rod bottoms — the depth-darkening motif). */
  rodDeep: string;
  /** The ONE accent — appears only in the scan-line seam (well under the 10% budget). */
  accent: string;
  /** Intrinsic field strength (rod alpha ceiling); the CSS fade-in is separate. */
  opacity: number;
}

// sRGB hex = culori oklch->rgb of the palette-A tokens (packages/ui/src/tokens/candidates.ts).
const DARK: Palette = {
  rod: "#464f52", // oklch(0.42 0.012 220) — border-strong, wet-steel
  rodDeep: "#0f171a", // oklch(0.20 0.013 220) — surface-1, a hair above bg #080f11 (waterline)
  accent: "#34bfcd", // oklch(0.74 0.115 205) — the instrument light
  opacity: 0.5,
};
const LIGHT: Palette = {
  rod: "#b7bfc2", // oklch(0.80 0.010 220) — border-strong (darker than the near-white bg)
  rodDeep: "#eaeff1", // oklch(0.95 220) — surface-2, fades toward bg #fafcfd at the bottom
  accent: "#007491", // oklch(0.50 0.13 215) — light-theme accent
  opacity: 0.36,
};

function hexToVec3(hex: string): Vector3 {
  const n = Number.parseInt(hex.slice(1), 16);
  return new Vector3(
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  );
}

// Deterministic per-instance jitter — a seeded hash, no RNG dependency, so the field is identical
// every mount (the poster's static rest-frame stays a faithful preview of it).
function hash(i: number): number {
  const s = Math.sin(i * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

// Grid dimensions. Columns are TALL (tops leave the frame / dissolve in the fog mask) so the field
// reads as structural members RECEDING into depth — not a bar chart of distinct tops. Denser + finer
// than distinct bars, so it registers as atmosphere/texture (Refero: "wireframe grids are
// atmospheric backgrounds, not content"; ample void via the fog + the scrim).
const NX = 30; // columns across
const NZ = 24; // rows into depth
const COUNT = NX * NZ;
const SPACING_X = 1.15;
const SPACING_Z = 1.5;
const Z_NEAR = -2;
const SWEEP_PERIOD = 9; // seconds — a slow health-check pulse, not a strobe

const VERTEX = /* glsl */ `
  varying float vWorldY;
  varying float vWorldZ;
  varying float vViewDepth;
  void main() {
    vec4 world = instanceMatrix * vec4(position, 1.0);
    vWorldY = world.y;
    vWorldZ = world.z;
    vec4 mv = modelViewMatrix * world;
    vViewDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uRod;
  uniform vec3 uRodDeep;
  uniform vec3 uAccent;
  uniform float uOpacity;
  uniform float uFogDensity;
  uniform float uSweep;   // current scan-line position along Z
  varying float vWorldY;
  varying float vWorldZ;
  varying float vViewDepth;
  void main() {
    // Depth-darkening waterline (ADR-0078 §4): the lower a column sits, the closer it sinks to the
    // deep tone — the darkening spans most of the tall column so the bottom baseline reads as a
    // waterline the structure stands in.
    float yf = smoothstep(-1.0, 7.0, vWorldY);
    vec3 col = mix(uRodDeep, uRod, yf);

    // Scan-line sweep — a soft gaussian band of the accent travelling through the lattice (the
    // health-check pulse). Gentle: a brightening, not a strobe.
    float band = exp(-pow((vWorldZ - uSweep) * 0.55, 2.0));
    col = mix(col, uAccent, band * 0.5 * yf);
    col += uAccent * band * 0.12;

    // Depth fog by view distance (exp2) — far rods dissolve. Alpha only, so the real page bg shows
    // through and the field seams perfectly into it (no painted fog colour to drift from --cs-bg).
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * vViewDepth * vViewDepth);
    float alpha = uOpacity * (1.0 - clamp(fog, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
  }
`;

/**
 * Mount the field onto `canvas`. Returns a handle (pause/resume/dispose) or null when a WebGL
 * context can't be created — the caller keeps the poster in that case (ADR-0306 resilience).
 */
export function mountDepthField(
  canvas: HTMLCanvasElement,
  dark: boolean,
): FieldHandle | null {
  const pal = dark ? DARK : LIGHT;

  // Capability probe BEFORE touching three.js at all (browser-audit P2-007): when Chrome can't
  // allocate a context, `new THREE.WebGLRenderer()` doesn't just throw once and stop — its
  // constructor calls three's own `error()` (→ console.error) on the way to re-throwing, so a
  // guarded `new WebGLRenderer()` still leaves a logged error every time this mounts. The probe
  // must carry the REAL context attributes: a canvas hands back its already-created context on
  // every later `getContext` call and silently ignores the second attribute dict, so attributes
  // passed only to the WebGLRenderer constructor would never apply. Probe with them and hand the
  // context to three below — that keeps `powerPreference: "low-power"` honest (an ambient bg must
  // not wake the discrete GPU).
  let gl: WebGL2RenderingContext | null;
  try {
    gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: true,
      powerPreference: "low-power",
    });
  } catch {
    return null;
  }
  if (!gl) return null;

  let renderer: WebGLRenderer;
  const prevConsoleFn = getConsoleFunction();
  // Belt-and-suspenders for the narrower mid-init failure (bare probe succeeds, but the renderer's
  // OWN context-attribute request fails) — silence three.js's own console hook for just this one
  // attempt via its documented interception API, not a global console.error patch. Always restored,
  // success or failure, so any later legitimate three.js error still surfaces normally.
  setConsoleFunction(() => {});
  try {
    // Attributes already live on the probed context above — three reuses it verbatim.
    renderer = new WebGLRenderer({ canvas, context: gl });
  } catch {
    return null;
  } finally {
    setConsoleFunction(prevConsoleFn);
  }
  // Software rasterizers (SwiftShader/llvmpipe — GPU-less VMs, remote desktops, CI) burn whole
  // CPU cores per frame on this scene; the poster is the designed experience there, same as
  // no-WebGL. Also what keeps the error-level Lighthouse run honest (it audits the real page,
  // not 30s of software-GL blocking time).
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const glRenderer = String(
      dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "",
    );
    if (/swiftshader|llvmpipe|software|basic render/i.test(glRenderer)) {
      renderer.dispose();
      return null;
    }
  } catch {
    // Detection failing is not a reason to drop the field on real hardware.
  }
  renderer.setClearAlpha(0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // ADR-0306: dpr capped at 2

  const scene = new Scene();
  const camera = new PerspectiveCamera(52, 1, 0.1, 120);
  const camBase = new Vector3(0, 2.4, 6.2);
  const lookAt = new Vector3(0, 1.7, -18);

  const geometry = new BoxGeometry(1, 1, 1);
  // Concrete uniforms object (not index-accessed off material.uniforms) so strict
  // noUncheckedIndexedAccess sees each field as defined. ShaderMaterial keeps this same ref.
  const REST_FOG = 0.058;
  const uniforms = {
    uRod: { value: hexToVec3(pal.rod) },
    uRodDeep: { value: hexToVec3(pal.rodDeep) },
    uAccent: { value: hexToVec3(pal.accent) },
    uOpacity: { value: pal.opacity },
    uFogDensity: { value: REST_FOG },
    uSweep: { value: Z_NEAR },
  };
  const material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthTest: false, // painter's order (instances built far->near); no depth buffer needed
    depthWrite: false,
    uniforms,
  });

  const mesh = new InstancedMesh(geometry, material, COUNT);
  const m = new Matrix4();
  const pos = new Vector3();
  const quat = new Quaternion(); // identity — rods stay axis-aligned
  const scl = new Vector3();

  // Build instances FAR -> NEAR so painter's-order (depthTest off) draws nearer rods over farther.
  let i = 0;
  for (let iz = NZ - 1; iz >= 0; iz--) {
    const z = Z_NEAR - iz * SPACING_Z;
    for (let ix = 0; ix < NX; ix++) {
      const jx = hash(i) - 0.5;
      const jz = hash(i + 97) - 0.5;
      const x = (ix - (NX - 1) / 2) * SPACING_X + jx * 0.5;
      // Tall columns rooted at the y=0 waterline; tops rise out of frame / into the fog mask.
      const height = 6.5 + hash(i + 31) * 5.5;
      pos.set(x, height / 2, z + jz * 0.5);
      scl.set(0.05, height, 0.05); // thin rods
      m.compose(pos, quat, scl);
      mesh.setMatrixAt(i, m);
      i++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  // --- interaction + loop state ---
  const pointer = new Vector2(0, 0); // target, normalised -1..1
  const eased = new Vector2(0, 0); // lerped
  const clock = new Clock();
  let elapsed = 0; // accumulated RUNNING time (paused gaps discarded) — sweep never jumps
  let raf = 0;
  let running = false;

  function onPointerMove(e: PointerEvent) {
    pointer.set(
      (e.clientX / window.innerWidth) * 2 - 1,
      (e.clientY / window.innerHeight) * 2 - 1,
    );
  }

  function resize() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame() {
    if (!running) return;
    elapsed += clock.getDelta();
    const t = elapsed;

    // Scan-line: ease it from near to far across the depth each period (the pulse), then wrap.
    const zFar = Z_NEAR - (NZ - 1) * SPACING_Z;
    const phase = (t % SWEEP_PERIOD) / SWEEP_PERIOD;
    const e =
      phase < 0.5 ? 2 * phase * phase : 1 - Math.pow(-2 * phase + 2, 2) / 2; // ease-in-out
    uniforms.uSweep.value = Z_NEAR + (zFar - Z_NEAR) * e;

    // Gentle parallax: pointer + a slow autonomous drift so the depth breathes without a pointer.
    eased.lerp(pointer, 0.04);
    const driftX = Math.sin(t * 0.13) * 0.25;
    const driftY = Math.cos(t * 0.09) * 0.12;
    camera.position.set(
      camBase.x + eased.x * 1.1 + driftX,
      camBase.y - eased.y * 0.5 + driftY,
      camBase.z,
    );
    camera.lookAt(lookAt);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  resize();

  function resume() {
    if (running) return;
    running = true;
    clock.getDelta(); // drop the paused interval so the sweep doesn't jump
    raf = requestAnimationFrame(frame);
  }
  function pause() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  resume();

  return {
    pause,
    resume,
    setDark(next: boolean) {
      const p = next ? DARK : LIGHT;
      uniforms.uRod.value.copy(hexToVec3(p.rod));
      uniforms.uRodDeep.value.copy(hexToVec3(p.rodDeep));
      uniforms.uAccent.value.copy(hexToVec3(p.accent));
      uniforms.uOpacity.value = p.opacity;
      if (!running) renderer.render(scene, camera); // repaint if paused
    },
    setDescent(progress: number) {
      // +55% fog at full descent — far rods dissolve as the pressure comes on. The RAF loop
      // renders it on the next frame; no forced repaint (a paused field is offscreen anyway).
      const t = Math.min(1, Math.max(0, progress));
      uniforms.uFogDensity.value = REST_FOG * (1 + 0.55 * t);
    },
    dispose() {
      pause();
      ro.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
