import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Publicacao } from "@/lib/db";

const atualizarPublicacao = vi.hoisted(() => vi.fn());
const getPublicacao = vi.hoisted(() => vi.fn());
const verificarMidia = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ atualizarPublicacao, getPublicacao }));
vi.mock("@/lib/fetch-page.functions", () => ({ verificarMidia }));

import {
  QUALIDADE_BAIXA_RE,
  candidatosDeRecuperacao,
  recuperarVideoSalvo,
  reescreverQualidade,
} from "@/lib/recuperacao-video";

const estudo = (video_url: string): Publicacao => ({
  id: "est-1",
  tipo: "apostila",
  titulo: "Apostila de estudo",
  semana: "11–17 de novembro",
  url_origem: "https://www.jw.org/bzs/biblioteca/apostilas/mwb-Un-202646/",
  video_url,
  criado_em: 1,
});

beforeEach(() => {
  atualizarPublicacao.mockReset();
  getPublicacao.mockReset();
  verificarMidia.mockReset();
  // Padrão: o registro no banco é o mesmo snapshot do teste.
  getPublicacao.mockImplementation(async (id: string) => (id === "est-1" ? undefined : undefined));
});

describe("reescreverQualidade mantém o formato do arquivo do CDN", () => {
  it("reescreve o sufixo real com P maiúsculo e prefixo r", () => {
    expect(
      reescreverQualidade(
        "https://assets.jw-cdn.org/pub-mwbv/v/mwbv_BZS_202611_f1_r240P.mp4",
        "720P",
      ),
    ).toBe("https://assets.jw-cdn.org/pub-mwbv/v/mwbv_BZS_202611_f1_r720P.mp4");
  });

  it("reescreve sufixo minúsculo sem prefixo r e preserva query", () => {
    expect(reescreverQualidade("https://assets.jw-cdn.org/v/aula_240p.mp4?t=5", "720P")).toBe(
      "https://assets.jw-cdn.org/v/aula_720P.mp4?t=5",
    );
  });
});

describe("QUALIDADE_BAIXA_RE reconhece só as variantes do relato", () => {
  it("marca 240p/360p em qualquer escrita", () => {
    expect(QUALIDADE_BAIXA_RE.test("https://x/v/a_r240P.mp4")).toBe(true);
    expect(QUALIDADE_BAIXA_RE.test("https://x/v/a_r360P.mp4")).toBe(true);
    expect(QUALIDADE_BAIXA_RE.test("https://x/v/a_240p.mp4")).toBe(true);
    expect(QUALIDADE_BAIXA_RE.test("https://x/v/a_r360p.mp4?origem=app")).toBe(true);
  });

  it("não marca 480p/720p/1080p nem arquivo sem sufixo", () => {
    expect(QUALIDADE_BAIXA_RE.test("https://x/v/a_r720P.mp4")).toBe(false);
    expect(QUALIDADE_BAIXA_RE.test("https://x/v/a_r480P.mp4")).toBe(false);
    expect(QUALIDADE_BAIXA_RE.test("https://x/v/a_r1080P.mp4")).toBe(false);
    expect(QUALIDADE_BAIXA_RE.test("https://x/v/a_completo.mp4")).toBe(false);
  });
});

describe("candidatosDeRecuperacao vai de 720P a 480P sem repetir o atual", () => {
  it("720P primeiro, 480P como cobertura", () => {
    expect(candidatosDeRecuperacao("https://assets.jw-cdn.org/v/a_r240P.mp4")).toEqual([
      "https://assets.jw-cdn.org/v/a_r720P.mp4",
      "https://assets.jw-cdn.org/v/a_r480P.mp4",
    ]);
  });

  it("estudo já em 480P só ganha o 720P como candidato", () => {
    expect(candidatosDeRecuperacao("https://assets.jw-cdn.org/v/a_r480P.mp4")).toEqual([
      "https://assets.jw-cdn.org/v/a_r720P.mp4",
    ]);
  });
});

describe("recuperarVideoSalvo atualiza o estudo sem reimportar", () => {
  it("confirma o 720P no CDN e grava no banco", async () => {
    verificarMidia.mockResolvedValueOnce({ ok: true, status: 200 });
    const nova = await recuperarVideoSalvo(estudo("https://x/v/a_r240P.mp4"));
    expect(nova).toBe("https://x/v/a_r720P.mp4");
    expect(atualizarPublicacao).toHaveBeenCalledWith(
      expect.objectContaining({ id: "est-1", video_url: "https://x/v/a_r720P.mp4" }),
    );
    expect(verificarMidia).toHaveBeenCalledTimes(1);
  });

  it("720P inexistente (404) cai para o 480P", async () => {
    verificarMidia
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const nova = await recuperarVideoSalvo(estudo("https://x/v/a_r360P.mp4"));
    expect(nova).toBe("https://x/v/a_r480P.mp4");
    expect(atualizarPublicacao).toHaveBeenCalledWith(
      expect.objectContaining({ video_url: "https://x/v/a_r480P.mp4" }),
    );
  });

  it("sem confirmação conclusiva, não troca e não grava nada", async () => {
    verificarMidia.mockResolvedValue({ ok: false, inconclusivo: true, motivo: "HTTP 403" });
    const nova = await recuperarVideoSalvo(estudo("https://x/v/a_r240P.mp4"));
    expect(nova).toBeUndefined();
    expect(atualizarPublicacao).not.toHaveBeenCalled();
    expect(verificarMidia).toHaveBeenCalledTimes(2);
  });

  it("erro do servidor (ex.: validador) é tratado como inconclusivo", async () => {
    verificarMidia.mockRejectedValue(new Error("Apenas links do jw.org são permitidos."));
    const nova = await recuperarVideoSalvo(estudo("https://x/v/a_r240P.mp4"));
    expect(nova).toBeUndefined();
    expect(atualizarPublicacao).not.toHaveBeenCalled();
  });

  it("estudo já em 720P não dispara sonda nenhuma", async () => {
    const nova = await recuperarVideoSalvo(estudo("https://x/v/a_r720P.mp4"));
    expect(nova).toBeUndefined();
    expect(verificarMidia).not.toHaveBeenCalled();
    expect(atualizarPublicacao).not.toHaveBeenCalled();
  });

  it("reimportação que chegou primeiro já resolveu: não faz nada", async () => {
    getPublicacao.mockResolvedValueOnce(estudo("https://x/v/a_r720P.mp4"));
    const nova = await recuperarVideoSalvo(estudo("https://x/v/a_r240P.mp4"));
    expect(nova).toBeUndefined();
    expect(verificarMidia).not.toHaveBeenCalled();
    expect(atualizarPublicacao).not.toHaveBeenCalled();
  });

  it("grava por cima do registro fresco do banco, não do snapshot", async () => {
    const fresco = {
      ...estudo("https://x/v/a_r240P.mp4"),
      titulo: "Título atualizado pela reimportação",
    };
    getPublicacao.mockResolvedValueOnce(fresco);
    verificarMidia.mockResolvedValueOnce({ ok: true, status: 200 });
    await recuperarVideoSalvo(estudo("https://x/v/a_r240P.mp4"));
    expect(atualizarPublicacao).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: "Título atualizado pela reimportação" }),
    );
  });

  it("estudo sem vídeo ou sem sufixo de qualidade fica em paz", async () => {
    expect(await recuperarVideoSalvo(estudo(""))).toBeUndefined();
    expect(await recuperarVideoSalvo(estudo("https://x/v/a_completo.mp4"))).toBeUndefined();
    expect(verificarMidia).not.toHaveBeenCalled();
  });
});
