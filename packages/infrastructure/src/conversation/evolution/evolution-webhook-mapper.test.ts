// ─────────────────────────────────────────────────────────────────────────────
// Testes do EVOLUTION WEBHOOK MAPPER — cobre as doze naturezas de entrada, ignora
// mensagens próprias (fromMe) e devolve null para payloads irreconhecíveis.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { mapEvolutionUpsert } from './evolution-webhook-mapper.js';

function upsert(message: unknown, keyOver: Record<string, unknown> = {}): unknown {
  return {
    event: 'messages.upsert',
    instance: 'ahri',
    data: {
      key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'MSG1', ...keyOver },
      pushName: 'Cliente',
      message,
      messageTimestamp: 1_760_000_000,
    },
  };
}

describe('mapEvolutionUpsert', () => {
  it('texto simples (conversation)', () => {
    const env = mapEvolutionUpsert(upsert({ conversation: 'oi tudo bem?' }));
    expect(env?.kind).toBe('text');
    expect(env?.text).toBe('oi tudo bem?');
    expect(env?.chatId).toBe('5511999999999@s.whatsapp.net');
    expect(env?.messageId).toBe('MSG1');
  });

  it('texto estendido (extendedTextMessage)', () => {
    const env = mapEvolutionUpsert(upsert({ extendedTextMessage: { text: 'preciso de ajuda' } }));
    expect(env?.kind).toBe('text');
    expect(env?.text).toBe('preciso de ajuda');
  });

  it('imagem com legenda', () => {
    const env = mapEvolutionUpsert(
      upsert({ imageMessage: { caption: 'olha isso', mimetype: 'image/jpeg', url: 'enc://x' } }),
    );
    expect(env?.kind).toBe('image');
    expect(env?.text).toBe('olha isso');
    expect(env?.mediaMimeType).toBe('image/jpeg');
  });

  it('áudio', () => {
    const env = mapEvolutionUpsert(upsert({ audioMessage: { mimetype: 'audio/ogg', url: 'enc://a', ptt: true } }));
    expect(env?.kind).toBe('audio');
    expect(env?.mediaMimeType).toBe('audio/ogg');
  });

  it('pdf vs documento genérico pelo mimetype', () => {
    const pdf = mapEvolutionUpsert(
      upsert({ documentMessage: { fileName: 'rg.pdf', mimetype: 'application/pdf', url: 'enc://d' } }),
    );
    expect(pdf?.kind).toBe('pdf');
    expect(pdf?.fileName).toBe('rg.pdf');
    const doc = mapEvolutionUpsert(
      upsert({ documentMessage: { fileName: 'planilha.xlsx', mimetype: 'application/vnd.ms-excel', url: 'enc://d' } }),
    );
    expect(doc?.kind).toBe('document');
  });

  it('localização', () => {
    const env = mapEvolutionUpsert(
      upsert({ locationMessage: { degreesLatitude: -23.5, degreesLongitude: -46.6, name: 'Fórum' } }),
    );
    expect(env?.kind).toBe('location');
    expect(env?.location).toEqual({ latitude: -23.5, longitude: -46.6, name: 'Fórum' });
  });

  it('contato com telefone do vcard', () => {
    const vcard = 'BEGIN:VCARD\nFN:Dr. João\nTEL;waid=5511888888888:+55 11 88888-8888\nEND:VCARD';
    const env = mapEvolutionUpsert(upsert({ contactMessage: { displayName: 'Dr. João', vcard } }));
    expect(env?.kind).toBe('contact');
    expect(env?.contact?.displayName).toBe('Dr. João');
    expect(env?.contact?.phones).toContain('5511888888888');
  });

  it('reação', () => {
    const env = mapEvolutionUpsert(upsert({ reactionMessage: { text: '👍', key: { id: 'MSG0' } } }));
    expect(env?.kind).toBe('reaction');
    expect(env?.reactionEmoji).toBe('👍');
    expect(env?.reactionToMessageId).toBe('MSG0');
  });

  it('exclusão (protocolMessage REVOKE)', () => {
    const env = mapEvolutionUpsert(upsert({ protocolMessage: { type: 'REVOKE', key: { id: 'MSG0' } } }));
    expect(env?.kind).toBe('delete');
    expect(env?.deletedMessageId).toBe('MSG0');
  });

  it('edição (protocolMessage MESSAGE_EDIT)', () => {
    const env = mapEvolutionUpsert(
      upsert({
        protocolMessage: { type: 'MESSAGE_EDIT', key: { id: 'MSG0' }, editedMessage: { conversation: 'texto corrigido' } },
      }),
    );
    expect(env?.kind).toBe('edit');
    expect(env?.editedText).toBe('texto corrigido');
  });

  it('ignora mensagens próprias (fromMe)', () => {
    expect(mapEvolutionUpsert(upsert({ conversation: 'eco' }, { fromMe: true }))).toBeNull();
  });

  it('payload irreconhecível → null', () => {
    expect(mapEvolutionUpsert({ foo: 'bar' })).toBeNull();
    expect(mapEvolutionUpsert(upsert({ unknownMessage: {} }))).toBeNull();
  });
});

describe('Regressão GO-LIVE · from NUNCA vazio (a causa real do HISCON travado)', () => {
  // Em chat DIRETO a Evolution envia participant como STRING VAZIA; `'' ?? x`
  // devolve '' ⇒ from vazio ⇒ R1 rejeitava a Pessoa ("Identidade civil
  // ausente", DF-23) ⇒ nenhum evento nascia em produção.
  it("participant='' (chat direto) ⇒ from = chatId", () => {
    const env = mapEvolutionUpsert(upsert({ conversation: 'oi' }, { participant: '' }));
    expect(env?.from).toBe('5511999999999@s.whatsapp.net');
  });
  it('participant ausente ⇒ from = chatId', () => {
    const env = mapEvolutionUpsert(upsert({ conversation: 'oi' }));
    expect(env?.from).toBe('5511999999999@s.whatsapp.net');
  });
  it('participant REAL (grupo) ⇒ from = participant', () => {
    const env = mapEvolutionUpsert(upsert({ conversation: 'oi' }, { participant: '5511888888888@s.whatsapp.net' }));
    expect(env?.from).toBe('5511888888888@s.whatsapp.net');
  });
  it('o PDF do cenário real sai com from preenchido', () => {
    const env = mapEvolutionUpsert(
      upsert(
        { documentMessage: { fileName: 'extrato_emprestimo_consignado_completo_030726.pdf', mimetype: 'application/pdf', url: 'enc://d' } },
        { participant: '' },
      ),
    );
    expect(env?.kind).toBe('pdf');
    expect(env?.from).toBe('5511999999999@s.whatsapp.net');
  });
});
