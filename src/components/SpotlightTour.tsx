"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useApulaTheme } from "@/context/ThemeContext";
import { TourStep } from "@/data/tourSteps";

export interface SpotlightTourProps {
  active: boolean;
  steps: TourStep[];
  onExit(completed: boolean): void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Clamped spotlight ring + step card that tracks target panels across resizes 💦
export function SpotlightTour({ active, steps, onExit }: SpotlightTourProps) {
  const { reducedMotion } = useApulaTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({
    w: 1280,
    h: 800,
  });

  const currentStep = steps[stepIndex] ?? null;

  useEffect(() => {
    if (active) {
      setStepIndex(0);
    }
  }, [active]);

  const measureTarget = useCallback(() => {
    if (!active || !currentStep) {
      setTargetRect(null);
      return;
    }
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const el = document.querySelector<HTMLElement>(currentStep.selector);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const pad = 6;
    const clampedTop = Math.max(8, r.top - pad);
    const clampedBottom = Math.min(window.innerHeight - 8, r.bottom + pad);
    const clampedLeft = Math.max(8, r.left - pad);
    const clampedRight = Math.min(window.innerWidth - 8, r.right + pad);
    setTargetRect({
      top: clampedTop,
      left: clampedLeft,
      width: Math.max(40, clampedRight - clampedLeft),
      height: Math.max(36, clampedBottom - clampedTop),
    });
  }, [active, currentStep]);

  useEffect(() => {
    if (!active || !currentStep) return;
    const el = document.querySelector<HTMLElement>(currentStep.selector);
    if (el) {
      el.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "center",
      });
    }

    let rafId = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measureTarget);
    };

    const timerId = window.setTimeout(scheduleMeasure, reducedMotion ? 20 : 260);
    scheduleMeasure();

    let observer: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(scheduleMeasure);
      observer.observe(el);
    }

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);

    return () => {
      window.clearTimeout(timerId);
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
    };
  }, [active, currentStep, reducedMotion, measureTarget]);

  const handleNext = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      onExit(true);
    } else {
      setStepIndex((i) => i + 1);
    }
  }, [stepIndex, steps.length, onExit]);

  const handleBack = useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onExit(false);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleBack();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, onExit, handleNext, handleBack]);

  if (!active || !currentStep) return null;

  const cardWidth = Math.min(430, viewport.w - 24);
  const cardHeight = 250;
  let cardLeft = Math.max(12, Math.round((viewport.w - cardWidth) / 2));
  let cardTop = Math.max(16, viewport.h - cardHeight - 20);

  if (targetRect) {
    const targetBottom = targetRect.top + targetRect.height;
    const spaceBelow = viewport.h - targetBottom;
    const spaceAbove = targetRect.top;

    cardLeft = Math.max(
      12,
      Math.min(targetRect.left, viewport.w - cardWidth - 12)
    );

    if (spaceBelow >= cardHeight + 16) {
      cardTop = targetBottom + 12;
    } else if (spaceAbove >= cardHeight + 16) {
      cardTop = targetRect.top - cardHeight - 12;
    } else {
      // Shove card near viewport bottom when a giant target hogged the screen.
      cardTop = Math.max(16, viewport.h - cardHeight - 16);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300]"
      aria-live="polite"
      aria-label="Interactive workspace tour"
    >
      <div
        className="fixed inset-0 bg-transparent"
        onClick={() => onExit(false)}
        aria-hidden="true"
      />

      {targetRect && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: `${targetRect.top}px`,
            left: `${targetRect.left}px`,
            width: `${targetRect.width}px`,
            height: `${targetRect.height}px`,
            borderRadius: "var(--ap-radius-card)",
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.48)",
            border: "2px solid var(--ap-accent)",
            pointerEvents: "none",
            transition: reducedMotion
              ? "none"
              : "top 180ms ease, left 180ms ease, width 180ms ease, height 180ms ease",
          }}
        />
      )}

      <div
        role="region"
        aria-label={currentStep.title}
        style={{
          position: "fixed",
          top: `${cardTop}px`,
          left: `${cardLeft}px`,
          width: `${cardWidth}px`,
        }}
        className="ap-popover p-5 space-y-3 z-[300]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="ap-eyebrow">{currentStep.badge}</span>
          <button
            type="button"
            onClick={() => onExit(false)}
            className="ap-pill px-2.5 py-0.5 text-[11px] font-medium"
          >
            Skip Tour
          </button>
        </div>

        <div>
          <h3 className="ap-text-1 font-display text-[17px] font-semibold tracking-[-0.22px]">
            {currentStep.title}
          </h3>
          <p className="ap-text-2 mt-1.5 text-[13px] leading-relaxed tracking-[-0.12px]">
            {currentStep.description}
          </p>
        </div>

        <div className="ap-divider flex items-center justify-between border-t pt-3">
          <div className="flex items-center gap-1.5">
            {steps.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Jump to step ${idx + 1}: ${s.title}`}
                onClick={() => setStepIndex(idx)}
                style={{
                  backgroundColor:
                    idx === stepIndex ? "var(--ap-accent)" : "var(--ap-text-3)",
                  opacity: idx === stepIndex ? 1 : 0.45,
                }}
                className={`h-2 rounded-full transition-all ${
                  idx === stepIndex ? "w-5" : "w-2"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={stepIndex === 0}
              onClick={handleBack}
              className="ap-pill px-2.5 py-1 text-xs font-bold disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="ap-btn-primary px-3 py-1 text-xs font-bold"
            >
              {stepIndex === steps.length - 1 ? "Finish Tour" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
