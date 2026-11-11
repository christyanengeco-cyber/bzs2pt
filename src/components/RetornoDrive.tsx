import { useEffect, useState } from "react";
import { Check, CloudUpload, X } from "lucide-react";
import { consumirPedido, enviarParaDrive, guardarToken, lerRespostaOAuth } from "@/lib/drive";
import { montarBackup } from "@/lib/salvar-backup";

type Estado = "parado" | "enviando" | "ok" | "erro";

/** Traduz os códigos do Google para algo que o usuário entenda. */
function mensagemDeErro(codigo: string): string {
  if (codigo === "access_denied") return "Envio cancelado. Nada foi salvo no Drive.";
  if (codigo === "redirect_uri_mismatch")
    return "O Google não reconhece este endereço do app. Confira o redirect URI no projeto do Drive.";
  return `O Google recusou a autorização (${codigo}).`;
}

/** Termina o envio do backup depois que o usuário volta do Google.
 *
 *  Fica na raiz porque a ida ao Google recarrega a página e fecha qualquer
 *  diálogo aberto. Na volta, o token vem no fragmento da URL (que o navegador
 *  não envia a servidor algum), o backup é montado de novo a partir do
 *  IndexedDB e sobe direto para o Drive da conta escolhida. */
export function RetornoDrive() {
  const [estado, setEstado] = useState<Estado>("parado");
  const [texto, setTexto] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [fechado, setFechado] = useState(false);

  useEffect(() => {
    const resposta = lerRespostaOAuth(window.location.hash);
    if (!resposta.token && !resposta.erro) return;

    // O token não pode ficar na barra de endereço nem no histórico.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    const esperado = consumirPedido();
    if (esperado === null) return; // fragmento de outra coisa: ignora

    if (resposta.erro) {
      setEstado("erro");
      setTexto(mensagemDeErro(resposta.erro));
      return;
    }
    if (esperado && resposta.estado && esperado !== resposta.estado) {
      setEstado("erro");
      setTexto("A resposta do Google não confere com este pedido. Tente de novo.");
      return;
    }

    const token = resposta.token;
    if (!token) return;
    guardarToken(resposta);

    setEstado("enviando");
    setTexto("Enviando o backup para o Drive…");

    (async () => {
      try {
        const pronto = await montarBackup();
        const arquivo = await enviarParaDrive(pronto, token);
        setLink(arquivo.link ?? null);
        setTexto(`Backup salvo no Drive como ${arquivo.nome}.`);
        setEstado("ok");
      } catch (erro) {
        setTexto(erro instanceof Error ? erro.message : "Não foi possível enviar o backup.");
        setEstado("erro");
      }
    })();
  }, []);

  if (estado === "parado" || fechado) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] border-b border-border bg-card/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-md items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          {estado === "ok" ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <CloudUpload className="h-4 w-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {estado === "enviando"
              ? "Enviando backup"
              : estado === "ok"
                ? "Backup no Drive"
                : "Drive"}
          </p>
          <p className="mt-0.5 text-xs break-words text-muted-foreground">{texto}</p>
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs font-semibold text-primary underline"
            >
              Abrir o backup no Drive
            </a>
          )}
        </div>
        {estado !== "enviando" && (
          <button
            type="button"
            onClick={() => setFechado(true)}
            aria-label="Fechar aviso do Drive"
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
