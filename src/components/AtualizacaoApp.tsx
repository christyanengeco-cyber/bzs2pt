import { useEffect, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BotoesBackup } from "@/components/BotoesBackup";
import { BUILD } from "@/lib/build";
import { compararVersao, URL_APK, versaoApkInstalada, versaoPublicada } from "@/lib/atualizacao";
import { montarBackup, type BackupPronto } from "@/lib/salvar-backup";

type Estado = "parado" | "verificando" | "atualizado" | "disponivel" | "erro";

/** Botão "Verificar atualizações" das Configurações.
 *
 *  Fica parado até o toque — nada de consultar o GitHub a cada abertura. Se
 *  achar versão mais nova, o próprio botão vira o link de download, para o
 *  usuário não precisar procurar outro lugar.
 *
 *  Instalar por cima preserva os estudos porque o applicationId e o keystore
 *  são os mesmos em todo build. Nunca sugerir desinstalar: apaga o IndexedDB. */
export function AtualizacaoApp() {
  const [instalada, setInstalada] = useState<string | null>(null);
  const [publicada, setPublicada] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>("parado");

  useEffect(() => {
    setInstalada(versaoApkInstalada());
  }, []);

  const verificar = async () => {
    setEstado("verificando");
    const alvo = await versaoPublicada();
    setPublicada(alvo);
    const base = versaoApkInstalada() ?? BUILD.versao;
    setEstado(compararVersao(alvo, base) > 0 ? "disponivel" : "atualizado");
  };

  const novaVersao = estado === "disponivel" && publicada ? publicada : null;

  // Backup montado assim que a versão nova aparece: o clique em "Salvar no
  // Drive" precisa compartilhar sem espera, ou o gesto do usuário expira.
  const [pronto, setPronto] = useState<BackupPronto | null>(null);
  useEffect(() => {
    if (!novaVersao) return;
    let vivo = true;
    montarBackup()
      .then((arquivo) => vivo && setPronto(arquivo))
      .catch(() => vivo && setPronto(null));
    return () => {
      vivo = false;
    };
  }, [novaVersao]);

  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">Atualizações do app</legend>
      <div className="space-y-2">
        {novaVersao ? (
          <Button asChild className="w-full">
            <a href={URL_APK} target="_blank" rel="noreferrer">
              <Download /> Baixar {novaVersao}
            </a>
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={verificar}
            disabled={estado === "verificando"}
          >
            {estado === "verificando" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {estado === "verificando" ? "Verificando…" : "Verificar atualizações"}
          </Button>
        )}

        <p className="text-center text-xs text-muted-foreground">
          {novaVersao
            ? "Instale por cima da atual. Estudos e anotações continuam."
            : estado === "atualizado"
              ? `Já está na versão mais recente (v${publicada ?? BUILD.versao}).`
              : `Versão instalada: ${instalada ? `v${instalada} (app)` : `v${BUILD.versao} (site)`}`}
        </p>

        {/* Backup altamente recomendado: instalar por cima preserva o IndexedDB,
            mas uma instalação interrompida no meio pode deixar o app sem abrir.
            O arquivo de backup é o único caminho de volta nesse caso. */}
        {novaVersao && (
          <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
            <p className="text-xs font-semibold text-primary">Faça um backup antes de atualizar</p>
            <p className="text-xs text-muted-foreground">
              Instalar por cima mantém seus estudos. Ainda assim, se a instalação falhar no meio, só
              o arquivo de backup recupera.
            </p>
            <BotoesBackup pronto={pronto} className="grid gap-2" />
          </div>
        )}
      </div>
    </fieldset>
  );
}
