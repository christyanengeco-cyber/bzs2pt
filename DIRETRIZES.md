# Diretrizes deste repositório

Criadas em 04/11/2026 a partir do post-mortem da regressão de importação do jw.org:
um detector de "página-desafio" (`DESAFIO_RE`) passou a recusar páginas **normais**,
porque o jw.org começou a embutir o script do WAF (`awswaf`) no `<head>` delas.
Corrigido no commit `b4ce756` invertendo o critério — **"só é desafio quando não há
conteúdo real"**. Estas diretrizes valem para qualquer sessão futura, humana ou de
agente, que alterar este código. Leia antes de mexer em fluxo que já funciona.

## A cadeia do erro (resumo)

1. **Ambiente:** o jw.org passou a embutir o script do WAF (`awswaf`) em páginas normais; o marcador deixou de ser exclusivo de bloqueio.
2. **Decisão errada:** detector negativo (`DESAFIO_RE`) rejeitando qualquer resposta que contivesse o marcador.
3. **Defeito nº 1 — detector negativo sem calibração:** regex construída de memória geral, sem capturar amostra real de página-desafio e sem testar contra página normal real.
4. **Defeito nº 2 — fail closed:** recusa automática e anônima; página boa era descartada.
5. **Amplificador nº 1 — retry de 55s:** o falso positivo não falhava rápido; virava "resposta vazia" / "signal timed out", sintoma de rede apontando para o lugar errado.
6. **Amplificador nº 2 — erro honesto sobre o sintoma, cego sobre a causa:** as mensagens diziam o que o jw.org fez, nunca quem do app recusou e por quê.
7. **Falha de processo nº 1:** zero verificação contra a realidade — o novo fetch nunca rodou contra uma página real antes de publicar.
8. **Falha de processo nº 2:** com o relato "funcionava antes, parou depois", culpou-se o ambiente (WAF mais rígido) e absolveu-se o próprio diff.
9. **Falha de processo nº 3:** v1.1.1 (proxies) e v1.1.2 (timeout) empilharam correções de sintoma sobre a causa intacta, adicionando dependências instáveis.
10. **Correção correta (`b4ce756`):** sinal positivo de conteúdo (`temConteudo` = tamanho + marcadores de conteúdo real) gating a checagem negativa, aplicada no servidor e no parser.

## A assimetria que dimensiona toda guarda

| Erro                                 | Custo                                                      |
| ------------------------------------ | ---------------------------------------------------------- |
| Falso positivo (recusar página boa)  | Função central 100% morta, erro confuso, dias de depuração |
| Falso negativo (aceitar página ruim) | Sintoma visível na hora, recuperável com retry             |

Toda guarda é dimensionada por esta tabela **antes** de existir. Nunca colocar o
custo pior no erro mais provável.

## Diretrizes

### Processo — mudanças em sistema que funciona

1. **Réu primário.** Regressão logo após uma mudança → a mudança é a hipótese nula. Primeiro ato: isolar/reverter e comparar; investigar o ambiente só depois de absolver o código alterado.
2. **Verificar contra a realidade antes de publicar.** Toda lógica de decisão nova roda contra amostras reais (a página boa **e** a adversa). "Raciocinei que funciona" não é verificação.
3. **Uma mudança por vez.** Nunca empilhar correção sobre correção sem confirmar que a anterior mudou o comportamento. Duas tentativas sem resultado = parar e reatacar a causa, não o sintoma.
4. **O ônus da prova é de quem adiciona.** Defesa contra ameaça nunca observada não entra como bloqueio; entra como log, no máximo.

### Design — guardas e detectores

5. **Detecção positiva por padrão.** Definir o que a página _boa_ precisa ter e aceitar por isso; marcador de "ruim" só rejeita na ausência do sinal positivo.
6. **Falhar aberto quando os custos são assimétricos.** Recusar conteúdo bom mata a função; aceitar página ruim dá sintoma visível e recuperável. A guarda escolhe o erro barato.
7. **Detector sem calibração é palpite.** Regex de marcador só entra com amostra real de cada classe testada contra ela — e é revisada quando o site muda.
8. **Observar antes de bloquear.** Suspeita nova começa como telemetria/diagnóstico; bloqueio só depois de dados que provem a ameaça.
9. **Toda guarda assina a recusa.** Ao recusar, o erro nomeia a regra e a evidência ("recusado pelo detector de desafio: encontrei 'awswaf'"), na camada onde ocorreu — nunca diluído por retries em erro genérico.

### Diagnóstico e postura

10. **Falhar rápido preserva o diagnóstico.** Retry longo converte bug lógico em sintoma de rede; o motivo real da recusa vem antes da retentativa.
11. **O relato do usuário é um experimento controlado.** "Funcionava antes, parou depois" pesa mais que qualquer modelo mental — testá-lo primeiro é o caminho mais curto e o mais respeitoso.
12. **"Hardening" não é argumento.** Código que pode recusar é código que pode quebrar; avaliar pelo pior caminho que ele abre, não pela intenção protetora do nome.

## Como agir no mesmo cenário (replay)

1. Ao suspeitar de WAF: capturar a resposta real que o servidor recebe (normal e, se existir, desafio) **antes** de escrever qualquer regex — o resultado provável é "nada de gate, só log".
2. Ao relato "parou depois que você mexeu": primeiro commit desligando a mudança suspeita (flag) para isolar a variável; diagnóstico depois; otimização de timeout/proxy nem entra na conversa.
3. A correção final segue o formato do `b4ce756`: sinal positivo de conteúdo no comando, checagem negativa só na ausência dele, nos dois pontos (servidor e parser).

---

Estas diretrizes existem para que o custo desta regressão não se pague duas vezes.
