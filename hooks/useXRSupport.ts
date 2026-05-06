"use client";
import { useEffect, useState } from "react";

export type XRSupportState = "checking" | "supported" | "unsupported";

export function useXRSupport(): XRSupportState {
  const [state, setState] = useState<XRSupportState>("checking");

  useEffect(() => {
    if (!navigator.xr) {
      setState("unsupported");
      return;
    }
    navigator.xr
      .isSessionSupported("immersive-ar")
      .then((supported) => setState(supported ? "supported" : "unsupported"))
      .catch(() => setState("unsupported"));
  }, []);

  return state;
}
