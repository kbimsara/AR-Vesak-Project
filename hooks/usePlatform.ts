"use client";
import { useMemo } from "react";

export function useIsIOS(): boolean {
  return useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    // iPadOS 13+ reports as "Mac" with touch points
    return (
      /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes("Mac") && navigator.maxTouchPoints > 1)
    );
  }, []);
}
