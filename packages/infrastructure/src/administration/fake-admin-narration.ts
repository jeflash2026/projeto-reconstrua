// ─────────────────────────────────────────────────────────────────────────────
// TemplateAdminNarration — narração DETERMINÍSTICA (stand-in do LLM, para testes/
// offline). Converte a resposta JÁ CALCULADA em frase humana. NUNCA decide, NUNCA
// inventa número: quando `available` é falso, diz honestamente que não tem o dado.
// Em produção, um LlmAdminNarration implementa o mesmo port (só linguagem).
// ─────────────────────────────────────────────────────────────────────────────
import type { AdminNarrationPort, NarrationInput } from '@reconstrua/application';

function str(value: string | number | boolean | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

export class TemplateAdminNarration implements AdminNarrationPort {
  narrate(input: NarrationInput): Promise<string> {
    if (!input.available && input.topic !== 'briefing' && input.topic !== 'recommendation') {
      return Promise.resolve(
        'Ainda não tenho esse dado — não vou inventar. Posso capturá-lo quando a fonte existir.',
      );
    }
    const f = input.facts;
    switch (input.topic) {
      case 'briefing':
        return Promise.resolve(
          `Bom dia, ${str(f['founder'])}. Enquanto você esteve ausente: ` +
            `${str(f['newClients'])} novos clientes, ${str(f['newDocuments'])} documentos, ` +
            `${str(f['newMissions'])} missões, ${str(f['newProcesses'])} processos e ` +
            `${str(f['newStages'])} etapas. Posso mostrar os detalhes.`,
        );
      case 'recommendation':
        return Promise.resolve(
          `Recomendo: ${str(f['recomendacao'])}. Fundamento: ${str(f['fundamento'])}. ` +
            `${str(f['aviso'])}.`,
        );
      default:
        return Promise.resolve(
          str(f['fact']) !== '' ? str(f['fact']) : 'Sem dados para esta pergunta.',
        );
    }
  }
}
