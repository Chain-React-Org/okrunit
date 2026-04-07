"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, Bell, ArrowRight, Zap, Send } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Animated approval flow. Shows the product story in sequence         */
/*                                                                      */
/*  No fake 3D. Just real UI elements telling the story:                */
/*  1. API request comes in (code snippet)                              */
/*  2. Approval card appears                                            */
/*  3. Notification fires                                               */
/*  4. Human approves                                                   */
/*  5. Callback delivered                                               */
/* ------------------------------------------------------------------ */

type Step = 0 | 1 | 2 | 3 | 4 | 5;

export function HeroAnimation() {
  const [step, setStep] = useState<Step>(0);

  useEffect(() => {
    const delays = [1200, 1400, 1200, 1600, 1200, 2500];
    let timeout: NodeJS.Timeout;
    let current = 0;

    function advance() {
      current = ((current + 1) % 6) as Step;
      setStep(current as Step);
      timeout = setTimeout(advance, delays[current]);
    }

    timeout = setTimeout(advance, delays[0]);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="relative w-full max-w-lg mx-auto lg:mx-0">
      {/* Background card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xl shadow-gray-100/80">

        {/* Step indicator */}
        <div className="mb-4 flex items-center gap-3">
          {[
            { label: "Request", active: step >= 1 },
            { label: "Review", active: step >= 2 },
            { label: "Approve", active: step >= 4 },
            { label: "Callback", active: step >= 5 },
          ].map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`h-px w-4 transition-colors duration-500 ${s.active ? "bg-emerald-400" : "bg-gray-200"}`} />
              )}
              <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all duration-500 ${
                s.active ? "bg-emerald-50 text-emerald-700" : "bg-gray-50 text-gray-400"
              }`}>
                <div className={`size-1.5 rounded-full transition-colors duration-500 ${s.active ? "bg-emerald-500" : "bg-gray-300"}`} />
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* API request line */}
        <div className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 transition-all duration-700 ${
          step >= 1 ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-gray-50"
        }`}>
          <div className={`flex size-6 items-center justify-center rounded-md transition-colors duration-500 ${
            step >= 1 ? "bg-orange-100" : "bg-gray-200"
          }`}>
            <Zap className={`size-3.5 transition-colors duration-500 ${step >= 1 ? "text-orange-500" : "text-gray-400"}`} />
          </div>
          <span className="text-xs font-mono text-gray-500">
            POST /v1/approvals
          </span>
          <span className={`ml-auto text-[10px] font-semibold transition-all duration-500 ${
            step >= 1 ? "text-orange-500 opacity-100" : "opacity-0"
          }`}>
            from Zapier
          </span>
        </div>

        {/* Approval card */}
        <div className={`rounded-xl border transition-all duration-700 ${
          step >= 2 ? "border-gray-200 bg-white opacity-100 translate-y-0" : "border-transparent bg-gray-50 opacity-40 translate-y-2"
        }`}>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className={`size-4 transition-colors duration-500 ${step >= 4 ? "text-emerald-500" : "text-amber-500"}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-500 ${
                step >= 4 ? "text-emerald-600" : "text-amber-600"
              }`}>
                {step >= 4 ? "Approved" : "Pending Review"}
              </span>
            </div>
            <p className="text-sm font-semibold text-gray-900">Delete 10,247 stale user records</p>
            <p className="text-xs text-gray-400 mt-0.5">database_cleanup · high priority</p>

            <div className="mt-3 flex gap-2">
              <button className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all duration-500 ${
                step >= 4
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-200/50"
                  : step >= 3
                    ? "bg-emerald-500/10 text-emerald-600 ring-2 ring-emerald-500/30"
                    : "bg-gray-100 text-gray-500"
              }`}>
                {step >= 4 ? "✓ Approved" : "Approve"}
              </button>
              <button className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all duration-500 ${
                step >= 4 ? "bg-gray-50 text-gray-300" : "bg-gray-100 text-gray-500"
              }`}>
                Reject
              </button>
            </div>
          </div>
        </div>

        {/* Notification popup */}
        <div className={`mt-3 flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all duration-500 ${
          step >= 3 && step < 5 ? "border-blue-200 bg-blue-50 opacity-100 translate-y-0" : "border-transparent opacity-0 translate-y-2"
        }`}>
          <div className="flex size-6 items-center justify-center rounded-full bg-blue-100">
            <Bell className="size-3 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-gray-700">Slack notification sent</p>
            <p className="text-[10px] text-gray-400">#approvals · just now</p>
          </div>
        </div>

        {/* Callback response */}
        <div className={`mt-3 flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all duration-700 ${
          step >= 5 ? "border-emerald-200 bg-emerald-50 opacity-100 translate-y-0" : "border-transparent opacity-0 translate-y-2"
        }`}>
          <div className="flex size-6 items-center justify-center rounded-full bg-emerald-100">
            <Send className="size-3 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-emerald-700">Callback delivered</p>
            <p className="text-[10px] text-gray-400">POST https://your-app.com/webhook · 200 OK · 0.3s</p>
          </div>
        </div>
      </div>

      {/* Subtle shadow */}
      <div className="mx-auto mt-1 h-4 w-[85%] rounded-full bg-gray-200/30 blur-xl" />
    </div>
  );
}
