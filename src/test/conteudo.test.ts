import { describe, expect, it } from "vitest";
import { CONTEUDO_RE } from "@/lib/conteudo";
import { respostaUtil } from "@/lib/parser";

/** Amostras calibradas (DIRETRIZES nº 7): cada classe testada contra a regex.
 *  A regressão corrigida aqui é a da checagem de tamanho — artigos curtos
 *  (<20 KB) com conteúdo real eram descartados como "bloqueio". */

// Artigo curto da apostila: corpo pequeno, mas com os marcadores reais.
const ARTIGO_CURTO = `<!doctype html><html><head><title>Como ser amigo de Deus</title></head>
<body><article><div class="bodyTxt"><p>Parágrafo 1 do artigo curto.</p><p>Parágrafo 2.</p></div></article></body></html>`;

// Página de referência pequena (dicionário/guia): <main com data-docid.
const PAGINA_REFERENCIA = `<!doctype html><html><head><title>Referência</title></head>
<body><main data-docid="102913177"><p>Entrada pequena de referência.</p></main></body></html>`;

// Página real embute o script do WAF no <head> (regressão b4ce756): só é
// desafio quando NÃO há conteúdo real na página.
const REAL_COM_SCRIPT_WAF = `<!doctype html><html><head><script src="https://d1t8s2y7x9.cloudfront.net/challenge.js"></script></head>
<body><div class="docSubContent"><p>Artigo real com o script do WAF no head.</p></div></body></html>`;

// Corpo-desafio de verdade: script do WAF e nenhum elemento do jw.org.
const DESAFIO_SEM_CONTEUDO =
  '<!DOCTYPE html><html><head><script src="https://d1t8s2y7x9.cloudfront.net/challenge.js"></script></head><body>window.awswaf = true;</body></html>';

describe("CONTEUDO_RE — sinal positivo de conteúdo do jw.org", () => {
  it("reconhece artigo curto, página de referência e página real com script do WAF no head", () => {
    expect(CONTEUDO_RE.test(ARTIGO_CURTO)).toBe(true);
    expect(CONTEUDO_RE.test(PAGINA_REFERENCIA)).toBe(true);
    expect(CONTEUDO_RE.test(REAL_COM_SCRIPT_WAF)).toBe(true);
  });

  it("não reconhece corpo-desafio sem elemento real do jw.org", () => {
    expect(CONTEUDO_RE.test(DESAFIO_SEM_CONTEUDO)).toBe(false);
  });
});

describe("respostaUtil aceita conteúdo real independente do tamanho", () => {
  it("aceita artigo curto da apostila (<20 KB) com bodyTxt", () => {
    expect(respostaUtil(ARTIGO_CURTO)).toBe(true);
  });

  it("aceita página de referência pequena com data-docid", () => {
    expect(respostaUtil(PAGINA_REFERENCIA)).toBe(true);
  });

  it("aceita página real que embute o script do WAF no head", () => {
    expect(respostaUtil(REAL_COM_SCRIPT_WAF)).toBe(true);
  });

  it("rejeita desafio do WAF sem conteúdo real", () => {
    expect(respostaUtil(DESAFIO_SEM_CONTEUDO)).toBe(false);
  });
});
