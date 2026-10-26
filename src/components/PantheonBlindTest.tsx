import React, { useState, useMemo } from "react";
import { OrbitVideo, OrbitDomain } from "../data/orbitData";
import { HelpCircle, Trophy, Sparkles, Play, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface PantheonBlindTestProps {
  videos: OrbitVideo[];
  domains: OrbitDomain[];
  onEarnScoutPoints: (pts: number) => void;
  onPlayPip: (video: OrbitVideo) => void;
}

export const PantheonBlindTest: React.FC<PantheonBlindTestProps> = ({
  videos,
  domains,
  onEarnScoutPoints,
  onPlayPip,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [audioPreviewPlaying, setAudioPreviewPlaying] = useState(false);

  const currentMysteryVideo = useMemo(() => {
    if (videos.length === 0) return null;
    return videos[questionIndex % videos.length];
  }, [videos, questionIndex]);

  const options = useMemo(() => {
    if (!currentMysteryVideo) return [];
    const correct = currentMysteryVideo.domain;
    const otherDomains = domains
      .map((d) => d.name)
      .filter((n) => n !== correct);

    // Deterministic shuffle based on video id + questionIndex
    const seed = currentMysteryVideo.id + questionIndex;
    const picked = [
      otherDomains[seed % otherDomains.length],
      otherDomains[(seed + 3) % otherDomains.length],
      otherDomains[(seed + 7) % otherDomains.length],
    ];
    const all = [correct, ...picked];
    return all.sort((a, b) => a.localeCompare(b));
  }, [currentMysteryVideo, domains, questionIndex]);

  if (!currentMysteryVideo) return null;

  const handleSelectOption = (domainName: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(domainName);
    if (domainName === currentMysteryVideo.domain) {
      setStreak((s) => s + 1);
      setScore((sc) => sc + 10);
      onEarnScoutPoints(10);
    } else {
      setStreak(0);
    }
  };

  const handleNextMystery = () => {
    setSelectedAnswer(null);
    setAudioPreviewPlaying(false);
    setQuestionIndex((q) => q + 1);
  };

  return (
    <div className="glass-panel rounded-3xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shrink-0"
            style={{
              background: "linear-gradient(135deg, #f59e0b, #ef4444)",
              boxShadow: "0 0 20px rgba(245, 158, 11, 0.35)",
            }}
          >
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-extrabold font-display flex items-center gap-2">
              <span>Blind-Test Culturel du Panthéon</span>
              <span className="text-xs font-mono-num text-amber-400">
                · Série : {streak} 🔥 · +{score} pts Éclaireur
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Devinez le pilier culturel d'une pépite mystère à partir de son indice sonore et de l'avis du curateur.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture whitespace-nowrap shrink-0"
          style={{
            background: isOpen
              ? "rgba(255,255,255,0.12)"
              : "linear-gradient(135deg, #f59e0b, #ea580c)",
          }}
        >
          {isOpen ? "Masquer le Blind-Test" : "Jouer au Blind-Test (+10 pts)"}
        </button>
      </div>

      {isOpen && (
        <div
          className="pt-4 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-center"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          {/* Blurred Mystery Preview + Audio Stream Trigger */}
          <div className="relative rounded-2xl overflow-hidden aspect-video bg-black border border-white/10">
            {audioPreviewPlaying ? (
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube-nocookie.com/embed/${currentMysteryVideo.youtubeId}?autoplay=1&controls=0`}
                title="Blind Test Audio"
                className={selectedAnswer ? "w-full h-full" : "w-full h-full blur-xl scale-125"}
                frameBorder="0"
                allow="autoplay; encrypted-media"
              />
            ) : (
              <img
                src={currentMysteryVideo.thumb}
                alt="Pépite mystère"
                referrerPolicy="no-referrer"
                className={`w-full h-full object-cover transition-all duration-500 ${
                  selectedAnswer ? "blur-0 scale-100" : "blur-xl scale-125 opacity-75"
                }`}
              />
            )}

            {!selectedAnswer && (
              <div className="absolute inset-0 bg-black/45 flex flex-col items-center justify-center p-4 text-center gap-2">
                <button
                  type="button"
                  onClick={() => setAudioPreviewPlaying(!audioPreviewPlaying)}
                  className="px-3.5 py-2 rounded-full glass-action-btn text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {audioPreviewPlaying ? "Indice Audio en cours..." : "Écouter l'indice sonore"}
                  </span>
                </button>
                <span className="text-[11px] text-white/75 font-mono-num">
                  Note Panthéon : {currentMysteryVideo.score.toFixed(1)}/10
                </span>
              </div>
            )}
          </div>

          {/* Clue & 4 Domain Options */}
          <div className="space-y-3.5">
            <div
              className="p-3.5 rounded-2xl text-xs space-y-1"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="font-bold text-amber-400">
                Indice du curateur @{currentMysteryVideo.user} :
              </div>
              <p className="italic text-sm leading-relaxed">
                « {currentMysteryVideo.comment} »
              </p>
              {selectedAnswer && (
                <div className="pt-2 font-extrabold text-xs" style={{ color: "var(--accent-2)" }}>
                  Titre dévoilé : {currentMysteryVideo.title} ({currentMysteryVideo.domain} ›{" "}
                  {currentMysteryVideo.subdomain})
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {options.map((opt) => {
                const domObj = domains.find((d) => d.name === opt);
                const isCorrect = opt === currentMysteryVideo.domain;
                const isChosen = selectedAnswer === opt;

                let borderStyle = "1px solid var(--border)";
                let bgStyle = "var(--bg-input)";
                if (selectedAnswer) {
                  if (isCorrect) {
                    borderStyle = "1px solid var(--success)";
                    bgStyle = "rgba(0, 230, 118, 0.14)";
                  } else if (isChosen) {
                    borderStyle = "1px solid var(--danger)";
                    bgStyle = "rgba(255, 61, 113, 0.14)";
                  }
                }

                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={Boolean(selectedAnswer)}
                    onClick={() => handleSelectOption(opt)}
                    className="p-3 rounded-xl text-xs font-bold flex items-center justify-between gap-2 cursor-pointer transition-all hover:scale-[1.01]"
                    style={{
                      background: bgStyle,
                      border: borderStyle,
                      color: "var(--text-main)",
                    }}
                  >
                    <span className="truncate">
                      {domObj?.icon} {opt}
                    </span>
                    {selectedAnswer && isCorrect && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    {selectedAnswer && isChosen && !isCorrect && (
                      <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {selectedAnswer && (
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                <span
                  className="text-xs font-bold"
                  style={{
                    color:
                      selectedAnswer === currentMysteryVideo.domain
                        ? "var(--success)"
                        : "var(--danger)",
                  }}
                >
                  {selectedAnswer === currentMysteryVideo.domain
                    ? "✓ Bravo ! +10 points d'Éclaireur ajoutés à votre profil."
                    : `✗ Raté ! Cette pépite appartient au pilier ${currentMysteryVideo.domain}.`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPlayPip(currentMysteryVideo)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer glass-panel"
                  >
                    Voir la vidéo
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMystery}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white cursor-pointer btn-couture inline-flex items-center gap-1.5"
                    style={{ background: "var(--accent)" }}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Pépite Mystère Suivante</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
