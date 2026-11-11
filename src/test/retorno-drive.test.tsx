import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RetornoDrive } from "@/components/RetornoDrive";
import { CHAVE_ESTADO, CHAVE_PEDIDO, CHAVE_TOKEN } from "@/lib/drive";

vi.mock("@/lib/salvar-backup", () => ({
  montarBackup: vi.fn(async () => ({
    conteudo: '{"app":"estudo-em-libras"}',
    nome: "backup.json",
  })),
}));

function pedir(estado: string) {
  sessionStorage.setItem(CHAVE_PEDIDO, "1");
  sessionStorage.setItem(CHAVE_ESTADO, estado);
}

describe("volta do Google para salvar no Drive", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("envia o backup e mostra o link do arquivo", async () => {
    pedir("xyz");
    const fetchFalso = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            id: "arq1",
            name: "backup.json",
            webViewLink: "https://drive.google.com/file/d/arq1/view",
          }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchFalso);
    window.history.replaceState(null, "", "/#access_token=tok&expires_in=3600&state=xyz");

    render(<RetornoDrive />);

    await waitFor(() => expect(screen.getByText(/Backup salvo no Drive/)).toBeInTheDocument());
    expect(screen.getByText("Abrir o backup no Drive")).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/arq1/view",
    );
    // O token nunca pode ficar na barra de endereço.
    expect(window.location.hash).toBe("");
    expect(sessionStorage.getItem(CHAVE_TOKEN)).toContain("tok");
  });

  it("não deixa o token na URL quando o usuário cancela", async () => {
    pedir("xyz");
    vi.stubGlobal("fetch", vi.fn());
    window.history.replaceState(null, "", "/#error=access_denied&state=xyz");

    render(<RetornoDrive />);

    await waitFor(() => expect(screen.getByText(/Envio cancelado/)).toBeInTheDocument());
    expect(window.location.hash).toBe("");
  });

  it("ignora fragmento sem pedido, para não mostrar aviso do nada", async () => {
    window.history.replaceState(null, "", "/#access_token=tok&state=outro");

    const { container } = render(<RetornoDrive />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("recusa resposta com state diferente do pedido", async () => {
    pedir("esperado");
    vi.stubGlobal("fetch", vi.fn());
    window.history.replaceState(null, "", "/#access_token=tok&state=outro");

    render(<RetornoDrive />);

    await waitFor(() => expect(screen.getByText(/não confere/)).toBeInTheDocument());
  });
});
