# JW Library — Aba Reuniões (mobile): documentação de design para o bzs2pt

> **Data:** 04/11/2026 · **Escopo:** a aba Reuniões do JW Library no mobile (iOS/Android), cobrindo a reunião de **meio de semana** (Vida e Ministério) e a de **fim de semana** (discurso público + Estudo de A Sentinela) · **Objetivo:** catálogo detalhado das escolhas de design, cada uma com o mapeamento "como aplicar no bzs2pt", citando os arquivos reais deste repositório.
>
> **Atualização (05/11/2026):** decisões do dono registradas e aplicadas ao plano — v. seção 10.
>
> **Legenda de confiabilidade** — usada em todo o documento:
>
> - 📌 **Fato documentado** — confirmado em fonte oficial (histórico de versões na App Store, páginas de ajuda oficial em jw.org) ou em fonte primária citada.
> - 👁 **Observação em captura** — visto diretamente em screenshot de versão real do app; cores aproximadas.
> - 💡 **Recomendação** — inferência nossa, com apontamento para o arquivo do bzs2pt.

---

## 1. Método e fontes

Este documento não é "de memória": cada afirmação relevante carrega uma das três marcações acima. As fontes primárias são:

1. **Histórico de versões oficial do JW Library na App Store** (apps.apple.com/us/app/jw-library/id672417831) — as notas de versão descrevem com precisão quando cada recurso da aba Reuniões mudou.
2. **Ajuda oficial do app em jw.org**, para iOS (`/en/online-help/jw-library/apple/features`) e Android (`/en/online-help/jw-library/android/features`).
3. **Guia de acessibilidade** (curiousnetentity.com/JWLibrary/4Meetings) — descreve a aba Reuniões elemento a elemento sob o ponto de vista do VoiceOver, o que revela a estrutura interna da tela (rótulos, ordem, cabeçalhos).
4. **Capturas de tela reais** do app (home e Meeting Workbook), incluídas aqui em `docs/img/`.
5. **O código do bzs2pt** — o mapeamento final cita arquivos e linhas reais deste repositório.

Uma nota de honestidade antes de começar: a ajuda oficial do jw.org **atrasa em relação ao app** (a página de recursos do Android ainda descreve uma gaveta de navegação que já virou barra de abas). Quando a ajuda oficial e a captura de versão recente divergirem, este documento assume a captura como verdade vigente e anota a divergência.

---

## 2. A navegação: Reuniões é um cidadão de primeira classe

### O que é fato

📌 Na ajuda oficial do iOS, o app é descrito com abas de primeiro nível acessíveis pela barra inferior — entre elas **Meetings**, ao lado de Bible, Publications e Daily Text. Na prática vigente, a captura de versão recente mostra a barra com **cinco abas**:

`Home · Bible · Library · Meetings · Personal Study`

(👁 captura `docs/img/jw-home-mobile-1.jpg`. A ajuda oficial lista `Bible · Publications · Daily Text · Meetings · Online` — é o layout de uma geração anterior; o app atual usa a barra de 5 abas acima.)

📌 A descrição oficial do app repete o princípio em uma frase: _"Access material for both midweek and weekend meetings in one location"_ — a matéria das reuniões do meio de semana e do fim de semana num único lugar.

### As escolhas de design por trás disso

1. **Reuniões no nível mais alto da hierarquia, com um toque de qualquer tela.** Reunião não é uma subseção de "Biblioteca"; é um destino permanente. O custo de chegar na matéria da semana é o mínimo possível — a tarefa mais frequente da base de usuários.
2. **Ícone semântico, não genérico.** 👁 A aba Meetings usa o ícone de uma **pessoa no púlpino/atrás do pódio** — é a única aba cujo ícone desenha a _atividade_ (o irmão conduzindo/desempenhando a parte), e não o _objeto_ (livro, casa, diamante). O rótulo é sempre visível junto ao ícone.
3. **Aba ativa pinta de roxo.** 👁 A aba selecionada muda de ícone e rótulo para o roxo de acento do app (aprox. `#7B5EA7`); as demais ficam em cinza escuro.

### Como aplicar no bzs2pt

💡 **Correção (05/11/2026):** a home do bzs2pt tem **três abas** — _A Sentinela_, _Vida e Ministério_ e _Extras_ (`ABAS` em `src/routes/index.tsx`); **não existe aba Referência e não deve existir** (decisão do dono). O tipo `"referencia"` existe em `TipoPub` (`src/lib/db.ts`) apenas como **marcador interno** das publicações importadas pelo Painel de referências (`estudo.$id.tsx` ~537/852/879) — elas ficam no IndexedDB e são abertas pelo próprio fluxo do painel, sem lugar na home. A separação meio de semana/fim de semana hoje é feita por essas abas de tipo (`apostila` × `sentinela`). O princípio a preservar é o do item 1 acima: **qualquer estudo deve estar a no máximo dois toques da home** — e a home já cumpre isso (aba → estudo). Se um dia a home ganhar barra de abas inferior própria (padrão JW), o candidato natural é mover o seletor de tipos para lá, mantendo o rótulo sempre visível junto ao ícone.

---

## 3. A página da semana — o redesign de agosto/2025

### O que é fato

O histórico de versões da App Store documenta a evolução recente da aba em três marcos:

- 📌 **v15.0.1 (28/06/2024):** _"The current Watchtower study article displays directly on the Meetings tab."_ — o artigo de estudo **atual** passa a ser exibido direto na aba, sem precisar abrir a publicação.
- 📌 **v15.4.1 (29/08/2025):** _"The Meetings tab has been redesigned to show links to material for the **Life and Ministry meeting** and the **Watchtower Study** on the **same page**. Links to other meeting publications are also included for easy access."_
- 📌 **v15.4.2 (19/09/2025):** _"The 'More Songs' button has been restored to the Show Media page on the Meetings tab."_ — o botão de músicas extras é tratado como parte essencial da página de mídia da reunião (a ponto de ter rollback dedicado quando sumiu).

### As escolhas de design por trás disso

1. **A "semana" é o objeto mental, não a publicação.** O redesign de 2025 consolidou tudo o que pertence à semana — meio de semana + fim de semana + publicações auxiliares — numa página só. O usuário não pensa "abra o Workbook"; pensa "o que tem esta semana?". A resposta é uma página, não um caminho de navegação.
2. **Conteúdo atual direto na página** (v15.0.1): o material da semana vigente aparece _renderizado_, e os demais como links. Prioridade visual para o que é útil **hoje**.
3. **Mudança de conteúdo automática durante a semana.** 📌 O guia de acessibilidade descreve que a página alterna o destaque conforme o dia: no começo da semana o material de meio de semana domina; no fim de semana, o artigo de estudo. A seleção é automática — ninguém precisa "escolher a semana certa" (e errar).
4. **Zero profundidade para a tarefa central.** Preparar a reunião = 1 toque na aba + a semana já está lá.

### Como aplicar no bzs2pt

💡 Este é o ponto em que o bzs2pt **já replica o padrão** sem sabermos explicitamente:

- **Auto-seleção da semana:** `escolherSemanaInicial(publicacoes, hoje)` em `src/lib/study-dates.ts` escolhe a semana vigente; o chip da semana ativa recebe scroll automático (`semanaAtiva.current?.scrollIntoView(...)` em `src/routes/index.tsx`).
- **Aviso quando a semana atual falta:** o texto _"A semana atual ainda não foi importada. Mostrando a anterior mais recente."_ (`src/routes/index.tsx`, linha ~141) é a versão honesta do item 3: quando não há dado, o app **diz o que está mostrando** em vez de fingir — mesmo espírito da regra 9 do AGENTS.md ("toda recusa se assina").
- **Decisão (05/11/2026) — espelho direto do redesign v15.4.1:** a home passa a ter a aba **Estudo**, com o material de meio de semana e o de fim de semana **na mesma página** (duas cápsulas empilhadas), mantendo a aba **Extras**. Desenho detalhado e estados vazios na seção 10, item M2.

---

## 4. Reunião de meio de semana — como o material é estruturado

### O que é fato

📌 O material oficial da reunião de meio de semana é o _Our Christian Life and Ministry—Meeting Workbook_, descrito no site como _"the schedule and study material for our midweek meeting, including our weekly Bible-reading program"_.

👁 A captura do Workbook em iPad (`docs/img/jw-workbook-ipad.jpg`) mostra a anatomia completa da página (versão de 2016, que permanece válida pois o _layout_ editorial do workbook não mudou):

- **Título da tela = o intervalo da semana**, centrado: _"January 11–17"_, com subtítulo _"Life and Ministry Meeting Workbook, January 2016"_. Barra de leitura com: voltar, buscar, marcador, opções de texto (Aa) e menu de contexto (…).
- **Banners de seção como faixas coloridas de largura total**, texto em caixa alta e branco:
  - _APPLY YOURSELF TO THE FIELD MINISTRY_ — **âmbar/dourado** (aprox. `#C88A2D`)
  - _LIVING AS CHRISTIANS_ — **vermelho escuro** (aprox. `#A32638`)
  - _TREASURES FROM GOD'S WORD_ — **azul-petróleo** (aprox. `#3C6F80`, aparece acima da região visível na captura)
- **Atribuições com rótulo em negrito + tempo como dado de primeira classe:** _"Initial Call: (2 min. or less) Present the cover subject…"_, _"Return Visit: (4 min. or less)…"_, _"Bible Study: (6 min. or less)…"_. O tempo vem **entre parênteses, imediatamente após o rótulo**, antes do conteúdo.
- **Números de referência como links** (azul-petróleo): `w05 12/1 21 ¶16`, `bh 9-10 ¶6-7` — referência de publicação, data e parágrafo, clicável.
- **Números de estudo** como link pequeno ("study 6").
- **Música como item de agenda:** _"Song 77"_ com link para o cancioneiro.
- **Perguntas em corpo de texto comum**, na ordem em que serão usadas; a leitura bíblica da semana vem como atribuição com tempo (_"Bible Reading: 2Ch 34:22-33 (4 min. or less)"_).
- **Painel de estudo à direita** (iPad, duas colunas): referências do parágrafo tocado, com título do artigo de pesquisa em link azul, números de parágrafo, citações em itálico e escrituras em link azul.

### As escolhas de design por trás disso

1. **Cor é código de seção, não decoração.** As três cores existem para serem identificáveis _de relance e de memória_: quem conhece a agenda localiza a parte da reunião pela cor antes de ler a palavra. A cor atravessa o app (e, no papel, o workbook impresso mantém o mesmo código).
2. **Tempo é informação estrutural.** Cada parte carrega seu tempo junto ao rótulo — o agenda da reunião inteira é legível sem abrir nada além da página.
3. **Todo número é um link; todo link tem destino teocrático preciso** (parágrafo, não página).
4. **A pergunta e a resposta moram juntas** — as caixas de resposta ficam sob cada pergunta (guia de acessibilidade as lista como caixas de edição, com o defeito documentado de rótulos idênticos entre si — 📌 — e de **as respostas digitadas serem perdidas ao sair da publicação**, 📌, crítica explícita do guia).

### Como aplicar no bzs2pt

💡 O bzs2pt já tem este sistema **inteiro**, com decisão estética diferente no item 1:

- **Seções:** `type Secao = "tesouros" | "ministerio" | "vida"` em `src/lib/publication-layout.ts` (`identificarSecao`), detectadas no parse e gravadas em cada `Paragrafo` (`faixa`/`estilo` em `src/lib/db.ts`).
- **Cores de seção:** `src/styles.css` linhas 106–107 — claro: `--sec-tesouros: #3c6f80`, `--sec-ministerio: #b8860b`, `--sec-vida: #9b2c2c`; escuro: `#6fa8b8`, `#d9a43c`, `#d0605a`. O `#3c6f80` do bzs2pt é o mesmo azul-petróleo do banner _Treasures_ da captura — o mapeamento de cor é 1:1 com o workbook.
- **Estilo de banner — diferença deliberada:** o JW usa faixa preenchida com texto branco; o bzs2pt usa **texto colorido na cor da seção + borda inferior** (`.workbook-paragraph[data-estilo="secao"]`, `src/styles.css` ~172). É uma escolha válida e mais leve — e, para a fidelidade ao JW, o caminho é um `background: var(--publication-section)` com texto branco nesse mesmo seletor. **Decisão do dono (05/11/2026):** adotar o banner fiel ao JW ("o mais parecido possível com o app") — o M3 deixa de ser experimento e entra no plano (seção 10).
- **Tempo e resposta:** `Paragrafo.resposta` e `faixa` já carregam essa estrutura; o Leitor renderiza pergunta + espaço de resposta no `data-estilo="corpo"`.

---

## 5. Reunião de fim de semana — como o material é estruturado

### O que é fato

📌 A reunião de fim de semana tem duas partes: o **discurso público** e o **Estudo de A Sentinela**. O artigo de estudo é identificado pelo **número de estudo + intervalo de datas de uso**, no formato _"Study Article 12: May 27, 2024–June 2, 2024"_ (guia de acessibilidade) — ou seja, a data que importa é a da **semana de estudo**, não a da capa.

📌 Desde a v15.0.1 o artigo de estudo **atual** aparece direto na aba Reuniões (v. seção 3). Os subtítulos do artigo e as perguntas de estudo fazem parte da página; as músicas inicial e final aparecem como itens da reunião.

### As escolhas de design por trás disso

1. **"Data de uso" como chave de organização.** A Sentinela de estudo chega meses antes de ser estudada; o app organiza por semana de uso, não por publicação. É o mesmo princípio do seletor de semanas do meio de semana — **um único modelo mental para as duas reuniões**.
2. **O artigo de estudo é renderizado como conteúdo vivo** (não como atalho para PDF), com perguntas navegáveis.
3. **Discursos públicos não têm "programa" fixo no app** — o material do fim de semana concentra-se no estudo; o discurso é item de agenda com título e orador (fora do escopo do material digital).

### Como aplicar no bzs2pt

💡 O bzs2pt já nasceu com o modelo "data de uso":

- `TipoPub "sentinela"` + `extrairIntervaloSemana(texto)` e `intervaloDaPublicacao(p)` (`src/lib/study-dates.ts`) produzem o `intervalo {inicio, fim}` em ISO; `ordenarSemanasCronologicamente` e `escolherSemanaInicial` fazem a navegação.
- O **título da tela de estudo** (`estudo.$id.tsx`, `.publication-title`) pode adotar o formato JW _"Estudo de A Sentinela: <intervalo>"_ quando a publicação tiver intervalo — hoje o título é o `p.titulo` cru. Ajuste de baixo custo e alto ganho de reconhecimento (seção 10, M1).
- As três cores de seção não se aplicam à Sentinela (é estudo com subtítulos) — o bzs2pt já trata isso: `data-secao` só existe no workbook-reader, e os subtítulos da Sentinela usam `--reference` (`.workbook-paragraph[data-estilo="subtitulo"]`, `src/styles.css` ~181; no Leitor esses parágrafos recebem a classe `watchtower-paragraph`, `estudo.$id.tsx` ~1135).
- **Decisão do dono (05/11/2026):** a Sentinela tem mais elementos que merecem destaque próprio — interface mais parecida com o app, e ainda assim bonita e usável: **subtítulos** (hoje `--reference`), **quadros informativos** (já detectados no parse como `data-faixa="true"`, via `.du-bgColor--bgSecondary` — `publication-layout.ts:29`) e **perguntas de estudo** (classe `publication-question` via `Paragrafo.pergunta`). Tratamento proposto na seção 10, M7.

---

## 6. Mídia da reunião — "Show Media"

### O que é fato

📌 A página **Show Media** é a superfície de mídia da aba Reuniões (guia de acessibilidade + notas de versão): botões de reprodução e download, imagens ampliáveis, **seção History** com itens abertos recentemente, e o botão **More Songs** (restaurado na v15.4.2 justamente por ser essencial para o fim de semana).

📌 O download é sempre **explícito e dimensionado**: o guia de configuração mostra o fluxo tocando no ícone de nuvem e escolhendo qualidade com o custo declarado — _"720p (31 MB)"_ — e recomenda a maior qualidade disponível. 👁 Nas capturas, cada thumbnail de vídeo carrega o overlay de **nuvem de download** e o **badge de duração** (▶ `1:17`, `3:34`…) sobreposto no canto.

### As escolhas de design por trás disso

1. **Mídia agrupada pela semana da reunião, não pela publicação.** A página mostra tudo o que a _reunião_ vai usar — vídeos, imagens, músicas — em uma lista única ordenada pela agenda. O usuário de som/multimídia não caça por publicação.
2. **Custo de rede sempre visível** (MB por qualidade): nada de download "invisível". Em redes frágeis, o usuário decide com número na mão.
3. **Estado do download sempre desenhado:** nuvem = não baixado; ícone de reprodução = pronto. Não existe meio-estado ambíguo.
4. **Histórico curto e útil:** o que foi aberto recentemente volta à mão sem navegação.

### Como aplicar no bzs2pt

💡 Estado atual do bzs2pt: o painel de referências/vídeos (`PainelReferencia`, `src/routes/estudo.$id.tsx` ~linha 759) busca vídeo da referência, importa e abre em miniatura; o player embutido do Leitor tem tempo/duração/velocidade (`tocando/tempo/dur/vel`). O que faltaria para o padrão JW — **arquivado por decisão do dono (05/11/2026): não haverá painel de mídias**; a mídia segue onde está hoje (player do Leitor + `PainelReferencia`), e a descrição do JW acima permanece só como referência de padrão:

- _(arquivado)_ **Badge de duração sobre a thumbnail** do vídeo (👁 padrão JW em toda lista de mídia).
- _(arquivado)_ **Estado "offline/baixado"** para imagens já salvas (`guardarImagem` em `src/lib/publication-layout.ts` já persiste as imagens; falta o _indicador_).
- _(arquivado)_ **Custo em MB quando houver download** de mídia grande.

---

## 7. Sistema visual completo

### 7.1 Cores

| Papel                                                                      | JW Library (mobile)                                                                                                                                                                                                                    | bzs2pt hoje                                                                                                                      |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Acento de interface** (abas ativas, links de ação, cabeçalhos de cartão) | 👁 roxo, aprox. `#7B5EA7`, único e fixo                                                                                                                                                                                                 | ✅ **16 cores configuráveis** (`CORES_INTERFACE`, `src/lib/appearance.ts`), padrão Lilás `#76528f` — quase idêntico ao JW        |
| **Cores de seção do workbook**                                             | 👁 azul-petróleo / âmbar / vermelho escuro                                                                                                                                                                                              | ✅ 1:1 (`--sec-tesouros #3c6f80`, `--sec-ministerio #b8860b`, `--sec-vida #9b2c2c` + variantes dark em `src/styles.css:106-107`) |
| **Cor de referência/escritura**                                            | 👁 azul (links de versículo e subtítulos de estudo)                                                                                                                                                                                     | ✅ `--reference: #286da8` claro / `#86bce5` escuro                                                                               |
| **Destaque de texto (highlight)**                                          | 📌 seleção → menu de contexto → cor; a base de usuários documenta sistemas próprios (amarelo = escritura, verde = aplicação, roxo = teocracia etc.); o número de cores cresceu ao longo dos anos (4 em 2015 segundo jwtalk; hoje mais) | ✅ **16 cores fixas** por seleção de texto (`marcar(cor)`, `src/routes/estudo.$id.tsx` ~311) — mais completo que o JW            |
| **Tema**                                                                   | 📌 claro/escuro; dark verdadeiro (preto)                                                                                                                                                                                               | ✅ `aplicarTema` com `sistema/claro/escuro` e `theme-color` `#000000`/`#f5f5f5` (`src/lib/appearance.ts:38`)                     |

Duas leituras de design:

1. **O JW é conservador na interface, rico no conteúdo.** Uma única cor de acento (roxo), superfícies neutras, e **toda a variedade cromática concentrada onde o conteúdo fala**: seções do workbook, destaque do usuário, links de escritura. O bzs2pt inverteu um pouco isso (16 cores de acento de interface) — funciona porque as cores de conteúdo continuam fixas; mas se um dia o app parecer "colorido demais", o caminho JW é conter o acento, não as seções.
2. **Dark mode não é filtro, é paleta própria.** As cores de seção do JW (e as do bzs2pt, linhas 106–107) são recalibradas para dark — mais claras e dessaturadas (`#3c6f80 → #6fa8b8`) para manter contraste sobre preto. Nunca reutilizar as cores do claro.

### 7.2 Tipografia e hierarquia

👁 (capturas + padrão editorial do workbook)

- **Banners de seção:** caixa alta, peso forte, espaçamento generoso, branco sobre a cor da seção.
- **Rótulos de atribuição:** negrito, mesmo tamanho do corpo — o tempo entre parênteses em peso normal.
- **Corpo:** fonte do sistema, parágrafos curtos, numeração de parágrafo discreta na margem.
- **Título da publicação/semana:** o maior peso da tela, centrado na barra de leitura (intervalo da semana) e na abertura do artigo.

💡 bzs2pt: `.publication-title` (1.4em, bold; versão workbook em caixa alta com `--muted-foreground`, `src/styles.css:161-162`) e os estilos por `data-estilo` (`secao/titulo/subtitulo/corpo/cantico`) já reproduzem essa hierarquia — incluindo a decisão de esconder as ferramentas do parágrafo em títulos e subtítulos (linhas 175–177), que é exatamente o comportamento do JW (elementos estruturais não recebem ação de marcação individual).

### 7.3 Componentes recorrentes

| Componente                    | JW Library                                                  | bzs2pt                                                                                                          |
| ----------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Cartão de capa com menu       | 👁 thumbnail + overlay "…" + nuvem de download               | ✅ cartões de estudo na home com ações por item                                                                 |
| Badge de duração em vídeo     | 👁 ▶ `m:ss` sobre a thumbnail                                | ❌ não existe ainda (oportunidade M4)                                                                           |
| Barra de leitura              | 👁 voltar + título da semana centrado + buscar/marcador/Aa/… | ✅ barra superior do Leitor com ferramentas                                                                     |
| Barra de abas inferior        | 👁 5 abas com ícone + rótulo                                 | ❌ home usa abas no topo (v. seção 2)                                                                           |
| Toolbar flutuante de marcação | 📌 menu de contexto após seleção                            | ✅ pill flutuante `rounded-full` (`estudo.$id.tsx` ~575) — equivalente funcional, com assinatura visual própria |
| Painel de estudo/referências  | 📌 painel lateral com notas, destaques e referências        | ✅ `PainelReferencia` com miniatura importável                                                                  |

---

## 8. Interações, limitações documentadas e acessibilidade

### O que é fato (e onde o JW Library falha — a parte mais valiosa do guia)

📌 O guia de acessibilidade documenta, com reproducão, comportamentos que **não devemos copiar**:

1. **As caixas de resposta têm rótulos idênticos entre si** para o leitor de tela — impossível saber qual pergunta é qual sem navegar por contexto.
2. **Respostas digitadas são perdidas ao sair da publicação.** O trabalho de preparação morre quando a tela fecha.
3. **Destaques são desativados com VoiceOver em execução** — o recurso some para quem mais precisaria.
4. **Marcadores (bookmarks) podem ser criados, mas nunca excluídos.**

📌 Gestos do VoiceOver na aba Reuniões: navegação por cabeçalhos via rotor (as seções da reunião são cabeçalhos reais); deslizar com 3 dedos troca entre Workbook e Sentinela; toque duplo abre.

### Como aplicar no bzs2pt

💡 O item 2 é uma **vantagem estrutural do bzs2pt** que vale explodir: nossas anotações/respostas persistem no IndexedDB (`src/lib/db.ts`) e sobrevivem a sessões — o JW Library perde as respostas digitadas no workbook. É diferencia real e deve entrar na comunicação do app.

Checklist de acessibilidade para o Leitor (custo baixo, sem mudança de fluxo):

- `aria-label` descritivo e **único por parágrafo** nas ferramentas flutuantes (evitar o defeito nº 1 do JW — rótulos iguais);
- manter a marcação funcional com leitor de tela ativo (defeito nº 3);
- alvos de toque ≥ 44 px nas tools do parágrafo;
- cabeçalhos reais (`<h2>/<h3>`) por seção, para rotor/navegação — hoje as seções são `div` estilizadas (`data-estilo="secao"`).

---

## 9. Tabela-mestre de mapeamento

| #   | Escolha do JW Library                                                   | Estado no bzs2pt                                          | Onde / o que fazer                                                |
| --- | ----------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | Reuniões como aba de 1º nível (1 toque)                                 | ✅ equivalente: abas por tipo na home                     | `src/routes/index.tsx`                                            |
| 2   | Página única da semana (meio de semana + fim de semana juntos, v15.4.1) | ❌ hoje separado por tipo                                 | ✅ **decidido (05/11): aba Estudo com 2 cápsulas** — seção 10, M2 |
| 3   | Auto-seleção da semana atual                                            | ✅ `escolherSemanaInicial` + scroll automático            | `src/lib/study-dates.ts`, `index.tsx`                             |
| 4   | Aviso honesto quando o conteúdo da semana falta                         | ✅ texto de semana não importada                          | `index.tsx` ~141                                                  |
| 5   | Cores de seção como código (petróleo/âmbar/vermelho)                    | ✅ 1:1 com o workbook                                     | `src/styles.css:106-107`, `publication-layout.ts`                 |
| 6   | Banner preenchido × texto colorido                                      | ⚠️ bzs2pt usa texto colorido (escolha própria, mais leve) | ✅ **decidido (05/11): adotar faixa preenchida** — M3             |
| 7   | Tempo da parte junto ao rótulo                                          | ✅ estrutura `resposta`/`faixa`                           | `db.ts`, `publication-layout.ts`                                  |
| 8   | Referências como links precisos (¶)                                     | ✅ painel de referências clicável                         | `PainelReferencia`, `estudo.$id.tsx`                              |
| 9   | Título por data de uso (estudo + intervalo)                             | ⚠️ mostra título cru                                      | M1: formatar título com intervalo                                 |
| 10  | Mídia da semana agrupada + History                                      | ⚠️ mídia por referência, sem histórico                    | ❌ **descartado (05/11): sem painel de mídias**                   |
| 11  | Badge de duração em vídeo                                               | ❌                                                        | ❌ descartado (sem painel de mídias)                              |
| 12  | Download com custo (MB) explícito                                       | ❌                                                        | ❌ descartado (sem painel de mídias)                              |
| 13  | Destaque com paleta ampla                                               | ✅ 16 cores por seleção                                   | `marcar(cor)`                                                     |
| 14  | Acento de interface único e discreto                                    | ⚠️ bzs2pt tem 16 (escolha própria)                        | manter; conter se parecer colorido                                |
| 15  | Dark mode com paleta recalibrada                                        | ✅ seções recalibradas p/ dark                            | `styles.css:106-107`                                              |
| 16  | Respostas/notas persistidas                                             | ✅ **melhor que o JW** (que perde as respostas)           | `db.ts` (IndexedDB)                                               |
| 17  | Acessibilidade real (rotor, rótulos únicos)                             | ⚠️ parcial                                                | checklist da seção 8                                              |
| 18  | Rótulo de versão visível                                                | ✅ `ROTULO_BUILD` no rodapé e no BackupDialog             | `build.ts`, `BackupDialog.tsx`                                    |

---

## 10. Oportunidades priorizadas (respeitando o AGENTS.md)

**Decisões do dono — 05/11/2026** (registradas acima e aplicadas a este plano):

1. **Sem aba Referência** — não existe e não deve existir; `"referencia"` segue apenas como marcador interno das importações do Painel de referências.
2. **Aba Estudo única:** meio de semana e fim de semana na mesma página, em **duas cápsulas empilhadas** (meio em cima, fim embaixo); a aba **Extras** permanece. Se a semana tem só um dos estudos, o que existe aparece normal e o ausente exibe estado vazio próprio ("não possui o estudo do fim de semana", e vice-versa).
3. **Banner de seção fiel ao JW:** faixa preenchida com `var(--publication-section)` e texto branco.
4. **Sentinela com destaques próprios** para subtítulos, quadros informativos e perguntas — mais parecida com o app, bonita e usável.
5. **Sem painel de mídias** — M4 e M5 arquivados.

Nenhuma das oportunidades abaixo cria guarda/detector/recusa — todas são **adições de renderização ou reorganização da home**, de baixo risco para o fluxo que funciona. Uma mudança por vez, `npm run test` antes de cada commit, bump em `src/lib/build.ts`, e sincronização/publicação no Lovable ao final.

**Ordem de execução proposta:**

- **M2 — Aba "Estudo" com duas cápsulas** (redesign da home). As abas passam a ser `Estudo` + `Extras`; o chip de semanas lista a **união** das semanas de `apostila` ∪ `sentinela`; emparelhamento meio↔fim pelo `intervaloDaPublicacao` (mesma segunda-feira; fallback: intervalos que se sobrepõem; fallback: texto de semana idêntico). Cápsula com rótulo da reunião, semana, título e link para o Leitor; estado vazio nomeado quando faltar um dos dois; estado geral "Nenhum estudo importado" quando a união estiver vazia. Arquivo: `src/routes/index.tsx` (sem parser novo).
- **M3 — Banner de seção fiel** em `.workbook-paragraph[data-estilo="secao"]`: fundo `var(--publication-section)`, texto e ícone brancos, faixa full-bleed (`margin-inline: -24px`, como `data-faixa`). Arquivo: `src/styles.css`.
- **M7 — Destaques da Sentinela** (reader `watchtower-paragraph`): quadros (`data-faixa="true"`) como cartão destacado com fundo suave e borda; perguntas (`publication-question`) com tratamento tipográfico próprio; subtítulos mantêm `--reference`. Arquivos: `src/styles.css` (+ ajustes pontuais em `estudo.$id.tsx` se faltar dado de renderização).
- **M1 — Título com intervalo de semana** no Leitor: _"Estudo de A Sentinela · 26 out–1º nov"_ (usar `intervaloDaPublicacao`). Arquivo: `estudo.$id.tsx`.
- **M6 — A11y mínima:** `aria-label` único por parágrafo nas tools + cabeçalhos anunciados por seção (`role="heading"`/`aria-level`, preservando seleção e sincronismo). Arquivos: `estudo.$id.tsx`, `styles.css`.

**Arquivados (decisão "sem painel de mídias"):** ~~M4 — badge de duração~~; ~~M5 — histórico de itens abertos~~. Revisitáveis só se o `PainelReferencia` crescer por demanda própria.

**O que NÃO fazer (pela assimetria do AGENTS.md):** nenhuma "validação nova" de conteúdo importado, nenhum detector de página ruim adicional, nenhuma restrição de marcação por tipo de parágrafo. O custo/falha desses guarda-custo está dimensionado no AGENTS.md e no DIRETRIZES.md — o JW Library, com todos os recursos, ainda perde respostas do usuário e esconde destaque com VoiceOver: funcionalidade simples e persistente vale mais que blindagem.

---

## 11. Fontes consultadas

1. App Store (EUA) — JW Library, histórico de versões: <https://apps.apple.com/us/app/jw-library/id672417831>
2. Ajuda oficial JW Library (iOS) — recursos principais: <https://www.jw.org/en/online-help/jw-library/apple/features>
3. Ajuda oficial JW Library (Android) — recursos principais: <https://www.jw.org/en/online-help/jw-library/android/features>
4. Ajuda oficial JW Library (Android) — índice: <https://www.jw.org/en/online-help/jw-library>
5. Funções do JW Library (PT): <https://www.jw.org/pt/ajuda-online/jw-library/recursos>
6. Guia de acessibilidade — The Meetings Tab: <http://curiousnetentity.com/JWLibrary/4Meetings>
7. Workbook oficial (descrição): <https://www.jw.org/en/library/jw-meeting-workbook>
8. Guia de configuração para reuniões (glitter.io): <https://www.glitter.io/guides/how-to-set-up-jw-library-for-meetings-step-by-step-guide>
9. Discussões de usuários sobre cores de destaque (jwtalk.net, tópico 24652)

**Capturas incluídas** (`docs/img/`): home do JW Library em iPhone (fonte: Reddit, via busca de imagens); Meeting Workbook em iPad (fonte: YouTube); tela de Playlists; ícone do app. Uso interno de referência de design.
