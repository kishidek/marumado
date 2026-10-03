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

/** Short: tabs left behind give their GPU slot back quickly (Chrome allows ~16 per extension). */
const RELEASE_AFTER_HIDDEN_MS = 5_000;

export interface GlHost {
  readonly state: GlState;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  /** Light mode: lower resolution and no antialiasing (rebuilds the context if it changes). */
  setLight(on: boolean): void;
  resize(width: number, height: number): void;
}

export function createGlHost(
  container: HTMLElement,
  opts: { capture?: boolean; onChange: (state: GlState) => void },
): GlHost {
  let renderer: THREE.WebGLRenderer | null = null;
  let state: GlState = 'released';
  let size = { w: innerWidth, h: innerHeight };
  let releaseTimer = 0;
  let light = false;

  const set = (s: GlState) => {
    state = s;
    container.dataset.gl = s;
    opts.onChange(s);
  };

  function acquire() {
    if (state === 'ready' || state === 'unsupported') return;
    release();
    // No separate "is WebGL there?" probe: it would spend a second context slot per tab.
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !light, preserveDrawingBuffer: !!opts.capture, powerPreference: light ? 'low-power' : 'default' });
    } catch {
      set('unsupported');
      return;
    }
    renderer.setPixelRatio(light ? 1 : Math.min(devicePixelRatio, 1.75));
    renderer.setSize(size.w, size.h);
    const canvas = renderer.domElement;
    // Loss events arrive asynchronously: ignore them once this canvas is no longer the live one
    // (e.g. we released it ourselves and already created a new context).
    const current = () => renderer?.domElement === canvas;
    canvas.addEventListener('webglcontextlost', (e) => {
      if (!current()) return;
      e.preventDefault(); // allow a restore if the browser offers one
      set('lost');
    });
    canvas.addEventListener('webglcontextrestored', () => current() && set('ready'));
    container.appendChild(canvas);
    set('ready');
  }

  function release() {
    if (!renderer) return;
    renderer.dispose();
    // Only force the loss on a live context (asking on a lost one logs a WebGL warning).
    if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
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

  // Back/forward cache or closing: give the slot back right away.
  addEventListener('pagehide', release);

  if (document.visibilityState === 'visible') acquire();
  else set('released');
  // A tab opened in the background (e.g. session restore) waits until it is shown.

  return {
    get state() {
      return state;
    },
    render(scene, camera) {
      if (state === 'ready' && renderer) renderer.render(scene, camera);
    },
    setLight(on) {
      if (on === light) return;
      light = on;
      if (renderer) {
        release();
        if (document.visibilityState === 'visible') acquire();
      }
    },
    resize(width, height) {
      size = { w: width, h: height };
      renderer?.setSize(width, height);
    },
  };
}
