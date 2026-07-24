// ─────────────────────────────────────────────────────────────────────────────
// GEO — DDD do telefone → UF (estado). Sinal UNIVERSAL: todo cliente tem número
// de WhatsApp, e o DDD identifica o estado com precisão (mais confiável que a
// cidade digitada, que vem solta e às vezes errada). Usado no Mapa de Clientes.
// ─────────────────────────────────────────────────────────────────────────────

/** DDD (2 dígitos) → sigla da UF. Tabela oficial dos códigos de área do Brasil. */
export const DDD_UF: Readonly<Record<string, string>> = {
  // Sudeste
  '11': 'SP',
  '12': 'SP',
  '13': 'SP',
  '14': 'SP',
  '15': 'SP',
  '16': 'SP',
  '17': 'SP',
  '18': 'SP',
  '19': 'SP',
  '21': 'RJ',
  '22': 'RJ',
  '24': 'RJ',
  '27': 'ES',
  '28': 'ES',
  '31': 'MG',
  '32': 'MG',
  '33': 'MG',
  '34': 'MG',
  '35': 'MG',
  '37': 'MG',
  '38': 'MG',
  // Sul
  '41': 'PR',
  '42': 'PR',
  '43': 'PR',
  '44': 'PR',
  '45': 'PR',
  '46': 'PR',
  '47': 'SC',
  '48': 'SC',
  '49': 'SC',
  '51': 'RS',
  '53': 'RS',
  '54': 'RS',
  '55': 'RS',
  // Centro-Oeste
  '61': 'DF',
  '62': 'GO',
  '64': 'GO',
  '63': 'TO',
  '65': 'MT',
  '66': 'MT',
  '67': 'MS',
  // Norte
  '68': 'AC',
  '69': 'RO',
  '91': 'PA',
  '93': 'PA',
  '94': 'PA',
  '92': 'AM',
  '97': 'AM',
  '95': 'RR',
  '96': 'AP',
  '98': 'MA',
  '99': 'MA',
  // Nordeste
  '71': 'BA',
  '73': 'BA',
  '74': 'BA',
  '75': 'BA',
  '77': 'BA',
  '79': 'SE',
  '81': 'PE',
  '87': 'PE',
  '82': 'AL',
  '83': 'PB',
  '84': 'RN',
  '85': 'CE',
  '88': 'CE',
  '86': 'PI',
  '89': 'PI',
};

/** UF → nome do estado (para exibição no mapa/ranking). */
export const UF_NOME: Readonly<Record<string, string>> = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};

/** UF a partir do telefone/JID brasileiro (55 + DDD + número). null se não for
 *  um número brasileiro reconhecível ou o DDD for desconhecido. */
export function ufDoTelefone(jidOuNumero: string): string | null {
  const dig = jidOuNumero.replace(/\D/g, '');
  // Brasil: 55 (país) + DDD(2) + número(8 ou 9). Total 12 ou 13 dígitos.
  if (!dig.startsWith('55') || dig.length < 12 || dig.length > 13) return null;
  return DDD_UF[dig.slice(2, 4)] ?? null;
}
