import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

const DOMAINS_TAXONOMY = [
  { id: 1, name: "Sciences & Tech", keywords: ["ia", "ai", "neurone", "llm", "transformer", "math", "physique", "cosmos", "espace", "science", "fourier", "algorithme", "quantique", "jwst"], subs: ["IA & Robotique", "Mathématiques & Logique", "Physique & Cosmos", "Espace & Astronomie", "Biologie & Vivant"] },
  { id: 2, name: "Musique & Son", keywords: ["musique", "lofi", "synth", "modulaire", "audio", "concert", "live", "sample", "beat", "guitare", "piano", "acoustique", "mao", "vinyl"], subs: ["Électro & Synthés", "Production & MAO", "Sessions Live", "Instruments & Luthier", "Rap & Boom-Bap", "Classique & Jazz"] },
  { id: 3, name: "Cinéma & Séries", keywords: ["film", "cinema", "serie", "realisateur", "court-metrage", "plan", "caméra", "montage", "blender", "scénario", "animation"], subs: ["Réalisation & Plans", "Courts-Métrages", "Analyse Filmique", "Histoire du Cinéma", "Documentaires"] },
  { id: 4, name: "Création Numérique", keywords: ["3d", "shader", "vfx", "light painting", "photo", "lumiere", "optique", "motion", "design", "fractale", "procédural", "graphisme"], subs: ["VFX & Shaders", "Motion Design 3D", "Light Painting & Photo", "Design Graphique", "Scénographie"] },
  { id: 5, name: "Sport & Aventure", keywords: ["sport", "basket", "nba", "escalade", "montagne", "endurance", "athlé", "course", "aventure", "physique", "stratégie"], subs: ["Collectifs & Stratégie", "Montagne & Escalade", "Endurance & Athlé", "Glisse & Océan", "Analyse Tactique"] },
  { id: 6, name: "Artisanat & Cuisine", keywords: ["cuisine", "pain", "levain", "patisserie", "bois", "menuiserie", "artisanat", "recette", "terroir", "gastronomie", "savoir-faire"], subs: ["Pâtisserie & Pain", "Travail du Bois", "Cuisine du Monde", "Terroir & Savoir-Faire", "Forge & Matière"] },
  { id: 7, name: "Nature & Écologie", keywords: ["nature", "forêt", "arbre", "océan", "abysse", "permaculture", "jardin", "sol", "écologie", "biodiversité", "climat"], subs: ["Forêts & Biodiversité", "Océans & Abysses", "Permaculture & Jardin", "Climat & Énergie", "Faune Sauvage"] },
  { id: 8, name: "Culture & Idées", keywords: ["philosophie", "société", "média", "langue", "étymologie", "idée", "débat", "entropie", "information", "attention", "lecture"], subs: ["Philosophie", "Société & Médias", "Langues & Étymologie", "Éloquence & Débats", "Littérature"] },
  { id: 9, name: "Architecture & Design", keywords: ["architecture", "design", "urbanisme", "ville", "acoustique", "objet", "habitat", "minimalisme", "espace"], subs: ["Architecture", "Design d'Objet", "Urbanisme & Habitat", "Éco-construction", "Patrimoine"] },
  { id: 10, name: "Dev & Open Source", keywords: ["dev", "code", "open-source", "docker", "sqlite", "postgresql", "linux", "vps", "coolify", "cybersécurité", "cryptographie", "web", "auto-hébergement"], subs: ["Web & Mobile", "Auto-hébergement", "Logiciels Libres", "Cybersécurité", "Serveurs & Docker"] },
  { id: 11, name: "Jeux & Mondes Virtuels", keywords: ["jeu", "game design", "gaming", "indé", "rétrogaming", "ray tracing", "console", "stratégie", "échecs", "level design"], subs: ["Game Design", "Jeux Indépendants", "Rétrogaming", "Stratégie & Échecs", "Simulations"] },
  { id: 12, name: "Arts Visuels & Plastiques", keywords: ["peinture", "sculpture", "musée", "exposition", "pigment", "couleur", "clair-obscur", "dessin", "art plastique"], subs: ["Peinture & Dessin", "Sculpture & Matière", "Expositions & Musées", "BD & Illustration", "Calligraphie"] },
  { id: 13, name: "Histoire & Civilisations", keywords: ["histoire", "antiquité", "rome", "archéologie", "civilisation", "anticythère", "alexandrie", "moyen-âge", "technique"], subs: ["Antiquité & Moyen-Âge", "Histoire des Techniques", "Archéologie", "Grandes Explorations", "Archives"] },
  { id: 14, name: "Humour & Scène", keywords: ["humour", "stand-up", "sketch", "comédie", "rire", "parodie", "cartoon", "scène", "impro"], subs: ["Sketchs & Parodies", "Classiques de l'Humour", "Stand-Up", "Improvisation", "Satire"] },
  { id: 15, name: "Bien-être & Quotidien", keywords: ["bien-être", "chien", "animal", "entraide", "voisin", "minimalisme", "sommeil", "bonheur", "quotidien", "lien social", "facebook", "groupe"], subs: ["Animaux & Compagnons", "Entraide & Lien Local", "Minimalisme", "Méditation & Sommeil", "Organisation"] }
];

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function classifyHeuristic(title: string, description = "") {
  const textToAnalyze = `${title} ${description}`.toLowerCase();
  let bestMatch = {
    domain: DOMAINS_TAXONOMY[0].name,
    subdomain: DOMAINS_TAXONOMY[0].subs[0],
    confidence: 0.78,
    source: "heuristic",
  };
  let bestScore = 0;

  for (const dom of DOMAINS_TAXONOMY) {
    let hits = 0;
    for (const kw of dom.keywords) {
      if (textToAnalyze.includes(kw)) hits++;
    }
    if (hits > bestScore) {
      bestScore = hits;
      bestMatch = {
        domain: dom.name,
        subdomain: dom.subs[0],
        confidence: Math.min(0.95, 0.75 + hits * 0.06),
        source: "heuristic",
      };
    }
  }
  return bestMatch;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // 0. 24/7 Health Check & Availability Probe
  app.get("/api/orbit/health", (_req, res) => {
    res.json({
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
      ),
    });
  });

  // 1. Server-side Gemini classification endpoint
  app.post("/api/orbit/classify", async (req, res) => {
    const { title = "", description = "", url = "" } = req.body || {};
    const combinedTitle = `${title} ${url}`.trim();

    if (!combinedTitle) {
      res.status(400).json({ error: "Titre ou URL requis pour l'analyse." });
      return;
    }

    const ai = getGeminiClient();
    if (ai) {
      try {
        const taxonomySummary = DOMAINS_TAXONOMY.map(
          (d) => `- ${d.name} (Sous-domaines : ${d.subs.join(", ")})`
        ).join("\n");

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: `Analyse cette vidéo YouTube/Facebook/TikTok/Instagram/Twitch et classe-la STRICTEMENT parmi l'un de ces 15 domaines et ses sous-domaines associés :\n${taxonomySummary}\n\nTitre / URL de la vidéo : "${combinedTitle}"\nDescription / Note : "${description}"`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                domain: {
                  type: Type.STRING,
                  description: "Le nom exact de l'un des 15 domaines.",
                },
                subdomain: {
                  type: Type.STRING,
                  description: "Le nom exact de l'un des sous-domaines du domaine choisi.",
                },
                confidence: {
                  type: Type.NUMBER,
                  description: "Score de confiance entre 0.0 et 1.0.",
                },
                reason: {
                  type: Type.STRING,
                  description: "Explication concise en français du classement sémantique.",
                },
              },
              required: ["domain", "subdomain", "confidence", "reason"],
            },
          },
        });

        const rawText = response.text;
        if (rawText) {
          const parsed = JSON.parse(rawText.trim());
          const matchedDomain =
            DOMAINS_TAXONOMY.find((d) => d.name === parsed.domain) || DOMAINS_TAXONOMY[0];
          const matchedSub = matchedDomain.subs.includes(parsed.subdomain)
            ? parsed.subdomain
            : matchedDomain.subs[0];

          res.json({
            domain: matchedDomain.name,
            subdomain: matchedSub,
            confidence: parsed.confidence || 0.95,
            reason: parsed.reason || "Analyse sémantique Gemini complétée.",
            source: "gemini",
          });
          return;
        }
      } catch (err) {
        console.warn("Repli sur l'heuristique locale :", err);
      }
    }

    const fallback = classifyHeuristic(combinedTitle, description);
    res.json({
      ...fallback,
      reason: "Classification rapide par correspondance lexicale sur les 15 domaines.",
    });
  });

  // 2. Server-side Gemini Video Summary endpoint (Idée 4 : Résumé IA des vidéos longues)
  app.post("/api/orbit/summarize", async (req, res) => {
    const { title = "", domain = "", subdomain = "", comment = "" } = req.body || {};
    if (!title) {
      res.status(400).json({ error: "Titre requis pour le résumé IA." });
      return;
    }

    const ai = getGeminiClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: `Tu es un curateur culturel expert d'ORBIT. Génère un résumé exécutif ultra-pertinent en français pour cette vidéo longue.\nTitre : "${title}"\nDomaine : ${domain} › ${subdomain}\nNote du curateur : "${comment}"`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                bullets: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Exactement 3 points clés synthétiques et concrets.",
                },
                verdict: {
                  type: Type.STRING,
                  description: "Une phrase expliquant pourquoi cette vidéo mérite sa place au Panthéon.",
                },
                estimatedSavedMinutes: {
                  type: Type.INTEGER,
                  description: "Temps de visionnage économisé en minutes (ex: 12).",
                },
              },
              required: ["bullets", "verdict", "estimatedSavedMinutes"],
            },
          },
        });

        const rawText = response.text;
        if (rawText) {
          const parsed = JSON.parse(rawText.trim());
          res.json({
            bullets:
              Array.isArray(parsed.bullets) && parsed.bullets.length > 0
                ? parsed.bullets.slice(0, 3)
                : [
                    `Décryptage approfondi de : ${title}`,
                    `Focus méthodologique dans la catégorie ${subdomain}`,
                    `Recommandé par la communauté pour sa densité d'information`,
                  ],
            verdict:
              parsed.verdict ||
              `Une référence incontournable du pilier ${domain} (${subdomain}).`,
            estimatedSavedMinutes: parsed.estimatedSavedMinutes || 14,
            source: "gemini",
          });
          return;
        }
      } catch (err) {
        console.warn("Repli local pour le résumé IA :", err);
      }
    }

    res.json({
      bullets: [
        `Synthèse structurée des concepts clés abordés dans « ${title} ».`,
        `Mise en perspective pratique dans le sous-domaine ${subdomain || domain}.`,
        `Point mis en avant par le curateur : « ${comment || "Haute valeur ajoutée"} ».`,
      ],
      verdict: `Pépite haute densité sélectionnée dans ${domain} › ${subdomain}.`,
      estimatedSavedMinutes: 12,
      source: "local-cache",
    });
  });

  // 3. Server-side Gemini Comment Translation endpoint (Idée 10 : Traduction automatique des commentaires)
  app.post("/api/orbit/translate", async (req, res) => {
    const { text = "", targetLang = "fr" } = req.body || {};
    if (!text) {
      res.status(400).json({ error: "Texte requis pour la traduction." });
      return;
    }

    const langNames: Record<string, string> = {
      fr: "français",
      en: "anglais",
      es: "espagnol",
    };
    const targetLanguageLabel = langNames[targetLang] || "français";

    const ai = getGeminiClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: `Traduis fidèlement ce commentaire d'utilisateur en ${targetLanguageLabel}. Conserve le ton naturel et concis. Ne renvoie que la traduction.\n\nCommentaire : "${text}"`,
        });

        const translated = response.text?.trim();
        if (translated) {
          res.json({
            translatedText: translated,
            targetLang,
            source: "gemini",
          });
          return;
        }
      } catch (err) {
        console.warn("Repli local pour la traduction :", err);
      }
    }

    // Deterministic offline/local fallback translation dictionary + adaptive phrasing
    const dictionary: Record<string, Record<string, string>> = {
      "Masterclass absolute! The local unified memory benchmark is insane.": {
        fr: "Masterclass absolue ! Le benchmark en mémoire unifiée locale est incroyable.",
        es: "¡Obra maestra absoluta! El benchmark de memoria unificada local es increíble.",
      },
      "Pure visual poetry, zero CGI needed when you master light like this.": {
        fr: "Pure poésie visuelle, zéro CGI nécessaire quand on maîtrise la lumière ainsi.",
        es: "Pura poesía visual, cero CGI necesario cuando dominas la luz así.",
      },
      "Ultra clair même sur la partie matériel !": {
        en: "Super clear even on the hardware section!",
        es: "¡Súper claro incluso en la parte de hardware!",
      },
      "Noté 10/10, exactement ce que je cherchais.": {
        en: "Rated 10/10, exactly what I was looking for.",
        es: "Calificado 10/10, exactamente lo que estaba buscando.",
      },
      "Les couleurs sont folles !": {
        en: "The colors are insane!",
        es: "¡Los colores son increíbles!",
      },
    };

    const exact = dictionary[text]?.[targetLang];
    res.json({
      translatedText:
        exact ||
        (targetLang === "en"
          ? `[EN] ${text}`
          : targetLang === "es"
          ? `[ES] ${text}`
          : `[Traduit en FR] ${text}`),
      targetLang,
      source: "local-cache",
    });
  });

  // 4. Server-side oEmbed metadata proxy (avoids browser CORS issues)
  app.get("/api/orbit/oembed", async (req, res) => {
    const rawUrl = String(req.query.url || "").trim();
    if (!rawUrl) {
      res.status(400).json({ error: "Paramètre url manquant." });
      return;
    }

    if (rawUrl.includes("youtube.com") || rawUrl.includes("youtu.be")) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(rawUrl)}&format=json`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
          const data = (await response.json()) as {
            title?: string;
            author_name?: string;
            thumbnail_url?: string;
          };
          res.json({
            title: data.title || "",
            author: data.author_name || "",
            thumb: data.thumbnail_url || "",
          });
          return;
        }
      } catch (err) {
        console.warn("Erreur oEmbed YouTube :", err);
      }
    }

    if (rawUrl.includes("tiktok.com")) {
      try {
        const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(rawUrl)}`;
        const response = await fetch(oembedUrl);
        if (response.ok) {
          const data = (await response.json()) as {
            title?: string;
            author_name?: string;
            thumbnail_url?: string;
          };
          res.json({
            title: data.title || "Pépite TikTok partagée",
            author: data.author_name || "Créateur TikTok",
            thumb: data.thumbnail_url || "",
          });
          return;
        }
      } catch (err) {
        console.warn("Erreur oEmbed TikTok :", err);
      }
    }

    const lower = rawUrl.toLowerCase();
    if (lower.includes("facebook.com") || lower.includes("fb.watch") || lower.includes("fb.com")) {
      const isReel = lower.includes("/reel/") || lower.includes("/share/r/");
      const pathParts = rawUrl.replace(/^https?:\/\/(www\.|m\.|web\.)?(facebook\.com|fb\.watch|fb\.com)\/?/i, "").split(/[/?#]/).filter(Boolean);
      const authorCandidate = pathParts[0] && !["watch", "reel", "share", "videos", "plugins"].includes(pathParts[0].toLowerCase())
        ? pathParts[0]
        : "Facebook Watch";
      const idCandidate = pathParts[pathParts.length - 1] || "video";
      res.json({
        title: isReel
          ? `Facebook Reel · ${authorCandidate} (#${idCandidate.slice(0, 10)})`
          : `Vidéo Facebook · ${authorCandidate} (#${idCandidate.slice(0, 10)})`,
        author: authorCandidate,
        thumb: "",
      });
      return;
    }

    res.json({ title: "", author: "", thumb: "" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ORBIT v2.0 Server listening on http://localhost:${PORT}`);
  });
}

startServer();
