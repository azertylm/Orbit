import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  DEFAULT_DOMAINS,
  DEFAULT_VIDEOS,
  DEFAULT_SOCIALS,
  DEFAULT_TWINS,
  DEFAULT_JUKEBOX,
  DEFAULT_CHALLENGES,
  MOOD_PRESETS,
  PANTHEON_ARCHIVE_ERAS,
  GEO_ZONE_PRESETS,
  DEFAULT_QUICK_IMPORTS,
  DEFAULT_PORTFOLIO_ITEMS,
  DEFAULT_CREATOR_LINKS,
  LIVE_REACTIONS,
  OrbitDomain,
  OrbitVideo,
  SocialConnector,
  CulturalTwin,
  OrbitProfile,
  JukeboxTrack,
  JukeboxChatMessage,
  WeeklyChallenge,
  MoodId,
  PantheonArchiveEra,
  GeoRadius,
  QuickImportBridgeItem,
  CreatorPortfolioItem,
  CreatorExternalLink,
  ReactionType,
  DebateStance,
  createPlatformCoverSvg,
  getVideoEmbedConfig,
} from "./data/orbitData";
import {
  OrbitStorageService,
  SyncMutation,
  CloudConnectorConfig,
  ServiceWorkerDiagnostics,
  OrbitUiProfilePreset,
} from "./services/storageAdapter";
import { VideoCard } from "./components/VideoCard";
import { VerticalFeed } from "./components/VerticalFeed";
import { PantheonBlindTest } from "./components/PantheonBlindTest";
import { AlphabetteDevOpsView } from "./components/AlphabetteDevOpsView";
import { ReglageEtImportationView } from "./components/ReglageEtImportationView";
import { CreatorPortfolioView } from "./components/CreatorPortfolioView";
import { PlaylistQrModal } from "./components/PlaylistQrModal";
import {
  ConsentAndAcquisitionModal,
  ImportedNetworkPayload,
} from "./components/ConsentAndAcquisitionModal";
import { OrbitVaultModal } from "./components/OrbitVaultModal";
import { PWAInstallButton, OfflineIndicator } from "./components/PWAInstallButton";
import {
  Zap,
  User,
  Trophy,
  Compass,
  Server,
  Search,
  Link2,
  Gift,
  Palette,
  Sparkles,
  Download,
  X,
  ExternalLink,
  Check,
  Copy,
  Trash2,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Edit3,
  Eye,
  EyeOff,
  Lock,
  Loader2,
  Plus,
  LayoutGrid,
  Smartphone,
  Film,
  Radio,
  Headphones,
  Clock,
  Hourglass,
  ShieldCheck,
  Database,
  Flame,
  ThumbsUp,
  Send,
  RefreshCw,
  Award,
  MapPin,
  ClipboardPaste,
  History,
  Layers,
  QrCode,
  Briefcase,
  Upload,
} from "lucide-react";

type PageId = "p1" | "p2" | "p3" | "p4" | "p5";
type FeedFilter = "all" | "friends" | "youtube" | "vertical" | "top95";
type FeedViewMode = "immersion" | "grid";
type ProfileTab = "wall" | "favs" | "secret" | "capsules";
type PantheonMode = "gravity" | "emerging" | "month" | "alltime";
type ThemeName = "onyx" | "alabaster" | "polar";

interface OrbitState {
  profile: OrbitProfile;
  theme: ThemeName;
  accent: string;
  domains: OrbitDomain[];
  videos: OrbitVideo[];
  socials: SocialConnector[];
  twins: CulturalTwin[];
  jukebox: JukeboxTrack[];
  challenges: WeeklyChallenge[];
  // Moteur de Consentement RGPD & Acquisition Réelle
  gdprConsentGiven?: boolean;
  // Fonctionnalité 11 : Panthéon Historique
  selectedArchiveEra?: PantheonArchiveEra;
  pantheonShowAllDomainsArchive?: boolean;
  // Fonctionnalité 12 : Mode Focus Absolu (Zéro Distraction)
  focusAbsolu?: boolean;
  // Fonctionnalité 13 : Radar Géolocalisé Privé
  radarGeoRadius?: GeoRadius;
  radarGeoZoneId?: string;
  // Fonctionnalité 14 : Panier Intelligent 'À regarder ce soir'
  watchLaterIds?: number[];
  // Fonctionnalité 15 : Passerelle d'Import Rapide Telegram / Discord / Presse-Papiers
  quickImports?: QuickImportBridgeItem[];
  // Fonctionnalité 16 : Mode 'Portfolio Créateur' sur la Page 2
  creatorPortfolioMode?: boolean;
  portfolioItems?: CreatorPortfolioItem[];
  creatorLinks?: CreatorExternalLink[];
  // Fonctionnalité 17 : Filtre Intelligent 'Anti-Déjà-Vu' (watchedVideoIds)
  watchedVideoIds?: number[];
  hideWatchedVideos?: boolean;
}

function parseVideoUrl(
  url: string,
  titleHint?: string
): {
  platform: OrbitVideo["platform"];
  ratio: OrbitVideo["ratio"];
  youtubeId: string;
  thumb: string;
} {
  let platform: OrbitVideo["platform"] = "youtube";
  let ratio: OrbitVideo["ratio"] = "16-9";
  let youtubeId = "aircAruvnKk";
  const lower = url.toLowerCase();

  const ytRegex =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i;
  const match = url.match(ytRegex);
  const hasRealYoutubeId = Boolean(match && match[1]);
  if (match && match[1]) {
    youtubeId = match[1];
  }

  if (
    lower.includes("facebook.com") ||
    lower.includes("fb.watch") ||
    lower.includes("fb.com")
  ) {
    platform = "facebook";
    ratio =
      lower.includes("/reel/") || lower.includes("/share/r/") ? "9-16" : "16-9";
  } else if (lower.includes("shorts/")) {
    platform = "youtube";
    ratio = "9-16";
  } else if (lower.includes("tiktok.com")) {
    platform = "tiktok";
    ratio = "9-16";
  } else if (lower.includes("instagram.com")) {
    platform = "instagram";
    ratio = "9-16";
  } else if (lower.includes("twitch.tv")) {
    platform = "twitch";
    ratio = "16-9";
  }

  const thumb =
    platform === "facebook" || (!hasRealYoutubeId && platform !== "youtube")
      ? createPlatformCoverSvg(
          platform,
          titleHint || `Vidéo ${platform.toUpperCase()} partagée`,
          url
        )
      : `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;

  return { platform, ratio, youtubeId, thumb };
}

function formatSecondsToMmSs(totalSec: number): string {
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export default function App() {
  // Persistent State via Modular 24/7 Storage Adapter (LocalStorage + IndexedDB)
  const [orbitState, setOrbitState] = useState<OrbitState>(() => {
    const standaloneWatched = OrbitStorageService.loadWatchedVideoIds([]);
    const loaded = OrbitStorageService.loadState<OrbitState>({
      profile: {
        name: "Valentin R.",
        initials: "VR",
        bio: "Créateur Tech, Image & Son · Explorateur des 15 Domaines",
        scoutPoints: 145,
        scoutBadges: 4,
        titleRole:
          "Directeur Créatif · Light Painter · Architecte Écosystème Alphabette",
        contactEmail: "valentin@alphabette.fr",
        availabilityText:
          "Disponible pour réalisations 4K, expositions Light Painting & architectures",
      },
      theme: "onyx",
      accent: "#7c5cff",
      domains: DEFAULT_DOMAINS,
      videos: DEFAULT_VIDEOS,
      socials: DEFAULT_SOCIALS,
      twins: DEFAULT_TWINS,
      jukebox: DEFAULT_JUKEBOX,
      challenges: DEFAULT_CHALLENGES,
      gdprConsentGiven: false,
      selectedArchiveEra: "live",
      pantheonShowAllDomainsArchive: false,
      focusAbsolu: false,
      radarGeoRadius: "50km",
      radarGeoZoneId: "montpellier-occitanie",
      watchLaterIds: [1004, 1002, 1001],
      quickImports: DEFAULT_QUICK_IMPORTS,
      creatorPortfolioMode: false,
      portfolioItems: DEFAULT_PORTFOLIO_ITEMS,
      creatorLinks: DEFAULT_CREATOR_LINKS,
      watchedVideoIds: standaloneWatched,
      hideWatchedVideos: false,
    });

    const brokenYtIds = new Set([
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

    let purgedIdsSet = new Set<number>();
    try {
      const rawPurged = window.localStorage.getItem(
        "ORBIT_PURGED_VIDEO_IDS_V1"
      );
      if (rawPurged) {
        const parsedPurged = JSON.parse(rawPurged);
        if (Array.isArray(parsedPurged)) {
          purgedIdsSet = new Set(
            parsedPurged.filter((id): id is number => typeof id === "number")
          );
        }
      }
    } catch {
      // ignore
    }

    const savedById = new Map<number, OrbitVideo>();
    (loaded.videos || []).forEach((v) => {
      if (v && typeof v.id === "number" && !purgedIdsSet.has(v.id)) {
        savedById.set(v.id, v);
      }
    });

    // Toujours garantir les vidéos officielles vérifiées (en excluant celles purgées comme indisponibles)
    const refreshedDefaultVideos: OrbitVideo[] = DEFAULT_VIDEOS.filter(
      (def) => !purgedIdsSet.has(def.id)
    ).map((def) => {
      const saved = savedById.get(def.id);
      if (!saved) return def;
      return {
        ...def,
        score: saved.score ?? def.score,
        votes: saved.votes ?? def.votes,
        localGeo: saved.localGeo || def.localGeo,
        archiveEras: saved.archiveEras || def.archiveEras,
        archiveDateLabel: saved.archiveDateLabel || def.archiveDateLabel,
        certifiedArchive: saved.certifiedArchive ?? def.certifiedArchive,
        highlightMoments:
          saved.highlightMoments && saved.highlightMoments.length > 0
            ? saved.highlightMoments
            : def.highlightMoments || [],
        reactionCounts: saved.reactionCounts || def.reactionCounts,
        commentsList:
          saved.commentsList && saved.commentsList.length > 0
            ? saved.commentsList
            : def.commentsList,
      };
    });

    const defaultIdSet = new Set(DEFAULT_VIDEOS.map((dv) => dv.id));
    // Conserver uniquement les vraies vidéos ajoutées par l'utilisateur (id >= 3000) qui ne sont pas purgées ni cassées
    const ownerProfileName = loaded.profile?.name || "Valentin R.";
    const customUserVideos: OrbitVideo[] = (
      Array.isArray(loaded.videos) ? loaded.videos : []
    )
      .filter(
        (v) =>
          v &&
          typeof v === "object" &&
          typeof v.id === "number" &&
          !defaultIdSet.has(v.id) &&
          !purgedIdsSet.has(v.id) &&
          v.id >= 3000 &&
          !(v.youtubeId && brokenYtIds.has(v.youtubeId))
      )
      .map((v) => {
        const healedYtId =
          !v.youtubeId || brokenYtIds.has(v.youtubeId)
            ? "aircAruvnKk"
            : v.youtubeId;
        const domainExists = DEFAULT_DOMAINS.some((d) => d.name === v.domain);
        const healedDomain = domainExists ? v.domain : DEFAULT_DOMAINS[0].name;
        const rawLower = (v.rawUrl || "").toLowerCase();
        const isFacebookVid =
          v.platform === "facebook" ||
          v.sourceConnectorId === "facebook" ||
          rawLower.includes("facebook.com") ||
          rawLower.includes("fb.watch") ||
          rawLower.includes("fb.com");
        const healedPlatform: OrbitVideo["platform"] = isFacebookVid
          ? "facebook"
          : v.platform || "youtube";
        const healedRatio: OrbitVideo["ratio"] =
          rawLower.includes("/reel/") || rawLower.includes("/share/r/")
            ? "9-16"
            : v.ratio || "16-9";
        const safeTitle =
          typeof v.title === "string" && v.title.trim()
            ? v.title
            : `Vidéo ${healedPlatform.toUpperCase()} partagée`;
        const healedThumb = isFacebookVid
          ? createPlatformCoverSvg("facebook", safeTitle, v.rawUrl)
          : v.thumb && v.thumb.startsWith("data:image/svg+xml")
          ? v.thumb
          : `https://i.ytimg.com/vi/${healedYtId}/hqdefault.jpg`;
        return {
          ...v,
          title: safeTitle,
          subdomain:
            typeof v.subdomain === "string" && v.subdomain
              ? v.subdomain
              : "Découverte",
          user: ownerProfileName,
          isFriend: true,
          platform: healedPlatform,
          ratio: healedRatio,
          youtubeId: healedYtId,
          thumb: healedThumb,
          domain: healedDomain,
          score:
            typeof v.score === "number" && !Number.isNaN(v.score)
              ? v.score
              : 9.6,
          votes:
            typeof v.votes === "number" && !Number.isNaN(v.votes) ? v.votes : 1,
          hoursAgo:
            typeof v.hoursAgo === "number" && !Number.isNaN(v.hoursAgo)
              ? v.hoursAgo
              : 1,
          commentsList: Array.isArray(v.commentsList) ? v.commentsList : [],
        };
      });

    const mergedVideos: OrbitVideo[] = [
      ...customUserVideos,
      ...refreshedDefaultVideos,
    ];

    // Aligner les 15 domaines avec DEFAULT_DOMAINS pour éviter tout filtre vide
    const mergedDomains: OrbitDomain[] = DEFAULT_DOMAINS.map((defDom) => {
      const savedDom = (
        Array.isArray(loaded.domains) ? loaded.domains : []
      ).find((d) => d && (d.id === defDom.id || d.name === defDom.name));
      return savedDom
        ? {
            ...defDom,
            affinity:
              typeof savedDom.affinity === "number"
                ? savedDom.affinity
                : defDom.affinity,
            secret: Boolean(savedDom.secret ?? defDom.secret),
          }
        : defDom;
    });

    const mergedWatchedIds = Array.from(
      new Set([
        ...(Array.isArray(loaded.watchedVideoIds)
          ? loaded.watchedVideoIds
          : []),
        ...standaloneWatched,
      ])
    );

    // Fusionner les 5 amis par défaut (Anne-Sophie, Ronny, Nicolas, Séverine, Babass) avec les contacts déjà importés
    const validLoadedTwins = (
      Array.isArray(loaded.twins) ? loaded.twins : []
    ).filter(
      (t) =>
        t &&
        typeof t === "object" &&
        typeof t.name === "string" &&
        typeof t.domains === "string" &&
        typeof t.lastPick === "string"
    );
    const existingTwinNames = new Set(
      validLoadedTwins.map((t) => t.name.split(" ")[0].toLowerCase())
    );
    const mergedTwins = [
      ...validLoadedTwins,
      ...DEFAULT_TWINS.filter(
        (dt) => !existingTwinNames.has(dt.name.split(" ")[0].toLowerCase())
      ),
    ];

    // Conserver l'amorçage Jour 1 actif (ou les réseaux connectés par l'utilisateur) avec liste de chaînes assainie
    const sanitizedSocials = DEFAULT_SOCIALS.map((defSoc) => {
      const savedSoc = (
        Array.isArray(loaded.socials) ? loaded.socials : []
      ).find((s) => s && s.id === defSoc.id);
      if (savedSoc && savedSoc.realConsentVerified && savedSoc.active) {
        const rawList = Array.isArray(savedSoc.importedChannelList)
          ? savedSoc.importedChannelList
          : defSoc.importedChannelList || [];
        const cleanChannels = rawList.map((ch: unknown) => {
          if (typeof ch === "string") {
            return {
              title: ch,
              domain: "Sciences & Tech",
              videoCount: 1,
            };
          }
          if (ch && typeof ch === "object") {
            const obj = ch as {
              title?: string;
              domain?: string;
              videoCount?: number;
            };
            return {
              title:
                typeof obj.title === "string" && obj.title
                  ? obj.title
                  : "Chaîne importée",
              domain:
                typeof obj.domain === "string" && obj.domain
                  ? obj.domain
                  : "Sciences & Tech",
              videoCount:
                typeof obj.videoCount === "number" ? obj.videoCount : 1,
            };
          }
          return {
            title: "Chaîne importée",
            domain: "Sciences & Tech",
            videoCount: 1,
          };
        });
        return {
          ...defSoc,
          ...savedSoc,
          importedChannelList: cleanChannels,
          active: true,
          realConsentVerified: true,
        };
      }
      return defSoc;
    });

    const healedPortfolio = (
      Array.isArray(loaded.portfolioItems) && loaded.portfolioItems.length > 0
        ? loaded.portfolioItems
        : DEFAULT_PORTFOLIO_ITEMS
    ).map((item, idx) => {
      const defItem =
        DEFAULT_PORTFOLIO_ITEMS[idx] || DEFAULT_PORTFOLIO_ITEMS[0];
      if (!item || !item.youtubeId || brokenYtIds.has(item.youtubeId)) {
        return {
          ...(item || defItem),
          youtubeId: defItem.youtubeId,
          thumb: defItem.thumb,
        };
      }
      return item;
    });

    const safeProfile: OrbitProfile = {
      name: loaded.profile?.name || "Valentin R.",
      initials: loaded.profile?.initials || "VR",
      bio:
        loaded.profile?.bio ||
        "Créateur Tech, Image & Son · Explorateur des 15 Domaines",
      scoutPoints:
        typeof loaded.profile?.scoutPoints === "number"
          ? loaded.profile.scoutPoints
          : 145,
      scoutBadges:
        typeof loaded.profile?.scoutBadges === "number"
          ? loaded.profile.scoutBadges
          : 4,
      titleRole:
        loaded.profile?.titleRole ||
        "Directeur Créatif · Light Painter · Architecte Écosystème Alphabette",
      contactEmail: loaded.profile?.contactEmail || "valentin@alphabette.fr",
      availabilityText:
        loaded.profile?.availabilityText ||
        "Disponible pour réalisations 4K, expositions Light Painting & architectures",
    };

    return {
      ...loaded,
      profile: safeProfile,
      theme:
        loaded.theme === "onyx" ||
        loaded.theme === "alabaster" ||
        loaded.theme === "polar"
          ? loaded.theme
          : "onyx",
      accent:
        typeof loaded.accent === "string" && loaded.accent
          ? loaded.accent
          : "#7c5cff",
      domains: mergedDomains,
      socials: sanitizedSocials,
      twins: mergedTwins,
      gdprConsentGiven: true,
      videos: mergedVideos,
      jukebox: DEFAULT_JUKEBOX,
      challenges:
        Array.isArray(loaded.challenges) && loaded.challenges.length > 0
          ? loaded.challenges
          : DEFAULT_CHALLENGES,
      selectedArchiveEra: loaded.selectedArchiveEra || "live",
      pantheonShowAllDomainsArchive:
        loaded.pantheonShowAllDomainsArchive ?? false,
      focusAbsolu: loaded.focusAbsolu ?? false,
      radarGeoRadius: loaded.radarGeoRadius || "50km",
      radarGeoZoneId: loaded.radarGeoZoneId || "montpellier-occitanie",
      watchLaterIds: Array.isArray(loaded.watchLaterIds)
        ? loaded.watchLaterIds
        : [1004, 1002, 1001],
      quickImports: DEFAULT_QUICK_IMPORTS,
      creatorPortfolioMode: loaded.creatorPortfolioMode ?? false,
      portfolioItems: healedPortfolio,
      creatorLinks:
        Array.isArray(loaded.creatorLinks) && loaded.creatorLinks.length > 0
          ? loaded.creatorLinks
          : DEFAULT_CREATOR_LINKS,
      watchedVideoIds: mergedWatchedIds,
      hideWatchedVideos: loaded.hideWatchedVideos ?? false,
    };
  });

  // Navigation & UI state — Par défaut en Mode Grille pour afficher d'emblée les 51 vidéos et les 5 pages
  const [activePage, setActivePage] = useState<PageId>("p1");
  const [feedViewMode, setFeedViewMode] = useState<FeedViewMode>("grid");
  const [immersiveUiVisible, setImmersiveUiVisible] = useState<boolean>(true);
  const [immersiveNavOpen, setImmersiveNavOpen] = useState<boolean>(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");
  const [profileTab, setProfileTab] = useState<ProfileTab>("wall");
  const [activePillar, setActivePillar] = useState<string>("Sciences & Tech");
  const [activeSubpillar, setActiveSubpillar] = useState<string>("Tous");
  const [pantheonMode, setPantheonMode] = useState<PantheonMode>("gravity");
  const [radarExploration, setRadarExploration] = useState<number>(25);

  // Adaptation temps réel de la hauteur du viewport (Android / iOS)
  useEffect(() => {
    const updateViewportAndOrientation = () => {
      const vh = window.visualViewport?.height || window.innerHeight;
      document.documentElement.style.setProperty("--app-dvh", `${vh}px`);
    };

    const portraitMql = window.matchMedia("(orientation: portrait)");
    const handleOrientationChange = () => {
      updateViewportAndOrientation();
    };

    updateViewportAndOrientation();
    window.addEventListener("resize", updateViewportAndOrientation);
    window.addEventListener("orientationchange", updateViewportAndOrientation);
    window.visualViewport?.addEventListener(
      "resize",
      updateViewportAndOrientation
    );
    if (portraitMql.addEventListener) {
      portraitMql.addEventListener("change", handleOrientationChange);
    }

    return () => {
      window.removeEventListener("resize", updateViewportAndOrientation);
      window.removeEventListener(
        "orientationchange",
        updateViewportAndOrientation
      );
      window.visualViewport?.removeEventListener(
        "resize",
        updateViewportAndOrientation
      );
      if (portraitMql.removeEventListener) {
        portraitMql.removeEventListener("change", handleOrientationChange);
      }
    };
  }, []);

  // Idée 1 : Mode Cinéma Plein Écran (Assombrissement)
  const [cinemaMode, setCinemaMode] = useState(false);
  const [cinemaModalVideo, setCinemaModalVideo] = useState<OrbitVideo | null>(
    null
  );

  // Idée 12 : Mode 'Focus Absolu' (Zéro Distraction) — Index de lecture
  const [focusVideoIndex, setFocusVideoIndex] = useState<number>(0);

  // Idée 14 : Panier Intelligent 'À regarder ce soir'
  const [watchLaterDrawerOpen, setWatchLaterDrawerOpen] = useState(false);
  const [watchLaterGroupMode, setWatchLaterGroupMode] = useState<
    "duration" | "domain"
  >("duration");
  const [watchLaterDurationFilter, setWatchLaterDurationFilter] = useState<
    "all" | "short" | "medium" | "long"
  >("all");
  const [eveningSessionActive, setEveningSessionActive] = useState(false);
  const [eveningSessionIndex, setEveningSessionIndex] = useState(0);

  // Idée 15 : Passerelle d'Import Rapide Telegram / Discord / Presse-Papiers
  const [quickImportOpen, setQuickImportOpen] = useState(false);
  const [clipboardDetectedBanner, setClipboardDetectedBanner] = useState<{
    url: string;
    source: "telegram" | "discord" | "whatsapp" | "clipboard";
    rawText: string;
    domain: string;
    subdomain: string;
  } | null>(null);
  const [inpImportedVia, setInpImportedVia] = useState<
    "telegram" | "discord" | "whatsapp" | "clipboard" | undefined
  >(undefined);
  const [manualPasteInput, setManualPasteInput] = useState("");

  // Fonctionnalité 20 : Générateur de QR Code Visuel de Playlist (Page 2 & Page 3) + Sélection scannée
  const [qrModalConfig, setQrModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    subtitle: string;
    sourcePageLabel: string;
    videos: OrbitVideo[];
  }>({
    isOpen: false,
    title: "",
    subtitle: "",
    sourcePageLabel: "",
    videos: [],
  });
  const [scannedPlaylistBanner, setScannedPlaylistBanner] = useState<{
    title: string;
    curator: string;
    videoIds: number[];
  } | null>(null);

  // Idée 2 : Jukebox Collaboratif en Temps Réel
  const [jukeboxPlayingTrack, setJukeboxPlayingTrack] =
    useState<JukeboxTrack | null>(null);
  const [jukeboxChat, setJukeboxChat] = useState<JukeboxChatMessage[]>([
    {
      id: 1,
      author: "Anne-Sophie",
      text: "J'ai mis le classique Boom-Bap en tête de file, montez le son !",
      time: "22:14",
    },
    {
      id: 2,
      author: "Thomas_AI",
      text: "Je viens de voter +1 sur le Light Painting de Claire ensuite.",
      time: "22:16",
    },
  ]);
  const [jukeboxMsgInput, setJukeboxMsgInput] = useState("");

  // Idée 6 : Widget d'Humeur du Jour (Radar)
  const [activeMood, setActiveMood] = useState<MoodId>("all");

  // Idée 8 : Mode Audio / Podcast en Arrière-Plan
  const [audioModeVideo, setAudioModeVideo] = useState<OrbitVideo | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(true);

  // Idée 9 : Time-Capsule (Programmation temporelle)
  const [isTimeCapsule, setIsTimeCapsule] = useState(false);
  const [capsuleDelayMinutes, setCapsuleDelayMinutes] = useState<number>(1);
  const [nowTimestamp, setNowTimestamp] = useState<number>(() => Date.now());

  // Prompt 3 : 24/7 Resilience & Cloud Adapter state
  const [syncQueue, setSyncQueue] = useState<SyncMutation[]>(() =>
    OrbitStorageService.getSyncQueue()
  );
  const [cloudConfig, setCloudConfig] = useState<CloudConnectorConfig>(() =>
    OrbitStorageService.getCloudConfig()
  );
  const [swStats, setSwStats] = useState<ServiceWorkerDiagnostics>({
    status: "ACTIVE_24_7",
    totalCached: 8,
    staticCount: 6,
    runtimeCount: 2,
    mediaCount: 0,
  });

  // Composer state
  const [inpUrl, setInpUrl] = useState("");
  const [inpDomain, setInpDomain] = useState(DEFAULT_DOMAINS[0].name);
  const [inpSubdomain, setInpSubdomain] = useState(DEFAULT_DOMAINS[0].subs[0]);
  const [inpTitle, setInpTitle] = useState("");
  const [inpComment, setInpComment] = useState("");
  const [inpChallengeTag, setInpChallengeTag] = useState<string>("");
  const [aiStatusText, setAiStatusText] = useState(
    "Auto-Classification IA Gemini prête : collez un lien ou tapez un titre"
  );
  const [isClassifying, setIsClassifying] = useState(false);

  // PiP Player state
  const [pipVideo, setPipVideo] = useState<OrbitVideo | null>(null);

  // Modals state
  const [openModal, setOpenModal] = useState<
    "sync" | "capsule" | "design" | "jukebox" | "resilience" | "vault" | null
  >(null);
  const [selectedConnectorForModal, setSelectedConnectorForModal] = useState<
    string | null
  >(null);
  const jsonImportFileRef = useRef<HTMLInputElement | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [editName, setEditName] = useState(orbitState.profile.name);
  const [editBio, setEditBio] = useState(orbitState.profile.bio);

  // Capsule state
  const [capFriend, setCapFriend] = useState("Anne-Sophie");
  const [capDomain, setCapDomain] = useState(DEFAULT_DOMAINS[0].name);
  const [capsuleCopied, setCapsuleCopied] = useState(false);

  // YouTube OAuth state
  const [ytAuthStatus, setYtAuthStatus] = useState<
    "idle" | "consent" | "loading" | "done"
  >("idle");
  const [importedChannels, setImportedChannels] = useState<
    { title: string; domain: string; videoCount: number }[]
  >([]);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync theme, accent, 24/7 Storage AND explicit watchedVideoIds array in LocalStorage (Fonctionnalité 17)
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", orbitState.theme);
    document.documentElement.style.setProperty("--accent", orbitState.accent);
    document.documentElement.style.setProperty(
      "--accent-glow",
      `${orbitState.accent}55`
    );
    OrbitStorageService.saveState(orbitState);
    OrbitStorageService.saveWatchedVideoIds(orbitState.watchedVideoIds || []);
  }, [orbitState]);

  // Live ticker for Time-Capsules (Idée 9) & SW Cache Diagnostics (Prompt 3)
  useEffect(() => {
    OrbitStorageService.queryServiceWorkerStats().then(setSwStats);
    const interval = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-flush offline sync queue when network comes back online
  useEffect(() => {
    const handleOnline = async () => {
      const res = await OrbitStorageService.flushSyncQueue();
      setSyncQueue(OrbitStorageService.getSyncQueue());
      if (res.flushedCount > 0) {
        showToast(
          `Réseau rétabli : ${res.flushedCount} action(s) hors-ligne synchronisée(s) avec succès !`
        );
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  // Real-time BroadcastChannel for Collaborative Jukebox across tabs (Idée 2)
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("orbit_jukebox_live_v2");
    channel.onmessage = (ev) => {
      if (ev.data?.type === "JUKEBOX_BOOST" && ev.data?.trackId) {
        setOrbitState((prev) => ({
          ...prev,
          jukebox: prev.jukebox
            .map((t) =>
              t.id === ev.data.trackId ? { ...t, boosts: t.boosts + 1 } : t
            )
            .sort((a, b) => b.boosts - a.boosts),
        }));
      } else if (ev.data?.type === "JUKEBOX_CHAT" && ev.data?.msg) {
        setJukeboxChat((prev) => [...prev, ev.data.msg]);
      }
    };
    return () => channel.close();
  }, []);

  // MediaSession API for Background Audio / Podcast Mode (Idée 8)
  useEffect(() => {
    if (
      !audioModeVideo ||
      typeof navigator === "undefined" ||
      !("mediaSession" in navigator)
    ) {
      return;
    }
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: audioModeVideo.title,
        artist: `@${audioModeVideo.user} · ${audioModeVideo.domain}`,
        album: `ORBIT Audio Podcast — ${audioModeVideo.subdomain}`,
        artwork: [
          { src: audioModeVideo.thumb, sizes: "480x360", type: "image/jpeg" },
        ],
      });
    } catch {
      // Ignore if unsupported
    }
  }, [audioModeVideo]);

  // Subdomains for composer select
  const composerSubdomains = useMemo(() => {
    const dom =
      orbitState.domains.find((d) => d.name === inpDomain) ||
      orbitState.domains[0];
    return dom.subs;
  }, [orbitState.domains, inpDomain]);

  // Local fast heuristic classification on input change
  const classifyTextToDomain = (rawText: string) => {
    const lower = rawText.toLowerCase();
    for (const dom of orbitState.domains) {
      for (const kw of dom.keywords) {
        if (lower.includes(kw)) {
          const matchedSub =
            dom.subs.find((s) =>
              lower.includes(s.toLowerCase().split(" ")[0])
            ) || dom.subs[0];
          return { domain: dom.name, subdomain: matchedSub, keyword: kw };
        }
      }
    }
    return {
      domain: orbitState.domains[0].name,
      subdomain: orbitState.domains[0].subs[0],
      keyword: "",
    };
  };

  const handleLocalClassify = (nextUrl: string, nextTitle: string) => {
    const combined = `${nextUrl} ${nextTitle}`.toLowerCase();
    if (combined.trim().length < 3) return;

    const match = classifyTextToDomain(combined);
    if (match.keyword) {
      const domObj = orbitState.domains.find((d) => d.name === match.domain);
      setInpDomain(match.domain);
      setInpSubdomain(match.subdomain);
      setAiStatusText(
        `IA Auto-Tri : Classé dans ${domObj?.icon || "✨"} ${match.domain} › ${
          match.subdomain
        } (mot-clé : "${match.keyword}")`
      );
      return;
    }

    const parsed = parseVideoUrl(nextUrl);
    if (nextUrl.trim().length > 5) {
      setAiStatusText(
        `Plateforme détectée : ${parsed.platform.toUpperCase()} (Format ${
          parsed.ratio
        })`
      );
    }
  };

  // Fonctionnalité 17 : Enregistrement automatique dans watchedVideoIds (LocalStorage + State)
  const handleMarkVideoWatched = (videoId: number) => {
    setOrbitState((prev) => {
      const current = prev.watchedVideoIds || [];
      if (current.includes(videoId)) return prev;
      const next = [videoId, ...current];
      OrbitStorageService.saveWatchedVideoIds(next);
      return {
        ...prev,
        watchedVideoIds: next,
      };
    });
    setSyncQueue(
      OrbitStorageService.enqueueMutation("WATCHED_VIDEO_LOG", { videoId })
    );
  };

  // Fonctionnalité 17 : Basculer l'interrupteur 'Masquer les vidéos déjà vues' (Pages 1, 3 et 4)
  const handleToggleHideWatched = () => {
    const nextVal = !orbitState.hideWatchedVideos;
    setOrbitState((prev) => ({
      ...prev,
      hideWatchedVideos: nextVal,
    }));
    showToast(
      nextVal
        ? `👁️ Filtre Anti-Déjà-Vu activé : seules vos découvertes 100% inédites sont affichées (${
            (orbitState.watchedVideoIds || []).length
          } vidéos masquées).`
        : "Filtre Anti-Déjà-Vu désactivé : toutes les vidéos sont visibles."
    );
  };

  // Fonctionnalité 18 : Enregistrer une réaction éphémère en direct + le timestamp précis du moment fort
  const handleTriggerReaction = (
    videoId: number,
    reactionId: ReactionType,
    timestampSeconds: number
  ) => {
    const opt =
      LIVE_REACTIONS.find((r) => r.id === reactionId) || LIVE_REACTIONS[0];
    const formatted = formatSecondsToMmSs(timestampSeconds);

    setOrbitState((prev) => {
      const currentWatched = prev.watchedVideoIds || [];
      const nextWatched = currentWatched.includes(videoId)
        ? currentWatched
        : [videoId, ...currentWatched];
      OrbitStorageService.saveWatchedVideoIds(nextWatched);

      return {
        ...prev,
        watchedVideoIds: nextWatched,
        videos: prev.videos.map((v) => {
          if (v.id !== videoId) return v;
          const prevCounts = v.reactionCounts || {
            pepite: 0,
            choc: 0,
            genial: 0,
            beau: 0,
            coeur: 0,
          };
          const prevMoments = v.highlightMoments || [];
          const newMoment = {
            id: `hm-${videoId}-${Date.now()}`,
            reactionId,
            emoji: opt.emoji,
            label: opt.label,
            timestampSeconds,
            timestampFormatted: formatted,
            author: prev.profile.name,
          };
          return {
            ...v,
            reactionCounts: {
              ...prevCounts,
              [reactionId]: (prevCounts[reactionId] || 0) + 1,
            },
            highlightMoments: [newMoment, ...prevMoments].slice(0, 12),
          };
        }),
      };
    });

    setSyncQueue(
      OrbitStorageService.enqueueMutation("LIVE_REACTION_HIGHLIGHT", {
        videoId,
        reactionId,
        timestampFormatted: formatted,
      })
    );
  };

  // Fonctionnalité 15 : Analyse intelligente d'un texte ou lien issu de Telegram, Discord, WhatsApp ou Presse-Papiers
  const applyQuickImportText = (
    rawClipText: string,
    explicitSource?: "telegram" | "discord" | "whatsapp" | "clipboard"
  ) => {
    const trimmed = rawClipText.trim();
    if (!trimmed) return false;

    const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
    const extractedUrl = urlMatch ? urlMatch[0] : trimmed;

    let detectedSource: "telegram" | "discord" | "whatsapp" | "clipboard" =
      explicitSource || "clipboard";
    const lower = trimmed.toLowerCase();
    if (!explicitSource) {
      if (lower.includes("t.me/") || lower.includes("telegram")) {
        detectedSource = "telegram";
      } else if (lower.includes("discord") || lower.includes("#")) {
        detectedSource = "discord";
      } else if (lower.includes("wa.me") || lower.includes("whatsapp")) {
        detectedSource = "whatsapp";
      }
    }

    const surroundingCaption = trimmed
      .replace(extractedUrl, "")
      .replace(/^[\s\-:«»"]+/, "")
      .replace(/[\s\-:«»"]+$/, "")
      .trim();

    const classified = classifyTextToDomain(`${trimmed} ${extractedUrl}`);

    setInpUrl(extractedUrl);
    setInpDomain(classified.domain);
    setInpSubdomain(classified.subdomain);
    setInpImportedVia(detectedSource);
    if (surroundingCaption.length > 4) {
      setInpTitle(surroundingCaption.slice(0, 95));
      setInpComment(
        `Importé automatiquement depuis ${detectedSource.toUpperCase()} : ${surroundingCaption}`
      );
    }
    setAiStatusText(
      `Passerelle ${detectedSource.toUpperCase()} : Pré-rempli & classé dans ${
        classified.domain
      } › ${classified.subdomain}`
    );
    setQuickImportOpen(false);
    setComposerOpen(true);
    triggerGeminiClassification(extractedUrl, surroundingCaption);
    showToast(
      `⚡ Lien ${detectedSource.toUpperCase()} détecté et classé dans ${
        classified.domain
      } › ${classified.subdomain} !`
    );
    return true;
  };

  // Bouton 'Coller rapide'
  const handleQuickPasteButton = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (
          text &&
          (text.includes("http://") ||
            text.includes("https://") ||
            text.includes("youtu") ||
            text.includes("facebook") ||
            text.includes("fb.watch") ||
            text.includes("tiktok") ||
            text.includes("instagram"))
        ) {
          applyQuickImportText(text);
          return;
        }
      }
    } catch {
      // Browser iframe permission fallback -> open the interactive Quick Import Gateway modal
    }
    setQuickImportOpen(true);
  };

  const handleUseBridgeItem = (item: QuickImportBridgeItem) => {
    setInpUrl(item.extractedUrl);
    setInpTitle(item.suggestedTitle);
    setInpComment(item.suggestedComment);
    setInpDomain(item.detectedDomain);
    setInpSubdomain(item.detectedSubdomain);
    setInpImportedVia(item.source);
    setAiStatusText(
      `Passerelle ${item.source.toUpperCase()} (${item.sender}) : Classé dans ${
        item.detectedDomain
      } › ${item.detectedSubdomain}`
    );
    setQuickImportOpen(false);
    setComposerOpen(true);
    setSyncQueue(
      OrbitStorageService.enqueueMutation("QUICK_IMPORT_BRIDGE", {
        source: item.source,
        url: item.extractedUrl,
      })
    );
    showToast(
      `⚡ Fiche pré-remplie depuis ${item.channelName} (${item.detectedSubdomain}) !`
    );
  };

  // Détecteur global Ctrl+V / Cmd+V (Fonctionnalité 15) + Touche Échap pour quitter Focus Absolu (Fonctionnalité 12)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const pasted = e.clipboardData?.getData("text") || "";
      if (
        pasted &&
        (pasted.includes("http://") ||
          pasted.includes("https://") ||
          pasted.includes("youtu") ||
          pasted.includes("facebook") ||
          pasted.includes("fb.watch"))
      ) {
        e.preventDefault();
        applyQuickImportText(pasted);
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && orbitState.focusAbsolu) {
        setOrbitState((prev) => ({ ...prev, focusAbsolu: false }));
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("paste", handleGlobalPaste);
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [orbitState.focusAbsolu, orbitState.domains]);

  // Détecteur intelligent à l'ouverture : Sélection QR Code scannée (Fonctionnalité 20) ou Lien partagé (Fonctionnalité 15)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const playlistIdsRaw = params.get("playlist_ids");
    const playlistTitle =
      params.get("playlist_title") || "Sélection Partagée par QR Code";
    const playlistCurator = params.get("curator") || "Ami Orbit";

    if (playlistIdsRaw) {
      const parsedIds = playlistIdsRaw
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !Number.isNaN(n));
      if (parsedIds.length > 0) {
        setScannedPlaylistBanner({
          title: playlistTitle,
          curator: playlistCurator,
          videoIds: parsedIds,
        });
        setActivePage("p1");
        setFeedViewMode("grid");
        showToast(
          `📱 Sélection QR Code ouverte : « ${playlistTitle} » (${parsedIds.length} vidéos) !`
        );
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
    }

    const sharedUrl =
      params.get("shared_url") || params.get("url") || params.get("text");
    const sharedTitle = params.get("shared_title") || params.get("title") || "";
    const sharedSource = params.get("source") as
      | "telegram"
      | "discord"
      | "whatsapp"
      | null;
    if (sharedUrl) {
      setActivePage("p1");
      setComposerOpen(true);
      setInpUrl(sharedUrl);
      if (sharedTitle) {
        setInpTitle(sharedTitle);
      }
      if (sharedSource) {
        setInpImportedVia(sharedSource);
      }
      handleLocalClassify(sharedUrl, sharedTitle);
      triggerGeminiClassification(sharedUrl, sharedTitle);
      showToast(
        "Vidéo reçue depuis une application externe ! Vérifiez la fenêtre de publication."
      );
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (
      navigator.clipboard &&
      typeof navigator.clipboard.readText === "function"
    ) {
      navigator.clipboard
        .readText()
        .then((clip) => {
          if (
            clip &&
            (clip.includes("youtube.com") ||
              clip.includes("youtu.be") ||
              clip.includes("facebook.com") ||
              clip.includes("fb.watch") ||
              clip.includes("tiktok.com") ||
              clip.includes("instagram.com") ||
              clip.includes("t.me/"))
          ) {
            const c = classifyTextToDomain(clip);
            setClipboardDetectedBanner({
              url: clip.trim(),
              source: clip.includes("t.me") ? "telegram" : "clipboard",
              rawText: clip.trim(),
              domain: c.domain,
              subdomain: c.subdomain,
            });
          }
        })
        .catch(() => {
          // Silence if browser requires explicit click
        });
    }
  }, []);

  // Server-side Gemini AI semantic classification + local-first oEmbed cache
  const triggerGeminiClassification = async (
    rawUrlToUse?: string,
    titleToUse?: string
  ) => {
    const targetUrl = (rawUrlToUse ?? inpUrl).trim();
    let targetTitle = (titleToUse ?? inpTitle).trim();

    if (!targetUrl && !targetTitle) {
      showToast(
        "Indiquez un lien vidéo ou un titre avant de lancer l'analyse IA."
      );
      return null;
    }

    setIsClassifying(true);
    setAiStatusText("Vérification du cache local oEmbed & analyse sémantique...");

    try {
      let fetchedThumb = "";
      if (targetUrl && !targetTitle) {
        const cachedMeta = OrbitStorageService.getCachedOembed(targetUrl);
        if (cachedMeta) {
          targetTitle = cachedMeta.title || targetTitle;
          fetchedThumb = cachedMeta.thumb || "";
          if (cachedMeta.title) setInpTitle(cachedMeta.title);
        } else {
          OrbitStorageService.recordNetworkCall(false);
          const oembedRes = await fetch(
            `/api/orbit/oembed?url=${encodeURIComponent(targetUrl)}`
          );
          if (oembedRes.ok) {
            const meta = await oembedRes.json();
            if (meta.title) {
              targetTitle = meta.title;
              setInpTitle(meta.title);
            }
            if (meta.thumb) {
              fetchedThumb = meta.thumb;
            }
            if (meta.title || meta.thumb) {
              OrbitStorageService.setCachedOembed({
                url: targetUrl,
                title: meta.title || "",
                author: meta.author || "",
                thumb: meta.thumb || "",
                cachedAt: Date.now(),
              });
            }
          }
        }
      }

      // Règle 4 : Si l'heuristique locale trouve une correspondance franche et que la politique privilégie le local, éviter l'appel IA distant inutile
      const policy = OrbitStorageService.getRetentionPolicy();
      const localMatch = classifyTextToDomain(`${targetUrl} ${targetTitle} ${inpComment}`);
      if (policy.preferLocalHeuristicOverAi && localMatch.keyword && rawUrlToUse) {
        OrbitStorageService.recordLocalComputation(1536);
        setInpDomain(localMatch.domain);
        setInpSubdomain(localMatch.subdomain);
        setAiStatusText(
          `Tri Déterministe Local (0 appel serveur) : ${localMatch.domain} › ${localMatch.subdomain} (mot-clé : "${localMatch.keyword}")`
        );
        setIsClassifying(false);
        return {
          title: targetTitle,
          domain: localMatch.domain,
          subdomain: localMatch.subdomain,
          thumb: fetchedThumb,
        };
      }

      OrbitStorageService.recordNetworkCall(true);
      const res = await fetch("/api/orbit/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: targetTitle,
          url: targetUrl,
          description: inpComment,
        }),
      });

      if (res.ok) {
        const aiResult = await res.json();
        setInpDomain(aiResult.domain);
        setInpSubdomain(aiResult.subdomain);
        const pct = Math.round((aiResult.confidence || 0.95) * 100);
        setAiStatusText(
          `Cerveau IA (${
            aiResult.source === "gemini" ? "Gemini" : "Local"
          }) : ${aiResult.domain} › ${aiResult.subdomain} (${pct}% confiance)`
        );
        setIsClassifying(false);
        return {
          title: targetTitle,
          domain: aiResult.domain,
          subdomain: aiResult.subdomain,
          thumb: fetchedThumb,
        };
      }
    } catch {
      setAiStatusText(
        "Heuristique locale hors-ligne activée sur les 105 sous-domaines."
      );
    }

    setIsClassifying(false);
    return null;
  };

  // Publish Video
  const handlePublishVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    let rawUrl = inpUrl.trim();
    let finalTitle = inpTitle.trim();
    let finalDomain = inpDomain;
    let finalSubdomain = inpSubdomain;
    let oembedThumb = "";

    if (!rawUrl && !finalTitle) {
      showToast(
        "Veuillez saisir un lien vidéo (Facebook, YouTube, TikTok, Insta...) ou un titre."
      );
      return;
    }

    // Si l'utilisateur a collé un code <iframe src="https://www.facebook.com/plugins/video.php?href=..."> ou un texte avec URL
    if (rawUrl) {
      const hrefMatch = rawUrl.match(/[?&]href=([^&"'\s>]+)/i);
      if (hrefMatch && hrefMatch[1]) {
        try {
          rawUrl = decodeURIComponent(hrefMatch[1]);
        } catch {
          rawUrl = hrefMatch[1];
        }
      } else {
        const httpMatch = rawUrl.match(/https?:\/\/[^\s"'<>]+/i);
        if (httpMatch && httpMatch[0]) {
          rawUrl = httpMatch[0];
        }
      }
      if (
        !rawUrl.startsWith("http") &&
        (rawUrl.toLowerCase().includes("facebook.com") ||
          rawUrl.toLowerCase().includes("fb.watch") ||
          rawUrl.toLowerCase().includes("youtube.com") ||
          rawUrl.toLowerCase().includes("youtu.be") ||
          rawUrl.toLowerCase().includes("tiktok.com") ||
          rawUrl.toLowerCase().includes("instagram.com"))
      ) {
        rawUrl = `https://${rawUrl}`;
      }
    }

    // Vérifier systématiquement la disponibilité de la vidéo et résoudre les liens courts (Facebook, YouTube, TikTok, Instagram)
    if (rawUrl) {
      try {
        const oembedRes = await fetch(
          `/api/orbit/oembed?url=${encodeURIComponent(rawUrl)}`
        );
        if (oembedRes.ok) {
          const meta = await oembedRes.json();
          if (meta.playable === false) {
            setInpUrl("");
            setInpTitle("");
            setInpComment("");
            setComposerOpen(false);
            showToast(
              `🗑️ Post supprimé automatiquement : cette vidéo est indisponible ou impossible à lire (${
                meta.unavailableReason || "intégration refusée"
              }).`
            );
            return;
          }
          if (meta.resolvedUrl && typeof meta.resolvedUrl === "string") {
            rawUrl = meta.resolvedUrl;
          }
          if (!finalTitle && meta.title) {
            finalTitle = meta.title;
          }
          if (meta.thumb) {
            oembedThumb = meta.thumb;
          }
        }
      } catch {
        // Fallback local si hors-ligne
      }
    }

    if (rawUrl && !finalTitle) {
      const enriched = await triggerGeminiClassification(rawUrl, finalTitle);
      if (enriched) {
        finalTitle = enriched.title || finalTitle;
        finalDomain = enriched.domain || finalDomain;
        finalSubdomain = enriched.subdomain || finalSubdomain;
        oembedThumb = oembedThumb || enriched.thumb || "";
      }
    }

    const resolvedTitle =
      finalTitle ||
      (rawUrl.toLowerCase().includes("facebook") ||
      rawUrl.toLowerCase().includes("fb.watch")
        ? `Vidéo Facebook partagée — ${finalSubdomain}`
        : `Découverte — ${finalSubdomain}`);
    const parsed = parseVideoUrl(rawUrl || "https://youtube.com", resolvedTitle);
    const unlockAt = isTimeCapsule
      ? Date.now() + capsuleDelayMinutes * 60 * 1000
      : undefined;

    const newVideo: OrbitVideo = {
      id: Date.now(),
      title: resolvedTitle,
      platform: parsed.platform,
      ratio: parsed.ratio,
      domain: finalDomain,
      subdomain: finalSubdomain,
      user: orbitState.profile.name,
      isFriend: true,
      comment: inpComment.trim() || "Je partage cette pépite sur Ma Page Orbit !",
      score: 9.6,
      votes: 1,
      hoursAgo: 0,
      youtubeId: parsed.youtubeId,
      rawUrl: rawUrl || `https://www.youtube.com/watch?v=${parsed.youtubeId}`,
      thumb: oembedThumb || parsed.thumb,
      isScout: true,
      scoutRank: 1,
      durationMinutes: parsed.ratio === "9-16" ? 3 : 16,
      challengeTag: inpChallengeTag || undefined,
      unlockAt,
      archiveEras: ["live", "week"],
      certifiedArchive: true,
      localGeo: {
        zoneId: orbitState.radarGeoZoneId || "montpellier-occitanie",
        radius10km: true,
        radius50km: true,
        region: true,
        areaBadge: "Ma Zone Locale (< 10 km)",
        localScore: 9.7,
        localVoters: 12,
      },
      sourceConnectorId: parsed.platform === "facebook" ? "facebook" : undefined,
      importedVia: inpImportedVia || "clipboard",
      reactionCounts: { pepite: 1, choc: 0, genial: 0, beau: 0, coeur: 0 },
      highlightMoments: [],
      commentsList: [],
    };

    setOrbitState((prev) => ({
      ...prev,
      creatorPortfolioMode: false,
      profile: {
        ...prev.profile,
        scoutPoints: (prev.profile.scoutPoints || 145) + 15,
        scoutBadges: (prev.profile.scoutBadges || 4) + 1,
      },
      videos: [newVideo, ...prev.videos],
      domains: prev.domains.map((d) =>
        d.name === finalDomain
          ? { ...d, affinity: Math.min(100, d.affinity + 2) }
          : d
      ),
      challenges: prev.challenges.map((ch) =>
        inpChallengeTag && ch.weekLabel === inpChallengeTag
          ? {
              ...ch,
              userProgress: Math.min(ch.targetCount, ch.userProgress + 1),
            }
          : ch
      ),
    }));

    const nextQ = OrbitStorageService.enqueueMutation(
      isTimeCapsule ? "SCHEDULE_CAPSULE" : "PUBLISH_VIDEO",
      { title: newVideo.title, domain: finalDomain, unlockAt }
    );
    setSyncQueue(nextQ);

    setInpUrl("");
    setInpTitle("");
    setInpComment("");
    setInpChallengeTag("");
    setInpImportedVia(undefined);
    setIsTimeCapsule(false);
    setComposerOpen(false);
    setProfileTab("wall");
    setActivePage("p2");

    if (isTimeCapsule) {
      setProfileTab("capsules");
      showToast(
        `⏳ Time-Capsule programmée sur Ma Page ! Ouverture dans ${capsuleDelayMinutes} min (+15 pts Éclaireur).`
      );
    } else {
      showToast(
        `✓ Vidéo ${parsed.platform.toUpperCase()} intégrée en tête de Ma Page (Page 2) et dans le Flux (${finalDomain} › ${finalSubdomain}) !`
      );
    }
  };

  // Suppression automatique et définitive des posts / vidéos indisponibles ou impossibles à lire
  const verifiedVideoIdsRef = useRef<Set<number>>(new Set());

  const handleRemoveUnavailableVideosBatch = (
    idsToRemove: number[],
    reasonLabel?: string
  ) => {
    if (!idsToRemove || idsToRemove.length === 0) return;
    const removeSet = new Set(idsToRemove);

    try {
      const rawPurged = window.localStorage.getItem(
        "ORBIT_PURGED_VIDEO_IDS_V1"
      );
      const existingPurged: number[] = rawPurged ? JSON.parse(rawPurged) : [];
      const mergedPurged = Array.from(
        new Set([
          ...(Array.isArray(existingPurged) ? existingPurged : []),
          ...idsToRemove,
        ])
      );
      window.localStorage.setItem(
        "ORBIT_PURGED_VIDEO_IDS_V1",
        JSON.stringify(mergedPurged)
      );
    } catch {
      // ignore storage errors
    }

    setOrbitState((prev) => {
      const beforeCount = prev.videos.length;
      const filteredVideos = prev.videos.filter((v) => !removeSet.has(v.id));
      if (filteredVideos.length === beforeCount) return prev;
      return {
        ...prev,
        videos: filteredVideos,
        watchLaterIds: (prev.watchLaterIds || []).filter(
          (id) => !removeSet.has(id)
        ),
        jukebox: (prev.jukebox || []).filter(
          (item) => !removeSet.has(item.videoId)
        ),
      };
    });

    setPipVideo((curr) => (curr && removeSet.has(curr.id) ? null : curr));
    setCinemaModalVideo((curr) =>
      curr && removeSet.has(curr.id) ? null : curr
    );
    setAudioModeVideo((curr) => (curr && removeSet.has(curr.id) ? null : curr));

    showToast(
      idsToRemove.length === 1
        ? `🗑️ Post supprimé automatiquement : ${
            reasonLabel || "vidéo indisponible ou impossible à lire"
          }.`
        : `🗑️ Nettoyage auto : ${idsToRemove.length} publications indisponibles supprimées.`
    );
  };

  const handleRemoveUnavailableVideo = (videoId: number, reason?: string) => {
    handleRemoveUnavailableVideosBatch([videoId], reason);
  };

  // Audit automatique en arrière-plan de toutes les vidéos pour purger celles qui sont indisponibles à la lecture
  useEffect(() => {
    const unverified = orbitState.videos.filter(
      (v) =>
        v &&
        typeof v.id === "number" &&
        !verifiedVideoIdsRef.current.has(v.id)
    );
    if (unverified.length === 0) return;

    unverified.forEach((v) => verifiedVideoIdsRef.current.add(v.id));

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/orbit/verify-videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videos: unverified.map((v) => ({
              id: v.id,
              rawUrl: v.rawUrl,
              youtubeId: v.youtubeId,
              platform: v.platform,
            })),
          }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          unavailableIds?: number[];
          reasons?: Record<number, string>;
        };
        if (
          !cancelled &&
          Array.isArray(data.unavailableIds) &&
          data.unavailableIds.length > 0
        ) {
          const firstReason =
            data.reasons?.[data.unavailableIds[0]] ||
            "vidéo indisponible à la lecture";
          handleRemoveUnavailableVideosBatch(data.unavailableIds, firstReason);
        }
      } catch {
        // Hors-ligne : ignorer
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orbitState.videos]);

  // Écouteur temps réel des erreurs de lecture IFrame (YouTube IFrame API postMessage onError)
  useEffect(() => {
    const handleIframeMessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      if (!event.data.includes("onError")) return;
      try {
        const parsed = JSON.parse(event.data);
        if (parsed && parsed.event === "onError" && parsed.info) {
          if (pipVideo) {
            handleRemoveUnavailableVideo(
              pipVideo.id,
              "Erreur de lecture détectée dans le lecteur vidéo"
            );
          }
        }
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener("message", handleIframeMessage);
    return () => window.removeEventListener("message", handleIframeMessage);
  }, [pipVideo]);

  // Fonctionnalité 14 : Ajouter / Retirer du Panier Intelligent 'À regarder ce soir'
  const handleToggleWatchLater = (video: OrbitVideo) => {
    const currentIds = orbitState.watchLaterIds || [];
    const exists = currentIds.includes(video.id);
    const nextIds = exists
      ? currentIds.filter((id) => id !== video.id)
      : [video.id, ...currentIds];

    setOrbitState((prev) => ({
      ...prev,
      watchLaterIds: nextIds,
    }));

    setSyncQueue(
      OrbitStorageService.enqueueMutation("WATCH_LATER_TOGGLE", {
        videoId: video.id,
        added: !exists,
      })
    );

    if (exists) {
      showToast(`Retiré de votre panier « À regarder ce soir ».`);
    } else {
      showToast(
        `⏳ Mis de côté dans « À regarder ce soir » (${
          video.durationMinutes || 12
        } min) !`
      );
    }
  };

  // Fonctionnalité 12 : Activer / Désactiver le Mode 'Focus Absolu' (Zéro Distraction)
  const handleToggleFocusAbsolu = () => {
    const nextVal = !orbitState.focusAbsolu;
    setOrbitState((prev) => ({
      ...prev,
      focusAbsolu: nextVal,
    }));
    if (nextVal) {
      setFocusVideoIndex(0);
    }
  };

  // Rate video + Fonctionnalité 17 : Enregistrer automatiquement dans watchedVideoIds
  const handleRateVideo = (videoId: number, rating: number) => {
    setOrbitState((prev) => {
      const target = prev.videos.find((v) => v.id === videoId);
      if (!target) return prev;
      const updatedScore =
        (target.score * target.votes + rating) / (target.votes + 1);
      const earnedScout = target.votes < 200 ? 5 : 1;
      const currentWatched = prev.watchedVideoIds || [];
      const nextWatched = currentWatched.includes(videoId)
        ? currentWatched
        : [videoId, ...currentWatched];
      OrbitStorageService.saveWatchedVideoIds(nextWatched);

      return {
        ...prev,
        watchedVideoIds: nextWatched,
        profile: {
          ...prev.profile,
          scoutPoints: (prev.profile.scoutPoints || 145) + earnedScout,
        },
        videos: prev.videos.map((v) =>
          v.id === videoId
            ? { ...v, score: updatedScore, votes: v.votes + 1 }
            : v
        ),
        domains: prev.domains.map((d) =>
          d.name === target.domain && rating >= 8
            ? { ...d, affinity: Math.min(100, d.affinity + 1) }
            : d
        ),
      };
    });
    setSyncQueue(
      OrbitStorageService.enqueueMutation("RATE_VIDEO", { videoId, rating })
    );
  };

  // Add comment + Fonctionnalité 19 : Support Débat Structuré (Pour / Nuance / Source)
  const handleAddComment = (
    videoId: number,
    text: string,
    stance: DebateStance = "pour",
    sourceUrl?: string
  ) => {
    setOrbitState((prev) => ({
      ...prev,
      videos: prev.videos.map((v) =>
        v.id === videoId
          ? {
              ...v,
              commentsList: [
                ...v.commentsList,
                {
                  author: prev.profile.name,
                  text,
                  stance,
                  sourceUrl,
                  verifiedLabel: sourceUrl ? "Lien Source" : undefined,
                },
              ],
            }
          : v
      ),
    }));
    setSyncQueue(
      OrbitStorageService.enqueueMutation("STRUCTURED_DEBATE_COMMENT", {
        videoId,
        text,
        stance,
        sourceUrl,
      })
    );
  };

  // Fonctionnalité 16 : Ajouter une œuvre au Portfolio Professionnel sur la Page 2
  const handleAddPortfolioItem = (item: CreatorPortfolioItem) => {
    setOrbitState((prev) => ({
      ...prev,
      portfolioItems: [item, ...(prev.portfolioItems || DEFAULT_PORTFOLIO_ITEMS)],
    }));
    setSyncQueue(
      OrbitStorageService.enqueueMutation("PORTFOLIO_UPDATE", {
        itemId: item.id,
        title: item.title,
      })
    );
  };

  // Idée 4 : Résumé par IA des vidéos longues via Gemini
  const handleSummarizeVideo = async (video: OrbitVideo) => {
    try {
      const res = await fetch("/api/orbit/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: video.title,
          domain: video.domain,
          subdomain: video.subdomain,
          comment: video.comment,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrbitState((prev) => ({
          ...prev,
          videos: prev.videos.map((v) =>
            v.id === video.id
              ? {
                  ...v,
                  aiSummary: {
                    bullets: data.bullets,
                    verdict: data.verdict,
                    estimatedSavedMinutes: data.estimatedSavedMinutes || 12,
                  },
                }
              : v
          ),
        }));
      }
    } catch {
      setOrbitState((prev) => ({
        ...prev,
        videos: prev.videos.map((v) =>
          v.id === video.id
            ? {
                ...v,
                aiSummary: {
                  bullets: [
                    `Synthèse hors-ligne de « ${video.title} »`,
                    `Méthodologie clé dans ${video.subdomain}`,
                    `Avis curateur : ${video.comment}`,
                  ],
                  verdict: `Référence majeure du pilier ${video.domain}.`,
                  estimatedSavedMinutes: 12,
                },
              }
            : v
        ),
      }));
    }
  };

  // Idée 10 : Traduction Automatique des Commentaires via Gemini
  const handleTranslateComment = async (
    videoId: number,
    commentIdx: number,
    targetLang: string
  ) => {
    const targetVid = orbitState.videos.find((v) => v.id === videoId);
    const commentObj = targetVid?.commentsList[commentIdx];
    if (!commentObj) return;

    try {
      const res = await fetch("/api/orbit/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: commentObj.text,
          targetLang,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrbitState((prev) => ({
          ...prev,
          videos: prev.videos.map((v) =>
            v.id === videoId
              ? {
                  ...v,
                  commentsList: v.commentsList.map((c, idx) =>
                    idx === commentIdx
                      ? { ...c, translatedText: data.translatedText }
                      : c
                  ),
                }
              : v
          ),
        }));
      }
    } catch {
      setOrbitState((prev) => ({
        ...prev,
        videos: prev.videos.map((v) =>
          v.id === videoId
            ? {
                ...v,
                commentsList: v.commentsList.map((c, idx) =>
                  idx === commentIdx
                    ? {
                        ...c,
                        translatedText: `[${targetLang.toUpperCase()} Hors-Ligne] ${
                          c.text
                        }`,
                      }
                    : c
                ),
              }
            : v
        ),
      }));
    }
  };

  // Idée 2 : Ajouter ou Voter dans le Jukebox Collaboratif
  const handleAddToJukebox = (video: OrbitVideo) => {
    setOrbitState((prev) => {
      const exists = prev.jukebox.find((t) => t.videoId === video.id);
      if (exists) {
        return {
          ...prev,
          jukebox: prev.jukebox
            .map((t) =>
              t.videoId === video.id ? { ...t, boosts: t.boosts + 1 } : t
            )
            .sort((a, b) => b.boosts - a.boosts),
        };
      }
      const nextTrack: JukeboxTrack = {
        id: Date.now(),
        videoId: video.id,
        title: video.title,
        youtubeId: video.youtubeId,
        domain: video.domain,
        addedBy: prev.profile.name,
        boosts: 5,
        thumb: video.thumb,
      };
      return {
        ...prev,
        jukebox: [...prev.jukebox, nextTrack].sort(
          (a, b) => b.boosts - a.boosts
        ),
      };
    });
    showToast("Ajouté au Jukebox Collaboratif des Amis !");
    setOpenModal("jukebox");
  };

  const handleBoostJukeboxTrack = (trackId: number) => {
    setOrbitState((prev) => ({
      ...prev,
      jukebox: prev.jukebox
        .map((t) => (t.id === trackId ? { ...t, boosts: t.boosts + 1 } : t))
        .sort((a, b) => b.boosts - a.boosts),
    }));
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel("orbit_jukebox_live_v2");
      ch.postMessage({ type: "JUKEBOX_BOOST", trackId });
      ch.close();
    }
    setSyncQueue(
      OrbitStorageService.enqueueMutation("JUKEBOX_BOOST", { trackId })
    );
  };

  const handleSendJukeboxChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!jukeboxMsgInput.trim()) return;
    const msg: JukeboxChatMessage = {
      id: Date.now(),
      author: orbitState.profile.name,
      text: jukeboxMsgInput.trim(),
      time: new Date().toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setJukeboxChat((prev) => [...prev, msg]);
    setJukeboxMsgInput("");
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel("orbit_jukebox_live_v2");
      ch.postMessage({ type: "JUKEBOX_CHAT", msg });
      ch.close();
    }
  };

  // Idée 9 : Unlock a scheduled Time-Capsule immediately
  const handleUnlockTimeCapsule = (videoId: number) => {
    setOrbitState((prev) => ({
      ...prev,
      videos: prev.videos.map((v) =>
        v.id === videoId ? { ...v, unlockAt: undefined } : v
      ),
    }));
    showToast("Time-Capsule déverrouillée et propulsée dans le Flux !");
  };

  // Repost to personal wall
  const handleRepost = (orig: OrbitVideo, customNote: string) => {
    const copy: OrbitVideo = {
      ...orig,
      id: Date.now(),
      user: orbitState.profile.name,
      comment: customNote || orig.comment,
      hoursAgo: 1,
    };
    setOrbitState((prev) => ({
      ...prev,
      videos: [copy, ...prev.videos],
    }));
    showToast("Vidéo partagée sur votre Page personnelle !");
  };

  // Toggle secret domain
  const handleToggleDomainPrivacy = (domainId: number) => {
    setOrbitState((prev) => ({
      ...prev,
      domains: prev.domains.map((d) =>
        d.id === domainId ? { ...d, secret: !d.secret } : d
      ),
    }));
  };

  // Save profile edit
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    setOrbitState((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        name: editName.trim(),
        initials: editName.trim().substring(0, 2).toUpperCase(),
        bio: editBio.trim() || prev.profile.bio,
      },
    }));
    setEditingProfile(false);
    showToast("Profil Orbit mis à jour.");
  };

  // Enregistrer le consentement explicite RGPD
  const handleAcceptGdprConsent = () => {
    setOrbitState((prev) => ({
      ...prev,
      gdprConsentGiven: true,
    }));
    setSyncQueue(
      OrbitStorageService.enqueueMutation("GDPR_CONSENT_ACCEPTED", {
        timestamp: new Date().toISOString(),
      })
    );
  };

  // Ouvrir directement la modale sur un connecteur spécifique
  const handleOpenConnectorModal = (connectorId?: string) => {
    setSelectedConnectorForModal(connectorId || null);
    setOpenModal("sync");
  };

  // Appliquer une importation réelle de données (Contacts, YouTube OAuth2/Direct/Takeout, TikTok/Insta/Twitch/Facebook)
  const handleApplyNetworkImport = (payload: ImportedNetworkPayload) => {
    const syncTimeLabel = new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    setOrbitState((prev) => {
      const updatedSocials = prev.socials.map((s) => {
        if (s.id !== payload.connectorId) return s;
        const prevVids = s.importedVideosCount || 0;
        const prevChs = s.importedChannelsCount || 0;
        const prevCts = s.importedContactsCount || 0;
        const nextVids = prevVids + payload.newVideos.length;
        const nextChs = prevChs + payload.newChannels.length;
        const nextCts = prevCts + payload.newTwins.length;

        const mergedDeltas: Record<string, number> = {
          ...(s.affinityDeltas || {}),
        };
        Object.entries(payload.affinityDeltas).forEach(([domName, delta]) => {
          mergedDeltas[domName] = (mergedDeltas[domName] || 0) + delta;
        });

        let summary = payload.proofText;
        if (payload.connectorId === "whatsapp") {
          summary = `Connecté — ${nextCts} ami(s) importé(s)`;
        } else if (payload.connectorId === "youtube") {
          summary = `Connecté — ${nextVids} vidéo(s) & ${nextChs} chaîne(s) importées`;
        } else {
          summary = `Connecté — ${nextVids} vidéo(s) & ${nextChs} compte(s)/intérêt(s) importés`;
        }

        return {
          ...s,
          active: true,
          realConsentVerified: true,
          importedVideosCount: nextVids,
          importedChannelsCount: nextChs,
          importedContactsCount: nextCts,
          importedProofText: summary,
          importedVideoIds: [
            ...(s.importedVideoIds || []),
            ...payload.newVideos.map((v) => v.id),
          ],
          importedTwinNames: [
            ...(s.importedTwinNames || []),
            ...payload.newTwins.map((t) => t.name),
          ],
          importedChannelList: [
            ...(s.importedChannelList || []),
            ...payload.newChannels,
          ],
          affinityDeltas: mergedDeltas,
          lastSyncedAt: syncTimeLabel,
          methodUsed: payload.methodUsed,
        };
      });

      const updatedDomains = prev.domains.map((d) => {
        if (
          payload.exactDomainAffinities &&
          typeof payload.exactDomainAffinities[d.name] === "number"
        ) {
          return {
            ...d,
            affinity: payload.exactDomainAffinities[d.name],
          };
        }
        const delta = payload.affinityDeltas[d.name] || 0;
        if (!delta) return d;
        return {
          ...d,
          affinity: Math.min(100, d.affinity + delta),
        };
      });

      const normalizedNewVideos = payload.newVideos.map((v) => ({
        ...v,
        user: prev.profile.name,
        isFriend: true,
      }));

      const nextState: OrbitState = {
        ...prev,
        gdprConsentGiven: true,
        creatorPortfolioMode: false,
        socials: updatedSocials,
        videos: [...normalizedNewVideos, ...prev.videos],
        twins: [...payload.newTwins, ...prev.twins],
        domains: updatedDomains,
      };
      OrbitStorageService.saveState(nextState);
      return nextState;
    });

    if (payload.newChannels.length > 0) {
      setImportedChannels((prev) => [...payload.newChannels, ...prev].slice(0, 40));
    }

    if (payload.newTwins.length > 0) {
      const firstImportedFriend = payload.newTwins[0].name
        .replace(/\s*\(Répertoire\)/i, "")
        .trim();
      if (firstImportedFriend) {
        setCapFriend(firstImportedFriend);
      }
    }

    setSyncQueue(
      OrbitStorageService.enqueueMutation("REAL_DATA_IMPORT", {
        connectorId: payload.connectorId,
        method: payload.methodUsed,
        videosCount: payload.newVideos.length,
        channelsCount: payload.newChannels.length,
        contactsCount: payload.newTwins.length,
      })
    );

    showToast(`✓ ${payload.proofText} ! Vos 4 pages et vos 15 domaines ont été recalculés.`);
  };

  // Fonctionnalité 3 : Mode 'Découverte Automatique par IA' (Générer mon ADN sur-mesure : Tech/IA, Photo/Light Painting, Rap Boom-Bap, Astronomie/Solaire)
  const handleGenerateCustomAiDna = () => {
    const syncTimeLabel = new Date().toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const customAiAffinities: Record<string, number> = {
      "Sciences & Tech": 99,
      "Dev & Open Source": 98,
      "Création Numérique": 98,
      "Musique & Son": 97,
      "Cinéma & Séries": 93,
      "Sport & Aventure": 91,
      "Nature & Écologie": 89,
      "Artisanat & Cuisine": 86,
      "Culture & Idées": 85,
      "Architecture & Design": 84,
      "Jeux & Mondes Virtuels": 82,
      "Arts Visuels & Plastiques": 81,
      "Histoire & Civilisations": 79,
      "Bien-être & Quotidien": 77,
      "Humour & Scène": 75,
    };

    const customTailoredVideos: OrbitVideo[] = [
      {
        id: Date.now() + 1,
        title: "[ADN Sur-Mesure IA] Cluster Local LLM & Agents Souverains sur Serveur Ubuntu 24.04",
        platform: "youtube",
        ratio: "16-9",
        domain: "Dev & Open Source",
        subdomain: "Auto-hébergement",
        user: orbitState.profile.name,
        isFriend: true,
        comment: "Sélectionné par la Découverte Automatique IA pour votre profil Tech, Photo, Rap & Astronomie.",
        score: 9.9,
        votes: 840,
        hoursAgo: 1,
        youtubeId: "aircAruvnKk",
        rawUrl: "https://www.youtube.com/watch?v=aircAruvnKk",
        thumb: "https://i.ytimg.com/vi/aircAruvnKk/hqdefault.jpg",
        isScout: true,
        scoutRank: 1,
        durationMinutes: 24,
        certifiedArchive: true,
        archiveEras: ["live", "week", "month", "founder"],
        sourceConnectorId: "youtube",
        commentsList: [
          {
            author: "Anne-Sophie",
            text: "Ton profil ADN sur-mesure est calibré à la perfection sur l'IA souveraine !",
            stance: "pour",
          },
        ],
      },
      {
        id: Date.now() + 2,
        title: "[ADN Sur-Mesure IA] Chorégraphie Optique : Light Painting Nocturne & Hologrammes (RAW 4K)",
        platform: "instagram",
        ratio: "9-16",
        domain: "Création Numérique",
        subdomain: "Light Painting & Photo",
        user: orbitState.profile.name,
        isFriend: true,
        comment: "Pose longue 28 secondes en pleine garrigue, zéro retouche numérique.",
        score: 9.9,
        votes: 690,
        hoursAgo: 2,
        youtubeId: "EmKQsSDlaa4",
        rawUrl: "https://www.youtube.com/watch?v=EmKQsSDlaa4",
        thumb: "https://i.ytimg.com/vi/EmKQsSDlaa4/hqdefault.jpg",
        isScout: true,
        scoutRank: 1,
        durationMinutes: 6,
        certifiedArchive: true,
        archiveEras: ["live", "week", "6months"],
        sourceConnectorId: "instagram",
        commentsList: [
          {
            author: "Ronny",
            text: "Le rendu des fibres optiques dans le noir complet est magistral.",
            stance: "pour",
          },
        ],
      },
      {
        id: Date.now() + 3,
        title: "[ADN Sur-Mesure IA] L'Âge d'Or du Boom-Bap : Sampling Vinyle & Synthés Analogiques",
        platform: "youtube",
        ratio: "16-9",
        domain: "Musique & Son",
        subdomain: "Rap & Boom-Bap",
        user: orbitState.profile.name,
        isFriend: true,
        comment: "Classique intemporel injecté dans vos Coups de Cœur (Page 2) et votre Radar (Page 4).",
        score: 9.9,
        votes: 950,
        hoursAgo: 3,
        youtubeId: "jfKfPfyJRdk",
        rawUrl: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
        thumb: "https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg",
        isScout: true,
        scoutRank: 1,
        durationMinutes: 32,
        certifiedArchive: true,
        archiveEras: ["live", "month", "founder"],
        sourceConnectorId: "youtube",
        commentsList: [
          {
            author: "Babass",
            text: "Le grain analogique de la MPC 3000 sur ce sample jazz reste imbattable.",
            stance: "pour",
          },
        ],
      },
      {
        id: Date.now() + 4,
        title: "[ADN Sur-Mesure IA] Astrophysique & Transformations de Fourier dans le Cosmos",
        platform: "youtube",
        ratio: "16-9",
        domain: "Sciences & Tech",
        subdomain: "Physique & Cosmos",
        user: orbitState.profile.name,
        isFriend: true,
        comment: "Fusion entre observation cosmique infrarouge et mathématiques appliquées.",
        score: 9.8,
        votes: 760,
        hoursAgo: 4,
        youtubeId: "r6sGWTCMz2k",
        rawUrl: "https://www.youtube.com/watch?v=r6sGWTCMz2k",
        thumb: "https://i.ytimg.com/vi/r6sGWTCMz2k/hqdefault.jpg",
        isScout: true,
        scoutRank: 1,
        durationMinutes: 21,
        certifiedArchive: true,
        archiveEras: ["live", "month", "1year"],
        sourceConnectorId: "youtube",
        commentsList: [
          {
            author: "Nicolas",
            text: "Exactement la synthèse entre astronomie profonde et ingénierie qu'on cherchait !",
            stance: "pour",
          },
        ],
      },
    ];

    setOrbitState((prev) => {
      const nextDomains = prev.domains.map((d) => ({
        ...d,
        affinity: customAiAffinities[d.name] ?? d.affinity,
      }));

      const nextSocials = prev.socials.map((s) => {
        if (["youtube", "tiktok", "instagram", "whatsapp", "twitch", "facebook"].includes(s.id)) {
          return {
            ...s,
            active: true,
            realConsentVerified: true,
            lastSyncedAt: syncTimeLabel,
            methodUsed: "Mode Découverte Automatique par IA (ADN Sur-Mesure)",
            importedVideosCount:
              s.id === "youtube"
                ? 42
                : s.id === "tiktok"
                ? 8
                : s.id === "instagram"
                ? 7
                : s.importedVideosCount || 4,
            importedChannelsCount:
              s.id === "youtube" ? 28 : s.importedChannelsCount || 6,
            importedContactsCount: s.id === "whatsapp" ? 5 : 0,
            importedProofText:
              s.id === "youtube"
                ? "Connecté — 42 vidéos & 28 chaînes (Tech, Photo, Rap, Astronomie)"
                : s.id === "whatsapp"
                ? "Connecté — 5 amis (Anne-Sophie, Ronny, Nicolas, Séverine, Babass)"
                : `Connecté — ADN sur-mesure calibré (${syncTimeLabel})`,
          };
        }
        return s;
      });

      const nextState: OrbitState = {
        ...prev,
        gdprConsentGiven: true,
        domains: nextDomains,
        socials: nextSocials,
        videos: [...customTailoredVideos, ...prev.videos],
      };

      OrbitStorageService.saveState(nextState);
      return nextState;
    });

    setSyncQueue(
      OrbitStorageService.enqueueMutation("AI_CUSTOM_DNA_GENERATED", {
        profile: "Tech/IA, Photo/Light Painting, Rap/Boom-Bap, Astronomie/Solaire",
        timestamp: syncTimeLabel,
      })
    );

    setOpenModal(null);
    showToast(
      "✨ ADN Culturel sur-mesure généré et sauvegardé dans LocalStorage (51+ pépites actives) !"
    );
  };

  // Réparer et vérifier instantanément les 51 vidéos du catalogue officiel
  const handleRepairCatalog51 = () => {
    setOrbitState((prev) => {
      const defaultIdSet = new Set(DEFAULT_VIDEOS.map((dv) => dv.id));
      const customVideos = prev.videos.filter(
        (v) => v && !defaultIdSet.has(v.id) && v.id >= 3000
      );
      const nextState: OrbitState = {
        ...prev,
        domains: DEFAULT_DOMAINS,
        videos: [...customVideos, ...DEFAULT_VIDEOS],
        socials: DEFAULT_SOCIALS,
        portfolioItems: DEFAULT_PORTFOLIO_ITEMS,
        jukebox: DEFAULT_JUKEBOX,
        hideWatchedVideos: false,
      };
      OrbitStorageService.saveState(nextState);
      return nextState;
    });
    setFeedFilter("all");
    setSearchQuery("");
    showToast(
      `✓ Catalogue officiel réparé et vérifié : ${DEFAULT_VIDEOS.length} vidéos actives sur les 15 domaines !`
    );
  };

  // Révoquer l'accès & Effacer toutes les données importées d'un réseau (Transparence Totale RGPD)
  const handleRevokeNetwork = (connectorId: string) => {
    setOrbitState((prev) => {
      const target = prev.socials.find((s) => s.id === connectorId);
      if (!target) return prev;

      const videoIdsToRemove = new Set(target.importedVideoIds || []);
      const twinNamesToRemove = new Set(target.importedTwinNames || []);
      const deltasToReverse = target.affinityDeltas || {};

      const remainingVideos = prev.videos.filter(
        (v) =>
          v.sourceConnectorId !== connectorId && !videoIdsToRemove.has(v.id)
      );

      const remainingTwins = prev.twins.filter(
        (t) =>
          t.sourceNetwork !== connectorId && !twinNamesToRemove.has(t.name)
      );

      const restoredDomains = prev.domains.map((d) => {
        const delta = deltasToReverse[d.name] || 0;
        if (!delta) return d;
        return {
          ...d,
          affinity: Math.max(20, d.affinity - delta),
        };
      });

      const updatedSocials = prev.socials.map((s) =>
        s.id === connectorId
          ? {
              ...s,
              active: false,
              realConsentVerified: false,
              importedVideosCount: 0,
              importedChannelsCount: 0,
              importedContactsCount: 0,
              importedProofText: undefined,
              importedVideoIds: [],
              importedTwinNames: [],
              importedChannelList: [],
              affinityDeltas: {},
              lastSyncedAt: undefined,
              methodUsed: undefined,
            }
          : s
      );

      return {
        ...prev,
        socials: updatedSocials,
        videos: remainingVideos,
        twins: remainingTwins,
        domains: restoredDomains,
      };
    });

    setSyncQueue(
      OrbitStorageService.enqueueMutation("REVOKE_NETWORK_DATA", {
        connectorId,
      })
    );

    showToast(
      `🗑️ Accès révoqué pour ${connectorId.toUpperCase()} : toutes les données associées ont été effacées.`
    );
  };

  // Export JSON backup
  const handleExportJson = () => {
    OrbitStorageService.saveState(orbitState);
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(orbitState, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "orbit_backup_database.json");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast("💾 Sauvegarde JSON complète exportée avec succès !");
  };

  // Import / Restore JSON backup into LocalStorage
  const handleImportJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        if (parsed && Array.isArray(parsed.videos) && Array.isArray(parsed.domains)) {
          setOrbitState(parsed);
          OrbitStorageService.saveState(parsed);
          showToast(
            `✓ Base JSON restaurée dans LocalStorage (${parsed.videos.length} vidéos & 15 domaines) !`
          );
        } else {
          showToast("Ce fichier JSON est un historique YouTube : ouverture de l'Aspirateur YouTube...");
          handleOpenConnectorModal("youtube");
        }
      } catch {
        showToast("Fichier JSON invalide.");
      }
    };
    reader.readAsText(file);
  };

  // Reset demo data
  const handleResetDemo = () => {
    localStorage.clear();
    setOrbitState({
      profile: {
        name: "Valentin R.",
        initials: "VR",
        bio: "Créateur Tech, Image & Son · Explorateur des 15 Domaines",
        scoutPoints: 145,
        scoutBadges: 4,
        titleRole:
          "Directeur Créatif · Light Painter · Architecte Écosystème Alphabette",
        contactEmail: "valentin@alphabette.fr",
      },
      theme: "onyx",
      accent: "#7c5cff",
      domains: DEFAULT_DOMAINS,
      videos: DEFAULT_VIDEOS,
      socials: DEFAULT_SOCIALS,
      twins: DEFAULT_TWINS,
      jukebox: DEFAULT_JUKEBOX,
      challenges: DEFAULT_CHALLENGES,
      gdprConsentGiven: false,
      selectedArchiveEra: "live",
      pantheonShowAllDomainsArchive: false,
      focusAbsolu: false,
      radarGeoRadius: "50km",
      radarGeoZoneId: "montpellier-occitanie",
      watchLaterIds: [1004, 1002, 1001],
      quickImports: DEFAULT_QUICK_IMPORTS,
      creatorPortfolioMode: false,
      portfolioItems: DEFAULT_PORTFOLIO_ITEMS,
      creatorLinks: DEFAULT_CREATOR_LINKS,
      watchedVideoIds: [],
      hideWatchedVideos: false,
    });
    setSelectedConnectorForModal(null);
    setOpenModal("sync");
    showToast(
      "Données locales réinitialisées : tous les réseaux sont remis à Non connecté (Inactif)."
    );
  };

  // Mon coffre ORBIT : Appliquer un profil d'interface local instantanément (Zéro requête serveur)
  const handleApplyUiProfile = (preset: OrbitUiProfilePreset) => {
    document.documentElement.style.fontSize = `${preset.fontScale}%`;
    setFeedViewMode(preset.defaultFeedMode);
    setOrbitState((prev) => ({
      ...prev,
      theme: preset.theme,
      accent: preset.accent,
      hideWatchedVideos: preset.hideWatchedByDefault,
    }));
    setSyncQueue(
      OrbitStorageService.enqueueMutation("UI_PROFILE_SWITCHED", {
        profileId: preset.id,
        theme: preset.theme,
      })
    );
    showToast(
      `🎨 Profil d'interface « ${preset.name} » appliqué localement (0 requête réseau) !`
    );
  };

  // Mon coffre ORBIT : Restaurer ou fusionner une archive avec détection des doublons (Section 4)
  const handleRestoreVaultArchive = (
    archiveData: Record<string, unknown>,
    mode: "merge" | "replace"
  ) => {
    setOrbitState((prev) => {
      const incomingVideos = Array.isArray(archiveData.videos)
        ? (archiveData.videos as OrbitVideo[])
        : [];
      const existingIds = new Set(prev.videos.map((v) => v.id));
      const nextVideos =
        mode === "replace" && incomingVideos.length > 0
          ? incomingVideos
          : [
              ...incomingVideos.filter(
                (v) => v && typeof v.id === "number" && !existingIds.has(v.id)
              ),
              ...prev.videos,
            ];

      const incomingDomains = Array.isArray(archiveData.domains)
        ? (archiveData.domains as OrbitDomain[])
        : prev.domains;

      const incomingWatched = Array.isArray(archiveData.watchedVideoIds)
        ? (archiveData.watchedVideoIds as number[])
        : [];
      const nextWatched =
        mode === "replace"
          ? incomingWatched
          : Array.from(
              new Set([...(prev.watchedVideoIds || []), ...incomingWatched])
            );

      const incomingWatchLater = Array.isArray(archiveData.watchLaterIds)
        ? (archiveData.watchLaterIds as number[])
        : [];
      const nextWatchLater =
        mode === "replace"
          ? incomingWatchLater
          : Array.from(
              new Set([...(prev.watchLaterIds || []), ...incomingWatchLater])
            );

      const nextState: OrbitState = {
        ...prev,
        profile:
          archiveData.profile && typeof archiveData.profile === "object"
            ? { ...prev.profile, ...(archiveData.profile as OrbitProfile) }
            : prev.profile,
        theme:
          archiveData.theme === "onyx" ||
          archiveData.theme === "alabaster" ||
          archiveData.theme === "polar"
            ? archiveData.theme
            : prev.theme,
        accent:
          typeof archiveData.accent === "string"
            ? archiveData.accent
            : prev.accent,
        domains: incomingDomains,
        videos: nextVideos,
        watchedVideoIds: nextWatched,
        watchLaterIds: nextWatchLater,
      };
      OrbitStorageService.saveState(nextState);
      OrbitStorageService.saveWatchedVideoIds(nextWatched);
      return nextState;
    });

    setSyncQueue(
      OrbitStorageService.enqueueMutation("VAULT_IMPORT_MERGED", {
        mode,
        timestamp: new Date().toISOString(),
      })
    );

    showToast(
      mode === "merge"
        ? "✓ Archive fusionnée avec succès sans écraser vos données existantes !"
        : "✓ État local restauré depuis l'archive Mon coffre ORBIT !"
    );
  };

  const handleClearWatchedHistory = () => {
    OrbitStorageService.saveWatchedVideoIds([]);
    setOrbitState((prev) => ({
      ...prev,
      watchedVideoIds: [],
      hideWatchedVideos: false,
    }));
    showToast(
      "🧹 Historique de visionnage local effacé sur cet appareil (watchedVideoIds remis à 0)."
    );
  };

  const handleDeleteAccountServerData = () => {
    const disabledCfg: CloudConnectorConfig = {
      ...cloudConfig,
      enabled: false,
      provider: "local-sovereign",
      anonKey: "",
      lastSyncedAt: null,
    };
    setCloudConfig(disabledCfg);
    OrbitStorageService.saveCloudConfig(disabledCfg);
    handleResetDemo();
    setOpenModal(null);
    showToast(
      "🗑️ Toutes les connexions sociales et données du compte ont été révoquées et purgées (RGPD Art. 17)."
    );
  };

  const watchedIds = orbitState.watchedVideoIds || [];
  const hideWatched = Boolean(orbitState.hideWatchedVideos);

  // Separate unlocked videos vs locked Time-Capsules (Idée 9)
  const unlockedVideos = useMemo(
    () =>
      orbitState.videos.filter(
        (v) => !v.unlockAt || v.unlockAt <= nowTimestamp
      ),
    [orbitState.videos, nowTimestamp]
  );

  const lockedTimeCapsules = useMemo(
    () =>
      orbitState.videos.filter(
        (v) => v.unlockAt && v.unlockAt > nowTimestamp
      ),
    [orbitState.videos, nowTimestamp]
  );

  // Filtered Feed videos (Page 1) — Intègre Fonctionnalité 17 (Anti-Déjà-Vu) & Fonctionnalité 20 (Sélection QR scannée)
  const filteredFeedVideos = useMemo(() => {
    let list = [...unlockedVideos];
    if (scannedPlaylistBanner && scannedPlaylistBanner.videoIds.length > 0) {
      const setIds = new Set(scannedPlaylistBanner.videoIds);
      const matched = list.filter((v) => setIds.has(v.id));
      if (matched.length > 0) {
        return matched;
      }
    }
    if (hideWatched) {
      list = list.filter((v) => !watchedIds.includes(v.id));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.domain.toLowerCase().includes(q) ||
          v.subdomain.toLowerCase().includes(q) ||
          v.user.toLowerCase().includes(q) ||
          v.comment.toLowerCase().includes(q)
      );
    }
    if (feedFilter === "friends") list = list.filter((v) => v.isFriend);
    else if (feedFilter === "youtube")
      list = list.filter((v) => v.platform === "youtube");
    else if (feedFilter === "vertical")
      list = list.filter((v) => v.ratio === "9-16");
    else if (feedFilter === "top95") list = list.filter((v) => v.score >= 9.5);
    return list;
  }, [
    unlockedVideos,
    searchQuery,
    feedFilter,
    hideWatched,
    watchedIds,
    scannedPlaylistBanner,
  ]);

  // Filtered Profile videos (Page 2) — Vos vidéos partagées (Facebook, YouTube, TikTok, Instagram) apparaissent toujours en tête de Ma Page
  const filteredProfileVideos = useMemo(() => {
    if (profileTab === "capsules") {
      return lockedTimeCapsules;
    }
    let list = [...unlockedVideos];
    if (profileTab === "wall") {
      list = list
        .filter(
          (v) =>
            v.user === orbitState.profile.name ||
            v.isFriend ||
            v.id >= 3000 ||
            Boolean(v.importedVia) ||
            Boolean(v.sourceConnectorId)
        )
        .sort((a, b) => {
          const aIsOwn =
            a.user === orbitState.profile.name ||
            a.id >= 3000 ||
            Boolean(a.importedVia) ||
            Boolean(a.sourceConnectorId);
          const bIsOwn =
            b.user === orbitState.profile.name ||
            b.id >= 3000 ||
            Boolean(b.importedVia) ||
            Boolean(b.sourceConnectorId);
          if (aIsOwn && !bIsOwn) return -1;
          if (!aIsOwn && bIsOwn) return 1;
          if (aIsOwn && bIsOwn) return b.id - a.id;
          return 0;
        });
    } else if (profileTab === "favs") {
      list = list.filter((v) => v.score >= 9.5);
    } else if (profileTab === "secret") {
      const secretNames = orbitState.domains
        .filter((d) => d.secret)
        .map((d) => d.name);
      list = list.filter((v) => secretNames.includes(v.domain));
    }
    return list;
  }, [
    unlockedVideos,
    lockedTimeCapsules,
    orbitState.profile.name,
    orbitState.domains,
    profileTab,
  ]);

  // Page 2 Immersion Reels videos (combines Creator Portfolio creations + published videos + favorites)
  const page2ImmersionVideos = useMemo<OrbitVideo[]>(() => {
    const portfolioList = (
      orbitState.portfolioItems || DEFAULT_PORTFOLIO_ITEMS
    ).map((item, idx): OrbitVideo => {
      const domainMap: Record<string, string> = {
        "light-painting": "Création Numérique",
        video: "Cinéma & Séries",
        music: "Musique & Son",
        "tech-art": "Dev & Open Source",
      };
      const extLower = (item.externalUrl || "").toLowerCase();
      const isFbItem =
        extLower.includes("facebook.com") ||
        extLower.includes("fb.watch") ||
        extLower.includes("fb.com");
      return {
        id: 80000 + idx,
        user: orbitState.profile.name,
        isFriend: true,
        isScout: true,
        scoutRank: 1,
        platform: isFbItem ? "facebook" : "youtube",
        ratio: "9-16",
        domain: domainMap[item.category] || "Création Numérique",
        subdomain: item.mediumLabel,
        title: `[Portfolio Pro · ${item.year}] ${item.title}`,
        comment: `${item.specs} — ${item.description}`,
        score: 9.9,
        votes: 420 + idx * 35,
        hoursAgo: idx + 1,
        durationMinutes: 6,
        youtubeId: item.youtubeId || "aircAruvnKk",
        rawUrl: item.externalUrl || "https://alphabette.fr",
        thumb: item.thumb,
        commentsList: [
          {
            author: "Galerie_Orbit",
            text: `Œuvre certifiée du Portfolio Professionnel (${item.dimensionsOrDuration}).`,
            stance: "pour",
          },
        ],
      };
    });

    if (orbitState.creatorPortfolioMode) {
      return [...portfolioList, ...filteredProfileVideos];
    }
    if (filteredProfileVideos.length > 0) {
      return [...filteredProfileVideos, ...portfolioList];
    }
    return [...portfolioList, ...unlockedVideos];
  }, [
    orbitState.portfolioItems,
    orbitState.creatorPortfolioMode,
    orbitState.profile.name,
    filteredProfileVideos,
    unlockedVideos,
  ]);

  // Fonctionnalité 11 : Panthéon Historique (Page 3) + Fonctionnalité 17 (Anti-Déjà-Vu)
  const selectedArchiveEra = orbitState.selectedArchiveEra || "live";
  const currentArchiveMeta =
    PANTHEON_ARCHIVE_ERAS.find((e) => e.id === selectedArchiveEra) ||
    PANTHEON_ARCHIVE_ERAS[0];

  const pantheonVideos = useMemo(() => {
    const basePool = hideWatched
      ? unlockedVideos.filter((v) => !watchedIds.includes(v.id))
      : unlockedVideos;

    const effectivePool = basePool.length > 0 ? basePool : unlockedVideos;

    if (
      selectedArchiveEra !== "live" &&
      orbitState.pantheonShowAllDomainsArchive
    ) {
      const allDomainsList = orbitState.domains.map((dom, idx) => {
        const domainMatch = effectivePool.find(
          (v) =>
            v.domain === dom.name &&
            v.archiveEras &&
            v.archiveEras.includes(selectedArchiveEra)
        );
        if (domainMatch) return domainMatch;
        const anyDomainMatch = effectivePool.find((v) => v.domain === dom.name);
        if (anyDomainMatch) {
          return {
            ...anyDomainMatch,
            certifiedArchive: true,
            archiveDateLabel: `${currentArchiveMeta.periodBadge} · N°1 ${dom.name}`,
          };
        }
        const baseFallback =
          effectivePool[idx % Math.max(1, effectivePool.length)] ||
          unlockedVideos[0];
        return {
          ...baseFallback,
          id: 9000 + dom.id * 10 + idx,
          domain: dom.name,
          subdomain: dom.subs[0],
          title: `[Archive ${currentArchiveMeta.label}] Champion ${dom.name} — ${dom.subs[0]}`,
          score: Number((9.9 - (idx % 4) * 0.1).toFixed(1)),
          votes: 640 + dom.id * 45,
          certifiedArchive: true,
          archiveDateLabel: `${currentArchiveMeta.periodBadge} · N°1 ${dom.name}`,
        };
      });
      return hideWatched
        ? allDomainsList.filter((v) => !watchedIds.includes(v.id))
        : allDomainsList;
    }

    let list = basePool.filter((v) => v.domain === activePillar);
    if (selectedArchiveEra !== "live") {
      const eraMatches = list.filter(
        (v) => v.archiveEras && v.archiveEras.includes(selectedArchiveEra)
      );
      if (eraMatches.length > 0) {
        list = eraMatches;
      } else {
        const globalEraMatches = basePool.filter(
          (v) => v.archiveEras && v.archiveEras.includes(selectedArchiveEra)
        );
        if (globalEraMatches.length > 0) {
          list = globalEraMatches;
        }
      }
    }

    if (activeSubpillar !== "Tous") {
      const subMatches = list.filter((v) => v.subdomain === activeSubpillar);
      if (subMatches.length > 0) list = subMatches;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.subdomain.toLowerCase().includes(q) ||
          v.user.toLowerCase().includes(q)
      );
    }
    if (list.length === 0 && !hideWatched) {
      list = [...unlockedVideos];
    } else if (list.length === 0 && hideWatched) {
      list = [...basePool];
    }

    return [...list].sort((a, b) => {
      if (selectedArchiveEra !== "live") {
        return (
          b.score * Math.log10(b.votes + 10) -
          a.score * Math.log10(a.votes + 10)
        );
      }
      if (pantheonMode === "gravity") {
        const gA =
          (a.score * Math.log10(a.votes + 10)) /
          Math.pow(a.hoursAgo + 2, 0.65);
        const gB =
          (b.score * Math.log10(b.votes + 10)) /
          Math.pow(b.hoursAgo + 2, 0.65);
        return gB - gA;
      }
      if (pantheonMode === "emerging") return a.hoursAgo - b.hoursAgo;
      if (pantheonMode === "alltime")
        return b.score * b.votes - a.score * a.votes;
      return b.score - a.score;
    });
  }, [
    unlockedVideos,
    activePillar,
    activeSubpillar,
    pantheonMode,
    searchQuery,
    selectedArchiveEra,
    orbitState.pantheonShowAllDomainsArchive,
    orbitState.domains,
    currentArchiveMeta,
    hideWatched,
    watchedIds,
  ]);

  // Fonctionnalité 13 : Radar Géolocalisé Privé + Fonctionnalité 17 (Anti-Déjà-Vu)
  const activeGeoZone = useMemo(
    () =>
      GEO_ZONE_PRESETS.find((z) => z.id === orbitState.radarGeoZoneId) ||
      GEO_ZONE_PRESETS[0],
    [orbitState.radarGeoZoneId]
  );
  const activeGeoRadius: GeoRadius = orbitState.radarGeoRadius || "50km";

  const localGeoVideos = useMemo(() => {
    const pool = hideWatched
      ? unlockedVideos.filter((v) => !watchedIds.includes(v.id))
      : unlockedVideos;
    return pool
      .filter((v) => {
        if (!v.localGeo) return activeGeoRadius === "region";
        if (activeGeoRadius === "10km") return v.localGeo.radius10km;
        if (activeGeoRadius === "50km") return v.localGeo.radius50km;
        return v.localGeo.region;
      })
      .sort(
        (a, b) =>
          (b.localGeo?.localScore || b.score) -
          (a.localGeo?.localScore || a.score)
      );
  }, [unlockedVideos, activeGeoRadius, hideWatched, watchedIds]);

  // Fonctionnalité 14 : Panier Intelligent 'À regarder ce soir'
  const watchLaterIds = orbitState.watchLaterIds || [];
  const watchLaterVideos = useMemo(() => {
    return watchLaterIds
      .map((id) => orbitState.videos.find((v) => v.id === id))
      .filter((v): v is OrbitVideo => Boolean(v));
  }, [watchLaterIds, orbitState.videos]);

  const watchLaterByDuration = useMemo(() => {
    const short = watchLaterVideos.filter(
      (v) => (v.durationMinutes || 12) < 5
    );
    const medium = watchLaterVideos.filter(
      (v) =>
        (v.durationMinutes || 12) >= 5 && (v.durationMinutes || 12) <= 20
    );
    const long = watchLaterVideos.filter(
      (v) => (v.durationMinutes || 12) > 20
    );
    return { short, medium, long };
  }, [watchLaterVideos]);

  const watchLaterTotalMinutes = useMemo(
    () =>
      watchLaterVideos.reduce((acc, v) => acc + (v.durationMinutes || 12), 0),
    [watchLaterVideos]
  );

  // Radar videos (Page 4) — Integrates Idée 6 (Mood of the Day) + Calibration Slider + Fonctionnalité 17 (Anti-Déjà-Vu)
  const radarVideos = useMemo(() => {
    const moodObj = MOOD_PRESETS.find((m) => m.id === activeMood);
    let baseList = hideWatched
      ? unlockedVideos.filter((v) => !watchedIds.includes(v.id))
      : [...unlockedVideos];
    if (moodObj && moodObj.domains.length > 0) {
      const moodFiltered = baseList.filter((v) =>
        moodObj.domains.includes(v.domain)
      );
      if (moodFiltered.length > 0) {
        baseList = moodFiltered;
      }
    }

    return baseList.sort((a, b) => {
      const domA =
        orbitState.domains.find((d) => d.name === a.domain)?.affinity || 50;
      const domB =
        orbitState.domains.find((d) => d.name === b.domain)?.affinity || 50;
      return radarExploration > 60 ? domA - domB : domB - domA;
    });
  }, [
    unlockedVideos,
    orbitState.domains,
    radarExploration,
    activeMood,
    hideWatched,
    watchedIds,
  ]);

  const activeSocialsCount = orbitState.socials.filter(
    (s) => s.active && s.realConsentVerified
  ).length;
  const activePillarObj =
    orbitState.domains.find((d) => d.name === activePillar) ||
    orbitState.domains[0];

  const capsuleShareUrl = `https://alphabette.fr/?capsule=${encodeURIComponent(
    capFriend || "Ami"
  )}&domain=${encodeURIComponent(capDomain)}`;
  const capsuleMessage = `Salut ${
    capFriend || "mon ami"
  } ! Je t'ai préparé ta capsule vidéo personnalisée sur ORBIT dans le domaine "${capDomain}". J'ai sélectionné 3 pépites qui correspondent à 95% à nos goûts communs : ${capsuleShareUrl}`;

  const isVerticalImmersionActive =
    (activePage === "p1" ||
      activePage === "p2" ||
      activePage === "p3" ||
      activePage === "p4") &&
    feedViewMode === "immersion";

  const activeImmersionVideos = useMemo<OrbitVideo[]>(() => {
    if (activePage === "p1") return filteredFeedVideos;
    if (activePage === "p2") return page2ImmersionVideos;
    if (activePage === "p3") return pantheonVideos;
    if (activePage === "p4") return radarVideos;
    return filteredFeedVideos;
  }, [
    activePage,
    filteredFeedVideos,
    page2ImmersionVideos,
    pantheonVideos,
    radarVideos,
  ]);

  const activeImmersionContextLabel = useMemo<string>(() => {
    if (activePage === "p1") {
      return "Page 1 · Le Flux (Abonnements & Amis)";
    }
    if (activePage === "p2") {
      if (orbitState.creatorPortfolioMode) {
        return `Page 2 · Portfolio Professionnel (${orbitState.profile.name})`;
      }
      const tabNames: Record<ProfileTab, string> = {
        wall: "Mon Mur de Publications",
        favs: "Mes Coups de Cœur ≥ 9.5",
        secret: "Mon Jardin Secret",
        capsules: "Mes Time-Capsules",
      };
      return `Page 2 · Ma Page (${tabNames[profileTab]})`;
    }
    if (activePage === "p3") {
      return selectedArchiveEra !== "live"
        ? `Page 3 · Panthéon Historique (${currentArchiveMeta.label}) · ${activePillar}`
        : `Page 3 · Le Panthéon · ${activePillar} › ${activeSubpillar}`;
    }
    if (activePage === "p4") {
      const moodLabel =
        MOOD_PRESETS.find((m) => m.id === activeMood)?.label || "Radar";
      return `Page 4 · Le Radar Infinie (${moodLabel})`;
    }
    return "Mode Immersion Reels";
  }, [
    activePage,
    orbitState.creatorPortfolioMode,
    orbitState.profile.name,
    profileTab,
    selectedArchiveEra,
    currentArchiveMeta.label,
    activePillar,
    activeSubpillar,
    activeMood,
  ]);

  // Helper to open PiP and mark watched (Fonctionnalité 17)
  const handleLaunchPip = (video: OrbitVideo) => {
    setPipVideo(video);
    handleMarkVideoWatched(video.id);
  };

  // Helper to open Cinema Mode and mark watched (Fonctionnalité 17)
  const handleLaunchCinema = (video: OrbitVideo) => {
    setCinemaModalVideo(video);
    handleMarkVideoWatched(video.id);
  };

  // Fonctionnalité 20 : Ouvrir le générateur de QR Code pour la sélection de la Page 2 ou Page 3
  const handleOpenQrForPage2 = () => {
    const selectionList =
      filteredProfileVideos.length > 0 ? filteredProfileVideos : unlockedVideos;
    const tabLabels: Record<ProfileTab, string> = {
      wall: "Mon Mur de Publications",
      favs: "Mes Coups de Cœur (≥ 9.5/10)",
      secret: "Mon Jardin Secret",
      capsules: "Mes Time-Capsules",
    };
    setQrModalConfig({
      isOpen: true,
      title: orbitState.creatorPortfolioMode
        ? `Portfolio Créateur — ${orbitState.profile.name}`
        : `${tabLabels[profileTab]} — ${orbitState.profile.name}`,
      subtitle: orbitState.creatorPortfolioMode
        ? "Sélection officielle d'œuvres Light Painting, Vidéo 4K & Créations"
        : `Sélection personnelle issue de Ma Page Orbit (${selectionList.length} vidéos)`,
      sourcePageLabel: "Page 2 · Profil & Portfolio",
      videos: selectionList,
    });
  };

  const handleOpenQrForPage3 = () => {
    const selectionList =
      pantheonVideos.length > 0 ? pantheonVideos : unlockedVideos;
    setQrModalConfig({
      isOpen: true,
      title:
        selectedArchiveEra !== "live"
          ? `Panthéon Historique (${currentArchiveMeta.label}) — ${activePillar}`
          : `Panthéon ${activePillar} (${activeSubpillar})`,
      subtitle: `Top officiel certifié « 1 membre = 1 vote » (${currentArchiveMeta.periodBadge})`,
      sourcePageLabel: "Page 3 · Le Panthéon",
      videos: selectionList,
    });
  };

  // Fonctionnalité 12 : Rendu exclusif du Mode 'Focus Absolu' (Zéro Distraction) lorsqu'il est actif
  const focusQueue =
    activeImmersionVideos.length > 0 ? activeImmersionVideos : unlockedVideos;
  const currentFocusVideo =
    focusQueue[focusVideoIndex % Math.max(1, focusQueue.length)] ||
    unlockedVideos[0];

  if (orbitState.focusAbsolu && currentFocusVideo) {
    return (
      <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-between p-4 sm:p-8 select-none">
        {/* Minimalist Top Bar: Zen Status + Exit Button */}
        <div className="w-full max-w-6xl flex items-center justify-between opacity-40 hover:opacity-100 transition-opacity duration-300">
          <div className="flex items-center gap-2 text-xs font-mono-num tracking-wider uppercase text-white/70">
            <Eye className="w-4 h-4 text-cyan-400" />
            <span>Mode Focus Absolu · Zéro Distraction</span>
            <span>·</span>
            <span>
              {focusVideoIndex + 1} / {focusQueue.length}
            </span>
          </div>
          <button
            type="button"
            onClick={handleToggleFocusAbsolu}
            className="px-4 py-2 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-white cursor-pointer inline-flex items-center gap-2 transition-all"
          >
            <EyeOff className="w-3.5 h-3.5 text-amber-300" />
            <span>Quitter Focus Absolu (Échap)</span>
          </button>
        </div>

        {/* Pure Centered Video Player Stage */}
        <div className="w-full max-w-5xl flex-1 flex items-center justify-center my-4">
          <div
            className={`relative overflow-hidden rounded-3xl bg-black border border-white/10 shadow-2xl ${
              currentFocusVideo.ratio === "9-16"
                ? "h-[76vh] aspect-[9/16]"
                : "w-full aspect-video max-h-[76vh]"
            }`}
          >
            <iframe
              key={currentFocusVideo.id}
              width="100%"
              height="100%"
              src={getVideoEmbedConfig(currentFocusVideo).embedUrl}
              title={currentFocusVideo.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full"
            />
          </div>
        </div>

        {/* Minimalist Bottom Control: Title + Next Video Button */}
        <div className="w-full max-w-3xl flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-white/10">
          <div className="text-center sm:text-left min-w-0">
            <div className="text-[11px] font-semibold text-white/60">
              {currentFocusVideo.domain} › {currentFocusVideo.subdomain}
            </div>
            <div className="text-sm sm:text-base font-bold text-white truncate max-w-md font-display">
              {currentFocusVideo.title}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                setFocusVideoIndex(
                  (prev) => (prev - 1 + focusQueue.length) % focusQueue.length
                )
              }
              className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 border border-white/15 text-white cursor-pointer inline-flex items-center gap-1.5 transition-all"
            >
              <SkipBack className="w-4 h-4" />
              <span>Précédente</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setFocusVideoIndex((prev) => (prev + 1) % focusQueue.length)
              }
              className="px-6 py-3 rounded-2xl text-xs sm:text-sm font-black text-black bg-white hover:bg-cyan-300 cursor-pointer inline-flex items-center gap-2 transition-all shadow-lg"
            >
              <span>Passer à la vidéo suivante</span>
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        isVerticalImmersionActive && (!immersiveNavOpen || !immersiveUiVisible)
          ? "min-h-screen w-full bg-black overflow-hidden"
          : "min-h-screen max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[268px_1fr]"
      }
    >
      {/* SIDEBAR / BOTTOM NAVIGATION — MASQUÉE PAR DÉFAUT EN MODE IMMERSIF, ACCESSIBLE À LA DEMANDE */}
      <aside
        className={`fixed bottom-0 left-0 right-0 h-14 lg:static lg:h-screen lg:sticky lg:top-0 z-40 flex lg:flex-col justify-between px-3 py-1.5 lg:p-5 transition-all duration-300 ${
          isVerticalImmersionActive && (!immersiveNavOpen || !immersiveUiVisible)
            ? "hidden pointer-events-none opacity-0"
            : cinemaMode
            ? "lg:opacity-15 lg:hover:opacity-100"
            : "opacity-100"
        }`}
        style={{
          background: isVerticalImmersionActive
            ? "rgba(9, 10, 15, 0.88)"
            : "var(--bg-surface)",
          backdropFilter: "var(--glass-heavy)",
          WebkitBackdropFilter: "var(--glass-heavy)",
          borderRight: "1px solid var(--border)",
          borderTop: "1px solid var(--border)",
          boxShadow: "var(--specular-top)",
        }}
      >
        <div className="w-full">
          {/* Brand Header (Desktop) */}
          <div
            className="hidden lg:flex items-center justify-between gap-2 pb-5 mb-5"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-lg relative shrink-0"
                style={{
                  background:
                    "linear-gradient(135deg, var(--accent), var(--accent-2))",
                  boxShadow:
                    "inset 0 1px 0 0 rgba(255,255,255,0.35), 0 0 24px var(--accent-glow)",
                }}
              >
                O
              </div>
              <div className="min-w-0">
                <div className="text-xl font-black tracking-tight font-display">
                  ORBIT
                </div>
                <div
                  className="text-[11px] truncate"
                  style={{ color: "var(--text-muted)" }}
                >
                  ⚡ {orbitState.profile.scoutPoints || 145} pts Éclaireur
                </div>
              </div>
            </div>
          </div>

          {/* 5 Core Navigation Items */}
          <nav className="flex lg:flex-col justify-around lg:justify-start gap-1 w-full">
            {[
              { id: "p1" as PageId, label: "Le Flux", badge: "P.1", icon: Zap },
              {
                id: "p2" as PageId,
                label: "Ma Page",
                badge: "P.2",
                icon: User,
              },
              {
                id: "p3" as PageId,
                label: "Le Panthéon",
                badge: "P.3",
                icon: Trophy,
              },
              {
                id: "p4" as PageId,
                label: "Le Radar",
                badge: "P.4",
                icon: Compass,
              },
              {
                id: "p5" as PageId,
                label: "Réglage et Importation",
                badge: "P.5",
                icon: Link2,
              },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActivePage(item.id);
                    setFeedViewMode("grid");
                    setImmersiveNavOpen(false);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`flex flex-col lg:flex-row items-center gap-0.5 lg:gap-3 px-2 py-1.5 lg:px-3.5 lg:py-3 rounded-xl text-[10px] lg:text-sm font-semibold cursor-pointer transition-all flex-1 lg:flex-initial whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "hover:bg-white/5 active:scale-95"
                  }`}
                  style={{
                    color: isActive ? "#ffffff" : "var(--text-muted)",
                    border: isActive
                      ? "1px solid rgba(255,255,255,0.2)"
                      : "1px solid transparent",
                  }}
                >
                  <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" />
                  <span>{item.label}</span>
                  <span className="hidden lg:inline-block ml-auto text-[11px] font-mono-num opacity-80">
                    {item.badge}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Quick Action Buttons in Sidebar (Desktop) */}
          <div
            className="hidden lg:flex flex-col gap-2 mt-5 pt-5"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            {/* Bascule Globale 4 Pages : Mode Immersion Reels vs Mode Grille */}
            {activePage !== "p5" && (
              <button
                type="button"
                onClick={() =>
                  setFeedViewMode((m) => (m === "immersion" ? "grid" : "immersion"))
                }
                className="w-full py-2.5 px-3 rounded-xl text-xs font-extrabold text-white inline-flex items-center justify-between gap-2 cursor-pointer btn-couture whitespace-nowrap shrink-0"
                style={{
                  background:
                    feedViewMode === "immersion"
                      ? "linear-gradient(135deg, #0284c7, #5e35ff)"
                      : "linear-gradient(135deg, #0f172a, #1e293b)",
                  border: "1px solid rgba(56, 189, 248, 0.45)",
                }}
              >
                <span className="inline-flex items-center gap-1.5">
                  {feedViewMode === "immersion" ? (
                    <>
                      <LayoutGrid className="w-3.5 h-3.5 text-cyan-300" />
                      <span>🎛️ Mode Grille</span>
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-3.5 h-3.5 text-cyan-300" />
                      <span>📱 Mode Immersion Reels</span>
                    </>
                  )}
                </span>
                <span className="font-mono-num text-[10px] text-cyan-200">
                  4 Pages
                </span>
              </button>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="py-2.5 px-2.5 rounded-xl text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer btn-couture whitespace-nowrap shrink-0"
                style={{
                  background: "linear-gradient(135deg, var(--accent), #5e35ff)",
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Publier</span>
              </button>

              {/* Fonctionnalité 15 : Bouton 'Coller rapide' */}
              <button
                type="button"
                onClick={handleQuickPasteButton}
                className="py-2.5 px-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0"
                style={{ color: "var(--accent-2)" }}
                title="Passerelle d'Import Rapide Telegram / Discord / Presse-Papiers"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Coller rapide</span>
              </button>
            </div>

            {/* Fonctionnalité 17 : Interrupteur global 'Masquer les vidéos déjà vues' dans la barre latérale */}
            <button
              type="button"
              onClick={handleToggleHideWatched}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-between gap-2 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0"
              style={{
                borderColor: hideWatched
                  ? "rgba(16, 185, 129, 0.6)"
                  : undefined,
                color: hideWatched ? "var(--success)" : "var(--text-main)",
              }}
              title="Filtre Intelligent Anti-Déjà-Vu (watchedVideoIds)"
            >
              <span className="inline-flex items-center gap-1.5">
                {hideWatched ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span>
                  {hideWatched ? "✓ Inédites seules" : "Anti-Déjà-Vu"}
                </span>
              </span>
              <span className="font-mono-num text-[10px] opacity-85">
                {watchedIds.length} vues
              </span>
            </button>

            {/* Fonctionnalité 14 : Panier Intelligent 'À regarder ce soir' */}
            <button
              type="button"
              onClick={() => setWatchLaterDrawerOpen(true)}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-between gap-2 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0"
              style={{ color: "var(--warning)" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>⏳ À regarder ce soir</span>
              </span>
              <span className="font-mono-num text-[11px] opacity-90">
                {watchLaterVideos.length} ({watchLaterTotalMinutes}m)
              </span>
            </button>

            {/* Idée 2 : Jukebox Collaboratif Live */}
            <button
              type="button"
              onClick={() => setOpenModal("jukebox")}
              className="w-full py-2 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-between gap-2 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0"
              style={{ color: "var(--success)" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5" />
                <span>Jukebox Amis Live</span>
              </span>
              <span className="font-mono-num text-[11px] opacity-80">
                {orbitState.jukebox.length} titres
              </span>
            </button>

            {/* Raccourci vers la Page 5 : Réglage et Importation (La Passerelle) */}
            <button
              type="button"
              onClick={() => {
                setActivePage("p5");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="w-full py-2 px-3 rounded-xl text-[11px] font-black text-white inline-flex items-center justify-between gap-1.5 cursor-pointer btn-couture whitespace-nowrap shrink-0"
              style={{
                background: "linear-gradient(135deg, #e53935, #ff5252)",
              }}
              title="Ouvrir la Page 5 : Réglage et Importation (YouTube, TikTok, Instagram, Contacts)"
            >
              <span className="inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>📥 Réglage & Importation</span>
              </span>
              <span className="font-mono-num text-[10px] opacity-90">
                Page 5
              </span>
            </button>

            <button
              type="button"
              onClick={handleGenerateCustomAiDna}
              className="w-full py-2 px-3 rounded-xl text-[11px] font-black text-black inline-flex items-center justify-between gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-transform hover:scale-[1.01]"
              style={{
                background: "linear-gradient(135deg, #00e676, #00e5ff)",
              }}
              title="Mode Découverte Automatique par IA : Générer mon ADN sur-mesure (Tech, Photo, Rap, Astronomie)"
            >
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Générer mon ADN sur-mesure</span>
              </span>
              <span className="font-mono-num text-[10px] font-extrabold">
                IA
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  setActivePage("p5");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="py-2 px-2.5 rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0"
              >
                <Link2 className="w-3.5 h-3.5" style={{ color: "var(--accent-2)" }} />
                <span>Passerelle ({activeSocialsCount}/6)</span>
              </button>
              <button
                type="button"
                onClick={() => setOpenModal("design")}
                className="py-2 px-2.5 rounded-xl text-[11px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0"
              >
                <Palette className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                <span>Studio</span>
              </button>
            </div>

            {/* Mon coffre ORBIT — Souveraineté Numérique & Contrôle Local-First */}
            <button
              type="button"
              onClick={() => setOpenModal("vault")}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-black text-white inline-flex items-center justify-between gap-1.5 cursor-pointer btn-couture whitespace-nowrap shrink-0"
              style={{
                background: "linear-gradient(135deg, #059669, #0284c7)",
              }}
              title="Ouvrir Mon coffre ORBIT : Mes données, export 1-clic, import, synchronisation sélective & profils d'interface"
            >
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>🛡️ Mon coffre ORBIT</span>
              </span>
              <span className="font-mono-num text-[10px] opacity-95">
                Local-First
              </span>
            </button>

            {/* Prompt 3 : 24/7 Offline & Cloud Sync Button */}
            <button
              type="button"
              onClick={() => setOpenModal("resilience")}
              className="w-full py-2 px-3 rounded-xl text-[11px] font-bold inline-flex items-center justify-between gap-1.5 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0"
              style={{ color: "var(--accent-2)" }}
            >
              <span className="inline-flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5" />
                <span>Résilience 24/7 & Cloud</span>
              </span>
              <span className="font-mono-num text-[10px] opacity-80">
                {swStats.totalCached} cache
              </span>
            </button>
          </div>
        </div>

        {/* Sidebar Footer (Desktop) — Sauvegarde Persistante Totale LocalStorage + Export/Import JSON */}
        <div
          className="hidden lg:block pt-4 text-xs space-y-2"
          style={{
            borderTop: "1px solid var(--border)",
            color: "var(--text-muted)",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold" style={{ color: "var(--text-main)" }}>
              LocalStorage ({orbitState.videos.length} vidéos)
            </span>
            <span
              className="font-mono-num text-[10px] font-bold"
              style={{ color: "var(--success)" }}
            >
              Persistant ✓
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={handleExportJson}
              className="px-2.5 py-2 rounded-xl font-bold text-[11px] inline-flex items-center justify-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0 text-emerald-300"
              title="Sauvegarder et exporter toutes vos données LocalStorage en JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Sauvegarder JSON</span>
            </button>
            <input
              ref={jsonImportFileRef}
              type="file"
              accept=".json"
              onChange={handleImportJsonBackup}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => jsonImportFileRef.current?.click()}
              className="px-2.5 py-2 rounded-xl font-bold text-[11px] inline-flex items-center justify-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0 text-cyan-300"
              title="Restaurer une sauvegarde JSON dans LocalStorage"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Restaurer JSON</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ==========================================================
          MAIN VIEWPORT (100% FULL-BLEED VERTICAL IMMERSION ON P1, P2, P3, P4 OR GRID)
          ========================================================== */}
      {isVerticalImmersionActive ? (
        <main className="relative w-full orbit-immersive-viewport overflow-hidden bg-black">
          {/* ON-DEMAND NAVIGATION & FILTER BAR (ONLY VISIBLE WHEN USER OPENS NAVIGATION IN MODE INTERACTION) */}
          <div
            className={`absolute top-12 inset-x-3 sm:inset-x-6 z-30 flex items-center justify-between gap-2 flex-wrap transition-all duration-200 ${
              immersiveUiVisible && immersiveNavOpen
                ? "opacity-100 pointer-events-auto translate-y-0"
                : "opacity-0 pointer-events-none -translate-y-2"
            }`}
          >
            {/* Contextual Filter Pills per Page (P1, P2, P3, P4) */}
            {activePage === "p1" && (
              <div className="pointer-events-auto orbit-compact-pill rounded-full p-1 flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
                {[
                  { id: "all" as FeedFilter, label: "Pour Vous" },
                  { id: "friends" as FeedFilter, label: "Amis" },
                  { id: "vertical" as FeedFilter, label: "9:16 Reels" },
                  { id: "youtube" as FeedFilter, label: "YouTube" },
                  { id: "top95" as FeedFilter, label: "Top ≥ 9.5" },
                ].map((tab) => {
                  const active = feedFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setFeedFilter(tab.id);
                        setImmersiveNavOpen(false);
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? "bg-white/20 text-white"
                          : "text-white/65 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}

            {activePage === "p2" && (
              <div className="pointer-events-auto orbit-compact-pill rounded-full p-1 flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
                {[
                  { id: "wall" as ProfileTab, label: "Mon Mur" },
                  { id: "favs" as ProfileTab, label: "Coups de Cœur" },
                  { id: "secret" as ProfileTab, label: "Jardin Secret" },
                ].map((tab) => {
                  const active =
                    !orbitState.creatorPortfolioMode && profileTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setOrbitState((prev) => ({
                          ...prev,
                          creatorPortfolioMode: false,
                        }));
                        setProfileTab(tab.id);
                        setImmersiveNavOpen(false);
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? "bg-white/20 text-white"
                          : "text-white/65 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    setOrbitState((prev) => ({
                      ...prev,
                      creatorPortfolioMode: !prev.creatorPortfolioMode,
                    }));
                    setImmersiveNavOpen(false);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                    orbitState.creatorPortfolioMode
                      ? "bg-white/20 text-white"
                      : "text-white/70 hover:text-white"
                  }`}
                >
                  Portfolio HD
                </button>
                <button
                  type="button"
                  onClick={handleOpenQrForPage2}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium text-white/75 hover:text-white cursor-pointer inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  title="Générer QR Code de cette sélection"
                >
                  <QrCode className="w-3 h-3" />
                  <span>QR</span>
                </button>
              </div>
            )}

            {activePage === "p3" && (
              <div className="pointer-events-auto orbit-compact-pill rounded-full px-2 py-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
                <Trophy className="w-3 h-3 text-white/80 shrink-0 ml-1" />
                <select
                  value={activePillar}
                  onChange={(e) => {
                    setActivePillar(e.target.value);
                    setActiveSubpillar("Tous");
                  }}
                  aria-label="Sélectionner l'un des 15 domaines du Panthéon"
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium outline-none cursor-pointer bg-black/70 text-white border border-white/15"
                >
                  {orbitState.domains.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.icon} {d.name}
                    </option>
                  ))}
                </select>

                <select
                  value={activeSubpillar}
                  onChange={(e) => setActiveSubpillar(e.target.value)}
                  aria-label="Sélectionner un sous-domaine du Panthéon"
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium outline-none cursor-pointer bg-black/70 text-white/90 border border-white/15"
                >
                  {["Tous", ...activePillarObj.subs].map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleOpenQrForPage3}
                  className="px-2 py-0.5 rounded-full text-[11px] font-medium text-white/75 hover:text-white cursor-pointer inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  title="Générer QR Code de ce classement Panthéon"
                >
                  <QrCode className="w-3 h-3" />
                  <span className="hidden sm:inline">QR</span>
                </button>
              </div>
            )}

            {activePage === "p4" && (
              <div className="pointer-events-auto orbit-compact-pill rounded-full p-1 flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full">
                {MOOD_PRESETS.map((mood) => {
                  const active = activeMood === mood.id;
                  return (
                    <button
                      key={mood.id}
                      type="button"
                      onClick={() => {
                        setActiveMood(mood.id);
                        setImmersiveNavOpen(false);
                      }}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? "bg-white/20 text-white"
                          : "text-white/65 hover:text-white"
                      }`}
                    >
                      {mood.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    setRadarExploration((prev) => (prev > 60 ? 25 : 85))
                  }
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium cursor-pointer whitespace-nowrap shrink-0 text-white/80 hover:text-white"
                  title="Basculer entre Affinités Pures et Exploration Hors-Piste"
                >
                  {radarExploration > 60 ? "Hors-Piste" : "Affinités"}
                </button>
              </div>
            )}

            {/* Right On-Demand Secondary Shortcuts */}
            <div className="pointer-events-auto flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={handleToggleHideWatched}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer orbit-compact-pill whitespace-nowrap shrink-0"
                title="Masquer les vidéos déjà vues"
              >
                {hideWatched ? (
                  <EyeOff className="w-3 h-3 text-white" />
                ) : (
                  <Eye className="w-3 h-3 text-white/75" />
                )}
                <span>
                  {hideWatched
                    ? `Inédites (${watchedIds.length})`
                    : "Anti-Déjà-Vu"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setWatchLaterDrawerOpen(true);
                  setImmersiveNavOpen(false);
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium text-white/85 inline-flex items-center gap-1 cursor-pointer orbit-compact-pill whitespace-nowrap shrink-0"
                title="Ouvrir mon panier À regarder ce soir"
              >
                <Clock className="w-3 h-3" />
                <span>Ce soir ({watchLaterVideos.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setComposerOpen(true);
                  setImmersiveNavOpen(false);
                }}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium text-white bg-white/15 hover:bg-white/25 border border-white/20 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>Publier</span>
              </button>
            </div>
          </div>

          {/* TOAST NOTIFICATION IN IMMERSION MODE */}
          {toastMessage && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 z-40 orbit-compact-pill px-3.5 py-1.5 rounded-full text-[11px] font-medium text-white/95 flex items-center gap-2 shadow-xl">
              <span>{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="cursor-pointer opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

          {/* 100% HEIGHT VERTICAL IMMERSION FEED FOR ALL 4 PAGES */}
          <VerticalFeed
            videos={activeImmersionVideos}
            pageContext={
              activePage === "p1" ||
              activePage === "p2" ||
              activePage === "p3" ||
              activePage === "p4"
                ? activePage
                : "p1"
            }
            pageContextLabel={activeImmersionContextLabel}
            enableInfiniteLoop={activePage === "p4"}
            showRankingBadges={activePage === "p3"}
            onSwitchToGridMode={() => setFeedViewMode("grid")}
            cinemaMode={cinemaMode}
            onToggleCinemaMode={() => setCinemaMode((c) => !c)}
            watchLaterIds={watchLaterIds}
            watchedVideoIds={watchedIds}
            onToggleWatchLater={handleToggleWatchLater}
            onPlayPip={handleLaunchPip}
            onRateVideo={handleRateVideo}
            onAddComment={handleAddComment}
            onTriggerReaction={handleTriggerReaction}
            onMarkWatched={handleMarkVideoWatched}
            onRepost={handleRepost}
            onSummarizeVideo={handleSummarizeVideo}
            onTranslateComment={handleTranslateComment}
            onPlayAudioMode={(v) => {
              setAudioModeVideo(v);
              setAudioPlaying(true);
              handleMarkVideoWatched(v.id);
              showToast(`Mode Audio activé : ${v.title}`);
            }}
            onAddToJukebox={handleAddToJukebox}
            uiVisible={immersiveUiVisible}
            onUiVisibleChange={(v) => {
              setImmersiveUiVisible(v);
              if (!v) setImmersiveNavOpen(false);
            }}
            navOverlayOpen={immersiveNavOpen}
            onToggleNavOverlay={() => setImmersiveNavOpen((o) => !o)}
            onRemoveUnavailableVideo={handleRemoveUnavailableVideo}
          />
        </main>
      ) : (
        <main className="px-4 pt-4 pb-28 lg:px-8 lg:py-6 max-w-[1180px] w-full mx-auto">
          {/* TOPBAR FOR NON-IMMERSION VIEWS */}
          <header
            className="flex items-center justify-between gap-4 pb-5 mb-6 flex-wrap"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {/* Global Search */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search
                className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 opacity-70"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une vidéo, un domaine, un ami, un mot-clé..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full text-xs outline-none glass-panel"
                style={{
                  color: "var(--text-main)",
                }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* BOUTON DE BASCULE RAPIDE PERSISTANT EN HAUT DES 4 PAGES */}
              {activePage !== "p5" && (
                <button
                  type="button"
                  onClick={() => setFeedViewMode("immersion")}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold text-white inline-flex items-center gap-2 cursor-pointer btn-couture whitespace-nowrap shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #0284c7, #5e35ff)",
                  }}
                  title="Basculer en 1 clic vers le Mode Scroll Vertical Immersion (façon TikTok / Reels)"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>📱 Mode Immersion Reels</span>
                </button>
              )}

              {/* Fonctionnalité 12 : Bouton d'activation rapide 'Focus Absolu' */}
              <button
                type="button"
                onClick={handleToggleFocusAbsolu}
                className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0"
                title="Activer le Mode Focus Absolu (Zéro Distraction)"
              >
                <Eye className="w-3.5 h-3.5" style={{ color: "var(--accent-2)" }} />
                <span>Focus Absolu</span>
              </button>

              {/* Fonctionnalité 14 : Tiroir 'À regarder ce soir' */}
              <button
                type="button"
                onClick={() => setWatchLaterDrawerOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0"
                style={{ color: "var(--warning)" }}
                title="Ouvrir le panier intelligent « À regarder ce soir »"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>⏳ Ce soir ({watchLaterVideos.length})</span>
              </button>

              {/* Fonctionnalité 15 : Bouton 'Coller rapide' */}
              <button
                type="button"
                onClick={handleQuickPasteButton}
                className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0"
                style={{ color: "var(--accent-2)" }}
                title="Passerelle d'Import Rapide Telegram / Discord / Presse-Papiers"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Coller rapide</span>
              </button>

              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-2 cursor-pointer btn-couture whitespace-nowrap shrink-0"
                style={{
                  background: "linear-gradient(135deg, var(--accent), #5e35ff)",
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Publier (IA)</span>
              </button>

              <button
                type="button"
                onClick={() => setOpenModal("vault")}
                className="px-3.5 py-2 rounded-xl text-xs font-extrabold text-white inline-flex items-center gap-1.5 cursor-pointer btn-couture whitespace-nowrap shrink-0"
                style={{
                  background: "linear-gradient(135deg, #059669, #0284c7)",
                }}
                title="Ouvrir Mon coffre ORBIT (Mes données, Export/Import, Sync sélective & Confidentialité)"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Mon coffre ORBIT</span>
              </button>

              <button
                type="button"
                onClick={() => setOpenModal("jukebox")}
                className="px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0"
                style={{ color: "var(--success)" }}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Jukebox ({orbitState.jukebox.length})</span>
              </button>

              <PWAInstallButton />
            </div>
          </header>

          <OfflineIndicator />

          {/* Fonctionnalité 20 : Bannière de Sélection QR Code Scannée */}
          {scannedPlaylistBanner && (
            <div
              className="mb-5 p-4 rounded-2xl glass-panel flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{
                borderColor: "rgba(124, 92, 255, 0.55)",
                background: "rgba(124, 92, 255, 0.12)",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5 text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-cyan-300">
                    📱 Sélection QR Code Active : « {scannedPlaylistBanner.title} »
                  </div>
                  <div
                    className="text-[11px] truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Partagée par @{scannedPlaylistBanner.curator} ·{" "}
                    {scannedPlaylistBanner.videoIds.length} pépites dans cette
                    sélection
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setScannedPlaylistBanner(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 cursor-pointer shrink-0"
              >
                Afficher tout le catalogue Orbit
              </button>
            </div>
          )}

          {/* Fonctionnalité 15 : Détecteur Intelligent de Lien dans le Presse-Papiers */}
          {clipboardDetectedBanner && (
            <div
              className="mb-5 p-4 rounded-2xl glass-panel flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{
                borderColor: "rgba(0, 229, 255, 0.45)",
                background: "rgba(0, 229, 255, 0.07)",
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
                  <ClipboardPaste className="w-4 h-4 text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-cyan-300">
                    Lien détecté dans votre presse-papiers (
                    {clipboardDetectedBanner.source.toUpperCase()})
                  </div>
                  <div
                    className="text-[11px] truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {clipboardDetectedBanner.url} · Pré-classé dans{" "}
                    <strong style={{ color: "var(--text-main)" }}>
                      {clipboardDetectedBanner.domain} ›{" "}
                      {clipboardDetectedBanner.subdomain}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    applyQuickImportText(
                      clipboardDetectedBanner.rawText,
                      clipboardDetectedBanner.source
                    );
                    setClipboardDetectedBanner(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture"
                  style={{ background: "var(--accent)" }}
                >
                  Importer & Pré-remplir
                </button>
                <button
                  type="button"
                  onClick={() => setClipboardDetectedBanner(null)}
                  className="px-2.5 py-1.5 rounded-xl text-xs cursor-pointer opacity-70 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* TOAST NOTIFICATION */}
          {toastMessage && (
            <div
              className="mb-5 px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between glass-panel"
              style={{
                borderColor: "rgba(0, 230, 118, 0.4)",
                color: "var(--success)",
              }}
            >
              <span>{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="cursor-pointer ml-4 opacity-75 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}

          {/* ==========================================================
              PAGE 1 (GRID FALLBACK MODE) : LE FLUX EN GRILLE + DÉFIS HEBDO
              + FONCTIONNALITÉ 17 (INTERRUPTEUR ANTI-DÉJÀ-VU)
              ========================================================== */}
          {activePage === "p1" && (
            <section className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                    Le Flux de vos Abonnements (Vue Galerie)
                  </h1>
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Partagez, réagissez en direct, débattez en 3 colonnes et notez le meilleur de vos réseaux.
                  </p>
                </div>

                {/* Bascule rapide Mode Immersion Reels / Mode Grille + Interrupteur Anti-Déjà-Vu (Page 1) */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      setFeedViewMode(
                        feedViewMode === "immersion" ? "grid" : "immersion"
                      )
                    }
                    className="px-4 py-2.5 rounded-2xl text-xs font-black text-white inline-flex items-center gap-2 cursor-pointer transition-all btn-couture"
                    style={{
                      background:
                        "linear-gradient(135deg, #00e5ff, var(--accent))",
                      boxShadow: "0 6px 20px rgba(0, 229, 255, 0.28)",
                    }}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>📱 Mode Immersion Reels</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleHideWatched}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-all"
                    style={{
                      background: hideWatched
                        ? "rgba(0, 230, 118, 0.16)"
                        : "var(--bg-card)",
                      border: `1px solid ${
                        hideWatched ? "#00e676" : "var(--border)"
                      }`,
                      color: hideWatched ? "var(--success)" : "var(--text-main)",
                    }}
                  >
                    {hideWatched ? (
                      <EyeOff className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-cyan-400" />
                    )}
                    <span>
                      {hideWatched
                        ? `✓ Masquer les vidéos déjà vues (${watchedIds.length} masquées)`
                        : `Masquer les vidéos déjà vues (${watchedIds.length} vues)`}
                    </span>
                  </button>
                  {watchedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setOrbitState((prev) => ({
                          ...prev,
                          watchedVideoIds: [],
                        }));
                        OrbitStorageService.saveWatchedVideoIds([]);
                        showToast(
                          "Historique watchedVideoIds remis à zéro dans LocalStorage."
                        );
                      }}
                      className="px-3 py-2.5 rounded-2xl text-xs font-semibold cursor-pointer glass-panel opacity-85 hover:opacity-100"
                      title="Réinitialiser le tableau watchedVideoIds"
                    >
                      Réinitialiser vues
                    </button>
                  )}
                </div>
              </div>

              {/* Idée 7 : Défis de Curation Hebdomadaires */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {orbitState.challenges.map((ch) => {
                  const pct = Math.round(
                    (ch.userProgress / ch.targetCount) * 100
                  );
                  return (
                    <div
                      key={ch.id}
                      className="p-4 rounded-2xl glass-panel flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div
                            className="text-[11px] font-bold"
                            style={{ color: "var(--accent-2)" }}
                          >
                            {ch.weekLabel} · {ch.targetDomain} ·{" "}
                            <span className="font-mono-num">
                              {ch.participantsCount} curateurs
                            </span>
                          </div>
                          <h3 className="text-sm font-extrabold font-display mt-0.5">
                            {ch.title}
                          </h3>
                          <p
                            className="text-xs mt-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {ch.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setInpDomain(ch.targetDomain);
                            setInpChallengeTag(ch.weekLabel);
                            setComposerOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture shrink-0"
                          style={{ background: "var(--accent)" }}
                        >
                          Participer
                        </button>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono-num">
                          <span>Récompense : {ch.rewardBadge}</span>
                          <span>
                            {ch.userProgress}/{ch.targetCount} pépites ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background:
                                "linear-gradient(90deg, var(--accent), var(--accent-2))",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Feed Filter Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                  { id: "all" as FeedFilter, label: "Tout mon Flux" },
                  {
                    id: "friends" as FeedFilter,
                    label: "Amis (WhatsApp / Répertoire)",
                  },
                  { id: "youtube" as FeedFilter, label: "YouTube" },
                  {
                    id: "vertical" as FeedFilter,
                    label: "Formats Verticaux (TikTok / Reels / Shorts)",
                  },
                  { id: "top95" as FeedFilter, label: "Notes ≥ 9.5/10" },
                ].map((tab) => {
                  const active = feedFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFeedFilter(tab.id)}
                      className="px-3.5 py-2 rounded-full text-xs font-bold cursor-pointer transition-all whitespace-nowrap shrink-0"
                      style={{
                        background: active
                          ? "var(--text-main)"
                          : "var(--bg-card)",
                        color: active ? "var(--bg-main)" : "var(--text-muted)",
                        border: active
                          ? "1px solid transparent"
                          : "1px solid var(--border)",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Barre Amis & Jumeaux de Goûts (Page 1) + Accès direct Connecteurs RGPD */}
              <div className="p-4 rounded-2xl glass-panel flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-extrabold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>
                      Amis & Jumeaux de Goûts ({orbitState.twins.length}) · Sources connectées ({activeSocialsCount}/6)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {orbitState.twins.slice(0, 6).map((tw, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-white/5 border border-white/10 inline-flex items-center gap-1.5"
                      >
                        <span>{tw.name}</span>
                        <span className="text-emerald-400 font-mono-num">
                          {tw.match}%
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenConnectorModal("youtube")}
                    className="px-3.5 py-2 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-500 cursor-pointer inline-flex items-center gap-1.5 shadow-md"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>📥 Importer mon Historique et mes Abonnements YouTube</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateCustomAiDna}
                    className="px-3.5 py-2 rounded-xl text-xs font-black text-black cursor-pointer inline-flex items-center gap-1.5"
                    style={{
                      background: "linear-gradient(135deg, #00e676, #00e5ff)",
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Générer mon ADN sur-mesure</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenConnectorModal("whatsapp")}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Contacts / WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenConnectorModal()}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer glass-panel glass-panel-interactive inline-flex items-center gap-1.5"
                  >
                    <Link2 className="w-3.5 h-3.5 text-cyan-300" />
                    <span>Concentrateur d&apos;Affinités ({activeSocialsCount}/6)</span>
                  </button>
                </div>
              </div>

              {/* Barre de Partage Direct Rapide (Page 1 & redirection instantanée vers Ma Page) */}
              <div
                className="p-4 rounded-2xl glass-panel space-y-2.5"
                style={{
                  borderColor: "rgba(24, 119, 242, 0.45)",
                  background:
                    "linear-gradient(135deg, rgba(24, 119, 242, 0.12), rgba(124, 92, 255, 0.08))",
                }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="text-xs font-extrabold flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/25 text-blue-300 border border-blue-400/40">
                      Facebook · YouTube · TikTok · Insta
                    </span>
                    <span>
                      📤 Intégrer une vidéo Facebook (Watch, Reel, Share) ou YouTube directement sur Ma Page
                    </span>
                  </div>
                </div>
                <form
                  onSubmit={handlePublishVideo}
                  className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_auto] gap-2"
                >
                  <input
                    type="text"
                    value={inpUrl}
                    onChange={(e) => {
                      setInpUrl(e.target.value);
                      handleLocalClassify(e.target.value, inpTitle);
                    }}
                    placeholder="Collez votre lien Facebook (facebook.com/share/v/..., fb.watch/..., Reel), YouTube ou code <iframe>..."
                    className="px-3.5 py-2.5 rounded-xl text-xs outline-none"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      color: "var(--text-main)",
                    }}
                  />
                  <input
                    type="text"
                    value={inpTitle}
                    onChange={(e) => {
                      setInpTitle(e.target.value);
                      handleLocalClassify(inpUrl, e.target.value);
                    }}
                    placeholder="Titre personnalisé (optionnel)"
                    className="px-3.5 py-2.5 rounded-xl text-xs outline-none"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      color: "var(--text-main)",
                    }}
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white cursor-pointer inline-flex items-center justify-center gap-1.5 btn-couture whitespace-nowrap"
                    style={{
                      background: "linear-gradient(135deg, #1877F2, var(--accent))",
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Intégrer sur Ma Page</span>
                  </button>
                </form>
              </div>

              {/* Video Grid */}
              {filteredFeedVideos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredFeedVideos.map((v) => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      isInWatchLater={watchLaterIds.includes(v.id)}
                      isWatched={watchedIds.includes(v.id)}
                      onToggleWatchLater={handleToggleWatchLater}
                      onPlayPip={handleLaunchPip}
                      onRateVideo={handleRateVideo}
                      onAddComment={handleAddComment}
                      onTriggerReaction={handleTriggerReaction}
                      onMarkWatched={handleMarkVideoWatched}
                      onRepost={handleRepost}
                      onSummarizeVideo={handleSummarizeVideo}
                      onTranslateComment={handleTranslateComment}
                      onOpenCinema={handleLaunchCinema}
                      onPlayAudioMode={(vid) => {
                        setAudioModeVideo(vid);
                        setAudioPlaying(true);
                        handleMarkVideoWatched(vid.id);
                      }}
                      onAddToJukebox={handleAddToJukebox}
                      onRemoveUnavailableVideo={handleRemoveUnavailableVideo}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-3xl glass-panel text-center space-y-3">
                  <div className="text-base font-bold font-display">
                    Toutes les vidéos de ce filtre ont déjà été vues !
                  </div>
                  <p
                    className="text-xs max-w-md mx-auto"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Le filtre intelligent Anti-Déjà-Vu masque les{" "}
                    {watchedIds.length} vidéos déjà lancées ou notées.
                  </p>
                  <button
                    type="button"
                    onClick={handleToggleHideWatched}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture"
                    style={{ background: "var(--accent)" }}
                  >
                    Réafficher toutes les vidéos
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ==========================================================
              PAGE 2 : MA PAGE + FONCTIONNALITÉ 16 (MODE PORTFOLIO CRÉATEUR)
              + FONCTIONNALITÉ 20 (GÉNÉRATEUR DE QR CODE DE CETTE SÉLECTION)
              ========================================================== */}
          {activePage === "p2" && (
            <section className="space-y-6">
              {/* Top Mode Switcher Bar : Mode Portfolio Professionnel vs Profil Curation Standard */}
              <div className="p-4 sm:p-5 rounded-3xl glass-panel flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0"
                    style={{
                      background: orbitState.creatorPortfolioMode
                        ? "linear-gradient(135deg, #00e5ff, #7c5cff)"
                        : "rgba(255,255,255,0.08)",
                    }}
                  >
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-extrabold font-display flex items-center gap-2">
                      <span>Mode « Portfolio Professionnel » (Créateur)</span>
                      {orbitState.creatorPortfolioMode && (
                        <span className="text-[11px] font-mono-num text-cyan-300">
                          · Galerie d&apos;Art Plein Cadre Active
                        </span>
                      )}
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Basculez votre profil en galerie haute définition mettant en avant vos propres créations (vidéos, Light Painting, projets visuels & musicaux).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                  {/* Bouton Lecture Continue Reels sur Ma Page (Publications, Coups de cœur & Portfolio) */}
                  <button
                    type="button"
                    onClick={() => setFeedViewMode("immersion")}
                    className="px-4 py-2.5 rounded-2xl text-xs font-black text-white cursor-pointer inline-flex items-center gap-2 transition-all btn-couture"
                    style={{
                      background:
                        "linear-gradient(135deg, #00e5ff, var(--accent))",
                      boxShadow: "0 6px 20px rgba(0, 229, 255, 0.28)",
                    }}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>📱 Mode Immersion Reels</span>
                  </button>

                  {/* Interrupteur Mode Portfolio Professionnel (Fonctionnalité 16) */}
                  <button
                    type="button"
                    onClick={() =>
                      setOrbitState((prev) => ({
                        ...prev,
                        creatorPortfolioMode: !prev.creatorPortfolioMode,
                      }))
                    }
                    className="px-4 py-2.5 rounded-2xl text-xs font-black cursor-pointer inline-flex items-center gap-2 transition-all"
                    style={{
                      background: orbitState.creatorPortfolioMode
                        ? "linear-gradient(135deg, #00e5ff, #7c5cff)"
                        : "var(--bg-input)",
                      color: orbitState.creatorPortfolioMode
                        ? "#ffffff"
                        : "var(--text-main)",
                      border: orbitState.creatorPortfolioMode
                        ? "1px solid rgba(255,255,255,0.35)"
                        : "1px solid var(--border)",
                      boxShadow: orbitState.creatorPortfolioMode
                        ? "0 8px 25px rgba(0, 229, 255, 0.3)"
                        : "none",
                    }}
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>
                      {orbitState.creatorPortfolioMode
                        ? "✓ Mode Portfolio Professionnel Actif"
                        : "Activer Mode Portfolio Professionnel"}
                    </span>
                  </button>

                  {/* Fonctionnalité 20 : Bouton '📱 Générer QR Code de cette sélection' sur la Page 2 */}
                  <button
                    type="button"
                    onClick={handleOpenQrForPage2}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 glass-panel glass-panel-interactive"
                    style={{
                      borderColor: "rgba(0, 229, 255, 0.4)",
                      color: "var(--accent-2)",
                    }}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>📱 Générer QR Code de cette sélection</span>
                  </button>
                </div>
              </div>

              {orbitState.creatorPortfolioMode ? (
                /* FONCTIONNALITÉ 16 : VUE PORTFOLIO CRÉATEUR PLEIN CADRE HAUTE DÉFINITION */
                <CreatorPortfolioView
                  profile={orbitState.profile}
                  items={
                    orbitState.portfolioItems || DEFAULT_PORTFOLIO_ITEMS
                  }
                  links={orbitState.creatorLinks || DEFAULT_CREATOR_LINKS}
                  onAddPortfolioItem={handleAddPortfolioItem}
                  onOpenQrGenerator={handleOpenQrForPage2}
                  onOpenImmersionReels={() => setFeedViewMode("immersion")}
                  onExitPortfolioMode={() =>
                    setOrbitState((prev) => ({
                      ...prev,
                      creatorPortfolioMode: false,
                    }))
                  }
                  onShowToast={showToast}
                />
              ) : (
                /* VUE PROFIL DE CURATION STANDARD */
                <>
                  {/* Profile Card with Idée 3 Scout Badges */}
                  <div className="p-6 rounded-3xl glass-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white shrink-0"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--accent), var(--accent-2))",
                          boxShadow: "0 0 24px var(--accent-glow)",
                        }}
                      >
                        {orbitState.profile.initials}
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-xl font-black font-display">
                            {orbitState.profile.name}
                          </h2>
                          <span
                            className="text-xs font-bold inline-flex items-center gap-1"
                            style={{ color: "var(--accent-2)" }}
                          >
                            · <Award className="w-3.5 h-3.5" /> Éclaireur Rang{" "}
                            {orbitState.profile.scoutBadges || 4} (
                            <span className="font-mono-num">
                              {orbitState.profile.scoutPoints || 145} pts
                            </span>
                            )
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditName(orbitState.profile.name);
                              setEditBio(orbitState.profile.bio);
                              setEditingProfile(!editingProfile);
                            }}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer glass-panel whitespace-nowrap shrink-0"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Modifier</span>
                          </button>
                        </div>
                        <p
                          className="text-xs mt-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {orbitState.profile.bio}
                        </p>
                        <div
                          className="flex items-center gap-2 mt-2.5 flex-wrap text-[11px]"
                          style={{ color: "var(--accent-2)" }}
                        >
                          {activeSocialsCount > 0 ? (
                            orbitState.socials
                              .filter((s) => s.active && s.realConsentVerified)
                              .map((s, idx) => (
                                <React.Fragment key={s.id}>
                                  {idx > 0 && <span aria-hidden="true">·</span>}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenConnectorModal(s.id)}
                                    className="font-semibold text-emerald-300 hover:underline cursor-pointer"
                                  >
                                    {s.name.split(" ")[0]} Sync ✓ (
                                    {s.importedProofText || "Importé"})
                                  </button>
                                </React.Fragment>
                              ))
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenConnectorModal()}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-400/30 font-bold cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>
                                Aucun réseau connecté (Inactif) — Cliquez pour connecter vos sources (RGPD)
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => setOpenModal("vault")}
                        className="px-3.5 py-2.5 rounded-xl text-xs font-black text-white cursor-pointer btn-couture inline-flex items-center gap-1.5"
                        style={{
                          background: "linear-gradient(135deg, #059669, #0284c7)",
                        }}
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>🛡️ Mon coffre ORBIT</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActivePage("p5");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="px-3.5 py-2.5 rounded-xl text-xs font-bold cursor-pointer glass-panel glass-panel-interactive inline-flex items-center gap-1.5"
                      >
                        <Link2 className="w-4 h-4 text-cyan-300" />
                        <span>Réglage et Importation ({activeSocialsCount}/6)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenModal("capsule")}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-white inline-flex items-center gap-2 cursor-pointer btn-couture whitespace-nowrap shrink-0"
                        style={{
                          background:
                            "linear-gradient(135deg, #00c853, #009624)",
                        }}
                      >
                        <Gift className="w-4 h-4" />
                        <span>Partager ma Page à un ami</span>
                      </button>
                    </div>
                  </div>

                  {/* Inline Profile Editor */}
                  {editingProfile && (
                    <form
                      onSubmit={handleSaveProfile}
                      className="p-5 rounded-2xl glass-panel space-y-3"
                    >
                      <div className="text-sm font-bold font-display">
                        Modifier mon profil Orbit
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Nom ou pseudo"
                          className="px-3.5 py-2 rounded-lg text-xs outline-none"
                          style={{
                            background: "var(--bg-input)",
                            border: "1px solid var(--border)",
                            color: "var(--text-main)",
                          }}
                        />
                        <input
                          type="text"
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          placeholder="Votre bio"
                          className="px-3.5 py-2 rounded-lg text-xs outline-none"
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
                          onClick={() => setEditingProfile(false)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer glass-panel"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer btn-couture"
                          style={{ background: "var(--accent)" }}
                        >
                          Enregistrer
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Idée 7 : Défis de Curation Hebdomadaires */}
                  <div className="p-5 rounded-3xl glass-panel space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="text-sm font-extrabold font-display flex items-center gap-2">
                          <Flame className="w-4 h-4 text-amber-400" />
                          <span>Défis de Curation Hebdomadaires</span>
                        </h3>
                        <p
                          className="text-xs"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Relevez les défis thématiques de la communauté pour débloquer des badges d&apos;Éclaireur.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {orbitState.challenges.map((ch) => {
                        const pct = Math.round(
                          (ch.userProgress / ch.targetCount) * 100
                        );
                        return (
                          <div
                            key={ch.id}
                            className="p-3.5 rounded-2xl space-y-2"
                            style={{
                              background: "rgba(255,255,255,0.03)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span style={{ color: "var(--accent-2)" }}>
                                {ch.weekLabel} · {ch.targetDomain}
                              </span>
                              <span className="font-mono-num">
                                {ch.userProgress}/{ch.targetCount}
                              </span>
                            </div>
                            <div className="text-xs font-extrabold">
                              {ch.title}
                            </div>
                            <div
                              className="text-[11px]"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {ch.description}
                            </div>
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${pct}%`,
                                  background:
                                    "linear-gradient(90deg, var(--accent), var(--accent-2))",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Cultural DNA Grid */}
                  <div className="p-6 rounded-3xl glass-panel space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <h3 className="text-base font-extrabold font-display">
                          Mon Empreinte Culturelle (15 Domaines)
                        </h3>
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Calculée mathématiquement selon votre historique YouTube, vos abonnements et vos notes. Cliquez sur{" "}
                          <strong>Public / Secret</strong> pour masquer un domaine aux visiteurs tout en le gardant actif sur votre Radar.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setActivePage("p5");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-black text-white bg-red-600 hover:bg-red-500 cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>📥 Réglage et Importation (YouTube, TikTok, Insta)</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleGenerateCustomAiDna}
                          className="px-3.5 py-2 rounded-xl text-xs font-black text-black cursor-pointer inline-flex items-center gap-1.5"
                          style={{
                            background: "linear-gradient(135deg, #00e676, #00e5ff)",
                          }}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Générer mon ADN sur-mesure</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {orbitState.domains.map((d) => (
                        <div
                          key={d.id}
                          className={`p-3.5 rounded-2xl flex flex-col gap-2 transition-all ${
                            d.secret ? "opacity-55 border-dashed" : ""
                          }`}
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: `1px ${
                              d.secret ? "dashed" : "solid"
                            } var(--border)`,
                            boxShadow:
                              "inset 0 1px 0 0 rgba(255,255,255,0.06)",
                          }}
                        >
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="truncate">
                              {d.icon} {d.name}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className="font-mono-num"
                                style={{ color: "var(--accent-2)" }}
                              >
                                {d.affinity}%
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleDomainPrivacy(d.id)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold cursor-pointer opacity-80 hover:opacity-100"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {d.secret ? (
                                  <>
                                    <Lock className="w-3 h-3" />
                                    <span>Secret</span>
                                  </>
                                ) : (
                                  <>
                                    <Eye className="w-3 h-3" />
                                    <span>Public</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden bg-white/10">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${d.affinity}%`,
                                background:
                                  "linear-gradient(90deg, var(--accent), var(--accent-2))",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Barre de Partage Direct sur Ma Page (Facebook, YouTube, TikTok, Instagram) */}
                  <div
                    className="p-4 sm:p-5 rounded-3xl glass-panel space-y-3"
                    style={{
                      borderColor: "rgba(24, 119, 242, 0.45)",
                      background:
                        "linear-gradient(135deg, rgba(24, 119, 242, 0.12), rgba(124, 92, 255, 0.08))",
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/35">
                          Intégration Directe Ma Page
                        </span>
                        <h3 className="text-xs sm:text-sm font-extrabold font-display">
                          📤 Partager une vidéo Facebook, YouTube, TikTok ou Instagram sur Ma Page
                        </h3>
                      </div>
                      <span
                        className="text-[11px] font-mono-num"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Vos partages s&apos;affichent immédiatement en #1 de « Mon Mur de Publications »
                      </span>
                    </div>

                    <form
                      onSubmit={handlePublishVideo}
                      className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_auto] gap-2.5"
                    >
                      <input
                        type="text"
                        value={inpUrl}
                        onChange={(e) => {
                          setInpUrl(e.target.value);
                          handleLocalClassify(e.target.value, inpTitle);
                        }}
                        placeholder="Collez votre lien vidéo Facebook (Watch / Reel / Share), YouTube, TikTok, Instagram ou code <iframe>..."
                        className="px-3.5 py-2.5 rounded-xl text-xs outline-none"
                        style={{
                          background: "var(--bg-input)",
                          border: "1px solid var(--border)",
                          color: "var(--text-main)",
                        }}
                      />
                      <input
                        type="text"
                        value={inpTitle}
                        onChange={(e) => {
                          setInpTitle(e.target.value);
                          handleLocalClassify(inpUrl, e.target.value);
                        }}
                        placeholder="Titre ou note personnelle (optionnel)"
                        className="px-3.5 py-2.5 rounded-xl text-xs outline-none"
                        style={{
                          background: "var(--bg-input)",
                          border: "1px solid var(--border)",
                          color: "var(--text-main)",
                        }}
                      />
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white cursor-pointer inline-flex items-center justify-center gap-1.5 btn-couture whitespace-nowrap"
                        style={{
                          background:
                            "linear-gradient(135deg, #1877F2, var(--accent))",
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Intégrer sur Ma Page</span>
                      </button>
                    </form>
                  </div>

                  {/* Profile Tabs */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {[
                        {
                          id: "wall" as ProfileTab,
                          label: "Mon Mur de Publications",
                        },
                        {
                          id: "favs" as ProfileTab,
                          label: "Mes Coups de Cœur (Notés ≥ 9.5)",
                        },
                        {
                          id: "secret" as ProfileTab,
                          label: "Mon Jardin Secret (Catégories masquées)",
                        },
                        {
                          id: "capsules" as ProfileTab,
                          label: `⏳ Time-Capsules Programmées (${lockedTimeCapsules.length})`,
                        },
                      ].map((t) => {
                        const active = profileTab === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setProfileTab(t.id)}
                            className="px-3.5 py-2 rounded-full text-xs font-bold cursor-pointer transition-all whitespace-nowrap shrink-0"
                            style={{
                              background: active
                                ? "var(--text-main)"
                                : "var(--bg-card)",
                              color: active
                                ? "var(--bg-main)"
                                : "var(--text-muted)",
                              border: active
                                ? "1px solid transparent"
                                : "1px solid var(--border)",
                            }}
                          >
                            {t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Profile Video Grid or Time-Capsule Vault */}
                  {profileTab === "capsules" ? (
                    lockedTimeCapsules.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {lockedTimeCapsules.map((cap) => {
                          const remainingSec = Math.max(
                            0,
                            Math.ceil(
                              ((cap.unlockAt || 0) - nowTimestamp) / 1000
                            )
                          );
                          return (
                            <div
                              key={cap.id}
                              className="p-5 rounded-3xl glass-panel flex flex-col justify-between gap-4"
                            >
                              <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock className="w-4 h-4" />
                                  <span>Time-Capsule Verrouillée</span>
                                </span>
                                <span className="font-mono-num">
                                  Déverrouillage dans {remainingSec}s
                                </span>
                              </div>
                              <div>
                                <div className="text-sm font-extrabold font-display">
                                  {cap.title}
                                </div>
                                <p
                                  className="text-xs mt-1"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  {cap.domain} › {cap.subdomain} · «{" "}
                                  {cap.comment} »
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUnlockTimeCapsule(cap.id)}
                                className="w-full py-2 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture"
                                style={{ background: "var(--accent)" }}
                              >
                                Déverrouiller et publier maintenant
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        className="p-8 rounded-2xl glass-panel text-center text-sm space-y-3"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <div>Aucune Time-Capsule programmée en attente.</div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsTimeCapsule(true);
                            setComposerOpen(true);
                          }}
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture"
                          style={{ background: "var(--accent)" }}
                        >
                          Programmer une Time-Capsule ⏳
                        </button>
                      </div>
                    )
                  ) : filteredProfileVideos.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                      {filteredProfileVideos.map((v) => (
                        <VideoCard
                          key={v.id}
                          video={v}
                          isInWatchLater={watchLaterIds.includes(v.id)}
                          isWatched={watchedIds.includes(v.id)}
                          onToggleWatchLater={handleToggleWatchLater}
                          onPlayPip={handleLaunchPip}
                          onRateVideo={handleRateVideo}
                          onAddComment={handleAddComment}
                          onTriggerReaction={handleTriggerReaction}
                          onMarkWatched={handleMarkVideoWatched}
                          onRepost={handleRepost}
                          onSummarizeVideo={handleSummarizeVideo}
                          onTranslateComment={handleTranslateComment}
                          onOpenCinema={handleLaunchCinema}
                          onPlayAudioMode={(vid) => {
                            setAudioModeVideo(vid);
                            setAudioPlaying(true);
                            handleMarkVideoWatched(vid.id);
                          }}
                          onAddToJukebox={handleAddToJukebox}
                          onRemoveUnavailableVideo={handleRemoveUnavailableVideo}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="p-8 rounded-2xl glass-panel text-center text-sm"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Aucune vidéo dans cet onglet pour le moment.
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* ==========================================================
              PAGE 3 : LE PANTHÉON + IDÉE 5 BLIND-TEST + IDÉE 11 PANTHÉON HISTORIQUE
              + FONCTIONNALITÉ 17 (INTERRUPTEUR ANTI-DÉJÀ-VU)
              + FONCTIONNALITÉ 20 (GÉNÉRATEUR DE QR CODE DE CETTE SÉLECTION)
              ========================================================== */}
          {activePage === "p3" && (
            <section className="space-y-6">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                    Le Panthéon des 15 Domaines
                  </h1>
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Égalité stricte : 1 membre = 1 vote. Le moteur de gravité temporelle renouvelle le premier plan chaque jour.
                  </p>
                </div>

                {/* Actions Page 3 : Bascule 1-clic Vue Grille Classement / Vue Immersion Reels + Anti-Déjà-Vu + QR Code */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFeedViewMode("immersion")}
                    className="px-4 py-2.5 rounded-2xl text-xs font-black text-white inline-flex items-center gap-2 cursor-pointer transition-all btn-couture"
                    style={{
                      background:
                        "linear-gradient(135deg, #00e5ff, var(--accent))",
                      boxShadow: "0 6px 20px rgba(0, 229, 255, 0.3)",
                    }}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>📱 Vue Immersion Reels (Top Domaine)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleHideWatched}
                    className="px-3.5 py-2.5 rounded-2xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-all"
                    style={{
                      background: hideWatched
                        ? "rgba(0, 230, 118, 0.16)"
                        : "var(--bg-card)",
                      border: `1px solid ${
                        hideWatched ? "#00e676" : "var(--border)"
                      }`,
                      color: hideWatched ? "var(--success)" : "var(--text-main)",
                    }}
                  >
                    {hideWatched ? (
                      <EyeOff className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-cyan-400" />
                    )}
                    <span>
                      {hideWatched
                        ? `✓ Masquer les vidéos déjà vues (${watchedIds.length})`
                        : "Masquer les vidéos déjà vues"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenQrForPage3}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold cursor-pointer inline-flex items-center gap-2 glass-panel glass-panel-interactive"
                    style={{
                      borderColor: "rgba(0, 229, 255, 0.45)",
                      color: "var(--accent-2)",
                    }}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>📱 Générer QR Code de cette sélection</span>
                  </button>
                </div>
              </div>

              {/* Idée 11 : Le Panthéon Historique (Machine à remonter le temps) */}
              <div className="p-5 rounded-3xl glass-panel space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0"
                      style={{
                        background:
                          selectedArchiveEra !== "live"
                            ? "linear-gradient(135deg, #d97706, #92400e)"
                            : "linear-gradient(135deg, var(--accent), var(--accent-2))",
                        boxShadow:
                          selectedArchiveEra !== "live"
                            ? "0 0 22px rgba(245, 158, 11, 0.4)"
                            : "0 0 18px var(--accent-glow)",
                      }}
                    >
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold font-display flex items-center gap-2 flex-wrap">
                        <span>
                          Le Panthéon Historique (Machine à remonter le temps)
                        </span>
                        {selectedArchiveEra !== "live" && (
                          <span className="text-xs font-bold text-amber-300 inline-flex items-center gap-1">
                            · <ShieldCheck className="w-3.5 h-3.5" /> Archive
                            Certifiée ({currentArchiveMeta.periodBadge})
                          </span>
                        )}
                      </div>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {currentArchiveMeta.description}
                      </p>
                    </div>
                  </div>

                  {selectedArchiveEra !== "live" && (
                    <button
                      type="button"
                      onClick={() =>
                        setOrbitState((prev) => ({
                          ...prev,
                          pantheonShowAllDomainsArchive:
                            !prev.pantheonShowAllDomainsArchive,
                        }))
                      }
                      className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-all"
                      style={{
                        background: orbitState.pantheonShowAllDomainsArchive
                          ? "linear-gradient(135deg, #f59e0b, #d97706)"
                          : "var(--bg-input)",
                        color: orbitState.pantheonShowAllDomainsArchive
                          ? "#fff"
                          : "var(--text-main)",
                        border: "1px solid rgba(245, 158, 11, 0.4)",
                      }}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>
                        {orbitState.pantheonShowAllDomainsArchive
                          ? "✓ Affichage des 15 Champions de l'époque"
                          : "Voir les 15 Domaines de cette époque"}
                      </span>
                    </button>
                  )}
                </div>

                {/* Archive Era Selector Buttons */}
                <div className="flex gap-2 flex-wrap">
                  {PANTHEON_ARCHIVE_ERAS.map((era) => {
                    const isSelected = selectedArchiveEra === era.id;
                    return (
                      <button
                        key={era.id}
                        type="button"
                        onClick={() =>
                          setOrbitState((prev) => ({
                            ...prev,
                            selectedArchiveEra: era.id,
                          }))
                        }
                        className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all inline-flex items-center gap-1.5"
                        style={{
                          background: isSelected
                            ? era.id === "live"
                              ? "linear-gradient(135deg, var(--accent), #5e35ff)"
                              : "linear-gradient(135deg, #f59e0b, #b45309)"
                            : "rgba(255,255,255,0.04)",
                          color: isSelected ? "#ffffff" : "var(--text-main)",
                          border: isSelected
                            ? "1px solid rgba(255,255,255,0.28)"
                            : "1px solid var(--border)",
                        }}
                      >
                        {era.isFrozenArchive && (
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                        )}
                        <span>{era.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Idée 5 : Le Mini-Jeu de Blind-Test du Panthéon */}
              <PantheonBlindTest
                videos={unlockedVideos}
                domains={orbitState.domains}
                onEarnScoutPoints={(pts) => {
                  setOrbitState((prev) => ({
                    ...prev,
                    profile: {
                      ...prev.profile,
                      scoutPoints: (prev.profile.scoutPoints || 145) + pts,
                    },
                  }));
                  showToast(
                    `🎉 +${pts} points d'Éclaireur gagnés au Blind-Test !`
                  );
                }}
                onPlayPip={handleLaunchPip}
              />

              {/* Temporal Gravity Selector (when in Live Mode) */}
              {selectedArchiveEra === "live" && (
                <div className="flex gap-2 flex-wrap">
                  {[
                    {
                      id: "gravity" as PantheonMode,
                      label: "En ce moment (Gravité 24h)",
                    },
                    {
                      id: "emerging" as PantheonMode,
                      label: "Émergentes (-12h)",
                    },
                    { id: "month" as PantheonMode, label: "Top du Mois" },
                    {
                      id: "alltime" as PantheonMode,
                      label: "Légendes Intemporelles",
                    },
                  ].map((m) => {
                    const active = pantheonMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPantheonMode(m.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                          active
                            ? "btn-couture"
                            : "glass-panel glass-panel-interactive"
                        }`}
                        style={{
                          background: active
                            ? "linear-gradient(135deg, var(--accent), #5e35ff)"
                            : undefined,
                          color: active ? "#ffffff" : "var(--text-main)",
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 15 Pillars Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {orbitState.domains.map((d) => {
                  const active =
                    d.name === activePillar &&
                    !(
                      selectedArchiveEra !== "live" &&
                      orbitState.pantheonShowAllDomainsArchive
                    );
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setActivePillar(d.name);
                        setActiveSubpillar("Tous");
                        if (orbitState.pantheonShowAllDomainsArchive) {
                          setOrbitState((prev) => ({
                            ...prev,
                            pantheonShowAllDomainsArchive: false,
                          }));
                        }
                      }}
                      className={`p-3 rounded-xl flex items-center gap-2.5 text-xs font-extrabold cursor-pointer transition-all text-left ${
                        active
                          ? "btn-couture"
                          : "glass-panel glass-panel-interactive"
                      }`}
                      style={{
                        background: active
                          ? "linear-gradient(135deg, var(--accent), #5e35ff)"
                          : undefined,
                        color: active ? "#ffffff" : "var(--text-main)",
                      }}
                    >
                      <span className="text-base shrink-0">{d.icon}</span>
                      <span className="truncate">{d.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* 7 Subdomains Bar */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {["Tous", ...activePillarObj.subs].map((sub) => {
                  const active = sub === activeSubpillar;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setActiveSubpillar(sub)}
                      className="px-3.5 py-2 rounded-full text-xs font-bold cursor-pointer transition-all whitespace-nowrap shrink-0"
                      style={{
                        background: active
                          ? "var(--text-main)"
                          : "var(--bg-card)",
                        color: active ? "var(--bg-main)" : "var(--text-muted)",
                        border: active
                          ? "1px solid transparent"
                          : "1px solid var(--border)",
                      }}
                    >
                      {sub}
                    </button>
                  );
                })}
              </div>

              {/* Ranked Pantheon Video Grid */}
              {pantheonVideos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {pantheonVideos.map((v, idx) => (
                    <VideoCard
                      key={`${v.id}-${selectedArchiveEra}-${idx}`}
                      video={v}
                      rankNumber={idx + 1}
                      archiveActiveLabel={
                        selectedArchiveEra !== "live"
                          ? v.archiveDateLabel || currentArchiveMeta.periodBadge
                          : undefined
                      }
                      isInWatchLater={watchLaterIds.includes(v.id)}
                      isWatched={watchedIds.includes(v.id)}
                      onToggleWatchLater={handleToggleWatchLater}
                      onPlayPip={handleLaunchPip}
                      onRateVideo={handleRateVideo}
                      onAddComment={handleAddComment}
                      onTriggerReaction={handleTriggerReaction}
                      onMarkWatched={handleMarkVideoWatched}
                      onRepost={handleRepost}
                      onSummarizeVideo={handleSummarizeVideo}
                      onTranslateComment={handleTranslateComment}
                      onOpenCinema={handleLaunchCinema}
                      onPlayAudioMode={(vid) => {
                        setAudioModeVideo(vid);
                        setAudioPlaying(true);
                        handleMarkVideoWatched(vid.id);
                      }}
                      onAddToJukebox={handleAddToJukebox}
                      onRemoveUnavailableVideo={handleRemoveUnavailableVideo}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-3xl glass-panel text-center space-y-3">
                  <div className="text-base font-bold font-display">
                    Vous avez déjà vu toutes les vidéos de ce classement !
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleHideWatched}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture"
                    style={{ background: "var(--accent)" }}
                  >
                    Désactiver le filtre « Masquer les vidéos déjà vues »
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ==========================================================
              PAGE 4 : LE RADAR + IDÉE 6 HUMEUR + IDÉE 13 RADAR GÉOLOCALISÉ PRIVÉ
              + FONCTIONNALITÉ 17 (INTERRUPTEUR ANTI-DÉJÀ-VU)
              ========================================================== */}
          {activePage === "p4" && (
            <section className="space-y-6">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                    Le Radar de Recommandations
                  </h1>
                  <p
                    className="text-sm mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Orientez vos découvertes selon votre humeur cognitive, votre zone géographique privée et votre curseur d&apos;exploration.
                  </p>
                </div>

                {/* Actions Page 4 : Mode Immersion Reels Infini + Interrupteur Anti-Déjà-Vu */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setFeedViewMode("immersion")}
                    className="px-4 py-2.5 rounded-2xl text-xs font-black text-white inline-flex items-center gap-2 cursor-pointer transition-all btn-couture"
                    style={{
                      background:
                        "linear-gradient(135deg, #00e5ff, var(--accent))",
                      boxShadow: "0 6px 20px rgba(0, 229, 255, 0.3)",
                    }}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>📱 Mode Immersion Reels (Infini)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleHideWatched}
                    className="px-4 py-2.5 rounded-2xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-all"
                    style={{
                      background: hideWatched
                        ? "rgba(0, 230, 118, 0.16)"
                        : "var(--bg-card)",
                      border: `1px solid ${
                        hideWatched ? "#00e676" : "var(--border)"
                      }`,
                      color: hideWatched ? "var(--success)" : "var(--text-main)",
                    }}
                  >
                    {hideWatched ? (
                      <EyeOff className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Eye className="w-4 h-4 text-cyan-400" />
                    )}
                    <span>
                      {hideWatched
                        ? `✓ Masquer les vidéos déjà vues (${watchedIds.length})`
                        : "Masquer les vidéos déjà vues"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Idée 13 : Le Radar Géolocalisé Privé ('Pépites près de chez vous') */}
              <div className="p-6 rounded-3xl glass-panel space-y-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0"
                      style={{
                        background: "linear-gradient(135deg, #10b981, #059669)",
                        boxShadow: "0 0 20px rgba(16, 185, 129, 0.35)",
                      }}
                    >
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-extrabold font-display flex items-center gap-2 flex-wrap">
                        <span>
                          Pépites près de chez vous (Radar Géolocalisé Privé)
                        </span>
                        <span
                          className="text-[11px] font-mono-num"
                          style={{ color: "var(--success)" }}
                        >
                          · 🔒 {activeGeoZone.anonymizedHash}
                        </span>
                      </div>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Respect strict de la vie privée : aucune adresse ni coordonnée GPS exacte n&apos;est stockée. Agrégation anonyme par macro-zone géographique.
                      </p>
                    </div>
                  </div>

                  {/* Zone Selector */}
                  <select
                    value={orbitState.radarGeoZoneId || "montpellier-occitanie"}
                    onChange={(e) => {
                      const nextZone = e.target.value;
                      setOrbitState((prev) => ({
                        ...prev,
                        radarGeoZoneId: nextZone,
                      }));
                      const found = GEO_ZONE_PRESETS.find(
                        (z) => z.id === nextZone
                      );
                      if (found) {
                        showToast(`📍 Macro-zone privée : ${found.name}`);
                      }
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-bold outline-none cursor-pointer"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      color: "var(--text-main)",
                    }}
                  >
                    {GEO_ZONE_PRESETS.map((z) => (
                      <option key={z.id} value={z.id}>
                        📍 {z.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Radius Selector (10 km, 50 km, Région) */}
                <div className="flex items-center justify-between flex-wrap gap-3 pt-1">
                  <div className="flex gap-2 flex-wrap">
                    {[
                      {
                        id: "10km" as GeoRadius,
                        label: "Rayon 10 km (Ville / Quartiers)",
                        desc: activeGeoZone.label10km,
                      },
                      {
                        id: "50km" as GeoRadius,
                        label: "Rayon 50 km (Littoral & Bassin)",
                        desc: activeGeoZone.label50km,
                      },
                      {
                        id: "region" as GeoRadius,
                        label: "Région (Occitanie)",
                        desc: activeGeoZone.labelRegion,
                      },
                    ].map((rad) => {
                      const isSel = activeGeoRadius === rad.id;
                      return (
                        <button
                          key={rad.id}
                          type="button"
                          onClick={() =>
                            setOrbitState((prev) => ({
                              ...prev,
                              radarGeoRadius: rad.id,
                            }))
                          }
                          className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all"
                          style={{
                            background: isSel
                              ? "linear-gradient(135deg, #10b981, #047857)"
                              : "rgba(255,255,255,0.04)",
                            color: isSel ? "#ffffff" : "var(--text-main)",
                            border: isSel
                              ? "1px solid rgba(16, 185, 129, 0.5)"
                              : "1px solid var(--border)",
                          }}
                        >
                          {rad.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-xs font-semibold text-emerald-400">
                    Périmètre actif :{" "}
                    {activeGeoRadius === "10km"
                      ? activeGeoZone.label10km
                      : activeGeoRadius === "50km"
                      ? activeGeoZone.label50km
                      : activeGeoZone.labelRegion}
                  </div>
                </div>

                {/* Local Geo Videos Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                  {localGeoVideos.slice(0, 3).map((v) => (
                    <VideoCard
                      key={`geo-${v.id}`}
                      video={v}
                      showLocalGeoBadge={true}
                      isInWatchLater={watchLaterIds.includes(v.id)}
                      isWatched={watchedIds.includes(v.id)}
                      onToggleWatchLater={handleToggleWatchLater}
                      onPlayPip={handleLaunchPip}
                      onRateVideo={handleRateVideo}
                      onAddComment={handleAddComment}
                      onTriggerReaction={handleTriggerReaction}
                      onMarkWatched={handleMarkVideoWatched}
                      onRepost={handleRepost}
                      onSummarizeVideo={handleSummarizeVideo}
                      onTranslateComment={handleTranslateComment}
                      onOpenCinema={handleLaunchCinema}
                      onPlayAudioMode={(vid) => {
                        setAudioModeVideo(vid);
                        setAudioPlaying(true);
                        handleMarkVideoWatched(vid.id);
                      }}
                      onAddToJukebox={handleAddToJukebox}
                      onRemoveUnavailableVideo={handleRemoveUnavailableVideo}
                    />
                  ))}
                </div>
              </div>

              {/* Idée 6 : Widget d'Humeur du Jour */}
              <div className="p-6 rounded-3xl glass-panel space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="text-sm font-extrabold font-display">
                      Quelle est votre Humeur du Jour ?
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Sélectionnez une intention pour réorienter instantanément les recommandations du Radar.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {MOOD_PRESETS.map((mood) => {
                    const isSelected = activeMood === mood.id;
                    return (
                      <button
                        key={mood.id}
                        type="button"
                        onClick={() => setActiveMood(mood.id)}
                        className="p-3.5 rounded-2xl text-left cursor-pointer transition-all hover:scale-[1.01]"
                        style={{
                          background: isSelected
                            ? `${mood.accentColor}22`
                            : "rgba(255,255,255,0.03)",
                          border: `1px solid ${
                            isSelected ? mood.accentColor : "var(--border)"
                          }`,
                        }}
                      >
                        <div
                          className="text-xs font-extrabold font-display"
                          style={{
                            color: isSelected
                              ? mood.accentColor
                              : "var(--text-main)",
                          }}
                        >
                          {mood.label}
                        </div>
                        <div
                          className="text-[11px] mt-0.5"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {mood.subtitle}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Algorithm Calibration Slider */}
              <div className="p-6 rounded-3xl glass-panel flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-extrabold font-display">
                    Calibrage de l&apos;Algorithme Personnel
                  </div>
                  <div
                    className="text-xs mt-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {radarExploration < 35
                      ? `Mode Haute Affinité (${
                          100 - radarExploration
                        }% cœur de cible) : Priorité absolue à vos domaines favoris.`
                      : radarExploration < 70
                      ? "Mode Équilibré : Mélange optimal entre vos passions et des pépites d'autres domaines."
                      : `Mode Exploration Hors-Piste (${radarExploration}%) : Découverte des meilleures vidéos dans les domaines que vous connaissez moins !`}
                  </div>
                </div>

                <div className="flex items-center gap-3 min-w-[260px]">
                  <span className="text-xs font-bold whitespace-nowrap">
                    Affinités Pures
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={radarExploration}
                    onChange={(e) =>
                      setRadarExploration(parseInt(e.target.value, 10))
                    }
                    className="orbit-slider flex-1 cursor-pointer"
                  />
                  <span
                    className="text-xs font-bold whitespace-nowrap"
                    style={{ color: "var(--accent-2)" }}
                  >
                    Hors-Piste
                  </span>
                </div>
              </div>

              {/* Cultural Twins */}
              <div className="p-6 rounded-3xl glass-panel space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm font-extrabold font-display">
                    Vos Jumeaux de Goûts détectés (Contacts & Réseau)
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage("p5");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-400/30 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>
                      🔍 Scanner mes contacts (Page 5 · Réglage et Importation)
                    </span>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {orbitState.twins.map((t, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-2xl flex flex-col justify-between gap-2"
                      style={{
                        background: t.isRealImported
                          ? "rgba(0, 230, 118, 0.08)"
                          : "rgba(255,255,255,0.03)",
                        border: `1px solid ${
                          t.isRealImported
                            ? "rgba(0, 230, 118, 0.45)"
                            : "var(--border)"
                        }`,
                        boxShadow: "inset 0 1px 0 0 rgba(255,255,255,0.07)",
                      }}
                    >
                      <div className="space-y-1">
                        <div className="font-extrabold text-xs flex items-center justify-between gap-1">
                          <span>{t.name}</span>
                          {t.isRealImported && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300">
                              Importé ✓
                            </span>
                          )}
                        </div>
                        <div
                          className="text-xs font-bold font-mono-num"
                          style={{ color: "var(--success)" }}
                        >
                          {t.match}% d&apos;affinité · {t.domains}
                        </div>
                        <div
                          className="text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {t.lastPick}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const cleanName = t.name
                            .replace(/\s*\([^)]+\)/g, "")
                            .trim();
                          const firstDomain = t.domains.split("·")[0].trim();
                          setCapFriend(cleanName);
                          if (
                            orbitState.domains.some(
                              (d) => d.name === firstDomain
                            )
                          ) {
                            setCapDomain(firstDomain);
                          }
                          setOpenModal("capsule");
                        }}
                        className="w-full py-1.5 px-2.5 rounded-xl text-[11px] font-bold bg-white/5 hover:bg-white/10 text-emerald-300 border border-white/10 cursor-pointer inline-flex items-center justify-center gap-1"
                      >
                        <Gift className="w-3 h-3" />
                        <span>Générer Capsule WhatsApp</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Radar Video Grid */}
              {radarVideos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {radarVideos.map((v) => (
                    <VideoCard
                      key={v.id}
                      video={v}
                      isInWatchLater={watchLaterIds.includes(v.id)}
                      isWatched={watchedIds.includes(v.id)}
                      onToggleWatchLater={handleToggleWatchLater}
                      onPlayPip={handleLaunchPip}
                      onRateVideo={handleRateVideo}
                      onAddComment={handleAddComment}
                      onTriggerReaction={handleTriggerReaction}
                      onMarkWatched={handleMarkVideoWatched}
                      onRepost={handleRepost}
                      onSummarizeVideo={handleSummarizeVideo}
                      onTranslateComment={handleTranslateComment}
                      onOpenCinema={handleLaunchCinema}
                      onPlayAudioMode={(vid) => {
                        setAudioModeVideo(vid);
                        setAudioPlaying(true);
                        handleMarkVideoWatched(vid.id);
                      }}
                      onAddToJukebox={handleAddToJukebox}
                      onRemoveUnavailableVideo={handleRemoveUnavailableVideo}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-3xl glass-panel text-center space-y-3">
                  <div className="text-base font-bold font-display">
                    Toutes les recommandations actuelles du Radar ont déjà été vues !
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleHideWatched}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture"
                    style={{ background: "var(--accent)" }}
                  >
                    Réafficher toutes les découvertes
                  </button>
                </div>
              )}
            </section>
          )}

          {/* ==========================================================
              PAGE 5 : RÉGLAGE ET IMPORTATION (LA PASSERELLE LOCAL-FIRST)
              ========================================================== */}
          {activePage === "p5" && (
            <ReglageEtImportationView
              domains={orbitState.domains}
              socials={orbitState.socials}
              videos={orbitState.videos}
              twins={orbitState.twins}
              profileName={orbitState.profile.name}
              onApplyRealImport={handleApplyNetworkImport}
              onRepairCatalog={handleRepairCatalog51}
              onNavigateToPage={(pageId) => {
                setActivePage(pageId);
                setFeedViewMode("grid");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onShowToast={showToast}
            />
          )}
        </main>
      )}

      {/* ==========================================================
          FONCTIONNALITÉ 20 : MODALE GÉNÉRATEUR DE QR CODE DE PLAYLIST
          ========================================================== */}
      <PlaylistQrModal
        isOpen={qrModalConfig.isOpen}
        onClose={() =>
          setQrModalConfig((prev) => ({ ...prev, isOpen: false }))
        }
        selectionTitle={qrModalConfig.title}
        selectionSubtitle={qrModalConfig.subtitle}
        curatorName={orbitState.profile.name}
        videos={qrModalConfig.videos}
        sourcePageLabel={qrModalConfig.sourcePageLabel}
        onSimulateScanSelection={(selectedVids, title) => {
          setScannedPlaylistBanner({
            title,
            curator: orbitState.profile.name,
            videoIds: selectedVids.map((v) => v.id),
          });
          setActivePage("p1");
          setFeedViewMode("grid");
          showToast(
            `📱 Scan simulé avec succès : ouverture d'ORBIT sur « ${title} » (${selectedVids.length} vidéos) !`
          );
        }}
        onShowToast={showToast}
      />

      {/* ==========================================================
          IDÉE 1 : MODE CINÉMA PLEIN ÉCRAN (THEATRE BLACKOUT OVERLAY)
          ========================================================== */}
      {cinemaModalVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/96 backdrop-blur-2xl flex flex-col items-center justify-center p-4 sm:p-8"
          onClick={() => setCinemaModalVideo(null)}
        >
          <div
            className="w-full max-w-5xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between text-white/80 text-xs">
              <div className="flex items-center gap-2 font-bold">
                <Film className="w-4 h-4 text-amber-400" />
                <span>Mode Cinéma Haute Immersion</span>
                <span>·</span>
                <span className="text-white">{cinemaModalVideo.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setCinemaModalVideo(null)}
                className="px-3 py-1.5 rounded-xl glass-action-btn text-white font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>Rallumer les lumières</span>
              </button>
            </div>
            <div
              className="w-full aspect-video rounded-3xl overflow-hidden bg-black"
              style={{
                boxShadow:
                  "0 0 120px rgba(124, 92, 255, 0.3), 0 35px 90px rgba(0, 0, 0, 0.95)",
                border: "1px solid rgba(255,255,255,0.16)",
              }}
            >
              <iframe
                width="100%"
                height="100%"
                src={getVideoEmbedConfig(cinemaModalVideo).embedUrl}
                title={cinemaModalVideo.title}
                frameBorder="0"
                allow="autoplay; encrypted-media; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          IDÉE 8 : MODE AUDIO / PODCAST EN ARRIÈRE-PLAN (PERSISTENT DOCK)
          ========================================================== */}
      {audioModeVideo && (
        <div className="fixed bottom-20 lg:bottom-6 left-4 lg:left-72 z-50 w-[320px] sm:w-[400px] glass-pill-bar rounded-3xl p-3.5 text-white flex items-center justify-between gap-3">
          {audioPlaying && (
            <iframe
              width="1"
              height="1"
              className="opacity-0 pointer-events-none absolute"
              src={`https://www.youtube-nocookie.com/embed/${audioModeVideo.youtubeId}?autoplay=1`}
              title="Audio Stream"
              allow="autoplay"
            />
          )}

          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--accent), var(--accent-2))",
              }}
            >
              <Headphones className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">
                Mode Audio / Podcast Actif
              </div>
              <div className="text-xs font-extrabold truncate">
                {audioModeVideo.title}
              </div>
              <div className="text-[11px] text-white/65 truncate">
                @{audioModeVideo.user} · {audioModeVideo.domain}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setAudioPlaying(!audioPlaying)}
              className="w-9 h-9 rounded-xl glass-action-btn flex items-center justify-center text-white cursor-pointer"
            >
              {audioPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                const idx = unlockedVideos.findIndex(
                  (v) => v.id === audioModeVideo.id
                );
                const nextVid =
                  unlockedVideos[(idx + 1) % unlockedVideos.length];
                if (nextVid) {
                  setAudioModeVideo(nextVid);
                  handleMarkVideoWatched(nextVid.id);
                }
              }}
              className="w-9 h-9 rounded-xl glass-action-btn flex items-center justify-center text-white cursor-pointer"
              title="Piste audio suivante"
            >
              <SkipForward className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setAudioModeVideo(null)}
              className="w-8 h-8 rounded-xl hover:bg-white/10 flex items-center justify-center text-white/70 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==========================================================
          MODALE INTELLIGENT COMPOSER + IDÉE 9 TIME-CAPSULE
          ========================================================== */}
      {composerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setComposerOpen(false)}
        >
          <form
            onSubmit={handlePublishVideo}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-3xl p-6 space-y-4 glass-panel max-h-[92vh] overflow-y-auto"
            style={{
              background: "var(--bg-surface)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-black font-display">
                  Partager une pépite ou programmer une Time-Capsule
                </h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  L&apos;IA Gemini 3.8 Flash détecte automatiquement le pilier et le sous-domaine (+15 pts d&apos;Éclaireur).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComposerOpen(false)}
                className="cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className="text-xs px-3.5 py-2 rounded-xl flex items-center justify-between gap-2 flex-wrap"
              style={{
                background: "rgba(0, 229, 255, 0.08)",
                border: "1px solid rgba(0, 229, 255, 0.25)",
                color: "var(--accent-2)",
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                {isClassifying ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Sparkles className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">{aiStatusText}</span>
              </div>
              <button
                type="button"
                onClick={handleQuickPasteButton}
                className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-cyan-950 bg-cyan-300 hover:bg-cyan-200 inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Coller rapide (Telegram / Discord)</span>
              </button>
            </div>

            {inpImportedVia && (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/35 text-emerald-300 text-[11px] font-bold flex items-center justify-between">
                <span>
                  ⚡ Source détectée : Passerelle {inpImportedVia.toUpperCase()}{" "}
                  — Fiche pré-remplie et classée automatiquement
                </span>
                <button
                  type="button"
                  onClick={() => setInpImportedVia(undefined)}
                  className="text-white/60 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="space-y-3">
              <input
                type="text"
                value={inpUrl}
                onChange={(e) => {
                  setInpUrl(e.target.value);
                  handleLocalClassify(e.target.value, inpTitle);
                }}
                placeholder="Lien YouTube, Shorts, TikTok, Instagram Reel, Twitch..."
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <select
                  value={inpDomain}
                  onChange={(e) => {
                    const nextDom = e.target.value;
                    setInpDomain(nextDom);
                    const found = orbitState.domains.find(
                      (d) => d.name === nextDom
                    );
                    if (found) setInpSubdomain(found.subs[0]);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    color: "var(--text-main)",
                  }}
                >
                  {orbitState.domains.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.icon} {d.name}
                    </option>
                  ))}
                </select>

                <select
                  value={inpSubdomain}
                  onChange={(e) => setInpSubdomain(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs outline-none"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    color: "var(--text-main)",
                  }}
                >
                  {composerSubdomains.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                value={inpTitle}
                onChange={(e) => {
                  setInpTitle(e.target.value);
                  handleLocalClassify(inpUrl, e.target.value);
                }}
                placeholder="Titre de la vidéo (récupéré automatiquement via oEmbed ou personnalisé)"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              />

              <input
                type="text"
                value={inpComment}
                onChange={(e) => setInpComment(e.target.value)}
                placeholder="Votre avis critique pour vos abonnés..."
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              />

              {/* Idée 9 : Time-Capsule Scheduler */}
              <div
                className="p-3.5 rounded-2xl space-y-2.5 text-xs"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center justify-between">
                  <label className="font-bold flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isTimeCapsule}
                      onChange={(e) => setIsTimeCapsule(e.target.checked)}
                    />
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>
                      Programmer en Time-Capsule ⏳ (Ouverture différée)
                    </span>
                  </label>
                </div>

                {isTimeCapsule && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span style={{ color: "var(--text-muted)" }}>
                      Déverrouiller dans :
                    </span>
                    {[
                      { min: 1, label: "1 min (Test Live)" },
                      { min: 60, label: "Dans 1 heure" },
                      { min: 1440, label: "Demain (24h)" },
                    ].map((preset) => (
                      <button
                        key={preset.min}
                        type="button"
                        onClick={() => setCapsuleDelayMinutes(preset.min)}
                        className="px-3 py-1 rounded-lg text-xs font-bold cursor-pointer"
                        style={{
                          background:
                            capsuleDelayMinutes === preset.min
                              ? "var(--accent)"
                              : "var(--bg-input)",
                          color:
                            capsuleDelayMinutes === preset.min
                              ? "#fff"
                              : "var(--text-main)",
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isClassifying}
                onClick={() => triggerGeminiClassification()}
                className="px-4 py-2.5 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive whitespace-nowrap shrink-0"
                style={{
                  color: "var(--accent-2)",
                }}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyser via IA Gemini</span>
              </button>
              <button
                type="submit"
                disabled={isClassifying}
                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture whitespace-nowrap shrink-0"
                style={{
                  background: "linear-gradient(135deg, var(--accent), #5e35ff)",
                }}
              >
                {isTimeCapsule
                  ? "Sceller la Time-Capsule ⏳"
                  : "Publier dans le Flux"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==========================================================
          IDÉE 2 : MODALE JUKEBOX COLLABORATIF EN TEMPS RÉEL
          ========================================================== */}
      {openModal === "jukebox" && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setOpenModal(null)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto space-y-4 glass-panel"
            style={{ background: "var(--bg-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Radio className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-lg font-black font-display">
                    Jukebox Collaboratif en Temps Réel
                  </h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Synchronisé en direct entre vos onglets et votre cercle d&apos;amis (Anne-Sophie, Thomas_AI, Claire_Optic).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(null)}
                className="cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {jukeboxPlayingTrack && (
              <div className="rounded-2xl overflow-hidden bg-black aspect-video border border-white/15">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube-nocookie.com/embed/${jukeboxPlayingTrack.youtubeId}?autoplay=1`}
                  title={jukeboxPlayingTrack.title}
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            )}

            {/* Shared Queue */}
            <div className="space-y-2">
              <div className="text-xs font-extrabold">
                File d&apos;attente collaborative (Votez pour propulser un titre en tête) :
              </div>
              <div className="space-y-2">
                {orbitState.jukebox.map((track, idx) => (
                  <div
                    key={track.id}
                    className="p-3 rounded-2xl flex items-center justify-between gap-3"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono-num text-xs font-black text-emerald-400">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate">
                          {track.title}
                        </div>
                        <div
                          className="text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          Ajouté par @{track.addedBy} · {track.domain}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleBoostJukeboxTrack(track.id)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-mono-num font-bold inline-flex items-center gap-1 cursor-pointer glass-panel glass-panel-interactive"
                      >
                        <ThumbsUp className="w-3.5 h-3.5 text-emerald-400" />
                        <span>+{track.boosts}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setJukeboxPlayingTrack(track);
                          handleMarkVideoWatched(track.videoId);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture inline-flex items-center gap-1"
                        style={{ background: "var(--accent)" }}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Lancer</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Jukebox Chat */}
            <div
              className="pt-3 space-y-2.5"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <div className="text-xs font-extrabold">
                Salon de discussion du Jukebox :
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto p-3 rounded-2xl bg-black/25">
                {jukeboxChat.map((m) => (
                  <div key={m.id} className="text-xs flex items-baseline gap-2">
                    <span className="font-mono-num text-[10px] opacity-55">
                      {m.time}
                    </span>
                    <strong className="text-emerald-400">@{m.author} :</strong>
                    <span>{m.text}</span>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendJukeboxChat} className="flex gap-2">
                <input
                  type="text"
                  value={jukeboxMsgInput}
                  onChange={(e) => setJukeboxMsgInput(e.target.value)}
                  placeholder="Envoyer un message au salon Jukebox..."
                  className="flex-1 px-3.5 py-2 rounded-xl text-xs outline-none"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    color: "var(--text-main)",
                  }}
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture inline-flex items-center gap-1.5"
                  style={{ background: "var(--accent)" }}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          PROMPT 3 : MODALE HAUTE DISPONIBILITÉ 24/7 & CLOUD ADAPTER
          ========================================================== */}
      {openModal === "resilience" && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setOpenModal(null)}
        >
          <div
            className="w-full max-w-xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto space-y-4 glass-panel"
            style={{ background: "var(--bg-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-lg font-black font-display">
                    Haute Disponibilité 24/7 & Connecteur Cloud
                  </h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Architecture Local-First (LocalStorage + IndexedDB + Service Worker v3) avec adaptateur Cloud optionnel.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenModal(null)}
                className="cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cache Telemetry Cards */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <div
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Service Worker
                </div>
                <div className="text-sm font-black font-mono-num text-emerald-400 mt-0.5">
                  {swStats.status}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <div
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  Ressources en Cache
                </div>
                <div className="text-sm font-black font-mono-num text-cyan-300 mt-0.5">
                  {swStats.totalCached} fichiers
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                <div
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  watchedVideoIds
                </div>
                <div className="text-sm font-black font-mono-num text-purple-300 mt-0.5">
                  {watchedIds.length} vidéos
                </div>
              </div>
            </div>

            {/* Modular Cloud Database Connector */}
            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <span>Adaptateur Base de Données Modulaire</span>
                </div>
                <select
                  value={cloudConfig.provider}
                  onChange={(e) => {
                    const next: CloudConnectorConfig = {
                      ...cloudConfig,
                      provider: e.target
                        .value as CloudConnectorConfig["provider"],
                      enabled: e.target.value !== "local-sovereign",
                    };
                    setCloudConfig(next);
                    OrbitStorageService.saveCloudConfig(next);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold outline-none"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    color: "var(--text-main)",
                  }}
                >
                  <option value="local-sovereign">
                    Local-First Souverain (Par défaut)
                  </option>
                  <option value="supabase">
                    Supabase Cloud (PostgreSQL REST)
                  </option>
                  <option value="alphabette-vps">
                    Serveur VPS Alphabette (Fastify / PG)
                  </option>
                </select>
              </div>

              {cloudConfig.provider !== "local-sovereign" && (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    value={cloudConfig.endpointUrl}
                    onChange={(e) => {
                      const next = {
                        ...cloudConfig,
                        endpointUrl: e.target.value,
                      };
                      setCloudConfig(next);
                      OrbitStorageService.saveCloudConfig(next);
                    }}
                    placeholder="URL de l'instance (ex: https://xyz.supabase.co ou https://api.alphabette.fr)"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      color: "var(--text-main)",
                    }}
                  />
                  <input
                    type="password"
                    value={cloudConfig.anonKey}
                    onChange={(e) => {
                      const next = { ...cloudConfig, anonKey: e.target.value };
                      setCloudConfig(next);
                      OrbitStorageService.saveCloudConfig(next);
                    }}
                    placeholder="Clé publique Anon / Jeton JWT"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      color: "var(--text-main)",
                    }}
                  />
                </div>
              )}
            </div>

            {/* Offline Mutation Sync Queue */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-extrabold">
                  Journal de Réplication Hors-Ligne ({syncQueue.length}{" "}
                  événements)
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await OrbitStorageService.flushSyncQueue();
                    setSyncQueue(OrbitStorageService.getSyncQueue());
                    showToast(
                      `Synchronisation exécutée à ${res.timestamp} (${res.flushedCount} mutation(s)).`
                    );
                  }}
                  className="px-3 py-1 rounded-lg text-xs font-bold text-cyan-300 inline-flex items-center gap-1 cursor-pointer glass-panel"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Forcer la Sync</span>
                </button>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 p-2.5 rounded-2xl bg-black/25 text-[11px] font-mono-num">
                {syncQueue.length > 0 ? (
                  syncQueue.slice(0, 8).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between py-1 border-b border-white/5"
                    >
                      <span>
                        [{m.createdAt}] {m.type}
                      </span>
                      <span
                        className={
                          m.synced ? "text-emerald-400" : "text-amber-400"
                        }
                      >
                        {m.synced ? "✓ Persistant" : "⏳ En file"}
                      </span>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "var(--text-muted)" }}>
                    Aucune mutation en attente. Base locale 100% intègre.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          PERSISTENT PICTURE-IN-PICTURE (PiP) MINI PLAYER
          ========================================================== */}
      {pipVideo && (
        <div
          className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 w-[300px] sm:w-[350px] rounded-3xl overflow-hidden z-50 glass-pill-bar"
          style={{
            borderColor: "var(--accent)",
          }}
        >
          <div className="px-3.5 py-2.5 flex items-center justify-between bg-black/50 text-xs font-bold text-white">
            <span className="truncate max-w-[220px]">{pipVideo.title}</span>
            <button
              type="button"
              onClick={() => setPipVideo(null)}
              className="text-white/80 hover:text-white cursor-pointer inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Fermer</span>
            </button>
          </div>
          <div className="w-full aspect-video bg-black">
            <iframe
              width="100%"
              height="100%"
              src={getVideoEmbedConfig(pipVideo).embedUrl}
              title={pipVideo.title}
              frameBorder="0"
              allow="autoplay; encrypted-media; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <div className="px-3.5 py-2.5 flex items-center justify-between text-[11px] text-white">
            <span
              className="font-bold truncate"
              style={{ color: "var(--accent-2)" }}
            >
              {pipVideo.domain} › {pipVideo.subdomain}
            </span>
            <a
              href={pipVideo.rawUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold inline-flex items-center gap-1 shrink-0 text-white"
            >
              <span>App Native</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* ==========================================================
          MODALE 1 : MOTEUR DE CONSENTEMENT RGPD & ACQUISITION RÉELLE DES DONNÉES
          ========================================================== */}
      <ConsentAndAcquisitionModal
        isOpen={openModal === "sync"}
        isInitialOnboarding={!orbitState.gdprConsentGiven}
        gdprConsentGiven={Boolean(orbitState.gdprConsentGiven)}
        initialSelectedConnectorId={selectedConnectorForModal}
        socials={orbitState.socials}
        domains={orbitState.domains}
        twins={orbitState.twins}
        profileName={orbitState.profile.name}
        onAcceptGdprConsent={handleAcceptGdprConsent}
        onClose={() => {
          setSelectedConnectorForModal(null);
          setOpenModal(null);
        }}
        onApplyNetworkImport={handleApplyNetworkImport}
        onRevokeNetwork={handleRevokeNetwork}
        onGenerateCustomAiDna={handleGenerateCustomAiDna}
        onOpenCapsuleForFriend={(friendName, domainName) => {
          setCapFriend(friendName);
          if (orbitState.domains.some((d) => d.name === domainName)) {
            setCapDomain(domainName);
          }
          setOpenModal("capsule");
        }}
        onShowToast={showToast}
      />

      {/* ==========================================================
          MODALE 2 : CAPSULE D'AFFINITÉ VIRALE (WHATSAPP / CONTACTS)
          ========================================================== */}
      {openModal === "capsule" && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setOpenModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl p-6 space-y-4 glass-panel"
            style={{
              background: "var(--bg-surface)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black font-display">
                Générer une Capsule d&apos;Affinité pour un Ami
              </h3>
              <button
                type="button"
                onClick={() => setOpenModal(null)}
                className="cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={capFriend}
                onChange={(e) => setCapFriend(e.target.value)}
                placeholder="Prénom de l'ami (ex: Anne-Sophie, Ronny, Nicolas...)"
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              />

              <select
                value={capDomain}
                onChange={(e) => setCapDomain(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none"
                style={{
                  background: "var(--bg-input)",
                  border: "1px solid var(--border)",
                  color: "var(--text-main)",
                }}
              >
                {orbitState.domains.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.icon} {d.name} ({d.affinity}% d&apos;affinité)
                  </option>
                ))}
              </select>

              <div
                className="p-3.5 rounded-2xl text-xs leading-relaxed"
                style={{
                  background: "rgba(0, 230, 118, 0.1)",
                  border: "1px solid rgba(0, 230, 118, 0.35)",
                }}
              >
                « Salut <strong>{capFriend || "mon ami"}</strong> ! Je t&apos;ai préparé ta capsule vidéo personnalisée sur <strong>ORBIT</strong> dans le domaine{" "}
                <strong>{capDomain}</strong>. J&apos;ai sélectionné 3 pépites qui correspondent à 95% à nos goûts communs ! »
              </div>

              <div className="flex gap-2.5 flex-wrap pt-1">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    capsuleMessage
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold text-white inline-flex items-center justify-center gap-2 no-underline btn-couture"
                  style={{
                    background: "linear-gradient(135deg, #00c853, #009624)",
                  }}
                >
                  <span>Envoyer sur WhatsApp</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(capsuleMessage);
                    setCapsuleCopied(true);
                    setTimeout(() => setCapsuleCopied(false), 2000);
                  }}
                  className="py-2.5 px-4 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer glass-panel glass-panel-interactive"
                >
                  {capsuleCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Lien copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copier l&apos;invitation</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          MODALE 3 : STUDIO DESIGN & GESTION DES DONNÉES
          ========================================================== */}
      {openModal === "design" && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setOpenModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-3xl p-6 space-y-5 glass-panel"
            style={{
              background: "var(--bg-surface)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black font-display">
                Studio Design & Personnalisation Haute Couture
              </h3>
              <button
                type="button"
                onClick={() => setOpenModal(null)}
                className="cursor-pointer opacity-70 hover:opacity-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold">
                Thème Visuel Glassmorphism :
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: "onyx" as ThemeName, label: "Onyx (Sombre Cinéma)" },
                  {
                    id: "alabaster" as ThemeName,
                    label: "Alabaster (Clair Éditorial)",
                  },
                  { id: "polar" as ThemeName, label: "Verre Polaire" },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setOrbitState((prev) => ({ ...prev, theme: t.id }))
                    }
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${
                      orbitState.theme === t.id ? "btn-couture" : "glass-panel"
                    }`}
                    style={{
                      background:
                        orbitState.theme === t.id ? "var(--accent)" : undefined,
                      color:
                        orbitState.theme === t.id ? "#fff" : "var(--text-main)",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold">
                Couleur d&apos;Accentuation :
              </div>
              <div className="flex gap-2 flex-wrap">
                {[
                  { hex: "#7c5cff", label: "Violet Cosmique", text: "#fff" },
                  { hex: "#00e5ff", label: "Cyan Solaire", text: "#000" },
                  { hex: "#ff3d71", label: "Rubis", text: "#fff" },
                  { hex: "#00e676", label: "Émeraude", text: "#000" },
                ].map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() =>
                      setOrbitState((prev) => ({ ...prev, accent: c.hex }))
                    }
                    className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition-transform hover:scale-105"
                    style={{
                      background: c.hex,
                      color: c.text,
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="pt-4 flex items-center justify-between"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Réinitialiser les données de démo :
              </span>
              <button
                type="button"
                onClick={handleResetDemo}
                className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel"
                style={{
                  color: "var(--danger)",
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Réinitialiser</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          FONCTIONNALITÉ 14 : TIROIR COULISSANT (DRAWER) « À REGARDER CE SOIR »
          ========================================================== */}
      {watchLaterDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex justify-end"
          onClick={() => setWatchLaterDrawerOpen(false)}
        >
          <div
            className="w-full max-w-md h-full flex flex-col justify-between p-5 sm:p-6 overflow-y-auto glass-panel border-l border-amber-400/30"
            style={{
              background: "var(--bg-surface)",
              boxShadow: "-24px 0 80px rgba(0, 0, 0, 0.85)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                    <Hourglass className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black font-display">
                        À regarder ce soir
                      </h3>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono-num font-black bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        {watchLaterVideos.length} pépites ·{" "}
                        {watchLaterTotalMinutes} min
                      </span>
                    </div>
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Panier intelligent persistant trié par durée et par domaine.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWatchLaterDrawerOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Bouton 'Lancer ma séance du soir' */}
              <button
                type="button"
                disabled={watchLaterVideos.length === 0}
                onClick={() => {
                  if (watchLaterVideos.length > 0) {
                    setWatchLaterDrawerOpen(false);
                    setEveningSessionIndex(0);
                    setEveningSessionActive(true);
                    handleMarkVideoWatched(watchLaterVideos[0].id);
                  }
                }}
                className="w-full py-3 px-4 rounded-2xl text-xs font-black text-black cursor-pointer inline-flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #ffab00, #ffd740)",
                  boxShadow: "0 12px 30px rgba(255, 171, 0, 0.3)",
                }}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  Lancer ma séance du soir ({watchLaterVideos.length} vidéos à la suite)
                </span>
              </button>

              {/* Mode de regroupement : Par Durée vs Par Domaine */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
                  Organisation automatique :
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWatchLaterGroupMode("duration")}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer ${
                      watchLaterGroupMode === "duration"
                        ? "bg-amber-400 text-black"
                        : "glass-panel"
                    }`}
                  >
                    ⏱️ Par Durée
                  </button>
                  <button
                    type="button"
                    onClick={() => setWatchLaterGroupMode("domain")}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold cursor-pointer ${
                      watchLaterGroupMode === "domain"
                        ? "bg-amber-400 text-black"
                        : "glass-panel"
                    }`}
                  >
                    🏛️ Par Domaine
                  </button>
                </div>
              </div>

              {/* Filtres rapides de format de durée */}
              {watchLaterGroupMode === "duration" && (
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    {
                      id: "all" as const,
                      label: "Tous",
                      count: watchLaterVideos.length,
                    },
                    {
                      id: "short" as const,
                      label: "< 5 min",
                      count: watchLaterByDuration.short.length,
                    },
                    {
                      id: "medium" as const,
                      label: "5–20 min",
                      count: watchLaterByDuration.medium.length,
                    },
                    {
                      id: "long" as const,
                      label: "> 20 min",
                      count: watchLaterByDuration.long.length,
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setWatchLaterDurationFilter(tab.id)}
                      className="p-2 rounded-xl text-center cursor-pointer transition-all"
                      style={{
                        background:
                          watchLaterDurationFilter === tab.id
                            ? "rgba(255, 171, 0, 0.18)"
                            : "rgba(255,255,255,0.03)",
                        border: `1px solid ${
                          watchLaterDurationFilter === tab.id
                            ? "#ffab00"
                            : "var(--border)"
                        }`,
                      }}
                    >
                      <div className="text-[10px] font-bold">{tab.label}</div>
                      <div className="text-xs font-black font-mono-num text-amber-300">
                        {tab.count}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Liste des vidéos mises de côté */}
              {watchLaterVideos.length === 0 ? (
                <div className="p-6 rounded-2xl text-center space-y-2 bg-white/5 border border-white/10">
                  <Hourglass className="w-7 h-7 text-amber-300 mx-auto opacity-70" />
                  <div className="text-xs font-bold">
                    Votre panier du soir est vide
                  </div>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Cliquez sur « ⏳ Mettre de côté » sur n&apos;importe quelle carte vidéo pour composer votre programme du soir.
                  </p>
                </div>
              ) : watchLaterGroupMode === "duration" ? (
                <div className="space-y-4">
                  {[
                    {
                      key: "short" as const,
                      title: "⚡ Moins de 5 min (Formats Courts & Pépites Flash)",
                      items: watchLaterByDuration.short,
                    },
                    {
                      key: "medium" as const,
                      title: "🎯 5 à 20 min (Analyses & Décryptages)",
                      items: watchLaterByDuration.medium,
                    },
                    {
                      key: "long" as const,
                      title:
                        "🍿 Longs formats > 20 min (Documentaires & Masterclass)",
                      items: watchLaterByDuration.long,
                    },
                  ]
                    .filter(
                      (section) =>
                        (watchLaterDurationFilter === "all" ||
                          watchLaterDurationFilter === section.key) &&
                        section.items.length > 0
                    )
                    .map((section) => (
                      <div key={section.key} className="space-y-2">
                        <div className="text-[11px] font-extrabold text-amber-300 flex items-center justify-between">
                          <span>{section.title}</span>
                          <span className="font-mono-num">
                            {section.items.length} vidéo(s)
                          </span>
                        </div>
                        <div className="space-y-2">
                          {section.items.map((vid) => (
                            <div
                              key={vid.id}
                              className="p-3 rounded-2xl flex items-center justify-between gap-2.5"
                              style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono-num">
                                    {vid.durationMinutes || 12} min
                                  </span>
                                  <span
                                    className="truncate"
                                    style={{ color: "var(--accent-2)" }}
                                  >
                                    {vid.domain} › {vid.subdomain}
                                  </span>
                                </div>
                                <div className="text-xs font-extrabold truncate">
                                  {vid.title}
                                </div>
                                <div
                                  className="text-[10px]"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  Par @{vid.user} · ★ {vid.score.toFixed(1)}/10
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const idx = watchLaterVideos.findIndex(
                                      (x) => x.id === vid.id
                                    );
                                    setWatchLaterDrawerOpen(false);
                                    setEveningSessionIndex(Math.max(0, idx));
                                    setEveningSessionActive(true);
                                    handleMarkVideoWatched(vid.id);
                                  }}
                                  className="p-2 rounded-xl bg-amber-400 text-black font-bold cursor-pointer"
                                  title="Jouer dès maintenant dans la séance du soir"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleWatchLater(vid)}
                                  className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
                                  title="Retirer du panier"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                /* Regroupement par Domaine */
                <div className="space-y-4">
                  {Array.from(
                    new Set(watchLaterVideos.map((v) => v.domain))
                  ).map((domainName) => {
                    const domVideos = watchLaterVideos.filter(
                      (v) => v.domain === domainName
                    );
                    const domIcon =
                      orbitState.domains.find((d) => d.name === domainName)
                        ?.icon || "🌌";
                    return (
                      <div key={domainName} className="space-y-2">
                        <div className="text-[11px] font-extrabold text-cyan-300 flex items-center justify-between">
                          <span>
                            {domIcon} {domainName}
                          </span>
                          <span className="font-mono-num">
                            {domVideos.length} pépite(s)
                          </span>
                        </div>
                        <div className="space-y-2">
                          {domVideos.map((vid) => (
                            <div
                              key={vid.id}
                              className="p-3 rounded-2xl flex items-center justify-between gap-2.5"
                              style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid var(--border)",
                              }}
                            >
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <div className="text-[10px] font-bold text-amber-300 font-mono-num">
                                  ⏳ {vid.durationMinutes || 12} min ·{" "}
                                  {vid.subdomain}
                                </div>
                                <div className="text-xs font-extrabold truncate">
                                  {vid.title}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const idx = watchLaterVideos.findIndex(
                                      (x) => x.id === vid.id
                                    );
                                    setWatchLaterDrawerOpen(false);
                                    setEveningSessionIndex(Math.max(0, idx));
                                    setEveningSessionActive(true);
                                    handleMarkVideoWatched(vid.id);
                                  }}
                                  className="p-2 rounded-xl bg-amber-400 text-black font-bold cursor-pointer"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleWatchLater(vid)}
                                  className="p-2 rounded-xl hover:bg-white/10 text-white/60 hover:text-white cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer du Tiroir */}
            <div
              className="pt-4 mt-4 flex items-center justify-between text-[11px]"
              style={{
                borderTop: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              <span>Persistant dans LocalStorage</span>
              {watchLaterVideos.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setOrbitState((prev) => ({ ...prev, watchLaterIds: [] }));
                    showToast("Panier « À regarder ce soir » vidé.");
                  }}
                  className="text-rose-400 hover:underline font-bold cursor-pointer"
                >
                  Tout vider
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          FONCTIONNALITÉ 14 (SUITE) : LECTEUR CONTINU « MA SÉANCE DU SOIR »
          ========================================================== */}
      {eveningSessionActive && watchLaterVideos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between p-4 sm:p-8 overflow-y-auto"
          onClick={() => setEveningSessionActive(false)}
        >
          {(() => {
            const currentSessionVideo =
              watchLaterVideos[eveningSessionIndex % watchLaterVideos.length] ||
              watchLaterVideos[0];
            return (
              <div
                className="w-full max-w-5xl mx-auto space-y-5 my-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top Header */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-black inline-flex items-center gap-1.5">
                      <Hourglass className="w-3.5 h-3.5" />
                      <span>
                        SÉANCE DU SOIR · PÉPITE{" "}
                        {(eveningSessionIndex % watchLaterVideos.length) + 1} /{" "}
                        {watchLaterVideos.length}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-white/80">
                      {currentSessionVideo.domain} ›{" "}
                      {currentSessionVideo.subdomain} (
                      {currentSessionVideo.durationMinutes || 12} min)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEveningSessionActive(false)}
                    className="px-3.5 py-1.5 rounded-xl glass-action-btn text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>Quitter la séance du soir</span>
                  </button>
                </div>

                {/* Video Player */}
                <div
                  className="w-full aspect-video rounded-3xl overflow-hidden bg-black border border-amber-400/35"
                  style={{
                    boxShadow: "0 25px 90px rgba(255, 171, 0, 0.18)",
                  }}
                >
                  <iframe
                    key={currentSessionVideo.id}
                    width="100%"
                    height="100%"
                    src={`https://www.youtube-nocookie.com/embed/${currentSessionVideo.youtubeId}?autoplay=1&rel=0`}
                    title={currentSessionVideo.title}
                    frameBorder="0"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>

                {/* Controls & Playlist Queue */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-white truncate">
                      {currentSessionVideo.title}
                    </div>
                    <div className="text-xs text-white/65">
                      Recommandé par @{currentSessionVideo.user} · «{" "}
                      {currentSessionVideo.comment} »
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        handleMarkVideoWatched(currentSessionVideo.id);
                        handleToggleWatchLater(currentSessionVideo);
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Marquer comme vu</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextIdx =
                          (eveningSessionIndex + 1) % watchLaterVideos.length;
                        setEveningSessionIndex(nextIdx);
                        if (watchLaterVideos[nextIdx]) {
                          handleMarkVideoWatched(watchLaterVideos[nextIdx].id);
                        }
                      }}
                      className="px-5 py-2.5 rounded-xl text-xs font-black text-black bg-amber-400 hover:bg-amber-300 cursor-pointer inline-flex items-center gap-2"
                    >
                      <span>Vidéo suivante de la séance</span>
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* File d'attente visuelle de la séance */}
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {watchLaterVideos.map((v, i) => {
                    const isCurrent =
                      i === eveningSessionIndex % watchLaterVideos.length;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setEveningSessionIndex(i);
                          handleMarkVideoWatched(v.id);
                        }}
                        className="p-2.5 rounded-xl text-left shrink-0 w-56 cursor-pointer transition-all"
                        style={{
                          background: isCurrent
                            ? "rgba(255, 171, 0, 0.2)"
                            : "rgba(255,255,255,0.04)",
                          border: `1px solid ${
                            isCurrent ? "#ffab00" : "rgba(255,255,255,0.1)"
                          }`,
                        }}
                      >
                        <div className="text-[10px] font-mono-num font-bold text-amber-300">
                          #{i + 1} · {v.durationMinutes || 12} min
                        </div>
                        <div className="text-xs font-bold text-white truncate">
                          {v.title}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ==========================================================
          FONCTIONNALITÉ 15 : PASSERELLE D'IMPORT RAPIDE
          TELEGRAM / DISCORD / WHATSAPP / PRESSE-PAPIERS
          ========================================================== */}
      {quickImportOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setQuickImportOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto space-y-5 glass-panel"
            style={{ background: "var(--bg-surface)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
                  <ClipboardPaste className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black font-display">
                    Passerelle d&apos;Import Rapide (Telegram · Discord · Presse-Papiers)
                  </h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Collez un message ou cliquez sur un lien partagé depuis vos salons Telegram, Discord ou WhatsApp : ORBIT extrait l&apos;URL, pré-remplit la fiche et la classe instantanément dans le bon sous-domaine.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickImportOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Zone de Collage Intelligent / Lecture Presse-Papiers */}
            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "rgba(0, 229, 255, 0.06)",
                border: "1px solid rgba(0, 229, 255, 0.28)",
              }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-extrabold text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>
                    Détecteur Intelligent Presse-Papiers (Ctrl+V ou 1-Clic)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (navigator.clipboard && navigator.clipboard.readText) {
                        const clip = await navigator.clipboard.readText();
                        if (clip && clip.trim()) {
                          setManualPasteInput(clip);
                          applyQuickImportText(clip);
                          return;
                        }
                      }
                      showToast(
                        "Collez votre lien ou message directement dans le champ ci-dessous (Ctrl+V)."
                      );
                    } catch {
                      showToast(
                        "Permission navigateur restreinte en aperçu : collez votre lien dans le champ ci-dessous (Ctrl+V)."
                      );
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl text-xs font-black text-cyan-950 bg-cyan-300 hover:bg-cyan-200 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>Lire mon Presse-Papiers</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={manualPasteInput}
                  onChange={(e) => setManualPasteInput(e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text");
                    if (text) {
                      e.preventDefault();
                      setManualPasteInput(text);
                      applyQuickImportText(text);
                    }
                  }}
                  placeholder="Collez ici un message Telegram, Discord, WhatsApp ou une URL vidéo (ex: https://youtu.be/...)"
                  className="flex-1 px-3.5 py-2.5 rounded-xl text-xs outline-none"
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    color: "var(--text-main)",
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!manualPasteInput.trim()) {
                      showToast(
                        "Veuillez coller un lien ou sélectionner un flux Telegram/Discord ci-dessous."
                      );
                      return;
                    }
                    applyQuickImportText(manualPasteInput);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-white cursor-pointer btn-couture shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent), #5e35ff)",
                  }}
                >
                  Pré-remplir & Classer →
                </button>
              </div>
            </div>

            {/* Flux de Webhooks & Liens Partagés entrants */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="text-xs font-extrabold flex items-center gap-2">
                  <span>
                    Flux Entrants Webhooks & Salons Connectés (Telegram / Discord / WhatsApp)
                  </span>
                </div>
                <span
                  className="text-[11px] font-mono-num"
                  style={{ color: "var(--text-muted)" }}
                >
                  {(orbitState.quickImports || []).length} liens détectés
                </span>
              </div>

              <div className="space-y-2.5">
                {(orbitState.quickImports || []).map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase"
                          style={{
                            background:
                              item.source === "telegram"
                                ? "rgba(0, 136, 204, 0.25)"
                                : item.source === "discord"
                                ? "rgba(88, 101, 242, 0.25)"
                                : "rgba(37, 211, 102, 0.25)",
                            color:
                              item.source === "telegram"
                                ? "#38bdf8"
                                : item.source === "discord"
                                ? "#a5b4fc"
                                : "#4ade80",
                          }}
                        >
                          {item.source === "telegram"
                            ? "✈️ Telegram"
                            : item.source === "discord"
                            ? "👾 Discord"
                            : "💬 WhatsApp"}
                        </span>
                        <span className="text-xs font-bold">
                          {item.channelName}
                        </span>
                        <span
                          className="text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          par {item.sender} · {item.receivedAt}
                        </span>
                      </div>

                      <div className="text-xs font-extrabold truncate">
                        {item.suggestedTitle}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] flex-wrap">
                        <span
                          className="font-bold"
                          style={{ color: "var(--accent-2)" }}
                        >
                          Auto-classé : {item.detectedDomain} ›{" "}
                          {item.detectedSubdomain}
                        </span>
                        <span
                          className="font-mono-num truncate max-w-[240px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          ({item.extractedUrl})
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUseBridgeItem(item)}
                      className="px-3.5 py-2 rounded-xl text-xs font-extrabold text-cyan-950 bg-cyan-300 hover:bg-cyan-200 cursor-pointer inline-flex items-center gap-1.5 shrink-0"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      <span>Importer & Pré-remplir</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          MON COFFRE ORBIT — ARCHITECTURE LOCAL-FIRST & SOUVERAINETÉ NUMÉRIQUE v2.0
          ========================================================== */}
      <OrbitVaultModal
        isOpen={openModal === "vault"}
        onClose={() => setOpenModal(null)}
        profile={orbitState.profile}
        theme={orbitState.theme}
        accent={orbitState.accent}
        domains={orbitState.domains}
        videos={orbitState.videos}
        socials={orbitState.socials}
        twins={orbitState.twins}
        watchLaterIds={watchLaterIds}
        watchedVideoIds={watchedIds}
        hideWatchedVideos={hideWatched}
        portfolioItems={orbitState.portfolioItems || DEFAULT_PORTFOLIO_ITEMS}
        cloudConfig={cloudConfig}
        syncQueue={syncQueue}
        swStats={swStats}
        onUpdateCloudConfig={(next) => {
          setCloudConfig(next);
          OrbitStorageService.saveCloudConfig(next);
        }}
        onFlushSyncQueue={async () => {
          const res = await OrbitStorageService.flushSyncQueue();
          setSyncQueue(OrbitStorageService.getSyncQueue());
          setCloudConfig(OrbitStorageService.getCloudConfig());
          showToast(
            `✓ Synchronisation sélective exécutée à ${res.timestamp} (${res.flushedCount} action(s) transmise(s)).`
          );
        }}
        onApplyUiProfile={handleApplyUiProfile}
        onUpdateThemeAndAccent={(nextTheme, nextAccent) =>
          setOrbitState((prev) => ({
            ...prev,
            theme: nextTheme,
            accent: nextAccent,
          }))
        }
        onClearWatchedHistory={handleClearWatchedHistory}
        onToggleHideWatched={handleToggleHideWatched}
        onRestoreVaultArchive={handleRestoreVaultArchive}
        onResetLocalDataOnly={handleResetDemo}
        onDeleteAccountServerData={handleDeleteAccountServerData}
        onRevokeConnector={handleRevokeNetwork}
        onShowToast={showToast}
      />
    </div>
  );
}
