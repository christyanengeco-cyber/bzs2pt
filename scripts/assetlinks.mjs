// Grava public/.well-known/assetlinks.json com a digital SHA-256 do certificado
// que assina o APK.
//
// Por que isso existe: sem esse arquivo no domínio, o Chrome não confia no
// aplicativo e o TWA abre com a barra de endereço visível — parece "só um site
// dentro de um app". A digital muda se o keystore mudar, então o workflow
// recalcula a cada build e commita quando o valor for diferente.
//
// Uso: node scripts/assetlinks.mjs "AA:BB:CC:..."
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SITE = "https://bzs2pt.lovable.app";
const PACOTE = "br.com.estudoemlibras.app";
const DESTINO = resolve("public/.well-known/assetlinks.json");

const bruto = (process.argv[2] ?? "").trim();

// Aceita com ou sem dois-pontos: o keytool imprime "AA:BB:…", o apksigner
// imprime "aabb…". Normalizar aqui evita depender de sed/tr no workflow.
const hex = bruto.replace(/[^0-9a-fA-F]/g, "").toUpperCase();

if (hex.length !== 64) {
  console.error(`Digital SHA-256 inválida: "${bruto}"`);
  console.error("Esperado 64 dígitos hexadecimais (com ou sem dois-pontos).");
  process.exit(1);
}

const digital = hex.match(/../g).join(":");

const conteudo = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: PACOTE,
      sha256_cert_fingerprints: [digital],
    },
  },
];

mkdirSync(dirname(DESTINO), { recursive: true });
writeFileSync(DESTINO, `${JSON.stringify(conteudo, null, 2)}\n`);
console.log(`assetlinks.json atualizado para ${SITE} (${PACOTE})`);
