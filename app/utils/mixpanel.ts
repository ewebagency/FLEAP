import mixpanel from "mixpanel-browser";

// Configuration Mixpanel
const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || "";

let isInitialized = false;

export const initMixpanel = () => {
  if (isInitialized || typeof window === "undefined") {
    return;
  }

  console.log("🔍 Mixpanel - Tentative d'initialisation...");
  console.log("🔍 Token présent:", !!MIXPANEL_TOKEN);
  console.log("🔍 Token value:", MIXPANEL_TOKEN);

  if (!MIXPANEL_TOKEN) {
    console.error("❌ Mixpanel token is not defined - Vérifiez votre fichier .env");
    return;
  }

  try {
    mixpanel.init(MIXPANEL_TOKEN, {
      debug: true, // Toujours actif pour le débogage
      autocapture: true,
      record_sessions_percent: 100,
      api_host: "https://api-eu.mixpanel.com",
      persistence: "localStorage",
    });

    console.log("✅ Mixpanel initialisé avec succès!");
    isInitialized = true;
    
    // Envoyer un événement de test pour confirmer que ça fonctionne
    mixpanel.track("App Loaded", {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    });
    console.log("📊 Événement 'App Loaded' envoyé à Mixpanel");
  } catch (error) {
    console.error("❌ Erreur lors de l'initialisation de Mixpanel:", error);
  }
};

// Fonction pour tracker un événement
export const trackEvent = (eventName: string, properties?: Record<string, unknown>) => {
  if (typeof window !== "undefined" && isInitialized) {
    console.log("📊 Tracking event:", eventName, properties);
    mixpanel.track(eventName, properties);
  } else {
    console.warn("⚠️ Mixpanel not initialized, event not tracked:", eventName);
  }
};

// Fonction pour identifier un utilisateur
export const identifyUser = (userId: string, properties?: Record<string, unknown>) => {
  if (typeof window !== "undefined" && isInitialized) {
    console.log("👤 Identification Mixpanel:", userId, properties);
    mixpanel.identify(userId);
    if (properties) {
      mixpanel.people.set(properties);
    }
  } else {
    console.warn("⚠️ Mixpanel not initialized, user not identified:", userId);
  }
};

// Fonction pour reset l'utilisateur (lors de la déconnexion)
export const resetUser = () => {
  if (typeof window !== "undefined" && isInitialized) {
    console.log("👋 Reset utilisateur Mixpanel");
    mixpanel.reset();
  }
};

export { mixpanel };

