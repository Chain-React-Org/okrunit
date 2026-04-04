"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TourTooltipProps {
  targetSelector: string | null;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  highlightMode?: "default" | "full-width" | "no-ring";
  actionLabel: string;
  stepNumber: number;
  totalSteps: number;
  onNext: () => void;
  onBack?: () => void;
  onClose: () => void;
  onSkip: () => void;
}

export function TourTooltip({
  targetSelector,
  title,
  description,
  position,
  actionLabel,
  highlightMode = "default",
  stepNumber,
  totalSteps,
  onNext,
  onBack,
  onClose,
  onSkip,
}: TourTooltipProps) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset ready state when step changes (targetSelector changes)
  useEffect(() => {
    setReady(false);
  }, [targetSelector]);

  // Find and track the target element
  useEffect(() => {
    if (!targetSelector) {
      setTargetRect(null);
      // For centered tooltips (no target), mark ready after a short delay
      const t = setTimeout(() => setReady(true), 100);
      return () => clearTimeout(t);
    }

    let timeout: ReturnType<typeof setTimeout>;
    let attempts = 0;

    function findTarget() {
      const el = document.querySelector(targetSelector as string);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            setTargetRect(el.getBoundingClientRect());
            setReady(true);
          }, 400);
        } else {
          // Wait for animations to complete before showing
          setTimeout(() => {
            // Re-read position after animations settle
            setTargetRect(el.getBoundingClientRect());
            setReady(true);
          }, 300);
        }
        return;
      }
      attempts++;
      if (attempts < 60) timeout = setTimeout(findTarget, 50);
    }

    findTarget();

    function handleReposition() {
      const el = document.querySelector(targetSelector as string);
      if (el) setTargetRect(el.getBoundingClientRect());
    }

    window.addEventListener("scroll", handleReposition, { passive: true });
    window.addEventListener("resize", handleReposition);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("scroll", handleReposition);
      window.removeEventListener("resize", handleReposition);
    };
  }, [targetSelector]);

  // Raise the target element above the overlay so it's visible and interactive
  useEffect(() => {
    if (!targetSelector || !ready || highlightMode === "full-width" || highlightMode === "no-ring") return;
    const el = document.querySelector(targetSelector) as HTMLElement | null;
    if (!el) return;

    // Save original styles
    const prevPosition = el.style.position;
    const prevZIndex = el.style.zIndex;
    const prevBg = el.style.backgroundColor;
    const prevBorderRadius = el.style.borderRadius;

    // Only set position:relative if the element doesn't already have positioning
    // (portal elements like dropdown menus already have fixed/absolute positioning)
    const computed = window.getComputedStyle(el);
    if (computed.position === "static") {
      el.style.position = "relative";
    }
    el.style.zIndex = "10000";
    // Use the themed background color (works in both light and dark mode)
    el.style.backgroundColor = "var(--card)";
    el.style.borderRadius = "0.5rem";

    // Also raise parent portal containers (for Radix portals)
    const portalParents: HTMLElement[] = [];
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      const parentZ = window.getComputedStyle(parent).zIndex;
      if (parentZ !== "auto" && parseInt(parentZ) < 10000) {
        portalParents.push(parent);
        parent.style.zIndex = "10000";
      }
      parent = parent.parentElement;
    }

    return () => {
      el.style.position = prevPosition;
      el.style.zIndex = prevZIndex;
      el.style.backgroundColor = prevBg;
      el.style.borderRadius = prevBorderRadius;
      portalParents.forEach((p) => { p.style.zIndex = ""; });
    };
  }, [targetSelector, ready, highlightMode]);

  if (!mounted) return null;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const isCentered = position === "center" || !targetRect;
  const defaultTooltipWidth = isMobile ? window.innerWidth - 32 : 360;
  const gap = 12;
  const pad = 16; // min padding from viewport edges
  const highlightPad = 12; // extra space for highlight ring

  let tooltipStyle: React.CSSProperties;
  let actualTooltipWidth = defaultTooltipWidth;
  if (isCentered) {
    tooltipStyle = { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  } else if (highlightMode === "full-width" && targetRect) {
    // Position tooltip centered horizontally in the dimmed area above the content
    const tooltipHeight = 180; // approximate
    const availableSpace = targetRect.top - 8;
    const topPos = Math.max(pad, availableSpace - tooltipHeight - gap);
    tooltipStyle = { position: "fixed", top: topPos, left: "50%", transform: "translateX(-50%)" };
  } else if (isMobile) {
    // On mobile, always show at bottom of screen
    tooltipStyle = { position: "fixed", bottom: pad, left: pad, right: pad };
  } else {
    const r = targetRect!;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Smart positioning: try requested position, auto-flip if not enough space
    let finalPos = position;

    // For left position: shrink tooltip to fit available space instead of flipping
    const leftPositionGap = 60; // clear gap between tooltip and target
    const availableLeft = r.left - leftPositionGap - pad;
    if (finalPos === "left") {
      if (availableLeft < 200) {
        finalPos = "bottom"; // Only flip if truly no space
      } else {
        actualTooltipWidth = Math.min(defaultTooltipWidth, availableLeft);
      }
    }

    if (finalPos === "right" && r.right + gap + actualTooltipWidth > vw - pad) finalPos = "bottom";
    if (finalPos === "bottom" && r.bottom + gap + 200 > vh) {
      // Only flip to top if there's more room above than below
      const spaceAbove = r.top;
      const spaceBelow = vh - r.bottom;
      if (spaceAbove > spaceBelow) finalPos = "top";
      // Otherwise stay at bottom — clampTop will keep it on screen
    }
    if (finalPos === "top" && r.top - gap - 200 < 0) finalPos = "bottom";

    // Clamp horizontal position to stay within viewport
    const clampLeft = (left: number) => Math.max(pad, Math.min(left, vw - actualTooltipWidth - pad));
    // Clamp vertical position
    const clampTop = (top: number) => Math.max(pad, Math.min(top, vh - 200));

    switch (finalPos) {
      case "bottom":
        tooltipStyle = { position: "fixed", top: clampTop(r.bottom + gap), left: clampLeft(r.left) };
        break;
      case "top":
        tooltipStyle = { position: "fixed", bottom: vh - r.top + gap, left: clampLeft(r.left) };
        break;
      case "left": {
        // Position using CSS `right` so the tooltip's right edge is anchored relative to the viewport
        const rightAnchor = vw - r.left + leftPositionGap;
        // Vertically center the tooltip relative to the visible portion of the target
        const visibleTop = Math.max(0, r.top);
        const visibleBottom = Math.min(vh, r.bottom);
        const visibleMid = (visibleTop + visibleBottom) / 2;
        const tooltipHeight = tooltipRef.current?.offsetHeight ?? 200;
        const topPos = clampTop(visibleMid - tooltipHeight / 2);
        tooltipStyle = { position: "fixed", top: topPos, right: rightAnchor, width: actualTooltipWidth };
        break;
      }
      case "right":
      default:
        tooltipStyle = { position: "fixed", top: clampTop(r.top), left: clampLeft(r.right + gap) };
        break;
    }
  }

  // Don't render until position is determined
  if (!ready) return null;

  return createPortal(
    <>
      {/* Overlay */}
      {targetRect && !isCentered && highlightMode === "full-width" ? (
        <div className="fixed inset-0 z-[9998] pointer-events-none animate-in fade-in duration-200" onClick={onClose}>
          {/* Top bar — full width, from top of viewport to top of content */}
          <div className="absolute inset-x-0 top-0 bg-black/40 pointer-events-auto" style={{ height: targetRect.top - 8 }} />
          {/* Left bar — sidebar column, from content top to bottom of viewport */}
          <div className="absolute bottom-0 left-0 bg-black/40 pointer-events-auto" style={{ top: targetRect.top - 8, width: targetRect.left - 8 }} />
        </div>
      ) : targetRect && !isCentered && highlightMode === "no-ring" ? (
        <div className="fixed inset-0 z-[9998] pointer-events-none animate-in fade-in duration-200">
          {/* Top strip */}
          <div className="absolute inset-x-0 top-0 bg-black/40 pointer-events-auto" style={{ height: targetRect.top }} onClick={onClose} />
          {/* Bottom strip */}
          <div className="absolute inset-x-0 bottom-0 bg-black/40 pointer-events-auto" style={{ top: targetRect.bottom }} onClick={onClose} />
          {/* Left strip */}
          <div className="absolute left-0 bg-black/40 pointer-events-auto" style={{ top: targetRect.top, height: targetRect.height, width: targetRect.left }} onClick={onClose} />
          {/* Right strip */}
          <div className="absolute right-0 bg-black/40 pointer-events-auto" style={{ top: targetRect.top, height: targetRect.height, left: targetRect.right }} onClick={onClose} />
        </div>
      ) : (
        <div className="fixed inset-0 z-[9998] bg-black/40 animate-in fade-in duration-200" onClick={onClose} />
      )}

      {/* Highlight ring around target — clamped so it doesn't go off-screen */}
      {targetRect && !isCentered && highlightMode !== "full-width" && highlightMode !== "no-ring" && (() => {
        const ringPad = 4;
        const ringTop = Math.max(0, targetRect.top - ringPad);
        const ringLeft = Math.max(0, targetRect.left - ringPad);
        const ringWidth = targetRect.width + ringPad * 2 - (ringLeft - (targetRect.left - ringPad));
        const ringHeight = targetRect.height + ringPad * 2 - (ringTop - (targetRect.top - ringPad));
        return (
          <div className="fixed z-[10001] rounded-lg ring-2 ring-primary ring-offset-2 ring-offset-white dark:ring-offset-card pointer-events-none transition-all duration-300 ease-out"
            style={{ top: ringTop, left: ringLeft, width: ringWidth, height: ringHeight }}
          />
        );
      })()}

      {/* Tooltip */}
      <div ref={tooltipRef} className="fixed z-[10002] rounded-xl border border-border bg-white shadow-2xl dark:bg-card animate-in fade-in slide-in-from-bottom-2 duration-300 transition-all ease-out" style={{ ...tooltipStyle, width: tooltipStyle.width ?? (isMobile ? "calc(100% - 2rem)" : actualTooltipWidth), maxWidth: actualTooltipWidth, transitionProperty: "top, bottom, left, right, transform", transitionDuration: "300ms" }}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-xs font-medium text-primary">Step {stepNumber} of {totalSteps}</p>
              <h3 className="text-sm font-semibold text-foreground mt-0.5">{title}</h3>
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          <div className="flex items-center justify-between mt-4">
            <button onClick={onSkip} className="text-xs text-muted-foreground hover:text-foreground">Skip tour</button>
            <div className="flex items-center gap-2">
              {onBack && (
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onBack}>
                  Back
                </Button>
              )}
              <Button size="sm" className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onNext}>
                {actionLabel}
                <ArrowRight className="size-3" />
              </Button>
            </div>
          </div>
          {/* Progress bar — integrated inside the card padding */}
          <div className="mt-4 h-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-500 ease-out" style={{ width: `${(stepNumber / totalSteps) * 100}%` }} />
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
