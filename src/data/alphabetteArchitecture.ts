export interface ArchitectureModule {
  id: string;
  title: string;
  subtitle: string;
  systemConfig: {
    title: string;
    description: string;
    code: string;
    language: string;
  };
  implementation: {
    title: string;
    description: string;
    code: string;
    language: string;
  };
  validation: {
    title: string;
    description: string;
    code: string;
    language: string;
  };
}

export const ALPHABETTE_MODULES: ArchitectureModule[] = [
  {
    id: "sso-jwt",
    title: "01. API Authentification Centralisée (SSO / JWT)",
    subtitle: "Compte unique Alphabette pour les 15 applications .fr, rotation de Refresh Tokens chiffrés et isolation PostgreSQL.",
    systemConfig: {
      title: "1. Configuration Système & Schéma PostgreSQL Mutualisé",
      description: "Provisionnement du schéma central `auth_core` et isolation logique par `app_slug` sur l'instance PostgreSQL 16 locale du VPS OVH.",
      language: "sql",
      code: `-- /opt/alphabette/sql/01_init_sso_schema.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS auth_core;

CREATE TABLE auth_core.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    global_role VARCHAR(32) DEFAULT 'member' NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE auth_core.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_core.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    app_domain VARCHAR(100) NOT NULL, -- ex: orbit.alphabette.fr, infoperso.fr
    device_fingerprint VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cloisonnement logique par application (Row-Level Security)
ALTER TABLE auth_core.refresh_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_users_email ON auth_core.users(email);
CREATE INDEX idx_refresh_user_app ON auth_core.refresh_tokens(user_id, app_domain);`
    },
    implementation: {
      title: "2. Code d'Implémentation — Serveur SSO Fastify (Node.js / TypeScript)",
      description: "Service d'authentification haute performance signant des JWT asymétriques RS256 valables sur les 15 domaines .fr et applications Android Play Store.",
      language: "typescript",
      code: `// /opt/alphabette/sso-api/src/server.ts
import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyRateLimit from '@fastify/rate-limit';
import { Pool } from 'pg';
import argon2 from 'argon2';
import crypto from 'crypto';

const app = Fastify({ logger: true, trustProxy: true });
const db = new Pool({ connectionString: process.env.DATABASE_URL, max: 20 });

await app.register(fastifyRateLimit, {
  max: 60,
  timeWindow: '1 minute',
  allowList: ['127.0.0.1']
});

await app.register(fastifyJwt, {
  secret: {
    private: process.env.JWT_PRIVATE_KEY_PEM!,
    public: process.env.JWT_PUBLIC_KEY_PEM!
  },
  sign: { algorithm: 'RS256', iss: 'https://auth.alphabette.fr', expiresIn: '15m' }
});

app.post('/v1/auth/login', async (request, reply) => {
  const { email, password, appDomain, deviceId } = request.body as Record<string, string>;
  const { rows } = await db.query(
    'SELECT id, email, password_hash, display_name, global_role FROM auth_core.users WHERE email = $1',
    [email.toLowerCase().trim()]
  );

  const user = rows[0];
  if (!user || !(await argon2.verify(user.password_hash, password))) {
    return reply.code(401).send({ error: 'Identifiants invalides' });
  }

  const accessToken = app.jwt.sign({
    sub: user.id,
    email: user.email,
    name: user.display_name,
    role: user.global_role,
    aud: appDomain
  });

  const rawRefresh = crypto.randomBytes(48).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawRefresh).digest('hex');

  await db.query(
    \`INSERT INTO auth_core.refresh_tokens (user_id, token_hash, app_domain, device_fingerprint, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')\`,
    [user.id, tokenHash, appDomain, deviceId || 'android-play']
  );

  return reply.send({ accessToken, refreshToken: rawRefresh, expiresIn: 900 });
});`
    },
    validation: {
      title: "3. Test de Validation & Audit de Jeton",
      description: "Vérification de l'émission du couple JWT RS256 + Refresh Token et contrôle de la latence PostgreSQL.",
      language: "bash",
      code: `# Test d'authentification SSO depuis infoperso.fr ou l'application Android Orbit
curl -i -X POST https://auth.alphabette.fr/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "valentin@alphabette.fr",
    "password": "StrongPassword2026!",
    "appDomain": "infoperso.fr",
    "deviceId": "pixel-9-pro-playstore"
  }'

# Vérification attendue : HTTP/2 200 OK + accessToken RS256 + entrée chiffrée dans auth_core.refresh_tokens`
    }
  },
  {
    id: "android-security",
    title: "02. Sécurité Android Play Store & Deep Linking (assetlinks.json)",
    subtitle: "Stockage chiffré EncryptedSharedPreferences / Keystore, Certificate Pinning HTTPS et vérification Digital Asset Links.",
    systemConfig: {
      title: "1. Configuration Serveur — /.well-known/assetlinks.json",
      description: "Fichier servi sur alphabette.fr, infoperso.fr et les 15 domaines .fr pour valider automatiquement les App Links Android sans boîte de dialogue d'ambiguïté.",
      language: "json",
      code: `[
  {
    "relation": [
      "delegate_permission/common.handle_all_urls",
      "delegate_permission/common.get_login_creds"
    ],
    "target": {
      "namespace": "android_app",
      "package_name": "fr.alphabette.orbit",
      "sha256_cert_fingerprints": [
        "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C"
      ]
    }
  },
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "fr.alphabette.infoperso",
      "sha256_cert_fingerprints": [
        "FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C"
      ]
    }
  }
]`
    },
    implementation: {
      title: "2. Code d'Implémentation — Client Android Kotlin (Keystore + OkHttp TLS 1.3)",
      description: "Stockage matériel AES-256-GCM des jetons JWT via Android Keystore et intercepteur OkHttp avec renouvellement silencieux.",
      language: "kotlin",
      code: `// app/src/main/java/fr/alphabette/core/security/AlphabetteTokenVault.kt
package fr.alphabette.core.security

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import okhttp3.CertificatePinner
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

class AlphabetteTokenVault(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        "alphabette_sso_vault",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveTokens(access: String, refresh: String) {
        prefs.edit().putString("jwt_access", access).putString("jwt_refresh", refresh).apply()
    }

    fun getAccessToken(): String? = prefs.getString("jwt_access", null)
}

fun buildSecureAlphabetteClient(vault: AlphabetteTokenVault): OkHttpClient {
    val pinner = CertificatePinner.Builder()
        .add("*.alphabette.fr", "sha256/jQJTbIh0grw0/1TkHSumWb+Fs0Ggogr621gT3PvPKG0=")
        .add("infoperso.fr", "sha256/jQJTbIh0grw0/1TkHSumWb+Fs0Ggogr621gT3PvPKG0=")
        .build()

    return OkHttpClient.Builder()
        .certificatePinner(pinner)
        .connectTimeout(10, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val req = chain.request().newBuilder().apply {
                vault.getAccessToken()?.let { header("Authorization", "Bearer $it") }
            }.build()
            chain.proceed(req)
        }
        .build()
}`
    },
    validation: {
      title: "3. Test de Validation — Google Digital Asset Links & ADB",
      description: "Validation du fichier assetlinks.json en ligne et test d'ouverture directe d'une Capsule d'Affinité sur Android.",
      language: "bash",
      code: `# 1. Vérifier l'en-tête Content-Type strict application/json et le statut 200
curl -I https://alphabette.fr/.well-known/assetlinks.json

# 2. Tester l'App Link profond directement sur un appareil Android via ADB
adb shell am start -a android.intent.action.VIEW \\
  -c android.intent.category.BROWSABLE \\
  -d "https://alphabette.fr/capsule?friend=Anne-Sophie&domain=Musique"`
    }
  },
  {
    id: "coolify-domains",
    title: "03. Routage Multi-Domaine Coolify, Redirection 301 & SSL Let's Encrypt",
    subtitle: "Redirection 301 de alphabette.eu vers alphabette.fr, gestion d'infoperso.fr (commande du 5 novembre) et des 15 domaines .fr.",
    systemConfig: {
      title: "1. Configuration Système — Traefik / Coolify Labels & Redirection 301",
      description: "Configuration dynamique Traefik gérée par Coolify sur le VPS OVH pour forcer HTTPS (TLS 1.3) et rediriger alphabette.eu vers alphabette.fr en 301 permanent.",
      language: "yaml",
      code: `# /opt/alphabette/docker-compose.production.yml
version: '3.9'

services:
  alphabette-gateway:
    image: ghcr.io/alphabette/orbit-unified-server:latest
    restart: unless-stopped
    env_file: .env.production
    networks:
      - coolify
    labels:
      - "traefik.enable=true"
      # Routeur principal : alphabette.fr + infoperso.fr + domaines secondaires .fr
      - "traefik.http.routers.alphabette-main.rule=Host(\`alphabette.fr\`) || Host(\`www.alphabette.fr\`) || Host(\`infoperso.fr\`) || Host(\`orbit.alphabette.fr\`)"
      - "traefik.http.routers.alphabette-main.entrypoints=https"
      - "traefik.http.routers.alphabette-main.tls=true"
      - "traefik.http.routers.alphabette-main.tls.certresolver=letsencrypt"
      # Routeur de redirection 301 stricte : alphabette.eu -> alphabette.fr
      - "traefik.http.routers.alphabette-eu.rule=Host(\`alphabette.eu\`) || Host(\`www.alphabette.eu\`)"
      - "traefik.http.routers.alphabette-eu.entrypoints=https"
      - "traefik.http.routers.alphabette-eu.tls.certresolver=letsencrypt"
      - "traefik.http.routers.alphabette-eu.middlewares=redirect-eu-to-fr"
      - "traefik.http.middlewares.redirect-eu-to-fr.redirectregex.regex=^https?://(?:www\\.)?alphabette\\.eu/(.*)"
      - "traefik.http.middlewares.redirect-eu-to-fr.redirectregex.replacement=https://alphabette.fr/$${1}"
      - "traefik.http.middlewares.redirect-eu-to-fr.redirectregex.permanent=true"

networks:
  coolify:
    external: true`
    },
    implementation: {
      title: "2. Code d'Implémentation — Résolution Multi-Tenant par Domaine Host",
      description: "Middleware détectant automatiquement lequel des 15 domaines .fr (dont infoperso.fr) interroge l'API centrale pour adapter le contexte applicatif.",
      language: "typescript",
      code: `// /opt/alphabette/sso-api/src/middleware/domainRouter.ts
import { FastifyRequest, FastifyReply } from 'fastify';

const REGISTERED_DOMAINS = new Set([
  'alphabette.fr',
  'infoperso.fr',
  'orbit.alphabette.fr',
  'musique.alphabette.fr',
  'tech.alphabette.fr',
  'atelier.alphabette.fr'
]);

export async function tenantResolver(req: FastifyRequest, reply: FastifyReply) {
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(':')[0];

  if (host.endsWith('alphabette.eu')) {
    return reply.redirect(301, \`https://alphabette.fr\${req.url}\`);
  }

  if (!REGISTERED_DOMAINS.has(host)) {
    return reply.code(403).send({ error: 'Domaine non autorisé dans la fédération Alphabette' });
  }

  (req as any).tenantDomain = host;
}`
    },
    validation: {
      title: "3. Test de Validation — Redirection 301 & Certificat Let's Encrypt",
      description: "Vérification de la redirection permanente 301 depuis alphabette.eu et de la validité du certificat TLS sur infoperso.fr.",
      language: "bash",
      code: `# 1. Vérifier le code HTTP 301 Moved Permanently de alphabette.eu vers alphabette.fr
curl -I https://alphabette.eu/panthéon
# Attendu : HTTP/2 301 + location: https://alphabette.fr/panthéon

# 2. Vérifier le certificat SSL Let's Encrypt sur infoperso.fr (commandé le 5 novembre)
echo | openssl s_client -servername infoperso.fr -connect infoperso.fr:443 2>/dev/null | openssl x509 -noout -dates -issuer`
    }
  },
  {
    id: "vps-hardening",
    title: "04. Durcissement VPS OVH (Ubuntu 24.04 LTS, UFW, Fail2Ban & Secrets)",
    subtitle: "Protection réseau périmétrique, verrouillage PostgreSQL en écoute locale Docker et politique zéro secret en clair.",
    systemConfig: {
      title: "1. Configuration Système — Pare-feu UFW & Durcissement SSH",
      description: "Script d'initialisation exécuté dès la livraison du VPS OVH Ubuntu 24.04 LTS (le 5 novembre) avant l'installation de Coolify.",
      language: "bash",
      code: `#!/usr/bin/env bash
# /opt/alphabette/ops/harden_ovh_ubuntu24.sh
set -euo pipefail

apt update && apt upgrade -y
apt install -y ufw fail2ban unattended-upgrades

# Politique UFW stricte : tout bloquer en entrée sauf SSH, HTTP, HTTPS
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH Admin Clé Ed25519 uniquement'
ufw allow 80/tcp comment 'Traefik Let-s Encrypt HTTP Challenge'
ufw allow 443/tcp comment 'Traefik HTTPS / HTTP3'
ufw allow 443/udp comment 'QUIC HTTP3'
# Le port 8000 (Coolify UI) et 5432 (PostgreSQL) restent FERMÉS sur l'IP publique
ufw --force enable

# Interdiction de l'authentification par mot de passe SSH
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd`
    },
    implementation: {
      title: "2. Code d'Implémentation — Validation Stricte des Variables d'Environnement",
      description: "Validation au démarrage du conteneur : le serveur refuse de démarrer si une clé cryptographique ou l'URL PostgreSQL est absente ou faible.",
      language: "typescript",
      code: `// /opt/alphabette/sso-api/src/config/envGuard.ts
const REQUIRED_ENV = [
  'DATABASE_URL',
  'JWT_PRIVATE_KEY_PEM',
  'JWT_PUBLIC_KEY_PEM',
  'GEMINI_API_KEY',
  'COOKIE_SECRET'
] as const;

export function verifyProductionEnv(): void {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key] || process.env[key]!.length < 16);
  if (missing.length > 0) {
    console.error(\`[FATAL SECURITY] Variables d'environnement manquantes ou invalides : \${missing.join(', ')}\`);
    process.exit(1);
  }
}`
    },
    validation: {
      title: "3. Test de Validation — Scan de Ports & Isolation PostgreSQL",
      description: "Vérification que PostgreSQL (5432) est inaccessible depuis Internet tout en répondant aux conteneurs du réseau interne Coolify.",
      language: "bash",
      code: `# 1. Vérifier l'état actif du pare-feu UFW sur Ubuntu 24.04 LTS
sudo ufw status verbose

# 2. Confirmer depuis l'extérieur que le port 5432 (PostgreSQL) est filtré
nc -zv -w 3 alphabette.fr 5432
# Attendu : Connection timed out / refused (port protégé)`
    }
  }
];
