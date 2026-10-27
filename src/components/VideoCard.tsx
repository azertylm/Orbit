import React, { useState, useEffect } from "react";
import {
  OrbitVideo,
  LIVE_REACTIONS,
  ReactionType,
  DebateStance,
  VideoComment,
  getVideoEmbedConfig,
  createPlatformCoverSvg,
} from "../data/orbitData";
import {
  Play,
  MessageSquare,
  Repeat2,
  ExternalLink,
  Star,
  Sparkles,
  Headphones,
  Film,
  Radio,
  Globe,
  Loader2,
  Zap,
  Clock,
  Check,
  ShieldCheck,
  MapPin,
  Scale,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Eye,
  Trash2,
} from "lucide-react";

interface FloatingParticleInstance {
  id: string;
  emoji: string;
  label: string;
  swayStart: string;
  swayMid: string;
  swayEnd: string;
  duration: string;
}

interface VideoCardProps {
  video: OrbitVideo;
  rankNumber?: number;
  archiveActiveLabel?: string;
  showLocalGeoBadge?: boolean;
  isInWatchLater?: boolean;
  isWatched?: boolean;
  onToggleWatchLater?: (video: OrbitVideo) => void;
  onPlayPip: (video: OrbitVideo) => void;
  onRateVideo: (videoId: number, rating: number) => void;
  onAddComment: (
    videoId: number,
    text: string,
    stance?: DebateStance,
    sourceUrl?: string
  ) => void;
  onTriggerReaction?: (
    videoId: number,
    reactionId: ReactionType,
    timestampSeconds: number
  ) => void;
  onRepost: (video: OrbitVideo, customNote: string) => void;
  onSummarizeVideo?: (video: OrbitVideo) => Promise<void>;
  onTranslateComment?: (
    videoId: number,
    commentIdx: number,
    targetLang: string
  ) => Promise<void>;
  onOpenCinema?: (video: OrbitVideo) => void;
  onPlayAudioMode?: (video: OrbitVideo) => void;
  onAddToJukebox?: (video: OrbitVideo) => void;
  onMarkWatched?: (videoId: number) => void;
  onRemoveUnavailableVideo?: (videoId: number, reason?: string) => void;
}

function formatSecondsToMmSs(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

const DEBATE_PRIORITY_DOMAINS = [
  "Culture & Idées",
  "Sciences & Tech",
  "Dev & Open Source",
];

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  rankNumber,
  archiveActiveLabel,
  showLocalGeoBadge = false,
  isInWatchLater = false,
  isWatched = false,
  onToggleWatchLater,
  onPlayPip,
  onRateVideo,
  onAddComment,
  onTriggerReaction,
  onRepost,
  onSummarizeVideo,
  onTranslateComment,
  onOpenCinema,
  onPlayAudioMode,
  onAddToJukebox,
  onMarkWatched,
  onRemoveUnavailableVideo,
}) => {
  const isPriorityDebateDomain = DEBATE_PRIORITY_DOMAINS.includes(video.domain);

  const [commentsOpen, setCommentsOpen] = useState(false);
  const [structuredDebateMode, setStructuredDebateMode] = useState<boolean>(
    isPriorityDebateDomain
  );
  const [selectedStance, setSelectedStance] = useState<DebateStance>("pour");
  const [sourceUrlInput, setSourceUrlInput] = useState("");

  const [repostOpen, setRepostOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [translatingIdx, setTranslatingIdx] = useState<number | null>(null);
  const [targetLang, setTargetLang] = useState<"fr" | "en" | "es">("fr");
  const [commentText, setCommentText] = useState("");
  const [repostNote, setRepostNote] = useState(
    "Coup de cœur partagé sur mon mur !"
  );
  const [imgError, setImgError] = useState(false);

  // Inline playback & live timestamp tracker for Feature 18 (Floating Reactions)
  // Auto-open inline player for user-shared Facebook videos so they appear immediately integrated on Ma Page
  const isCustomFacebookVideo =
    video.id >= 3000 &&
    (video.platform === "facebook" ||
      (video.rawUrl || "").toLowerCase().includes("facebook.com") ||
      (video.rawUrl || "").toLowerCase().includes("fb.watch") ||
      (video.rawUrl || "").toLowerCase().includes("fb.com"));
  const [inlinePlaying, setInlinePlaying] = useState<boolean>(
    isCustomFacebookVideo
  );
  const [startAtSeconds, setStartAtSeconds] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(42);
  const [floatingParticles, setFloatingParticles] = useState<
    FloatingParticleInstance[]
  >([]);

  useEffect(() => {
    if (!inlinePlaying) return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [inlinePlaying]);

  const handleStartInlinePlay = (seekSec = 0) => {
    setStartAtSeconds(seekSec);
    setElapsedSeconds(seekSec > 0 ? seekSec : 12);
    setInlinePlaying(true);
    if (onMarkWatched) onMarkWatched(video.id);
  };

  // Fonctionnalité 18 : Déclencher une salve de particules flottantes sur le bord droit + enregistrer le timestamp
  const handleReactionClick = (reactionId: ReactionType) => {
    const opt =
      LIVE_REACTIONS.find((r) => r.id === reactionId) || LIVE_REACTIONS[0];
    const currentSec = inlinePlaying
      ? elapsedSeconds
      : Math.min(
          (video.durationMinutes || 10) * 60 - 5,
          elapsedSeconds + Math.floor(Math.random() * 25) + 8
        );
    setElapsedSeconds(currentSec);

    // Spawn 4 staggered CSS particles rising along the right edge of the video
    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newParticles: FloatingParticleInstance[] = [0, 1, 2, 3].map((i) => ({
      id: `${batchId}-${i}`,
      emoji: opt.emoji,
      label: i === 0 ? `${opt.label} · ${formatSecondsToMmSs(currentSec)}` : "",
      swayStart: `${(i % 2 === 0 ? -1 : 1) * (8 + i * 5)}px`,
      swayMid: `${(i % 2 === 0 ? 1 : -1) * (10 + i * 4)}px`,
      swayEnd: `${(i % 2 === 0 ? -1 : 1) * (6 + i * 6)}px`,
      duration: `${1.35 + i * 0.18}s`,
    }));

    setFloatingParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setFloatingParticles((prev) =>
        prev.filter((p) => !p.id.startsWith(batchId))
      );
    }, 2100);

    if (onTriggerReaction) {
      onTriggerReaction(video.id, reactionId, currentSec);
    }
    if (onMarkWatched) {
      onMarkWatched(video.id);
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(
      video.id,
      commentText.trim(),
      structuredDebateMode ? selectedStance : "pour",
      sourceUrlInput.trim() || undefined
    );
    setCommentText("");
    setSourceUrlInput("");
  };

  const handleRepostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRepost(video, repostNote.trim());
    setRepostOpen(false);
  };

  const handleTriggerSummary = async () => {
    setSummaryOpen(!summaryOpen);
    if (!video.aiSummary && onSummarizeVideo && !isSummarizing) {
      setIsSummarizing(true);
      await onSummarizeVideo(video);
      setIsSummarizing(false);
    }
  };

  const handleTriggerTranslate = async (idx: number) => {
    if (!onTranslateComment) return;
    setTranslatingIdx(idx);
    await onTranslateComment(video.id, idx, targetLang);
    setTranslatingIdx(null);
  };

  // Group comments into 3 visual columns for Feature 19 (Structured Debate)
  const categorizedComments = React.useMemo(() => {
    const pour: { comment: VideoComment; originalIdx: number }[] = [];
    const nuance: { comment: VideoComment; originalIdx: number }[] = [];
    const source: { comment: VideoComment; originalIdx: number }[] = [];

    video.commentsList.forEach((c, idx) => {
      const stance =
        c.stance ||
        (c.text.toLowerCase().includes("http") ||
        c.text.toLowerCase().includes("benchmark") ||
        c.text.toLowerCase().includes("source")
          ? "source"
          : c.text.toLowerCase().includes("nuance") ||
            c.text.toLowerCase().includes("attention") ||
            c.text.toLowerCase().includes("limite")
          ? "nuance"
          : "pour");

      if (stance === "nuance") nuance.push({ comment: c, originalIdx: idx });
      else if (stance === "source")
        source.push({ comment: c, originalIdx: idx });
      else pour.push({ comment: c, originalIdx: idx });
    });

    return { pour, nuance, source };
  }, [video.commentsList]);

  const ratioClass =
    video.ratio === "9-16" ? "aspect-[9/12] max-h-[340px]" : "aspect-video";

  return (
    <article
      className="glass-panel glass-panel-interactive flex flex-col overflow-hidden"
      style={{
        borderRadius: "var(--radius-xl)",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0"
            style={{
              background:
                "linear-gradient(135deg, var(--accent), var(--accent-2))",
              boxShadow: "0 0 14px var(--accent-glow)",
            }}
          >
            {video.user.substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold truncate flex items-center gap-1.5">
              <span>{video.user}</span>
              {video.isFriend && (
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--success)" }}
                >
                  · Ami
                </span>
              )}
              {video.isScout && (
                <span
                  className="text-[11px] font-semibold inline-flex items-center gap-0.5"
                  style={{ color: "var(--accent-2)" }}
                  title="Découvreur précoce de cette pépite"
                >
                  · <Zap className="w-3 h-3 inline fill-current" /> Éclaireur #
                  {video.scoutRank || 1}
                </span>
              )}
              {/* Fonctionnalité 17 : Indicateur 'Déjà vu' */}
              {isWatched && (
                <span
                  className="text-[10px] font-semibold text-emerald-400 inline-flex items-center gap-0.5"
                  title="Enregistrée dans vos vidéos déjà vues (watchedVideoIds)"
                >
                  · <Eye className="w-3 h-3 inline" /> Déjà vu
                </span>
              )}
            </div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Il y a <span className="font-mono-num">{video.hoursAgo}</span>h ·{" "}
              <span
                className={`uppercase font-semibold ${
                  video.platform === "facebook" ||
                  (video.rawUrl || "").toLowerCase().includes("facebook.com") ||
                  (video.rawUrl || "").toLowerCase().includes("fb.watch")
                    ? "text-blue-400"
                    : ""
                }`}
              >
                {video.platform === "facebook" ||
                (video.rawUrl || "").toLowerCase().includes("facebook.com") ||
                (video.rawUrl || "").toLowerCase().includes("fb.watch")
                  ? "FACEBOOK"
                  : video.platform}
              </span>
              {video.durationMinutes && (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-mono-num">
                    {video.durationMinutes} min
                  </span>
                </>
              )}
              {video.importedVia && (
                <span className="text-cyan-300 font-semibold">
                  {" "}
                  · via {video.importedVia.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 text-xs font-extrabold font-mono-num"
            style={{ color: "#ffd700" }}
          >
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>{video.score.toFixed(1)}/10</span>
          </div>
          {onRemoveUnavailableVideo && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveUnavailableVideo(
                  video.id,
                  "Post supprimé (vidéo signalée indisponible)"
                );
              }}
              className="p-1.5 rounded-lg text-white/45 hover:text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer"
              title="Supprimer ce post / vidéo indisponible"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Media Thumbnail / Inline Video Player + Floating CSS Particles */}
      <div
        className={`relative w-full bg-black overflow-hidden group ${ratioClass}`}
      >
        {(() => {
          const embedConfig = getVideoEmbedConfig(video);
          const resolvedThumb =
            embedConfig.isFacebook &&
            (!video.thumb || video.thumb.includes("aircAruvnKk"))
              ? createPlatformCoverSvg("facebook", video.title, video.rawUrl)
              : video.thumb;
          const iframeSrc =
            !embedConfig.isFacebook &&
            embedConfig.detectedPlatform === "youtube"
              ? `${embedConfig.embedUrl}&enablejsapi=1${
                  startAtSeconds > 0 ? `&start=${startAtSeconds}` : ""
                }`
              : embedConfig.embedUrl;

          return inlinePlaying ? (
            <div className="relative w-full h-full bg-black">
              <iframe
                key={`${video.id}-${startAtSeconds}-${embedConfig.detectedPlatform}`}
                width="100%"
                height="100%"
                src={iframeSrc}
                title={video.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                onError={() => {
                  if (onRemoveUnavailableVideo) {
                    onRemoveUnavailableVideo(
                      video.id,
                      "Lecteur vidéo impossible à charger"
                    );
                  }
                }}
                className="w-full h-full"
              />
              <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 flex-wrap">
                <a
                  href={
                    video.rawUrl && video.rawUrl.startsWith("http")
                      ? video.rawUrl
                      : `https://www.youtube.com/watch?v=${video.youtubeId}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-full bg-black/85 hover:bg-black/95 border border-white/25 text-[10px] font-bold text-cyan-300 inline-flex items-center gap-1 backdrop-blur-md transition-all"
                  title="Ouvrir directement sur la plateforme d'origine"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{embedConfig.externalActionLabel}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setInlinePlaying(false)}
                  className="px-2 py-1 rounded-full bg-black/85 hover:bg-black/95 border border-white/25 text-[10px] font-bold text-white/90 cursor-pointer backdrop-blur-md"
                  title="Revenir à l'aperçu vignette"
                >
                  Vignette
                </button>
                {onRemoveUnavailableVideo && (
                  <button
                    type="button"
                    onClick={() =>
                      onRemoveUnavailableVideo(
                        video.id,
                        "Vidéo indisponible supprimée"
                      )
                    }
                    className="px-2 py-1 rounded-full bg-rose-950/90 hover:bg-rose-900 border border-rose-400/40 text-[10px] font-bold text-rose-200 inline-flex items-center gap-1 cursor-pointer backdrop-blur-md"
                    title="Supprimer immédiatement ce post si la vidéo est indisponible"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Indisponible ? Supprimer</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              className="w-full h-full cursor-pointer"
              onClick={() => handleStartInlinePlay(0)}
            >
              {!imgError ? (
                <img
                  src={resolvedThumb}
                  alt={video.title}
                  referrerPolicy="no-referrer"
                  loading="lazy"
                  onLoad={(e) => {
                    // YouTube renvoie une image grise de 120x90 quand la vidéo est supprimée ou introuvable
                    if (
                      resolvedThumb.includes("i.ytimg.com") &&
                      e.currentTarget.naturalWidth === 120 &&
                      onRemoveUnavailableVideo
                    ) {
                      onRemoveUnavailableVideo(
                        video.id,
                        "Vidéo YouTube supprimée ou introuvable"
                      );
                    }
                  }}
                  onError={() => {
                    setImgError(true);
                    if (
                      resolvedThumb.includes("i.ytimg.com") &&
                      onRemoveUnavailableVideo
                    ) {
                      onRemoveUnavailableVideo(
                        video.id,
                        "Miniature vidéo inaccessible (vidéo indisponible)"
                      );
                    }
                  }}
                  className="w-full h-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div
                  className="w-full h-full flex flex-col items-center justify-center p-6 text-center"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 20%, var(--accent-glow), #090b12 85%)",
                  }}
                >
                  <span className="text-xs font-semibold opacity-75">
                    {video.domain}
                  </span>
                  <span className="text-sm font-bold mt-1 line-clamp-2 font-display">
                    {video.title}
                  </span>
                </div>
              )}

              <div className="absolute inset-0 orbit-video-scrim flex items-center justify-center">
                <div className="w-13 h-13 rounded-full glass-action-btn flex items-center justify-center text-white">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
              </div>
            </div>
          );
        })()}

        {/* Fonctionnalité 18 : Conteneur des Particules Flottantes en Direct sur le bord droit */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-36 overflow-hidden z-30">
          {floatingParticles.map((p) => (
            <div
              key={p.id}
              className="orbit-floating-particle flex items-center gap-1.5"
              style={
                {
                  "--sway-start": p.swayStart,
                  "--sway-mid": p.swayMid,
                  "--sway-end": p.swayEnd,
                  "--duration": p.duration,
                } as React.CSSProperties
              }
            >
              <span className="text-2xl">{p.emoji}</span>
              {p.label && (
                <span className="px-2 py-0.5 rounded-full bg-black/90 border border-white/25 text-[10px] font-mono-num font-extrabold text-amber-300 whitespace-nowrap orbit-video-text-shadow">
                  {p.label}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Idée 11 : Badge Visuel 'Archive Certifiée' (Panthéon Historique) */}
        {(archiveActiveLabel || video.certifiedArchive) &&
          archiveActiveLabel &&
          !inlinePlaying && (
            <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
              <div
                className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1 text-amber-200 orbit-video-text-shadow"
                style={{
                  background: "rgba(15, 11, 4, 0.94)",
                  border: "1px solid rgba(251, 191, 36, 0.65)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.75)",
                }}
              >
                <ShieldCheck className="w-3 h-3 text-amber-400 shrink-0" />
                <span>Archive Certifiée · {archiveActiveLabel}</span>
              </div>
            </div>
          )}

        {/* Idée 13 : Badge Radar Géolocalisé Privé */}
        {showLocalGeoBadge &&
          video.localGeo &&
          !archiveActiveLabel &&
          !inlinePlaying && (
            <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
              <div
                className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold inline-flex items-center gap-1 text-emerald-200 orbit-video-text-shadow"
                style={{
                  background: "rgba(4, 18, 14, 0.94)",
                  border: "1px solid rgba(16, 185, 129, 0.6)",
                }}
              >
                <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="truncate max-w-[175px]">
                  {video.localGeo.areaBadge}
                </span>
              </div>
            </div>
          )}

        {/* Top-Right Quick Action Icons (Mode Cinéma + Mode Audio + Jukebox + Mini-Player PiP) */}
        <div
          className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onPlayPip(video);
              if (onMarkWatched) onMarkWatched(video.id);
            }}
            className="px-2 py-1 rounded-xl glass-action-btn text-[10px] font-bold text-white cursor-pointer orbit-video-text-shadow"
            title="Ouvrir dans le mini-lecteur Picture-in-Picture"
          >
            PiP
          </button>
          {onOpenCinema && (
            <button
              type="button"
              onClick={() => {
                onOpenCinema(video);
                if (onMarkWatched) onMarkWatched(video.id);
              }}
              className="w-8 h-8 rounded-xl glass-action-btn flex items-center justify-center text-white cursor-pointer"
              title="Mode Cinéma Plein Écran (Assombrir l'interface)"
            >
              <Film className="w-3.5 h-3.5 text-amber-300" />
            </button>
          )}
          {onPlayAudioMode && (
            <button
              type="button"
              onClick={() => {
                onPlayAudioMode(video);
                if (onMarkWatched) onMarkWatched(video.id);
              }}
              className="w-8 h-8 rounded-xl glass-action-btn flex items-center justify-center text-white cursor-pointer"
              title="Écouter en Mode Audio / Podcast en arrière-plan"
            >
              <Headphones className="w-3.5 h-3.5 text-cyan-300" />
            </button>
          )}
          {onAddToJukebox && (
            <button
              type="button"
              onClick={() => onAddToJukebox(video)}
              className="w-8 h-8 rounded-xl glass-action-btn flex items-center justify-center text-white cursor-pointer"
              title="Ajouter au Jukebox Collaboratif des Amis"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-300" />
            </button>
          )}
        </div>

        {!inlinePlaying && (
          <div className="absolute bottom-0 inset-x-0 pt-8 pb-2.5 px-3.5 orbit-video-scrim flex items-center justify-between text-[11px] text-white font-bold pointer-events-none orbit-video-text-shadow">
            <span className="truncate">
              {video.domain} · {video.subdomain}
              {video.challengeTag ? ` · ${video.challengeTag}` : ""}
            </span>
            {rankNumber && (
              <span className="px-2 py-0.5 rounded-md bg-black/80 border border-amber-400/50 font-mono-num font-black text-amber-300 shrink-0 ml-2">
                Rang #{rankNumber}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ==========================================================
          FONCTIONNALITÉ 18 : BARRE DE RÉACTIONS ÉPHÉMÈRES EN DIRECT
          + TIMESTAMPS DES MOMENTS FORTS
          ========================================================== */}
      <div
        className="px-3.5 py-2.5 space-y-2"
        style={{
          background: "rgba(255, 255, 255, 0.02)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
          {LIVE_REACTIONS.map((rx) => {
            const count = video.reactionCounts?.[rx.id] || 0;
            return (
              <button
                key={rx.id}
                type="button"
                onClick={() => handleReactionClick(rx.id)}
                className="px-2 py-1 rounded-xl text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 shrink-0"
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
                title={`Réagir en direct : ${rx.emoji} ${rx.label} (enregistre le timestamp du moment fort)`}
              >
                <span>{rx.emoji}</span>
                <span>{rx.label}</span>
                {count > 0 && (
                  <span
                    className="font-mono-num text-[10px] opacity-80"
                    style={{ color: rx.accent }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Liste cliquable des timestamps de moments forts enregistrés */}
        {video.highlightMoments && video.highlightMoments.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[10px]">
            <span
              className="font-bold shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              Moments forts :
            </span>
            {video.highlightMoments.slice(0, 5).map((hm) => (
              <button
                key={hm.id}
                type="button"
                onClick={() => handleStartInlinePlay(hm.timestampSeconds)}
                className="px-2 py-0.5 rounded-md font-mono-num font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-400/25 hover:bg-cyan-500/20 cursor-pointer inline-flex items-center gap-1 shrink-0 transition-colors"
                title={`Aller au moment fort ${hm.label} à ${hm.timestampFormatted}`}
              >
                <span>{hm.emoji}</span>
                <span>{hm.timestampFormatted}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3.5">
        <div>
          <h4 className="text-[15px] font-bold leading-snug font-display">
            {video.title}
          </h4>
          <p
            className="text-xs italic mt-2.5 p-3 rounded-xl leading-relaxed"
            style={{
              color: "var(--text-muted)",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
              boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.06)",
            }}
          >
            « {video.comment} »
          </p>
        </div>

        {/* Footer Controls */}
        <div
          className="pt-3 flex flex-col gap-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {/* Idée 14 : Bouton '⏳ Mettre de côté' (Smart Watch Later) */}
          {onToggleWatchLater && (
            <button
              type="button"
              onClick={() => onToggleWatchLater(video)}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-between gap-2 cursor-pointer transition-all active:scale-98"
              style={{
                background: isInWatchLater
                  ? "rgba(0, 230, 118, 0.14)"
                  : "rgba(255, 255, 255, 0.04)",
                border: isInWatchLater
                  ? "1px solid rgba(0, 230, 118, 0.45)"
                  : "1px solid var(--border)",
                color: isInWatchLater ? "var(--success)" : "var(--text-main)",
              }}
            >
              <span className="inline-flex items-center gap-1.5">
                {isInWatchLater ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>✓ Dans « À regarder ce soir »</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>⏳ Mettre de côté (Ce soir)</span>
                  </>
                )}
              </span>
              <span className="font-mono-num text-[11px] opacity-75">
                {video.durationMinutes || 12} min
              </span>
            </button>
          )}

          <div className="flex items-center justify-between gap-3">
            <span
              className="text-[11px] font-bold shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              Noter :
            </span>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={video.score}
              onChange={(e) =>
                onRateVideo(video.id, parseFloat(e.target.value))
              }
              className="orbit-slider flex-1 cursor-pointer"
            />
            <span
              className="text-[11px] font-mono-num shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              {video.votes} v.
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pt-0.5 flex-wrap gap-2">
            {/* Idée 4 : Bouton Résumé IA Gemini */}
            <button
              type="button"
              onClick={handleTriggerSummary}
              className="inline-flex items-center gap-1 font-bold cursor-pointer transition-all hover:opacity-100 opacity-90 active:scale-95 whitespace-nowrap shrink-0"
              style={{ color: "var(--accent-2)" }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Résumé IA</span>
            </button>

            {/* Bouton Avis & Débat Structuré (Idée 19) */}
            <button
              type="button"
              onClick={() => {
                setCommentsOpen(!commentsOpen);
                setRepostOpen(false);
              }}
              className="inline-flex items-center gap-1.5 font-semibold cursor-pointer transition-all hover:opacity-100 opacity-85 active:scale-95 whitespace-nowrap shrink-0"
              style={{
                color: commentsOpen ? "var(--accent-2)" : "var(--text-muted)",
              }}
            >
              {isPriorityDebateDomain ? (
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5" />
              )}
              <span>
                {isPriorityDebateDomain ? "Débat" : "Avis"} (
                {video.commentsList.length})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRepostOpen(!repostOpen);
                setCommentsOpen(false);
              }}
              className="inline-flex items-center gap-1.5 font-semibold cursor-pointer transition-all hover:opacity-100 opacity-80 active:scale-95 whitespace-nowrap shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              <Repeat2 className="w-3.5 h-3.5" />
              <span>Partager</span>
            </button>

            <a
              href={video.rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold transition-all hover:opacity-100 opacity-80 whitespace-nowrap shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              <span>Source</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Idée 4 : AI Summary Drawer */}
          {summaryOpen && (
            <div
              className="mt-1 p-3 rounded-xl text-xs space-y-2"
              style={{
                background: "rgba(0, 229, 255, 0.06)",
                border: "1px solid rgba(0, 229, 255, 0.24)",
              }}
            >
              <div
                className="flex items-center justify-between font-bold"
                style={{ color: "var(--accent-2)" }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Synthèse IA Gemini</span>
                </span>
                {video.aiSummary && (
                  <span className="font-mono-num text-[11px] opacity-85">
                    ~{video.aiSummary.estimatedSavedMinutes} min gagnées
                  </span>
                )}
              </div>

              {isSummarizing ? (
                <div
                  className="flex items-center gap-2 py-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>
                    Génération des 3 points clés via Gemini 3.8 Flash...
                  </span>
                </div>
              ) : video.aiSummary ? (
                <>
                  <ul
                    className="space-y-1 pl-3.5 list-disc"
                    style={{ color: "var(--text-main)" }}
                  >
                    {video.aiSummary.bullets.map((b, i) => (
                      <li key={i} className="leading-relaxed">
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div
                    className="pt-1 text-[11px] italic"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Verdict : {video.aiSummary.verdict}
                  </div>
                </>
              ) : null}
            </div>
          )}

          {/* Repost inline form */}
          {repostOpen && (
            <form
              onSubmit={handleRepostSubmit}
              className="mt-1 pt-2.5 flex flex-col gap-2 text-xs"
              style={{ borderTop: "1px dashed var(--border)" }}
            >
              <label
                className="font-semibold"
                style={{ color: "var(--text-muted)" }}
              >
                Ajouter une note sur votre Page :
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={repostNote}
                  onChange={(e) => setRepostNote(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    color: "var(--text-main)",
                  }}
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg font-bold text-white text-xs cursor-pointer btn-couture whitespace-nowrap shrink-0"
                  style={{ background: "var(--accent)" }}
                >
                  Publier
                </button>
              </div>
            </form>
          )}

          {/* ==========================================================
              COMMENTS DRAWER + FONCTIONNALITÉ 19 : MODULE DE DÉBAT STRUCTURÉ
              (3 COLONNES VISUELLES : POUR / CONTRE & NUANCES / SOURCES)
              ========================================================== */}
          {commentsOpen && (
            <div
              className="mt-1 pt-3 text-xs flex flex-col gap-3"
              style={{ borderTop: "1px dashed var(--border)" }}
            >
              {/* Top Toggle: Mode Débat Structuré (3 Colonnes) vs Vue Standard + LangSelector */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setStructuredDebateMode(!structuredDebateMode)}
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold cursor-pointer inline-flex items-center gap-1.5 transition-all"
                  style={{
                    background: structuredDebateMode
                      ? "linear-gradient(135deg, #059669, #0284c7)"
                      : "var(--bg-input)",
                    border: structuredDebateMode
                      ? "1px solid rgba(16, 185, 129, 0.7)"
                      : "1px solid var(--border)",
                    color: structuredDebateMode
                      ? "#ffffff"
                      : "var(--text-main)",
                  }}
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>
                    {structuredDebateMode
                      ? "✓ Mode Débat Structuré (3 Colonnes)"
                      : "Activer Mode Débat Structuré"}
                  </span>
                </button>

                <div className="flex items-center gap-1">
                  <span
                    className="text-[10px] font-semibold mr-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Traduction :
                  </span>
                  {(["fr", "en", "es"] as const).map((lng) => (
                    <button
                      key={lng}
                      type="button"
                      onClick={() => setTargetLang(lng)}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase cursor-pointer"
                      style={{
                        background:
                          targetLang === lng
                            ? "var(--accent)"
                            : "var(--bg-input)",
                        color:
                          targetLang === lng ? "#ffffff" : "var(--text-main)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {lng}
                    </button>
                  ))}
                </div>
              </div>

              {structuredDebateMode ? (
                /* 3-COLUMN STRUCTURED DEBATE VIEW (VERT / ORANGE / BLEU) */
                <div className="space-y-2.5">
                  {/* Synthèse rapide de la répartition */}
                  <div
                    className="p-2 rounded-xl flex items-center justify-between text-[10px] font-mono-num"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span
                      className="font-extrabold"
                      style={{ color: "var(--success)" }}
                    >
                      🟢 Pour ({categorizedComments.pour.length})
                    </span>
                    <span
                      className="font-extrabold"
                      style={{ color: "var(--warning)" }}
                    >
                      🟠 Nuances ({categorizedComments.nuance.length})
                    </span>
                    <span
                      className="font-extrabold"
                      style={{ color: "var(--accent-2)" }}
                    >
                      🔵 Sources ({categorizedComments.source.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* COLONNE 1 : ARGUMENTS POUR (VERT) */}
                    <div
                      className="p-2.5 rounded-xl flex flex-col gap-2"
                      style={{
                        background: "rgba(16, 185, 129, 0.08)",
                        border: "1px solid rgba(16, 185, 129, 0.45)",
                      }}
                    >
                      <div
                        className="flex items-center gap-1.5 text-[11px] font-extrabold"
                        style={{ color: "var(--success)" }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Arguments Pour</span>
                      </div>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                        {categorizedComments.pour.length > 0 ? (
                          categorizedComments.pour.map(
                            ({ comment: c, originalIdx }) => (
                              <div
                                key={originalIdx}
                                className="p-2 rounded-lg space-y-1 text-[11px]"
                                style={{
                                  background: "var(--bg-card)",
                                  border: "1px solid rgba(16, 185, 129, 0.35)",
                                }}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <strong
                                    className="truncate"
                                    style={{ color: "var(--success)" }}
                                  >
                                    @{c.author}
                                  </strong>
                                  {onTranslateComment && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleTriggerTranslate(originalIdx)
                                      }
                                      className="text-[9px] cursor-pointer opacity-80 hover:opacity-100"
                                      style={{ color: "var(--accent-2)" }}
                                      title="Traduire"
                                    >
                                      {translatingIdx === originalIdx
                                        ? "..."
                                        : "🌐"}
                                    </button>
                                  )}
                                </div>
                                <p
                                  className="leading-snug"
                                  style={{ color: "var(--text-main)" }}
                                >
                                  {c.text}
                                </p>
                                {c.translatedText && (
                                  <div
                                    className="text-[10px] pt-1 border-t"
                                    style={{
                                      color: "var(--accent-2)",
                                      borderColor: "var(--border)",
                                    }}
                                  >
                                    🌐 {c.translatedText}
                                  </div>
                                )}
                              </div>
                            )
                          )
                        ) : (
                          <div
                            className="text-[10px] italic"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Aucun argument Pour.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* COLONNE 2 : ARGUMENTS CONTRE / NUANCES (ORANGE) */}
                    <div
                      className="p-2.5 rounded-xl flex flex-col gap-2"
                      style={{
                        background: "rgba(245, 158, 11, 0.08)",
                        border: "1px solid rgba(245, 158, 11, 0.45)",
                      }}
                    >
                      <div
                        className="flex items-center gap-1.5 text-[11px] font-extrabold"
                        style={{ color: "var(--warning)" }}
                      >
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Contre & Nuances</span>
                      </div>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                        {categorizedComments.nuance.length > 0 ? (
                          categorizedComments.nuance.map(
                            ({ comment: c, originalIdx }) => (
                              <div
                                key={originalIdx}
                                className="p-2 rounded-lg space-y-1 text-[11px]"
                                style={{
                                  background: "var(--bg-card)",
                                  border: "1px solid rgba(245, 158, 11, 0.35)",
                                }}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <strong
                                    className="truncate"
                                    style={{ color: "var(--warning)" }}
                                  >
                                    @{c.author}
                                  </strong>
                                  {onTranslateComment && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleTriggerTranslate(originalIdx)
                                      }
                                      className="text-[9px] cursor-pointer opacity-80 hover:opacity-100"
                                      style={{ color: "var(--accent-2)" }}
                                    >
                                      {translatingIdx === originalIdx
                                        ? "..."
                                        : "🌐"}
                                    </button>
                                  )}
                                </div>
                                <p
                                  className="leading-snug"
                                  style={{ color: "var(--text-main)" }}
                                >
                                  {c.text}
                                </p>
                                {c.translatedText && (
                                  <div
                                    className="text-[10px] pt-1 border-t"
                                    style={{
                                      color: "var(--accent-2)",
                                      borderColor: "var(--border)",
                                    }}
                                  >
                                    🌐 {c.translatedText}
                                  </div>
                                )}
                              </div>
                            )
                          )
                        ) : (
                          <div
                            className="text-[10px] italic"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Aucune nuance déposée.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* COLONNE 3 : SOURCES & VÉRIFICATIONS (BLEU) */}
                    <div
                      className="p-2.5 rounded-xl flex flex-col gap-2"
                      style={{
                        background: "rgba(0, 229, 255, 0.08)",
                        border: "1px solid rgba(0, 229, 255, 0.45)",
                      }}
                    >
                      <div
                        className="flex items-center gap-1.5 text-[11px] font-extrabold"
                        style={{ color: "var(--accent-2)" }}
                      >
                        <BookOpen className="w-3.5 h-3.5 shrink-0" />
                        <span>Sources & Vérif.</span>
                      </div>
                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                        {categorizedComments.source.length > 0 ? (
                          categorizedComments.source.map(
                            ({ comment: c, originalIdx }) => (
                              <div
                                key={originalIdx}
                                className="p-2 rounded-lg space-y-1 text-[11px]"
                                style={{
                                  background: "var(--bg-card)",
                                  border: "1px solid rgba(0, 229, 255, 0.35)",
                                }}
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <strong
                                    className="truncate"
                                    style={{ color: "var(--accent-2)" }}
                                  >
                                    @{c.author}
                                  </strong>
                                  {c.verifiedLabel && (
                                    <span
                                      className="text-[9px] font-mono-num"
                                      style={{ color: "var(--accent-2)" }}
                                    >
                                      ✓
                                    </span>
                                  )}
                                </div>
                                <p
                                  className="leading-snug"
                                  style={{ color: "var(--text-main)" }}
                                >
                                  {c.text}
                                </p>
                                {c.sourceUrl && (
                                  <a
                                    href={c.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold hover:underline pt-0.5"
                                    style={{ color: "var(--accent-2)" }}
                                  >
                                    <span>Source vérifiable</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            )
                          )
                        ) : (
                          <div
                            className="text-[10px] italic"
                            style={{ color: "var(--text-muted)" }}
                          >
                            Aucune source liée.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* STANDARD CHRONOLOGICAL COMMENTS LIST */
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {video.commentsList.length > 0 ? (
                    video.commentsList.map((c, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg space-y-1"
                        style={{
                          background: "var(--bg-input)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong className="font-bold">@{c.author}</strong>
                          {onTranslateComment && (
                            <button
                              type="button"
                              onClick={() => handleTriggerTranslate(idx)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold cursor-pointer opacity-85 hover:opacity-100"
                              style={{ color: "var(--accent-2)" }}
                            >
                              {translatingIdx === idx ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Globe className="w-3 h-3" />
                              )}
                              <span>Traduire ({targetLang.toUpperCase()})</span>
                            </button>
                          )}
                        </div>
                        <div style={{ color: "var(--text-muted)" }}>
                          {c.text}
                        </div>
                        {c.translatedText && (
                          <div
                            className="text-[11px] pt-1 font-medium"
                            style={{
                              color: "var(--accent-2)",
                              borderTop: "1px dotted var(--border)",
                            }}
                          >
                            🌐 {c.translatedText}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{ color: "var(--text-muted)" }}>
                      Aucun commentaire pour le moment.
                    </div>
                  )}
                </div>
              )}

              {/* Formulaire d'ajout d'argument ou commentaire */}
              <form
                onSubmit={handleCommentSubmit}
                className="space-y-2 pt-1"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                {structuredDebateMode && (
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      {
                        id: "pour" as DebateStance,
                        label: "🟢 Pour",
                        color: "#059669",
                        border: "#10b981",
                      },
                      {
                        id: "nuance" as DebateStance,
                        label: "🟠 Nuance",
                        color: "#d97706",
                        border: "#f59e0b",
                      },
                      {
                        id: "source" as DebateStance,
                        label: "🔵 Source",
                        color: "#0284c7",
                        border: "#00e5ff",
                      },
                    ].map((st) => {
                      const active = selectedStance === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setSelectedStance(st.id)}
                          className="py-1 px-2 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all"
                          style={{
                            background: active ? st.color : "var(--bg-input)",
                            border: `1px solid ${
                              active ? st.border : "var(--border)"
                            }`,
                            color: active ? "#ffffff" : "var(--text-main)",
                          }}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {structuredDebateMode && selectedStance === "source" && (
                  <input
                    type="text"
                    value={sourceUrlInput}
                    onChange={(e) => setSourceUrlInput(e.target.value)}
                    placeholder="Lien de la source ou étude vérifiable (https://...)"
                    className="w-full px-2.5 py-1.5 rounded-lg text-[11px] outline-none"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid rgba(0, 229, 255, 0.35)",
                      color: "var(--text-main)",
                    }}
                  />
                )}

                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={
                      structuredDebateMode
                        ? selectedStance === "pour"
                          ? "Ajouter un argument Pour (Vert)..."
                          : selectedStance === "nuance"
                          ? "Apporter une nuance ou limite (Orange)..."
                          : "Citer une source ou vérification (Bleu)..."
                        : "Ajouter un commentaire..."
                    }
                    className="flex-1 px-2.5 py-1.5 rounded-lg text-xs outline-none"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      color: "var(--text-main)",
                    }}
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg font-bold text-white text-xs cursor-pointer btn-couture whitespace-nowrap shrink-0"
                    style={{ background: "var(--accent)" }}
                  >
                    Publier
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
