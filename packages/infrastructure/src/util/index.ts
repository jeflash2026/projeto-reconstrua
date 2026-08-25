// Utilitários binários sem dependência externa (nasceram no apps/api; movidos
// para cá em 2026-08-25 quando a integração Corvo passou a gerar ZIP/XLSX na
// infraestrutura — o apps/api reexporta, nada quebra).
export * from './zip.js';
export * from './xlsx.js';
