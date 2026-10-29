import React, { useState, useEffect, useMemo } from "react";
import {
  ListMusic,
  History,
  Keyboard,
  Plus,
  Trash2,
  Play,
  Share2,
  X,
  Clock,
  Sparkles,
  Gauge,
  Check,
  ChevronRight,
  FolderPlus,
  Compass,
} from "lucide-react";
import {
  OrbitStorageService,
  UserPlaylist,
  PlaybackHistoryItem,
} from "../services/storageAdapter";
import { OrbitVideo } from "../data/orbitData";

interface PlaylistsAndHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  allVideos: OrbitVideo[];
  onSelectVideoForPlayback: (video: OrbitVideo, startSeconds?: number) => void;
  onPlayPlaylist: (videoIds: number[], playlistTitle: string) => void;
  onOpenQrShare?: (playlist: { title: string; videoIds: number[] }) => void;
}

export const PlaylistsAndHistoryModal: React.FC<
  PlaylistsAndHistoryModalProps
> = ({
  isOpen,
  onClose,
  allVideos,
  onSelectVideoForPlayback,
  onPlayPlaylist,
  onOpenQrShare,
}) => {
  const [activeTab, setActiveTab] = useState<"playlists" | "history" | "keys">(
    "playlists"
  );
  const [playlists, setPlaylists] = useState<UserPlaylist[]>([]);
  const [historyItems, setHistoryItems] = useState<PlaybackHistoryItem[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null
  );

  // Formulaire de création de playlist
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>("");
  const [newDesc, setNewDesc] = useState<string>("");
  const [newEmoji, setNewEmoji] = useState<string>("📁");

  // Recharger les données quand la modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setPlaylists(OrbitStorageService.getUserPlaylists());
      setHistoryItems(OrbitStorageService.getPlaybackHistory());
    }
  }, [isOpen]);

  const videoMap = useMemo(() => {
    const map = new Map<number, OrbitVideo>();
    allVideos.forEach((v) => map.set(v.id, v));
    return map;
  }, [allVideos]);

  const activePlaylist = useMemo(() => {
    if (!selectedPlaylistId) return null;
    return playlists.find((p) => p.id === selectedPlaylistId) || null;
  }, [playlists, selectedPlaylistId]);

  if (!isOpen) return null;

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const playlist: UserPlaylist = {
      id: `orbit-pl-${Date.now()}`,
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      videoIds: [],
      emoji: newEmoji,
    };
    OrbitStorageService.saveUserPlaylist(playlist);
    setPlaylists(OrbitStorageService.getUserPlaylists());
    setSelectedPlaylistId(playlist.id);
    setIsCreatingPlaylist(false);
    setNewTitle("");
    setNewDesc("");
  };

  const handleDeletePlaylist = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Supprimer cette playlist ?")) {
      OrbitStorageService.deleteUserPlaylist(id);
      setPlaylists(OrbitStorageService.getUserPlaylists());
      if (selectedPlaylistId === id) setSelectedPlaylistId(null);
    }
  };

  const handleRemoveVideo = (
    playlistId: string,
    videoId: number,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    OrbitStorageService.removeVideoFromPlaylist(playlistId, videoId);
    setPlaylists(OrbitStorageService.getUserPlaylists());
  };

  const handleClearHistory = () => {
    if (confirm("Effacer tout votre historique de visionnage ?")) {
      OrbitStorageService.clearPlaybackHistory();
      setHistoryItems([]);
    }
  };

  const formatSeconds = (sec: number) => {
    const s = Math.max(0, Math.floor(sec));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-[#0c101c] border border-white/15 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER MODAL */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <ListMusic className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                Playlists, Historique & Confort Orbit
              </h3>
              <p className="text-[11px] text-white/55">
                Gérez vos listes de lecture et reprenez vos vidéos en 1 clic
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ONGLETS DE NAVIGATION */}
        <div className="px-5 pt-3 pb-2 border-b border-white/10 flex items-center gap-2 bg-[#090d17]">
          <button
            type="button"
            onClick={() => setActiveTab("playlists")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === "playlists"
                ? "bg-cyan-400 text-black shadow-lg"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            <span>Mes Playlists ({playlists.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === "history"
                ? "bg-cyan-400 text-black shadow-lg"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historique & Reprise ({historyItems.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("keys")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all ${
              activeTab === "keys"
                ? "bg-cyan-400 text-black shadow-lg"
                : "bg-white/5 text-white/70 hover:bg-white/10"
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" />
            <span>Raccourcis Clavier</span>
          </button>
        </div>

        {/* CONTENU PRINCIPAL SCROLLABLE */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {/* ===============================================================
              ONGLET 1 : PLAYLISTS PERSONNALISÉES
              =============================================================== */}
          {activeTab === "playlists" && (
            <div className="space-y-4">
              {/* Entête avec bouton Nouvelle Playlist */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-white/80 uppercase tracking-wider">
                  Vos Collections Privées
                </span>
                {!isCreatingPlaylist && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingPlaylist(true)}
                    className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Créer une playlist</span>
                  </button>
                )}
              </div>

              {/* Formulaire de création inline */}
              {isCreatingPlaylist && (
                <form
                  onSubmit={handleCreatePlaylist}
                  className="p-4 rounded-2xl bg-white/[0.04] border border-cyan-400/30 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                      <FolderPlus className="w-4 h-4" />
                      <span>Nouvelle Playlist Personnalisée</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingPlaylist(false)}
                      className="text-white/40 hover:text-white text-xs cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>

                  <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                    <select
                      value={newEmoji}
                      onChange={(e) => setNewEmoji(e.target.value)}
                      className="px-2 py-2 rounded-xl bg-black border border-white/20 text-base cursor-pointer"
                    >
                      <option value="⭐">⭐ Coup de cœur</option>
                      <option value="🔥">🔥 Pépites</option>
                      <option value="⏳">⏳ À voir plus tard</option>
                      <option value="🎧">🎧 Musique</option>
                      <option value="💡">💡 Tech & Savoir</option>
                      <option value="🎨">🎨 Art & Créatif</option>
                      <option value="📁">📁 Dossier</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Nom de la playlist (ex: Soirée Chill, Tech 2026...)"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-xs text-white placeholder-white/40 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="Description optionnelle (ex: Les meilleures vidéos sélectionnées cette semaine)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/20 text-xs text-white placeholder-white/40 focus:border-cyan-400 focus:outline-none"
                  />

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-extrabold cursor-pointer transition-all shadow-md"
                    >
                      Enregistrer la playlist
                    </button>
                  </div>
                </form>
              )}

              {/* Vue détaillée de la playlist sélectionnée */}
              {activePlaylist ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{activePlaylist.emoji || "📁"}</span>
                      <div>
                        <h4 className="text-sm font-extrabold text-white">
                          {activePlaylist.title}
                        </h4>
                        <p className="text-[11px] text-white/50">
                          {activePlaylist.videoIds.length} vidéo
                          {activePlaylist.videoIds.length > 1 ? "s" : ""}
                          {activePlaylist.description
                            ? ` · ${activePlaylist.description}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedPlaylistId(null)}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white/80 cursor-pointer"
                      >
                        Toutes
                      </button>

                      {activePlaylist.videoIds.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onPlayPlaylist(
                                activePlaylist.videoIds,
                                activePlaylist.title
                              );
                              onClose();
                            }}
                            className="px-3 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-black text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer shadow-md"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Lire tout</span>
                          </button>

                          {onOpenQrShare && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenQrShare({
                                  title: activePlaylist.title,
                                  videoIds: activePlaylist.videoIds,
                                });
                              }}
                              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-cyan-300 inline-flex items-center gap-1 cursor-pointer"
                              title="Partager cette playlist via QR Code"
                            >
                              <Share2 className="w-3 h-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Liste des vidéos de la playlist */}
                  {activePlaylist.videoIds.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                      <p className="text-xs text-white/60">
                        Cette playlist est vide pour le moment.
                      </p>
                      <p className="text-[11px] text-white/40">
                        Cliquez sur le bouton « Ajouter à une playlist » sur
                        n&apos;importe quelle vidéo pour la classer ici !
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {activePlaylist.videoIds.map((vidId) => {
                        const vid = videoMap.get(vidId);
                        if (!vid) return null;
                        return (
                          <div
                            key={vid.id}
                            className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 flex items-center justify-between gap-2 transition-colors cursor-pointer group"
                            onClick={() => {
                              onSelectVideoForPlayback(vid, 0);
                              onClose();
                            }}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={vid.thumb}
                                alt={vid.title}
                                referrerPolicy="no-referrer"
                                className="w-12 h-9 rounded-lg object-cover shrink-0 bg-black"
                              />
                              <div className="min-w-0">
                                <h5 className="text-xs font-bold text-white/90 truncate group-hover:text-cyan-300 transition-colors">
                                  {vid.title}
                                </h5>
                                <span className="text-[10px] text-white/50">
                                  @{vid.user} · {vid.domain}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={(e) =>
                                  handleRemoveVideo(
                                    activePlaylist.id,
                                    vid.id,
                                    e
                                  )
                                }
                                className="w-7 h-7 rounded-lg hover:bg-rose-950/60 text-white/40 hover:text-rose-300 flex items-center justify-center cursor-pointer transition-colors"
                                title="Retirer de la playlist"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Liste globale de toutes les playlists */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {playlists.map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => setSelectedPlaylistId(pl.id)}
                      className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-cyan-400/40 flex items-center justify-between gap-2.5 cursor-pointer transition-all group shadow-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl group-hover:scale-110 transition-transform">
                          {pl.emoji || "📁"}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-cyan-300 transition-colors">
                            {pl.title}
                          </h4>
                          <span className="text-[11px] text-white/50">
                            {pl.videoIds.length} vidéo
                            {pl.videoIds.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {pl.videoIds.length > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPlayPlaylist(pl.videoIds, pl.title);
                              onClose();
                            }}
                            className="w-7 h-7 rounded-full bg-cyan-400/20 hover:bg-cyan-400 text-cyan-300 hover:text-black flex items-center justify-center cursor-pointer transition-colors"
                            title="Lire la playlist"
                          >
                            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleDeletePlaylist(pl.id, e)}
                          className="w-7 h-7 rounded-full hover:bg-rose-950/60 text-white/30 hover:text-rose-300 flex items-center justify-center cursor-pointer transition-colors"
                          title="Supprimer la playlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===============================================================
              ONGLET 2 : HISTORIQUE DE VISIONNAGE & REPRISE
              =============================================================== */}
          {activeTab === "history" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-white/80 uppercase tracking-wider">
                  Reprendre là où vous vous êtes arrêté
                </span>
                {historyItems.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    className="text-[11px] font-bold text-rose-300/80 hover:text-rose-200 cursor-pointer transition-colors"
                  >
                    Effacer l&apos;historique
                  </button>
                )}
              </div>

              {historyItems.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                  <Clock className="w-8 h-8 text-white/30 mx-auto" />
                  <p className="text-xs text-white/60">
                    Aucun historique de visionnage pour le moment.
                  </p>
                  <p className="text-[11px] text-white/40">
                    Dès que vous regardez une vidéo, votre progression est
                    automatiquement mémorisée localement sur votre appareil.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyItems.map((item) => {
                    const vid = videoMap.get(item.videoId);
                    const pct =
                      item.duration > 0
                        ? Math.min(
                            100,
                            Math.round((item.seconds / item.duration) * 100)
                          )
                        : 0;
                    return (
                      <div
                        key={`${item.videoId}-${item.timestamp}`}
                        onClick={() => {
                          if (vid) {
                            onSelectVideoForPlayback(vid, item.seconds);
                            onClose();
                          }
                        }}
                        className="p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 flex items-center justify-between gap-3 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-14 h-10 rounded-xl overflow-hidden shrink-0 bg-black">
                            <img
                              src={item.thumb || vid?.thumb}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            {/* Barre de progression miniature */}
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
                              <div
                                className="h-full bg-cyan-400"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          <div className="min-w-0 space-y-0.5">
                            <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors">
                              {item.title}
                            </h4>
                            <div className="flex items-center gap-2 text-[10px] text-white/50 font-mono-num">
                              <span className="text-cyan-300 font-bold">
                                {formatSeconds(item.seconds)}
                              </span>
                              <span>/</span>
                              <span>{formatSeconds(item.duration)}</span>
                              <span>·</span>
                              <span>{pct}% vu</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black text-[11px] font-extrabold inline-flex items-center gap-1 cursor-pointer shrink-0 shadow-md group-hover:scale-105 transition-transform"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Reprendre</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===============================================================
              ONGLET 3 : GUIDE DES RACCOURCIS CLAVIER & CONFORT
              =============================================================== */}
          {activeTab === "keys" && (
            <div className="space-y-3">
              <span className="text-xs font-extrabold text-white/80 uppercase tracking-wider">
                Raccourcis Clavier Universels Orbit
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {[
                  {
                    key: "Espace ou K",
                    action: "Mettre en pause ou reprendre la lecture",
                  },
                  {
                    key: "← ou J",
                    action: "Reculer de 10 secondes (-10s)",
                  },
                  {
                    key: "→ ou L",
                    action: "Avancer de 10 secondes (+10s)",
                  },
                  {
                    key: "S",
                    action: "Changer la vitesse (0.75x, 1x, 1.25x, 1.5x, 2x)",
                  },
                  {
                    key: "M",
                    action: "Couper ou activer le son (Mute)",
                  },
                  {
                    key: "F",
                    action: "Basculer en Plein Écran (Fullscreen)",
                  },
                  {
                    key: "0 à 9",
                    action: "Sauter instantanément à 0% - 90% de la vidéo",
                  },
                  {
                    key: "H",
                    action: "Masquer / Afficher l'interface de contrôle",
                  },
                  {
                    key: "↑ / ↓",
                    action: "Passer à la vidéo précédente / suivante (Reels)",
                  },
                ].map((sc) => (
                  <div
                    key={sc.key}
                    className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2"
                  >
                    <span className="font-mono-num font-extrabold text-cyan-300 px-2 py-1 rounded bg-black/60 border border-white/15">
                      {sc.key}
                    </span>
                    <span className="text-right text-[11px] text-white/70">
                      {sc.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
