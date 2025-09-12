/*!
 * bg-net — sitewide animated background
 * Single fixed canvas behind all sections; no dependency on #large-header
 * Works with or without GSAP (TweenLite/Max). If GSAP is present, points “wander”.
 */
(function () {
    // -----------------------------
    // TUNABLE CONFIG
    // -----------------------------
    const CONFIG = {
      POINT_SPACING: 22,         // grid spacing in px
      NEIGHBORS: 5,              // links per point
      DOT_RADIUS_MIN: 2,
      DOT_RADIUS_MAX: 3.5,
  
      // Base color (soft cyan). Change if you want a different tint.
      COLOR: { r: 156, g: 217, b: 249 },
  
      // Visibility (lower = lighter)
      LINE_ALPHA_NEAR: 0.14,
      LINE_ALPHA_MID:  0.08,
      LINE_ALPHA_FAR:  0.03,
      DOT_ALPHA_NEAR:  0.28,
      DOT_ALPHA_MID:   0.16,
      DOT_ALPHA_FAR:   0.06,
  
      // Distance thresholds (squared, in px^2)
      RANGE_NEAR:  3600,   // ~60px
      RANGE_MID:  16000,   // ~126px
      RANGE_FAR:  36000,   // ~190px
  
      // Performance guards
      MAX_POINTS: 2800,    // safety cap for huge screens
      REDUCED_MOTION: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  
      // Pause when window/tab is hidden to save CPU
      PAUSE_WHEN_HIDDEN: true,
    };
  
    // -----------------------------
    // CANVAS BOOTSTRAP
    // -----------------------------
    const existing = document.getElementById('bg-net');
    const canvas = existing || Object.assign(document.createElement('canvas'), { id: 'bg-net' });
    if (!existing) {
      document.body.appendChild(canvas);
      // base CSS safety in case stylesheet entry is missing
      canvas.style.position = 'fixed';
      canvas.style.inset = '0';
      canvas.style.width = '100vw';
      canvas.style.height = '100vh';
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '0';
      canvas.style.opacity = '0.30'; // lower global intensity; tweak as needed
    }
  
    // Ensure page content sits above (defensive)
    const elevate = sel => document.querySelectorAll(sel).forEach(el => {
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.style.zIndex = '1';
    });
    elevate('.header, header, main, footer');
  
    const ctx = canvas.getContext('2d');
    let width = 0, height = 0, dpr = 1;
    let points = [];
    let target = { x: 0, y: 0 };
    let running = true;
    let rafId = null;
  
    // -----------------------------
    // UTILITIES
    // -----------------------------
    const rand = (min, max) => Math.random() * (max - min) + min;
    const dist2 = (a, b) => {
      const dx = a.x - b.x, dy = a.y - b.y;
      return dx * dx + dy * dy;
    };
  
    function sizeCanvas() {
      dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      width = Math.floor(window.innerWidth);
      height = Math.floor(window.innerHeight);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  
    function buildPoints() {
      points = [];
      const spacing = CONFIG.POINT_SPACING;
      for (let x = 0; x < width; x += spacing) {
        for (let y = 0; y < height; y += spacing) {
          const px = x + Math.random() * spacing;
          const py = y + Math.random() * spacing;
          points.push({
            x: px, y: py, originX: px, originY: py,
            active: 0,
            circle: null,
            closest: []
          });
          if (points.length >= CONFIG.MAX_POINTS) break;
        }
        if (points.length >= CONFIG.MAX_POINTS) break;
      }
  
      // find NEIGHBORS closest points (O(n^2) but bounded by MAX_POINTS)
      const N = points.length;
      for (let i = 0; i < N; i++) {
        const p1 = points[i];
        const near = [];
        for (let j = 0; j < N; j++) {
          if (i === j) continue;
          const p2 = points[j];
          if (near.length < CONFIG.NEIGHBORS) {
            near.push(p2);
            if (near.length === CONFIG.NEIGHBORS) {
              near.sort((a, b) => dist2(p1, a) - dist2(p1, b));
            }
            continue;
          }
          const d = dist2(p1, p2);
          if (d < dist2(p1, near[CONFIG.NEIGHBORS - 1])) {
            near[CONFIG.NEIGHBORS - 1] = p2;
            near.sort((a, b) => dist2(p1, a) - dist2(p1, b));
          }
        }
        p1.closest = near;
      }
  
      // attach circle drawers
      for (const p of points) {
        p.circle = {
          active: 0,
          radius: rand(CONFIG.DOT_RADIUS_MIN, CONFIG.DOT_RADIUS_MAX),
          draw() {
            if (!this.active) return;
            ctx.beginPath();
            ctx.arc(p.x, p.y, this.radius, 0, Math.PI * 2, false);
            ctx.fillStyle = `rgba(${CONFIG.COLOR.r},${CONFIG.COLOR.g},${CONFIG.COLOR.b},${this.active})`;
            ctx.fill();
          }
        };
      }
    }
  
    // -----------------------------
    // OPTIONAL WANDER (GSAP/Fallback)
    // -----------------------------
    const hasGSAP = !!(window.TweenLite || window.TweenMax || (window.gsap && window.gsap.to));
    function shiftPoint(p) {
      if (CONFIG.REDUCED_MOTION) return;
      if (hasGSAP) {
        const tl = window.TweenLite || window.TweenMax || window.gsap;
        const ease = (window.Circ && window.Circ.easeInOut) || 'power1.inOut';
        (tl.to ? tl : tl.to).call
          ? tl.to(p, 1 + Math.random(), {
              x: p.originX - 50 + Math.random() * 100,
              y: p.originY - 50 + Math.random() * 100,
              ease,
              onComplete: () => shiftPoint(p)
            })
          : window.gsap.to(p, {
              duration: 1 + Math.random(),
              x: p.originX - 50 + Math.random() * 100,
              y: p.originY - 50 + Math.random() * 100,
              ease,
              onComplete: () => shiftPoint(p)
            });
      } else {
        // Lightweight fallback jitter
        const dur = 900 + Math.random() * 900;
        const sx = p.x, sy = p.y;
        const tx = p.originX - 50 + Math.random() * 100;
        const ty = p.originY - 50 + Math.random() * 100;
        const start = performance.now();
        function tick(now) {
          const t = Math.min(1, (now - start) / dur);
          // simple ease in/out
          const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
          p.x = sx + (tx - sx) * e;
          p.y = sy + (ty - sy) * e;
          if (t < 1 && running) {
            requestAnimationFrame(tick);
          } else if (running) {
            shiftPoint(p);
          }
        }
        requestAnimationFrame(tick);
      }
    }
  
    // -----------------------------
    // RENDER LOOP
    // -----------------------------
    function drawLines(p) {
      if (!p.active) return;
      for (let i = 0; i < p.closest.length; i++) {
        const q = p.closest[i];
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.strokeStyle = `rgba(${CONFIG.COLOR.r},${CONFIG.COLOR.g},${CONFIG.COLOR.b},${p.active})`;
        ctx.stroke();
      }
    }
  
    function render() {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);
  
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const d2 = dist2(target, p);
        if (d2 < CONFIG.RANGE_NEAR) {
          p.active = CONFIG.LINE_ALPHA_NEAR; p.circle.active = CONFIG.DOT_ALPHA_NEAR;
        } else if (d2 < CONFIG.RANGE_MID) {
          p.active = CONFIG.LINE_ALPHA_MID;  p.circle.active = CONFIG.DOT_ALPHA_MID;
        } else if (d2 < CONFIG.RANGE_FAR) {
          p.active = CONFIG.LINE_ALPHA_FAR;  p.circle.active = CONFIG.DOT_ALPHA_FAR;
        } else {
          p.active = 0;                      p.circle.active = 0;
        }
        drawLines(p);
        p.circle.draw();
      }
  
      rafId = requestAnimationFrame(render);
    }
  
    // -----------------------------
    // EVENTS
    // -----------------------------
    function onMouseMove(e) {
      target.x = e.clientX;
      target.y = e.clientY;
    }
  
    function onResize() {
      sizeCanvas();
      buildPoints();
      if (!CONFIG.REDUCED_MOTION) {
        // restart wander
        if (hasGSAP && (window.TweenLite || window.TweenMax)) {
          const tl = window.TweenLite || window.TweenMax;
          tl.killTweensOf && tl.killTweensOf(points);
        }
        for (const p of points) shiftPoint(p);
      }
    }
  
    // Simple debouncer for resize
    let resizeTid = 0;
    function debouncedResize() {
      clearTimeout(resizeTid);
      resizeTid = setTimeout(onResize, 120);
    }
  
    function onVisibility() {
      if (!CONFIG.PAUSE_WHEN_HIDDEN) return;
      const hidden = document.hidden;
      running = !hidden;
      if (running && !rafId) render();
    }
  
    // -----------------------------
    // INIT
    // -----------------------------
    function init() {
      sizeCanvas();
      buildPoints();
      if (!CONFIG.REDUCED_MOTION) {
        for (const p of points) shiftPoint(p);
      }
      // center target at start to avoid bright corner
      target.x = width * 0.5;
      target.y = height * 0.4;
  
      render();
  
      if (!('ontouchstart' in window)) {
        window.addEventListener('mousemove', onMouseMove, { passive: true });
      }
      window.addEventListener('resize', debouncedResize);
      document.addEventListener('visibilitychange', onVisibility);
  
      // Defensive: hide any legacy large-header if still present
      const legacy = document.getElementById('large-header');
      if (legacy) {
        legacy.style.display = 'none';
        legacy.style.height = '0';
      }
    }
  
    init();
  })();
  