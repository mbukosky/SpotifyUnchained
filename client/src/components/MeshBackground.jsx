import { useRef, useEffect } from 'react';
import { useRegion } from '../hooks/useRegion';
import { REGION_COLORS } from '../lib/regions';

const BASE_COLORS = [
  [124, 92, 255], // violet
  [56, 225, 255], // cyan
  [255, 78, 205], // magenta
  [124, 92, 255],
  [56, 225, 255],
];

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function createBlobs() {
  return BASE_COLORS.map((c, i) => ({
    base: c,
    cur: [...c],
    x: Math.random(),
    y: Math.random(),
    vx: (Math.random() - 0.5) * 0.0009,
    vy: (Math.random() - 0.5) * 0.0009,
    r: 0.32 + Math.random() * 0.25,
    phase: i * 1.3,
  }));
}

export default function MeshBackground() {
  const canvasRef = useRef(null);
  const targetRef = useRef(null);
  const { region } = useRegion();

  // Region changes only update a ref; the running rAF loop lerps toward it.
  targetRef.current = REGION_COLORS[region] ? hexToRgb(REGION_COLORS[region]) : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const blobs = createBlobs();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let rafId;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'screen';
      const W = canvas.width;
      const H = canvas.height;
      const target = targetRef.current;

      for (const b of blobs) {
        b.x += b.vx + Math.sin(t / 6000 + b.phase) * 0.0004;
        b.y += b.vy + Math.cos(t / 7000 + b.phase) * 0.0004;
        if (b.x < -0.2 || b.x > 1.2) b.vx *= -1;
        if (b.y < -0.2 || b.y > 1.2) b.vy *= -1;

        for (let i = 0; i < 3; i++) {
          const goal = target ? target[i] * 0.55 + b.base[i] * 0.45 : b.base[i];
          b.cur[i] += (goal - b.cur[i]) * 0.02;
        }

        const cx = b.x * W;
        const cy = b.y * H;
        const rad = b.r * Math.min(W, H);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        const [r, gg, bl] = b.cur.map(v => v | 0);
        g.addColorStop(0, `rgba(${r},${gg},${bl},0.16)`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
    };

    if (reducedMotion) {
      draw(0);
    } else {
      const tick = (t) => {
        draw(t);
        rafId = requestAnimationFrame(tick);
      };
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="mesh-canvas" aria-hidden="true" />;
}
