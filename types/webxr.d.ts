// Ambient type extensions for WebXR APIs not yet in lib.dom.d.ts

interface XRSessionInit {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
  domOverlay?: { root: Element };
}

interface Navigator {
  xr?: XRSystem;
}

interface XRSystem {
  isSessionSupported(mode: XRSessionMode): Promise<boolean>;
  requestSession(mode: XRSessionMode, options?: XRSessionInit): Promise<XRSession>;
}

type XRSessionMode = "inline" | "immersive-vr" | "immersive-ar";
