// ─────────────────────────────────────────────────────────────────────────────
// @reconstrua/application — PERÍCIA (Jornada B). B-R1: parser determinístico do
// HISCON (contratos por banco, janela de 5 anos). Puro; sem persistência.
// ─────────────────────────────────────────────────────────────────────────────
export * from './hiscon.js';
export * from './planilha.js';
export * from './perito-view.js';
// Decreto Dossiê Pericial (2026-07-21): parser DETALHADO do formato real em
// blocos (CONTRATO:/BANCO:/ORIGEM DA AVERBAÇÃO — migrados/modalidade/taxas).
export * from './hiscon-parser.js';
// Decreto 2026-07-21 (Financeiro): potencial de recuperação = o JÁ descontado
// até hoje, por contrato do HISCON (parcelas decorridas × valor da parcela).
export * from './potencial-recuperacao.js';
// Decreto 2026-08-04: o GUIA de classificação e agrupamento de contratos em
// AÇÕES (ativos 1=1 com exceção; excluídos por ano+banco; RMC/RCC separados).
export * from './acoes.js';
