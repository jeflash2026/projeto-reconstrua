// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE CONHECIMENTO — CONSIGNADO INSS (GO-LIVE 9G). Os fatos que a AHRI
// aprende conversando com clientes de empréstimo consignado do INSS.
//
// Este arquivo é o LADO DO DOMÍNIO: o motor (conversation-knowledge.ts) é
// genérico e conhece apenas fatos; trocar este catálogo troca o produto
// (AHRI Business/Life terão os seus). Detecção determinística (regex sobre a
// resposta normalizada em minúsculas), com contexto da pergunta anterior quando
// a resposta sozinha não basta (ex.: "sim" para "mais de um banco?").
// ─────────────────────────────────────────────────────────────────────────────
import type { CatalogoDeConhecimento, DeteccaoDeFato } from './conversation-knowledge.js';

const SIM = /^(sim|tenho|possuo|isso|exato|com certeza|uhum|aham)\b/;
const NAO = /^(n[ãa]o|nunca|negativo)\b/;

function respostaSimNao(resposta: string): 'true' | 'false' | null {
  if (SIM.test(resposta)) return 'true';
  if (NAO.test(resposta)) return 'false';
  return null;
}

export const CATALOGO_CONSIGNADO_INSS: CatalogoDeConhecimento = [
  {
    factKey: 'beneficio',
    detectar: (r): DeteccaoDeFato | null => {
      if (/bpc|loas/.test(r)) return { valor: 'bpc' };
      if (/pens[ãa]o|pensionista/.test(r)) return { valor: 'pensao' };
      if (/aposentad/.test(r)) return { valor: 'aposentadoria' };
      return null;
    },
  },
  {
    factKey: 'problema_principal',
    detectar: (r): DeteccaoDeFato | null => {
      if (/(descont\w*[^.?!]*n[ãa]o (reconhe|autoriz))|(n[ãa]o reconhe[çc]o[^.?!]*descont)/.test(r))
        return { valor: 'descontos_nao_reconhecidos' };
      if (/empr[ée]stimo[^.?!]*n[ãa]o (fiz|contratei|pedi|solicitei)/.test(r)) return { valor: 'emprestimo_nao_contratado' };
      if (/juros?[^.?!]*(abusiv|muito alto|alt[oa]s? demais)/.test(r)) return { valor: 'juros_abusivos' };
      if (/(parcela|desconto)[^.?!]*(errad|maior|a mais)/.test(r)) return { valor: 'desconto_errado' };
      return null;
    },
  },
  {
    factKey: 'tempo_do_problema',
    detectar: (r): DeteccaoDeFato | null => {
      if (/mais de (dois|2) anos|h[áa]\s+(uns\s+)?([2-9]|\d{2,})\s+anos|faz\s+(uns\s+)?([2-9]|\d{2,})\s+anos/.test(r))
        return { valor: 'mais_de_2_anos' };
      if (/h[áa]\s+(um|1)\s+ano|faz\s+(um|1)\s+ano/.test(r)) return { valor: 'cerca_de_1_ano' };
      if (/recente|esse m[êe]s|m[êe]s passado|semana|dias|come[çc]ou agora/.test(r)) return { valor: 'recente' };
      return null;
    },
  },
  {
    factKey: 'multiplos_bancos',
    detectar: (r, pergunta): DeteccaoDeFato | null => {
      if (/(mais de um|v[áa]rios|dois|tr[êe]s|2|3)\s+bancos/.test(r)) return { valor: 'true' };
      if (/(um|1)\s+banco s[óo]|s[óo] um banco|apenas um banco/.test(r)) return { valor: 'false' };
      // "Sim"/"Não" só ensinam diante da pergunta certa (contexto da 9F).
      if (pergunta !== null && /banco/.test(pergunta)) {
        const sn = respostaSimNao(r);
        if (sn !== null) return { valor: sn, confianca: 'media' };
      }
      return null;
    },
  },
  {
    factKey: 'documentacao_mencionada',
    detectar: (r): DeteccaoDeFato | null => {
      if (/hiscon|hist[óo]rico de (empr[ée]stimos? )?consignad/.test(r)) return { valor: 'hiscon' };
      if (/extrato do inss|extrato de (empr[ée]stimo|pagamento)/.test(r)) return { valor: 'extrato_inss' };
      if (/contracheque|holerite/.test(r)) return { valor: 'contracheque' };
      return null;
    },
  },
  {
    factKey: 'interesse',
    detectar: (r): DeteccaoDeFato | null => {
      if (/revis[ãa]o|revisar|rever (os )?contratos?/.test(r)) return { valor: 'revisao_consignado' };
      if (/cancelar (o )?(desconto|empr[ée]stimo)|parar de descontar/.test(r)) return { valor: 'cancelamento' };
      if (/devolu[çc][ãa]o|dinheiro de volta|reembolso/.test(r)) return { valor: 'devolucao_valores' };
      return null;
    },
  },
];
