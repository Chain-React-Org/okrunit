"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useCallback } from "react";
import {
  ArrowRight,
  Check,
  Star,
  Shield,
  Zap,
  Bell,
  GitBranch,
  Lock,
  Workflow,
  Play,
  Menu,
  X,
  ChevronRight,
  Users,
  Eye,
  Upload,
  LayoutDashboard,
  Key,
  ShieldCheck,
  FileText,
  Webhook,
  Settings,
  BarChart3,
  FlaskConical,
  Clock,
  Search,
  InboxIcon,
} from "lucide-react";
import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Animated mesh‑gradient aurora background                           */
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

    // Aurora blobs — soft, slow-moving
    const blobs = [
      { cx: w * 0.2 + Math.sin(t * 0.7) * w * 0.12, cy: h * 0.06 + Math.cos(t * 0.5) * h * 0.03, rx: w * 0.38, ry: h * 0.08, color: "rgba(33,150,243,0.045)" },
      { cx: w * 0.75 + Math.cos(t * 0.5) * w * 0.1, cy: h * 0.04 + Math.sin(t * 0.7) * h * 0.02, rx: w * 0.32, ry: h * 0.07, color: "rgba(0,188,212,0.035)" },
      { cx: w * 0.5 + Math.sin(t * 0.4 + 1) * w * 0.15, cy: h * 0.14 + Math.cos(t * 0.3) * h * 0.02, rx: w * 0.28, ry: h * 0.06, color: "rgba(30,136,229,0.04)" },
      { cx: w * 0.3 + Math.cos(t * 0.6 + 2) * w * 0.1, cy: h * 0.25 + Math.sin(t * 0.5) * h * 0.02, rx: w * 0.22, ry: h * 0.05, color: "rgba(0,188,212,0.025)" },
      { cx: w * 0.8 + Math.sin(t * 0.3 + 3) * w * 0.08, cy: h * 0.35 + Math.cos(t * 0.4) * h * 0.02, rx: w * 0.2, ry: h * 0.04, color: "rgba(33,150,243,0.02)" },
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

    // Flowing wave lines
    for (let i = 0; i < 5; i++) {
      const yBase = h * (0.04 + i * 0.08);
      const alpha = 0.018 + (i % 3) * 0.006;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(33,150,243,${alpha})`;
      ctx.lineWidth = 0.6;
      for (let x = 0; x <= w; x += 3) {
        const y = yBase + Math.sin(x * 0.004 + t * 2.5 + i * 1.3) * 20 + Math.sin(x * 0.008 + t * 1.8 + i * 0.7) * 10;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Floating motes
    for (let i = 0; i < 15; i++) {
      const seed = i * 137.508;
      const mx = ((seed * 7.3 + t * 10 * (0.3 + (i % 5) * 0.12)) % w + w) % w;
      const my = ((seed * 3.7 + t * 6 * (0.2 + (i % 4) * 0.08)) % (h * 0.5) + (h * 0.5)) % (h * 0.5);
      const flicker = 0.12 + Math.sin(t * 4 + i * 2.1) * 0.06;
      ctx.beginPath();
      ctx.arc(mx, my, 1 + Math.sin(t * 2.5 + i) * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(66,165,245,${flicker})`;
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
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, [draw]);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" />;
}

/* ------------------------------------------------------------------ */
/*  Scroll‑animated wrapper                                            */
/* ------------------------------------------------------------------ */

function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setTimeout(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; }, delay); observer.unobserve(el); }
    }, { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div ref={ref} className={className} style={{ opacity: 0, transform: "translateY(24px)", transition: "opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)" }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated logo ticker                                               */
/* ------------------------------------------------------------------ */

function LogoTicker() {
  const logos = ["Zapier", "Make", "n8n", "Windmill", "LangChain", "OpenAI", "Slack", "Vercel"];
  const row = [...logos, ...logos];
  return (
    <div className="relative overflow-hidden py-6" style={{ maskImage: "linear-gradient(to right, transparent, white 15%, white 85%, transparent)" }}>
      <div className="flex animate-[scroll-x_35s_linear_infinite] gap-12 hover:[animation-play-state:paused]">
        {row.map((name, i) => (
          <span key={`${name}-${i}`} className="shrink-0 text-xl font-bold tracking-tight whitespace-nowrap" style={{ color: "#a3a3a3" }}>{name}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Testimonial Carousel Row                                           */
/* ------------------------------------------------------------------ */

function TestimonialRow({ testimonials, reverse = false }: { testimonials: { quote: string; name: string; role: string }[]; reverse?: boolean }) {
  const doubled = [...testimonials, ...testimonials];
  return (
    <div className="relative overflow-hidden" style={{ maskImage: "linear-gradient(to right, transparent, white 10%, white 90%, transparent)" }}>
      <div className="flex gap-5" style={{ animation: `${reverse ? "scroll-x-reverse" : "scroll-x"} 45s linear infinite` }}>
        {doubled.map((t, i) => (
          <div key={`${t.name}-${i}`} className="w-[380px] shrink-0 rounded-3xl border p-6" style={{ backgroundColor: "#ffffff", borderColor: "#e7e6e4" }}>
            <p className="mb-4 text-sm leading-relaxed" style={{ color: "#525252" }}>&ldquo;{t.quote}&rdquo;</p>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#1f2323" }}>{t.name}</p>
              <p className="text-xs" style={{ color: "#a3a3a3" }}>{t.role}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock App Dashboard (matches real sidebar + header + approval cards) */
/* ------------------------------------------------------------------ */

function MockDashboard() {
  const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", active: true, badge: "3" },
    { icon: Key, label: "Connections", active: false },
    { icon: Users, label: "Team", active: false },
    { icon: ShieldCheck, label: "Rules", active: false },
    { icon: FileText, label: "Audit Log", active: false },
    { icon: Webhook, label: "Webhooks", active: false },
    { icon: BarChart3, label: "Analytics", active: false },
    { icon: FlaskConical, label: "Playground", active: false },
    { icon: Settings, label: "Settings", active: false },
  ];

  const approvals = [
    { title: "Delete user account #4821", desc: "Permanently remove user and all associated data", source: "Zapier", time: "2 min ago", status: "Pending", statusColor: "#f59e0b", priority: "High", prioColor: "#ef4444" },
    { title: "Send bulk email (2,400 recipients)", desc: "Marketing campaign — Q1 product launch", source: "n8n", time: "8 min ago", status: "Approved", statusColor: "#22c55e", priority: "Medium", prioColor: "#f59e0b" },
    { title: "Deploy to production v3.2.1", desc: "Release includes auth fix and new webhook endpoint", source: "AI Agent", time: "14 min ago", status: "Pending", statusColor: "#f59e0b", priority: "High", prioColor: "#ef4444" },
    { title: "Update billing plan for org #127", desc: "Upgrade from Pro to Enterprise tier", source: "Zapier", time: "23 min ago", status: "Approved", statusColor: "#22c55e", priority: "Low", prioColor: "#6b7280" },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border shadow-2xl" style={{ borderColor: "#e5e7eb" }}>
      {/* Browser chrome — just traffic light dots, NO url bar */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ backgroundColor: "#f9fafb", borderColor: "#e5e7eb" }}>
        <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
      </div>

      {/* App layout: sidebar + content */}
      <div className="flex" style={{ backgroundColor: "#ffffff", height: "380px" }}>
        {/* Sidebar */}
        <div className="hidden w-48 shrink-0 border-r sm:flex sm:flex-col" style={{ borderColor: "#e5e7eb", backgroundColor: "#fafafa" }}>
          {/* Logo */}
          <div className="flex items-center justify-center border-b px-3 py-2.5" style={{ borderColor: "#e5e7eb" }}>
            <Image src="/logo_text.png" alt="OKRunit" width={220} height={60} className="h-7 w-auto" />
          </div>
          {/* Nav items */}
          <div className="flex-1 space-y-0.5 px-2 py-2">
            {sidebarItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-medium"
                style={{
                  backgroundColor: item.active ? "#f3f4f6" : "transparent",
                  color: item.active ? "#111827" : "#6b7280",
                }}
              >
                <item.icon className="h-3 w-3 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="rounded bg-red-500 px-1 py-0.5 text-[8px] font-bold leading-none text-white">
                    {item.badge}
                  </span>
                )}
              </div>
            ))}
          </div>
          {/* User */}
          <div className="border-t px-2 py-2" style={{ borderColor: "#e5e7eb" }}>
            <div className="flex items-center gap-2 px-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full text-[7px] font-bold text-white" style={{ backgroundColor: "#6b7280" }}>NS</div>
              <span className="text-[9px] text-[#6b7280]">nathaniel@okrunit.com</span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center border-b px-4 py-2" style={{ borderColor: "#e5e7eb" }}>
            <span className="text-sm font-semibold" style={{ color: "#111827" }}>Dashboard</span>
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-2 border-b px-4 py-2" style={{ borderColor: "#e5e7eb" }}>
            <div className="flex items-center gap-1.5 rounded-md border px-2 py-1" style={{ borderColor: "#e5e7eb" }}>
              <Search className="h-2.5 w-2.5" style={{ color: "#9ca3af" }} />
              <span className="text-[9px]" style={{ color: "#9ca3af" }}>Search approvals...</span>
            </div>
            <div className="rounded-md border px-2 py-1 text-[9px]" style={{ borderColor: "#e5e7eb", color: "#6b7280" }}>Status: All</div>
            <div className="rounded-md border px-2 py-1 text-[9px]" style={{ borderColor: "#e5e7eb", color: "#6b7280" }}>Priority: All</div>
          </div>

          {/* Approval cards */}
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {approvals.map((a) => (
              <div key={a.title} className="rounded-lg border p-3 transition-shadow hover:shadow-sm" style={{ borderColor: "#e5e7eb" }}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold leading-tight" style={{ color: "#111827" }}>{a.title}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full border px-1.5 py-0.5 text-[8px] font-medium" style={{ borderColor: a.prioColor, color: a.prioColor }}>{a.priority}</span>
                    <span className="rounded-full px-1.5 py-0.5 text-[8px] font-medium text-white" style={{ backgroundColor: a.statusColor }}>{a.status}</span>
                  </div>
                </div>
                <p className="mt-0.5 text-[9px] leading-tight" style={{ color: "#6b7280" }}>{a.desc}</p>
                <div className="mt-1.5 flex items-center gap-2 text-[8px]" style={{ color: "#9ca3af" }}>
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

interface TesslateHeroProps {
  user: { email: string; full_name: string | null } | null;
}

export function TesslateHero({ user }: TesslateHeroProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div
      className="relative min-h-screen"
      style={{ backgroundColor: "#f9ecde", color: "#1f2323", fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      {/* Keyframe animations */}
      <style jsx global>{`
        @keyframes scroll-x {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scroll-x-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>

      {/* Animated background */}
      <AnimatedBackground />

      {/* ── Floating Navigation ────────────────────────────────── */}
      <nav className="fixed left-1/2 top-6 z-50 w-[95%] max-w-4xl -translate-x-1/2">
        <div className="flex items-center justify-between rounded-xl border px-3 py-2 shadow-lg backdrop-blur-md" style={{ backgroundColor: "rgba(255,255,255,0.92)", borderColor: "#e5e7eb" }}>
          {/* Logo — actual app logo */}
          <Link href="/tesslate" className="flex items-center">
            <Image src="/logo_text.png" alt="OKRunit" width={440} height={120} className="h-9 w-auto" />
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm transition hover:opacity-70" style={{ color: "#525252" }}>About</a>
            <a href="#pricing" className="text-sm transition hover:opacity-70" style={{ color: "#525252" }}>Pricing</a>
            <a href="#testimonials" className="text-sm transition hover:opacity-70" style={{ color: "#525252" }}>Testimonials</a>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2">
            <Link
              href={user ? "/dashboard" : "/signup"}
              className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 md:inline-flex"
              style={{ backgroundColor: "#1f2323" }}
            >
              {user ? "Dashboard" : "Start for free"}
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden" style={{ color: "#1f2323" }}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="mt-2 rounded-xl border bg-white p-4 shadow-lg md:hidden" style={{ borderColor: "#e5e7eb" }}>
            <div className="flex flex-col gap-3">
              <a href="#features" className="text-sm" style={{ color: "#525252" }} onClick={() => setMobileMenuOpen(false)}>About</a>
              <a href="#pricing" className="text-sm" style={{ color: "#525252" }} onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <a href="#testimonials" className="text-sm" style={{ color: "#525252" }} onClick={() => setMobileMenuOpen(false)}>Testimonials</a>
              <Link href={user ? "/dashboard" : "/signup"} className="mt-1 rounded-lg px-4 py-2 text-center text-sm font-semibold text-white" style={{ backgroundColor: "#1f2323" }}>
                {user ? "Dashboard" : "Start for free"}
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ───────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-48 text-center lg:pt-56 lg:pb-32">
        <FadeIn>
          <Link href="/signup" className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition hover:shadow-sm" style={{ backgroundColor: "#ffffff", borderColor: "#e7e6e4", color: "#525252" }}>
            Now available for AI agent teams
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </FadeIn>

        <FadeIn delay={100}>
          <h1 className="mx-auto max-w-4xl text-5xl font-bold leading-[1.08] sm:text-6xl lg:text-7xl" style={{ letterSpacing: "-0.03em", color: "#1f2323" }}>
            Human approval for every automation
          </h1>
        </FadeIn>

        <FadeIn delay={200}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed" style={{ color: "#525252" }}>
            The approval gateway for AI agents, automations, and workflows. One API call pauses execution until a human approves.
          </p>
        </FadeIn>

        <FadeIn delay={300}>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4" style={{ fill: "#ff911d", color: "#ff911d" }} />)}
            <span className="ml-1.5 text-sm" style={{ color: "#a3a3a3" }}>4.9 rating</span>
          </div>
        </FadeIn>

        <FadeIn delay={400}>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={user ? "/dashboard" : "/signup"} className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: "#1f2323" }}>
              {user ? "Go to Dashboard" : "Get started free"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#features" className="inline-flex items-center gap-2 rounded-xl border px-7 py-3.5 text-sm font-semibold transition hover:shadow-sm" style={{ backgroundColor: "#ffffff", borderColor: "#e7e6e4", color: "#1f2323" }}>
              <Play className="h-3.5 w-3.5" />
              See how it works
            </a>
          </div>
        </FadeIn>

        {/* Dashboard preview — realistic mock of the actual app */}
        <FadeIn delay={500}>
          <div className="relative mx-auto mt-16 max-w-5xl">
            <MockDashboard />
          </div>
        </FadeIn>
      </section>

      {/* ── Logo Ticker ────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-8">
        <FadeIn>
          <p className="mb-4 text-center text-sm font-medium" style={{ color: "#a3a3a3" }}>Works with the tools your team already uses</p>
          <LogoTicker />
        </FadeIn>
      </section>

      {/* ── Feature Grid ───────────────────────────────────────── */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {gridCards.map((card, i) => (
            <FadeIn key={card.title} delay={i * 80}>
              <div className="flex min-h-[18rem] flex-col justify-end rounded-3xl border p-6" style={{ backgroundColor: "#f9f9f9", borderColor: "#e7e6e4" }}>
                <h3 className="text-lg font-bold" style={{ color: "#1f2323" }}>{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed" style={{ color: "#525252" }}>{card.description}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={100}>
          <div className="mt-5 rounded-3xl border p-8 md:p-12" style={{ backgroundColor: "#f9f9f9", borderColor: "#e7e6e4" }}>
            <div className="max-w-2xl">
              <h3 className="text-2xl font-bold md:text-3xl" style={{ color: "#1f2323", letterSpacing: "-0.02em" }}>{bigCard.title}</h3>
              <p className="mt-3 text-base leading-relaxed" style={{ color: "#525252" }}>{bigCard.description}</p>
              <Link href={user ? "/dashboard" : "/signup"} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold transition hover:opacity-70" style={{ color: "#ff911d" }}>
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Features List + Side Visual ────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <FadeIn>
          <div className="mb-10 max-w-xl">
            <h2 className="text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.02em", color: "#1f2323" }}>Everything you need for safe automation</h2>
          </div>
        </FadeIn>

        <div className="grid items-start gap-8 lg:grid-cols-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {features.map((feature, i) => (
              <FadeIn key={feature.title} delay={i * 80}>
                <div className="rounded-3xl border p-6" style={{ backgroundColor: "#ffffff", borderColor: "#e7e6e4" }}>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: "#fef5ee", color: "#ff911d" }}>
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold" style={{ color: "#1f2323" }}>{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "#525252" }}>{feature.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={200}>
            <div className="flex min-h-[400px] items-center justify-center rounded-3xl border lg:min-h-[500px]" style={{ backgroundColor: "#f9f9f9", borderColor: "#e7e6e4" }}>
              <div className="p-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: "#fef5ee" }}>
                  <Shield className="h-8 w-8" style={{ color: "#ff911d" }} />
                </div>
                <p className="text-3xl font-bold" style={{ color: "#1f2323" }}>2.4 min</p>
                <p className="text-sm" style={{ color: "#a3a3a3" }}>avg. approval response time</p>
                <div className="mx-auto mt-6 h-px w-16" style={{ backgroundColor: "#e7e6e4" }} />
                <p className="mt-6 text-3xl font-bold" style={{ color: "#1f2323" }}>99.9%</p>
                <p className="text-sm" style={{ color: "#a3a3a3" }}>webhook delivery rate</p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Testimonial Quote ──────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 py-20 text-center">
        <FadeIn>
          <h2 className="text-2xl font-bold leading-snug md:text-4xl" style={{ letterSpacing: "-0.02em", color: "#1f2323" }}>
            &ldquo;OKRunit stopped our AI agent from deleting a production database. That single approval saved us weeks of recovery time.&rdquo;
          </h2>
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: "#ff911d" }}>MC</div>
            <div className="text-left">
              <p className="text-sm font-semibold" style={{ color: "#1f2323" }}>Marcus Chen</p>
              <p className="text-xs" style={{ color: "#a3a3a3" }}>CTO @ DataFlow</p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── Three-Column Product Section ───────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-5 lg:grid-cols-3">
          {steps.map((step, i) => (
            <FadeIn key={step.badge} delay={i * 100}>
              <div className="flex flex-col justify-between rounded-3xl border p-6 lg:min-h-[28rem]" style={{ backgroundColor: "#f9f9f9", borderColor: "#e7e6e4" }}>
                <div>
                  <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: "#fef5ee", color: "#da4e02" }}>{step.badge}</span>
                  <h3 className="mt-4 text-xl font-bold" style={{ letterSpacing: "-0.01em", color: "#1f2323" }}>{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "#525252" }}>{step.description}</p>
                </div>
                {step.features && (
                  <div className="mt-6 flex flex-wrap gap-2">
                    {step.features.map((f) => (
                      <span key={f} className="rounded-lg border px-3 py-1.5 text-xs font-medium" style={{ borderColor: "#e7e6e4", color: "#525252", backgroundColor: "#ffffff" }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Dark CTA Banner ────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 py-8">
        <FadeIn>
          <div className="rounded-3xl p-8 text-center md:p-16 lg:p-20" style={{ backgroundColor: "#1f2323" }}>
            <h2 className="mx-auto max-w-2xl text-3xl font-bold text-white md:text-5xl" style={{ letterSpacing: "-0.03em" }}>Start protecting your automations today</h2>
            <p className="mx-auto mt-4 max-w-lg text-base text-white/50">Free to start. No credit card required. Add human oversight in minutes.</p>
            <Link href={user ? "/dashboard" : "/signup"} className="mt-8 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition hover:opacity-90" style={{ backgroundColor: "#e7e6c9", color: "#1f2323" }}>
              {user ? "Go to Dashboard" : "Get started free"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* ── Pricing Section ────────────────────────────────────── */}
      <section id="pricing" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
        <FadeIn>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.02em", color: "#1f2323" }}>Simple, transparent pricing</h2>
            <p className="mt-3 text-base" style={{ color: "#525252" }}>Start free. Scale as your team grows.</p>
          </div>
        </FadeIn>

        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2 lg:grid-cols-4">
          {pricingTiers.map((tier, i) => (
            <FadeIn key={tier.name} delay={i * 80}>
              <div
                className={`relative flex h-full flex-col rounded-3xl border p-6 transition-shadow hover:shadow-lg ${tier.highlighted ? "shadow-lg" : ""}`}
                style={{ backgroundColor: tier.highlighted ? "#1f2323" : "#ffffff", borderColor: tier.highlighted ? "#1f2323" : "#e7e6e4", color: tier.highlighted ? "#ffffff" : "#1f2323" }}
              >
                {tier.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold" style={{ backgroundColor: "#ff911d", color: "#ffffff" }}>Most Popular</div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-bold">{tier.name}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    {tier.period && <span className="text-sm" style={{ color: tier.highlighted ? "rgba(255,255,255,0.5)" : "#a3a3a3" }}>{tier.period}</span>}
                  </div>
                  <p className="mt-1.5 text-sm" style={{ color: tier.highlighted ? "rgba(255,255,255,0.5)" : "#525252" }}>{tier.description}</p>
                </div>
                <ul className="mb-8 flex-1 space-y-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: tier.highlighted ? "#ff911d" : "#28c840" }} />
                      <span style={{ color: tier.highlighted ? "rgba(255,255,255,0.7)" : "#525252" }}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={user ? "/dashboard" : "/signup"}
                  className="mt-auto inline-flex items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition hover:opacity-90"
                  style={tier.highlighted ? { backgroundColor: "#e7e6c9", color: "#1f2323" } : { backgroundColor: "transparent", border: "1px solid #e7e6e4", color: "#1f2323" }}
                >
                  {tier.cta}
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Testimonial Carousel ───────────────────────────────── */}
      <section id="testimonials" className="relative z-10 py-20">
        <FadeIn>
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-1.5">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5" style={{ fill: "#ff911d", color: "#ff911d" }} />)}
              <span className="ml-2 text-sm font-medium" style={{ color: "#a3a3a3" }}>4.9 rating</span>
            </div>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl" style={{ letterSpacing: "-0.02em", color: "#1f2323" }}>Trusted by engineering teams</h2>
          </div>
        </FadeIn>
        <div className="space-y-5 overflow-hidden">
          <TestimonialRow testimonials={testimonials1} />
          <TestimonialRow testimonials={testimonials2} reverse />
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t" style={{ borderColor: "#e7e6e4" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 sm:flex-row">
          <p className="text-base font-semibold" style={{ color: "#1f2323" }}>Join the teams using OKRunit</p>
          <Link href={user ? "/dashboard" : "/signup"} className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: "#1f2323" }}>
            {user ? "Dashboard" : "Get started"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="border-t" style={{ borderColor: "#e7e6e4" }}>
          <div className="mx-auto max-w-6xl px-5 py-12">
            <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-5">
              <div className="md:col-span-1">
                <Link href="/tesslate" className="flex items-center">
                  <Image src="/logo_text.png" alt="OKRunit" width={220} height={60} className="h-8 w-auto" />
                </Link>
              </div>
              {Object.entries(footerLinks).map(([heading, links]) => (
                <div key={heading}>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "#a3a3a3" }}>{heading}</p>
                  <ul className="space-y-2">
                    {links.map((link) => (
                      <li key={link}><a href="#" className="text-sm transition hover:opacity-70" style={{ color: "#525252" }}>{link}</a></li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row" style={{ borderColor: "#e7e6e4" }}>
              <p className="text-xs" style={{ color: "#a3a3a3" }}>&copy; {new Date().getFullYear()} OKRunit. All rights reserved.</p>
              <div className="flex gap-4 text-xs" style={{ color: "#a3a3a3" }}>
                <a href="#" className="transition hover:opacity-70">Terms of Service</a>
                <a href="#" className="transition hover:opacity-70">Privacy Policy</a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
