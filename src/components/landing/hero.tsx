"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowRight,
  Shield,
  Menu,
  X,
  LayoutDashboard,
  Key,
  Users,
  ShieldCheck,
  FileText,
  Webhook,
  Settings,
  BarChart3,
  FlaskConical,
  Clock,
  Search,
  ChevronRight,
  Star,
  Play,
  Eye,
  Upload,
  Check,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Animated background (aurora blobs + wave lines + floating motes)   */
/* ------------------------------------------------------------------ */

function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    tRef.current += 0.002;
    const t = tRef.current;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // Aurora blobs — large, slow, subtle orange/amber tinted for dark theme
    const blobs = [
      { cx: w * 0.2 + Math.sin(t * 0.7) * w * 0.12, cy: h * 0.05 + Math.cos(t * 0.5) * h * 0.02, rx: w * 0.4, ry: h * 0.06, color: "rgba(255,145,29,0.03)" },
      { cx: w * 0.75 + Math.cos(t * 0.5) * w * 0.1, cy: h * 0.03 + Math.sin(t * 0.7) * h * 0.015, rx: w * 0.35, ry: h * 0.05, color: "rgba(255,100,0,0.02)" },
      { cx: w * 0.5 + Math.sin(t * 0.4 + 1) * w * 0.15, cy: h * 0.12 + Math.cos(t * 0.3) * h * 0.015, rx: w * 0.3, ry: h * 0.05, color: "rgba(255,160,50,0.025)" },
      { cx: w * 0.3 + Math.cos(t * 0.6 + 2) * w * 0.1, cy: h * 0.22 + Math.sin(t * 0.5) * h * 0.015, rx: w * 0.25, ry: h * 0.04, color: "rgba(255,145,29,0.015)" },
      { cx: w * 0.8 + Math.sin(t * 0.3 + 3) * w * 0.08, cy: h * 0.32 + Math.cos(t * 0.4) * h * 0.015, rx: w * 0.22, ry: h * 0.035, color: "rgba(255,100,0,0.012)" },
    ];

    for (const b of blobs) {
      const grad = ctx.createRadialGradient(b.cx, b.cy, 0, b.cx, b.cy, Math.max(b.rx, b.ry));
      grad.addColorStop(0, b.color);
      grad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.ellipse(b.cx, b.cy, b.rx, b.ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Flowing wave lines — very subtle
    for (let i = 0; i < 6; i++) {
      const yBase = h * (0.03 + i * 0.07);
      const alpha = 0.015 + (i % 3) * 0.005;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,145,29,${alpha})`;
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= w; x += 3) {
        const y = yBase + Math.sin(x * 0.003 + t * 2 + i * 1.3) * 18 + Math.sin(x * 0.007 + t * 1.5 + i * 0.7) * 8;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Floating motes — tiny glowing particles
    for (let i = 0; i < 20; i++) {
      const seed = i * 137.508;
      const mx = ((seed * 7.3 + t * 8 * (0.3 + (i % 5) * 0.1)) % w + w) % w;
      const my = ((seed * 3.7 + t * 5 * (0.2 + (i % 4) * 0.06)) % (h * 0.5) + (h * 0.5)) % (h * 0.5);
      const flicker = 0.08 + Math.sin(t * 3.5 + i * 2.1) * 0.04;
      ctx.beginPath();
      ctx.arc(mx, my, 0.8 + Math.sin(t * 2 + i) * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,170,60,${flicker})`;
      ctx.fill();
    }

    ctx.restore();
    animRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = document.documentElement.scrollHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = document.documentElement.scrollHeight + "px";
    };

    resize();
    animRef.current = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [draw]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" />;
}

/* ------------------------------------------------------------------ */
/*  Scroll-animated wrapper                                            */
/* ------------------------------------------------------------------ */

function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.style.opacity = "1";
            el.style.transform = "translateY(0)";
          }, delay);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: 0,
        transform: "translateY(24px)",
        transition:
          "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Logo ticker with icons                                             */
/* ------------------------------------------------------------------ */

function LogoIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    Zapier: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M15.088 4.372L12 9.26 8.912 4.372H3.696l6.072 7.656L3.696 19.62h5.2L12 14.756l3.104 4.864h5.2l-6.072-7.592L20.304 4.372z" />
      </svg>
    ),
    Make: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <circle cx="12" cy="12" r="10" fillOpacity="0" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
    n8n: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <rect x="3" y="8" width="6" height="8" rx="1" />
        <rect x="15" y="8" width="6" height="8" rx="1" />
        <path d="M9 12h6" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
    Slack: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.27 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.833 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.527 2.527 0 0 1 2.521 2.521 2.527 2.527 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
      </svg>
    ),
    OpenAI: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
      </svg>
    ),
    Vercel: (
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="currentColor">
        <path d="M12 1L24 22H0z" />
      </svg>
    ),
    LangChain: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2l3 5h-2v4h4v-2l5 3-5 3v-2h-4v4h2l-3 5-3-5h2v-4H6v2L1 12l5-3v2h4V7H8z" />
      </svg>
    ),
    Windmill: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14c-2.33 0-4.32-1.45-5.12-3.5h1.67c.69 1.19 1.97 2 3.45 2s2.75-.81 3.45-2h1.67c-.8 2.05-2.79 3.5-5.12 3.5z" />
      </svg>
    ),
  };

  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <span style={{ color: "rgba(255,255,255,0.45)" }}>{icons[name]}</span>
      <span
        className="text-base font-semibold tracking-tight whitespace-nowrap"
        style={{ color: "rgba(255,255,255,0.45)" }}
      >
        {name}
      </span>
    </div>
  );
}

function LogoTicker() {
  const logos = ["Zapier", "Make", "n8n", "Slack", "OpenAI", "LangChain", "Vercel", "Windmill"];
  const row = [...logos, ...logos];
  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, white 10%, white 90%, transparent)",
      }}
    >
      <div
        className="flex items-center gap-14"
        style={{ animation: "tess-scroll-x 30s linear infinite" }}
      >
        {row.map((name, i) => (
          <LogoIcon key={`${name}-${i}`} name={name} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Testimonial Row                                                    */
/* ------------------------------------------------------------------ */

function TestimonialRow({
  testimonials,
  reverse = false,
}: {
  testimonials: { quote: string; name: string; role: string }[];
  reverse?: boolean;
}) {
  const doubled = [...testimonials, ...testimonials];
  return (
    <div
      className="relative overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, white 10%, white 90%, transparent)",
      }}
    >
      <div
        className="flex gap-5"
        style={{
          animation: `${reverse ? "tess-scroll-x-reverse" : "tess-scroll-x"} 45s linear infinite`,
        }}
      >
        {doubled.map((t, i) => (
          <div
            key={`${t.name}-${i}`}
            className="w-[380px] shrink-0 rounded-2xl border p-6"
            style={{
              backgroundColor: "var(--tess-bg-card)",
              borderColor: "var(--tess-border)",
            }}
          >
            <p className="mb-4 text-sm leading-relaxed" style={{ color: "var(--tess-text-secondary)" }}>
              &ldquo;{t.quote}&rdquo;
            </p>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--tess-text)" }}>{t.name}</p>
              <p className="text-xs" style={{ color: "var(--tess-text-muted)" }}>{t.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dark-themed Mock Dashboard                                         */
/* ------------------------------------------------------------------ */

function MockDashboard() {
  const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", active: true, badge: "3" },
    { icon: Key, label: "Connections" },
    { icon: Users, label: "Team" },
    { icon: ShieldCheck, label: "Rules" },
    { icon: FileText, label: "Audit Log" },
    { icon: Webhook, label: "Webhooks" },
    { icon: BarChart3, label: "Analytics" },
    { icon: FlaskConical, label: "Playground" },
    { icon: Settings, label: "Settings" },
  ];

  const approvals = [
    { title: "Delete user account #4821", desc: "Permanently remove user and all associated data", source: "Zapier", time: "2 min ago", status: "Pending", statusColor: "#f59e0b", priority: "High", prioColor: "#ef4444" },
    { title: "Send bulk email (2,400 recipients)", desc: "Marketing campaign — Q1 product launch", source: "n8n", time: "8 min ago", status: "Approved", statusColor: "#22c55e", priority: "Medium", prioColor: "#f59e0b" },
    { title: "Deploy to production v3.2.1", desc: "Release includes auth fix and new webhook endpoint", source: "Make", time: "14 min ago", status: "Pending", statusColor: "#f59e0b", priority: "High", prioColor: "#ef4444" },
    { title: "Update billing plan for org #127", desc: "Upgrade from Pro to Enterprise tier", source: "Zapier", time: "23 min ago", status: "Approved", statusColor: "#22c55e", priority: "Low", prioColor: "#6b7280" },
  ];

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: "rgba(255,255,255,0.1)",
        boxShadow: "0 25px 60px -12px rgba(0,0,0,0.7), 0 0 100px rgba(255,145,29,0.06)",
      }}
    >
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{ backgroundColor: "#0c0c0c", borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      </div>

      {/* App layout — dark themed */}
      <div className="flex" style={{ backgroundColor: "#0a0a0a", height: "380px" }}>
        {/* Sidebar */}
        <div
          className="hidden w-48 shrink-0 border-r sm:flex sm:flex-col"
          style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "#080808" }}
        >
          <div
            className="flex items-center justify-center border-b px-3 py-2.5"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <Image src="/logo_text_white.png" alt="OKRunit" width={220} height={60} className="h-7 w-auto" />
          </div>
          <div className="flex-1 space-y-0.5 px-2 py-2">
            {sidebarItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-medium"
                style={{
                  backgroundColor: item.active ? "rgba(255,145,29,0.1)" : "transparent",
                  color: item.active ? "#ff911d" : "rgba(255,255,255,0.4)",
                }}
              >
                <item.icon className="h-3 w-3 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {"badge" in item && item.badge && (
                  <span className="rounded px-1 py-0.5 text-[8px] font-bold leading-none text-white" style={{ backgroundColor: "#ff911d" }}>
                    {item.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="border-t px-2 py-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2 px-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full text-[7px] font-bold text-white" style={{ backgroundColor: "#ff911d" }}>NS</div>
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>nathaniel@okrunit.com</span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center border-b px-4 py-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <span className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.9)" }}>Dashboard</span>
          </div>
          <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-1.5 rounded-md border px-2 py-1" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <Search className="h-2.5 w-2.5" style={{ color: "rgba(255,255,255,0.3)" }} />
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>Search approvals...</span>
            </div>
            <div className="rounded-md border px-2 py-1 text-[9px]" style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>Status: All</div>
            <div className="rounded-md border px-2 py-1 text-[9px]" style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>Priority: All</div>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {approvals.map((a) => (
              <div
                key={a.title}
                className="rounded-lg border p-3"
                style={{ borderColor: "rgba(255,255,255,0.06)", backgroundColor: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold leading-tight" style={{ color: "rgba(255,255,255,0.9)" }}>{a.title}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full border px-1.5 py-0.5 text-[8px] font-medium" style={{ borderColor: a.prioColor, color: a.prioColor }}>{a.priority}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[8px] font-medium text-white" style={{ backgroundColor: a.statusColor }}>{a.status}</span>
                  </div>
                </div>
                <p className="mt-0.5 text-[9px] leading-tight" style={{ color: "rgba(255,255,255,0.35)" }}>{a.desc}</p>
                <div className="mt-1.5 flex items-center gap-2 text-[8px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                  <span>{a.source}</span>
                  <span className="flex items-center gap-0.5"><Clock className="h-2 w-2" />{a.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const features = [
  { icon: Shield, title: "From request to resolution", description: "One API call creates an approval, notifies reviewers, and delivers the decision back to your automation." },
  { icon: Users, title: "AI-ready approval workflows", description: "Purpose-built for AI agents and automations that need human oversight before taking action." },
  { icon: Eye, title: "Full audit visibility", description: "Every request, vote, and decision is logged with timestamps and context for complete traceability." },
  { icon: Upload, title: "Connect everything", description: "Integrate with Zapier, Make, n8n, Slack, custom webhooks, and any platform with an HTTP client." },
];

const gridCards = [
  { title: "Approve from anywhere", description: "Review and approve requests from the dashboard, email, Slack, or push notifications. Never miss a critical decision." },
  { title: "Rules that route automatically", description: "Set up rules based on action type, priority, or source to auto-route approvals to the right people." },
  { title: "Team-based permissions", description: "Fine-grained role-based access ensures the right reviewers see the right requests." },
];

const bigCard = {
  title: "A universal API that works with every automation",
  description: "OKRunit provides a single REST API that sits between your AI agents and destructive actions. One endpoint to create approvals, webhooks to deliver decisions.",
};

const steps = [
  { badge: "Universal API", title: "Connect any automation in minutes", description: "Send a POST request from Zapier, Make, n8n, or your AI agent. OKRunit handles notifications, routing, and callbacks automatically.", features: ["REST API", "Zapier", "Make", "n8n", "Webhooks", "Slack"] },
  { badge: "Smart Routing", title: "Approvals go to the right people", description: "Rules engine routes requests based on type, priority, and custom conditions. Set up escalation paths and auto-approve for low-risk actions." },
  { badge: "Real-time", title: "Instant decisions, delivered everywhere", description: "Webhook callbacks notify your automation the moment a decision is made. No polling required." },
];

const testimonials1 = [
  { quote: "OKRunit saved us from a catastrophic data deletion. Our AI agent tried to drop a production table and the approval gate caught it.", name: "Marcus Chen", role: "CTO @ DataFlow" },
  { quote: "We integrated OKRunit in 20 minutes. Now every Zapier workflow that touches customer data goes through human review first.", name: "Emily Rodriguez", role: "Head of Ops @ ScaleUp" },
  { quote: "The webhook callbacks are incredibly reliable. Our n8n workflows pause cleanly and resume the moment someone approves.", name: "James Park", role: "Lead Engineer @ BuildFast" },
  { quote: "Finally, a tool that gives us confidence to let AI agents handle sensitive operations. The audit trail alone is worth it.", name: "Sarah Mitchell", role: "VP Engineering @ TrustLayer" },
];

const testimonials2 = [
  { quote: "We went from 3 hours of manual review to 4 minutes average response time. OKRunit routes the right requests to the right people.", name: "Alex Turner", role: "Founder @ AutoScale" },
  { quote: "The Slack integration means our team can approve requests without context-switching. Massive productivity win.", name: "Priya Sharma", role: "Engineering Manager @ Nexus" },
  { quote: "OKRunit is the missing piece for production AI agents. You can't ship autonomous systems without human oversight.", name: "David Kim", role: "AI Lead @ Cortex Labs" },
  { quote: "Setting up approval rules took 5 minutes. Now our entire deployment pipeline has human checkpoints where it matters.", name: "Rachel Foster", role: "DevOps Lead @ CloudNine" },
];

const pricingTiers = [
  { name: "Free", price: "$0", period: "", description: "For individuals and small projects", features: ["2 connections", "100 requests/month", "3 team members", "Email notifications", "7-day history"], cta: "Start for free", highlighted: false },
  { name: "Pro", price: "$20", period: "/mo", description: "For growing teams", features: ["15 connections", "Unlimited requests", "15 team members", "Slack & webhook notifications", "Rules engine", "Analytics", "90-day history"], cta: "Get started", highlighted: true },
  { name: "Business", price: "$60", period: "/mo", description: "For scaling organizations", features: ["Unlimited connections", "Unlimited requests", "Unlimited team members", "SSO / SAML", "Audit log export", "Multi-step approvals", "1-year history"], cta: "Get started", highlighted: false },
  { name: "Enterprise", price: "Custom", period: "", description: "For large organizations", features: ["Everything in Business", "Dedicated support", "Custom SLAs", "Priority processing", "Unlimited history", "Custom integrations"], cta: "Contact us", highlighted: false },
];

const footerLinks = {
  Product: ["Why OKRunit", "Platform", "Pricing", "Changelog"],
  Solutions: ["For Founders", "For Startups", "For Enterprise", "For AI Teams"],
  Company: ["About", "Contact", "Privacy"],
  Resources: ["Blog", "Docs", "Community", "Changelog"],
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

interface HeroProps {
  user: { email: string; full_name: string | null } | null;
}

export function Hero({ user }: HeroProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className="tess-dark relative min-h-screen"
      style={{ backgroundColor: "var(--tess-bg)", color: "var(--tess-text)" }}
    >
      {/* Animated canvas background */}
      <AnimatedBackground />

      {/* ── Floating Navigation ────────────────────────────────── */}
      <nav className="fixed left-1/2 top-5 z-50 w-[95%] max-w-4xl -translate-x-1/2">
        <div
          className="flex items-center justify-between rounded-2xl border px-4 py-2.5 shadow-lg backdrop-blur-xl"
          style={{ backgroundColor: "rgba(10, 10, 10, 0.8)", borderColor: "var(--tess-border)" }}
        >
          <Link href="/" className="flex items-center">
            <Image src="/logo_text_white.png" alt="OKRunit" width={440} height={120} className="h-9 w-auto" />
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm transition hover:text-white" style={{ color: "var(--tess-text-secondary)" }}>Features</a>
            <a href="#pricing" className="text-sm transition hover:text-white" style={{ color: "var(--tess-text-secondary)" }}>Pricing</a>
            <a href="#testimonials" className="text-sm transition hover:text-white" style={{ color: "var(--tess-text-secondary)" }}>Testimonials</a>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/dashboard" className="hidden rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90 md:inline-flex" style={{ backgroundColor: "var(--tess-text)", color: "var(--tess-bg)" }}>
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden text-sm transition hover:text-white md:inline-flex" style={{ color: "var(--tess-text-secondary)" }}>Log in</Link>
                <Link href="/signup" className="hidden rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90 md:inline-flex" style={{ backgroundColor: "var(--tess-text)", color: "var(--tess-bg)" }}>
                  Start for free
                </Link>
              </>
            )}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden" style={{ color: "var(--tess-text)" }}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="mt-2 rounded-2xl border p-4 shadow-lg backdrop-blur-xl md:hidden" style={{ backgroundColor: "rgba(10, 10, 10, 0.95)", borderColor: "var(--tess-border)" }}>
            <div className="flex flex-col gap-3">
              <a href="#features" className="text-sm" style={{ color: "var(--tess-text-secondary)" }} onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#pricing" className="text-sm" style={{ color: "var(--tess-text-secondary)" }} onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#testimonials" className="text-sm" style={{ color: "var(--tess-text-secondary)" }} onClick={() => setMobileMenuOpen(false)}>Testimonials</a>
              {!user && <Link href="/login" className="text-sm" style={{ color: "var(--tess-text-secondary)" }} onClick={() => setMobileMenuOpen(false)}>Log in</Link>}
              <Link href={user ? "/dashboard" : "/signup"} className="mt-1 rounded-lg px-4 py-2 text-center text-sm font-semibold" style={{ backgroundColor: "var(--tess-text)", color: "var(--tess-bg)" }}>
                {user ? "Dashboard" : "Start for free"}
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ───────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-12 pt-40 text-center lg:pt-48">
        <FadeIn>
          <Link
            href="/signup"
            className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition hover:border-white/20"
            style={{ backgroundColor: "var(--tess-accent-soft)", borderColor: "var(--tess-border)", color: "var(--tess-accent)" }}
          >
            Now available for AI agent teams
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </FadeIn>

        <FadeIn delay={100}>
          <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-[1.08] sm:text-6xl lg:text-7xl" style={{ letterSpacing: "-0.03em" }}>
            Human approval for every automation
          </h1>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: "var(--tess-text-secondary)" }}>
            The approval gateway for AI agents, automations, and workflows. One API call pauses execution until a human approves.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4" style={{ fill: "var(--tess-accent)", color: "var(--tess-accent)" }} />
            ))}
            <span className="ml-1.5 text-sm" style={{ color: "var(--tess-text-muted)" }}>4.9 rating</span>
          </div>
        </FadeIn>

        <FadeIn delay={400}>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={user ? "/dashboard" : "/signup"}
              className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition hover:brightness-110"
              style={{ backgroundColor: "var(--tess-accent)", color: "#000" }}
            >
              {user ? "Go to Dashboard" : "Get started free"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-xl border px-7 py-3.5 text-sm font-semibold transition hover:border-white/30"
              style={{ borderColor: "rgba(255,255,255,0.2)", color: "var(--tess-text)" }}
            >
              <Play className="h-3.5 w-3.5" />
              See how it works
            </a>
          </div>
        </FadeIn>

        {/* Dashboard preview with glow */}
        <FadeIn delay={500}>
          <div className="relative mx-auto mt-14 max-w-5xl">
            {/* Glow behind the dashboard */}
            <div
              className="pointer-events-none absolute -inset-8 z-0 rounded-3xl"
              style={{
                background: "radial-gradient(ellipse 70% 50% at 50% 40%, rgba(255,145,29,0.07), transparent 70%)",
              }}
            />
            <div className="relative z-10">
              <MockDashboard />
            </div>
            {/* Bottom fade */}
            <div
              className="pointer-events-none absolute -bottom-16 left-0 right-0 z-20 h-24"
              style={{ background: "linear-gradient(to bottom, transparent, #050505)" }}
            />
          </div>
        </FadeIn>
      </section>

      {/* ── Section Separator ──────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-4xl px-5">
        <div className="h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,145,29,0.2), transparent)" }} />
      </div>

      {/* ── Logo Ticker ────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-6">
        <FadeIn>
          <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: "var(--tess-text-muted)" }}>
            Works with the tools your team already uses
          </p>
          <LogoTicker />
        </FadeIn>
      </section>

      {/* ── Section Separator ──────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-4xl px-5">
        <div className="h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,145,29,0.15), transparent)" }} />
      </div>

      {/* ── Feature Grid ───────────────────────────────────────── */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {gridCards.map((card, i) => (
            <FadeIn key={card.title} delay={i * 80}>
              <div
                className="tess-card flex min-h-[16rem] flex-col justify-end rounded-2xl border p-6"
                style={{ backgroundColor: "var(--tess-bg-card)", borderColor: "var(--tess-border)" }}
              >
                <h3 className="text-lg font-bold" style={{ color: "var(--tess-text)" }}>{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--tess-text-secondary)" }}>{card.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={100}>
          <div
            className="tess-card mt-4 rounded-2xl border p-8 md:p-10"
            style={{ backgroundColor: "var(--tess-bg-card)", borderColor: "var(--tess-border)" }}
          >
            <div className="max-w-2xl">
              <h3 className="text-2xl font-bold md:text-3xl" style={{ letterSpacing: "-0.02em" }}>{bigCard.title}</h3>
              <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--tess-text-secondary)" }}>{bigCard.description}</p>
              <Link href={user ? "/dashboard" : "/signup"} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold transition hover:opacity-70" style={{ color: "var(--tess-accent)" }}>
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Section Separator ──────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-4xl px-5 py-4">
        <div className="h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,145,29,0.15), transparent)" }} />
      </div>

      {/* ── Features + Stats ───────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-12">
        <FadeIn>
          <div className="mb-8 max-w-xl">
            <h2 className="text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.02em" }}>
              Everything you need for safe automation
            </h2>
          </div>
        </FadeIn>

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature, i) => (
              <FadeIn key={feature.title} delay={i * 80}>
                <div className="tess-card rounded-2xl border p-5" style={{ backgroundColor: "var(--tess-bg-card)", borderColor: "var(--tess-border)" }}>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: "var(--tess-accent-soft)", color: "var(--tess-accent)" }}>
                    <feature.icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="text-sm font-bold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--tess-text-secondary)" }}>{feature.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={200}>
            <div
              className="flex min-h-[380px] items-center justify-center rounded-2xl border lg:min-h-[440px]"
              style={{ backgroundColor: "var(--tess-bg-card)", borderColor: "var(--tess-border)" }}
            >
              <div className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: "var(--tess-accent-soft)" }}>
                  <Shield className="h-7 w-7" style={{ color: "var(--tess-accent)" }} />
                </div>
                <p className="text-3xl font-bold">2.4 min</p>
                <p className="text-sm" style={{ color: "var(--tess-text-muted)" }}>avg. approval response time</p>
                <div className="mx-auto mt-5 h-px w-12" style={{ backgroundColor: "var(--tess-border)" }} />
                <p className="mt-5 text-3xl font-bold">99.9%</p>
                <p className="text-sm" style={{ color: "var(--tess-text-muted)" }}>webhook delivery rate</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Testimonial Quote ──────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 py-16 text-center">
        <FadeIn>
          <h2 className="text-2xl font-bold leading-snug md:text-4xl" style={{ letterSpacing: "-0.02em" }}>
            &ldquo;OKRunit stopped our AI agent from deleting a production database. That single approval saved us weeks of recovery time.&rdquo;
          </h2>
          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: "var(--tess-accent)" }}>MC</div>
            <div className="text-left">
              <p className="text-sm font-semibold">Marcus Chen</p>
              <p className="text-xs" style={{ color: "var(--tess-text-muted)" }}>CTO @ DataFlow</p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Section Separator ──────────────────────────────────── */}
      <div className="relative z-10 mx-auto max-w-4xl px-5 py-4">
        <div className="h-px" style={{ background: "linear-gradient(to right, transparent, rgba(255,145,29,0.15), transparent)" }} />
      </div>

      {/* ── Three-Column Product Section ───────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-4 lg:grid-cols-3">
          {steps.map((step, i) => (
            <FadeIn key={step.badge} delay={i * 100}>
              <div className="tess-card flex flex-col justify-between rounded-2xl border p-6 lg:min-h-[26rem]" style={{ backgroundColor: "var(--tess-bg-card)", borderColor: "var(--tess-border)" }}>
                <div>
                  <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: "var(--tess-accent-soft)", color: "var(--tess-accent)" }}>{step.badge}</span>
                  <h3 className="mt-4 text-xl font-bold" style={{ letterSpacing: "-0.01em" }}>{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--tess-text-secondary)" }}>{step.description}</p>
                </div>
                {step.features && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {step.features.map((f) => (
                      <span key={f} className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "var(--tess-border)", color: "var(--tess-text-secondary)", backgroundColor: "var(--tess-bg-elevated)" }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-6">
        <FadeIn>
          <div
            className="rounded-2xl border p-8 text-center md:p-14"
            style={{
              backgroundColor: "var(--tess-bg-card)",
              borderColor: "var(--tess-border)",
              backgroundImage: "radial-gradient(ellipse 50% 60% at 50% 0%, rgba(255,145,29,0.08), transparent 70%)",
            }}
          >
            <h2 className="mx-auto max-w-2xl text-3xl font-bold md:text-5xl" style={{ letterSpacing: "-0.03em" }}>
              Start protecting your automations today
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base" style={{ color: "var(--tess-text-secondary)" }}>
              Free to start. No credit card required. Add human oversight in minutes.
            </p>
            <Link
              href={user ? "/dashboard" : "/signup"}
              className="mt-7 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition hover:brightness-110"
              style={{ backgroundColor: "var(--tess-accent)", color: "#000" }}
            >
              {user ? "Go to Dashboard" : "Get started free"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* ── Pricing Section ────────────────────────────────────── */}
      <section id="pricing" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <FadeIn>
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.02em" }}>Simple, transparent pricing</h2>
            <p className="mt-3 text-base" style={{ color: "var(--tess-text-secondary)" }}>Start free. Scale as your team grows.</p>
          </div>
        </FadeIn>

        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2 lg:grid-cols-4">
          {pricingTiers.map((tier, i) => (
            <FadeIn key={tier.name} delay={i * 80}>
              <div
                className={`tess-card relative flex h-full flex-col rounded-2xl border p-6 ${tier.highlighted ? "shadow-lg" : ""}`}
                style={{
                  backgroundColor: tier.highlighted ? "var(--tess-text)" : "var(--tess-bg-card)",
                  borderColor: tier.highlighted ? "var(--tess-text)" : "var(--tess-border)",
                  color: tier.highlighted ? "var(--tess-bg)" : "var(--tess-text)",
                }}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: "var(--tess-accent)" }}>Most Popular</div>
                )}
                <div className="mb-5">
                  <h3 className="text-lg font-bold">{tier.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    {tier.period && <span className="text-sm" style={{ color: tier.highlighted ? "rgba(5,5,5,0.5)" : "var(--tess-text-muted)" }}>{tier.period}</span>}
                  </div>
                  <p className="mt-1.5 text-sm" style={{ color: tier.highlighted ? "rgba(5,5,5,0.6)" : "var(--tess-text-secondary)" }}>{tier.description}</p>
                </div>
                <ul className="mb-6 flex-1 space-y-2">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tier.highlighted ? "var(--tess-accent)" : "#28c840" }} />
                      <span style={{ color: tier.highlighted ? "rgba(5,5,5,0.7)" : "var(--tess-text-secondary)" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={user ? "/dashboard" : "/signup"}
                  className="mt-auto inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
                  style={tier.highlighted ? { backgroundColor: "var(--tess-bg)", color: "var(--tess-text)" } : { backgroundColor: "transparent", border: "1px solid var(--tess-border)", color: "var(--tess-text)" }}
                >
                  {tier.cta}
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Testimonial Carousel ───────────────────────────────── */}
      <section id="testimonials" className="relative z-10 py-16">
        <FadeIn>
          <div className="mb-6 text-center">
            <div className="flex items-center justify-center gap-1.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5" style={{ fill: "var(--tess-accent)", color: "var(--tess-accent)" }} />
              ))}
              <span className="ml-2 text-sm font-medium" style={{ color: "var(--tess-text-muted)" }}>4.9 rating</span>
            </div>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.02em" }}>Trusted by engineering teams</h2>
          </div>
        </FadeIn>
        <div className="space-y-4 overflow-hidden">
          <TestimonialRow testimonials={testimonials1} />
          <TestimonialRow testimonials={testimonials2} reverse />
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t" style={{ borderColor: "var(--tess-border)" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row">
          <p className="text-base font-semibold">Join the teams using OKRunit</p>
          <Link
            href={user ? "/dashboard" : "/signup"}
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition hover:brightness-110"
            style={{ backgroundColor: "var(--tess-accent)", color: "#000" }}
          >
            {user ? "Dashboard" : "Get started"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="border-t" style={{ borderColor: "var(--tess-border)" }}>
          <div className="mx-auto max-w-6xl px-5 py-10">
            <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-5">
              <div className="md:col-span-1">
                <Link href="/" className="flex items-center">
                  <Image src="/logo_text.png" alt="OKRunit" width={220} height={60} className="h-8 w-auto" />
                </Link>
              </div>
              {Object.entries(footerLinks).map(([heading, links]) => (
                <div key={heading}>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--tess-text-muted)" }}>{heading}</p>
                  <ul className="space-y-2">
                    {links.map((link) => (
                      <li key={link}><a href="#" className="text-sm transition hover:text-white" style={{ color: "var(--tess-text-secondary)" }}>{link}</a></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row" style={{ borderColor: "var(--tess-border)" }}>
              <p className="text-xs" style={{ color: "var(--tess-text-muted)" }}>&copy; {new Date().getFullYear()} OKRunit. All rights reserved.</p>
              <div className="flex gap-4 text-xs" style={{ color: "var(--tess-text-muted)" }}>
                <a href="#" className="transition hover:text-white">Terms of Service</a>
                <a href="#" className="transition hover:text-white">Privacy Policy</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
