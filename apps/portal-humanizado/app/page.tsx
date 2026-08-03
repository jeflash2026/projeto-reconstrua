// A MESA DO ATENDIMENTO HUMANIZADO (Onda 2/3, decreto 2026-07-31) — a
// secretária vê SÓ os clientes que CONFIRMARAM o parecer, ORGANIZADOS POR
// ESTADO (pedido do dono):
//  • botão do WhatsApp HUMANIZADO com a orientação pronta;
//  • marcação "enviei a documentação — aguardando devolução assinada";
//  • anexo dos 3 documentos da fase 2 (procuração, RG f/v, comprovante);
//  • completos ⇒ 100% prontos para o perito protocolar o pedido administrativo.
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { getJson, type ClienteHumanizado } from '../lib/api';
import { operadorDaSessao, HUMANIZADO_SESSION_COOKIE } from '../lib/session';
import { SairButton } from '../components/sair-button';
import DocsFase2 from '../components/docs-fase2';
import AguardandoToggle from '../components/aguardando-toggle';

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

/** Agrupa por UF (ordem alfabética; 'SEM UF' por último). */
function porEstado(
  clientes: readonly ClienteHumanizado[],
): readonly [string, ClienteHumanizado[]][] {
  const grupos = new Map<string, ClienteHumanizado[]>();
  for (const c of clientes) {
    const uf = c.uf || 'SEM UF';
    grupos.set(uf, [...(grupos.get(uf) ?? []), c]);
  }
  return [...grupos.entries()].sort(([a], [b]) =>
    a === 'SEM UF' ? 1 : b === 'SEM UF' ? -1 : a.localeCompare(b),
  );
}

/** Pedido do dono (2026-08-03): SELETOR DE ESTADO — a mesa já passou de 40
 *  clientes; a secretária escolhe a UF e trabalha só aquela fila. */
const FiltroEstados = ({
  contagens,
  ativo,
  total,
}: {
  contagens: readonly [string, ClienteHumanizado[]][];
  ativo: string | null;
  total: number;
}): ReactElement => (
  <div className="filtro-uf">
    <Link href="/" className={`chip-uf${ativo === null ? ' ativo' : ''}`}>
      Todos <span className="chip-num">{total}</span>
    </Link>
    {contagens.map(([uf, lista]) => (
      <Link
        key={uf}
        href={`/?uf=${encodeURIComponent(uf)}`}
        className={`chip-uf${ativo === uf ? ' ativo' : ''}`}
      >
        {uf} <span className="chip-num">{lista.length}</span>
      </Link>
    ))}
  </div>
);

const Badge = ({ ok, rotulo }: { ok: boolean; rotulo: string }): ReactElement => (
  <span className={`badge ${ok ? 'ok' : 'warn'}`} style={{ marginRight: 4 }}>
    {ok ? '✓' : '•'} {rotulo}
  </span>
);

/** Reais sem centavos — a leitura de relance do valor do caso. */
function reais(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

/** O TAMANHO do caso (pedido do dono): contratos, indícios e potencial. */
const TamanhoDoCaso = ({ c }: { c: ClienteHumanizado }): ReactElement => (
  <div className="tamanho-caso">
    <span>
      <strong>{c.contratos}</strong> contrato(s)
    </span>
    <span>
      <strong>{c.indicios}</strong> indício(s)
    </span>
    <span className="valor">
      Potencial: <strong>{c.potencial > 0 ? reais(c.potencial) : '—'}</strong>
    </span>
  </div>
);

const CartaoCliente = ({ c }: { c: ClienteHumanizado }): ReactElement => (
  <div className="card" style={{ marginBottom: 12 }}>
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
        </span>{' '}
        <span className="badge">{c.uf}</span>
        <div style={{ fontSize: 12, color: 'var(--texto-dim)' }}>
          confirmou em {dataBr(c.confirmadoEm)}
        </div>
      </div>
      <a className="btn primary" href={linkWhatsApp(c)} target="_blank" rel="noreferrer">
        📲 Chamar no WhatsApp (mensagem pronta)
      </a>
    </div>
    <TamanhoDoCaso c={c} />
    <div style={{ marginTop: 8 }}>
      <Badge ok={c.docs.procuracao} rotulo="Procuração" />
      <Badge ok={c.docs.rg} rotulo="RG" />
      <Badge ok={c.docs.comprovante} rotulo="Comprovante" />
    </div>
    <div style={{ marginTop: 8 }}>
      <AguardandoToggle chatId={c.chatId} aguardando={c.aguardandoAssinatura} />
    </div>
    <DocsFase2 chatId={c.chatId} />
  </div>
);

const MesaPage = async ({
  searchParams,
}: {
  searchParams: { uf?: string };
}): Promise<ReactElement> => {
  const cookie = cookies().get(HUMANIZADO_SESSION_COOKIE)?.value ?? '';
  if (operadorDaSessao(SEGREDO_SESSAO, cookie) === null) redirect('/login');

  const data = await getJson<{ clientes: ClienteHumanizado[] }>('/admin/humanizado/clientes');
  const todos = data?.clientes ?? null;
  // Filtro por ESTADO (pedido do dono): a UF escolhida vira a fila da vez.
  const ufEscolhida = (searchParams.uf ?? '').trim().toUpperCase() || null;
  const gruposDeTodos = porEstado(todos ?? []);
  const ufValida = ufEscolhida !== null && gruposDeTodos.some(([uf]) => uf === ufEscolhida);
  const ativo = ufValida ? ufEscolhida : null;
  const clientes =
    todos === null ? null : ativo === null ? todos : todos.filter((c) => c.uf === ativo);
  const pendentes = clientes?.filter((c) => !c.completo) ?? [];
  const completos = clientes?.filter((c) => c.completo) ?? [];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 48px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="page-title">Atendimento Humanizado</h1>
        <SairButton />
      </div>
      <p className="page-sub">
        Clientes que CONFIRMARAM o interesse, organizados por estado. Chame pelo WhatsApp da equipe,
        marque &quot;aguardando devolução&quot; quando enviar a documentação, e anexe a procuração,
        o RG (frente e verso) e o comprovante — com os 3, o cliente fica 100% pronto para o pedido
        administrativo.
      </p>

      {clientes === null ? (
        <div className="error-box">API indisponível — recarregue a página.</div>
      ) : (
        <>
          <FiltroEstados contagens={gruposDeTodos} ativo={ativo} total={(todos ?? []).length} />

          <h2 className="page-title" style={{ fontSize: '1.1rem', marginTop: 16 }}>
            📞 Aguardando documentos <span className="badge warn">{pendentes.length}</span>
            {ativo !== null ? <span className="badge accent-uf">{ativo}</span> : null}
          </h2>
          {pendentes.length === 0 ? (
            <div className="card empty">
              {ativo === null
                ? 'Ninguém aguardando — tudo em dia.'
                : `Ninguém aguardando em ${ativo}.`}
            </div>
          ) : ativo !== null ? (
            // Com um estado escolhido, a lista é direta (sem repetir o título).
            pendentes.map((c) => <CartaoCliente key={c.chatId} c={c} />)
          ) : (
            porEstado(pendentes).map(([uf, lista]) => (
              <section key={uf}>
                <div className="uf-titulo">
                  {uf} <span className="badge">{lista.length}</span>
                </div>
                {lista.map((c) => (
                  <CartaoCliente key={c.chatId} c={c} />
                ))}
              </section>
            ))
          )}

          <h2 className="page-title" style={{ fontSize: '1.1rem', marginTop: 24 }}>
            ✅ Documentação completa <span className="badge ok">{completos.length}</span>
            {ativo !== null ? <span className="badge accent-uf">{ativo}</span> : null}
          </h2>
          {completos.length === 0 ? (
            <div className="card empty">
              {ativo === null ? 'Nenhum concluído ainda.' : `Nenhum concluído em ${ativo}.`}
            </div>
          ) : (
            porEstado(completos).map(([uf, lista]) => (
              <section key={uf}>
                <div className="uf-titulo">
                  {uf} <span className="badge">{lista.length}</span>
                </div>
                {lista.map((c) => (
                  <div className="card" key={c.chatId} style={{ marginBottom: 10 }}>
                    <strong>{c.nome}</strong>{' '}
                    <span className="mono" style={{ fontSize: 12 }}>
                      {c.telefone}
                    </span>{' '}
                    <span className="badge ok">pronto para o pedido administrativo</span>
                    <TamanhoDoCaso c={c} />
                    <DocsFase2 chatId={c.chatId} />
                  </div>
                ))}
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
};

export default MesaPage;
