import * as THREE from 'three';

/**
 * Owns the WebGL renderer for one new-tab page.
 *
 * Chrome keeps ~16 live WebGL contexts per origin, and every Marumado tab shares the
 * extension origin, so tabs left open would push the oldest into "context lost".
 * The host therefore gives the GPU back when the tab has been hidden for a while,
 * and rebuilds (or recovers) the context when the tab is shown again. Scene objects
 * survive: three.js re-uploads geometry and textures to the new context.
 */
export type GlState = 'ready' | 'released' | 'lost' | 'unsupported';

const RELEASE_AFTER_HIDDEN_MS = 20_000;

export interface GlHost {
  readonly state: GlState;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  resize(width: number, height: number): void;
}

export function supportsWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext(); // don't hold a context slot for the probe
    return !!gl;
  } catch {
    return false;
  }
}

export function createGlHost(
  container: HTMLElement,
  opts: { capture?: boolean; onChange: (state: GlState) => void },
): GlHost {
  let renderer: THREE.WebGLRenderer | null = null;
  let state: GlState = 'released';
  let size = { w: innerWidth, h: innerHeight };
  let releaseTimer = 0;

  const set = (s: GlState) => {
    state = s;
    container.dataset.gl = s;
    opts.onChange(s);
  };

  function acquire() {
    if (state === 'ready' || state === 'unsupported') return;
    release();
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!opts.capture });
    } catch {
      set('unsupported');
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.setSize(size.w, size.h);
    const canvas = renderer.domElement;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault(); // allow a restore if the browser offers one
      set('lost');
    });
    canvas.addEventListener('webglcontextrestored', () => set('ready'));
    container.appendChild(canvas);
    set('ready');
  }

  function release() {
    if (!renderer) return;
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    renderer = null;
    if (state !== 'unsupported') set('released');
  }

  document.addEventListener('visibilitychange', () => {
    clearTimeout(releaseTimer);
    if (document.visibilityState === 'hidden') {
      releaseTimer = window.setTimeout(release, RELEASE_AFTER_HIDDEN_MS);
    } else {
      acquire(); // also recovers a context Chrome took away while we were hidden
    }
  });
  // A context lost while visible (e.g. >16 Marumado tabs visible across windows) is only
  // re-acquired when the user comes back to this tab. Re-acquiring immediately would make
  // visible tabs steal contexts from each other forever.
  addEventListener('focus', acquire);
  addEventListener('pointerdown', acquire);

  if (!supportsWebGL2()) set('unsupported');
  else if (document.visibilityState === 'visible') acquire();
  else set('released');
  // A tab opened in the background (e.g. session restore) waits until it is shown.

  return {
    get state() {
      return state;
    },
    render(scene, camera) {
      if (state === 'ready' && renderer) renderer.render(scene, camera);
    },
    resize(width, height) {
      size = { w: width, h: height };
      renderer?.setSize(width, height);
    },
  };
}
