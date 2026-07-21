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
