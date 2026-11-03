import type { Secao } from "@/lib/publication-layout";

export function SectionIcon({ secao }: { secao: Secao }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" className="h-6 w-6">
    {secao === "tesouros" ? <><path d="M5 11 10 5h12l5 6-11 17Z M5 11h22 M10 5l-2 6 8 17 8-17-2-6 M10 5l6 6 6-6 M16 11v17" /></> : secao === "ministerio" ? <><path d="M16 28V4 M16 10c-6 0-7-3-7-5 5 0 7 2 7 5Zm0 5c-6 0-7-3-7-5 5 0 7 2 7 5Zm0 5c-6 0-7-3-7-5 5 0 7 2 7 5Zm0 5c-6 0-7-3-7-5 5 0 7 2 7 5Zm0-15c6 0 7-3 7-5-5 0-7 2-7 5Zm0 5c6 0 7-3 7-5-5 0-7 2-7 5Zm0 5c6 0 7-3 7-5-5 0-7 2-7 5Zm0 5c6 0 7-3 7-5-5 0-7 2-7 5Z" /></> : <><path d="M7 17c-2-3 0-6 4-6h8l3-5 4 1 1 5-4 2v10h-3v-6H11v6H8v-8 M7 13 4 11 M22 8l-2-3 M25 9h.1" /><path d="M11 12c-3 1-3 4 0 5m4-5c-3 1-3 4 0 5m4-5c-3 1-3 4 0 5" /></>}
  </svg>;
}