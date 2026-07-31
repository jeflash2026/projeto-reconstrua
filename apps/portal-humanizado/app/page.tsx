// A MESA DO ATENDIMENTO HUMANIZADO (Onda 2, decreto 2026-07-31) — a secretária
// vê SÓ os clientes que CONFIRMARAM o parecer (cadastro gerado):
//  • botão do WhatsApp HUMANIZADO (o número da equipe) com a orientação pronta;
//  • o anexo dos 3 documentos da fase 2 (procuração, RG f/v, comprovante);
//  • completos ⇒ 100% prontos para o perito protocolar o pedido administrativo.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { getJson, type ClienteHumanizado } from '../lib/api';
import { operadorDaSessao, HUMANIZADO_SESSION_COOKIE } from '../lib/session';
import { SairButton } from '../components/sair-button';
import DocsFase2 from '../components/docs-fase2';

export const dynamic = 'force-dynamic';

const SEGREDO_SESSAO = process.env['ADMIN_API_TOKEN'] ?? '';

function dataBr(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** A mensagem de ORIENTAÇÃO FINAL, pronta no WhatsApp da equipe. */
function linkWhatsApp(c: ClienteHumanizado): string {
  const primeiro = c.nome.split(/\s+/)[0] ?? c.nome;
  const texto =
    `Olá, ${primeiro}! Aqui é da equipe do *Projeto Reconstrua*. Recebemos a sua confirmação — ` +
    'agora vamos concluir o seu cadastro para o advogado te representar. Preciso que você me ' +
    'envie por aqui: 1) a *procuração assinada* (vou te enviar o documento), 2) o *RG (frente e ' +
    'verso)* ou CNH, e 3) um *comprovante de endereço*. Pode mandar as fotos por aqui mesmo. ' +
    'Qualquer dúvida, estou à disposição!';
  return `https://wa.me/${c.telefone}?text=${encodeURIComponent(texto)}`;
}

const Badge = ({ ok, rotulo }: { ok: boolean; rotulo: string }): ReactElement => (
  <span className={`badge ${ok ? 'ok' : 'warn'}`} style={{ marginRight: 4 }}>
    {ok ? '✓' : '•'} {rotulo}
  </span>
);

const MesaPage = async (): Promise<ReactElement> => {
  const cookie = cookies().get(HUMANIZADO_SESSION_COOKIE)?.value ?? '';
  if (operadorDaSessao(SEGREDO_SESSAO, cookie) === null) redirect('/login');

  const data = await getJson<{ clientes: ClienteHumanizado[] }>('/admin/humanizado/clientes');
  const clientes = data?.clientes ?? null;
  const pendentes = clientes?.filter((c) => !c.completo) ?? [];
  const completos = clientes?.filter((c) => c.completo) ?? [];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Atendimento Humanizado</h1>
        <SairButton />
      </div>
      <p className="page-sub">
        Clientes que CONFIRMARAM o interesse (cadastro gerado). Chame pelo WhatsApp da equipe, colha
        a procuração, o RG (frente e verso) e o comprovante — com os 3 anexados, o cliente fica 100%
        pronto para o pedido administrativo.
      </p>

      {clientes === null ? (
        <div className="error-box">API indisponível — recarregue a página.</div>
      ) : (
        <>
          <h2 className="page-title" style={{ fontSize: '1.1rem', marginTop: 16 }}>
            📞 Aguardando documentos <span className="badge warn">{pendentes.length}</span>
          </h2>
          {pendentes.length === 0 ? (
            <div className="card empty">Ninguém aguardando — tudo em dia.</div>
          ) : (
            pendentes.map((c) => (
              <div className="card" key={c.chatId} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: 15 }}>{c.nome}</strong>{' '}
                    <span className="mono" style={{ fontSize: 12 }}>
                      {c.telefone}
                    </span>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      confirmou em {dataBr(c.confirmadoEm)}
                    </div>
                  </div>
                  <a
                    className="btn primary"
                    href={linkWhatsApp(c)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    📲 Chamar no WhatsApp (mensagem pronta)
                  </a>
                </div>
                <div style={{ marginTop: 8 }}>
                  <Badge ok={c.docs.procuracao} rotulo="Procuração" />
                  <Badge ok={c.docs.rg} rotulo="RG" />
                  <Badge ok={c.docs.comprovante} rotulo="Comprovante" />
                </div>
                <DocsFase2 chatId={c.chatId} />
              </div>
            ))
          )}

          <h2 className="page-title" style={{ fontSize: '1.1rem', marginTop: 24 }}>
            ✅ Documentação completa <span className="badge ok">{completos.length}</span>
          </h2>
          {completos.length === 0 ? (
            <div className="card empty">Nenhum concluído ainda.</div>
          ) : (
            completos.map((c) => (
              <div className="card" key={c.chatId} style={{ marginBottom: 10 }}>
                <strong>{c.nome}</strong>{' '}
                <span className="mono" style={{ fontSize: 12 }}>
                  {c.telefone}
                </span>{' '}
                <span className="badge ok">pronto para o pedido administrativo</span>
                <DocsFase2 chatId={c.chatId} />
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
};

export default MesaPage;
