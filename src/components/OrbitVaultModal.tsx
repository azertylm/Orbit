import React, { useState, useRef } from "react";
import {
  OrbitDomain,
  OrbitVideo,
  SocialConnector,
  CulturalTwin,
  OrbitProfile,
  CreatorPortfolioItem,
} from "../data/orbitData";
import {
  OrbitStorageService,
  ORBIT_SCHEMA_VERSION,
  CloudConnectorConfig,
  SelectiveSyncCategories,
  OrbitUiProfilePreset,
  DEFAULT_UI_PROFILES,
  RetentionPolicyConfig,
  PrivateNoteItem,
  ServiceWorkerDiagnostics,
  SyncMutation,
} from "../services/storageAdapter";
import {
  ShieldCheck,
  Database,
  Download,
  Upload,
  Trash2,
  Check,
  X,
  Lock,
  HardDrive,
  CloudOff,
  RefreshCw,
  Layers,
  Palette,
  FileJson,
  FileSpreadsheet,
  Sliders,
  AlertTriangle,
  Eye,
  EyeOff,
  Sparkles,
  Plus,
  History,
  Server,
} from "lucide-react";

interface OrbitVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: OrbitProfile;
  theme: "onyx" | "alabaster" | "polar";
  accent: string;
  domains: OrbitDomain[];
  videos: OrbitVideo[];
  socials: SocialConnector[];
  twins: CulturalTwin[];
  watchLaterIds: number[];
  watchedVideoIds: number[];
  hideWatchedVideos: boolean;
  portfolioItems: CreatorPortfolioItem[];
  cloudConfig: CloudConnectorConfig;
  syncQueue: SyncMutation[];
  swStats: ServiceWorkerDiagnostics;
  onUpdateCloudConfig: (next: CloudConnectorConfig) => void;
  onFlushSyncQueue: () => Promise<void>;
  onApplyUiProfile: (preset: OrbitUiProfilePreset) => void;
  onUpdateThemeAndAccent: (
    theme: "onyx" | "alabaster" | "polar",
    accent: string
  ) => void;
  onClearWatchedHistory: () => void;
  onToggleHideWatched: () => void;
  onRestoreVaultArchive: (
    archiveData: Record<string, unknown>,
    mode: "merge" | "replace"
  ) => void;
  onResetLocalDataOnly: () => void;
  onDeleteAccountServerData: () => void;
  onRevokeConnector: (connectorId: string) => void;
  onShowToast: (msg: string) => void;
}

type VaultTabId =
  | "inventory"
  | "export_import"
  | "sync"
  | "ui_profiles"
  | "privacy_costs";

interface ImportPreviewSummary {
  fileName: string;
  schemaVersion: string;
  exportedAt: string;
  incomingVideosCount: number;
  newUniqueVideosCount: number;
  duplicateVideosCount: number;
  incomingDomainsCount: number;
  incomingTwinsCount: number;
  incomingNotesCount: number;
  hasUiProfile: boolean;
  rawPayload: Record<string, unknown>;
}

export const OrbitVaultModal: React.FC<OrbitVaultModalProps> = ({
  isOpen,
  onClose,
  profile,
  theme,
  accent,
  domains,
  videos,
  socials,
  twins,
  watchLaterIds,
  watchedVideoIds,
  hideWatchedVideos,
  portfolioItems,
  cloudConfig,
  syncQueue,
  swStats,
  onUpdateCloudConfig,
  onFlushSyncQueue,
  onApplyUiProfile,
  onUpdateThemeAndAccent,
  onClearWatchedHistory,
  onToggleHideWatched,
  onRestoreVaultArchive,
  onResetLocalDataOnly,
  onDeleteAccountServerData,
  onRevokeConnector,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<VaultTabId>("inventory");
  const [activeUiProfile, setActiveUiProfile] = useState<OrbitUiProfilePreset>(
    () => OrbitStorageService.getActiveUiProfile()
  );
  const [retentionPolicy, setRetentionPolicy] =
    useState<RetentionPolicyConfig>(() =>
      OrbitStorageService.getRetentionPolicy()
    );
  const [privateNotes, setPrivateNotes] = useState<PrivateNoteItem[]>(() =>
    OrbitStorageService.getPrivateNotes()
  );
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteDomain, setNewNoteDomain] = useState(
    domains[0]?.name || "Tech & Code"
  );

  // Export selective checkboxes
  const [exportSelection, setExportSelection] = useState({
    profileAndDna: true,
    collectionsAndFavs: true,
    watchAndSearchHistory: true,
    privateNotesAndSecretGarden: true,
    socialPublicationsAndComments: true,
    uiProfilesAndThemes: true,
  });
  const [lastExportStatus, setLastExportStatus] = useState<string | null>(null);

  // Import Preview state (Section 4 : Ne jamais écraser silencieusement)
  const [importPreview, setImportPreview] =
    useState<ImportPreviewSummary | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const vaultFileInputRef = useRef<HTMLInputElement | null>(null);
  const uiProfileFileInputRef = useRef<HTMLInputElement | null>(null);

  // Two-step confirmation for deletions (Section 14)
  const [confirmDeleteMode, setConfirmDeleteMode] = useState<
    "none" | "local_history" | "local_all" | "account_server"
  >("none");

  if (!isOpen) return null;

  const storageUsage = OrbitStorageService.estimateLocalStorageUsage();
  const costTelemetry = OrbitStorageService.getCostTelemetry();
  const savedSearches = OrbitStorageService.getSavedSearches();
  const oembedCacheCount = Object.keys(
    OrbitStorageService.getOembedCache()
  ).length;

  const secretDomains = domains.filter((d) => d.secret);
  const personalPublishedVideos = videos.filter((v) => v.user === profile.name);
  const favoriteVideos = videos.filter((v) => v.score >= 9.5);
  const connectedSources = socials.filter(
    (s) => s.active && s.realConsentVerified
  );

  // Ajouter une note personnelle 100% locale (Catégorie A)
  const handleAddPrivateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const item: PrivateNoteItem = {
      id: `note_${Date.now()}`,
      domain: newNoteDomain,
      text: newNoteText.trim(),
      createdAt: new Date().toLocaleDateString("fr-FR"),
    };
    const next = [item, ...privateNotes];
    setPrivateNotes(next);
    OrbitStorageService.savePrivateNotes(next);
    OrbitStorageService.recordLocalComputation(512);
    setNewNoteText("");
    onShowToast(
      "🔒 Note privée enregistrée uniquement sur cet appareil (Catégorie A — Non transmise au serveur)."
    );
  };

  const handleDeletePrivateNote = (id: string) => {
    const next = privateNotes.filter((n) => n.id !== id);
    setPrivateNotes(next);
    OrbitStorageService.savePrivateNotes(next);
    onShowToast("Note privée locale supprimée.");
  };

  // Mettre à jour la synchronisation sélective (Section 5.C)
  const handleToggleSelectiveCategory = (key: keyof SelectiveSyncCategories) => {
    const nextSelective: SelectiveSyncCategories = {
      ...cloudConfig.selectiveSync,
      [key]: !cloudConfig.selectiveSync[key],
    };
    const nextConfig: CloudConnectorConfig = {
      ...cloudConfig,
      selectiveSync: nextSelective,
    };
    onUpdateCloudConfig(nextConfig);
  };

  // Exporter toutes les données ou les catégories sélectionnées en JSON structuré avec Manifeste (Section 4)
  const handleExportFullVaultJson = () => {
    OrbitStorageService.recordLocalComputation(4096);
    const nowIso = new Date().toISOString();

    const archivePayload: Record<string, unknown> = {
      manifest: {
        generator: "ORBIT v2.0 — Mon Coffre ORBIT (Architecture Local-First)",
        schemaVersion: ORBIT_SCHEMA_VERSION,
        exportedAt: nowIso,
        format: "application/json",
        souverainete:
          "Archive générée 100% localement sur votre appareil sans coût serveur. Les vidéos restent hébergées par leurs plateformes d'origine (seules les références et métadonnées autorisées sont exportées).",
        securityNotice:
          "Aucun mot de passe, jeton d'accès actif, secret d'API ni clé privée n'est inclus dans cette archive.",
        categoriesIncluded: exportSelection,
        documentation: {
          categoryA_LocalPersonal:
            "Données personnelles locales : historique de visionnage, recherches, notes privées, panier À regarder ce soir, Jardin Secret, profils d'interface.",
          categoryB_SocialShared:
            "Données sociales partagées : profil public, publications, évaluations, commentaires structurés, jumeaux culturels.",
          categoryC_TechnicalRules:
            "Politique de conservation de l'historique et préférences de synchronisation sélective.",
        },
      },
    };

    if (exportSelection.profileAndDna) {
      archivePayload.profile = profile;
      archivePayload.domains = domains;
      archivePayload.portfolioItems = portfolioItems;
    }

    if (exportSelection.collectionsAndFavs) {
      archivePayload.watchLaterIds = watchLaterIds;
      archivePayload.collections = {
        watchLaterVideos: videos
          .filter((v) => watchLaterIds.includes(v.id))
          .map((v) => ({
            id: v.id,
            title: v.title,
            platform: v.platform,
            rawUrl: v.rawUrl,
            domain: v.domain,
            subdomain: v.subdomain,
            score: v.score,
          })),
        favoritesTop95: favoriteVideos.map((v) => ({
          id: v.id,
          title: v.title,
          platform: v.platform,
          rawUrl: v.rawUrl,
          domain: v.domain,
          subdomain: v.subdomain,
          score: v.score,
        })),
      };
    }

    if (exportSelection.watchAndSearchHistory) {
      archivePayload.watchedVideoIds = watchedVideoIds;
      archivePayload.savedSearches = savedSearches;
      archivePayload.hideWatchedVideos = hideWatchedVideos;
    }

    if (exportSelection.privateNotesAndSecretGarden) {
      archivePayload.privateNotes = privateNotes;
      archivePayload.secretGardenDomains = secretDomains.map((d) => d.name);
    }

    if (exportSelection.socialPublicationsAndComments) {
      archivePayload.videos = videos;
      archivePayload.twins = twins;
      archivePayload.socials = socials.map((s) => ({
        id: s.id,
        name: s.name,
        active: s.active,
        importedVideosCount: s.importedVideosCount,
        importedChannelsCount: s.importedChannelsCount,
        importedContactsCount: s.importedContactsCount,
        lastSyncedAt: s.lastSyncedAt,
      }));
    }

    if (exportSelection.uiProfilesAndThemes) {
      archivePayload.theme = theme;
      archivePayload.accent = accent;
      archivePayload.activeUiProfile = activeUiProfile;
      archivePayload.retentionPolicy = retentionPolicy;
      archivePayload.selectiveSync = cloudConfig.selectiveSync;
    }

    const jsonString = JSON.stringify(archivePayload, null, 2);
    const blob = new Blob([jsonString], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coffre_orbit_v2_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    const statusMsg = `Export JSON v${ORBIT_SCHEMA_VERSION} généré localement à ${new Date().toLocaleTimeString(
      "fr-FR"
    )} (${(jsonString.length / 1024).toFixed(1)} Ko)`;
    setLastExportStatus(statusMsg);
    OrbitStorageService.enqueueMutation("VAULT_EXPORT_COMPLETED", {
      format: "JSON",
      sizeKb: (jsonString.length / 1024).toFixed(1),
    });
    onShowToast("📦 Archive complète « Mon coffre ORBIT » exportée avec son manifeste !");
  };

  // Export CSV tabulaire pour réutilisation dans un tableur externe (Section 4)
  const handleExportCsv = () => {
    OrbitStorageService.recordLocalComputation(2048);
    const headers = [
      "ID",
      "Categorie_Donnee",
      "Titre_ou_Contenu",
      "Plateforme",
      "Domaine",
      "Sous_Domaine",
      "Score_Orbit",
      "Deja_Vu",
      "Panier_Ce_Soir",
      "URL_Externe_Originale",
    ];

    const escapeCsv = (val: string | number | boolean) => {
      const str = String(val ?? "").replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = videos.map((v) => [
      escapeCsv(v.id),
      escapeCsv(v.user === profile.name ? "B_Publication_Personnelle" : "B_Catalogue_Social"),
      escapeCsv(v.title),
      escapeCsv(v.platform),
      escapeCsv(v.domain),
      escapeCsv(v.subdomain),
      escapeCsv(v.score.toFixed(1)),
      escapeCsv(watchedVideoIds.includes(v.id) ? "OUI" : "NON"),
      escapeCsv(watchLaterIds.includes(v.id) ? "OUI" : "NON"),
      escapeCsv(v.rawUrl),
    ]);

    const noteRows = privateNotes.map((n) => [
      escapeCsv(n.id),
      escapeCsv("A_Note_Privee_Locale"),
      escapeCsv(n.text),
      escapeCsv("local-device"),
      escapeCsv(n.domain),
      escapeCsv("Note Personnelle"),
      escapeCsv("-"),
      escapeCsv("-"),
      escapeCsv("-"),
      escapeCsv("Conservé exclusivement sur l'appareil"),
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(";"), ...rows.map((r) => r.join(";")), ...noteRows.map((r) => r.join(";"))].join(
        "\n"
      );

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coffre_orbit_collections_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setLastExportStatus(
      `Export CSV tabulaire généré localement (${videos.length} références + ${privateNotes.length} notes privées)`
    );
    onShowToast("📊 Export CSV tabulaire téléchargé avec succès !");
  };

  // Télécharger uniquement les collections personnelles (Panier + Coups de cœur + Notes)
  const handleExportCollectionsOnly = () => {
    const payload = {
      manifest: {
        type: "ORBIT_COLLECTIONS_ARCHIVE",
        schemaVersion: ORBIT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        owner: profile.name,
      },
      watchLaterIds,
      watchLaterVideos: videos.filter((v) => watchLaterIds.includes(v.id)),
      favoritesTop95: favoriteVideos,
      privateNotes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orbit_collections_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onShowToast("🗂️Vos collections et notes personnelles ont été téléchargées !");
  };

  // Télécharger uniquement le profil d'interface & thème (Section 6)
  const handleExportUiProfileOnly = () => {
    const payload = {
      manifest: {
        type: "ORBIT_UI_PROFILE_PRESET",
        schemaVersion: ORBIT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        security: "Données déclaratives validées uniquement — Aucun code exécutable",
      },
      uiProfile: {
        ...activeUiProfile,
        theme,
        accent,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orbit_profil_interface_${activeUiProfile.id}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onShowToast(
      `🎨 Profil d'interface « ${activeUiProfile.name} » exporté !`
    );
  };

  // Importer un profil d'interface sécurisé (Section 6 — sans exécution de code arbitraire)
  const handleImportUiProfileFile = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        const candidate = parsed.uiProfile || parsed;
        const allowedThemes = ["onyx", "alabaster", "polar"];
        if (
          !candidate ||
          typeof candidate.name !== "string" ||
          !allowedThemes.includes(candidate.theme)
        ) {
          onShowToast(
            "⚠️ Fichier de profil d'interface invalide ou paramètres non autorisés."
          );
          return;
        }
        const safePreset: OrbitUiProfilePreset = {
          id: "custom",
          name: String(candidate.name).slice(0, 45),
          subtitle: String(
            candidate.subtitle || "Profil importé et vérifié localement"
          ).slice(0, 90),
          badge: "Importé ✓",
          theme: candidate.theme,
          accent:
            typeof candidate.accent === "string" &&
            /^#[0-9A-Fa-f]{6}$/.test(candidate.accent)
              ? candidate.accent
              : "#7c5cff",
          density:
            candidate.density === "compact" ||
            candidate.density === "spacious"
              ? candidate.density
              : "comfortable",
          fontScale:
            typeof candidate.fontScale === "number"
              ? Math.min(115, Math.max(85, candidate.fontScale))
              : 100,
          controlsOpacity:
            typeof candidate.controlsOpacity === "number"
              ? Math.min(1, Math.max(0.25, candidate.controlsOpacity))
              : 0.52,
          defaultFeedMode:
            candidate.defaultFeedMode === "grid" ? "grid" : "immersion",
          hideWatchedByDefault: Boolean(candidate.hideWatchedByDefault),
          showMetadataBadges: candidate.showMetadataBadges ?? true,
        };
        setActiveUiProfile(safePreset);
        OrbitStorageService.saveActiveUiProfile(safePreset);
        onApplyUiProfile(safePreset);
        onShowToast(
          `✓ Profil d'interface « ${safePreset.name} » validé et appliqué instantanément !`
        );
      } catch {
        onShowToast("⚠️ Impossible de lire ce fichier de profil d'interface.");
      }
    };
    reader.readAsText(file);
  };

  // Analyser une archive avant importation pour prévisualiser et détecter les doublons (Section 4)
  const handleInspectImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportPreview(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rawText = String(reader.result || "");
        if (rawText.length > 15 * 1024 * 1024) {
          setImportError(
            "Archive rejetée : taille supérieure à la limite de sécurité (15 Mo)."
          );
          return;
        }
        const parsed = JSON.parse(rawText);
        if (!parsed || typeof parsed !== "object") {
          setImportError("Format JSON non reconnu.");
          return;
        }

        const incomingVideos: OrbitVideo[] = Array.isArray(parsed.videos)
          ? parsed.videos
          : Array.isArray(parsed.watchLaterVideos)
          ? parsed.watchLaterVideos
          : [];
        const existingVideoIds = new Set(videos.map((v) => v.id));
        const newUniqueVideos = incomingVideos.filter(
          (v) => v && typeof v.id === "number" && !existingVideoIds.has(v.id)
        );
        const duplicateCount = incomingVideos.length - newUniqueVideos.length;

        const incomingDomains = Array.isArray(parsed.domains)
          ? parsed.domains.length
          : 0;
        const incomingTwins = Array.isArray(parsed.twins)
          ? parsed.twins.length
          : 0;
        const incomingNotes = Array.isArray(parsed.privateNotes)
          ? parsed.privateNotes.length
          : 0;

        setImportPreview({
          fileName: file.name,
          schemaVersion:
            parsed.manifest?.schemaVersion ||
            parsed.schemaVersion ||
            "1.x (Compatible v2.0)",
          exportedAt:
            parsed.manifest?.exportedAt ||
            new Date(file.lastModified).toLocaleDateString("fr-FR"),
          incomingVideosCount: incomingVideos.length,
          newUniqueVideosCount: newUniqueVideos.length,
          duplicateVideosCount: Math.max(0, duplicateCount),
          incomingDomainsCount: incomingDomains,
          incomingTwinsCount: incomingTwins,
          incomingNotesCount: incomingNotes,
          hasUiProfile: Boolean(parsed.activeUiProfile || parsed.theme),
          rawPayload: parsed,
        });
      } catch {
        setImportError(
          "Archive invalide ou corrompue : vérifiez qu'il s'agit bien d'un fichier JSON ORBIT."
        );
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = (mode: "merge" | "replace") => {
    if (!importPreview) return;
    const raw = importPreview.rawPayload;

    if (Array.isArray(raw.privateNotes)) {
      const existingNoteIds = new Set(privateNotes.map((n) => n.id));
      const mergedNotes =
        mode === "replace"
          ? (raw.privateNotes as PrivateNoteItem[])
          : [
              ...(raw.privateNotes as PrivateNoteItem[]).filter(
                (n) => !existingNoteIds.has(n.id)
              ),
              ...privateNotes,
            ];
      setPrivateNotes(mergedNotes);
      OrbitStorageService.savePrivateNotes(mergedNotes);
    }

    if (raw.activeUiProfile && typeof raw.activeUiProfile === "object") {
      const preset = raw.activeUiProfile as OrbitUiProfilePreset;
      setActiveUiProfile(preset);
      OrbitStorageService.saveActiveUiProfile(preset);
    }

    onRestoreVaultArchive(raw, mode);
    setImportPreview(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-3xl p-5 sm:p-7 max-h-[92vh] overflow-y-auto space-y-5 glass-panel"
        style={{ background: "var(--bg-surface)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--accent), var(--accent-2))",
                boxShadow: "0 0 24px var(--accent-glow)",
              }}
            >
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-black font-display">
                  Mon coffre ORBIT
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-num font-black badge-aaa-emerald">
                  LOCAL-FIRST v{ORBIT_SCHEMA_VERSION}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono-num font-bold badge-aaa-cyan">
                  0 Vidéo Hébergée · 100% Souverain
                </span>
              </div>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                Mes données et ma confidentialité : consultez, exportez, transférez, synchronisez sélectivement ou supprimez votre patrimoine numérique.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 cursor-pointer shrink-0"
            title="Fermer Mon coffre ORBIT"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {[
            {
              id: "inventory" as VaultTabId,
              label: "1. Inventaire (Cat. A/B/C)",
              icon: HardDrive,
            },
            {
              id: "export_import" as VaultTabId,
              label: "2. Exporter & Transférer",
              icon: Download,
            },
            {
              id: "sync" as VaultTabId,
              label: "3. Sync Sélective & Cloud",
              icon: RefreshCw,
            },
            {
              id: "ui_profiles" as VaultTabId,
              label: "4. Profils d'Interface (0 Coût)",
              icon: Palette,
            },
            {
              id: "privacy_costs" as VaultTabId,
              label: "5. Historique, Coûts & Suppression",
              icon: Sliders,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-all ${
                  active ? "btn-couture text-white" : "glass-panel"
                }`}
                style={{
                  background: active
                    ? "linear-gradient(135deg, var(--accent), #5e35ff)"
                    : undefined,
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ==========================================================
            ONGLET 1 : INVENTAIRE DES DONNÉES (CATÉGORIES A, B, C) & NOTES PRIVÉES
            ========================================================== */}
        {activeTab === "inventory" && (
          <div className="space-y-5">
            {/* Top Telemetry Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl glass-panel">
                <div
                  className="text-[11px] font-bold"
                  style={{ color: "var(--text-muted)" }}
                >
                  Stockage Local Utilisé
                </div>
                <div className="text-base font-black font-mono-num mt-1">
                  {storageUsage.formattedKb}{" "}
                  <span className="text-xs font-normal opacity-75">
                    ({storageUsage.quotaPercent}%)
                  </span>
                </div>
                <div className="text-[10px] text-emerald-400 mt-0.5">
                  LocalStorage + IndexedDB actif
                </div>
              </div>

              <div className="p-3.5 rounded-2xl glass-panel">
                <div
                  className="text-[11px] font-bold"
                  style={{ color: "var(--text-muted)" }}
                >
                  Mode de Fonctionnement
                </div>
                <div className="text-base font-black font-mono-num mt-1">
                  {cloudConfig.enabled ? "Hybride Sélectif" : "100% Local-First"}
                </div>
                <div className="text-[10px] text-cyan-300 mt-0.5">
                  {cloudConfig.enabled
                    ? `Sync : ${cloudConfig.lastSyncedAt || "Prête"}`
                    : "Aucune donnée envoyée par défaut"}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl glass-panel">
                <div
                  className="text-[11px] font-bold"
                  style={{ color: "var(--text-muted)" }}
                >
                  Historique de Visionnage
                </div>
                <div className="text-base font-black font-mono-num mt-1">
                  {watchedVideoIds.length} vidéos vues
                </div>
                <div className="text-[10px] text-purple-300 mt-0.5">
                  Conservation : {retentionPolicy.historyRetentionDays} jours
                </div>
              </div>

              <div className="p-3.5 rounded-2xl glass-panel">
                <div
                  className="text-[11px] font-bold"
                  style={{ color: "var(--text-muted)" }}
                >
                  Sources Connectées
                </div>
                <div className="text-base font-black font-mono-num mt-1">
                  {connectedSources.length} / {socials.length} réseaux
                </div>
                <div className="text-[10px] text-amber-300 mt-0.5">
                  Références & liens uniquement
                </div>
              </div>
            </div>

            {/* Les 3 Catégories de données strictement séparées (Section 3 du prompt) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Catégorie A */}
              <div
                className="p-4 rounded-2xl space-y-3"
                style={{
                  background: "rgba(16, 185, 129, 0.06)",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase badge-aaa-emerald">
                    Catégorie A · Appareil Uniquement
                  </span>
                  <Lock className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-sm font-black">
                  Données Personnelles Locales
                </h3>
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  Restent exclusivement sur votre appareil tant que vous ne demandez pas leur exportation ou synchronisation.
                </p>
                <ul className="space-y-1.5 text-xs pt-1">
                  <li className="flex items-center justify-between">
                    <span>• Historique de visionnage</span>
                    <strong className="font-mono-num">
                      {watchedVideoIds.length} entrées
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Panier « À regarder ce soir »</span>
                    <strong className="font-mono-num">
                      {watchLaterIds.length} vidéos
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Notes personnelles privées</span>
                    <strong className="font-mono-num">
                      {privateNotes.length} notes
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Jardin Secret (Domaines privés)</span>
                    <strong className="font-mono-num">
                      {secretDomains.length} domaines
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Recherches enregistrées</span>
                    <strong className="font-mono-num">
                      {savedSearches.length} requêtes
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Profil d&apos;interface & Thème</span>
                    <strong className="font-mono-num">
                      {activeUiProfile.name}
                    </strong>
                  </li>
                </ul>
              </div>

              {/* Catégorie B */}
              <div
                className="p-4 rounded-2xl space-y-3"
                style={{
                  background: "rgba(56, 189, 248, 0.06)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase badge-aaa-cyan">
                    Catégorie B · Fonctions Sociales
                  </span>
                  <Database className="w-4 h-4 text-cyan-400" />
                </div>
                <h3 className="text-sm font-black">
                  Données Sociales Partagées
                </h3>
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  Transmises uniquement lorsqu&apos;elles sont nécessaires aux fonctions communautaires (Panthéon, Amis, Jukebox).
                </p>
                <ul className="space-y-1.5 text-xs pt-1">
                  <li className="flex items-center justify-between">
                    <span>• Profil public & Bio</span>
                    <strong className="font-mono-num">{profile.name}</strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Publications partagées (Liens)</span>
                    <strong className="font-mono-num">
                      {personalPublishedVideos.length} pépites
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Coups de cœur publics (≥ 9.5)</span>
                    <strong className="font-mono-num">
                      {favoriteVideos.length} vidéos
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Jumeaux de Goûts & Amis</span>
                    <strong className="font-mono-num">
                      {twins.length} membres
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Portfolio Créateur (Page 2)</span>
                    <strong className="font-mono-num">
                      {portfolioItems.length} œuvres
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Fichiers vidéo stockés</span>
                    <strong className="font-mono-num text-emerald-400">
                      0 Mo (Liens)
                    </strong>
                  </li>
                </ul>
              </div>

              {/* Catégorie C */}
              <div
                className="p-4 rounded-2xl space-y-3"
                style={{
                  background: "rgba(168, 85, 247, 0.06)",
                  border: "1px solid rgba(168, 85, 247, 0.35)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase badge-aaa-purple">
                    Catégorie C · Éphémère & Cache
                  </span>
                  <Server className="w-4 h-4 text-purple-400" />
                </div>
                <h3 className="text-sm font-black">
                  Données Temporaires & Techniques
                </h3>
                <p
                  className="text-[11px] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  Strictement limitées au fonctionnement hors-ligne et à l&apos;économie de bande passante. Zéro pistage.
                </p>
                <ul className="space-y-1.5 text-xs pt-1">
                  <li className="flex items-center justify-between">
                    <span>• Cache PWA Service Worker</span>
                    <strong className="font-mono-num">
                      {swStats.totalCached} ressources
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Cache métadonnées oEmbed</span>
                    <strong className="font-mono-num">
                      {oembedCacheCount} entrées (TTL 7j)
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• File d&apos;attente hors-ligne</span>
                    <strong className="font-mono-num">
                      {syncQueue.filter((m) => !m.synced).length} en attente
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Volume Cat. C estimé</span>
                    <strong className="font-mono-num">
                      {(storageUsage.breakdown.categoryCTempBytes / 1024).toFixed(
                        1
                      )}{" "}
                      Ko
                    </strong>
                  </li>
                  <li className="flex items-center justify-between">
                    <span>• Trackers publicitaires tiers</span>
                    <strong className="font-mono-num text-emerald-400">
                      0 (Aucun)
                    </strong>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bloc Notes Personnelles Privées (100% Local - Catégorie A) */}
            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-extrabold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      Carnet de Notes Privées Locales (Ne devient jamais une publication publique)
                    </span>
                  </h4>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Vos réflexions personnelles, mémos techniques et repères de montage restent sur votre appareil.
                  </p>
                </div>
                <span className="text-[11px] font-mono-num font-bold text-emerald-400">
                  {privateNotes.length} note(s) locale(s)
                </span>
              </div>

              <form
                onSubmit={handleAddPrivateNote}
                className="flex flex-col sm:flex-row gap-2"
              >
                <select
                  value={newNoteDomain}
                  onChange={(e) => setNewNoteDomain(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs font-bold outline-none sm:w-48"
                >
                  {domains.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.icon} {d.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Ajouter une note privée sur cet appareil (ex: Tester ce réglage d'objectif ce week-end)..."
                  className="flex-1 px-3.5 py-2 rounded-xl text-xs outline-none"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture inline-flex items-center justify-center gap-1.5 shrink-0"
                  style={{ background: "var(--accent)" }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter en local</span>
                </button>
              </form>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {privateNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-xl flex items-start justify-between gap-3 text-xs"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-400">
                          {note.domain}
                        </span>
                        <span
                          className="text-[10px] font-mono-num"
                          style={{ color: "var(--text-muted)" }}
                        >
                          · {note.createdAt} · Local uniquement
                        </span>
                      </div>
                      <p className="text-xs">{note.text}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeletePrivateNote(note.id)}
                      className="p-1 rounded-lg hover:bg-white/10 text-rose-400 cursor-pointer shrink-0"
                      title="Supprimer cette note locale"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================================
            ONGLET 2 : MES DONNÉES — EXPORTER ET TRANSFÉRER (SECTION 4)
            ========================================================== */}
        {activeTab === "export_import" && (
          <div className="space-y-5">
            <div
              className="p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(109, 74, 255, 0.16), rgba(56, 189, 248, 0.1))",
                border: "1px solid var(--border-lum)",
              }}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black badge-aaa-emerald">
                    GRATUIT & SANS ABONNEMENT
                  </span>
                  <span className="text-xs font-mono-num font-bold opacity-80">
                    Schéma v{ORBIT_SCHEMA_VERSION}
                  </span>
                </div>
                <h3 className="text-base font-black font-display">
                  Mes données — Exporter et transférer en un clic
                </h3>
                <p
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Génération 100% locale dans votre navigateur : vos données ne transitent par aucun serveur tiers pour créer votre archive.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportFullVaultJson}
                className="px-5 py-3 rounded-2xl text-xs font-black text-white cursor-pointer btn-couture inline-flex items-center gap-2 shrink-0"
                style={{
                  background: "linear-gradient(135deg, var(--accent), #0284c7)",
                }}
              >
                <Download className="w-4 h-4" />
                <span>Exporter toutes mes données (JSON)</span>
              </button>
            </div>

            {lastExportStatus && (
              <div className="p-3 rounded-xl text-xs font-bold flex items-center justify-between badge-aaa-emerald">
                <span>✓ {lastExportStatus}</span>
                <span className="font-mono-num text-[11px]">Prêt à transférer</span>
              </div>
            )}

            {/* Choix des catégories à inclure dans l'export personnalisé */}
            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="text-xs font-extrabold">
                Sélectionner les catégories à inclure dans l&apos;exportation :
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                {[
                  {
                    key: "profileAndDna" as const,
                    label: "Profil, ADN Culturel (15 domaines) & Portfolio",
                  },
                  {
                    key: "collectionsAndFavs" as const,
                    label: "Collections, Panier « Ce soir » & Favoris ≥ 9.5",
                  },
                  {
                    key: "watchAndSearchHistory" as const,
                    label: `Historique de visionnage (${watchedVideoIds.length}) & Recherches`,
                  },
                  {
                    key: "privateNotesAndSecretGarden" as const,
                    label: `Notes privées (${privateNotes.length}) & Jardin Secret (${secretDomains.length})`,
                  },
                  {
                    key: "socialPublicationsAndComments" as const,
                    label: "Publications personnelles, Commentaires & Connexions",
                  },
                  {
                    key: "uiProfilesAndThemes" as const,
                    label: "Profils d'interface, Thèmes & Règles de conservation",
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="p-2.5 rounded-xl flex items-center gap-2.5 cursor-pointer glass-panel"
                  >
                    <input
                      type="checkbox"
                      checked={exportSelection[item.key]}
                      onChange={() =>
                        setExportSelection((prev) => ({
                          ...prev,
                          [item.key]: !prev[item.key],
                        }))
                      }
                    />
                    <span className="font-semibold">{item.label}</span>
                  </label>
                ))}
              </div>

              {/* Formats d'exportation complémentaires */}
              <div className="flex flex-wrap gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exporter en CSV (Listes tabulaires)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportCollectionsOnly}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive"
                >
                  <FileJson className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Télécharger mes Collections seules</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportUiProfileOnly}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive"
                >
                  <Palette className="w-3.5 h-3.5 text-purple-300" />
                  <span>Télécharger mon Profil d&apos;Interface seul</span>
                </button>
              </div>
            </div>

            {/* Importation et Restauration avec Prévisualisation & Détection des Doublons */}
            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-sm font-black">
                    Importer mes données sur cet appareil (Transfert ou Restauration)
                  </h4>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Vérification automatique du format, de la version du schéma et des doublons avec prévisualisation avant toute modification.
                  </p>
                </div>

                <input
                  ref={vaultFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleInspectImportFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => vaultFileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl text-xs font-black text-white cursor-pointer btn-couture inline-flex items-center gap-2"
                  style={{ background: "var(--accent)" }}
                >
                  <Upload className="w-4 h-4" />
                  <span>Importer mes données (.json)</span>
                </button>
              </div>

              {importError && (
                <div className="p-3 rounded-xl text-xs font-bold bg-rose-500/20 border border-rose-400/40 text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{importError}</span>
                </div>
              )}

              {importPreview && (
                <div
                  className="p-4 rounded-2xl space-y-3"
                  style={{
                    background: "rgba(56, 189, 248, 0.08)",
                    border: "1px solid rgba(56, 189, 248, 0.45)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-cyan-300">
                      🔍 Prévisualisation de l&apos;archive avant modification :{" "}
                      {importPreview.fileName}
                    </span>
                    <span className="text-[11px] font-mono-num badge-aaa-cyan px-2 py-0.5 rounded-md">
                      Schéma v{importPreview.schemaVersion}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-black/25">
                      <div className="text-[10px] opacity-75">
                        Nouvelles vidéos à ajouter
                      </div>
                      <div className="text-sm font-black font-mono-num text-emerald-400">
                        +{importPreview.newUniqueVideosCount}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/25">
                      <div className="text-[10px] opacity-75">
                        Doublons détectés (Ignorés)
                      </div>
                      <div className="text-sm font-black font-mono-num text-amber-300">
                        {importPreview.duplicateVideosCount}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/25">
                      <div className="text-[10px] opacity-75">
                        Domaines & Affinités
                      </div>
                      <div className="text-sm font-black font-mono-num">
                        {importPreview.incomingDomainsCount} piliers
                      </div>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/25">
                      <div className="text-[10px] opacity-75">
                        Notes privées locales
                      </div>
                      <div className="text-sm font-black font-mono-num">
                        {importPreview.incomingNotesCount} notes
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setImportPreview(null)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer glass-panel"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmImport("merge")}
                      className="px-4 py-2 rounded-xl text-xs font-black text-white cursor-pointer btn-couture inline-flex items-center gap-1.5"
                      style={{
                        background: "linear-gradient(135deg, #10b981, #0284c7)",
                      }}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>
                        Fusionner sans écraser (+{importPreview.newUniqueVideosCount} inédites)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmImport("replace")}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer glass-panel text-amber-300"
                    >
                      Remplacer l&apos;état local complet
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==========================================================
            ONGLET 3 : SYNCHRONISATION FACULTATIVE & SÉLECTIVE (SECTIONS 5 & 11)
            ========================================================== */}
        {activeTab === "sync" && (
          <div className="space-y-5">
            {/* Mode Sans Synchronisation vs Synchronisation Facultative */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div
                onClick={() =>
                  onUpdateCloudConfig({
                    ...cloudConfig,
                    enabled: false,
                    provider: "local-sovereign",
                  })
                }
                className="p-4 rounded-2xl cursor-pointer transition-all space-y-2"
                style={{
                  background: !cloudConfig.enabled
                    ? "rgba(16, 185, 129, 0.1)"
                    : "rgba(255,255,255,0.02)",
                  border: `2px solid ${
                    !cloudConfig.enabled
                      ? "var(--success)"
                      : "var(--border)"
                  }`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black badge-aaa-emerald">
                    PAR DÉFAUT · SOUVERAINETÉ MAXIMALE
                  </span>
                  <CloudOff className="w-4 h-4 text-emerald-400" />
                </div>
                <h4 className="text-sm font-black">
                  Mode Sans Synchronisation (100% Appareil)
                </h4>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  Toutes vos données personnelles restent sur cet appareil. Le transfert vers un autre appareil se fait manuellement par export/import JSON.
                </p>
              </div>

              <div
                onClick={() =>
                  onUpdateCloudConfig({
                    ...cloudConfig,
                    enabled: true,
                    provider:
                      cloudConfig.provider === "local-sovereign"
                        ? "alphabette-vps"
                        : cloudConfig.provider,
                  })
                }
                className="p-4 rounded-2xl cursor-pointer transition-all space-y-2"
                style={{
                  background: cloudConfig.enabled
                    ? "rgba(56, 189, 248, 0.1)"
                    : "rgba(255,255,255,0.02)",
                  border: `2px solid ${
                    cloudConfig.enabled ? "#38bdf8" : "var(--border)"
                  }`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black badge-aaa-cyan">
                    FACULTATIF · MULTI-APPAREILS
                  </span>
                  <RefreshCw className="w-4 h-4 text-cyan-400" />
                </div>
                <h4 className="text-sm font-black">
                  Synchronisation Sélective Activée
                </h4>
                <p
                  className="text-xs leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  Synchronise uniquement les catégories que vous cochez ci-dessous avec votre serveur Alphabette ou Supabase.
                </p>
              </div>
            </div>

            {/* Choix granulaire des catégories synchronisées (Section 5.C) */}
            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-extrabold">
                  Catégories autorisées à être synchronisées (Synchronisation sélective) :
                </h4>
                <span className="text-[11px] font-bold text-emerald-400">
                  🔒 Le Jardin Secret est toujours exclu du serveur
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                {[
                  {
                    key: "profile" as const,
                    label: "Profil public & Badges",
                    desc: "Nom, bio, points Éclaireur",
                  },
                  {
                    key: "collections" as const,
                    label: "Collections & Panier",
                    desc: "Sélections partagées & Ce soir",
                  },
                  {
                    key: "preferences" as const,
                    label: "Préférences & Affinités",
                    desc: "Scores des 15 domaines publics",
                  },
                  {
                    key: "history" as const,
                    label: "Historique de visionnage",
                    desc: "Désactivé par défaut (Privé)",
                  },
                  {
                    key: "privateNotes" as const,
                    label: "Notes personnelles",
                    desc: "Désactivé par défaut (Local)",
                  },
                  {
                    key: "uiSettings" as const,
                    label: "Paramètres d'interface",
                    desc: "Thème, densité, profil UI",
                  },
                ].map((cat) => {
                  const checked = Boolean(cloudConfig.selectiveSync?.[cat.key]);
                  return (
                    <label
                      key={cat.key}
                      className="p-3 rounded-xl flex items-start gap-2.5 cursor-pointer glass-panel"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleSelectiveCategory(cat.key)}
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-bold">{cat.label}</div>
                        <div
                          className="text-[10px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {cat.desc} ·{" "}
                          <strong
                            className={
                              checked && cloudConfig.enabled
                                ? "text-cyan-300"
                                : "text-emerald-400"
                            }
                          >
                            {checked && cloudConfig.enabled
                              ? "Synchronisé"
                              : "Appareil uniquement"}
                          </strong>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Actions de contrôle de synchronisation (Section 14) */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-white/10">
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Dernière synchronisation :{" "}
                  <strong style={{ color: "var(--text-main)" }}>
                    {cloudConfig.lastSyncedAt || "Jamais (Mode local)"}
                  </strong>{" "}
                  · En attente :{" "}
                  <strong>
                    {syncQueue.filter((m) => !m.synced).length} action(s)
                  </strong>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onFlushSyncQueue}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel glass-panel-interactive text-cyan-300"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Synchroniser maintenant</span>
                  </button>

                  {cloudConfig.enabled && (
                    <button
                      type="button"
                      onClick={() => {
                        onUpdateCloudConfig({
                          ...cloudConfig,
                          enabled: false,
                          provider: "local-sovereign",
                        });
                        onShowToast(
                          "⏸️ Synchronisation suspendue : retour au mode 100% Local-First."
                        );
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel text-amber-300"
                    >
                      <CloudOff className="w-3.5 h-3.5" />
                      <span>Suspendre la synchronisation</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Révocation rapide des sources externes connectées */}
            <div
              className="p-4 rounded-2xl space-y-2.5"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="text-xs font-extrabold">
                Sources externes connectées (Révocation individuelle RGPD) :
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {socials.map((soc) => (
                  <div
                    key={soc.id}
                    className="p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs glass-panel"
                  >
                    <div className="min-w-0">
                      <div className="font-bold truncate">{soc.name}</div>
                      <div
                        className="text-[10px] truncate"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {soc.active && soc.realConsentVerified
                          ? soc.importedProofText || "Connecté"
                          : "Non connecté · Aucune donnée"}
                      </div>
                    </div>
                    {soc.active && soc.realConsentVerified && (
                      <button
                        type="button"
                        onClick={() => onRevokeConnector(soc.id)}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 cursor-pointer shrink-0"
                      >
                        Déconnecter
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================================
            ONGLET 4 : PROFILS D'INTERFACE LOCAUX SANS COÛT SERVEUR (SECTION 6)
            ========================================================== */}
        {activeTab === "ui_profiles" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-black">
                  Profils d&apos;Interface Instantanés (Zéro Requête Réseau · Zéro Coût Serveur)
                </h3>
                <p
                  className="text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  Changez d&apos;ergonomie en un clic sans recharger l&apos;application. Exportez ou importez vos profils entre appareils.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportUiProfileOnly}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Exporter ce profil</span>
                </button>
                <input
                  ref={uiProfileFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportUiProfileFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => uiProfileFileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Importer un profil</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {DEFAULT_UI_PROFILES.map((preset) => {
                const isSelected = activeUiProfile.id === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setActiveUiProfile(preset);
                      OrbitStorageService.saveActiveUiProfile(preset);
                      onApplyUiProfile(preset);
                    }}
                    className="p-4 rounded-2xl text-left cursor-pointer transition-all space-y-2 glass-panel glass-panel-interactive"
                    style={{
                      border: isSelected
                        ? `2px solid ${preset.accent}`
                        : "1px solid var(--border)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-black"
                        style={{
                          background: `${preset.accent}25`,
                          color: preset.accent,
                        }}
                      >
                        {preset.badge}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-black text-emerald-400">
                          ✓ Actif
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-black">{preset.name}</div>
                    <p
                      className="text-[11px] leading-relaxed"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {preset.subtitle}
                    </p>
                    <div className="text-[10px] font-mono-num opacity-75 pt-1">
                      Thème {preset.theme.toUpperCase()} · Vue{" "}
                      {preset.defaultFeedMode === "immersion"
                        ? "Immersion"
                        : "Grille"}{" "}
                      · Opacité {Math.round(preset.controlsOpacity * 100)}%
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Personnalisation directe des variables de thème */}
            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <div className="text-xs font-extrabold">
                    Thèmes Glassmorphism conservés localement :
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { id: "onyx" as const, label: "Onyx (Sombre Cinéma)" },
                      {
                        id: "alabaster" as const,
                        label: "Alabaster (Clair Éditorial AAA)",
                      },
                      { id: "polar" as const, label: "Verre Polaire" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onUpdateThemeAndAccent(t.id, accent)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          theme === t.id ? "btn-couture text-white" : "glass-panel"
                        }`}
                        style={{
                          background:
                            theme === t.id ? "var(--accent)" : undefined,
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const def = DEFAULT_UI_PROFILES[5];
                    setActiveUiProfile(def);
                    OrbitStorageService.saveActiveUiProfile(def);
                    onApplyUiProfile(def);
                    onShowToast(
                      "🔄 Préférences d'interface réinitialisées aux valeurs par défaut (Onyx)."
                    );
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer glass-panel"
                >
                  Réinitialiser mes préférences d&apos;interface
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================================
            ONGLET 5 : HISTORIQUE MAÎTRISÉ, COÛTS SERVEUR & SUPPRESSION (SECTIONS 7, 14, 15)
            ========================================================== */}
        {activeTab === "privacy_costs" && (
          <div className="space-y-5">
            {/* Règle 5 : Indicateurs techniques de réduction des coûts */}
            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "rgba(16, 185, 129, 0.06)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-extrabold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>
                    Indicateurs Techniques d&apos;Économie Serveur (Métriques Agrégées Non-Intrusives)
                  </span>
                </h4>
                <span className="text-[10px] font-mono-num badge-aaa-emerald px-2 py-0.5 rounded-md">
                  Sobriété & Coût Minimal
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                <div className="p-2.5 rounded-xl glass-panel">
                  <div className="text-[10px] opacity-75">
                    Calculs Locaux Exécutés
                  </div>
                  <div className="text-sm font-black font-mono-num text-emerald-400">
                    {costTelemetry.localComputationsCount}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl glass-panel">
                  <div className="text-[10px] opacity-75">
                    Succès du Cache Local
                  </div>
                  <div className="text-sm font-black font-mono-num text-cyan-300">
                    {costTelemetry.cacheHitsCount} hits
                  </div>
                </div>
                <div className="p-2.5 rounded-xl glass-panel">
                  <div className="text-[10px] opacity-75">
                    Appels Réseau Serveur
                  </div>
                  <div className="text-sm font-black font-mono-num">
                    {costTelemetry.networkRequestsCount}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl glass-panel">
                  <div className="text-[10px] opacity-75">
                    Appels IA Distants
                  </div>
                  <div className="text-sm font-black font-mono-num text-purple-300">
                    {costTelemetry.aiRemoteCallsCount}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl glass-panel">
                  <div className="text-[10px] opacity-75">
                    Bande Passante Économisée
                  </div>
                  <div className="text-sm font-black font-mono-num text-emerald-400">
                    {(costTelemetry.estimatedSavedBytes / 1024).toFixed(0)} Ko
                  </div>
                </div>
              </div>
            </div>

            {/* Historique maîtrisé : Choisir les informations conservées (Section 15) */}
            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="text-xs font-extrabold flex items-center gap-1.5">
                <History className="w-4 h-4 text-cyan-300" />
                <span>
                  Historique maîtrisé : choisissez les informations que vous souhaitez conserver
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <label className="p-3 rounded-xl flex items-center justify-between gap-2 cursor-pointer glass-panel">
                  <span>Conserver mon historique de visionnage local</span>
                  <input
                    type="checkbox"
                    checked={retentionPolicy.keepWatchHistory}
                    onChange={() => {
                      const next = {
                        ...retentionPolicy,
                        keepWatchHistory: !retentionPolicy.keepWatchHistory,
                      };
                      setRetentionPolicy(next);
                      OrbitStorageService.saveRetentionPolicy(next);
                    }}
                  />
                </label>

                <label className="p-3 rounded-xl flex items-center justify-between gap-2 cursor-pointer glass-panel">
                  <span>Exclure mon Jardin Secret de l&apos;historique</span>
                  <input
                    type="checkbox"
                    checked={retentionPolicy.excludeSecretGardenFromHistory}
                    onChange={() => {
                      const next = {
                        ...retentionPolicy,
                        excludeSecretGardenFromHistory:
                          !retentionPolicy.excludeSecretGardenFromHistory,
                      };
                      setRetentionPolicy(next);
                      OrbitStorageService.saveRetentionPolicy(next);
                    }}
                  />
                </label>

                <label className="p-3 rounded-xl flex items-center justify-between gap-2 cursor-pointer glass-panel">
                  <span>
                    Privilégier le tri déterministe local avant tout appel IA
                  </span>
                  <input
                    type="checkbox"
                    checked={retentionPolicy.preferLocalHeuristicOverAi}
                    onChange={() => {
                      const next = {
                        ...retentionPolicy,
                        preferLocalHeuristicOverAi:
                          !retentionPolicy.preferLocalHeuristicOverAi,
                      };
                      setRetentionPolicy(next);
                      OrbitStorageService.saveRetentionPolicy(next);
                    }}
                  />
                </label>

                <div className="p-3 rounded-xl flex items-center justify-between gap-2 glass-panel">
                  <span>Durée de conservation locale :</span>
                  <select
                    value={retentionPolicy.historyRetentionDays}
                    onChange={(e) => {
                      const next: RetentionPolicyConfig = {
                        ...retentionPolicy,
                        historyRetentionDays: Number(
                          e.target.value
                        ) as RetentionPolicyConfig["historyRetentionDays"],
                      };
                      setRetentionPolicy(next);
                      OrbitStorageService.saveRetentionPolicy(next);
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold"
                  >
                    <option value={7}>7 jours</option>
                    <option value={30}>30 jours</option>
                    <option value={90}>90 jours</option>
                    <option value={365}>365 jours</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={onToggleHideWatched}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel"
                >
                  {hideWatchedVideos ? (
                    <EyeOff className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>
                    Filtre Anti-Déjà-Vu :{" "}
                    {hideWatchedVideos ? "Activé" : "Désactivé"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    OrbitStorageService.clearOembedCache();
                    onShowToast(
                      "🧹 Cache temporaire de métadonnées oEmbed vidé (vos données personnelles sont intactes)."
                    );
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer glass-panel text-cyan-300"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vider uniquement le cache temporaire (Cat. C)</span>
                </button>
              </div>
            </div>

            {/* Zone de Suppression avec distinction stricte Local vs Serveur/Compte (Section 14) */}
            <div
              className="p-4 rounded-2xl space-y-3"
              style={{
                background: "rgba(244, 63, 94, 0.06)",
                border: "1px solid rgba(244, 63, 94, 0.35)",
              }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h4 className="text-xs font-black text-rose-300 uppercase tracking-wider">
                    Zone de Suppression Maîtrisée (Distinction Stricte Appareil vs Serveur)
                  </h4>
                  <p
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Supprimer le cache ou les données locales ne supprime pas les données de votre compte serveur, et inversement.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteMode("local_history")}
                  className="p-3 rounded-xl text-xs font-bold text-left cursor-pointer glass-panel hover:border-amber-400/50 space-y-1"
                >
                  <div className="text-amber-300 font-black">
                    1. Effacer l&apos;historique local
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Remet à zéro les {watchedVideoIds.length} vidéos vues sur cet appareil uniquement.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteMode("local_all")}
                  className="p-3 rounded-xl text-xs font-bold text-left cursor-pointer glass-panel hover:border-rose-400/50 space-y-1"
                >
                  <div className="text-rose-300 font-black">
                    2. Supprimer les données locales
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Efface LocalStorage & IndexedDB sur cet appareil sans toucher au compte serveur.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setConfirmDeleteMode("account_server")}
                  className="p-3 rounded-xl text-xs font-bold text-left cursor-pointer glass-panel hover:border-rose-500 space-y-1"
                >
                  <div className="text-rose-400 font-black">
                    3. Supprimer les données du compte
                  </div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Demande la révocation et la purge complète des données sociales du compte (RGPD Art. 17).
                  </div>
                </button>
              </div>

              {confirmDeleteMode !== "none" && (
                <div className="p-3.5 rounded-2xl bg-black/50 border border-rose-400/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="text-xs space-y-0.5">
                    <div className="font-black text-rose-300">
                      ⚠️ Confirmation requise avant suppression définitive :
                    </div>
                    <div style={{ color: "var(--text-muted)" }}>
                      {confirmDeleteMode === "local_history" &&
                        "Voulez-vous vraiment vider votre historique de visionnage local (watchedVideoIds) sur cet appareil ?"}
                      {confirmDeleteMode === "local_all" &&
                        "Voulez-vous vraiment réinitialiser toutes les données locales stockées sur cet appareil (les données serveur éventuelles ne sont pas affectées) ?"}
                      {confirmDeleteMode === "account_server" &&
                        "Voulez-vous vraiment révoquer toutes vos connexions et purger les données sociales du compte ET les données locales ?"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteMode("none")}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer glass-panel"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirmDeleteMode === "local_history") {
                          onClearWatchedHistory();
                        } else if (confirmDeleteMode === "local_all") {
                          onResetLocalDataOnly();
                        } else if (confirmDeleteMode === "account_server") {
                          onDeleteAccountServerData();
                        }
                        setConfirmDeleteMode("none");
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 cursor-pointer"
                    >
                      Confirmer la suppression
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
