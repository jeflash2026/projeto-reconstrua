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
import {
  operadorDaSessao,
  HUMANIZADO_SESSION_COOKIE,
  HUMANIZADO_NOME_COOKIE,
} from '../lib/session';
import { SairButton } from '../components/sair-button';
import DocsFase2 from '../components/docs-fase2';
import AguardandoToggle from '../components/aguardando-toggle';
import DescartarButton from '../components/descartar-button';

export const dynamic = 'force-dynamic';

const SEGREDO_SESSAO = process.env['ADMIN_API_TOKEN'] ?? '';

function dataBr(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** A mensagem de ORIENTAÇÃO FINAL, pronta no WhatsApp da equipe (texto ditado
 *  pelo dono em 2026-08-04). A CONSULTORA envia esta mensagem, anexa a
 *  procuração em seguida e aguarda a devolução — por isso o pedido vem inteiro
 *  de uma vez. Decreto do dono (após o caso MARLENE): SEM emojis e SEM
 *  asteriscos — o pipeline de build corrompia os símbolos no WhatsApp; a
 *  mensagem é texto puro, limpa e profissional, apresentada pela consultora. */
function mensagemDaEquipe(c: ClienteHumanizado, assinatura: string): string {
  const bruto = c.nome.split(/\s+/)[0] ?? c.nome;
  // O cadastro guarda o nome em CAIXA ALTA ("MARLENE") — a saudação sai humana.
  const primeiro = bruto.charAt(0).toUpperCase() + bruto.slice(1).toLowerCase();
  return [
    `Olá, ${primeiro}!`,
    '',
    `Aqui é a ${assinatura}, consultora do Projeto Reconstrua. Agradecemos por confiar no nosso trabalho.`,
    '',
    'Para darmos continuidade ao seu atendimento, pedimos que envie o quanto antes:',
    '',
    '1. RG (frente e verso)',
    '2. Procuração devidamente assinada',
    '3. Comprovante de endereço',
    '',
    'Assim que recebermos a documentação completa, nossa equipe fará a conferência e, ' +
      'estando tudo correto, dará prosseguimento ao protocolo do processo.',
    '',
    'Quanto antes você enviar, mais rápido conseguiremos avançar com o seu caso.',
    '',
    'Atenciosamente,',
    `${assinatura} — Consultora do Projeto Reconstrua`,
  ].join('\n');
}

function linkWhatsApp(c: ClienteHumanizado, assinatura: string): string {
  return `https://wa.me/${c.telefone}?text=${encodeURIComponent(mensagemDaEquipe(c, assinatura))}`;
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

/** O RESUMO DO DIA (pedido do dono, 2026-08-04): a secretária vê de relance o
 *  tamanho de cada fila — quantos aguardam contato, quantos já receberam a
 *  documentação e quantos concluíram. Sobre a base TODA (o filtro de UF não
 *  esconde o total do trabalho). */
const ResumoDaMesa = ({ todos }: { todos: readonly ClienteHumanizado[] }): ReactElement => {
  const ativos = todos.filter((c) => c.descartado !== true);
  const descartados = todos.length - ativos.length;
  const completos = ativos.filter((c) => c.completo).length;
  const enviados = ativos.filter((c) => !c.completo && c.aguardandoAssinatura).length;
  const aChamar = ativos.length - completos - enviados;
  const itens: readonly { rotulo: string; valor: number; classe: string; dica: string }[] = [
    {
      rotulo: 'Confirmados na mesa',
      valor: ativos.length,
      classe: '',
      dica: 'Todos os clientes que confirmaram o interesse após o dossiê',
    },
    {
      rotulo: 'A chamar',
      valor: aChamar,
      classe: 'atencao',
      dica: 'Ainda sem documentação enviada — o próximo contato é com eles',
    },
    {
      rotulo: 'Documentação enviada',
      valor: enviados,
      classe: 'enviado',
      dica: 'Você já enviou os documentos — aguardando o cliente devolver assinado',
    },
    {
      rotulo: 'Concluídos',
      valor: completos,
      classe: 'ok',
      dica: 'Os 3 documentos recebidos — seguiram para o perito',
    },
    {
      rotulo: 'Descartados',
      valor: descartados,
      classe: 'descartado',
      dica: 'Sem interesse ou sem documentação — voltam se o cliente confirmar de novo',
    },
  ];
  return (
    <div className="resumo-mesa">
      {itens.map((i) => (
        <div key={i.rotulo} className={`stat-card ${i.classe}`} title={i.dica}>
          <div className="stat-valor">{i.valor}</div>
          <div className="stat-rotulo">{i.rotulo}</div>
          <div className="stat-dica">{i.dica}</div>
        </div>
      ))}
    </div>
  );
};

/** BUSCA por nome ou telefone (ferramenta da mesa) — formulário GET simples:
 *  funciona sem JavaScript, preserva a UF escolhida e limpa com um clique.
 *  SEM action: o envio fica na URL ATUAL (que já carrega o basePath
 *  /humanizado) — action="/" caía na raiz do domínio, o site principal. */
const BuscaCliente = ({ q, uf }: { q: string; uf: string | null }): ReactElement => (
  <form method="GET" className="busca-mesa">
    {uf !== null ? <input type="hidden" name="uf" value={uf} /> : null}
    <input
      type="text"
      name="q"
      defaultValue={q}
      placeholder="Buscar por nome ou telefone…"
      aria-label="Buscar cliente"
    />
    <button type="submit" className="btn">
      Buscar
    </button>
    {q !== '' ? (
      <Link className="btn" href={uf !== null ? `/?uf=${encodeURIComponent(uf)}` : '/'}>
        Limpar
      </Link>
    ) : null}
  </form>
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

const CartaoCliente = ({
  c,
  assinatura,
}: {
  c: ClienteHumanizado;
  assinatura: string;
}): ReactElement => (
  // COR DO CARTÃO (pedido do dono, 2026-08-04): o ESTADO de relance —
  // vermelho = ainda falta entrar em contato; âmbar = documentação enviada,
  // aguardando a devolução assinada. (Verde = completa; cinza = descartado.)
  <div className={`card ${c.aguardandoAssinatura ? 'enviado' : 'a-chamar'}`}>
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
      <a
        className="btn primary"
        href={linkWhatsApp(c, assinatura)}
        target="_blank"
        rel="noreferrer"
      >
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
      <AguardandoToggle
        chatId={c.chatId}
        aguardando={c.aguardandoAssinatura}
        // != null cobre também o undefined de uma API ainda no build anterior
        // (portal e api sobem em containers separados) — nunca "Invalid Date".
        desde={c.aguardandoDesde != null ? dataBr(c.aguardandoDesde) : null}
      />
    </div>
    <DocsFase2 chatId={c.chatId} />
    <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--borda)' }}>
      <DescartarButton chatId={c.chatId} descartado={false} />
    </div>
  </div>
);

const MesaPage = async ({
  searchParams,
}: {
  searchParams: { uf?: string; q?: string };
}): Promise<ReactElement> => {
  const cookie = cookies().get(HUMANIZADO_SESSION_COOKIE)?.value ?? '';
  if (operadorDaSessao(SEGREDO_SESSAO, cookie) === null) redirect('/login');
  // Quem assina a mensagem: o PRIMEIRO NOME de quem está atendendo. Sessão
  // antiga (sem o nome guardado) assina como a Layara — pedido do dono
  // 2026-08-04: a mensagem SEMPRE se apresenta como a consultora, nunca
  // genérica ("Equipe Reconstrua — Consultora" saiu errado no caso real).
  const nomeOperador = cookies().get(HUMANIZADO_NOME_COOKIE)?.value ?? '';
  const assinatura = nomeOperador.trim().split(/\s+/)[0] || 'Layara';

  const data = await getJson<{ clientes: ClienteHumanizado[] }>(
    '/admin/humanizado/clientes',
    20000,
  );
  const todos = data?.clientes ?? null;
  // Filtro por ESTADO (pedido do dono): a UF escolhida vira a fila da vez.
  const ufEscolhida = (searchParams.uf ?? '').trim().toUpperCase() || null;
  const gruposDeTodos = porEstado(todos ?? []);
  const ufValida = ufEscolhida !== null && gruposDeTodos.some(([uf]) => uf === ufEscolhida);
  const ativo = ufValida ? ufEscolhida : null;
  // BUSCA (ferramenta da mesa, 2026-08-04): nome ou telefone, combinável com a UF.
  const q = (searchParams.q ?? '').trim();
  const qMin = q.toLowerCase();
  const qDigitos = q.replace(/\D/g, '');
  const daUf = todos === null ? null : ativo === null ? todos : todos.filter((c) => c.uf === ativo);
  const clientes =
    daUf === null || q === ''
      ? daUf
      : daUf.filter(
          (c) =>
            c.nome.toLowerCase().includes(qMin) ||
            (qDigitos !== '' && c.telefone.includes(qDigitos)),
        );
  // Descartados FICAM FORA das filas de trabalho — seção própria no rodapé.
  const ativas = clientes?.filter((c) => c.descartado !== true) ?? [];
  const pendentes = ativas.filter((c) => !c.completo);
  const completos = ativas.filter((c) => c.completo);
  const descartados = clientes?.filter((c) => c.descartado === true) ?? [];

  return (
    <div style={{ maxWidth: 1500, margin: '0 auto', padding: '24px 20px 48px' }}>
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

      {clientes === null || todos === null ? (
        <div className="error-box">API indisponível — recarregue a página.</div>
      ) : (
        <>
          <ResumoDaMesa todos={todos} />
          <FiltroEstados contagens={gruposDeTodos} ativo={ativo} total={todos.length} />
          <BuscaCliente q={q} uf={ativo} />

          {/* LEGENDA DAS CORES (pedido do dono, 2026-08-04): o estado de cada
              cartão de relance — sem precisar ler os selos um a um. */}
          <div className="legenda-cores">
            <span>
              <i className="ponto vermelho" /> falta entrar em contato
            </span>
            <span>
              <i className="ponto ambar" /> documentação enviada — aguardando devolução
            </span>
            <span>
              <i className="ponto verde" /> documentação completa
            </span>
            <span>
              <i className="ponto cinza" /> descartado
            </span>
          </div>
          {q !== '' ? (
            <p className="page-sub">
              Resultado da busca por &quot;{q}&quot;: {pendentes.length + completos.length}{' '}
              cliente(s){ativo !== null ? ` em ${ativo}` : ''}.
            </p>
          ) : null}

          <h2 className="page-title" style={{ fontSize: '1.1rem', marginTop: 16 }}>
            📞 Aguardando documentos <span className="badge warn">{pendentes.length}</span>
            {ativo !== null ? <span className="badge accent-uf">{ativo}</span> : null}
          </h2>
          {pendentes.length === 0 ? (
            <div className="card empty">
              {q !== ''
                ? 'Nenhum cliente pendente na busca.'
                : ativo === null
                  ? 'Ninguém aguardando — tudo em dia.'
                  : `Ninguém aguardando em ${ativo}.`}
            </div>
          ) : ativo !== null || q !== '' ? (
            // Com estado escolhido (ou busca), a lista é direta em GRADE.
            <div className="grade-cartoes">
              {pendentes.map((c) => (
                <CartaoCliente key={c.chatId} c={c} assinatura={assinatura} />
              ))}
            </div>
          ) : (
            porEstado(pendentes).map(([uf, lista]) => (
              <section key={uf}>
                <div className="uf-titulo">
                  {uf} <span className="badge">{lista.length}</span>
                </div>
                <div className="grade-cartoes">
                  {lista.map((c) => (
                    <CartaoCliente key={c.chatId} c={c} assinatura={assinatura} />
                  ))}
                </div>
              </section>
            ))
          )}

          <h2 className="page-title" style={{ fontSize: '1.1rem', marginTop: 24 }}>
            ✅ Documentação completa <span className="badge ok">{completos.length}</span>
            {ativo !== null ? <span className="badge accent-uf">{ativo}</span> : null}
          </h2>
          {completos.length === 0 ? (
            <div className="card empty">
              {q !== ''
                ? 'Nenhum concluído na busca.'
                : ativo === null
                  ? 'Nenhum concluído ainda.'
                  : `Nenhum concluído em ${ativo}.`}
            </div>
          ) : (
            porEstado(completos).map(([uf, lista]) => (
              <section key={uf}>
                <div className="uf-titulo">
                  {uf} <span className="badge">{lista.length}</span>
                </div>
                <div className="grade-cartoes">
                  {lista.map((c) => (
                    <div className="card concluida" key={c.chatId}>
                      <strong>{c.nome}</strong>{' '}
                      <span className="mono" style={{ fontSize: 12 }}>
                        {c.telefone}
                      </span>{' '}
                      <span className="badge">{c.uf}</span>
                      {/* Pedido do dono (2026-08-03): com os 3 documentos, o
                          cartão anuncia a conclusão e o caso segue ao perito. */}
                      <div className="concluido">
                        ✅ <strong>Documentação completa recebida</strong> — este cliente saiu da
                        sua fila e seguiu para o perito fazer o pedido administrativo.
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <Badge ok rotulo="Procuração" />
                        <Badge ok rotulo="RG" />
                        <Badge ok rotulo="Comprovante" />
                      </div>
                      <TamanhoDoCaso c={c} />
                      <DocsFase2 chatId={c.chatId} />
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}

          {/* DESCARTADOS (2026-08-04): fora da fila de trabalho, mas nunca
              perdidos — a reativação manual (ou um SIM novo do cliente no
              WhatsApp) devolve o caso à mesa e o atendimento recomeça. */}
          {descartados.length > 0 ? (
            <>
              <h2 className="page-title" style={{ fontSize: '1.1rem', marginTop: 24 }}>
                🗑 Descartados <span className="badge">{descartados.length}</span>
                {ativo !== null ? <span className="badge accent-uf">{ativo}</span> : null}
              </h2>
              <p className="page-sub">
                Sem interesse ou sem documentação. Se o cliente voltar a confirmar no WhatsApp, ele
                retorna sozinho para a sua fila — ou reative manualmente aqui.
              </p>
              <div className="grade-cartoes">
                {descartados.map((c) => (
                  <div className="card descartado" key={c.chatId}>
                    <strong>{c.nome}</strong>{' '}
                    <span className="mono" style={{ fontSize: 12 }}>
                      {c.telefone}
                    </span>{' '}
                    <span className="badge">{c.uf}</span>
                    <div style={{ fontSize: 12, color: 'var(--texto-dim)', margin: '4px 0 8px' }}>
                      descartado em{' '}
                      {c.descartadoEm != null ? dataBr(c.descartadoEm) : 'data não registrada'}
                    </div>
                    <DescartarButton chatId={c.chatId} descartado />
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
};

export default MesaPage;
