"use client";
import { useEffect, useRef, useState } from "react";

export interface DeviceOrientation {
  alpha: number; // compass heading (0–360)
  beta: number;  // front-back tilt
  gamma: number; // left-right tilt
}

export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState<DeviceOrientation>({ alpha: 0, beta: 0, gamma: 0 });
  const [permissionGranted, setPermissionGranted] = useState(false);
  const listenerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  const handler = (e: DeviceOrientationEvent) => {
    setOrientation({
      alpha: e.alpha ?? 0,
      beta: e.beta ?? 0,
      gamma: e.gamma ?? 0,
    });
  };

  const requestPermission = async () => {
    // iOS 13+ requires explicit permission
    const DevOrEvent = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (typeof DevOrEvent.requestPermission === "function") {
      const result = await DevOrEvent.requestPermission();
      if (result !== "granted") return;
    }
    listenerRef.current = handler;
    window.addEventListener("deviceorientation", handler, true);
    setPermissionGranted(true);
  };

  useEffect(() => {
    // On non-iOS, start listening immediately
    const DevOrEvent = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (typeof DevOrEvent.requestPermission !== "function") {
      listenerRef.current = handler;
      window.addEventListener("deviceorientation", handler, true);
      setPermissionGranted(true);
    }

    return () => {
      if (listenerRef.current) {
        window.removeEventListener("deviceorientation", listenerRef.current, true);
      }
    };
  }, []);

  return { orientation, permissionGranted, requestPermission };
}
