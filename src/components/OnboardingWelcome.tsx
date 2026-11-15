"use client";

import React, { useEffect, useRef } from "react";

export interface OnboardingWelcomeProps {
  open: boolean;
  onClose(): void;
  onStartTour(): void;
  onOpenScenarios(): void;
}

// First-visit welcome dialog built on native top-layer modal mechanics 🥷
export function OnboardingWelcome({
  open,
  onClose,
  onStartTour,
  onOpenScenarios,
}: OnboardingWelcomeProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const pointerDownOutsideRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.returnValue = "";
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.returnValue = "";
      dialog.close();
    }
  }, [open]);

  const handleClose = () => {
    const dialog = dialogRef.current;
    if (dialog) {
      dialog.returnValue = "";
      if (dialog.open) {
        dialog.close();
      }
    }
    onClose();
  };

  // Catch backdrop taps on browsers that ignore closedby="any" yet.
  const handlePointerDown = (event: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || event.target !== dialog) {
      pointerDownOutsideRef.current = false;
      return;
    }
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    pointerDownOutsideRef.current = !inside;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDialogElement>) => {
    const dialog = dialogRef.current;
    if (!dialog || !pointerDownOutsideRef.current || event.target !== dialog) {
      pointerDownOutsideRef.current = false;
      return;
    }
    const rect = dialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    pointerDownOutsideRef.current = false;
    if (!inside) {
      handleClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="apula-welcome-title"
      {...({ closedby: "any" } as Record<string, unknown>)}
      onCancel={(event) => {
        event.preventDefault();
        handleClose();
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      className="ap-dialog w-full max-w-2xl overflow-hidden z-[300]"
    >
      <div className="ap-divider flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <img
            src="/apulla.svg"
            alt="Project APULA"
            width={144}
            height={42}
            className="w-auto h-[42px] shrink-0 object-contain"
          />
          <div>
            <span className="ap-eyebrow block">Spacecraft Fire Safety</span>
            <h2
              id="apula-welcome-title"
              className="ap-text-1 font-display text-[20px] font-semibold tracking-[-0.22px]"
            >
              Welcome to Project APULA v3
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close welcome dialog"
          className="ap-pill inline-flex items-center justify-center p-2"
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

      <div className="overflow-y-auto px-6 py-5 space-y-4 text-[14px]">
        <p className="ap-text-2 leading-relaxed tracking-[-0.22px]">
          APULA simulates spacecraft cabin fire thresholds across orbital{" "}
          <strong className="ap-text-1">0g</strong>, Lunar{" "}
          <strong className="ap-text-1">0.16g</strong>, Mars{" "}
          <strong className="ap-text-1">0.38g</strong>, and{" "}
          <strong className="ap-text-1">1g</strong> environments, cross-checked
          against <strong className="ap-text-1">253</strong> normalized NASA
          Physical Sciences Informatics (PSI) flight tests from BASS, BASS-II,
          and Saffire-III.
        </p>

        <div className="ap-card p-4 space-y-2.5">
          <div className="ap-eyebrow">Data Transparency</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
            <div className="ap-subcard p-3">
              <span className="ap-prov-measured block mb-0.5">[MEASURED]</span>
              <span className="ap-text-2">Directly logged by NASA ISS/spacecraft sensors or raw PSI telemetry.</span>
            </div>
            <div className="ap-subcard p-3">
              <span className="ap-prov-inferred block mb-0.5">[INFERRED]</span>
              <span className="ap-text-2">Extracted deterministically from NASA sample strings (e.g., &quot;3/8&quot; black rod&quot;).</span>
            </div>
            <div className="ap-subcard p-3">
              <span className="ap-prov-defaulted block mb-0.5">[DEFAULTED]</span>
              <span className="ap-text-2">Standard 14.7 psi ISS baseline where raw rows omit cabin pressure.</span>
            </div>
            <div className="ap-subcard p-3">
              <span className="ap-prov-estimated block mb-0.5">[ESTIMATED]</span>
              <span className="ap-text-2">Computed live from APULA&apos;s semi-empirical gravity &amp; curvature model.</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-[13px]">
          <button
            type="button"
            onClick={() => {
              if (dialogRef.current?.open) {
                dialogRef.current.returnValue = "";
                dialogRef.current.close();
              }
              onStartTour();
            }}
            className="ap-btn-primary px-4 py-2.5 font-semibold text-center"
          >
            Start Interactive Tour (5 Steps)
          </button>

          <button
            type="button"
            onClick={() => {
              if (dialogRef.current?.open) {
                dialogRef.current.returnValue = "";
                dialogRef.current.close();
              }
              onOpenScenarios();
            }}
            className="ap-btn-secondary px-4 py-2.5 font-medium text-center"
          >
            Load a Historical Spaceflight Burn
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="ap-pill px-4 py-2.5 font-medium text-center"
          >
            Jump Straight to Simulator
          </button>
        </div>

        <p className="ap-text-3 text-[11px] text-center">
          Replay the tour or switch between Studio Clarity, Cosmic Nebula Glass, and Tactical Engineering Dark themes anytime in Settings.
        </p>
      </div>
    </dialog>
  );
}
