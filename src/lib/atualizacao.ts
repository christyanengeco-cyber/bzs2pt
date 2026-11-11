import { BUILD } from "@/lib/build";

/** Endereço estável do APK mais recente.
 *
 *  O GitHub Releases guarda o binário com nome fixo, então o link aponta sempre
 *  para a última versão publicada — nada de reescrever o app a cada release.
 *  Ver .github/workflows/apk.yml (asset `estudo-em-libras.apk`). */
export const URL_APK =
  "https://github.com/christyanengeco-cyber/bzs2pt/releases/latest/download/estudo-em-libras.apk";

const CHAVE = "apk-versao-instalada";

/** Versão do APK instalado, ou `null` quando roda no navegador.
 *
 *  A página não tem como ler o versionCode do Android, então o app Android é
 *  gerado com a própria versão na startUrl (`https://.../?v=1.4.0`). Lemos esse
 *  parâmetro e guardamos na sessão porque o router limpa a query ao navegar
 *  dentro do app — sem isso o aviso sumiria depois do primeiro toque.
 *
 *  `null` significa "não é o APK": no navegador a versão carregada já é a mais
 *  recente, logo não há o que atualizar. */
export function versaoApkInstalada(): string | null {
  if (typeof window === "undefined") return null;
  const daUrl = new URLSearchParams(window.location.search).get("v");
  if (daUrl) {
    try {
      sessionStorage.setItem(CHAVE, daUrl);
    } catch {
      /* navegação privada pode bloquear o storage */
    }
    return daUrl;
  }
  try {
    return sessionStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

/** Compara versões numéricas ("1.10.2" > "1.9.9"). Devolve <0, 0 ou >0. */
export function compararVersao(a: string, b: string): number {
  const partes = (v: string) =>
    v
      .trim()
      .replace(/^v/i, "")
      .split(/[.+-]/)
      .map((n) => Number.parseInt(n, 10) || 0);
  const pa = partes(a);
  const pb = partes(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Há versão publicada mais nova que a instalada no APK? */
export function haAtualizacao(instalada: string | null): boolean {
  if (!instalada) return false;
  return compararVersao(BUILD.versao, instalada) > 0;
}

const API_RELEASES = "https://api.github.com/repos/christyanengeco-cyber/bzs2pt/releases/latest";

/** Consulta a versão publicada mais recente (botão "Verificar atualizações").
 *
 *  Prefere a API do GitHub Releases: é o dado autoritativo do APK e continua
 *  certo mesmo quando a página aberta está velha por causa do service worker.
 *  Sem rede, ou com o limite de requisições estourado, cai para BUILD.versao —
 *  que também é correto, porque o site carregado é a versão publicada. */
export async function versaoPublicada(): Promise<string> {
  try {
    const resposta = await fetch(API_RELEASES, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (resposta.ok) {
      const dados = (await resposta.json()) as { tag_name?: unknown };
      const tag = typeof dados.tag_name === "string" ? dados.tag_name.trim() : "";
      if (/^v?\d+\.\d+\.\d+$/i.test(tag)) return tag.replace(/^v/i, "");
    }
  } catch {
    /* offline, bloqueio de CORS ou limite da API: usa a versão do site */
  }
  return BUILD.versao;
}
