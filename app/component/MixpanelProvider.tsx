"use client";

import { useEffect } from "react";
import { initMixpanel } from "../utils/mixpanel";

export const MixpanelProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Initialiser Mixpanel au montage du composant
    initMixpanel();
  }, []);

  return <>{children}</>;
};

