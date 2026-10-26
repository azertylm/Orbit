import React, { useState } from "react";
import { ALPHABETTE_MODULES } from "../data/alphabetteArchitecture";
import { Server, ShieldCheck, Globe, Lock, Copy, Check, Terminal } from "lucide-react";

export const AlphabetteDevOpsView: React.FC = () => {
  const [activeModId, setActiveModId] = useState(ALPHABETTE_MODULES[0].id);
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const activeModule =
    ALPHABETTE_MODULES.find((m) => m.id === activeModId) || ALPHABETTE_MODULES[0];

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedBlock(id);
    setTimeout(() => setCopiedBlock(null), 2000);
  };

  const runValidationSimulation = (modId: string) => {
    if (modId === "sso-jwt") {
      setTestResults((prev) => ({
        ...prev,
        [modId]:
          "HTTP/2 200 OK · JWT RS256 signé (iss: https://auth.alphabette.fr, aud: infoperso.fr) · Refresh token chiffré stocké dans auth_core.refresh_tokens (11 ms).",
      }));
    } else if (modId === "android-security") {
      setTestResults((prev) => ({
        ...prev,
        [modId]:
          "HTTP/2 200 OK (Content-Type: application/json) · Empreinte SHA-256 Play Store vérifiée pour fr.alphabette.orbit & fr.alphabette.infoperso.",
      }));
    } else if (modId === "coolify-domains") {
      setTestResults((prev) => ({
        ...prev,
        [modId]:
          "HTTP/2 301 Moved Permanently (alphabette.eu → https://alphabette.fr) · Certificat Let's Encrypt TLS 1.3 actif pour infoperso.fr et les 15 domaines .fr.",
      }));
    } else {
      setTestResults((prev) => ({
        ...prev,
        [modId]:
          "UFW actif (22/tcp, 80/tcp, 443/tcp+udp ouverts) · Port PostgreSQL 5432 isolé sur le bridge interne Docker Coolify · Variables critiques vérifiées.",
      }));
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            Infrastructure Unifiée Alphabette & DevOps
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
            Architecture de production pour le VPS OVH (Ubuntu 24.04 LTS), Coolify, PostgreSQL mutualisé, SSO JWT et Deep Linking Android.
          </p>
        </div>
        <div
          className="text-xs px-3.5 py-2 rounded-lg font-medium shrink-0"
          style={{
            background: "rgba(0, 229, 255, 0.08)",
            border: "1px solid rgba(0, 229, 255, 0.25)",
            color: "var(--accent-2)",
          }}
        >
          Jalon Déploiement : 5 novembre · Commande hébergement & domaine{" "}
          <strong className="font-bold">infoperso.fr</strong>
        </div>
      </div>

      {/* Top Summary Strip */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      >
        <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--accent-2)" }}>
            <Server className="w-4 h-4" />
            <span>Hébergement & OS</span>
          </div>
          <div className="text-sm font-bold mt-1">VPS OVH Ubuntu 24.04 LTS</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Orchestration Docker via Coolify
          </div>
        </div>

        <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--accent)" }}>
            <Globe className="w-4 h-4" />
            <span>Routage Multi-Domaine</span>
          </div>
          <div className="text-sm font-bold mt-1 font-mono-num">alphabette.fr + 15 .fr</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            301 alphabette.eu · infoperso.fr inclus
          </div>
        </div>

        <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--success)" }}>
            <ShieldCheck className="w-4 h-4" />
            <span>SSO & Base Centrale</span>
          </div>
          <div className="text-sm font-bold mt-1">JWT RS256 + PostgreSQL 16</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Mutualisé & cloisonné par schéma/RLS
          </div>
        </div>

        <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.02)" }}>
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: "var(--warning)" }}>
            <Lock className="w-4 h-4" />
            <span>Clients Android Play Store</span>
          </div>
          <div className="text-sm font-bold mt-1">Keystore + assetlinks.json</div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Certificate Pinning & App Links
          </div>
        </div>
      </div>

      {/* Module Selector Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {ALPHABETTE_MODULES.map((mod) => {
          const active = mod.id === activeModId;
          return (
            <button
              key={mod.id}
              type="button"
              onClick={() => setActiveModId(mod.id)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all whitespace-nowrap shrink-0"
              style={{
                background: active ? "var(--accent)" : "var(--bg-card)",
                color: active ? "#ffffff" : "var(--text-muted)",
                border: active ? "1px solid transparent" : "1px solid var(--border)",
              }}
            >
              {mod.title}
            </button>
          );
        })}
      </div>

      {/* Active Module Detail: 1. Configuration Système -> 2. Implémentation -> 3. Test de Validation */}
      <div className="space-y-5">
        <div
          className="p-5 rounded-2xl"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-lg font-extrabold">{activeModule.title}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {activeModule.subtitle}
          </p>
        </div>

        {/* Step 1: System Config */}
        <div
          className="p-5 rounded-2xl space-y-3"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-extrabold" style={{ color: "var(--accent-2)" }}>
                {activeModule.systemConfig.title}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {activeModule.systemConfig.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleCopy(activeModule.systemConfig.code, `${activeModule.id}-sys`)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
            >
              {copiedBlock === `${activeModule.id}-sys` ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copié</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier config</span>
                </>
              )}
            </button>
          </div>
          <pre
            className="p-4 rounded-xl text-xs font-mono-num overflow-x-auto leading-relaxed"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
          >
            <code>{activeModule.systemConfig.code}</code>
          </pre>
        </div>

        {/* Step 2: Implementation Code */}
        <div
          className="p-5 rounded-2xl space-y-3"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-extrabold" style={{ color: "var(--accent)" }}>
                {activeModule.implementation.title}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {activeModule.implementation.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                handleCopy(activeModule.implementation.code, `${activeModule.id}-impl`)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
              style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
            >
              {copiedBlock === `${activeModule.id}-impl` ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copié</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier code</span>
                </>
              )}
            </button>
          </div>
          <pre
            className="p-4 rounded-xl text-xs font-mono-num overflow-x-auto leading-relaxed"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
          >
            <code>{activeModule.implementation.code}</code>
          </pre>
        </div>

        {/* Step 3: Validation Test */}
        <div
          className="p-5 rounded-2xl space-y-3"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h3 className="text-sm font-extrabold" style={{ color: "var(--success)" }}>
                {activeModule.validation.title}
              </h3>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                {activeModule.validation.description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => runValidationSimulation(activeModule.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer whitespace-nowrap shrink-0"
                style={{ background: "var(--accent)" }}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>Simuler le test</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleCopy(activeModule.validation.code, `${activeModule.id}-val`)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
              >
                {copiedBlock === `${activeModule.id}-val` ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier test</span>
                  </>
                )}
              </button>
            </div>
          </div>
          <pre
            className="p-4 rounded-xl text-xs font-mono-num overflow-x-auto leading-relaxed"
            style={{ background: "var(--bg-input)", border: "1px solid var(--border)" }}
          >
            <code>{activeModule.validation.code}</code>
          </pre>

          {testResults[activeModule.id] && (
            <div
              className="p-3 rounded-xl text-xs font-mono-num flex items-center justify-between"
              style={{
                background: "rgba(0, 230, 118, 0.1)",
                border: "1px solid rgba(0, 230, 118, 0.3)",
                color: "var(--success)",
              }}
            >
              <span>✓ {testResults[activeModule.id]}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
