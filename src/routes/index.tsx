import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  Clock3,
  DatabaseBackup,
  FileUp,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  excluirPublicacao,
  listarPublicacoes,
  salvarPublicacao,
  type Publicacao,
  type TipoPub,
} from "@/lib/db";
import {
  decodificarPaginaSalva,
  importarHtml,
  importarUrl,
  listarArtigos,
  type ArtigoRevista,
} from "@/lib/parser";
import {
  escolherSemanaInicial,
  hojeIso,
  intervaloDaPublicacao,
  ordenarSemanasCronologicamente,
} from "@/lib/study-dates";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackupDialog } from "@/components/BackupDialog";
import { Button } from "@/components/ui/button";
import { BUILD, ROTULO_BUILD } from "@/lib/build";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Biblioteca — Estudo em Libras" },
      {
        name: "description",
        content: "Importe matérias do jw.org em Libras e estude com vídeo sincronizado ao texto.",
      },
      { property: "og:title", content: "Biblioteca — Estudo em Libras" },
      {
        property: "og:description",
        content: "Estudo pessoal bilíngue Libras / Português, offline no seu celular.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Biblioteca,
});

type Aba = "estudo" | "extras";

const ABAS: { id: Aba; nome: string }[] = [
  { id: "estudo", nome: "Estudo" },
  { id: "extras", nome: "Extras" },
];

type Semana = {
  chave: string;
  estudos: Publicacao[];
  intervalo: { inicio: string; fim: string } | null;
};

const chaveSemana = (p: Publicacao) => intervaloDaPublicacao(p)?.inicio ?? `texto:${p.semana}`;
const ordenarPorTitulo = (a: Publicacao, b: Publicacao) =>
  a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true, sensitivity: "base" }) ||
  b.criado_em - a.criado_em;

/** Cápsula da aba Estudo: um estudo da semana (meio de semana ou fim de semana).
 *  Sem publicação, mostra o estado vazio nomeado — nunca um bloco mudo. */
function CapsulaEstudo({
  reuniao,
  pub,
  aoExcluir,
}: {
  reuniao: "meio de semana" | "fim de semana";
  pub?: Publicacao;
  aoExcluir: (p: Publicacao) => void;
}) {
  if (!pub)
    return (
      <div className="rounded-lg border border-dashed px-4 py-6 text-center">
        <BookOpen className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
        <p className="text-sm font-medium text-muted-foreground">
          Não possui o estudo de {reuniao}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {reuniao === "meio de semana"
            ? "Importe a apostila Vida e Ministério desta semana."
            : "Importe a Sentinela desta semana."}
        </p>
      </div>
    );
  const cor = reuniao === "meio de semana" ? "var(--sec-tesouros)" : "var(--reference)";
  return (
    <div className="flex items-stretch rounded-lg bg-card px-3">
      <Link
        to="/estudo/$id"
        params={{ id: pub.id }}
        className="flex min-w-0 flex-1 items-center gap-3 py-4 pr-2"
      >
        <span
          className="grid h-16 w-12 shrink-0 place-items-center rounded-md"
          style={{ background: `color-mix(in srgb, ${cor} 16%, transparent)`, color: cor }}
          aria-hidden="true"
        >
          <BookOpen className="h-6 w-6" />
        </span>
        <span className="min-w-0">
          <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {reuniao === "meio de semana"
              ? "Reunião de meio de semana"
              : "Reunião de fim de semana"}
          </span>
          <span className="block text-lg font-semibold leading-snug">{pub.titulo}</span>
        </span>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Excluir ${pub.titulo}`}
        className="my-auto text-muted-foreground hover:text-destructive"
        onClick={() => aoExcluir(pub)}
      >
        <Trash2 />
      </Button>
    </div>
  );
}

function Biblioteca() {
  const [pubs, setPubs] = useState<Publicacao[]>([]);
  const [aba, setAba] = useState<Aba>("estudo");
  const [aberto, setAberto] = useState(false);
  const [backup, setBackup] = useState(false);
  const semanaAtiva = useRef<HTMLButtonElement>(null);
  const [selecionadas, setSelecionadas] = useState<Partial<Record<Aba, string>>>({});
  const recarregar = () => listarPublicacoes().then(setPubs);
  useEffect(() => {
    recarregar();
  }, []);

  const daAba = useMemo(
    () =>
      pubs
        .filter((p) =>
          aba === "extras" ? p.tipo === "extras" : p.tipo === "apostila" || p.tipo === "sentinela",
        )
        .sort(aba === "extras" ? ordenarPorTitulo : ordenarSemanasCronologicamente),
    [pubs, aba],
  );
  // Agrupa por semana: meio de semana e fim de semana da mesma semana ficam juntos
  // (intervalos que se sobrepõem ou texto de semana idêntico), espelhando a aba
  // Reuniões do JW Library. Quem não tem data fica em grupo próprio.
  const semanas = useMemo<Semana[]>(() => {
    if (aba === "extras") return []; // Extras não usa seletor de semanas
    const grupos: Semana[] = [];
    for (const p of daAba) {
      const iv = intervaloDaPublicacao(p);
      const alvo = grupos.find(
        (g) =>
          g.estudos.some((e) => e.semana === p.semana) ||
          (iv && g.intervalo && g.intervalo.inicio <= iv.fim && g.intervalo.fim >= iv.inicio),
      );
      if (alvo) {
        alvo.estudos.push(p);
        if (iv && !alvo.intervalo) {
          alvo.intervalo = iv;
          alvo.chave = iv.inicio;
        }
      } else {
        grupos.push({ chave: chaveSemana(p), estudos: [p], intervalo: iv });
      }
    }
    return grupos;
  }, [daAba, aba]);

  const escolhaPadrao = aba === "extras" ? null : escolherSemanaInicial(daAba);
  const publicacaoPadrao = escolhaPadrao ? daAba.find((p) => p.id === escolhaPadrao.id) : undefined;
  const chavePadrao = publicacaoPadrao ? chaveSemana(publicacaoPadrao) : undefined;
  const chaveSelecionada = semanas.some((s) => s.chave === selecionadas[aba])
    ? selecionadas[aba]
    : chavePadrao;
  const semanaSelecionada = semanas.find((s) => s.chave === chaveSelecionada);
  const atual = semanaSelecionada?.intervalo
    ? semanaSelecionada.intervalo.inicio <= hojeIso() &&
      semanaSelecionada.intervalo.fim >= hojeIso()
    : false;
  const meiosDaSemana = (semanaSelecionada?.estudos ?? []).filter((p) => p.tipo === "apostila");
  const finsDaSemana = (semanaSelecionada?.estudos ?? []).filter((p) => p.tipo === "sentinela");
  const excluirEstudo = async (p: Publicacao) => {
    if (confirm(`Excluir “${p.titulo}”?`)) {
      await excluirPublicacao(p.id);
      recarregar();
    }
  };
  useEffect(() => {
    semanaAtiva.current?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [aba, chaveSelecionada]);

  return (
    <main className="mx-auto min-h-screen max-w-2xl pb-8">
      <header className="flex items-center justify-between border-b bg-card px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-xs font-semibold text-primary">Libras · Português</p>
          <h1 className="text-2xl font-bold">Meus estudos</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Backup e restauração"
            onClick={() => setBackup(true)}
          >
            <DatabaseBackup />
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div
        className="grid grid-cols-2 border-b bg-card px-4 pt-2"
        role="tablist"
        aria-label="Publicação"
      >
        {ABAS.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            role="tab"
            aria-selected={aba === item.id}
            onClick={() => setAba(item.id)}
            className={`h-11 rounded-none border-b-2 px-2 text-sm font-semibold shadow-none transition hover:bg-transparent ${aba === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
          >
            {item.nome}
          </Button>
        ))}
      </div>

      {semanas.length > 0 && (
        <section className="border-b py-3" aria-label="Semanas disponíveis">
          <div className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-4">
            {semanas.map((grupo) => {
              const estaAtual = Boolean(
                grupo.intervalo &&
                grupo.intervalo.inicio <= hojeIso() &&
                grupo.intervalo.fim >= hojeIso(),
              );
              return (
                <Button
                  key={grupo.chave}
                  ref={grupo.chave === chaveSelecionada ? semanaAtiva : undefined}
                  variant="outline"
                  onClick={() => setSelecionadas((s) => ({ ...s, [aba]: grupo.chave }))}
                  aria-pressed={grupo.chave === chaveSelecionada}
                  className={`h-auto min-w-[9rem] snap-center justify-start rounded-md px-3 py-2 text-left shadow-none transition ${grupo.chave === chaveSelecionada ? "border-primary bg-selection" : "border-border bg-card"}`}
                >
                  <span className="min-w-0 whitespace-normal">
                    <span className="block text-xs font-semibold text-primary">
                      {estaAtual ? "Semana atual" : "Semana"}
                    </span>
                    <span className="line-clamp-2 text-sm font-medium">
                      {grupo.estudos[0]?.semana}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        </section>
      )}

      <section className="px-4 py-5">
        {daAba.length === 0 ? (
          <div className="border border-dashed px-6 py-12 text-center text-muted-foreground">
            <BookOpen className="mx-auto mb-3 h-9 w-9 text-primary" />
            <p className="font-medium text-foreground">Nenhum estudo importado</p>
            <p className="mt-1 text-sm">
              {aba === "extras"
                ? "Importe um livro ou uma brochura do jw.org e marque “Salvar na aba Extras”."
                : "Importe a apostila Vida e Ministério ou a Sentinela da semana no jw.org."}
            </p>
          </div>
        ) : (
          <>
            {!atual &&
              semanaSelecionada &&
              !selecionadas[aba] &&
              !semanas.some(
                (g) =>
                  g.intervalo && g.intervalo.inicio <= hojeIso() && g.intervalo.fim >= hojeIso(),
              ) && (
                <p className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3 className="h-3.5 w-3.5" /> A semana atual ainda não foi importada.
                  Mostrando a anterior mais recente.
                </p>
              )}
            {aba === "estudo" ? (
              <div className="space-y-3" aria-label="Estudos da semana">
                {meiosDaSemana.length === 0 && (
                  <CapsulaEstudo reuniao="meio de semana" aoExcluir={excluirEstudo} />
                )}
                {meiosDaSemana.map((p) => (
                  <CapsulaEstudo
                    key={p.id}
                    reuniao="meio de semana"
                    pub={p}
                    aoExcluir={excluirEstudo}
                  />
                ))}
                {finsDaSemana.length === 0 && (
                  <CapsulaEstudo reuniao="fim de semana" aoExcluir={excluirEstudo} />
                )}
                {finsDaSemana.map((p) => (
                  <CapsulaEstudo
                    key={p.id}
                    reuniao="fim de semana"
                    pub={p}
                    aoExcluir={excluirEstudo}
                  />
                ))}
              </div>
            ) : (
              <ul className="space-y-3">
                {daAba.map((p) => (
                  <li key={p.id} className="flex items-stretch rounded-lg bg-card px-3">
                    <Link
                      to="/estudo/$id"
                      params={{ id: p.id }}
                      className="flex min-w-0 flex-1 items-center gap-3 py-4 pr-2"
                    >
                      <span
                        className="grid h-16 w-12 shrink-0 place-items-center rounded-md bg-secondary text-section"
                        aria-hidden="true"
                      >
                        <BookOpen className="h-6 w-6" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-lg font-semibold leading-snug">{p.titulo}</span>
                      </span>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${p.titulo}`}
                      className="my-auto text-muted-foreground hover:text-destructive"
                      onClick={() => excluirEstudo(p)}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <div className="px-4">
        <Button onClick={() => setAberto(true)} size="lg" className="w-full">
          <Plus /> Importar estudo
        </Button>
      </div>
      <footer className="px-4 pt-6 text-center text-xs text-muted-foreground">
        <p>Versão do app: {ROTULO_BUILD}</p>
        {BUILD.resumo && <p className="mx-auto mt-0.5 max-w-sm">{BUILD.resumo}</p>}
      </footer>
      <BackupDialog aberto={backup} onOpenChange={setBackup} onRestored={recarregar} />
      {aberto && (
        <ImportModal
          existentes={new Set(pubs.map((p) => p.url_origem))}
          onClose={() => setAberto(false)}
          onDone={(tipo) => {
            setAberto(false);
            setAba(tipo === "extras" ? "extras" : "estudo");
            recarregar();
          }}
        />
      )}
    </main>
  );
}

type StatusImport = "aguardando" | "importando" | "concluido" | "erro" | "existente";

function ImportModal({
  existentes,
  onClose,
  onDone,
}: {
  existentes: Set<string>;
  onClose: () => void;
  onDone: (t: TipoPub) => void;
}) {
  const [url, setUrl] = useState("");
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [avisos, setAvisos] = useState<string[]>([]);
  const [artigos, setArtigos] = useState<ArtigoRevista[] | null>(null);
  const [status, setStatus] = useState<Record<string, StatusImport>>({});
  const [erros, setErros] = useState<Record<string, string>>({});
  const [ultimoTipo, setUltimoTipo] = useState<TipoPub | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState(false);
  const [inicio, setInicio] = useState<number | null>(null);
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    if (!carregando) {
      setInicio(null);
      return;
    }
    const t0 = Date.now();
    setInicio(t0);
    setAgora(t0);
    const iv = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(iv);
  }, [carregando]);
  const decorrido = inicio ? Math.floor((agora - inicio) / 1000) : 0;
  const cron = carregando ? (
    <span className="text-xs font-normal tabular-nums opacity-80">
      {Math.floor(decorrido / 60)}:{String(decorrido % 60).padStart(2, "0")}
    </span>
  ) : null;
  const alternarMarcado = (u: string) =>
    setMarcados((s) => {
      const n = new Set(s);
      n.has(u) ? n.delete(u) : n.add(u);
      return n;
    });

  async function importarUm(u: string) {
    if (existentes.has(u) || status[u] === "concluido") {
      setStatus((s) => ({ ...s, [u]: "existente" }));
      return null;
    }
    setStatus((s) => ({ ...s, [u]: "importando" }));
    try {
      const r = await importarUrl(u);
      if (extras) r.publicacao.tipo = "extras";
      await salvarPublicacao(r.publicacao, r.paragrafos);
      existentes.add(u);
      setUltimoTipo(r.publicacao.tipo);
      setStatus((s) => ({ ...s, [u]: "concluido" }));
      return r;
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      setStatus((s) => ({ ...s, [u]: "erro" }));
      setErros((s) => ({ ...s, [u]: mensagem }));
      return null;
    }
  }

  async function buscar() {
    setErro("");
    setAvisos([]);
    let limpa: string;
    try {
      const parsed = new URL(url.trim());
      if (!/(^|\.)jw\.org$/.test(parsed.hostname)) throw new Error();
      limpa = parsed.href;
    } catch {
      setErro("Cole um link válido do jw.org.");
      return;
    }
    setCarregando(true);
    try {
      const lista = await listarArtigos(limpa);
      if (lista.length) {
        setArtigos(lista);
        setMarcados(new Set(lista.filter((a) => !existentes.has(a.url)).map((a) => a.url)));
        setStatus(
          Object.fromEntries(
            lista.map((a) => [a.url, existentes.has(a.url) ? "existente" : "aguardando"]),
          ),
        );
        return;
      }
      if (existentes.has(limpa)) {
        setErro("Este estudo já foi importado.");
        return;
      }
      const r = await importarUm(limpa);
      if (r?.avisos.length) {
        setAvisos(r.avisos);
        return;
      }
      if (r) onDone(r.publicacao.tipo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  const [lote, setLote] = useState({ total: 0, feitos: 0 });
  async function importarVarios(lista: ArtigoRevista[]) {
    setErro("");
    setCarregando(true);
    setLote({ total: lista.length, feitos: 0 });
    for (let i = 0; i < lista.length; i++) {
      await importarUm(lista[i]!.url);
      setLote((l) => ({ ...l, feitos: l.feitos + 1 }));
      // Pausa entre artigos: rajada seguida de descargas aciona o limite do
      // espelho do Google e derruba os últimos do lote (foi o que acontecia).
      if (i < lista.length - 1) await new Promise((r) => setTimeout(r, 1200));
    }
    setCarregando(false);
  }

  const pendentes =
    artigos?.filter(
      (a) => marcados.has(a.url) && !["concluido", "existente"].includes(status[a.url] ?? ""),
    ) ?? [];
  const falhos = artigos?.filter((a) => status[a.url] === "erro") ?? [];
  const fechar = () => (ultimoTipo ? onDone(ultimoTipo) : onClose());

  async function importarArquivo(file?: File) {
    if (!file) return;
    setErro("");
    setAvisos([]);
    setCarregando(true);
    try {
      const { html, url: urlSalva } = decodificarPaginaSalva(await file.text(), file.name);
      const origem = urlSalva || `arquivo:${file.name}`;
      const r = await importarHtml(html, origem);
      if (existentes.has(r.publicacao.url_origem)) {
        setErro("Este estudo já foi importado.");
        return;
      }
      if (extras) r.publicacao.tipo = "extras";
      await salvarPublicacao(r.publicacao, r.paragrafos);
      if (urlSalva) existentes.add(r.publicacao.url_origem);
      setUltimoTipo(r.publicacao.tipo);
      if (r.avisos.length) setAvisos(r.avisos);
      else onDone(r.publicacao.tipo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay backdrop-blur-sm sm:items-center"
      onClick={fechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto border bg-card p-5 sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="import-title" className="text-xl font-bold">
            {artigos ? "Artigos da revista" : "Importar do jw.org"}
          </h2>
          <Button variant="ghost" size="icon" onClick={fechar} aria-label="Fechar">
            <X />
          </Button>
        </div>
        {artigos ? (
          <>
            <ul className="divide-y border-y">
              {artigos.map((a) => {
                const estado = status[a.url] ?? "aguardando";
                return (
                  <li key={a.url} className="py-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${a.titulo}`}
                        disabled={
                          ["existente", "concluido", "importando"].includes(estado) || carregando
                        }
                        checked={estado === "concluido" || marcados.has(a.url)}
                        onChange={() => alternarMarcado(a.url)}
                        className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug">{a.titulo}</p>
                        <p
                          className={`mt-1 text-xs ${estado === "erro" ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {estado === "existente"
                            ? "Já importado"
                            : estado === "concluido"
                              ? "Concluído"
                              : estado === "importando"
                                ? "Importando…"
                                : estado === "erro"
                                  ? erros[a.url]
                                  : "Aguardando"}
                        </p>
                      </div>
                      {estado === "importando" && (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      )}
                      {(estado === "concluido" || estado === "existente") && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <label className="mt-4 flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={extras}
                onChange={(e) => setExtras(e.target.checked)}
                className="h-5 w-5 shrink-0 accent-primary"
              />
              Salvar na aba <span className="font-semibold">Extras</span>&nbsp;(livros e brochuras)
            </label>
            {carregando && lote.total > 0 && (
              <AnelProgresso feitos={lote.feitos} total={lote.total} tempo={cron} />
            )}
            <div className="mt-4 flex flex-col gap-2">
              {falhos.length > 0 && (
                <Button
                  variant="outline"
                  disabled={carregando}
                  onClick={() => importarVarios(falhos)}
                >
                  <RefreshCw /> Tentar falhas novamente
                </Button>
              )}
              <Button
                disabled={carregando || pendentes.length === 0}
                onClick={() => importarVarios(pendentes)}
              >
                {carregando && <Loader2 className="animate-spin" />}
                {carregando ? "Importando" : `Importar selecionados (${pendentes.length})`} {cron}
              </Button>
              {!carregando && ultimoTipo && (
                <p className="text-center text-xs text-muted-foreground">
                  Importação concluída. Você pode fechar ou importar os itens restantes.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <label htmlFor="import-url" className="mb-2 block text-sm text-muted-foreground">
              Link da revista ou da matéria
            </label>
            <div className="flex items-center gap-2 rounded-md border bg-transparent px-3">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <input
                id="import-url"
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.jw.org/bzs/..."
                className="w-full bg-transparent py-3 outline-none"
                inputMode="url"
              />
            </div>
            {erro && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {erro}
              </p>
            )}
            {erro &&
              /Não foi possível baixar|esgotado|segurança|resposta inesperada/i.test(erro) && (
                <p className="mt-2 rounded-md bg-accent/60 p-2 text-xs text-accent-foreground">
                  Alternativa que sempre funciona: abra o link no navegador (Chrome), toque em ⋮ →
                  Baixar e importe o arquivo baixado aqui pelo botão abaixo.
                </p>
              )}
            {avisos.map((aviso) => (
              <p key={aviso} className="mt-3 border-l-2 border-primary bg-selection p-2 text-sm">
                {aviso}
              </p>
            ))}
            <label htmlFor="salvar-extras" className="mt-3 flex items-center gap-3 text-sm">
              <input
                id="salvar-extras"
                type="checkbox"
                checked={extras}
                onChange={(e) => setExtras(e.target.checked)}
                className="h-5 w-5 shrink-0 accent-primary"
              />
              É livro ou brochura — salvar na aba <span className="font-semibold">Extras</span>
            </label>
            <Button disabled={carregando || !url} onClick={buscar} className="mt-5 w-full">
              {carregando && <Loader2 className="animate-spin" />}
              {carregando ? "Abrindo" : "Continuar"} {cron}
            </Button>
            <p className="mt-4 text-center text-xs text-muted-foreground">— ou —</p>
            <Button
              variant="outline"
              disabled={carregando}
              onClick={() => arquivoRef.current?.click()}
              className="mt-2 w-full"
            >
              {carregando ? <Loader2 className="animate-spin" /> : <FileUp />} Importar arquivo
              salvo do jw.org (.html/.mhtml)
            </Button>
            <input
              ref={arquivoRef}
              type="file"
              accept=".html,.htm,.mhtml,.mht,text/html,application/x-mimearchive"
              className="hidden"
              onChange={(e) => {
                importarArquivo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Salve a página no navegador (menu ⋮ → Baixar) e escolha o arquivo aqui — funciona
              mesmo quando o download automático falha.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
function AnelProgresso({
  feitos,
  total,
  tempo,
}: {
  feitos: number;
  total: number;
  tempo: React.ReactNode;
}) {
  const r = 34,
    c = 2 * Math.PI * r,
    f = total ? feitos / total : 0;
  return (
    <div
      className="mt-4 flex flex-col items-center gap-1"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={feitos}
      aria-label="Progresso da importação"
    >
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
          <circle cx="40" cy="40" r={r} fill="none" strokeWidth="6" className="stroke-secondary" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            className="stroke-primary transition-[stroke-dashoffset] duration-500"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - f)}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-sm font-bold tabular-nums">
          {feitos} de {total}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">{tempo}</span>
    </div>
  );
}
