"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Tour Cursor
// ---------------------------------------------------------------------------
// Animated fake mouse cursor for the onboarding tour. Renders via portal
// above everything. Moves smoothly with CSS transitions.
// ---------------------------------------------------------------------------

import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface TourCursorProps {
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
}

export function TourCursor({ x, y, visible, clicking }: TourCursorProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed z-[10003] pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]",
        !visible && "opacity-0",
      )}
      style={{ left: x, top: y }}
    >
      {/* Cursor SVG (macOS-style pointer) */}
      <svg
        width="20"
        height="24"
        viewBox="0 0 20 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "drop-shadow-md transition-transform duration-100",
          clicking && "scale-90",
        )}
      >
        <path
          d="M1 1L1 18.5L5.5 14.5L9.5 22L12.5 20.5L8.5 13H14.5L1 1Z"
          fill="white"
          stroke="black"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      {/* Click ripple effect */}
      {clicking && (
        <div className="absolute left-0.5 top-0.5 size-4 rounded-full bg-primary/30 animate-ping" />
      )}
    </div>,
    document.body,
  );
}
