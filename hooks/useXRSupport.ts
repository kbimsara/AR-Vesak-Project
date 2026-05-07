"use client";
import { useEffect, useState } from "react";
import { useIsIOS } from "./usePlatform";

export type XRSupportState = "checking" | "supported" | "ios-quicklook" | "unsupported";

export function useXRSupport(): XRSupportState {
  const [state, setState] = useState<XRSupportState>("checking");
  const isIOS = useIsIOS();

  useEffect(() => {
    if (!navigator.xr) {
      setState(isIOS ? "ios-quicklook" : "unsupported");
      return;
    }
    navigator.xr
      .isSessionSupported("immersive-ar")
      .then((supported) => {
        if (supported) {
          setState("supported");
        } else {
          setState(isIOS ? "ios-quicklook" : "unsupported");
        }
      })
      .catch(() => setState(isIOS ? "ios-quicklook" : "unsupported"));
  }, [isIOS]);

  return state;
}
