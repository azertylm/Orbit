import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import ReactPlayer from "react-player";
import {
  getVideoEmbedConfig,
  createPlatformCoverSvg,
} from "../data/orbitData";
import { OrbitStorageService } from "../services/storageAdapter";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  ExternalLink,
  RefreshCw,
  Trash2,
  ShieldAlert,
  Loader2,
  Smartphone,
  Layers,
  Download,
  Upload,
  Gauge,
} from "lucide-react";

export type SupportedPlatform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "twitch";

export type PlayerEngineMode =
  | "mp4-direct"
  | "react-player"
  | "native-iframe"
  | "fallback-stream";

export interface PlatformErrorDiagnostic {
  platform: SupportedPlatform;
  code: string;
  title: string;
  reason: string;
  remediation: string;
  canRetryWithNativeEmbed: boolean;
  canUseMirrorStream: boolean;
}

export interface UniversalVideoPlayerProps {
  video: {
    id?: number;
    title: string;
    platform?: SupportedPlatform | string;
    rawUrl?: string;
    youtubeId?: string;
    thumb?: string;
    mp4Url?: string;
    hasLocalMp4Blob?: boolean;
    ratio?: "16-9" | "9-16";
    domain?: string;
    subdomain?: string;
    durationMinutes?: number;
  };
  playing?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  startAtSeconds?: number;
  className?: string;
  showTopBar?: boolean;
  hideCustomSeekBar?: boolean;
  autoRemoveOnFatalError?: boolean;
  onCloseInline?: () => void;
  onReady?: () => void;
  onError?: (diagnostic: PlatformErrorDiagnostic) => void;
  onRemoveUnavailableVideo?: (videoId: number, reason?: string) => void;
  onTimeUpdateSeconds?: (currentSec: number, durationSec: number) => void;
}

function formatPlayerTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

const KNOWN_BROKEN_YT_IDS = new Set([
  "5qap5aO4i9A",
  "DWcJFNfaw9c",
  "rUxyKA_-grg",
  "3JZ_D3ELwOQ",
  "master6kL2Y",
  "Rg5S9sP2n7s",
  "4qH4TG2U24A",
  "pM2n7N9D-Ww",
  "1C2g43d2c3k",
  "v489GVJhTG0",
  "m7HxBa9W228",
  "p5v9T0A3gMY",
  "UoQWLK6-PWM",
  "c646TZ1NGJc",
  "TxWJj4SNfKM",
  "bA8cMwyaLUc",
  "b2CFWsCs1aM",
  "eJ3R35I7B5E",
  "5f6M8bAB2IQ",
  "1w1eb2xJnLI",
]);

/**
 * Enregistrement unique des lecteurs personnalisés Facebook et Instagram
 * dans ReactPlayer v3 afin que `<ReactPlayer src={...} />` gère uniformément
 * YouTube, TikTok, Twitch, Facebook et Instagram.
 */
let customPlayersRegistered = false;

function ensureCustomPlayersRegistered() {
  if (customPlayersRegistered) return;
  customPlayersRegistered = true;

  try {
    if (typeof ReactPlayer.addCustomPlayer === "function") {
      // Custom Player 1 : Facebook Watch / Reels
      const FacebookCustomElement = React.forwardRef<
        HTMLVideoElement,
        Record<string, unknown>
      >((props, _ref) => {
        const src = typeof props.src === "string" ? props.src : "";
        const onLoadStart = props.onLoadStart as
          | ((e: React.SyntheticEvent) => void)
          | undefined;
        const onPlay = props.onPlay as
          | ((e: React.SyntheticEvent) => void)
          | undefined;
        const onError = props.onError as
          | ((e: React.SyntheticEvent) => void)
          | undefined;

        const cleanUrl = normalizeFacebookUrl(src);
        const embedSrc = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
          cleanUrl
        )}&show_text=false&autoplay=true&mute=0`;

        return (
          <iframe
            src={embedSrc}
            title="Facebook Video Player"
            className="w-full h-full border-0 bg-black"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            onLoad={(e) => {
              if (onLoadStart) onLoadStart(e);
              if (onPlay) onPlay(e);
            }}
            onError={(e) => {
              if (onError) onError(e);
            }}
          />
        );
      });
      FacebookCustomElement.displayName = "FacebookCustomElement";

      ReactPlayer.addCustomPlayer({
        key: "facebook",
        name: "Facebook",
        canPlay: (src: string) =>
          typeof src === "string" &&
          (src.toLowerCase().includes("facebook.com") ||
            src.toLowerCase().includes("fb.watch") ||
            src.toLowerCase().includes("fb.com")),
        canEnablePIP: () => false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        player: FacebookCustomElement as any,
      });

      // Custom Player 2 : Instagram Reels / Posts
      const InstagramCustomElement = React.forwardRef<
        HTMLVideoElement,
        Record<string, unknown>
      >((props, _ref) => {
        const src = typeof props.src === "string" ? props.src : "";
        const onLoadStart = props.onLoadStart as
          | ((e: React.SyntheticEvent) => void)
          | undefined;
        const onPlay = props.onPlay as
          | ((e: React.SyntheticEvent) => void)
          | undefined;
        const onError = props.onError as
          | ((e: React.SyntheticEvent) => void)
          | undefined;

        const match = src.match(
          /instagram\.com\/(reel|p|tv)\/([A-Za-z0-9_-]+)/i
        );
        const type = match?.[1] || "reel";
        const code = match?.[2] || "";
        const embedSrc = `https://www.instagram.com/${type}/${code}/embed`;

        return (
          <iframe
            src={embedSrc}
            title="Instagram Reel Player"
            className="w-full h-full border-0 bg-black"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
            onLoad={(e) => {
              if (onLoadStart) onLoadStart(e);
              if (onPlay) onPlay(e);
            }}
            onError={(e) => {
              if (onError) onError(e);
            }}
          />
        );
      });
      InstagramCustomElement.displayName = "InstagramCustomElement";

      ReactPlayer.addCustomPlayer({
        key: "instagram",
        name: "Instagram",
        canPlay: (src: string) =>
          typeof src === "string" &&
          /instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+/i.test(src),
        canEnablePIP: () => false,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        player: InstagramCustomElement as any,
      });
    }
  } catch {
    // Ignore registration error if environment restricts custom player mutation
  }
}

export function normalizeFacebookUrl(rawInput: string): string {
  let cleanFbUrl = (rawInput || "").trim();
  const hrefMatch = cleanFbUrl.match(/[?&]href=([^&"'\s>]+)/i);
  if (hrefMatch && hrefMatch[1]) {
    try {
      cleanFbUrl = decodeURIComponent(hrefMatch[1]);
    } catch {
      cleanFbUrl = hrefMatch[1];
    }
  } else {
    const httpMatch = cleanFbUrl.match(/https?:\/\/[^\s"'<>]+/i);
    if (httpMatch && httpMatch[0]) {
      cleanFbUrl = httpMatch[0];
    }
  }
  if (cleanFbUrl && !/^https?:\/\//i.test(cleanFbUrl)) {
    cleanFbUrl = `https://${cleanFbUrl}`;
  }
  cleanFbUrl = cleanFbUrl.replace(
    /^https?:\/\/(m|web|touch)\.facebook\.com/i,
    "https://www.facebook.com"
  );
  if (
    !cleanFbUrl ||
    (!cleanFbUrl.toLowerCase().includes("facebook.com") &&
      !cleanFbUrl.toLowerCase().includes("fb.watch") &&
      !cleanFbUrl.toLowerCase().includes("fb.com"))
  ) {
    return "https://www.facebook.com/facebook/videos/10153231379946729/";
  }
  return cleanFbUrl;
}

export function buildPlatformDiagnostic(
  platform: SupportedPlatform,
  rawErrorCode?: string,
  hasMirrorYtId?: boolean
): PlatformErrorDiagnostic {
  switch (platform) {
    case "facebook":
      return {
        platform: "facebook",
        code: rawErrorCode || "FB_EMBED_RESTRICTED",
        title: "Restriction d'intégration Facebook Watch / Reel",
        reason:
          "Facebook bloque l'intégration iframe de ce Reel (/share/r/). Utilisez le lecteur MP4 Direct intégré ou importez le fichier .MP4 téléchargé !",
        remediation:
          "Cliquez sur « Lire en MP4 Direct » ou « Importer .MP4 téléchargé » ci-dessous pour lire la vidéo nativement sans restriction Facebook.",
        canRetryWithNativeEmbed: true,
        canUseMirrorStream: Boolean(hasMirrorYtId),
      };
    case "tiktok":
      return {
        platform: "tiktok",
        code: rawErrorCode || "TIKTOK_EMBED_CSP",
        title: "Lecture TikTok restreinte en intégration externe",
        reason:
          "Ce lien TikTok utilise un format court non résolu (vm.tiktok.com) ou le créateur a désactivé l'exportation du lecteur hors de TikTok.",
        remediation: hasMirrorYtId
          ? "Basculez sur le Flux MP4 / Miroir 9:16 intégré ou ouvrez la vidéo dans TikTok."
          : "Ouvrez directement la pépite sur TikTok via le bouton ci-dessous.",
        canRetryWithNativeEmbed: true,
        canUseMirrorStream: Boolean(hasMirrorYtId),
      };
    case "instagram":
      return {
        platform: "instagram",
        code: rawErrorCode || "IG_REEL_CSP",
        title: "Reel Instagram protégé par Meta X-Frame-Options",
        reason:
          "Meta bloque l'intégration de certains Reels lorsque le navigateur refuse les cookies tiers ou que le compte nécessite une connexion Instagram.",
        remediation: hasMirrorYtId
          ? "Activez le Flux MP4 / Miroir 9:16 ou ouvrez le Reel directement sur Instagram."
          : "Ouvrez directement le Reel dans Instagram en un clic.",
        canRetryWithNativeEmbed: true,
        canUseMirrorStream: Boolean(hasMirrorYtId),
      };
    case "twitch":
      return {
        platform: "twitch",
        code: rawErrorCode || "TWITCH_PARENT_DOMAIN",
        title: "Flux Twitch hors-ligne ou restriction de domaine parent",
        reason:
          "Le canal Twitch n'est pas en direct actuellement ou la politique CSP du clip exige une ouverture externe.",
        remediation: hasMirrorYtId
          ? "Lancez le flux musical/vidéo miroir ou ouvrez Twitch dans un nouvel onglet."
          : "Ouvrez le canal directement sur Twitch.",
        canRetryWithNativeEmbed: true,
        canUseMirrorStream: Boolean(hasMirrorYtId),
      };
    case "youtube":
    default:
      return {
        platform: "youtube",
        code: rawErrorCode || "YT_EMBED_150",
        title:
          rawErrorCode === "100"
            ? "Vidéo YouTube supprimée ou passée en privé (Code 100)"
            : "Intégration externe restreinte par l'ayant-droit (Code 101/150)",
        reason:
          rawErrorCode === "100"
            ? "Cette vidéo n'est plus disponible sur les serveurs YouTube."
            : "L'auteur de la chaîne a désactivé la lecture intégrée en dehors de youtube.com ou votre réseau bloque le sous-domaine du lecteur.",
        remediation:
          "Essayez le lecteur YouTube NoCookie de secours, ouvrez la vidéo sur YouTube, ou supprimez ce post s'il est définitivement indisponible.",
        canRetryWithNativeEmbed: true,
        canUseMirrorStream: false,
      };
  }
}

export const UniversalVideoPlayer: React.FC<UniversalVideoPlayerProps> = ({
  video,
  playing = true,
  muted = false,
  controls: _controls = true,
  loop = false,
  startAtSeconds = 0,
  className = "",
  showTopBar = true,
  hideCustomSeekBar = false,
  autoRemoveOnFatalError = false,
  onCloseInline,
  onReady,
  onError,
  onRemoveUnavailableVideo,
  onTimeUpdateSeconds,
}) => {
  ensureCustomPlayersRegistered();

  const embedConfig = useMemo(() => getVideoEmbedConfig(video), [video]);
  const detectedPlatform: SupportedPlatform =
    (video.platform as SupportedPlatform) || embedConfig.detectedPlatform;

  const rawUrl = (video.rawUrl || "").trim();
  const rawLower = rawUrl.toLowerCase();

  const validYoutubeId = useMemo(() => {
    const candidate = (video.youtubeId || "").trim();
    if (
      candidate &&
      candidate.length === 11 &&
      !KNOWN_BROKEN_YT_IDS.has(candidate)
    ) {
      return candidate;
    }
    const ytMatch = rawUrl.match(
      /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i
    );
    if (ytMatch && ytMatch[1] && !KNOWN_BROKEN_YT_IDS.has(ytMatch[1])) {
      return ytMatch[1];
    }
    return "";
  }, [video.youtubeId, rawUrl]);

  const hasRealNativeSocialUrl = useMemo(() => {
    if (
      rawLower.includes("facebook.com") ||
      rawLower.includes("fb.watch") ||
      rawLower.includes("fb.com")
    ) {
      return !rawLower.includes("10153231379946729");
    }
    if (rawLower.includes("tiktok.com")) {
      const m = rawUrl.match(/\/video\/(\d+)/);
      return Boolean(m && m[1] && m[1] !== "7200000000000000000");
    }
    if (/instagram\.com\/(reel|p|tv)\/([A-Za-z0-9_-]+)/i.test(rawUrl)) {
      const m = rawUrl.match(/instagram\.com\/(reel|p|tv)\/([A-Za-z0-9_-]+)/i);
      return Boolean(m && m[2] && m[2] !== "C8lightpainting");
    }
    if (rawLower.includes("twitch.tv")) {
      return true;
    }
    return false;
  }, [rawLower, rawUrl]);

  // Flux MP4 direct (issu de video.mp4Url, IndexedDB local ou extraction serveur /api/orbit/extract-video)
  const sanitizeMp4Url = (candidate?: string) => {
    if (!candidate) return "";
    if (
      candidate.includes("mixkit.co") ||
      (candidate.includes("ForBiggerBlazes") &&
        (rawLower.includes("facebook.com") ||
          rawLower.includes("fb.watch") ||
          rawLower.includes("tiktok.com")))
    ) {
      return rawUrl
        ? `/api/orbit/proxy-mp4?url=${encodeURIComponent(rawUrl)}`
        : `/api/orbit/proxy-mp4?url=${encodeURIComponent(
            "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
          )}`;
    }
    return candidate;
  };

  const [resolvedMp4Url, setResolvedMp4Url] = useState<string>(
    sanitizeMp4Url(video.mp4Url) ||
      (/\.(mp4|webm|mov)(\?|$)/i.test(rawUrl) || rawUrl.startsWith("blob:")
        ? sanitizeMp4Url(rawUrl)
        : detectedPlatform === "facebook" && rawUrl
        ? `/api/orbit/proxy-mp4?url=${encodeURIComponent(rawUrl)}`
        : "")
  );
  const [resolvedCanonicalUrl, setResolvedCanonicalUrl] =
    useState<string>(rawUrl);
  const [isExtractingMp4, setIsExtractingMp4] = useState<boolean>(false);

  const initialEngineMode: PlayerEngineMode = useMemo(() => {
    if (
      video.mp4Url ||
      video.hasLocalMp4Blob ||
      /\.(mp4|webm|mov)(\?|$)/i.test(rawUrl) ||
      rawUrl.startsWith("blob:") ||
      detectedPlatform === "facebook" ||
      rawLower.includes("/share/r/") ||
      rawLower.includes("/share/v/") ||
      rawLower.includes("/share/")
    ) {
      return "mp4-direct";
    }
    if (detectedPlatform === "youtube" || validYoutubeId) {
      return "native-iframe";
    }
    return "react-player";
  }, [
    video.mp4Url,
    video.hasLocalMp4Blob,
    rawUrl,
    rawLower,
    detectedPlatform,
    validYoutubeId,
  ]);

  const [engineMode, setEngineMode] =
    useState<PlayerEngineMode>(initialEngineMode);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [errorDiagnostic, setErrorDiagnostic] =
    useState<PlatformErrorDiagnostic | null>(null);
  const [retriedWithFallback, setRetriedWithFallback] =
    useState<boolean>(false);

  // État de navigation temporelle (Seek Bar, Temps courant, Durée totale, Lecture/Pause)
  const defaultDurationSec = useMemo(
    () => Math.max(60, (video.durationMinutes || 4) * 60),
    [video.durationMinutes]
  );
  const [currentTime, setCurrentTime] = useState<number>(startAtSeconds || 0);
  const [duration, setDuration] = useState<number>(defaultDurationSec);
  const [isPlayingInternal, setIsPlayingInternal] = useState<boolean>(playing);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubValue, setScrubValue] = useState<number>(startAtSeconds || 0);
  const [isControlsActive, setIsControlsActive] = useState<boolean>(false);

  const SPEED_OPTIONS = useMemo(() => [0.75, 1.0, 1.25, 1.5, 2.0], []);
  const [playbackRate, setPlaybackRate] = useState<number>(() =>
    OrbitStorageService.getPlaybackSpeed()
  );
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);

  const initialStartRef = useRef<number>(startAtSeconds || 0);
  const hasLiveTimeRef = useRef<boolean>(false);
  const onTimeUpdateSecondsRef = useRef(onTimeUpdateSeconds);
  const controlsIdleTimerRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const html5VideoRef = useRef<HTMLVideoElement | null>(null);
  const localMp4InputRef = useRef<HTMLInputElement | null>(null);

  const wakeUpControls = useCallback(() => {
    setIsControlsActive(true);
    if (controlsIdleTimerRef.current) {
      window.clearTimeout(controlsIdleTimerRef.current);
    }
    controlsIdleTimerRef.current = window.setTimeout(() => {
      setIsControlsActive(false);
    }, 2200);
  }, []);

  const handleCyclePlaybackRate = useCallback(() => {
    wakeUpControls();
    const currIdx = SPEED_OPTIONS.indexOf(playbackRate);
    const nextRate = SPEED_OPTIONS[(currIdx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(nextRate);
    OrbitStorageService.savePlaybackSpeed(nextRate);
    if (html5VideoRef.current) {
      try {
        html5VideoRef.current.playbackRate = nextRate;
      } catch {
        // ignore
      }
    }
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "setPlaybackRate",
            args: [nextRate],
          }),
          "*"
        );
      } catch {
        // ignore
      }
    }
  }, [SPEED_OPTIONS, playbackRate, wakeUpControls]);

  useEffect(() => {
    return () => {
      if (controlsIdleTimerRef.current) {
        window.clearTimeout(controlsIdleTimerRef.current);
      }
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }
    };
  }, []);

  const showControlsOverlay =
    isControlsActive || isScrubbing || !isPlayingInternal;

  useEffect(() => {
    onTimeUpdateSecondsRef.current = onTimeUpdateSeconds;
  }, [onTimeUpdateSeconds]);

  useEffect(() => {
    setIsPlayingInternal(playing);
  }, [playing]);

  // Synchroniser le temps courant avec le composant parent en dehors du cycle de rendu
  useEffect(() => {
    if (onTimeUpdateSecondsRef.current) {
      onTimeUpdateSecondsRef.current(currentTime, duration);
    }
  }, [currentTime, duration]);

  // Activer l'écoute temps réel YouTube IFrame API (pour recevoir currentTime et duration via infoDelivery)
  const registerYouTubeTimeListener = useCallback(
    (ifr: HTMLIFrameElement | null) => {
      if (!ifr || !ifr.contentWindow) return;
      try {
        ifr.contentWindow.postMessage(
          JSON.stringify({
            event: "listening",
            id: video.id || 1,
            channel: "widget",
          }),
          "*"
        );
        ifr.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "addEventListener",
            args: ["onStateChange"],
          }),
          "*"
        );
      } catch {
        // Ignore cross-origin errors
      }
    },
    [video.id]
  );

  // Se déplacer à une seconde précise dans la vidéo (quel que soit le moteur actif, sans recharger l'iframe)
  const seekToSeconds = useCallback(
    (targetSec: number) => {
      const clamped = Math.max(
        0,
        Math.min(Math.max(duration, targetSec), targetSec)
      );
      setCurrentTime(clamped);
      setScrubValue(clamped);
      if (onTimeUpdateSeconds) {
        onTimeUpdateSeconds(clamped, duration);
      }

      if (html5VideoRef.current) {
        try {
          html5VideoRef.current.currentTime = clamped;
        } catch {
          // ignore
        }
      }

      const sendSeekToIframe = (ifr: HTMLIFrameElement | null) => {
        if (!ifr || !ifr.contentWindow) return;
        try {
          ifr.contentWindow.postMessage(
            JSON.stringify({
              event: "command",
              func: "seekTo",
              args: [Math.floor(clamped), true],
            }),
            "*"
          );
        } catch {
          // ignore
        }
      };

      sendSeekToIframe(iframeRef.current);

      if (playerContainerRef.current) {
        playerContainerRef.current
          .querySelectorAll("video, youtube-video, tiktok-video")
          .forEach((el) => {
            const mediaEl = el as HTMLVideoElement & {
              shadowRoot?: ShadowRoot | null;
            };
            try {
              if ("currentTime" in mediaEl) {
                mediaEl.currentTime = clamped;
              }
            } catch {
              // ignore
            }
            if (mediaEl.shadowRoot) {
              mediaEl.shadowRoot
                .querySelectorAll("video")
                .forEach((innerVid) => {
                  try {
                    (innerVid as HTMLVideoElement).currentTime = clamped;
                  } catch {
                    // ignore
                  }
                });
              mediaEl.shadowRoot
                .querySelectorAll("iframe")
                .forEach((innerIfr) =>
                  sendSeekToIframe(innerIfr as HTMLIFrameElement)
                );
            }
          });

        playerContainerRef.current
          .querySelectorAll("iframe")
          .forEach((ifr) => sendSeekToIframe(ifr as HTMLIFrameElement));
      }
    },
    [duration, onTimeUpdateSeconds]
  );

  // Basculer Lecture / Pause directement depuis la barre de progression
  const togglePlayPauseInternal = useCallback(() => {
    setIsPlayingInternal((prev) => {
      const next = !prev;
      if (html5VideoRef.current) {
        try {
          if (next) {
            html5VideoRef.current.play().catch(() => {});
          } else {
            html5VideoRef.current.pause();
          }
        } catch {
          // ignore
        }
      }

      const sendPlayStateToIframe = (ifr: HTMLIFrameElement | null) => {
        if (!ifr || !ifr.contentWindow) return;
        try {
          ifr.contentWindow.postMessage(
            JSON.stringify({
              event: "command",
              func: next ? "playVideo" : "pauseVideo",
              args: [],
            }),
            "*"
          );
        } catch {
          // ignore
        }
      };

      sendPlayStateToIframe(iframeRef.current);

      if (playerContainerRef.current) {
        playerContainerRef.current.querySelectorAll("video").forEach((v) => {
          try {
            if (next) (v as HTMLVideoElement).play().catch(() => {});
            else (v as HTMLVideoElement).pause();
          } catch {
            // ignore
          }
        });
        playerContainerRef.current
          .querySelectorAll("iframe")
          .forEach((ifr) => sendPlayStateToIframe(ifr as HTMLIFrameElement));
      }
      return next;
    });
  }, []);

  // Garantir que le son est immédiatement actif (volume 100%, non-muet) dès le lancement de la lecture
  const enforceAudioUnmuted = useCallback(() => {
    if (muted) return;

    if (html5VideoRef.current) {
      html5VideoRef.current.muted = false;
      html5VideoRef.current.volume = 1.0;
    }

    const sendUnmuteToIframe = (ifr: HTMLIFrameElement | null) => {
      if (!ifr || !ifr.contentWindow) return;
      try {
        ifr.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "unMute", args: [] }),
          "*"
        );
        ifr.contentWindow.postMessage(
          JSON.stringify({ event: "command", func: "setVolume", args: [100] }),
          "*"
        );
      } catch {
        // Ignore cross-origin errors
      }
    };

    sendUnmuteToIframe(iframeRef.current);

    if (playerContainerRef.current) {
      const mediaElements = playerContainerRef.current.querySelectorAll(
        "video, audio, youtube-video, tiktok-video"
      );
      mediaElements.forEach((el) => {
        const anyMedia = el as HTMLVideoElement & {
          shadowRoot?: ShadowRoot | null;
        };
        try {
          if ("muted" in anyMedia) anyMedia.muted = false;
          if ("volume" in anyMedia) anyMedia.volume = 1.0;
        } catch {
          // ignore
        }
        if (anyMedia.shadowRoot) {
          anyMedia.shadowRoot
            .querySelectorAll("iframe")
            .forEach((innerIframe) =>
              sendUnmuteToIframe(innerIframe as HTMLIFrameElement)
            );
          anyMedia.shadowRoot.querySelectorAll("video").forEach((innerVid) => {
            try {
              (innerVid as HTMLVideoElement).muted = false;
              (innerVid as HTMLVideoElement).volume = 1.0;
            } catch {
              // ignore
            }
          });
        }
      });

      playerContainerRef.current
        .querySelectorAll("iframe")
        .forEach((ifr) => sendUnmuteToIframe(ifr as HTMLIFrameElement));
    }
  }, [muted]);

  useEffect(() => {
    if (muted || !playing) return;
    enforceAudioUnmuted();
    const t1 = window.setTimeout(enforceAudioUnmuted, 180);
    const t2 = window.setTimeout(enforceAudioUnmuted, 550);
    const t3 = window.setTimeout(enforceAudioUnmuted, 1100);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [muted, playing, isReady, engineMode, video.id, enforceAudioUnmuted]);

  // Charger un éventuel Blob MP4 local depuis IndexedDB ou extraire le MP4 via /api/orbit/extract-video
  useEffect(() => {
    let cancelled = false;

    if (video.id) {
      OrbitStorageService.loadLocalVideoBlobUrl(video.id).then((blobUrl) => {
        if (!cancelled && blobUrl) {
          setResolvedMp4Url(blobUrl);
          setEngineMode("mp4-direct");
        }
      });
    }

    if (video.mp4Url) {
      setResolvedMp4Url(sanitizeMp4Url(video.mp4Url));
    }

    if (
      !video.mp4Url?.startsWith("blob:") &&
      (detectedPlatform === "facebook" ||
        detectedPlatform === "tiktok" ||
        detectedPlatform === "instagram") &&
      hasRealNativeSocialUrl
    ) {
      setIsExtractingMp4(true);
      fetch(`/api/orbit/extract-video?url=${encodeURIComponent(rawUrl)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          if (data.resolvedUrl && typeof data.resolvedUrl === "string") {
            setResolvedCanonicalUrl(data.resolvedUrl);
          }
          if (data.streamMp4Url && data.directExtracted) {
            setResolvedMp4Url(data.streamMp4Url);
            setEngineMode("mp4-direct");
          } else if (
            data.streamMp4Url &&
            (rawLower.includes("/share/r/") ||
              rawLower.includes("/share/v/") ||
              rawLower.includes("/share/"))
          ) {
            setResolvedMp4Url(data.streamMp4Url);
            setEngineMode("mp4-direct");
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setIsExtractingMp4(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    video.id,
    video.mp4Url,
    detectedPlatform,
    hasRealNativeSocialUrl,
    rawUrl,
    rawLower,
  ]);

  // Permet à l'utilisateur d'associer un fichier .MP4 téléchargé sur son appareil directement depuis le lecteur
  const handleInlineMp4Upload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const vidId = video.id || Date.now();
    const blobUrl = await OrbitStorageService.saveLocalVideoBlob(vidId, file);
    setResolvedMp4Url(blobUrl);
    setErrorDiagnostic(null);
    setEngineMode("mp4-direct");
    setIsReady(true);
  };

  // URL cible passée à ReactPlayer (stable pour permettre le seek fluide sans recharger le composant)
  const reactPlayerSrc = useMemo(() => {
    if (
      (detectedPlatform === "facebook" ||
        detectedPlatform === "tiktok" ||
        detectedPlatform === "instagram" ||
        detectedPlatform === "twitch") &&
      hasRealNativeSocialUrl
    ) {
      return detectedPlatform === "facebook"
        ? normalizeFacebookUrl(resolvedCanonicalUrl || rawUrl)
        : resolvedCanonicalUrl || rawUrl;
    }
    if (validYoutubeId) {
      const initSec = initialStartRef.current;
      return `https://www.youtube.com/watch?v=${validYoutubeId}${
        initSec > 0 ? `&t=${initSec}s` : ""
      }`;
    }
    return rawUrl || "https://www.youtube.com/watch?v=aircAruvnKk";
  }, [
    detectedPlatform,
    rawUrl,
    resolvedCanonicalUrl,
    hasRealNativeSocialUrl,
    validYoutubeId,
  ]);

  // URL d'intégration iframe directe (stable pour permettre le seek via postMessage sans recharger l'iframe)
  const nativeIframeSrc = useMemo(() => {
    if (detectedPlatform === "facebook" && hasRealNativeSocialUrl) {
      const cleanFb = normalizeFacebookUrl(resolvedCanonicalUrl || rawUrl);
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
        cleanFb
      )}&show_text=false&autoplay=true&mute=${muted ? 1 : 0}`;
    }
    if (detectedPlatform === "tiktok" && hasRealNativeSocialUrl) {
      const m = (resolvedCanonicalUrl || rawUrl).match(/\/video\/(\d+)/);
      if (m && m[1]) {
        return `https://www.tiktok.com/embed/v2/${m[1]}`;
      }
    }
    if (detectedPlatform === "instagram" && hasRealNativeSocialUrl) {
      const m = (resolvedCanonicalUrl || rawUrl).match(
        /instagram\.com\/(reel|p|tv)\/([A-Za-z0-9_-]+)/i
      );
      if (m && m[2]) {
        return `https://www.instagram.com/${m[1]}/${m[2]}/embed`;
      }
    }
    const ytTarget = validYoutubeId || "aircAruvnKk";
    const initSec = initialStartRef.current;
    return `https://www.youtube-nocookie.com/embed/${ytTarget}?autoplay=1&mute=${
      muted ? 1 : 0
    }&controls=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1${
      initSec > 0 ? `&start=${initSec}` : ""
    }${loop ? `&loop=1&playlist=${ytTarget}` : ""}`;
  }, [
    detectedPlatform,
    rawUrl,
    resolvedCanonicalUrl,
    hasRealNativeSocialUrl,
    validYoutubeId,
    muted,
    loop,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === " " || e.key.toLowerCase() === "k") {
        e.preventDefault();
        togglePlayPauseInternal();
        wakeUpControls();
      } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "j") {
        e.preventDefault();
        seekToSeconds(Math.max(0, currentTime - 10));
        wakeUpControls();
      } else if (e.key === "ArrowRight" || e.key.toLowerCase() === "l") {
        e.preventDefault();
        seekToSeconds(Math.min(duration, currentTime + 10));
        wakeUpControls();
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        if (playerContainerRef.current) {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          } else {
            playerContainerRef.current.requestFullscreen().catch(() => {});
          }
        }
      } else if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        const pct = Number(e.key) * 0.1;
        seekToSeconds(Math.floor(duration * pct));
        wakeUpControls();
      }
    },
    [togglePlayPauseInternal, seekToSeconds, currentTime, duration, wakeUpControls]
  );

  // URL externe officielle pour ouvrir dans l'application / onglet natif
  const externalSourceUrl = useMemo(() => {
    if (rawUrl && rawUrl.startsWith("http")) {
      return rawUrl;
    }
    if (validYoutubeId) {
      return `https://www.youtube.com/watch?v=${validYoutubeId}`;
    }
    return "https://www.youtube.com";
  }, [rawUrl, validYoutubeId]);

  // Réinitialiser l'état lors du changement de vidéo avec reprise intelligente de lecture
  useEffect(() => {
    const savedProg =
      video.id && (!startAtSeconds || startAtSeconds === 0)
        ? OrbitStorageService.getVideoProgress(video.id)
        : 0;
    const effectiveStart = startAtSeconds || savedProg;

    initialStartRef.current = effectiveStart;
    hasLiveTimeRef.current = false;
    setIsReady(false);
    setErrorDiagnostic(null);
    setRetriedWithFallback(false);
    setEngineMode(initialEngineMode);
    setCurrentTime(effectiveStart);
    setScrubValue(effectiveStart);
    setDuration(Math.max(60, (video.durationMinutes || 4) * 60));

    if (savedProg > 4 && (!startAtSeconds || startAtSeconds === 0)) {
      setResumeNotice(`Reprise à ${formatPlayerTime(savedProg)}`);
      if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = window.setTimeout(() => {
        setResumeNotice(null);
      }, 3800);
    } else {
      setResumeNotice(null);
    }
  }, [
    video.id,
    rawUrl,
    video.youtubeId,
    initialEngineMode,
    video.durationMinutes,
    startAtSeconds,
  ]);

  // Si le parent demande un saut temporel (ex: clic sur un Moment Fort), se déplacer dans la vidéo sans recharger
  useEffect(() => {
    if (startAtSeconds > 0 && Math.abs(startAtSeconds - currentTime) > 1.5) {
      seekToSeconds(startAtSeconds);
    }
  }, [startAtSeconds]);

  // Compteur de progression de secours (1s) lorsque le lecteur embarqué n'émet pas d'événements timeupdate natifs
  useEffect(() => {
    if (!isPlayingInternal || isScrubbing) return;
    const timer = window.setInterval(() => {
      if (hasLiveTimeRef.current && engineMode === "mp4-direct") return;
      setCurrentTime((prev) => {
        const next = prev + 1;
        const maxDur = Math.max(60, duration);
        return next >= maxDur ? (loop ? 0 : maxDur) : next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPlayingInternal, isScrubbing, engineMode, duration, loop]);

  // Gestionnaire centralisé d'erreur par plateforme
  const handleTriggerPlatformError = useCallback(
    (code?: string) => {
      if (resolvedMp4Url && engineMode !== "mp4-direct") {
        setEngineMode("mp4-direct");
        return;
      }
      if (!retriedWithFallback && engineMode === "react-player") {
        setRetriedWithFallback(true);
        if (
          (detectedPlatform === "tiktok" ||
            detectedPlatform === "instagram" ||
            detectedPlatform === "facebook") &&
          validYoutubeId
        ) {
          setEngineMode("fallback-stream");
          return;
        }
        setEngineMode("native-iframe");
        return;
      }

      const diag = buildPlatformDiagnostic(
        detectedPlatform,
        code,
        Boolean(validYoutubeId)
      );
      setErrorDiagnostic(diag);
      if (onError) {
        onError(diag);
      }

      if (
        autoRemoveOnFatalError &&
        (code === "100" || code === "101" || code === "150") &&
        video.id &&
        onRemoveUnavailableVideo
      ) {
        onRemoveUnavailableVideo(
          video.id,
          `Vidéo ${detectedPlatform.toUpperCase()} non intégrable ou supprimée (Code ${code})`
        );
      }
    },
    [
      resolvedMp4Url,
      retriedWithFallback,
      engineMode,
      detectedPlatform,
      validYoutubeId,
      onError,
      autoRemoveOnFatalError,
      video.id,
      onRemoveUnavailableVideo,
    ]
  );

  // Écoute des événements postMessage (infoDelivery pour temps/durée + onError codes 100, 101, 150)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed && parsed.event === "infoDelivery" && parsed.info) {
          if (
            typeof parsed.info.duration === "number" &&
            parsed.info.duration > 0
          ) {
            setDuration(parsed.info.duration);
          }
          if (typeof parsed.info.currentTime === "number") {
            hasLiveTimeRef.current = true;
            if (!isScrubbing) {
              setCurrentTime(parsed.info.currentTime);
              setScrubValue(parsed.info.currentTime);
              if (onTimeUpdateSeconds) {
                onTimeUpdateSeconds(
                  parsed.info.currentTime,
                  parsed.info.duration || duration
                );
              }
              if (video.id) {
                OrbitStorageService.saveVideoProgress(
                  video.id,
                  video.title,
                  parsed.info.currentTime,
                  parsed.info.duration || duration,
                  video.thumb
                );
              }
            }
          }
          if (typeof parsed.info.playerState === "number") {
            if (parsed.info.playerState === 1) setIsPlayingInternal(true);
            else if (parsed.info.playerState === 2) setIsPlayingInternal(false);
          }
        }
        if (parsed && parsed.event === "onError" && parsed.info) {
          const errCode = String(parsed.info);
          if (
            errCode === "100" ||
            errCode === "101" ||
            errCode === "150" ||
            errCode === "2"
          ) {
            handleTriggerPlatformError(errCode);
          }
        }
      } catch {
        // Ignorer les messages non-JSON
      }
    };

    const handleCustomYtError = (event: Event) => {
      const customEvt = event as CustomEvent<{ code?: string }>;
      const errCode = customEvt.detail?.code || "150";
      handleTriggerPlatformError(errCode);
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("orbit-yt-player-error", handleCustomYtError);
    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("orbit-yt-player-error", handleCustomYtError);
    };
  }, [handleTriggerPlatformError, isScrubbing, duration, onTimeUpdateSeconds]);

  // Vérification proactive de disponibilité YouTube (miniature 120px = vidéo supprimée)
  useEffect(() => {
    if (detectedPlatform !== "youtube" || !validYoutubeId) return;
    let cancelled = false;
    const probeImg = new Image();
    probeImg.referrerPolicy = "no-referrer";
    probeImg.onload = () => {
      if (cancelled) return;
      if (probeImg.naturalWidth === 120) {
        handleTriggerPlatformError("100");
      }
    };
    probeImg.src = `https://i.ytimg.com/vi/${validYoutubeId}/mqdefault.jpg`;
    return () => {
      cancelled = true;
    };
  }, [detectedPlatform, validYoutubeId, handleTriggerPlatformError]);

  const resolvedCover = useMemo(() => {
    if (
      detectedPlatform === "facebook" &&
      (!video.thumb || video.thumb.includes("aircAruvnKk"))
    ) {
      return createPlatformCoverSvg("facebook", video.title, rawUrl);
    }
    if (video.thumb) return video.thumb;
    if (validYoutubeId) {
      return `https://i.ytimg.com/vi/${validYoutubeId}/hqdefault.jpg`;
    }
    return createPlatformCoverSvg(detectedPlatform, video.title, rawUrl);
  }, [detectedPlatform, video.thumb, video.title, rawUrl, validYoutubeId]);

  const platformBadgeColors: Record<SupportedPlatform, string> = {
    youtube: "bg-red-500/25 text-red-200 border-red-400/50",
    facebook: "bg-blue-600/30 text-blue-200 border-blue-400/50",
    tiktok: "bg-cyan-500/25 text-cyan-200 border-cyan-400/50",
    instagram: "bg-pink-500/25 text-pink-200 border-pink-400/50",
    twitch: "bg-purple-500/25 text-purple-200 border-purple-400/50",
  };

  const platformDisplayNames: Record<SupportedPlatform, string> = {
    youtube: "YOUTUBE HD",
    facebook: "FACEBOOK REEL / MP4",
    tiktok: "TIKTOK 9:16",
    instagram: "INSTAGRAM REEL",
    twitch: "TWITCH LIVE",
  };

  const effectiveMp4Src =
    resolvedMp4Url ||
    (detectedPlatform === "facebook" && rawUrl
      ? `/api/orbit/proxy-mp4?url=${encodeURIComponent(rawUrl)}`
      : `/api/orbit/proxy-mp4?url=${encodeURIComponent(
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
        )}`);

  const downloadMp4Href = resolvedMp4Url.startsWith("blob:")
    ? resolvedMp4Url
    : resolvedMp4Url.includes("/api/orbit/proxy-mp4")
    ? `${resolvedMp4Url}&download=1`
    : `/api/orbit/proxy-mp4?url=${encodeURIComponent(
        resolvedMp4Url || rawUrl
      )}&download=1`;

  return (
    <div
      ref={playerContainerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={wakeUpControls}
      onMouseEnter={wakeUpControls}
      onPointerDown={wakeUpControls}
      onTouchStart={wakeUpControls}
      onMouseLeave={() => {
        if (!isScrubbing && isPlayingInternal) {
          if (controlsIdleTimerRef.current) {
            window.clearTimeout(controlsIdleTimerRef.current);
          }
          setIsControlsActive(false);
        }
      }}
      className={`relative w-full h-full bg-black overflow-hidden select-none flex flex-col focus:outline-none ${className}`}
    >
      {/* Input caché permettant d'importer un fichier .MP4 téléchargé directement dans ce post */}
      <input
        ref={localMp4InputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,video/*"
        onChange={handleInlineMp4Upload}
        className="hidden"
      />

      {/* =====================================================================
          ZONE VIDÉO PRINCIPALE PLEIN CADRE (SANS SUPERPOSITION PERMANENTE)
          ===================================================================== */}
      <div className="relative flex-1 min-h-0 w-full h-full bg-black">
        {/* Toast de reprise automatique de lecture */}
        {resumeNotice && (
          <div
            className="absolute top-3 right-3 z-35 px-3 py-1.5 rounded-xl bg-black/85 backdrop-blur-md border border-cyan-400/40 text-[11px] font-bold text-white shadow-xl flex items-center gap-2 animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-cyan-300">⏱️ {resumeNotice}</span>
            <button
              type="button"
              onClick={() => {
                seekToSeconds(0);
                setResumeNotice(null);
              }}
              className="px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 text-[10px] font-bold text-white/90 cursor-pointer"
              title="Reprendre depuis le début"
            >
              Recommencer
            </button>
          </div>
        )}
        {/* Badge compact en haut à gauche, masqué automatiquement pendant la lecture */}
        {showTopBar && !hideCustomSeekBar && (
          <div
            className={`absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 transition-opacity duration-300 ${
              showControlsOverlay
                ? "opacity-100 pointer-events-auto"
                : "opacity-0 pointer-events-none"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase border backdrop-blur-md inline-flex items-center gap-1 shadow-md ${
                platformBadgeColors[detectedPlatform] ||
                platformBadgeColors.youtube
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>
                {engineMode === "mp4-direct"
                  ? "MP4 NATIF"
                  : platformDisplayNames[detectedPlatform] ||
                    embedConfig.platformLabel}
              </span>
            </span>

            {onCloseInline && (
              <button
                type="button"
                onClick={onCloseInline}
                className="px-2 py-0.5 rounded-md bg-black/85 hover:bg-black border border-white/25 text-[9px] font-bold text-white/90 cursor-pointer backdrop-blur-md shadow-md"
                title="Revenir à la miniature"
              >
                Vignette
              </button>
            )}
          </div>
        )}

        {/* Zone capteuse discrète en bas de l'écran pour réveiller la barre de progression au survol ou au toucher */}
        {!hideCustomSeekBar && !showControlsOverlay && !errorDiagnostic && (
          <div
            onMouseEnter={wakeUpControls}
            onMouseMove={wakeUpControls}
            onPointerDown={wakeUpControls}
            onTouchStart={wakeUpControls}
            className="absolute inset-x-0 bottom-0 h-10 z-25"
          />
        )}

        {/* ÉTAT D'ERREUR DE LECTURE PAR PLATEFORME (DIAGNOSTIC + SOLUTIONS MP4) */}
        {errorDiagnostic ? (
          <div
            className="relative w-full h-full flex flex-col items-center justify-center p-4 sm:p-6 text-center z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={resolvedCover}
              alt={video.title}
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm pointer-events-none"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/85 to-black/95 pointer-events-none" />

            <div className="relative z-10 max-w-md space-y-2.5 p-4 rounded-2xl bg-white/[0.04] border border-white/15 backdrop-blur-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-400/35">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Diagnostic {errorDiagnostic.platform.toUpperCase()} ·{" "}
                  {errorDiagnostic.code}
                </span>
              </div>

              <h4 className="text-xs sm:text-sm font-extrabold text-white leading-snug">
                {errorDiagnostic.title}
              </h4>

              <p className="text-[11px] text-white/70 leading-relaxed">
                {errorDiagnostic.reason}
              </p>

              <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setErrorDiagnostic(null);
                    setEngineMode("mp4-direct");
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-[11px] font-extrabold bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer inline-flex items-center gap-1.5 shadow-lg"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Lire en MP4 Direct</span>
                </button>

                <button
                  type="button"
                  onClick={() => localMp4InputRef.current?.click()}
                  className="px-3.5 py-1.5 rounded-xl text-[11px] font-extrabold bg-purple-600 hover:bg-purple-500 text-white cursor-pointer inline-flex items-center gap-1.5 shadow-lg"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importer mon .MP4 téléchargé</span>
                </button>

                {errorDiagnostic.canRetryWithNativeEmbed && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorDiagnostic(null);
                      setEngineMode("native-iframe");
                    }}
                    className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Forcer Lecteur Compatible</span>
                  </button>
                )}

                <a
                  href={externalSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-xl text-[11px] font-extrabold text-black bg-cyan-300 hover:bg-cyan-200 inline-flex items-center gap-1.5 shadow-lg"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>{embedConfig.externalActionLabel}</span>
                </a>
              </div>
            </div>
          </div>
        ) : engineMode === "mp4-direct" ? (
          /* MOTEUR 0 : HTML5 VIDEO NATIF (sans barre native doublon) */
          <div
            className="relative w-full h-full bg-black flex items-center justify-center cursor-pointer"
            onClick={() => {
              wakeUpControls();
              togglePlayPauseInternal();
            }}
          >
            <video
              ref={html5VideoRef}
              key={`mp4-${video.id || rawUrl}-${effectiveMp4Src}`}
              src={effectiveMp4Src}
              poster={resolvedCover}
              autoPlay={playing}
              muted={muted}
              controls={false}
              loop={loop}
              playsInline
              onLoadedMetadata={(e) => {
                if (
                  e.currentTarget.duration &&
                  Number.isFinite(e.currentTarget.duration) &&
                  e.currentTarget.duration > 0
                ) {
                  setDuration(e.currentTarget.duration);
                }
                if (initialStartRef.current > 0) {
                  try {
                    e.currentTarget.currentTime = initialStartRef.current;
                  } catch {
                    // ignore
                  }
                }
                if (!muted) {
                  e.currentTarget.muted = false;
                  e.currentTarget.volume = 1.0;
                }
              }}
              onDurationChange={(e) => {
                if (
                  e.currentTarget.duration &&
                  Number.isFinite(e.currentTarget.duration) &&
                  e.currentTarget.duration > 0
                ) {
                  setDuration(e.currentTarget.duration);
                }
              }}
              onTimeUpdate={(e) => {
                hasLiveTimeRef.current = true;
                const ct = e.currentTarget.currentTime;
                const dur =
                  e.currentTarget.duration &&
                  Number.isFinite(e.currentTarget.duration)
                    ? e.currentTarget.duration
                    : duration;
                if (!isScrubbing) {
                  setCurrentTime(ct);
                  setScrubValue(ct);
                }
                if (onTimeUpdateSeconds) {
                  onTimeUpdateSeconds(ct, dur);
                }
                if (video.id) {
                  OrbitStorageService.saveVideoProgress(
                    video.id,
                    video.title,
                    ct,
                    dur,
                    video.thumb
                  );
                }
              }}
              onLoadedData={(e) => {
                if (!muted) {
                  e.currentTarget.muted = false;
                  e.currentTarget.volume = 1.0;
                }
                setIsReady(true);
                enforceAudioUnmuted();
                if (onReady) onReady();
              }}
              onCanPlay={(e) => {
                if (!muted) {
                  e.currentTarget.muted = false;
                  e.currentTarget.volume = 1.0;
                }
                setIsReady(true);
                enforceAudioUnmuted();
              }}
              onPlay={(e) => {
                setIsPlayingInternal(true);
                if (!muted) {
                  e.currentTarget.muted = false;
                  e.currentTarget.volume = 1.0;
                }
                enforceAudioUnmuted();
              }}
              onPause={() => {
                setIsPlayingInternal(false);
              }}
              onError={() => {
                if (
                  html5VideoRef.current &&
                  !html5VideoRef.current.src.includes("ForBiggerBlazes")
                ) {
                  html5VideoRef.current.src =
                    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
                }
              }}
              className="w-full h-full object-contain bg-black"
            />
          </div>
        ) : engineMode === "react-player" ? (
          /* MOTEUR 1 : REACT-PLAYER UNIFIÉ */
          <div className="relative w-full h-full bg-black">
            {!isReady && (
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs gap-2">
                <Loader2 className="w-6 h-6 text-cyan-300 animate-spin" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/75">
                  Initialisation ReactPlayer ({detectedPlatform.toUpperCase()})...
                </span>
              </div>
            )}

            <ReactPlayer
              key={`rp-${video.id || rawUrl}-${reactPlayerSrc}`}
              src={reactPlayerSrc}
              playing={isPlayingInternal}
              muted={muted}
              volume={1}
              controls={false}
              loop={loop}
              playsInline
              width="100%"
              height="100%"
              style={{ width: "100%", height: "100%", backgroundColor: "#000" }}
              config={{
                youtube: {
                  rel: 0,
                  hl: "fr",
                  start:
                    initialStartRef.current > 0
                      ? initialStartRef.current
                      : undefined,
                },
              }}
              onReady={() => {
                setIsReady(true);
                enforceAudioUnmuted();
                if (onReady) onReady();
              }}
              onStart={() => {
                setIsReady(true);
                enforceAudioUnmuted();
              }}
              onPlay={() => {
                setIsPlayingInternal(true);
                setIsReady(true);
                enforceAudioUnmuted();
              }}
              onPause={() => {
                setIsPlayingInternal(false);
              }}
              onError={() => {
                handleTriggerPlatformError("PLAYER_LOAD_ERROR");
              }}
            />
          </div>
        ) : (
          /* MOTEUR 2 : IFRAME NATIF / NOCOOKIE */
          <iframe
            ref={iframeRef}
            key={`iframe-${video.id || rawUrl}-${engineMode}`}
            width="100%"
            height="100%"
            src={
              engineMode === "fallback-stream" && validYoutubeId
                ? `https://www.youtube-nocookie.com/embed/${validYoutubeId}?autoplay=1&mute=${
                    muted ? 1 : 0
                  }&controls=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`
                : nativeIframeSrc
            }
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={() => {
              setIsReady(true);
              enforceAudioUnmuted();
              registerYouTubeTimeListener(iframeRef.current);
              window.setTimeout(
                () => registerYouTubeTimeListener(iframeRef.current),
                600
              );
              if (onReady) onReady();
            }}
            onError={() => {
              handleTriggerPlatformError("IFRAME_LOAD_ERROR");
            }}
            className="w-full h-full bg-black border-0"
          />
        )}

        {/* ===================================================================
            OVERLAY BAS AUTO-MASQUÉ (SEEK BAR UNIQUE + BARRE D'OUTILS)
            Masqué automatiquement pendant la lecture quand on ne l'utilise pas
            =================================================================== */}
        {!hideCustomSeekBar && !errorDiagnostic && (
          <div
            className={`absolute inset-x-0 bottom-0 z-30 flex flex-col transition-all duration-300 ${
              showControlsOverlay
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-2 pointer-events-none"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              wakeUpControls();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              wakeUpControls();
            }}
          >
            {/* Barre de navigation temporelle unique (-10s / Curseur / +10s / Temps) */}
            <div className="w-full px-2.5 py-1.5 bg-gradient-to-t from-[#060911]/95 via-[#060911]/90 to-black/40 backdrop-blur-md border-t border-white/10 flex items-center gap-2">
              {/* Bouton Lecture / Pause */}
              <button
                type="button"
                onClick={togglePlayPauseInternal}
                className="w-6 h-6 rounded-md bg-white/[0.08] hover:bg-white/15 border border-white/15 flex items-center justify-center text-white cursor-pointer shrink-0 transition-colors"
                title={
                  isPlayingInternal
                    ? "Mettre en pause"
                    : "Reprendre la lecture"
                }
              >
                {isPlayingInternal ? (
                  <Pause className="w-3 h-3" />
                ) : (
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                )}
              </button>

              {/* Reculer de 10 secondes (-10s) */}
              <button
                type="button"
                onClick={() => {
                  wakeUpControls();
                  seekToSeconds(Math.max(0, currentTime - 10));
                }}
                className="px-1.5 h-6 rounded-md bg-white/[0.06] hover:bg-white/15 border border-white/10 text-[10px] font-mono-num font-bold text-white/85 hover:text-white inline-flex items-center gap-0.5 cursor-pointer shrink-0 transition-colors"
                title="Reculer de 10 secondes (-10s)"
              >
                <RotateCcw className="w-2.5 h-2.5 text-cyan-300" />
                <span>-10s</span>
              </button>

              {/* Curseur interactif de déplacement dans la vidéo */}
              <div className="relative flex-1 flex items-center min-w-[80px]">
                <input
                  type="range"
                  min={0}
                  max={Math.max(1, Math.floor(duration))}
                  step={1}
                  value={Math.min(
                    Math.max(1, Math.floor(duration)),
                    Math.floor(isScrubbing ? scrubValue : currentTime)
                  )}
                  onPointerDown={() => {
                    wakeUpControls();
                    setIsScrubbing(true);
                    setScrubValue(currentTime);
                  }}
                  onChange={(e) => {
                    wakeUpControls();
                    const nextSec = Number(e.target.value);
                    setScrubValue(nextSec);
                    seekToSeconds(nextSec);
                  }}
                  onPointerUp={(e) => {
                    const nextSec = Number(
                      (e.currentTarget as HTMLInputElement).value
                    );
                    setIsScrubbing(false);
                    seekToSeconds(nextSec);
                    wakeUpControls();
                  }}
                  onKeyDown={(e) => {
                    wakeUpControls();
                    if (e.key === "ArrowLeft") {
                      e.preventDefault();
                      seekToSeconds(Math.max(0, currentTime - 5));
                    } else if (e.key === "ArrowRight") {
                      e.preventDefault();
                      seekToSeconds(Math.min(duration, currentTime + 5));
                    }
                  }}
                  aria-label="Se déplacer dans la vidéo"
                  title="Glisser pour avancer ou reculer dans la vidéo"
                  className="orbit-slider w-full cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #38bdf8 0%, #b4f82a ${Math.min(
                      100,
                      Math.max(
                        0,
                        ((isScrubbing ? scrubValue : currentTime) /
                          Math.max(1, duration)) *
                          100
                      )
                    )}%, rgba(148, 163, 184, 0.28) ${Math.min(
                      100,
                      Math.max(
                        0,
                        ((isScrubbing ? scrubValue : currentTime) /
                          Math.max(1, duration)) *
                          100
                      )
                    )}%, rgba(148, 163, 184, 0.28) 100%)`,
                  }}
                />
              </div>

              {/* Avancer de 10 secondes (+10s) */}
              <button
                type="button"
                onClick={() => {
                  wakeUpControls();
                  seekToSeconds(Math.min(duration, currentTime + 10));
                }}
                className="px-1.5 h-6 rounded-md bg-white/[0.06] hover:bg-white/15 border border-white/10 text-[10px] font-mono-num font-bold text-white/85 hover:text-white inline-flex items-center gap-0.5 cursor-pointer shrink-0 transition-colors"
                title="Avancer de 10 secondes (+10s)"
              >
                <span>+10s</span>
                <RotateCw className="w-2.5 h-2.5 text-cyan-300" />
              </button>

              {/* Affichage Temps écoulé / Durée totale */}
              <span className="text-[10px] font-mono-num font-bold text-white/85 whitespace-nowrap shrink-0">
                <span className="text-cyan-300">
                  {formatPlayerTime(isScrubbing ? scrubValue : currentTime)}
                </span>
                <span className="text-white/40 mx-0.5">/</span>
                <span className="text-white/65">
                  {formatPlayerTime(duration)}
                </span>
              </span>

              {/* Sélecteur de vitesse de lecture */}
              <button
                type="button"
                onClick={handleCyclePlaybackRate}
                className="px-1.5 h-6 rounded-md bg-white/[0.08] hover:bg-white/20 border border-white/15 text-[10px] font-mono-num font-bold text-cyan-300 inline-flex items-center gap-1 cursor-pointer shrink-0 transition-colors"
                title="Changer la vitesse de lecture (0.75x, 1x, 1.25x, 1.5x, 2x)"
              >
                <Gauge className="w-2.5 h-2.5" />
                <span>{playbackRate}x</span>
              </button>
            </div>

            {/* Barre d'outils moteur/MP4 également masquée quand on ne l'utilise pas */}
            {showTopBar && (
              <div className="w-full px-2.5 py-1 bg-[#090c15]/95 border-t border-white/10 flex items-center justify-between gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      wakeUpControls();
                      setErrorDiagnostic(null);
                      setEngineMode((prev) =>
                        prev === "mp4-direct"
                          ? "react-player"
                          : prev === "react-player"
                          ? "native-iframe"
                          : prev === "native-iframe" && validYoutubeId
                          ? "fallback-stream"
                          : "mp4-direct"
                      );
                    }}
                    className="px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/15 border border-white/15 text-[10px] font-bold text-white/90 inline-flex items-center gap-1 cursor-pointer transition-all shrink-0"
                    title="Changer de moteur de lecture (Lecteur MP4 Direct / ReactPlayer / Embed Natif)"
                  >
                    <Layers className="w-3 h-3 text-cyan-300" />
                    <span>
                      {engineMode === "mp4-direct"
                        ? "MP4 Direct"
                        : engineMode === "react-player"
                        ? "ReactPlayer"
                        : engineMode === "native-iframe"
                        ? "Embed Natif"
                        : "Flux Miroir HD"}
                    </span>
                  </button>

                  {(detectedPlatform === "facebook" ||
                    detectedPlatform === "tiktok" ||
                    detectedPlatform === "instagram" ||
                    engineMode === "mp4-direct") && (
                    <>
                      {engineMode !== "mp4-direct" && (
                        <button
                          type="button"
                          onClick={() => {
                            wakeUpControls();
                            setErrorDiagnostic(null);
                            setEngineMode("mp4-direct");
                          }}
                          className="px-2 py-0.5 rounded-md bg-emerald-600/90 hover:bg-emerald-500 border border-emerald-300/50 text-[10px] font-extrabold text-white inline-flex items-center gap-1 cursor-pointer shrink-0"
                          title="Contourner le blocage d'intégration Facebook/Instagram en lisant le flux MP4 direct"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>
                            {isExtractingMp4 ? "Extraction..." : "Lire en MP4"}
                          </span>
                        </button>
                      )}

                      <a
                        href={downloadMp4Href}
                        download={`orbit-${detectedPlatform}-${
                          video.id || "video"
                        }.mp4`}
                        className="px-2 py-0.5 rounded-md bg-cyan-500/90 hover:bg-cyan-400 text-[10px] font-extrabold text-black inline-flex items-center gap-1 cursor-pointer shrink-0"
                        title="Télécharger la vidéo en fichier .MP4 sur votre appareil"
                      >
                        <Download className="w-2.5 h-2.5" />
                        <span>Télécharger MP4</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => localMp4InputRef.current?.click()}
                        className="px-2 py-0.5 rounded-md bg-purple-600/90 hover:bg-purple-500 border border-purple-300/40 text-[10px] font-extrabold text-white inline-flex items-center gap-1 cursor-pointer shrink-0"
                        title="Associer un fichier .MP4 téléchargé depuis votre appareil pour ce post"
                      >
                        <Upload className="w-2.5 h-2.5" />
                        <span>Importer .MP4</span>
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={externalSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 rounded-md bg-white/[0.06] hover:bg-white/15 border border-white/15 text-[10px] font-bold text-cyan-300 inline-flex items-center gap-1 transition-all shrink-0"
                    title="Ouvrir directement sur la plateforme d'origine dans un nouvel onglet"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>{embedConfig.externalActionLabel}</span>
                  </a>

                  {onRemoveUnavailableVideo && video.id && (
                    <button
                      type="button"
                      onClick={() =>
                        onRemoveUnavailableVideo(
                          video.id!,
                          `Vidéo ${detectedPlatform.toUpperCase()} signalée indisponible et supprimée`
                        )
                      }
                      className="px-2 py-0.5 rounded-md bg-rose-950/90 hover:bg-rose-900 border border-rose-400/40 text-[10px] font-bold text-rose-200 inline-flex items-center gap-1 cursor-pointer shrink-0"
                      title="Supprimer immédiatement ce post si la vidéo est indisponible"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Supprimer</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
