// ─────────────────────────────────────────────────────────────────────────────
// Cliente da API do Portal do Cliente. O Portal NÃO tem segredos (nem mesmo o de
// assinatura): guarda o token do cliente em cookie httpOnly e o repassa
// SERVER-SIDE — a API é o único ponto de validação. Falha/expiração ⇒ null (a
// página orienta a pedir novo link à AHRI — nunca "login").
// ─────────────────────────────────────────────────────────────────────────────

// Runtime (não NEXT_PUBLIC — inline de build): URL interna do servidor MAIN.
const API_BASE = process.env['API_URL'] ?? 'http://localhost:3001';

export type EstadoPresenca = 'atenta' | 'serena' | 'repouso';

export interface EtapaTimeline {
  titulo: string;
  situacao: 'concluida' | 'atual' | 'futura';
}

export interface AcompanhamentoCliente {
  clienteId: string;
  quem: string;
  presenca: EstadoPresenca;
  fraseAbertura: string;
  ondeEsta: string;
  agora: string;
  proximoPasso: string;
  precisaFazerAlgo: string;
  quantoTempo: string;
  etapas: EtapaTimeline[];
  estimativaDias: number;
  estimativaAte: string | null;
  advogado: { nome: string } | null;
  processo: { numero: string } | null;
  atualizacoes: Array<{ quando: string; texto: string }>;
  documentosRecebidos: string[];
  whatsapp: string;
}

export async function fetchAcompanhamento(token: string): Promise<AcompanhamentoCliente | null> {
  try {
    const res = await fetch(`${API_BASE}/cliente/acompanhamento`, {
      cache: 'no-store',
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as AcompanhamentoCliente;
  } catch {
    return null;
  }
}
