import React, { useState, useEffect } from "react";
import QRCode from "qrcode";
import { OrbitVideo } from "../data/orbitData";
import {
  QrCode,
  Download,
  Copy,
  Check,
  X,
  Smartphone,
  Sparkles,
  Star,
  ExternalLink,
} from "lucide-react";

interface PlaylistQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectionTitle: string;
  selectionSubtitle: string;
  curatorName: string;
  videos: OrbitVideo[];
  sourcePageLabel: string;
  onSimulateScanSelection: (videos: OrbitVideo[], title: string) => void;
  onShowToast: (msg: string) => void;
}

export const PlaylistQrModal: React.FC<PlaylistQrModalProps> = ({
  isOpen,
  onClose,
  selectionTitle,
  selectionSubtitle,
  curatorName,
  videos,
  sourcePageLabel,
  onSimulateScanSelection,
  onShowToast,
}) => {
  const [customTitle, setCustomTitle] = useState(selectionTitle);
  const [qrSvgMarkup, setQrSvgMarkup] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    setCustomTitle(selectionTitle);
  }, [selectionTitle, isOpen]);

  const selectedVideos = videos.slice(0, 8);
  const videoIdsParam = selectedVideos.map((v) => v.id).join(",");

  const baseOrigin =
    typeof window !== "undefined" && window.location.origin
      ? window.location.origin
      : "https://alphabette.fr";

  const shareableSelectionUrl = `${baseOrigin}/?playlist_ids=${encodeURIComponent(
    videoIdsParam
  )}&playlist_title=${encodeURIComponent(
    customTitle || selectionTitle
  )}&curator=${encodeURIComponent(curatorName)}`;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    // Generate local SVG & High-DPI DataURL QR Code via standard ISO/IEC 18004 library
    QRCode.toString(shareableSelectionUrl, {
      type: "svg",
      margin: 1,
      width: 220,
      errorCorrectionLevel: "M",
      color: {
        dark: "#070912",
        light: "#ffffff",
      },
    })
      .then((svg) => {
        if (active) setQrSvgMarkup(svg);
      })
      .catch(() => {
        // Fallback if needed
      });

    QRCode.toDataURL(shareableSelectionUrl, {
      margin: 2,
      width: 440,
      errorCorrectionLevel: "M",
      color: {
        dark: "#070912",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        // Fallback
      });

    return () => {
      active = false;
    };
  }, [isOpen, shareableSelectionUrl]);

  if (!isOpen) return null;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(shareableSelectionUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2200);
    onShowToast("Lien direct de la sélection copié dans le presse-papiers !");
  };

  // Render a complete Haute-Couture Graphic Share Card onto an HTML5 Canvas and download as PNG
  const handleDownloadGraphicCardPng = async () => {
    if (!qrDataUrl) return;
    setIsDownloading(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1350;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. Deep Obsidian & Violet Radial Background
      const bgGrad = ctx.createLinearGradient(0, 0, 1080, 1350);
      bgGrad.addColorStop(0, "#070812");
      bgGrad.addColorStop(0.5, "#111428");
      bgGrad.addColorStop(1, "#06070c");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1350);

      // Decorative glow
      const radial = ctx.createRadialGradient(840, 240, 20, 840, 240, 520);
      radial.addColorStop(0, "rgba(124, 92, 255, 0.38)");
      radial.addColorStop(1, "rgba(124, 92, 255, 0)");
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, 1080, 1350);

      // 2. Outer Card Border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 3;
      ctx.strokeRect(48, 48, 984, 1254);

      // 3. Brand Header
      ctx.fillStyle = "#00e5ff";
      ctx.font = "bold 24px sans-serif";
      ctx.fillText(
        `ORBIT · CARTE DE SÉLECTION CERTIFIÉE (${sourcePageLabel.toUpperCase()})`,
        96,
        125
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 46px sans-serif";
      const displayTitle = (customTitle || selectionTitle).slice(0, 42);
      ctx.fillText(displayTitle, 96, 195);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 26px sans-serif";
      ctx.fillText(
        `Curateur : ${curatorName} · ${selectedVideos.length} pépites sélectionnées`,
        96,
        245
      );

      // 4. List of Top Videos in the Selection
      let yPos = 320;
      selectedVideos.slice(0, 5).forEach((v, idx) => {
        ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
        ctx.fillRect(96, yPos - 38, 888, 72);

        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 24px monospace";
        ctx.fillText(`#${idx + 1} · ★ ${v.score.toFixed(1)}`, 118, yPos + 6);

        ctx.fillStyle = "#f8fafc";
        ctx.font = "bold 24px sans-serif";
        const cleanTitle =
          v.title.length > 46 ? v.title.slice(0, 46) + "…" : v.title;
        ctx.fillText(cleanTitle, 290, yPos + 6);

        yPos += 88;
      });

      // 5. Draw White Rounded Container for QR Code
      const qrBoxSize = 360;
      const qrBoxX = (1080 - qrBoxSize) / 2;
      const qrBoxY = 805;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

      const qrImg = new Image();
      qrImg.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => resolve();
        qrImg.onerror = () => reject();
        qrImg.src = qrDataUrl;
      });

      ctx.drawImage(qrImg, qrBoxX + 16, qrBoxY + 16, qrBoxSize - 32, qrBoxSize - 32);

      // 6. Footer Instructions
      ctx.fillStyle = "#00e5ff";
      ctx.font = "bold 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "📱 Scannez avec l'appareil photo pour ouvrir cette sélection dans ORBIT",
        540,
        1225
      );

      ctx.fillStyle = "#94a3b8";
      ctx.font = "500 20px monospace";
      ctx.fillText("alphabette.fr · Écosystème Culturel Souverain", 540, 1265);

      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `orbit_playlist_qr_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      onShowToast("Carte graphique QR Code téléchargée en PNG Haute Définition !");
    } catch {
      onShowToast("Erreur lors du rendu PNG, utilisez le scan direct à l'écran.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-[28px] p-5 sm:p-7 space-y-5 glass-panel my-auto max-h-[94vh] overflow-y-auto"
        style={{ background: "var(--bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--accent), var(--accent-2))",
                boxShadow: "0 0 22px var(--accent-glow)",
              }}
            >
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black font-display">
                Générateur de QR Code Visuel de Playlist
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Carte graphique prête à être scannée par un ami avec son téléphone ou téléchargée en HD.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Personnalisation rapide du titre de la sélection */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <label
            className="text-xs font-bold shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            Titre de la carte :
          </label>
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            className="flex-1 px-3.5 py-2 rounded-xl text-xs font-bold outline-none"
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border)",
              color: "var(--text-main)",
            }}
          />
        </div>

        {/* ==========================================================
            CARTE GRAPHIQUE HAUTE COUTURE PRÊTE À SCANNER / TÉLÉCHARGER
            ========================================================== */}
        <div
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 grid grid-cols-1 md:grid-cols-[1fr_240px] gap-6 items-center"
          style={{
            background:
              "radial-gradient(circle at 85% 20%, rgba(124, 92, 255, 0.28), rgba(7, 9, 18, 0.96) 72%)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            boxShadow: "0 28px 70px -15px rgba(0, 0, 0, 0.9)",
          }}
        >
          {/* Left Column: Selection Metadata & Tracklist */}
          <div className="space-y-4 min-w-0">
            <div className="space-y-1">
              <div className="text-[10px] font-mono-num uppercase tracking-[0.18em] text-cyan-300 font-bold">
                ORBIT · CAPSULE QR INTERACTIVE · {sourcePageLabel}
              </div>
              <h4 className="text-xl sm:text-2xl font-black text-white font-display leading-tight">
                {customTitle || selectionTitle}
              </h4>
              <p className="text-xs text-white/70">
                {selectionSubtitle} · Sélectionnée par{" "}
                <strong className="text-white">@{curatorName}</strong>
              </p>
            </div>

            {/* Pépites incluses dans le QR Code */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-white/75 uppercase tracking-wider">
                {selectedVideos.length} Pépites encodées dans ce QR Code :
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {selectedVideos.map((vid, idx) => (
                  <div
                    key={vid.id}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono-num font-black text-cyan-300 text-[11px] shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-bold text-white truncate">
                        {vid.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 text-[11px] font-mono-num text-amber-300 font-bold">
                      <Star className="w-3 h-3 fill-current" />
                      <span>{vid.score.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[11px] text-white/60 flex items-center gap-2 pt-1">
              <Smartphone className="w-4 h-4 text-cyan-300 shrink-0" />
              <span>
                En scannant ce code, votre ami ouvre directement ORBIT filtré sur ces{" "}
                {selectedVideos.length} vidéos exactes.
              </span>
            </div>
          </div>

          {/* Right Column: Real Dynamic SVG QR Code */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div
              className="p-3.5 rounded-3xl bg-white shadow-2xl flex items-center justify-center"
              style={{
                boxShadow: "0 0 40px rgba(0, 229, 255, 0.25)",
              }}
            >
              {qrSvgMarkup ? (
                <div
                  className="w-[196px] h-[196px] [&>svg]:w-full [&>svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
                />
              ) : (
                <div className="w-[196px] h-[196px] flex items-center justify-center text-xs text-slate-600 font-bold">
                  Génération QR...
                </div>
              )}
            </div>
            <div className="text-center">
              <div className="text-xs font-extrabold text-white">
                SCANNER AVEC L&apos;APPAREIL PHOTO
              </div>
              <div className="text-[10px] font-mono-num text-cyan-300">
                ISO/IEC 18004 · 100% Vectoriel
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions: Download PNG Card, Copy Direct Link, or Test Scan */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => {
              onSimulateScanSelection(
                selectedVideos,
                customTitle || selectionTitle
              );
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-400/35 hover:bg-emerald-500/25 cursor-pointer inline-flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simuler le scan d&apos;un ami (Ouvrir la sélection)</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopyUrl}
              className="px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer glass-panel glass-panel-interactive inline-flex items-center gap-1.5"
            >
              {copiedUrl ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Lien copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Copier le lien direct</span>
                </>
              )}
            </button>

            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownloadGraphicCardPng}
              className="px-5 py-2.5 rounded-xl text-xs font-black text-white cursor-pointer btn-couture inline-flex items-center gap-2"
              style={{
                background: "linear-gradient(135deg, var(--accent), #5e35ff)",
              }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isDownloading
                  ? "Génération PNG..."
                  : "Télécharger la Carte HD (.PNG)"}
              </span>
            </button>
          </div>
        </div>

        {/* Raw Encoded URL Preview */}
        <div className="px-3.5 py-2 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between gap-2 text-[11px] font-mono-num text-white/60">
          <span className="truncate">{shareableSelectionUrl}</span>
          <a
            href={shareableSelectionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-300 hover:underline shrink-0 inline-flex items-center gap-1"
          >
            <span>Ouvrir</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};
