import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUILD } from "@/lib/build";
import { haAtualizacao, URL_APK, versaoApkInstalada } from "@/lib/atualizacao";

const CHAVE_DISPENSA = "apk-aviso-dispensado";
/** Aviso de versão nova do APK, na base da tela.
 *
 *  Só aparece dentro do app Android (ver `versaoApkInstalada`): no navegador a
 *  página carregada já é a versão publicada, então não existe o que atualizar.
 *
 *  Instalar por cima funciona porque todo build usa o mesmo `applicationId` e o
 *  mesmo keystore, com versionCode crescente. Nunca orientar o usuário a
 *  desinstalar: desinstalar apaga o IndexedDB e leva os estudos junto. */
export function AvisoAtualizacao() {
  const [instalada, setInstalada] = useState<string | null>(null);
  const [dispensada, setDispensada] = useState<string | null>(null);

  // Lido só no cliente: o servidor não vê a query do APK e renderizaria nada.
  useEffect(() => {
    setInstalada(versaoApkInstalada());
    try {
      setDispensada(localStorage.getItem(CHAVE_DISPENSA));
    } catch {
      /* navegação privada pode bloquear o storage */
    }
  }, []);

  if (!haAtualizacao(instalada)) return null;
  if (dispensada === BUILD.versao) return null;

  const dispensar = () => {
    setDispensada(BUILD.versao);
    try {
      localStorage.setItem(CHAVE_DISPENSA, BUILD.versao);
    } catch {
      /* sem storage, o aviso volta na próxima abertura — inofensivo */
    }
  };

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.35)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-md items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Download className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Versão {BUILD.versao} disponível</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Instale por cima: seus estudos continuam. Faça um backup antes, por garantia.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={URL_APK} target="_blank" rel="noreferrer">
                Baixar agora
              </a>
            </Button>
            <Button size="sm" variant="ghost" onClick={dispensar}>
              Depois
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dispensar}
          aria-label="Fechar aviso de atualização"
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
