import React, { useState } from "react";
import {
  CreatorPortfolioItem,
  CreatorExternalLink,
  PortfolioCategory,
  OrbitProfile,
  getVideoEmbedConfig,
  createPlatformCoverSvg,
} from "../data/orbitData";
import {
  Sparkles,
  ExternalLink,
  Mail,
  Play,
  Maximize2,
  Plus,
  QrCode,
  Check,
  Copy,
  X,
  Camera,
  Film,
  Music,
  Cpu,
  Award,
  Send,
  Smartphone,
} from "lucide-react";

interface CreatorPortfolioViewProps {
  profile: OrbitProfile;
  items: CreatorPortfolioItem[];
  links: CreatorExternalLink[];
  onAddPortfolioItem: (item: CreatorPortfolioItem) => void;
  onOpenQrGenerator: () => void;
  onExitPortfolioMode: () => void;
  onOpenImmersionReels?: () => void;
  onShowToast: (msg: string) => void;
}

export const CreatorPortfolioView: React.FC<CreatorPortfolioViewProps> = ({
  profile,
  items,
  links,
  onAddPortfolioItem,
  onOpenQrGenerator,
  onExitPortfolioMode,
  onOpenImmersionReels,
  onShowToast,
}) => {
  const [selectedCategory, setSelectedCategory] =
    useState<PortfolioCategory>("all");
  const [lightboxItem, setLightboxItem] =
    useState<CreatorPortfolioItem | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [addCreationOpen, setAddCreationOpen] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  // Contact Pro form state
  const [contactName, setContactName] = useState("");
  const [contactOrg, setContactOrg] = useState("");
  const [contactType, setContactType] = useState(
    "Commande Light Painting / Scénographie"
  );
  const [contactMessage, setContactMessage] = useState("");

  // New Creation form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] =
    useState<Exclude<PortfolioCategory, "all">>("light-painting");
  const [newSpecs, setNewSpecs] = useState(
    "Pose longue 20s · f/8 · ISO 100 · Sans CGI"
  );
  const [newDesc, setNewDesc] = useState("");
  const [newYoutubeUrl, setNewYoutubeUrl] = useState("");
  const [newDimensions, setNewDimensions] = useState(
    "Master 4K Ultra HD · Édition Originale"
  );

  const filteredItems = items.filter((it) =>
    selectedCategory === "all" ? true : it.category === selectedCategory
  );

  const contactEmail = profile.contactEmail || "contact@alphabette.fr";

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(contactEmail);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2200);
    onShowToast(`Adresse pro copiée : ${contactEmail}`);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactMessage.trim()) {
      onShowToast("Veuillez renseigner votre nom et votre message.");
      return;
    }
    setContactOpen(false);
    setContactName("");
    setContactOrg("");
    setContactMessage("");
    onShowToast(
      `✉️ Proposition professionnelle transmise à ${profile.name} (${contactType}) !`
    );
  };

  const handleCreatePortfolioItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      onShowToast("Veuillez donner un titre à votre création.");
      return;
    }

    const rawUrl = newYoutubeUrl.trim();
    const isFb =
      rawUrl.toLowerCase().includes("facebook.com") ||
      rawUrl.toLowerCase().includes("fb.watch");
    let ytId = "EmKQsSDlaa4";
    const match = rawUrl.match(
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i
    );
    if (match && match[1]) {
      ytId = match[1];
    }

    const mediumMap: Record<Exclude<PortfolioCategory, "all">, string> = {
      "light-painting": "Light Painting & Optique",
      video: "Réalisation Vidéo & Montage",
      music: "Composition Musicale & Synthés",
      "tech-art": "Architecture Logicielle & Art Numérique",
    };

    const created: CreatorPortfolioItem = {
      id: `pf-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      mediumLabel: isFb
        ? `${mediumMap[newCategory]} · Facebook Watch`
        : mediumMap[newCategory],
      specs: newSpecs.trim() || "Création Originale Haute Définition",
      year: new Date().getFullYear().toString(),
      description:
        newDesc.trim() ||
        "Œuvre originale issue du studio créatif, réalisée sans artifice génératif.",
      thumb: isFb
        ? createPlatformCoverSvg("facebook", newTitle.trim(), rawUrl)
        : `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      youtubeId: ytId,
      externalUrl: rawUrl || "https://alphabette.fr",
      dimensionsOrDuration: newDimensions.trim() || "Format Plein Cadre HD",
      featured: true,
    };

    onAddPortfolioItem(created);
    setAddCreationOpen(false);
    setNewTitle("");
    setNewDesc("");
    setNewYoutubeUrl("");
    onShowToast(`🎨 Création « ${created.title} » ajoutée à votre Galerie Pro !`);
  };

  return (
    <div className="space-y-8">
      {/* ==========================================================
          HERO GALERIE D'ART & STUDIO CRÉATEUR (MISE EN PAGE ÉPURÉE)
          ========================================================== */}
      <div
        className="relative overflow-hidden rounded-[28px] p-6 sm:p-10 transition-all"
        style={{
          background:
            "radial-gradient(circle at 85% 15%, rgba(124, 92, 255, 0.22), rgba(8, 10, 16, 0.94) 68%)",
          border: "1px solid rgba(255, 255, 255, 0.16)",
          boxShadow: "0 30px 80px -20px rgba(0, 0, 0, 0.85)",
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-4 max-w-3xl">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[11px] font-mono-num uppercase tracking-[0.2em] text-cyan-300 font-bold">
                GALERIE D&apos;ART & PORTFOLIO PROFESSIONNEL · ÉDITION HAUTE DÉFINITION
              </span>
              <span aria-hidden="true" className="text-white/30">
                ·
              </span>
              <span className="text-xs font-semibold text-emerald-400 inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {profile.availabilityText ||
                  "Disponible pour réalisations, expositions & architectures"}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center font-black text-2xl sm:text-3xl text-white shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent), var(--accent-2))",
                  boxShadow: "0 0 32px var(--accent-glow)",
                }}
              >
                {profile.initials}
              </div>
              <div>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight font-display text-white">
                  {profile.name}
                </h2>
                <p className="text-sm sm:text-base text-white/80 font-medium mt-1">
                  {profile.titleRole ||
                    "Directeur Créatif · Light Painter · Architecte Écosystème Alphabette"}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-white/70 leading-relaxed max-w-2xl">
              {profile.bio} — Galerie plein cadre réunissant mes créations
              originales en photographie nocturne (Light Painting sans retouche),
              réalisation vidéo 4K, composition sonore analogique et ingénierie
              logicielle souveraine.
            </p>

            {/* Liens Externes Certifiés */}
            <div className="pt-2 flex items-center gap-2.5 flex-wrap">
              {links.map((lnk) => (
                <a
                  key={lnk.id}
                  href={lnk.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-white/90 hover:text-white inline-flex items-center gap-2 transition-all hover:-translate-y-0.5"
                  style={{
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                  }}
                >
                  <span className="text-white/60 font-medium">{lnk.label} :</span>
                  <span className="text-cyan-300">{lnk.handle}</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              ))}
            </div>
          </div>

          {/* Boutons d'Action Pro : Contact Pro + QR Code Sélection + Ajouter Œuvre */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="px-5 py-3 rounded-2xl text-xs sm:text-sm font-black text-black bg-white hover:bg-cyan-300 cursor-pointer inline-flex items-center justify-center gap-2 transition-all shadow-xl"
            >
              <Mail className="w-4 h-4" />
              <span>Contact Pro & Commandes</span>
            </button>

            <button
              type="button"
              onClick={onOpenQrGenerator}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold text-cyan-300 cursor-pointer inline-flex items-center justify-center gap-2 glass-panel glass-panel-interactive"
              style={{
                borderColor: "rgba(0, 229, 255, 0.35)",
              }}
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>📱 Générer QR Code de cette sélection</span>
            </button>

            <div className="flex gap-2 flex-wrap">
              {onOpenImmersionReels && (
                <button
                  type="button"
                  onClick={onOpenImmersionReels}
                  className="flex-1 px-3.5 py-2 rounded-xl text-xs font-extrabold text-white cursor-pointer inline-flex items-center justify-center gap-1.5 btn-couture"
                  style={{
                    background: "linear-gradient(135deg, #0284c7, #5e35ff)",
                  }}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>📱 Mode Immersion Reels</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setAddCreationOpen(true)}
                className="flex-1 px-3.5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer inline-flex items-center justify-center gap-1.5"
                style={{
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                }}
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Ajouter une œuvre</span>
              </button>

              <button
                type="button"
                onClick={onExitPortfolioMode}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white/85 hover:text-white cursor-pointer"
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                }}
              >
                Vue Standard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ==========================================================
          BARRE DE FILTRES PAR DISCIPLINE ARTISTIQUE (STYLE GALERIE)
          ========================================================== */}
      <div className="flex items-center justify-between gap-4 flex-wrap pb-2 border-b border-white/10">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {[
            {
              id: "all" as PortfolioCategory,
              label: `Toutes les Œuvres (${items.length})`,
              icon: Sparkles,
            },
            {
              id: "light-painting" as PortfolioCategory,
              label: "Light Painting & Pose Longue",
              icon: Camera,
            },
            {
              id: "video" as PortfolioCategory,
              label: "Réalisations Vidéo 4K",
              icon: Film,
            },
            {
              id: "music" as PortfolioCategory,
              label: "Créations Musicales & Synthés",
              icon: Music,
            },
            {
              id: "tech-art" as PortfolioCategory,
              label: "Projets Visuels & Architecture",
              icon: Cpu,
            },
          ].map((cat) => {
            const Icon = cat.icon;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 transition-all whitespace-nowrap shrink-0"
                style={{
                  background: active
                    ? "linear-gradient(135deg, var(--accent), #5e35ff)"
                    : "rgba(255, 255, 255, 0.04)",
                  color: active ? "#ffffff" : "var(--text-muted)",
                  border: active
                    ? "1px solid rgba(255, 255, 255, 0.28)"
                    : "1px solid var(--border)",
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs font-mono-num text-white/60 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" />
          <span>Exposition Plein Cadre · Cliquez sur une œuvre pour l&apos;ouvrir en HD</span>
        </div>
      </div>

      {/* ==========================================================
          GRILLE PLEIN CADRE HAUTE DÉFINITION (TYPE GALERIE D'ART)
          ========================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
        {filteredItems.map((item, idx) => {
          const isHeroSpan = idx === 0 && selectedCategory === "all";
          return (
            <article
              key={item.id}
              onClick={() => setLightboxItem(item)}
              className={`group relative overflow-hidden rounded-[26px] cursor-pointer flex flex-col justify-between transition-all duration-500 hover:-translate-y-1 ${
                isHeroSpan ? "md:col-span-2" : ""
              }`}
              style={{
                background: "#070910",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                boxShadow: "0 24px 60px -15px rgba(0, 0, 0, 0.85)",
              }}
            >
              {/* Visuel Plein Cadre Haute Définition */}
              <div
                className={`relative w-full overflow-hidden bg-black ${
                  isHeroSpan
                    ? "aspect-[16/8] min-h-[300px]"
                    : "aspect-[16/10] min-h-[250px]"
                }`}
              >
                <img
                  src={item.thumb}
                  alt={item.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 orbit-video-scrim" />

                {/* Top Curator Metadata Kicker */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 text-xs text-white orbit-video-text-shadow">
                  <div className="px-3 py-1 rounded-lg bg-black/85 backdrop-blur-md border border-white/20 font-bold tracking-wide">
                    {item.mediumLabel} · <span className="font-mono-num">{item.year}</span>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-black/80 backdrop-blur-md border border-white/25 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    {item.youtubeId ? (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Bottom Overlay Title & Technical Cartel */}
                <div className="absolute bottom-4 left-5 right-5 space-y-1.5 orbit-video-text-shadow">
                  <div className="text-[11px] font-mono-num text-cyan-300 font-bold">
                    {item.specs}
                  </div>
                  <h3
                    className={`font-black text-white font-display leading-tight ${
                      isHeroSpan ? "text-xl sm:text-3xl" : "text-lg sm:text-xl"
                    }`}
                  >
                    {item.title}
                  </h3>
                </div>
              </div>

              {/* Cartel de Galerie Épuré */}
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#070910]">
                <p className="text-xs sm:text-sm text-white/75 leading-relaxed max-w-3xl">
                  {item.description}
                </p>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono-num text-white/55">
                    {item.dimensionsOrDuration}
                  </span>
                  <span className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-white/10 group-hover:bg-white group-hover:text-black transition-colors inline-flex items-center gap-1.5">
                    <span>Visionner HD</span>
                    <Maximize2 className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* ==========================================================
          VISIONNEUSE LIGHTBOX PLEIN CADRE HD (ŒUVRE OU VIDÉO)
          ========================================================== */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8"
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="w-full max-w-5xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs font-mono-num text-cyan-300 uppercase tracking-wider">
                  {lightboxItem.mediumLabel} · {lightboxItem.year} ·{" "}
                  {lightboxItem.dimensionsOrDuration}
                </div>
                <h3 className="text-lg sm:text-2xl font-black text-white font-display mt-0.5">
                  {lightboxItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                className="px-4 py-2 rounded-xl glass-action-btn text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Fermer la Galerie HD</span>
              </button>
            </div>

            <div className="w-full aspect-video rounded-3xl overflow-hidden bg-black border border-white/15 shadow-2xl">
              {lightboxItem.youtubeId || lightboxItem.externalUrl ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={
                    getVideoEmbedConfig({
                      rawUrl: lightboxItem.externalUrl,
                      youtubeId: lightboxItem.youtubeId,
                    }).embedUrl
                  }
                  title={lightboxItem.title}
                  frameBorder="0"
                  allow="autoplay; encrypted-media; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <img
                  src={lightboxItem.thumb}
                  alt={lightboxItem.title}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-mono-num text-amber-300 font-bold">
                  Fiche Technique : {lightboxItem.specs}
                </div>
                <p className="text-xs sm:text-sm text-white/80">
                  {lightboxItem.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLightboxItem(null);
                  setContactOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-black text-black bg-white hover:bg-cyan-300 cursor-pointer shrink-0 inline-flex items-center gap-2"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Acquérir / Commander un projet similaire</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          MODALE CONTACT PROFESSIONNEL & COMMANDES CRÉATIVES
          ========================================================== */}
      {contactOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setContactOpen(false)}
        >
          <form
            onSubmit={handleContactSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl p-6 space-y-4 glass-panel"
            style={{ background: "var(--bg-surface)" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black font-display">
                  Contact Professionnel · {profile.name}
                </h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Commandes artistiques, réalisations vidéo, Light Painting ou architecture logicielle.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                className="cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-2 text-xs">
              <div>
                <div className="text-[11px] opacity-70">Ligne directe studio :</div>
                <div className="font-mono-num font-bold text-cyan-300">
                  {contactEmail}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyEmail}
                className="px-3 py-1.5 rounded-xl font-bold bg-white/10 hover:bg-white/20 cursor-pointer inline-flex items-center gap-1.5"
              >
                {emailCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier l&apos;email</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Votre nom / Prénom *"
                  className="px-3.5 py-2.5 rounded-xl text-xs outline-none"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    color: "var(--text-main)",
                  }}
                />
                <input
                  type="text"
                  value={contactOrg}
                  onChange={(e) => setContactOrg(e.target.value)}
                  placeholder="Structure / Galerie / Médias"
                  className="px-3.5 py-2.5 rounded-xl text-xs outline-none"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    color: "var(--text-main)",
                  }}
                />
              </div>

              <select
                value={contactType}
                onChange={(e) => setContactType(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              >
                <option value="Commande Light Painting / Scénographie">
                  🎨 Commande Light Painting / Exposition / Tirage FineArt
                </option>
                <option value="Réalisation Vidéo 4K / Court-Métrage">
                  🎬 Réalisation Vidéo 4K / Documentaire / Montage
                </option>
                <option value="Composition Sonore / Sound Design">
                  🎵 Composition Musicale / Synthé Modulaire / Live
                </option>
                <option value="Architecture Logicielle / Écosystème Alphabette">
                  💻 Architecture Logicielle / DevOps Souverain / IA
                </option>
              </select>

              <textarea
                rows={4}
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Décrivez votre projet, vos délais ou votre demande de collaboration..."
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none resize-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer glass-panel"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture inline-flex items-center gap-1.5"
                style={{
                  background: "linear-gradient(135deg, var(--accent), #5e35ff)",
                }}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Envoyer la demande pro</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================================
          MODALE AJOUTER UNE CRÉATION AU PORTFOLIO
          ========================================================== */}
      {addCreationOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setAddCreationOpen(false)}
        >
          <form
            onSubmit={handleCreatePortfolioItem}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl p-6 space-y-4 glass-panel"
            style={{ background: "var(--bg-surface)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black font-display">
                Ajouter une création à mon Portfolio Pro
              </h3>
              <button
                type="button"
                onClick={() => setAddCreationOpen(false)}
                className="cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Titre de l'œuvre ou du projet *"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              />

              <select
                value={newCategory}
                onChange={(e) =>
                  setNewCategory(
                    e.target.value as Exclude<PortfolioCategory, "all">
                  )
                }
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              >
                <option value="light-painting">
                  Light Painting & Pose Longue
                </option>
                <option value="video">
                  Réalisation Vidéo & Montage 4K
                </option>
                <option value="music">
                  Création Musicale & Synthé Modulaire
                </option>
                <option value="tech-art">
                  Projet Visuel, LiDAR 3D & Architecture
                </option>
              </select>

              <input
                type="text"
                value={newSpecs}
                onChange={(e) => setNewSpecs(e.target.value)}
                placeholder="Spécifications techniques (ex: Pose 24s · f/8 · ISO 100)"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              />

              <input
                type="text"
                value={newYoutubeUrl}
                onChange={(e) => setNewYoutubeUrl(e.target.value)}
                placeholder="Lien vidéo YouTube / Référence visuelle (optionnel)"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              />

              <input
                type="text"
                value={newDimensions}
                onChange={(e) => setNewDimensions(e.target.value)}
                placeholder="Format / Durée (ex: 6000x4000px · Tirage FineArt)"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              />

              <textarea
                rows={3}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Note d'intention artistique et démarche..."
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none resize-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddCreationOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer glass-panel"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture"
                style={{
                  background: "linear-gradient(135deg, var(--accent), #5e35ff)",
                }}
              >
                Exposer dans la Galerie
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
