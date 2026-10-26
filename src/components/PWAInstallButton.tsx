import React, { useEffect, useState } from "react";
import { Download, Smartphone, WifiOff, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isInstallable) {
            install();
          } else {
            setShowGuide(true);
          }
        }}
        className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-transform hover:-translate-y-0.5 whitespace-nowrap shrink-0"
        style={{
          background: "rgba(0, 229, 255, 0.12)",
          border: "1px solid rgba(0, 229, 255, 0.35)",
          color: "var(--accent-2)",
        }}
      >
        <Smartphone className="w-3.5 h-3.5" />
        <span>Installer l'App</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5" style={{ color: "var(--accent-2)" }} />
                <h3 className="text-base font-black">
                  Installer ORBIT sur votre appareil
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                <p>Pour installer ORBIT sur iPhone ou iPad :</p>
                <ol className="list-decimal list-inside space-y-1.5 font-medium" style={{ color: "var(--text-main)" }}>
                  <li>Appuyez sur le bouton <strong>Partager</strong> dans la barre Safari.</li>
                  <li>Faites défiler et sélectionnez <strong>Sur l'écran d'accueil</strong>.</li>
                  <li>Validez pour profiter du mode plein écran et du partage direct.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                <p>
                  L'application PWA <strong>ORBIT</strong> active le <strong>Share Target natif</strong> : une fois installée sur Android ou ordinateur, vous pouvez partager n'importe quelle vidéo depuis YouTube ou TikTok directement vers ORBIT.
                </p>
                <ol className="list-decimal list-inside space-y-1.5 font-medium" style={{ color: "var(--text-main)" }}>
                  <li>Ouvrez le menu de votre navigateur (Chrome / Edge / Brave).</li>
                  <li>Cliquez sur <strong>Installer l'application</strong> ou <strong>Ajouter à l'écran d'accueil</strong>.</li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer"
              style={{
                background: "linear-gradient(135deg, var(--accent), #5e35ff)",
              }}
            >
              Compris
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-lg"
      style={{ background: "var(--warning)", color: "#121318" }}
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>Mode Hors-Ligne — Cache local ORBIT actif</span>
    </div>
  );
};
