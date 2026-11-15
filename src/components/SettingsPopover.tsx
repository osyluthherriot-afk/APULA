"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { ApulaTheme, useApulaTheme } from "@/context/ThemeContext";

export interface SettingsPopoverProps {
  onRestartTutorial(): void;
}

// Clamped popover box sitting on the gear button so it never clips off-screen 👁️
export function SettingsPopover({ onRestartTutorial }: SettingsPopoverProps) {
  const {
    theme,
    setTheme,
    compactWidth,
    setCompactWidth,
    reducedMotion,
    setReducedMotion,
  } = useApulaTheme();
  const popoverId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 68,
    left: 16,
  });

  const syncPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 320;
    const nextLeft = Math.max(
      12,
      Math.min(rect.right - width, window.innerWidth - width - 12)
    );
    const nextTop = Math.min(rect.bottom + 10, window.innerHeight - 400);
    setCoords({ top: Math.max(12, nextTop), left: nextLeft });
  }, []);

  useEffect(() => {
    const popEl = popoverRef.current;
    if (!popEl) return;

    // Sync aria-expanded straight from native popover toggle events.
    const onToggle = (event: Event) => {
      const nextOpen = (event as ToggleEvent).newState === "open";
      if (nextOpen) {
        syncPosition();
      }
      setIsOpen(nextOpen);
    };

    popEl.addEventListener("toggle", onToggle);
    return () => popEl.removeEventListener("toggle", onToggle);
  }, [syncPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onReposition = () => syncPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isOpen, syncPosition]);

  const handleToggle = () => {
    syncPosition();
    const popEl = popoverRef.current as
      | (HTMLDivElement & { togglePopover?: () => void })
      | null;
    if (popEl && typeof popEl.togglePopover === "function") {
      try {
        popEl.togglePopover();
        return;
      } catch {
        // Fall back to state toggle if engine chokes on native API.
      }
    }
    setIsOpen((prev) => !prev);
  };

  const closePopover = () => {
    const popEl = popoverRef.current as
      | (HTMLDivElement & { hidePopover?: () => void })
      | null;
    if (popEl && typeof popEl.hidePopover === "function") {
      try {
        popEl.hidePopover();
      } catch {
        // Ignore if already closed.
      }
    }
    setIsOpen(false);
  };

  const themeOptions: { id: ApulaTheme; label: string; hint: string }[] = [
    {
      id: "clarity",
      label: "Studio Clarity (Default Light)",
      hint: "#FFFFFF canvas, #F5F5F7 borderless 28px cards, #0071E3 pills",
    },
    {
      id: "glass",
      label: "Cosmic Nebula Glass (Live Shader)",
      hint: "Live WebGL GLSL nebula & starfield behind frosted glass cards",
    },
    {
      id: "barebones",
      label: "Tactical Engineering Dark",
      hint: "Flat matte #111215 background, #181A20 sharp cards, zero blur",
    },
  ];

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        className="ap-pill inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium"
        title="Appearance & Preferences"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          className="w-4 h-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.983 1.907a1.75 1.75 0 0 0-3.966 0l-.18.92a1.75 1.75 0 0 1-2.55 1.057l-.808-.467a1.75 1.75 0 0 0-2.39 2.39l.467.808a1.75 1.75 0 0 1-1.057 2.55l-.92.18a1.75 1.75 0 0 0 0 3.966l.92.18a1.75 1.75 0 0 1 1.057 2.55l-.467.808a1.75 1.75 0 0 0 2.39 2.39l.808-.467a1.75 1.75 0 0 1 2.55 1.057l.18.92a1.75 1.75 0 0 0 3.966 0l.18-.92a1.75 1.75 0 0 1 2.55-1.057l.808.467a1.75 1.75 0 0 0 2.39-2.39l-.467-.808a1.75 1.75 0 0 1 1.057-2.55l.92-.18a1.75 1.75 0 0 0 0-3.966l-.92-.18a1.75 1.75 0 0 1-1.057-2.55l.467-.808a1.75 1.75 0 0 0-2.39-2.39l-.808.467a1.75 1.75 0 0 1-2.55-1.057l-.18-.92Z"
          />
          <circle cx="10" cy="10" r="2.75" />
        </svg>
        <span>Settings</span>
      </button>

      <div
        ref={popoverRef}
        id={popoverId}
        {...({ popover: "auto" } as Record<string, unknown>)}
        style={{
          position: "fixed",
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          width: "320px",
          maxHeight: "calc(100vh - 24px)",
        }}
        className="ap-popover p-4 space-y-4 z-[200] overflow-y-auto"
      >
        <div className="ap-divider flex items-center justify-between border-b pb-2.5">
          <div>
            <div className="ap-text-1 font-display text-[14px] font-semibold tracking-[-0.22px]">
              Workspace Settings
            </div>
            <div className="ap-text-3 text-[11px]">
              Saved locally across sessions
            </div>
          </div>
          <button
            type="button"
            onClick={closePopover}
            aria-label="Close settings"
            className="ap-pill inline-flex items-center justify-center p-1.5"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              className="w-3.5 h-3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4l8 8M12 4l-8 8"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-2">
          <div className="ap-eyebrow">Surface Theme</div>
          <div className="space-y-2">
            {themeOptions.map((opt) => {
              const active = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme(opt.id)}
                  aria-pressed={active}
                  className={`w-full text-left px-3 py-2.5 text-xs transition ${
                    active ? "ap-pill-active" : "ap-pill"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span>{opt.label}</span>
                    {active && <span className="text-[10px]">ACTIVE</span>}
                  </div>
                  <div className="opacity-85 text-[11px] mt-0.5">{opt.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        {theme === "clarity" && (
          <div className="ap-divider flex items-center justify-between border-t pt-3">
            <div>
              <div className="ap-text-1 text-xs font-semibold">
                Compact 980px Width
              </div>
              <div className="ap-text-3 text-[11px]">
                Constrain Studio Clarity column to 980px
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={compactWidth}
              onClick={() => setCompactWidth(!compactWidth)}
              className={`px-3 py-1 text-xs font-semibold ${
                compactWidth ? "ap-pill-active" : "ap-pill"
              }`}
            >
              {compactWidth ? "ON" : "OFF"}
            </button>
          </div>
        )}

        <div className="ap-divider flex items-center justify-between border-t pt-3">
          <div>
            <div className="ap-text-1 text-xs font-semibold">
              Reduced Motion
            </div>
            <div className="ap-text-3 text-[11px]">
              Disable UI transitions across controls
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reducedMotion}
            onClick={() => setReducedMotion(!reducedMotion)}
            className={`px-3 py-1 text-xs font-semibold ${
              reducedMotion ? "ap-pill-active" : "ap-pill"
            }`}
          >
            {reducedMotion ? "ON" : "OFF"}
          </button>
        </div>

        <div className="ap-divider border-t pt-3">
          <button
            type="button"
            onClick={() => {
              closePopover();
              onRestartTutorial();
            }}
            className="ap-btn-primary w-full px-3 py-2 text-xs font-semibold text-center"
          >
            Restart Onboarding &amp; Guided Tour
          </button>
        </div>
      </div>
    </div>
  );
}
