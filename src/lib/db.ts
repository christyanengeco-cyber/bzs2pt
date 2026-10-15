import { openDB, type IDBPDatabase } from "idb";

export type TipoPub = "sentinela" | "apostila" | "referencia";
export interface Publicacao {
  id: string;
  tipo: TipoPub;
  titulo: string;
  semana: string;
  semana_inicio?: string;
  semana_fim?: string;
  url_origem: string;
  video_url: string;
  pai_id?: string;
  criado_em: number;
}
export interface Paragrafo {
  id: string;
  publicacao_id: string;
  numero_ordem: number;
  texto_portugues: string;
  timestamp_inicio: number;
  pergunta?: boolean;
  rotulo?: string;
  imagem?: string;
  oculto?: boolean;
  links?: { inicio: number; fim: number; href: string }[];
}
export const CORES = ["#FFFF00", "#86EFAC", "#93C5FD", "#F472B6"] as const;
export interface Anotacao {
  id: string;
  paragrafo_id: string;
  publicacao_id: string;
  tipo: "destaque" | "nota";
  cor_destaque?: string;
  inicio?: number;
  fim?: number;
  trecho?: string;
  texto_comentario?: string;
}

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp)
    dbp = openDB("estudo-libras", 2, {
      upgrade(d, oldVersion) {
        if (oldVersion < 1) {
          d.createObjectStore("publicacoes", { keyPath: "id" });
          d.createObjectStore("paragrafos", { keyPath: "id" }).createIndex("pub", "publicacao_id");
          d.createObjectStore("anotacoes", { keyPath: "id" }).createIndex("pub", "publicacao_id");
        }
      },
    });
  return dbp;
}
export const uid = () => crypto.randomUUID();

export async function listarPublicacoes(): Promise<Publicacao[]> {
  const all = (await (await db()).getAll("publicacoes")) as Publicacao[];
  return all.sort((a, b) => b.criado_em - a.criado_em);
}
export async function getPublicacao(id: string) {
  return (await (await db()).get("publicacoes", id)) as Publicacao | undefined;
}
export async function salvarPublicacao(p: Publicacao, paras: Paragrafo[]) {
  const tx = (await db()).transaction(["publicacoes", "paragrafos"], "readwrite");
  await tx.objectStore("publicacoes").put(p);
  for (const x of paras) await tx.objectStore("paragrafos").put(x);
  await tx.done;
}
export async function atualizarPublicacao(p: Publicacao) {
  await (await db()).put("publicacoes", p);
}
export async function excluirPublicacao(id: string) {
  const d = await db();
  const filhos = (await d.getAll("publicacoes")).filter((p) => (p as Publicacao).pai_id === id);
  const tx = d.transaction(["publicacoes", "paragrafos", "anotacoes"], "readwrite");
  await tx.objectStore("publicacoes").delete(id);
  for (const f of filhos) await tx.objectStore("publicacoes").delete(f.id);
  for (const pid of [id, ...filhos.map((f) => f.id)])
    for (const s of ["paragrafos", "anotacoes"] as const) {
      const keys = await tx.objectStore(s).index("pub").getAllKeys(pid);
      for (const k of keys) await tx.objectStore(s).delete(k);
    }
  await tx.done;
}
export async function listarParagrafos(pubId: string): Promise<Paragrafo[]> {
  const r = (await (await db()).getAllFromIndex("paragrafos", "pub", pubId)) as Paragrafo[];
  return r.sort((a, b) => a.numero_ordem - b.numero_ordem);
}
export async function atualizarParagrafo(p: Paragrafo) {
  await (await db()).put("paragrafos", p);
}
export async function listarAnotacoes(pubId: string): Promise<Anotacao[]> {
  return (await (await db()).getAllFromIndex("anotacoes", "pub", pubId)) as Anotacao[];
}
export async function salvarAnotacao(a: Anotacao) {
  await (await db()).put("anotacoes", a);
}
export async function excluirAnotacao(id: string) {
  await (await db()).delete("anotacoes", id);
}

export async function listarTodosDados() {
  const d = await db();
  const [publicacoes, paragrafos, anotacoes] = await Promise.all([
    d.getAll("publicacoes") as Promise<Publicacao[]>,
    d.getAll("paragrafos") as Promise<Paragrafo[]>,
    d.getAll("anotacoes") as Promise<Anotacao[]>,
  ]);
  return { publicacoes, paragrafos, anotacoes };
}

export async function restaurarDados(
  dados: { publicacoes: Publicacao[]; paragrafos: Paragrafo[]; anotacoes: Anotacao[] },
  substituir: boolean,
) {
  const d = await db();
  const tx = d.transaction(["publicacoes", "paragrafos", "anotacoes"], "readwrite");
  if (substituir) {
    await Promise.all([
      tx.objectStore("publicacoes").clear(),
      tx.objectStore("paragrafos").clear(),
      tx.objectStore("anotacoes").clear(),
    ]);
  }
  for (const publicacao of dados.publicacoes) await tx.objectStore("publicacoes").put(publicacao);
  for (const paragrafo of dados.paragrafos) await tx.objectStore("paragrafos").put(paragrafo);
  for (const anotacao of dados.anotacoes) await tx.objectStore("anotacoes").put(anotacao);
  await tx.done;
}
