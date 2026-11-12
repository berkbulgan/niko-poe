// ABOUTME: Tests for the pure parts of the atlas canvas renderer.
// ABOUTME: Covers where off-screen arrows go, including keeping them out of the zoom controls corner.

import { describe, expect, it } from 'vitest';
import { CONTROLS_KEEP_OUT, offScreenArrowPoint } from './atlas-canvas-renderer';

describe('offScreenArrowPoint', () => {
  it('returns null for a point inside the viewport', () => {
    expect(offScreenArrowPoint(200, 200, 400, 400)).toBeNull();
  });

  it('puts an arrow on the right edge for a point far to the right', () => {
    const p = offScreenArrowPoint(5000, 200, 400, 400);
    expect(p?.x).toBeCloseTo(360);
    expect(p?.y).toBeCloseTo(200);
  });

  it('keeps arrows out of the top-left controls corner', () => {
    // Wide, short viewport: the up-left arrow would land at about (51, 128), under the controls
    const p = offScreenArrowPoint(-10000, -2000, 1200, 300);
    expect(p).not.toBeNull();
    expect(p!.x < CONTROLS_KEEP_OUT.width && p!.y < CONTROLS_KEEP_OUT.height).toBe(false);
  });

  it('moves a left-edge arrow below the controls, not under the Jump to select', () => {
    const p = offScreenArrowPoint(-100000, 100, 1200, 300);
    expect(p!.x).toBeLessThan(CONTROLS_KEEP_OUT.width);
    expect(p!.y).toBeGreaterThanOrEqual(CONTROLS_KEEP_OUT.height);
  });
});

describe('offScreenArrowPoint and the Jump to select', () => {
  // The select is w-40 h-7 at left-3 below the buttons: x 12-172, y 150-178; pad by the 12px arrow size
  const underSelect = (p: { x: number; y: number }) => p.x < 172 + 12 && p.y > 150 - 12 && p.y < 178 + 12;

  it.each([
    [512, 743],
    [900, 700],
    [1200, 800],
  ])('keeps up-left arrows off the select in a %ix%i viewport', (w, h) => {
    for (let deg = -150; deg <= -120; deg += 1) {
      const a = (deg * Math.PI) / 180;
      const p = offScreenArrowPoint(w / 2 + Math.cos(a) * 1e5, h / 2 + Math.sin(a) * 1e5, w, h);
      expect(underSelect(p!), `${deg} deg -> (${p!.x.toFixed(0)}, ${p!.y.toFixed(0)})`).toBe(false);
    }
  });
});
