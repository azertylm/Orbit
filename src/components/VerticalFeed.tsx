import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Pause,
  Star,
  Share2,
  Repeat2,
  ExternalLink,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Check,
  Copy,
  X,
  PictureInPicture2,
  Send,
  Headphones,
  Radio,
  Globe,
  Loader2,
  Zap,
  Clock,
  Scale,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Trophy,
  Compass,
  Briefcase,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Compass as CompassIcon,
  LayoutGrid,
  RectangleHorizontal,
  Smartphone,
  SlidersHorizontal,
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

interface VerticalFeedProps {
  videos: OrbitVideo[];
  pageContext?: "p1" | "p2" | "p3" | "p4";
  pageContextLabel?: string;
  enableInfiniteLoop?: boolean;
  showRankingBadges?: boolean;
  cinemaMode?: boolean;
  onToggleCinemaMode?: () => void;
  watchLaterIds?: number[];
  watchedVideoIds?: number[];
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
  onMarkWatched?: (videoId: number) => void;
  onRepost: (video: OrbitVideo, customNote: string) => void;
  onSummarizeVideo?: (video: OrbitVideo) => Promise<void>;
  onTranslateComment?: (
    videoId: number,
    commentIdx: number,
    targetLang: string
  ) => Promise<void>;
  onPlayAudioMode?: (video: OrbitVideo) => void;
  onAddToJukebox?: (video: OrbitVideo) => void;
  onSwitchToGridMode?: () => void;
  /** Synchronized immersive UI visibility with parent App navigation */
  uiVisible?: boolean;
  onUiVisibleChange?: (visible: boolean) => void;
  navOverlayOpen?: boolean;
  onToggleNavOverlay?: () => void;
  onRemoveUnavailableVideo?: (videoId: number, reason?: string) => void;
}

function formatSecondsToMmSs(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export const VerticalFeed: React.FC<VerticalFeedProps> = ({
  videos,
  pageContext = "p1",
  pageContextLabel,
  enableInfiniteLoop = false,
  showRankingBadges = false,
  cinemaMode = false,
  onToggleCinemaMode,
  watchLaterIds = [],
  onToggleWatchLater,
  onPlayPip,
  onRateVideo,
  onAddComment,
  onTriggerReaction,
  onMarkWatched,
  onRepost,
  onSummarizeVideo,
  onTranslateComment,
  onPlayAudioMode,
  onAddToJukebox,
  onSwitchToGridMode,
  uiVisible: controlledUiVisible,
  onUiVisibleChange,
  navOverlayOpen = false,
  onToggleNavOverlay,
  onRemoveUnavailableVideo,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const iframeRefs = useRef<Record<number, HTMLIFrameElement | null>>({});
  const autoHideTimerRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [infiniteCycles, setInfiniteCycles] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Mode Immersion (false = 100% clean video) vs Mode Interaction (true = discreet UI visible)
  const [internalUiVisible, setInternalUiVisible] = useState<boolean>(false);
  const isUiVisible =
    controlledUiVisible !== undefined ? controlledUiVisible : internalUiVisible;

  const setUiVisible = useCallback(
    (nextVal: boolean) => {
      setInternalUiVisible(nextVal);
      if (onUiVisibleChange) {
        onUiVisibleChange(nextVal);
      }
    },
    [onUiVisibleChange]
  );

  // Secondary details expansion (Creator description, reactions, inline vote, categories)
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  // Secondary action rail expansion (AI Summary, Watch Later, Audio, Cinema)
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  // Intelligent fit mode for 16:9 horizontal videos on portrait screens ("cover" = smart full-screen fill, "contain" = full 16:9 video)
  const [horizontalFitMode, setHorizontalFitMode] = useState<"cover" | "contain">(
    "cover"
  );
  // Native browser Fullscreen state
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  // Brief action feedback pill (auto-disappears)
  const [ephemeralFeedback, setEphemeralFeedback] = useState<string | null>(
    null
  );

  // Active drawer / popover states for the currently visible video
  const [activeDrawer, setActiveDrawer] = useState<
    "rate" | "comments" | "share" | "summary" | null
  >(null);
  const [structuredDebateMode, setStructuredDebateMode] = useState(true);
  const [selectedStance, setSelectedStance] = useState<DebateStance>("pour");
  const [sourceUrlInput, setSourceUrlInput] = useState("");

  const [isSummarizing, setIsSummarizing] = useState(false);
  const [translatingIdx, setTranslatingIdx] = useState<number | null>(null);
  const [targetLang, setTargetLang] = useState<"fr" | "en" | "es">("fr");
  const [draftRating, setDraftRating] = useState<number>(9.5);
  const [justRatedId, setJustRatedId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState("");
  const [repostNote, setRepostNote] = useState(
    "Pépite absolue partagée sur mon mur Orbit !"
  );
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  // Feature 18: Live playback timer & floating reaction particles
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(15);
  const [seekStartSec, setSeekStartSec] = useState<number>(0);
  const [floatingParticles, setFloatingParticles] = useState<
    FloatingParticleInstance[]
  >([]);

  const triggerEphemeralFeedback = useCallback((msg: string) => {
    setEphemeralFeedback(msg);
    window.setTimeout(() => {
      setEphemeralFeedback((prev) => (prev === msg ? null : prev));
    }, 1800);
  }, []);

  // Auto-hide controls after 2.8 seconds of inactivity when no drawer/menu is open
  const scheduleAutoHide = useCallback(() => {
    if (autoHideTimerRef.current) {
      window.clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    if (activeDrawer || detailsExpanded || navOverlayOpen) {
      return;
    }
    autoHideTimerRef.current = window.setTimeout(() => {
      setUiVisible(false);
      setMoreActionsOpen(false);
    }, 2800);
  }, [activeDrawer, detailsExpanded, navOverlayOpen, setUiVisible]);

  useEffect(() => {
    if (isUiVisible && !activeDrawer && !detailsExpanded && !navOverlayOpen) {
      scheduleAutoHide();
    } else if (autoHideTimerRef.current) {
      window.clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
    return () => {
      if (autoHideTimerRef.current) {
        window.clearTimeout(autoHideTimerRef.current);
      }
    };
  }, [
    isUiVisible,
    activeDrawer,
    detailsExpanded,
    navOverlayOpen,
    scheduleAutoHide,
  ]);

  // Track native Fullscreen API changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const handleToggleNativeFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const el = document.documentElement as HTMLElement & {
          webkitRequestFullscreen?: () => Promise<void>;
        };
        if (el.requestFullscreen) {
          await el.requestFullscreen({ navigationUI: "hide" });
        } else if (el.webkitRequestFullscreen) {
          await el.webkitRequestFullscreen();
        }
        triggerEphemeralFeedback("Plein écran activé");
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
        triggerEphemeralFeedback("Plein écran quitté");
      }
    } catch {
      triggerEphemeralFeedback("Mode immersif actif");
    }
  };

  // Send command to active YouTube iframe without reloading the player
  const sendYouTubeCommand = useCallback(
    (slideIdx: number, func: string, args: unknown[] = []) => {
      const frame = iframeRefs.current[slideIdx];
      if (frame?.contentWindow) {
        try {
          frame.contentWindow.postMessage(
            JSON.stringify({ event: "command", func, args }),
            "*"
          );
        } catch {
          // Ignore cross-origin message error
        }
      }
    },
    []
  );

  // Toggle Play/Pause without resetting video playback
  const handleTogglePlayPause = useCallback(() => {
    setIsPaused((prev) => {
      const nextPaused = !prev;
      sendYouTubeCommand(
        activeIndex,
        nextPaused ? "pauseVideo" : "playVideo"
      );
      triggerEphemeralFeedback(nextPaused ? "Pause" : "Lecture");
      return nextPaused;
    });
    if (isUiVisible) scheduleAutoHide();
  }, [
    activeIndex,
    isUiVisible,
    scheduleAutoHide,
    sendYouTubeCommand,
    triggerEphemeralFeedback,
  ]);

  // Toggle Mute/Unmute without resetting video playback
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      sendYouTubeCommand(activeIndex, nextMuted ? "mute" : "unMute");
      if (!nextMuted) {
        sendYouTubeCommand(activeIndex, "setVolume", [100]);
      }
      triggerEphemeralFeedback(nextMuted ? "Son coupé" : "Son activé");
      return nextMuted;
    });
    if (isUiVisible) scheduleAutoHide();
  }, [
    activeIndex,
    isUiVisible,
    scheduleAutoHide,
    sendYouTubeCommand,
    triggerEphemeralFeedback,
  ]);

  // Reset active index when source video list or pageContext changes
  useEffect(() => {
    setActiveIndex(0);
    setInfiniteCycles(1);
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: 0,
        behavior: "instant" as ScrollBehavior,
      });
    }
  }, [pageContext, videos.length]);

  // Build effective slides (supports infinite vertical scrolling on Page 4 Radar)
  const displaySlides = useMemo(() => {
    if (videos.length === 0) return [];
    if (!enableInfiniteLoop) {
      return videos.map((video, idx) => ({
        video,
        slideKey: `${video.id}-0-${idx}`,
        baseRank: idx + 1,
        cycleIndex: 0,
      }));
    }
    const repeated: {
      video: OrbitVideo;
      slideKey: string;
      baseRank: number;
      cycleIndex: number;
    }[] = [];
    for (let c = 0; c < infiniteCycles; c++) {
      videos.forEach((video, idx) => {
        repeated.push({
          video,
          slideKey: `${video.id}-cycle-${c}-${idx}`,
          baseRank: idx + 1,
          cycleIndex: c,
        });
      });
    }
    return repeated;
  }, [videos, enableInfiniteLoop, infiniteCycles]);

  // Extend infinite stream automatically when approaching the end on Page 4 (Radar)
  useEffect(() => {
    if (
      enableInfiniteLoop &&
      videos.length > 0 &&
      activeIndex >= displaySlides.length - 2 &&
      infiniteCycles < 12
    ) {
      setInfiniteCycles((c) => c + 1);
    }
  }, [
    activeIndex,
    displaySlides.length,
    enableInfiniteLoop,
    videos.length,
    infiniteCycles,
  ]);

  // Sync draftRating, pause non-active iframes, and auto-hide controls on slide change
  useEffect(() => {
    Object.entries(iframeRefs.current).forEach(([idxStr, frame]) => {
      const idxNum = Number(idxStr);
      if (idxNum !== activeIndex && frame?.contentWindow) {
        try {
          frame.contentWindow.postMessage(
            JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
            "*"
          );
        } catch {
          // Ignore cross-origin frame message error
        }
      }
    });

    const currentSlide = displaySlides[activeIndex];
    if (currentSlide?.video) {
      setDraftRating(Number(currentSlide.video.score.toFixed(1)));
      setIsPaused(false);
      setActiveDrawer(null);
      setDetailsExpanded(false);
      setMoreActionsOpen(false);
      setElapsedSeconds(12);
      setSeekStartSec(0);
    }
  }, [activeIndex, displaySlides]);

  // Increment live playback timer while active video is playing
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPaused, activeIndex]);

  // IntersectionObserver to detect which slide is centered in viewport (>= 58% visible)
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const slides = Array.from(
      root.querySelectorAll<HTMLElement>("[data-slide-index]")
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const idxAttr = entry.target.getAttribute("data-slide-index");
          if (idxAttr === null) continue;
          const slideIdx = parseInt(idxAttr, 10);
          if (Number.isNaN(slideIdx)) continue;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.58) {
            setActiveIndex((prev) => (prev !== slideIdx ? slideIdx : prev));
          }
        }
      },
      {
        root,
        threshold: [0.2, 0.58, 0.8],
      }
    );

    slides.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [displaySlides.length]);

  // Keyboard navigation (ArrowDown / ArrowUp / Space / H to hide UI)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        scrollToSlide(Math.min(displaySlides.length - 1, activeIndex + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        scrollToSlide(Math.max(0, activeIndex - 1));
      } else if (e.key === " ") {
        e.preventDefault();
        handleTogglePlayPause();
      } else if (e.key.toLowerCase() === "h") {
        e.preventDefault();
        setUiVisible(!isUiVisible);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeIndex,
    displaySlides.length,
    handleTogglePlayPause,
    isUiVisible,
    setUiVisible,
  ]);

  const scrollToSlide = (targetIndex: number) => {
    const root = containerRef.current;
    if (!root) return;
    const slide = root.querySelector<HTMLElement>(
      `[data-slide-index="${targetIndex}"]`
    );
    if (slide) {
      slide.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Natural Gesture Handlers on the Video Stage:
  // - Single tap: toggle Mode Interaction (show/hide UI) without interrupting video
  // - Long press (500ms): open expanded details & secondary controls
  // - Vertical swipe: handled natively by scroll-snap container (touch-action: pan-y)
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      setUiVisible(true);
      setDetailsExpanded(true);
      setMoreActionsOpen(true);
      triggerEphemeralFeedback("Commandes étendues");
      pointerStartRef.current = null;
    }, 520);
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerStartRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    if (dx > 12 || dy > 12) {
      if (longPressTimerRef.current) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (!pointerStartRef.current) return;
    const dx = Math.abs(e.clientX - pointerStartRef.current.x);
    const dy = Math.abs(e.clientY - pointerStartRef.current.y);
    const dt = Date.now() - pointerStartRef.current.time;
    pointerStartRef.current = null;

    // Clean single tap (not a scroll/swipe drag and not a long press)
    if (dx < 14 && dy < 14 && dt < 480) {
      if (activeDrawer) {
        setActiveDrawer(null);
        return;
      }
      if (detailsExpanded) {
        setDetailsExpanded(false);
        return;
      }
      const nextVisible = !isUiVisible;
      setUiVisible(nextVisible);
      if (!nextVisible) {
        setMoreActionsOpen(false);
      }
    }
  };

  const handleQuickRate = (video: OrbitVideo, value: number) => {
    setDraftRating(value);
    onRateVideo(video.id, value);
    setJustRatedId(video.id);
    triggerEphemeralFeedback(`Noté ${value.toFixed(1)}/10`);
    setTimeout(() => setJustRatedId(null), 1600);
  };

  // Feature 18: Trigger live floating CSS particles + save timestamp
  const handleTriggerLiveReaction = (
    video: OrbitVideo,
    reactionId: ReactionType
  ) => {
    const opt =
      LIVE_REACTIONS.find((r) => r.id === reactionId) || LIVE_REACTIONS[0];
    const currentSec = elapsedSeconds;

    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newParticles: FloatingParticleInstance[] = [0, 1, 2, 3].map((i) => ({
      id: `${batchId}-${i}`,
      emoji: opt.emoji,
      label:
        i === 0 ? `${opt.label} · ${formatSecondsToMmSs(currentSec)}` : "",
      swayStart: `${(i % 2 === 0 ? -1 : 1) * (10 + i * 6)}px`,
      swayMid: `${(i % 2 === 0 ? 1 : -1) * (14 + i * 5)}px`,
      swayEnd: `${(i % 2 === 0 ? -1 : 1) * (8 + i * 7)}px`,
      duration: `${1.4 + i * 0.16}s`,
    }));

    setFloatingParticles((prev) => [...prev, ...newParticles]);
    setTimeout(() => {
      setFloatingParticles((prev) =>
        prev.filter((p) => !p.id.startsWith(batchId))
      );
    }, 2200);

    if (onTriggerReaction) {
      onTriggerReaction(video.id, reactionId, currentSec);
    }
    if (onMarkWatched) {
      onMarkWatched(video.id);
    }
    triggerEphemeralFeedback(`${opt.emoji} ${opt.label}`);
  };

  const handleOpenSummaryDrawer = async (video: OrbitVideo) => {
    const nextState = activeDrawer === "summary" ? null : "summary";
    setActiveDrawer(nextState);
    if (nextState === "summary" && !video.aiSummary && onSummarizeVideo) {
      setIsSummarizing(true);
      await onSummarizeVideo(video);
      setIsSummarizing(false);
    }
  };

  const handleTriggerTranslate = async (videoId: number, idx: number) => {
    if (!onTranslateComment) return;
    setTranslatingIdx(idx);
    await onTranslateComment(videoId, idx, targetLang);
    setTranslatingIdx(null);
  };

  const handleCommentSubmit = (e: React.FormEvent, videoId: number) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onAddComment(
      videoId,
      commentText.trim(),
      structuredDebateMode ? selectedStance : "pour",
      sourceUrlInput.trim() || undefined
    );
    setCommentText("");
    setSourceUrlInput("");
    triggerEphemeralFeedback("Avis publié");
  };

  const handleRepostSubmit = (e: React.FormEvent, video: OrbitVideo) => {
    e.preventDefault();
    onRepost(video, repostNote.trim());
    setActiveDrawer(null);
    triggerEphemeralFeedback("Partagé sur votre mur");
  };

  const handleCopyLink = (video: OrbitVideo) => {
    navigator.clipboard.writeText(video.rawUrl);
    setCopiedId(video.id);
    triggerEphemeralFeedback("Lien copié");
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (displaySlides.length === 0) {
    return (
      <div className="orbit-immersive-viewport flex items-center justify-center p-6 bg-black text-white">
        <div className="rounded-2xl p-6 max-w-sm text-center space-y-3 bg-white/5 border border-white/10">
          <div className="text-sm font-semibold text-white">
            Aucune vidéo dans cette sélection
          </div>
          <p className="text-[11px] text-white/60 leading-relaxed">
            Désactivez le filtre « Masquer les vidéos déjà vues » ou basculez en
            mode Grille pour explorer le catalogue.
          </p>
          {onSwitchToGridMode && (
            <button
              type="button"
              onClick={onSwitchToGridMode}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 cursor-pointer"
            >
              Retourner en Mode Grille
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ scrollSnapType: "y mandatory" }}
      className="orbit-immersive-viewport overflow-y-scroll snap-y snap-mandatory no-scrollbar relative scroll-smooth bg-black text-white select-none"
    >
      {displaySlides.map(({ video, slideKey, baseRank, cycleIndex }, idx) => {
        const isActive = idx === activeIndex;
        const isVerticalRatio = video.ratio === "9-16";
        const hasImgError = !!imgErrors[slideKey];
        const useSmartCrop =
          !isVerticalRatio && horizontalFitMode === "cover";
        const embedConfig = getVideoEmbedConfig(video);
        const resolvedThumb =
          embedConfig.isFacebook &&
          (!video.thumb || video.thumb.includes("aircAruvnKk"))
            ? createPlatformCoverSvg("facebook", video.title, video.rawUrl)
            : video.thumb;
        const verticalIframeSrc =
          embedConfig.detectedPlatform === "youtube" && !embedConfig.isFacebook
            ? `https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&mute=${
                isMuted ? 1 : 0
              }&controls=0&rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&loop=1&playlist=${
                video.youtubeId
              }&enablejsapi=1${seekStartSec > 0 ? `&start=${seekStartSec}` : ""}`
            : embedConfig.embedUrl;

        // Categorize comments for Feature 19 (3-Column Structured Debate)
        const pourList: { c: VideoComment; idx: number }[] = [];
        const nuanceList: { c: VideoComment; idx: number }[] = [];
        const sourceList: { c: VideoComment; idx: number }[] = [];
        video.commentsList.forEach((c, cIdx) => {
          const st = c.stance || "pour";
          if (st === "nuance") nuanceList.push({ c, idx: cIdx });
          else if (st === "source") sourceList.push({ c, idx: cIdx });
          else pourList.push({ c, idx: cIdx });
        });

        return (
          <section
            key={slideKey}
            data-slide-index={idx}
            style={{ scrollSnapAlign: "start", scrollSnapStop: "always" }}
            className="snap-start snap-always h-full w-full relative flex items-center justify-center overflow-hidden bg-black"
          >
            {/* 1. SUBTLE AMBIENT BACKDROP ON DESKTOP ONLY (ZERO BANDS ON MOBILE) */}
            <div className="hidden sm:block absolute inset-0 z-0 overflow-hidden pointer-events-none">
              {!hasImgError && !cinemaMode && (
                <img
                  src={resolvedThumb}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setImgErrors((prev) => ({ ...prev, [slideKey]: true }))
                  }
                  className="w-full h-full object-cover scale-125 blur-3xl opacity-20"
                />
              )}
              <div className="absolute inset-0 bg-black/85" />
            </div>

            {/* 2. FULL-BLEED VIDEO STAGE (100% WIDTH & 100% HEIGHT ON MOBILE PORTRAIT) */}
            <div className="relative z-10 w-full h-full flex items-center justify-center">
              <div
                className={`relative overflow-hidden bg-black transition-all duration-300 ${
                  isVerticalRatio
                    ? "w-full h-full sm:w-[460px] md:w-[500px] sm:h-full"
                    : horizontalFitMode === "cover"
                    ? "w-full h-full lg:w-[94%] lg:max-w-[1360px] lg:h-[92%] lg:rounded-2xl"
                    : "w-full aspect-video max-h-full lg:w-[94%] lg:max-w-[1360px]"
                }`}
              >
                {isActive ? (
                  <iframe
                    ref={(el) => {
                      iframeRefs.current[idx] = el;
                    }}
                    key={`${slideKey}-${seekStartSec}-${embedConfig.detectedPlatform}`}
                    src={verticalIframeSrc}
                    title={video.title}
                    className={`w-full h-full ${
                      embedConfig.isFacebook ? "" : "pointer-events-none"
                    } ${
                      useSmartCrop && !embedConfig.isFacebook
                        ? "orbit-video-smart-crop-16-9"
                        : "object-cover"
                    }`}
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
                  />
                ) : (
                  <div className="w-full h-full relative flex items-center justify-center bg-black">
                    {!hasImgError ? (
                      <img
                        src={resolvedThumb}
                        alt={video.title}
                        referrerPolicy="no-referrer"
                        onLoad={(e) => {
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
                          setImgErrors((prev) => ({
                            ...prev,
                            [slideKey]: true,
                          }));
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
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-neutral-950">
                        <span className="text-[11px] text-white/50">
                          {video.domain} · {video.subdomain}
                        </span>
                        <span className="text-sm font-semibold mt-1 max-w-xs text-white/90">
                          {video.title}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* NATURAL TOUCH GESTURE CATCHER LAYER OVER VIDEO:
                    - Single Tap: Toggle UI (Mode Immersion <-> Mode Interaction)
                    - Vertical Swipe: Native scroll-snap to next/previous video
                    - Long Press: Expand full controls */}
                <div
                  onPointerDown={handleStagePointerDown}
                  onPointerMove={handleStagePointerMove}
                  onPointerUp={handleStagePointerUp}
                  style={{ touchAction: "pan-y" }}
                  className="absolute inset-0 z-15 cursor-pointer"
                  aria-label="Toucher pour afficher ou masquer l'interface"
                />

                {/* BRIEF EPHEMERAL CONFIRMATION PILL (AUTO-HIDES IN 1.8S) */}
                {isActive && ephemeralFeedback && (
                  <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 px-3.5 py-1.5 rounded-full bg-black/65 backdrop-blur-md border border-white/15 text-[11px] font-medium text-white/95 transition-opacity duration-200">
                    {ephemeralFeedback}
                  </div>
                )}

                {/* PAUSE INDICATOR WHEN VIDEO IS PAUSED */}
                {isActive && isPaused && (
                  <div
                    onClick={handleTogglePlayPause}
                    className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-full bg-black/55 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/90">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>
                )}

                {/* FLOATING REACTION PARTICLES (ONLY WHEN TRIGGERED) */}
                {isActive && floatingParticles.length > 0 && (
                  <div className="pointer-events-none absolute inset-y-0 right-3 w-36 overflow-hidden z-30">
                    {floatingParticles.map((p) => (
                      <div
                        key={p.id}
                        className="orbit-floating-particle flex items-center gap-1"
                        style={
                          {
                            "--sway-start": p.swayStart,
                            "--sway-mid": p.swayMid,
                            "--sway-end": p.swayEnd,
                            "--duration": p.duration,
                          } as React.CSSProperties
                        }
                      >
                        <span className="text-xl">{p.emoji}</span>
                        {p.label && (
                          <span className="px-2 py-0.5 rounded-full bg-black/75 border border-white/15 text-[10px] font-mono-num text-white/90 whitespace-nowrap">
                            {p.label}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* SUBTLE BOTTOM SCRIM ONLY WHEN INTERFACE IS VISIBLE */}
                <div
                  className={`pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 via-black/30 to-transparent transition-opacity duration-300 ${
                    isUiVisible ? "opacity-100" : "opacity-0"
                  }`}
                />
              </div>
            </div>

            {/* ==============================================================
                3. DISCREET TOP BAR (VISIBLE ONLY IN MODE INTERACTION)
                Contains central "Afficher / Masquer l'interface", Fit 16:9/9:16,
                Fullscreen toggle, and Navigation Menu trigger.
                ============================================================== */}
            <div
              className={`absolute top-2.5 inset-x-3 z-30 flex items-center justify-between gap-2 pointer-events-none transition-opacity duration-300 ${
                isUiVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Left: On-demand Navigation / Pages Drawer Trigger */}
              <div className="flex items-center gap-1.5">
                {onToggleNavOverlay && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleNavOverlay();
                    }}
                    className={`orbit-compact-hit px-2.5 h-8 rounded-full orbit-compact-pill orbit-discreet-ui text-[11px] font-medium gap-1.5 ${
                      isUiVisible ? "pointer-events-auto" : "pointer-events-none"
                    } ${navOverlayOpen ? "orbit-discreet-ui-active" : ""}`}
                    title="Afficher ou masquer la navigation et les filtres"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>{navOverlayOpen ? "Fermer menu" : "Navigation"}</span>
                  </button>
                )}

                {onSwitchToGridMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSwitchToGridMode();
                    }}
                    className={`orbit-compact-hit px-2.5 h-8 rounded-full orbit-compact-pill orbit-discreet-ui text-[11px] font-medium gap-1 ${
                      isUiVisible ? "pointer-events-auto" : "pointer-events-none"
                    }`}
                    title="Quitter le mode immersif vers la vue Grille"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Grille</span>
                  </button>
                )}
              </div>

              {/* Center: Discreet Button « Afficher / Masquer l'interface » */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setUiVisible(false);
                  setDetailsExpanded(false);
                  setMoreActionsOpen(false);
                  setActiveDrawer(null);
                }}
                className={`orbit-compact-hit px-3 h-8 rounded-full orbit-compact-pill orbit-discreet-ui text-[11px] font-medium gap-1.5 ${
                  isUiVisible ? "pointer-events-auto" : "pointer-events-none"
                }`}
                title="Masquer totalement l'interface (toucher la vidéo pour réafficher)"
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>Masquer l&apos;interface</span>
              </button>

              {/* Right: Horizontal Video Fit Toggle (Remplir vs 16:9 Entier) + Native Fullscreen */}
              <div className="flex items-center gap-1">
                {!isVerticalRatio && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const nextMode =
                        horizontalFitMode === "cover" ? "contain" : "cover";
                      setHorizontalFitMode(nextMode);
                      triggerEphemeralFeedback(
                        nextMode === "cover"
                          ? "Recadrage plein écran"
                          : "Format 16:9 entier"
                      );
                    }}
                    className={`orbit-compact-hit px-2.5 h-8 rounded-full orbit-compact-pill orbit-discreet-ui text-[10px] font-medium gap-1 ${
                      isUiVisible ? "pointer-events-auto" : "pointer-events-none"
                    }`}
                    title={
                      horizontalFitMode === "cover"
                        ? "Voir la vidéo 16:9 entière sans recadrage"
                        : "Remplir tout l'écran verticalement"
                    }
                  >
                    {horizontalFitMode === "cover" ? (
                      <>
                        <RectangleHorizontal className="w-3.5 h-3.5" />
                        <span>16:9 entier</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Remplir</span>
                      </>
                    )}
                  </button>
                )}

                {onRemoveUnavailableVideo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveUnavailableVideo(
                        video.id,
                        "Post indisponible supprimé"
                      );
                    }}
                    className={`orbit-compact-hit px-2.5 h-8 rounded-full bg-rose-950/85 hover:bg-rose-900 border border-rose-400/35 text-rose-200 text-[10px] font-medium gap-1 ${
                      isUiVisible ? "pointer-events-auto" : "pointer-events-none"
                    }`}
                    title="Supprimer ce post si la vidéo est indisponible"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Supprimer</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleNativeFullscreen();
                  }}
                  className={`orbit-compact-hit w-8 h-8 rounded-full orbit-compact-pill orbit-discreet-ui ${
                    isUiVisible ? "pointer-events-auto" : "pointer-events-none"
                  }`}
                  title={
                    isNativeFullscreen
                      ? "Quitter le plein écran"
                      : "Activer le plein écran"
                  }
                >
                  {isNativeFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* ==============================================================
                4. COMPACT CREATOR & DESCRIPTION OVERLAY (BOTTOM-LEFT)
                Strict hierarchy:
                1. Creator (@user)
                2. Description (1 to 2 lines max)
                3. Secondary details accessible on demand ("Plus…")
                Completely hidden when isUiVisible === false!
                ============================================================== */}
            <div
              onClick={(e) => e.stopPropagation()}
              className={`orbit-video-overlay-zone absolute left-3 sm:left-6 right-16 sm:right-20 bottom-3 sm:bottom-5 z-20 flex flex-col gap-1.5 max-w-lg transition-opacity duration-300 ${
                isUiVisible
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Line 1: Creator Name + Discreet Metadata */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-5 h-5 rounded-full bg-white/20 border border-white/25 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                  {video.user.substring(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-white/95">
                  @{video.user}
                </span>

                {/* Secondary metadata at ~50% visual opacity (10px-11px) */}
                <span className="text-[10px] text-white/55 flex items-center gap-1">
                  <span aria-hidden="true">·</span>
                  <span>{video.domain}</span>
                  {showRankingBadges && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>#{baseRank}</span>
                    </>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => setDetailsExpanded((prev) => !prev)}
                  className="text-[10px] font-medium text-white/60 hover:text-white px-1.5 py-0.5 rounded bg-black/35 border border-white/10 cursor-pointer transition-opacity"
                >
                  {detailsExpanded ? "Moins" : "Plus…"}
                </button>
              </div>

              {/* Line 2: Compact Video Title / Description (1 to 2 lines max by default) */}
              <div
                onClick={() => setDetailsExpanded((prev) => !prev)}
                className="cursor-pointer"
              >
                <h2
                  className={`text-xs sm:text-sm font-medium text-white/90 leading-snug ${
                    detailsExpanded ? "" : "line-clamp-1 sm:line-clamp-2"
                  }`}
                >
                  {video.title}
                </h2>
                {!detailsExpanded && video.comment && (
                  <p className="text-[11px] text-white/55 line-clamp-1 mt-0.5">
                    {video.comment}
                  </p>
                )}
              </div>

              {/* On-Demand Expanded Secondary Information (Categories, Curator Note, Reactions, Rating Slider) */}
              {detailsExpanded && (
                <div className="mt-1 p-2.5 rounded-xl bg-black/75 backdrop-blur-md border border-white/15 space-y-2 text-[11px] text-white/85">
                  <div className="flex items-center gap-1.5 text-[10px] text-white/60 flex-wrap">
                    <span>{video.domain}</span>
                    <span>/</span>
                    <span>{video.subdomain}</span>
                    {video.isFriend && (
                      <>
                        <span>·</span>
                        <span>Ami Cercle</span>
                      </>
                    )}
                    {video.isScout && (
                      <>
                        <span>·</span>
                        <span>Éclaireur #{video.scoutRank || 1}</span>
                      </>
                    )}
                    {pageContext === "p4" && cycleIndex > 0 && (
                      <>
                        <span>·</span>
                        <span>Cycle {cycleIndex + 1}</span>
                      </>
                    )}
                  </div>

                  {video.comment && (
                    <p className="text-[11px] text-white/85 italic leading-relaxed">
                      « {video.comment} »
                    </p>
                  )}

                  {/* Compact Live Reactions */}
                  <div className="flex items-center gap-1 flex-wrap pt-0.5">
                    {LIVE_REACTIONS.map((rx) => {
                      const cnt = video.reactionCounts?.[rx.id] || 0;
                      return (
                        <button
                          key={rx.id}
                          type="button"
                          onClick={() => handleTriggerLiveReaction(video, rx.id)}
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white/85 bg-white/10 hover:bg-white/20 border border-white/10 cursor-pointer inline-flex items-center gap-1 transition-transform active:scale-95"
                        >
                          <span>{rx.emoji}</span>
                          <span>{rx.label}</span>
                          {cnt > 0 && (
                            <span className="font-mono-num text-[9px] text-white/70">
                              {cnt}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Highlight Timestamps if any */}
                  {video.highlightMoments && video.highlightMoments.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-[10px] text-white/50">
                        Moments :
                      </span>
                      {video.highlightMoments.slice(0, 4).map((hm) => (
                        <button
                          key={hm.id}
                          type="button"
                          onClick={() => {
                            setSeekStartSec(hm.timestampSeconds);
                            setElapsedSeconds(hm.timestampSeconds);
                            setIsPaused(false);
                          }}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono-num text-white/80 bg-white/10 hover:bg-white/20 cursor-pointer"
                        >
                          {hm.emoji} {hm.timestampFormatted}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Compact Inline Rating Slider */}
                  <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                    <Star className="w-3.5 h-3.5 text-white/75 shrink-0" />
                    <input
                      type="range"
                      min="1"
                      max="10"
                      step="0.1"
                      value={isActive ? draftRating : video.score}
                      onChange={(e) =>
                        handleQuickRate(video, parseFloat(e.target.value))
                      }
                      className="orbit-slider flex-1 cursor-pointer"
                      aria-label="Noter cette vidéo sur 10"
                    />
                    <span className="font-mono-num text-[11px] font-semibold text-white/90 min-w-[38px] text-right">
                      {(isActive ? draftRating : video.score).toFixed(1)}/10
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ==============================================================
                5. DISCREET RIGHT-SIDE ACTION RAIL (50% OPACITY AT REST)
                Compact icons (14px-16px) with 44x44px touch hitboxes.
                Completely hidden when isUiVisible === false!
                ============================================================== */}
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute right-2 sm:right-4 bottom-4 sm:bottom-6 z-30 flex flex-col items-center gap-1 transition-opacity duration-300 ${
                isUiVisible
                  ? "opacity-100 pointer-events-auto"
                  : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Sound Mute / Unmute */}
              <button
                type="button"
                onClick={handleToggleMute}
                className="orbit-compact-hit orbit-discreet-ui flex-col"
                title={isMuted ? "Activer le son" : "Couper le son"}
              >
                <span className="w-8 h-8 rounded-full orbit-compact-pill flex items-center justify-center">
                  {isMuted ? (
                    <VolumeX className="w-3.5 h-3.5 text-white/80" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-white" />
                  )}
                </span>
                <span className="text-[9px] text-white/70 mt-0.5">
                  {isMuted ? "Muet" : "Son"}
                </span>
              </button>

              {/* Play / Pause */}
              <button
                type="button"
                onClick={handleTogglePlayPause}
                className="orbit-compact-hit orbit-discreet-ui flex-col"
                title={isPaused ? "Reprendre la lecture" : "Mettre en pause"}
              >
                <span className="w-8 h-8 rounded-full orbit-compact-pill flex items-center justify-center">
                  {isPaused ? (
                    <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                  ) : (
                    <Pause className="w-3.5 h-3.5 text-white/85" />
                  )}
                </span>
                <span className="text-[9px] text-white/70 mt-0.5">
                  {isPaused ? "Lire" : "Pause"}
                </span>
              </button>

              {/* Rating /10 */}
              <button
                type="button"
                onClick={() =>
                  setActiveDrawer(activeDrawer === "rate" ? null : "rate")
                }
                className={`orbit-compact-hit orbit-discreet-ui flex-col ${
                  activeDrawer === "rate" || justRatedId === video.id
                    ? "orbit-discreet-ui-active"
                    : ""
                }`}
                title="Noter cette vidéo"
              >
                <span className="w-8 h-8 rounded-full orbit-compact-pill flex items-center justify-center">
                  <Star className="w-3.5 h-3.5 text-white/90" />
                </span>
                <span className="text-[10px] font-mono-num text-white/80 mt-0.5">
                  {video.score.toFixed(1)}
                </span>
              </button>

              {/* Comments & Structured Debate */}
              <button
                type="button"
                onClick={() =>
                  setActiveDrawer(
                    activeDrawer === "comments" ? null : "comments"
                  )
                }
                className={`orbit-compact-hit orbit-discreet-ui flex-col ${
                  activeDrawer === "comments" ? "orbit-discreet-ui-active" : ""
                }`}
                title="Avis & Débat structuré"
              >
                <span className="w-8 h-8 rounded-full orbit-compact-pill flex items-center justify-center">
                  <Scale className="w-3.5 h-3.5 text-white/90" />
                </span>
                <span className="text-[10px] font-mono-num text-white/80 mt-0.5">
                  {video.commentsList.length}
                </span>
              </button>

              {/* Share / Jukebox / PiP */}
              <button
                type="button"
                onClick={() =>
                  setActiveDrawer(activeDrawer === "share" ? null : "share")
                }
                className={`orbit-compact-hit orbit-discreet-ui flex-col ${
                  activeDrawer === "share" ? "orbit-discreet-ui-active" : ""
                }`}
                title="Partager"
              >
                <span className="w-8 h-8 rounded-full orbit-compact-pill flex items-center justify-center">
                  <Share2 className="w-3.5 h-3.5 text-white/90" />
                </span>
                <span className="text-[9px] text-white/70 mt-0.5">
                  Partager
                </span>
              </button>

              {/* Secondary Actions Expand Toggle (AI Summary, Watch Later, Audio) */}
              <button
                type="button"
                onClick={() => setMoreActionsOpen((prev) => !prev)}
                className={`orbit-compact-hit orbit-discreet-ui flex-col ${
                  moreActionsOpen || activeDrawer === "summary"
                    ? "orbit-discreet-ui-active"
                    : ""
                }`}
                title="Options complémentaires (Résumé IA, À regarder ce soir, Mode Audio)"
              >
                <span className="w-8 h-8 rounded-full orbit-compact-pill flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white/85" />
                </span>
                <span className="text-[9px] text-white/70 mt-0.5">Plus</span>
              </button>

              {moreActionsOpen && (
                <div className="flex flex-col items-center gap-1 pt-1 border-t border-white/15">
                  {/* AI Summary */}
                  <button
                    type="button"
                    onClick={() => handleOpenSummaryDrawer(video)}
                    className="orbit-compact-hit orbit-discreet-ui-active flex-col"
                    title="Résumé IA en 3 points"
                  >
                    <span className="w-8 h-8 rounded-full orbit-compact-pill flex items-center justify-center">
                      <Sparkles className="w-3.5 h-3.5 text-white" />
                    </span>
                    <span className="text-[9px] text-white/80 mt-0.5">IA</span>
                  </button>

                  {/* Watch Later ("Ce soir") */}
                  {onToggleWatchLater && (
                    <button
                      type="button"
                      onClick={() => onToggleWatchLater(video)}
                      className="orbit-compact-hit orbit-discreet-ui-active flex-col"
                      title="Mettre de côté pour ce soir"
                    >
                      <span className="w-8 h-8 rounded-full orbit-compact-pill flex items-center justify-center">
                        {watchLaterIds.includes(video.id) ? (
                          <Check className="w-3.5 h-3.5 text-white" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-white/85" />
                        )}
                      </span>
                      <span className="text-[9px] text-white/80 mt-0.5">
                        {watchLaterIds.includes(video.id) ? "Mis" : "Ce soir"}
                      </span>
                    </button>
                  )}

                  {/* Audio / Podcast Mode */}
                  {onPlayAudioMode && (
                    <button
                      type="button"
                      onClick={() => onPlayAudioMode(video)}
                      className="orbit-compact-hit orbit-discreet-ui-active flex-col"
                      title="Mode Audio en arrière-plan"
                    >
                      <span className="w-8 h-8 rounded-full orbit-compact-pill flex items-center justify-center">
                        <Headphones className="w-3.5 h-3.5 text-white/85" />
                      </span>
                      <span className="text-[9px] text-white/80 mt-0.5">
                        Audio
                      </span>
                    </button>
                  )}
                </div>
              )}

              {/* Desktop Up / Down Quick Scroll Controls */}
              <div className="hidden sm:flex flex-col items-center gap-0.5 pt-1 border-t border-white/10">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => scrollToSlide(Math.max(0, idx - 1))}
                  className="w-7 h-7 rounded-full orbit-compact-pill orbit-discreet-ui flex items-center justify-center text-white disabled:opacity-20 cursor-pointer"
                  title="Vidéo précédente"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={
                    !enableInfiniteLoop && idx === displaySlides.length - 1
                  }
                  onClick={() =>
                    scrollToSlide(Math.min(displaySlides.length - 1, idx + 1))
                  }
                  className="w-7 h-7 rounded-full orbit-compact-pill orbit-discreet-ui flex items-center justify-center text-white disabled:opacity-20 cursor-pointer"
                  title="Vidéo suivante"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* ==============================================================
                6. ON-DEMAND DRAWERS (RATE, SUMMARY, COMMENTS/DEBATE, SHARE)
                ============================================================== */}
            {isActive && isUiVisible && activeDrawer && (
              <div
                className={`absolute right-14 sm:right-18 bottom-4 sm:bottom-6 z-40 rounded-2xl p-4 text-white space-y-3 max-h-[80dvh] overflow-y-auto ${
                  activeDrawer === "comments" && structuredDebateMode
                    ? "w-[310px] sm:w-[560px]"
                    : "w-[280px] sm:w-[350px]"
                }`}
                style={{
                  background: "rgba(10, 11, 16, 0.94)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255, 255, 255, 0.16)",
                  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.85)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* RATE DRAWER */}
                {activeDrawer === "rate" && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-white/90" />
                        <span className="text-xs font-bold text-white">
                          Noter cette vidéo
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveDrawer(null)}
                        className="text-white/60 hover:text-white cursor-pointer p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] text-white/60">
                          Moyenne actuelle
                        </div>
                        <div className="text-lg font-bold font-mono-num text-white">
                          {video.score.toFixed(1)}{" "}
                          <span className="text-[11px] font-normal text-white/50">
                            / 10
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-white/60">
                          Participation
                        </div>
                        <div className="text-xs font-semibold font-mono-num text-white/90">
                          {video.votes} votes
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/70">Votre note :</span>
                        <span className="font-mono-num text-white font-semibold">
                          {draftRating.toFixed(1)} / 10
                        </span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.1"
                        value={draftRating}
                        onChange={(e) =>
                          handleQuickRate(video, parseFloat(e.target.value))
                        }
                        className="orbit-slider w-full cursor-pointer"
                      />
                      <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {[8.5, 9.0, 9.5, 10.0].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => handleQuickRate(video, preset)}
                            className="py-1 rounded-lg text-[11px] font-mono-num font-semibold text-white cursor-pointer transition-colors"
                            style={{
                              background:
                                Math.abs(draftRating - preset) < 0.05
                                  ? "rgba(255,255,255,0.22)"
                                  : "rgba(255,255,255,0.06)",
                              border: "1px solid rgba(255,255,255,0.14)",
                            }}
                          >
                            {preset.toFixed(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* GEMINI AI SUMMARY DRAWER */}
                {activeDrawer === "summary" && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-white/85" />
                        <span className="text-xs font-bold text-white">
                          Synthèse en 3 points clés
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveDrawer(null)}
                        className="text-white/60 hover:text-white cursor-pointer p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {isSummarizing ? (
                      <div className="py-5 flex flex-col items-center justify-center gap-2 text-[11px] text-white/70">
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Extraction des points clés...</span>
                      </div>
                    ) : video.aiSummary ? (
                      <div className="space-y-2.5 text-[11px]">
                        <div className="flex items-center justify-between text-[10px] text-white/60">
                          <span>Résumé essentiel</span>
                          <span className="font-mono-num">
                            ~{video.aiSummary.estimatedSavedMinutes} min gagnées
                          </span>
                        </div>
                        <ul className="space-y-1.5 pl-4 list-disc text-white/90 leading-relaxed">
                          {video.aiSummary.bullets.map((b, bIdx) => (
                            <li key={bIdx}>{b}</li>
                          ))}
                        </ul>
                        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[10px] italic text-white/75">
                          <strong className="text-white">Verdict :</strong>{" "}
                          {video.aiSummary.verdict}
                        </div>
                      </div>
                    ) : null}
                  </>
                )}

                {/* COMMENTS & STRUCTURED DEBATE DRAWER */}
                {activeDrawer === "comments" && (
                  <>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Scale className="w-3.5 h-3.5 text-white/85" />
                        <span className="text-xs font-bold text-white">
                          Avis ({video.commentsList.length})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setStructuredDebateMode(!structuredDebateMode)
                          }
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 border border-white/15 text-white/90 cursor-pointer"
                        >
                          {structuredDebateMode
                            ? "3 Colonnes"
                            : "Liste standard"}
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        {(["fr", "en", "es"] as const).map((lng) => (
                          <button
                            key={lng}
                            type="button"
                            onClick={() => setTargetLang(lng)}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase cursor-pointer ${
                              targetLang === lng
                                ? "bg-white/25 text-white"
                                : "bg-white/5 text-white/60"
                            }`}
                          >
                            {lng}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setActiveDrawer(null)}
                          className="text-white/60 hover:text-white cursor-pointer ml-1 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {structuredDebateMode ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                        {/* Pour */}
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-white/85">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Pour ({pourList.length})</span>
                          </div>
                          {pourList.map(({ c, idx: cIdx }) => (
                            <div
                              key={cIdx}
                              className="p-1.5 rounded-lg bg-black/50 border border-white/10 text-[10px] space-y-0.5"
                            >
                              <div className="flex items-center justify-between">
                                <strong className="text-white/90">
                                  @{c.author}
                                </strong>
                                {onTranslateComment && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleTriggerTranslate(video.id, cIdx)
                                    }
                                    className="text-[9px] text-white/60 hover:text-white cursor-pointer"
                                  >
                                    {translatingIdx === cIdx ? "..." : "🌐"}
                                  </button>
                                )}
                              </div>
                              <p className="text-white/80">{c.text}</p>
                              {c.translatedText && (
                                <div className="text-[9px] text-white/60 pt-0.5 border-t border-white/10">
                                  {c.translatedText}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Nuances */}
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-white/85">
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                            <span>Nuances ({nuanceList.length})</span>
                          </div>
                          {nuanceList.map(({ c, idx: cIdx }) => (
                            <div
                              key={cIdx}
                              className="p-1.5 rounded-lg bg-black/50 border border-white/10 text-[10px] space-y-0.5"
                            >
                              <strong className="text-white/90">
                                @{c.author}
                              </strong>
                              <p className="text-white/80">{c.text}</p>
                            </div>
                          ))}
                        </div>

                        {/* Sources */}
                        <div className="p-2 rounded-xl bg-white/5 border border-white/10 space-y-1.5">
                          <div className="flex items-center gap-1 text-[10px] font-semibold text-white/85">
                            <BookOpen className="w-3 h-3 text-sky-400" />
                            <span>Sources ({sourceList.length})</span>
                          </div>
                          {sourceList.map(({ c, idx: cIdx }) => (
                            <div
                              key={cIdx}
                              className="p-1.5 rounded-lg bg-black/50 border border-white/10 text-[10px] space-y-0.5"
                            >
                              <strong className="text-white/90">
                                @{c.author}
                              </strong>
                              <p className="text-white/80">{c.text}</p>
                              {c.sourceUrl && (
                                <a
                                  href={c.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-sky-300 underline inline-flex items-center gap-0.5"
                                >
                                  <span>Source</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {video.commentsList.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] space-y-0.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-white">
                                @{c.author}
                              </span>
                              {onTranslateComment && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleTriggerTranslate(video.id, cIdx)
                                  }
                                  className="inline-flex items-center gap-1 text-[9px] text-white/60 hover:text-white cursor-pointer"
                                >
                                  <Globe className="w-2.5 h-2.5" />
                                  <span>{targetLang.toUpperCase()}</span>
                                </button>
                              )}
                            </div>
                            <div className="text-white/80 leading-relaxed">
                              {c.text}
                            </div>
                            {c.translatedText && (
                              <div className="text-[10px] text-white/60 pt-1 border-t border-white/10">
                                {c.translatedText}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <form
                      onSubmit={(e) => handleCommentSubmit(e, video.id)}
                      className="space-y-1.5 pt-1"
                    >
                      {structuredDebateMode && (
                        <div className="grid grid-cols-3 gap-1">
                          {[
                            { id: "pour" as DebateStance, label: "Pour" },
                            { id: "nuance" as DebateStance, label: "Nuance" },
                            { id: "source" as DebateStance, label: "Source" },
                          ].map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => setSelectedStance(st.id)}
                              className={`py-1 px-2 rounded-lg text-[10px] font-medium cursor-pointer ${
                                selectedStance === st.id
                                  ? "bg-white/20 text-white border border-white/30"
                                  : "bg-white/5 text-white/60 border border-white/10"
                              }`}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {structuredDebateMode && selectedStance === "source" && (
                        <input
                          type="text"
                          value={sourceUrlInput}
                          onChange={(e) => setSourceUrlInput(e.target.value)}
                          placeholder="URL de la source (https://...)"
                          className="w-full px-2.5 py-1.5 rounded-lg text-[11px] bg-black/60 border border-white/20 text-white outline-none"
                        />
                      )}
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Ajouter un commentaire..."
                          className="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] bg-black/60 border border-white/20 text-white outline-none"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-white bg-white/20 hover:bg-white/30 cursor-pointer inline-flex items-center justify-center"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      </div>
                    </form>
                  </>
                )}

                {/* SHARE, JUKEBOX & REPOST DRAWER */}
                {activeDrawer === "share" && (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Repeat2 className="w-3.5 h-3.5 text-white/85" />
                        <span className="text-xs font-bold text-white">
                          Partager
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveDrawer(null)}
                        className="text-white/60 hover:text-white cursor-pointer p-1"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {onAddToJukebox && (
                      <button
                        type="button"
                        onClick={() => {
                          onAddToJukebox(video);
                          setActiveDrawer(null);
                        }}
                        className="w-full py-2 px-3 rounded-xl text-[11px] font-medium text-white bg-white/10 hover:bg-white/15 border border-white/15 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>Ajouter au Jukebox des Amis</span>
                      </button>
                    )}

                    <form
                      onSubmit={(e) => handleRepostSubmit(e, video)}
                      className="space-y-2"
                    >
                      <input
                        type="text"
                        value={repostNote}
                        onChange={(e) => setRepostNote(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg text-[11px] bg-black/60 border border-white/20 text-white outline-none"
                      />
                      <button
                        type="submit"
                        className="w-full py-2 rounded-xl text-[11px] font-semibold text-white bg-white/20 hover:bg-white/30 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Publier sur mon Mur</span>
                      </button>
                    </form>

                    <div className="pt-1.5 border-t border-white/10 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPlayPip(video)}
                        className="py-1.5 px-2.5 rounded-lg text-[11px] text-white bg-white/10 hover:bg-white/15 border border-white/10 cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        <PictureInPicture2 className="w-3 h-3" />
                        <span>PiP</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(video)}
                        className="flex-1 py-1.5 px-2.5 rounded-lg text-[11px] text-white bg-white/10 hover:bg-white/15 border border-white/10 cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        {copiedId === video.id ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Copié</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copier le lien</span>
                          </>
                        )}
                      </button>
                      <a
                        href={video.rawUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-1.5 px-2.5 rounded-lg text-[11px] bg-white/10 hover:bg-white/15 border border-white/10 inline-flex items-center justify-center text-white no-underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
