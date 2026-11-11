import type { BackupPronto } from "@/lib/salvar-backup";

/** Client ID do projeto no Google Cloud (tipo "Aplicativo da Web").
 *
 *  Não é segredo: o próprio Google exige que ele vá no HTML da página. Serve só
 *  para identificar este app no fluxo de autorização. Enquanto estiver com o
 *  valor de exemplo, o app cai no caminho antigo (compartilhar ou baixar) em vez
 *  de abrir uma tela quebrada. Ver docs/DRIVE.md para criar o seu. */
export const CLIENTE_DRIVE = "COLE_AQUI.apps.googleusercontent.com";

/** Valor de exemplo: enquanto estiver aqui, o Drive automático fica desligado. */
const CLIENTE_DE_EXEMPLO = "COLE_AQUI.apps.googleusercontent.com";

/** Só os arquivos que este app criou. O app nunca vê o resto do Drive. */
export const ESCOPO_DRIVE = "https://www.googleapis.com/auth/drive.file";

/** Marca que o usuário saiu daqui para autorizar o Drive. */
export const CHAVE_PEDIDO = "drive-pedido";
/** Token de acesso, válido por ~1 hora. Fica na sessão, não no disco. */
export const CHAVE_TOKEN = "drive-token";
/** Valor aleatório que vai e volta na URL para confirmar que a resposta é nossa. */
export const CHAVE_ESTADO = "drive-estado";

export interface TokenDrive {
  token: string;
  /** Instante (ms) em que o token deixa de valer. */
  expira: number;
}

/** Confere o formato do Client ID sem depender do valor configurado. */
export function clienteValido(id: string): boolean {
  if (id === CLIENTE_DE_EXEMPLO) return false;
  return /^[\w-]+\.apps\.googleusercontent\.com$/.test(id);
}

export function driveConfigurado(): boolean {
  return clienteValido(CLIENTE_DRIVE);
}

/** URL da tela do Google: aqui aparece a lista de contas Gmail do aparelho.
 *
 *  Fluxo implícito (`response_type=token`) porque é o único que funciona sem
 *  servidor: nosso "servidor" é o próprio aparelho e não existe client secret
 *  guardável. O Google devolve o token no fragmento (#) da URL de volta, que o
 *  navegador não manda para nenhum servidor — nada vaza em log.
 *
 *  `prompt=select_account` é intencional: sem ele o Google pula direto para a
 *  conta que já está logada, e o pedido era justamente poder escolher. */
export function urlAutorizacao(origem: string, estado: string): string {
  const partes = new URLSearchParams({
    client_id: CLIENTE_DRIVE,
    redirect_uri: `${origem.replace(/\/+$/, "")}/`,
    response_type: "token",
    scope: ESCOPO_DRIVE,
    include_granted_scopes: "true",
    prompt: "select_account",
    state: estado,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${partes.toString()}`;
}

export interface RespostaOAuth {
  token?: string;
  validoAte?: number;
  erro?: string;
  estado?: string | undefined;
}

/** Lê o que o Google devolveu no fragmento da URL.
 *
 *  Aceita `#access_token=…` (deu certo) e `#error=…` (usuário recusou ou a
 *  configuração está errada). Devolve vazio quando o fragmento não tem nada a
 *  ver com OAuth, para o app não reagir a âncoras comuns. */
export function lerRespostaOAuth(fragmento: string, agora = Date.now()): RespostaOAuth {
  const limpo = fragmento.replace(/^#/, "");
  if (!limpo) return {};
  const campos = new URLSearchParams(limpo);
  const estado = campos.get("state") ?? undefined;
  const erro = campos.get("error");
  if (erro) return { erro, estado };
  const token = campos.get("access_token");
  if (!token) return {};
  const segundos = Number(campos.get("expires_in"));
  const validade = Number.isFinite(segundos) && segundos > 0 ? segundos : 3600;
  return { token, validoAte: agora + validade * 1000, estado };
}

/** Começa o envio: marca o pedido e devolve a URL do Google.
 *
 *  O pedido vai para o sessionStorage porque a navegação para o Google destrói
 *  o estado do React. Quando o usuário volta, `consumirPedido` diz se aquela
 *  resposta é de um clique nosso ou de uma página aberta do nada. */
export function iniciarAutorizacao(origem: string, agora = Date.now()): string {
  const estado = `${Math.random().toString(36).slice(2)}${agora.toString(36)}`;
  try {
    sessionStorage.setItem(CHAVE_PEDIDO, "1");
    sessionStorage.setItem(CHAVE_ESTADO, estado);
  } catch {
    /* sem storage ainda dá para autorizar; o retorno é que não será reconhecido */
  }
  return urlAutorizacao(origem, estado);
}

/** Estado esperado do pedido em andamento, e já limpa a marca. */
export function consumirPedido(): string | null {
  try {
    const pedido = sessionStorage.getItem(CHAVE_PEDIDO);
    const estado = sessionStorage.getItem(CHAVE_ESTADO);
    sessionStorage.removeItem(CHAVE_PEDIDO);
    sessionStorage.removeItem(CHAVE_ESTADO);
    return pedido ? estado : null;
  } catch {
    return null;
  }
}

/** Token guardado nesta sessão do navegador, se ainda vale.
 *
 *  sessionStorage e não localStorage: o token morre ao fechar o app e não fica
 *  em backup nem em outro aparelho. */
export function lerTokenGuardado(agora = Date.now()): string | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_TOKEN);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as TokenDrive;
    if (!dados?.token || dados.expira <= agora) return null;
    return dados.token;
  } catch {
    return null;
  }
}

export function guardarToken(resposta: RespostaOAuth, agora = Date.now()): void {
  if (!resposta.token) return;
  try {
    const dados: TokenDrive = {
      token: resposta.token,
      expira: resposta.validoAte ?? agora + 3600 * 1000,
    };
    sessionStorage.setItem(CHAVE_TOKEN, JSON.stringify(dados));
  } catch {
    /* navegação privada pode bloquear o storage: o envio ainda funciona agora */
  }
}

export interface ArquivoNoDrive {
  id: string;
  nome: string;
  link?: string | undefined;
}

/** Sobe o backup para o Drive da conta escolhida.
 *
 *  `multipart/related` porque o Google exige metadados e conteúdo no mesmo
 *  corpo; `FormData` não serve (o Drive quer `multipart/related`, não
 *  `form-data`). O arquivo vai direto do aparelho para o Google: nenhum
 *  servidor nosso no meio. */
export async function enviarParaDrive(
  backup: BackupPronto,
  token: string,
): Promise<ArquivoNoDrive> {
  const limite = `estudo-em-libras-${Date.now().toString(36)}`;
  const metadados = JSON.stringify({ name: backup.nome, mimeType: "application/json" });
  const corpo = new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadados}\r\n`,
    `--${limite}\r\nContent-Type: application/json\r\n\r\n${backup.conteudo}\r\n`,
    `--${limite}--`,
  ]);

  const resposta = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${limite}`,
      },
      body: corpo,
    },
  );

  if (resposta.status === 401 || resposta.status === 403) {
    throw new Error("A permissão do Google expirou. Toque em “Salvar no Drive” de novo.");
  }
  if (!resposta.ok) {
    throw new Error(`O Drive recusou o envio (erro ${resposta.status}).`);
  }

  const dados = (await resposta.json()) as { id?: string; name?: string; webViewLink?: string };
  if (!dados.id) throw new Error("O Drive respondeu sem confirmar o arquivo.");
  return { id: dados.id, nome: dados.name ?? backup.nome, link: dados.webViewLink };
}

/** Link direto para a pasta raiz do Drive, usado quando o envio automático
 *  falha por configuração (Client ID ausente ou recusado). */
export const URL_DRIVE = "https://drive.google.com/drive/my-drive";
