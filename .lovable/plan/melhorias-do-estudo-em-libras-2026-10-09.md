# Melhorias do Estudo em Libras

## Objetivo

Deixar o aplicativo mais próximo da experiência visual do JW Library, abrir automaticamente o estudo da semana atual e fortalecer os pontos mais importantes para uso diário no celular: importação, segurança dos dados e leitura com vídeo.

## Etapa 1 — Visual inspirado no JW Library

- Trocar o tema escuro azul-amarelado por uma paleta neutra: fundo cinza quase preto, superfícies cinza-escuras, texto suave e azul somente para ações e seleção.
- Ajustar o tema claro para manter a mesma identidade, sem alterar a organização já conhecida.
- Reduzir o excesso de cartões, contornos, sombras e formas muito arredondadas; usar divisores discretos e hierarquia mais próxima de um aplicativo de leitura.
- Adaptar as cores do marca-texto no tema escuro para tons menos luminosos, preservando a legibilidade do texto.
- Oferecer três opções de aparência: claro, escuro e seguir o celular.
- Manter os controles confortáveis para toque e revisar contraste e tamanho do texto.

> A JW não publica os códigos oficiais das cores. A implementação será uma aproximação visual cuidadosa do JW Library atual, não uma cópia de tokens oficiais.

## Etapa 2 — Semana atual em primeiro lugar

- Passar a registrar em cada estudo a data inicial e final da semana, além do texto que já aparece na tela.
- Reconhecer variações como “5–11 de outubro” e “12–18 de outubro de 2026”, inclusive na virada de mês e de ano.
- Ao abrir cada aba, selecionar automaticamente o estudo cuja faixa contém a data de hoje.
- Se a semana atual não estiver importada, selecionar a semana anterior mais recente e indicar discretamente que ela não é a semana atual.
- Exibir as semanas em uma faixa horizontal: semana selecionada ao centro, semanas vizinhas acessíveis com deslize ou toque.
- Guardar separadamente a escolha manual feita em A Sentinela e na Apostila durante a sessão; ao voltar depois, a semana atual volta a ser a prioridade.
- Ordenar pela data do estudo, e não pela data em que foi importado.
- Para estudos antigos já salvos, calcular as datas quando possível; se o texto for ambíguo, mantê-los acessíveis sem inventar uma data.

## Etapa 3 — Importação mais confiável

- Detectar estudos já importados pelo endereço de origem e impedir duplicatas acidentais.
- Mostrar o andamento artigo por artigo: aguardando, importando, concluído ou com erro, mantendo o cronômetro discreto.
- Permitir tentar novamente somente os itens que falharam, sem repetir os concluídos.
- Preservar a seleção atual de artigos e apresentar um resumo claro ao terminar.
- Melhorar as mensagens de erro para distinguir página indisponível, vídeo não encontrado, tempos ausentes e falha temporária.
- Manter a busca direta pelo aplicativo como caminho principal e os proxies públicos apenas como contingência.

## Etapa 4 — Backup local completo

- Criar uma área “Backup e restauração” acessível pela biblioteca.
- Exportar um único arquivo com publicações, parágrafos, tempos ajustados, itens ocultos, notas e marcações.
- Antes de restaurar, validar o arquivo e mostrar quantos estudos e registros serão recuperados.
- Permitir escolher entre mesclar com o conteúdo atual ou substituir tudo, com confirmação reforçada para substituição.
- Registrar a versão do formato para que backups continuem restauráveis após futuras atualizações.
- Tudo permanece privado no aparelho; nenhum dado de estudo será enviado para uma conta ou servidor.

## Etapa 5 — Leitura e vídeo

- Simplificar visualmente a barra do vídeo, deixando reprodução, progresso e velocidade como ações principais.
- Manter gestos, sincronização manual protegida, itens ocultos e edição de marcações já existentes.
- Melhorar a indicação do trecho ativo sem competir com marca-textos e notas.
- Levar o trecho ativo para a área visível somente quando necessário, sem causar saltos enquanto a pessoa estiver lendo manualmente.
- Adicionar estados acessíveis aos controles e ao trecho atual, além de foco correto ao abrir e fechar painéis.
- Tratar carregamento e erro do vídeo com mensagens curtas e ações úteis, sem conteúdo herdado da página importada.

## Etapa 6 — Offline de verdade

- Manter todos os estudos e anotações no aparelho, como hoje.
- Preparar o aplicativo para abrir sem internet depois do primeiro acesso, incluindo a estrutura da biblioteca e do leitor.
- Indicar claramente que novas importações e vídeos externos ainda precisam de conexão.
- Não prometer reprodução offline do vídeo nesta etapa; isso exigiria download e espaço de armazenamento próprios.

## Ordem de execução

1. Visual e sistema de aparência.
2. Datas normalizadas e navegação semanal.
3. Importação confiável.
4. Backup e restauração.
5. Refinos de leitura e vídeo.
6. Funcionamento offline da interface.

Cada etapa será validada no celular e no computador antes da próxima, preservando estudos já importados e sem adicionar servidor de dados.

## Detalhes técnicos

- Evoluir o banco local sem apagar dados existentes, acrescentando datas normalizadas e preferências necessárias.
- Separar interpretação de datas, importação e apresentação para facilitar testes e reduzir regressões.
- Criar testes para semanas atuais, viradas de mês/ano, duplicatas, backup/restauração e falhas parciais de importação.
- Respeitar movimento reduzido e manter os temas baseados nos tokens visuais globais.