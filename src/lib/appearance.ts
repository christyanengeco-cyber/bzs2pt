export type Tema = "sistema" | "claro" | "escuro";

export const CORES_INTERFACE = [
  { id: "lilas", nome: "Lilás" },
  { id: "roxo", nome: "Roxo" },
  { id: "violeta", nome: "Violeta" },
  { id: "azul", nome: "Azul" },
  { id: "celeste", nome: "Azul celeste" },
  { id: "ciano", nome: "Ciano" },
  { id: "petroleo", nome: "Petróleo" },
  { id: "verde", nome: "Verde" },
  { id: "menta", nome: "Menta" },
  { id: "lima", nome: "Lima" },
  { id: "amarelo", nome: "Amarelo" },
  { id: "ambar", nome: "Âmbar" },
  { id: "laranja", nome: "Laranja" },
  { id: "coral", nome: "Coral" },
  { id: "rosa", nome: "Rosa" },
  { id: "magenta", nome: "Magenta" },
] as const;

export type CorInterface = (typeof CORES_INTERFACE)[number]["id"];

export function corValida(valor: string | null): CorInterface {
  return CORES_INTERFACE.find((cor) => cor.id === valor)?.id ?? "lilas";
}

export function aplicarCor(cor: CorInterface) {
  document.documentElement.dataset["accent"] = cor;
  localStorage.setItem("cor-interface", cor);
}

export function aplicarTema(tema: Tema) {
  const escuro = tema === "escuro" || (tema === "sistema" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", escuro);
  document.documentElement.dataset["tema"] = tema;
  localStorage.setItem("tema", tema);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", escuro ? "#000000" : "#f5f5f5");
}