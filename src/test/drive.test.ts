import { afterEach, describe, expect, it, vi } from "vitest";
import { clienteValido, enviarParaDrive, lerRespostaOAuth, urlAutorizacao } from "@/lib/drive";

describe("resposta do Google", () => {
  it("lê o token e a validade devolvidos no fragmento", () => {
    const r = lerRespostaOAuth(
      "#access_token=abc123&token_type=Bearer&expires_in=3599&state=xyz",
      1_000,
    );
    expect(r.token).toBe("abc123");
    expect(r.estado).toBe("xyz");
    expect(r.validoAte).toBe(1_000 + 3_599_000);
  });

  it("entende o cancelamento do usuário", () => {
    const r = lerRespostaOAuth("#error=access_denied&state=xyz");
    expect(r.erro).toBe("access_denied");
    expect(r.token).toBeUndefined();
  });

  it("ignora âncora comum, para não reagir a link de seção", () => {
    expect(lerRespostaOAuth("#paragrafo-3")).toEqual({});
    expect(lerRespostaOAuth("")).toEqual({});
  });

  it("assume uma hora quando o Google não manda a validade", () => {
    const r = lerRespostaOAuth("#access_token=t", 0);
    expect(r.validoAte).toBe(3_600_000);
  });
});

describe("url de autorização", () => {
  const url = new URL(urlAutorizacao("https://bzs2pt.lovable.app/", "estado1"));

  it("vai para a tela de contas do Google", () => {
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  });

  it("pede só arquivos criados pelo app", () => {
    expect(url.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file");
  });

  it("volta para a raiz do site, sem barra duplicada", () => {
    expect(url.searchParams.get("redirect_uri")).toBe("https://bzs2pt.lovable.app/");
  });

  it("devolve token no fragmento e abre a escolha de conta", () => {
    expect(url.searchParams.get("response_type")).toBe("token");
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("state")).toBe("estado1");
  });
});

describe("formato do Client ID", () => {
  it("aceita o valor que o Google entrega", () => {
    expect(clienteValido("123456-abcdefg.apps.googleusercontent.com")).toBe(true);
  });

  it("recusa o texto de exemplo, para não abrir tela quebrada", () => {
    expect(clienteValido("COLE_AQUI.apps.googleusercontent.com")).toBe(false);
    expect(clienteValido("")).toBe(false);
    expect(clienteValido("123456-abc")).toBe(false);
  });
});

describe("envio para o Drive", () => {
  const backup = { conteudo: '{"app":"estudo-em-libras"}', nome: "backup.json" };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("manda metadados e conteúdo no mesmo corpo multipart", async () => {
    const fetchFalso = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "arq1", name: "backup.json" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchFalso);

    const arquivo = await enviarParaDrive(backup, "token1");

    expect(arquivo.id).toBe("arq1");
    const [url, opcoes] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("uploadType=multipart");
    expect((opcoes.headers as Record<string, string>)["Authorization"]).toBe("Bearer token1");
    expect((opcoes.headers as Record<string, string>)["Content-Type"]).toContain(
      "multipart/related",
    );
  });

  it("explica que a permissão expirou em vez de erro genérico", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );
    await expect(enviarParaDrive(backup, "velho")).rejects.toThrow(/permissão do Google expirou/);
  });

  it("não dá sucesso quando o Drive responde sem id", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    await expect(enviarParaDrive(backup, "t")).rejects.toThrow(/sem confirmar/);
  });
});
