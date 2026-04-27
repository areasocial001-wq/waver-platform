#!/usr/bin/env node
/**
 * Guardrail di coerenza: fallisce se nel frontend restano residui di
 * pricing / abbonamenti / commercializzazione.
 *
 * Lanciato automaticamente come parte della build via vite-plugin
 * (vite.config.ts → noCommercialGuardPlugin) e invocabile a mano:
 *   node scripts/check-no-commercial.mjs
 *
 * Exit code 0 = pulito · Exit code 1 = violazioni trovate
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

// ─────────────────────────────────────────────────────────────────────────────
// Pattern bloccanti — categorie distinte per messaggi chiari
// ─────────────────────────────────────────────────────────────────────────────
const RULES = [
  // 1) Stringhe UI commerciali visibili agli utenti
  {
    id: "ui-pricing-string",
    label: "Stringa UI commerciale",
    // €N,NN/mese — €N/mo — al mese — Vedi i Piani — Sblocca con — Upgrade a — Piano Free/Premium/Creator/Business
    re: /(€\s?\d+([.,]\d+)?\s*\/\s*(mese|mo|month))|(\bal\s+mese\b)|(\bvedi\s+i\s+piani\b)|(\bsblocca\s+con\b)|(\bupgrade\s+a\b)|(\bpiano\s+(free|premium|creator|business)\b)|(\bsubscribe\s+now\b)/i,
  },
  // 2) Import di moduli/route commerciali rimossi
  {
    id: "removed-commercial-import",
    label: "Import a modulo commerciale rimosso",
    re: /from\s+['"]@\/pages\/Pricing['"]|from\s+['"]@\/components\/ProviderPriceComparison['"]|from\s+['"]@\/components\/ProjectCostEstimator['"]|to=\{?['"]\/pricing['"]/,
  },
  // 3) Stripe / checkout / customer portal nel frontend
  {
    id: "stripe-frontend",
    label: "Riferimento Stripe nel frontend",
    re: /\bSTRIPE_TIERS\b|\bprice_id_(monthly|yearly)\b|\bstartCheckout\b|\bopenCustomerPortal\b|\bcreate-checkout\b|\bcustomer-portal\b|\bstripe-webhook\b|\bSTRIPE_(SECRET|PUBLISHABLE)_KEY\b/,
  },
  // 4) Parole chiave generiche commerciali (premium / upgrade / checkout / abbonamento)
  //    NB: applicate solo dopo i filtri di allowlist sotto, per evitare falsi
  //    positivi su label tecniche legittime (ruoli DB, asset Freepik, qualità
  //    video provider).
  {
    id: "generic-commercial-keyword",
    label: "Parola chiave commerciale (premium/upgrade/checkout/abbonamento)",
    re: /\b(premium|upgrade|checkout|abbonament[oi])\b/i,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Allowlist — solo per la regola "generic-commercial-keyword".
// Sono usi tecnici legittimi che NON hanno significato commerciale.
// ─────────────────────────────────────────────────────────────────────────────
const FILE_ALLOWLIST_GENERIC = new Set([
  // Auto-generato dal DB Supabase: contiene l'enum app_role con "premium"
  "src/integrations/supabase/types.ts",
  // Tipo TS allineato all'enum DB app_role
  "src/hooks/useUserRole.ts",
  // Stub passthrough mantenuto per non spaccare gli import esistenti
  "src/components/PremiumGate.tsx",
  // Hook stub no-op (mantiene API surface)
  "src/hooks/useSubscription.ts",
  // Lo script stesso
  "scripts/check-no-commercial.mjs",
]);

// Path-prefix allowlist: pannelli admin per gestione interna ruoli DB
const PATH_PREFIX_ALLOWLIST_GENERIC = [
  "src/pages/AdminDashboard.tsx",
  "src/components/admin/",
];

// Pattern di riga allowlist per la sola "generic-commercial-keyword".
// Se la riga matcha uno di questi, NON viene segnalata.
const LINE_ALLOWLIST_GENERIC = [
  // Asset Freepik / stock library di terze parti, label esterna
  /licenses\?\.some.*type\s*===\s*["']premium["']/i,
  /item\?\.premium\s*===/i,
  /asset\s+premium/i,
  /["']premium["']\s*:/, // chiavi di config tipo {premium: 1}
  /SelectItem\s+value=["']premium["']/i,
  /Badge[^>]*>\s*Premium\s*</i,
  // Realtime / Supabase auth: non commerciale
  /onAuthStateChange/i,
  /\.unsubscribe\(\)/,
  /subscription status/i,
  /Notification\s+subscription/i,
];

// File/dir esclusi globalmente
const GLOBAL_EXCLUDES = [
  "node_modules",
  "dist",
  "build",
  ".git",
  ".next",
  "coverage",
];

// Estensioni da scansionare
const SCAN_EXT = /\.(ts|tsx|js|jsx|html|css)$/i;

// ─────────────────────────────────────────────────────────────────────────────
// Walk filesystem
// ─────────────────────────────────────────────────────────────────────────────
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (GLOBAL_EXCLUDES.includes(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (SCAN_EXT.test(entry)) yield full;
  }
}

function relPath(p) {
  return relative(ROOT, p).split(sep).join("/");
}

function isAllowedForGeneric(rel, line) {
  if (FILE_ALLOWLIST_GENERIC.has(rel)) return true;
  if (PATH_PREFIX_ALLOWLIST_GENERIC.some((p) => rel.startsWith(p))) return true;
  if (LINE_ALLOWLIST_GENERIC.some((re) => re.test(line))) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────
const violations = [];

for (const file of walk(SRC)) {
  const rel = relPath(file);
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Ignora linee di commento puro che documentano la rimozione
    const trimmed = line.trim();
    const isPureComment =
      trimmed.startsWith("//") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("/*");

    for (const rule of RULES) {
      if (!rule.re.test(line)) continue;

      // Ignora commenti "Commercial features removed" e simili nei file allowlist
      if (
        rule.id === "generic-commercial-keyword" &&
        isPureComment &&
        /removed|stub|passthrough|allowlist|deprecat/i.test(line)
      ) {
        continue;
      }

      if (
        rule.id === "generic-commercial-keyword" &&
        isAllowedForGeneric(rel, line)
      ) {
        continue;
      }

      violations.push({
        file: rel,
        line: i + 1,
        rule: rule.id,
        label: rule.label,
        snippet: line.trim().slice(0, 160),
      });
    }
  }
}

if (violations.length === 0) {
  console.log("✅ no-commercial guardrail: 0 violazioni.");
  process.exit(0);
}

// Output leggibile
console.error(
  `\n❌ no-commercial guardrail: ${violations.length} violazion${
    violations.length === 1 ? "e" : "i"
  } trovat${violations.length === 1 ? "a" : "e"}.\n`
);

const byRule = violations.reduce((acc, v) => {
  (acc[v.rule] ??= []).push(v);
  return acc;
}, {});

for (const [ruleId, list] of Object.entries(byRule)) {
  console.error(`── [${ruleId}] ${list[0].label} (${list.length})`);
  for (const v of list.slice(0, 50)) {
    console.error(`  ${v.file}:${v.line}  ${v.snippet}`);
  }
  if (list.length > 50) {
    console.error(`  …+${list.length - 50} altre`);
  }
  console.error("");
}

console.error(
  "Rimuovi i riferimenti commerciali residui o aggiorna l'allowlist in scripts/check-no-commercial.mjs se l'uso è davvero tecnico.\n"
);
process.exit(1);
