import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import React, { useEffect, useRef } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NetSim — Master Networking" },
      { name: "description", content: "Build, simulate, and learn networking with interactive labs and courses" },
    ],
  }),
  component: Index,
});

function AnimatedTopology() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const nodes: { x: number; y: number; vx: number; vy: number; size: number }[] = [];
    const edges: [number, number][] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
      ctx.scale(2, 2);
    };
    resize();

    // Create nodes
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    for (let i = 0; i < 18; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 3 + Math.random() * 3,
      });
    }
    // Create edges
    for (let i = 0; i < nodes.length; i++) {
      const count = 1 + Math.floor(Math.random() * 2);
      for (let j = 0; j < count; j++) {
        const target = (i + 1 + Math.floor(Math.random() * 4)) % nodes.length;
        if (target !== i) edges.push([i, target]);
      }
    }

    let time = 0;
    const draw = () => {
      time += 0.01;
      ctx.clearRect(0, 0, w, h);

      // Update
      nodes.forEach(n => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
      });

      // Edges
      edges.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(nodes[a].x, nodes[a].y);
        ctx.lineTo(nodes[b].x, nodes[b].y);
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Animated packet dot
        const t = (Math.sin(time * 2 + a + b) + 1) / 2;
        const px = nodes[a].x + (nodes[b].x - nodes[a].x) * t;
        const py = nodes[a].y + (nodes[b].y - nodes[a].y) * t;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.5)';
        ctx.fill();
      });

      // Nodes
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

function Index() {
  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      {/* Hero */}
      <section className="relative h-[calc(100vh-3.5rem)] flex items-center justify-center overflow-hidden">
        <AnimatedTopology />
        <div className="relative z-10 text-center max-w-3xl px-4">
          <h1 className="text-4xl md:text-6xl font-display text-terminal text-glow phosphor-flicker tracking-wider leading-tight">
            MASTER NETWORKING
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mt-4 font-light tracking-wide">
            Build, Simulate, Learn
          </p>
          <p className="text-sm text-muted-foreground/60 mt-2 max-w-lg mx-auto">
            Interactive lab environments with real CLI simulation. Configure routers, build topologies, and trace packets — all in your browser.
          </p>
          <div className="flex gap-4 justify-center mt-8">
            <Link to="/lab" className="inline-flex items-center justify-center rounded px-6 py-3 text-sm font-display bg-primary text-primary-foreground shadow-[0_0_20px_var(--primary)] hover:shadow-[0_0_30px_var(--primary)] hover:scale-105 transition-all duration-300 tracking-wider">
              START FREE LAB
            </Link>
            <Link to="/courses" className="inline-flex items-center justify-center rounded px-6 py-3 text-sm font-display border border-primary bg-transparent text-primary shadow-[0_0_8px_var(--primary)] hover:bg-primary hover:text-primary-foreground transition-all duration-300 tracking-wider">
              BROWSE COURSES
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-display text-terminal text-glow text-center mb-12 tracking-wider">PLATFORM FEATURES</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { title: 'LAB SIMULATOR', desc: 'Drag-and-drop network topology builder with real Cisco IOS command simulation', icon: '🖥️' },
              { title: 'PACKET TRACER', desc: 'Visualize packets traversing your network with animated simulations', icon: '📡' },
              { title: 'LEARNING PATHS', desc: 'Structured courses from OSI Model basics to advanced BGP routing', icon: '📚' },
            ].map(f => (
              <div key={f.title} className="border border-border rounded-lg p-6 bg-card/50 hover:border-terminal/30 hover:bg-card transition-all">
                <span className="text-2xl">{f.icon}</span>
                <h3 className="text-sm font-display text-terminal mt-3 tracking-wider">{f.title}</h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
