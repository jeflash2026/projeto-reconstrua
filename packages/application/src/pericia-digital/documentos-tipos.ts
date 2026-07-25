// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL DE PERÍCIA DIGITAL · TIPOS DE DOCUMENTO (Decreto 2026-07-24, item 3)
// Catálogo canônico das categorias de documento do caso e a ORIGEM do envio.
// Puro — a infraestrutura registra os arquivos usando estas categorias.
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIAS_DOCUMENTO = [
  'HISCON',
  'CONTRATO_ELETRONICO',
  'CEDULA_CREDITO_BANCARIO',
  'COMPROVANTE_REFINANCIAMENTO',
  'CERTIFICADO_ASSINATURA',
  'TRILHA_AUDITORIA',
  'RELATORIO_LOGS',
  'COMPROVANTE_IP',
  'GEOLOCALIZACAO',
  'USER_AGENT',
  'IDENTIFICACAO_DISPOSITIVO',
  'IMEI_UUID',
  'SELFIE',
  'PROVA_DE_VIDA',
  'RELATORIO_BIOMETRIA',
  'RG',
  'CNH',
  'COMPROVANTE_BANCARIO',
  'COMPROVANTE_CREDITO',
  'MENSAGENS_SMS',
  'EMAILS',
  'GRAVACOES',
  'TERMOS_DE_ACEITE',
  'QR_CODES',
  'DOCUMENTOS_DO_BANCO',
  'DOCUMENTOS_DO_CLIENTE',
  'PECAS_DO_PROCESSO',
  'QUESITOS_DO_ADVOGADO',
  'OUTROS',
] as const;
export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[number];

export const CATEGORIA_ROTULO: Readonly<Record<CategoriaDocumento, string>> = {
  HISCON: 'HISCON',
  CONTRATO_ELETRONICO: 'Contrato eletrônico original',
  CEDULA_CREDITO_BANCARIO: 'Cédula de crédito bancário',
  COMPROVANTE_REFINANCIAMENTO: 'Comprovante de refinanciamento',
  CERTIFICADO_ASSINATURA: 'Certificado de conclusão da assinatura',
  TRILHA_AUDITORIA: 'Trilha de auditoria',
  RELATORIO_LOGS: 'Relatório de logs',
  COMPROVANTE_IP: 'Comprovante de IP',
  GEOLOCALIZACAO: 'Geolocalização',
  USER_AGENT: 'User-agent',
  IDENTIFICACAO_DISPOSITIVO: 'Identificação de dispositivo',
  IMEI_UUID: 'IMEI / UUID',
  SELFIE: 'Selfie',
  PROVA_DE_VIDA: 'Arquivo de prova de vida',
  RELATORIO_BIOMETRIA: 'Relatório de biometria',
  RG: 'RG',
  CNH: 'CNH',
  COMPROVANTE_BANCARIO: 'Comprovante bancário',
  COMPROVANTE_CREDITO: 'Comprovante do crédito',
  MENSAGENS_SMS: 'Mensagens SMS',
  EMAILS: 'E-mails',
  GRAVACOES: 'Gravações',
  TERMOS_DE_ACEITE: 'Termos de aceite',
  QR_CODES: 'QR Codes',
  DOCUMENTOS_DO_BANCO: 'Documentos apresentados pelo banco',
  DOCUMENTOS_DO_CLIENTE: 'Documentos apresentados pelo cliente',
  PECAS_DO_PROCESSO: 'Peças do processo',
  QUESITOS_DO_ADVOGADO: 'Quesitos do advogado',
  OUTROS: 'Outros documentos técnicos',
};

export function ehCategoriaDocumento(v: string): v is CategoriaDocumento {
  return (CATEGORIAS_DOCUMENTO as readonly string[]).includes(v);
}

/** Quem enviou o documento (origem) — para a cadeia de custódia e o parecer. */
export const ORIGENS_DOCUMENTO = ['BANCO', 'CLIENTE', 'ADVOGADO', 'PERITO', 'AHRI'] as const;
export type OrigemDocumento = (typeof ORIGENS_DOCUMENTO)[number];
