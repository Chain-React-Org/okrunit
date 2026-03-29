"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin animated progress bar shown at the top of the page during route transitions.
 * Mimics the behavior of NProgress / YouTube-style loading indicators.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const prevPathname = useRef(pathname);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (pathname === prevPathname.current) return;
    prevPathname.current = pathname;

    // Navigation completed — jump to 100% and fade out
    setProgress(100);
    setVisible(true);

    clearTimeout(timerRef.current);
    clearInterval(intervalRef.current);

    timerRef.current = setTimeout(() => {
      setVisible(false);
      setTimeout(() => setProgress(0), 200);
    }, 200);
  }, [pathname]);

  // Listen for click events on links to START the progress bar
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:")) return;
      if (anchor.target === "_blank") return;
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;

      // Same page — skip
      if (href === prevPathname.current) return;

      // Start progress animation
      setProgress(15);
      setVisible(true);

      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 90) {
            clearInterval(intervalRef.current);
            return 90;
          }
          // Slow down as it progresses
          const increment = p < 30 ? 10 : p < 60 ? 5 : 2;
          return Math.min(p + increment, 90);
        });
      }, 200);
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  if (progress === 0 && !visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-[2px] pointer-events-none"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease-out" }}
    >
      <div
        className="h-full bg-primary"
        style={{
          width: `${progress}%`,
          transition: progress === 0 ? "none" : "width 200ms ease-out",
        }}
      />
    </div>
  );
}
