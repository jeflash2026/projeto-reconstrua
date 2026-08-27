'use client';
// TIMELINE CORVO DE UM CLIENTE — caixa criada, notificação por banco, resposta
// por banco (corpo + anexos). A senha da caixa só aparece sob clique explícito
// (a API grava a trilha de quem revelou).
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { atualizarDossieCorvo, reenviarCredencialCorvo, revelarSenhaCorvo } from '../lib/actions';

export interface TimelineCorvoView {
  importacao: {
    clienteId: string;
    nome: string;
    cpf: string | null;
    estado: string;
    enviadoEm: string | null;
    ultimoErro: string | null;
    bancos: { codigo: string; nome: string; email: string; contratos: number }[];
  };
  caixa: {
    cpf: string;
    email: string;
    webmail: string | null;
    criadaEm: string | null;
    temSenha: boolean;
  } | null;
  envios: {
    envioId: string;
    banco: { codigo: string; nome: string } | null;
    para: string | null;
    assunto: string | null;
    enviadoEm: string | null;
  }[];
  respostas: {
    respostaId: string;
    tipo: string;
    banco: { codigo: string; nome: string } | null;
    de: string | null;
    assunto: string | null;
    recebidaEm: string | null;
    corpoTexto: string | null;
    anexos: { nome: string; tipo: string; tamanho: number }[];
  }[];
  dossies: {
    cpf: string;
    hashRaiz: string;
    geradoEm: string;
    nomeArquivo: string;
    tamanho: number;
    resumo: {
      envios: number | null;
      respostas: number | null;
      bancos: string[];
      documentos: number | null;
    };
    baixadoEm: string;
  }[];
}

function dataBr(iso: string | null): string {
  return iso === null ? '—' : new Date(iso).toLocaleString('pt-BR');
}

export default function CorvoTimeline({ timeline }: { timeline: TimelineCorvoView }): ReactElement {
  const router = useRouter();
  const [credencial, setCredencial] = useState<{ email: string; senha: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [avisoDossie, setAvisoDossie] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const caixa = timeline.caixa;
  const cpfDossie = timeline.importacao.cpf;
  const dossieAtual = timeline.dossies[0] ?? null;

  async function atualizarDossie(): Promise<void> {
    if (cpfDossie === null) return;
    setBusy(true);
    setAvisoDossie('Baixando e verificando o dossiê no Corvo…');
    const r = await atualizarDossieCorvo(cpfDossie);
    setBusy(false);
    setAvisoDossie(
      r.ok
        ? r.novo === true
          ? 'Nova versão do dossiê guardada (hash conferido).'
          : 'O dossiê não mudou desde a última versão (hash idêntico).'
        : `Falha: ${r.erro ?? 'erro desconhecido'}`,
    );
    router.refresh();
  }

  function copiarHash(hash: string): void {
    void navigator.clipboard?.writeText(hash).then(() => {
      setAvisoDossie('Hash-raiz copiado.');
    });
  }

  async function revelar(): Promise<void> {
    if (caixa === null) return;
    setBusy(true);
    const r = await revelarSenhaCorvo(caixa.cpf);
    setBusy(false);
    if (r === null) {
      setAviso('Senha não disponível — peça o reenvio da credencial.');
      return;
    }
    setCredencial(r);
  }

  async function pedirReenvio(): Promise<void> {
    if (caixa === null) return;
    setBusy(true);
    const r = await reenviarCredencialCorvo(caixa.cpf);
    setBusy(false);
    setAviso(
      r.ok
        ? 'Reenvio pedido ao Corvo — a credencial chega pelo webhook em instantes.'
        : `Falha no pedido: ${r.erro ?? 'erro desconhecido'}`,
    );
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Caixa de e-mail do cliente</h3>
        {caixa === null ? (
          <div className="empty">Caixa ainda não criada pelo Corvo (chega por webhook).</div>
        ) : (
          <>
            <p>
              <strong>{caixa.email}</strong>
              {caixa.webmail !== null ? (
                <>
                  {' · '}
                  <a href={caixa.webmail} target="_blank" rel="noreferrer">
                    abrir webmail
                  </a>
                </>
              ) : null}
              <span className="page-sub" style={{ marginLeft: 8 }}>
                criada em {dataBr(caixa.criadaEm)}
              </span>
            </p>
            {credencial !== null ? (
              <p>
                Senha: <code>{credencial.senha}</code>{' '}
                <span className="page-sub">(revelação registrada na trilha)</span>
              </p>
            ) : (
              <div className="form-row" style={{ gap: 8 }}>
                <button disabled={busy || !caixa.temSenha} onClick={() => void revelar()}>
                  {caixa.temSenha ? 'Revelar senha' : 'Senha não guardada'}
                </button>
                <button disabled={busy} onClick={() => void pedirReenvio()}>
                  Pedir reenvio da credencial
                </button>
              </div>
            )}
            {aviso !== null ? (
              <p className="page-sub" style={{ marginTop: 8 }}>
                {aviso}
              </p>
            ) : null}
          </>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Notificações enviadas aos bancos ({timeline.envios.length})</h3>
        {timeline.envios.length === 0 ? (
          <div className="empty">Nenhuma notificação enviada ainda.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Banco</th>
                  <th>Para</th>
                  <th>Assunto</th>
                  <th>Enviado em</th>
                </tr>
              </thead>
              <tbody>
                {timeline.envios.map((e) => (
                  <tr key={e.envioId}>
                    <td style={{ fontWeight: 600 }}>{e.banco?.nome ?? '—'}</td>
                    <td className="mono">{e.para ?? '—'}</td>
                    <td>{e.assunto ?? '—'}</td>
                    <td>{dataBr(e.enviadoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Respostas dos bancos ({timeline.respostas.length})</h3>
        {timeline.respostas.length === 0 ? (
          <div className="empty">Nenhuma resposta recebida ainda.</div>
        ) : (
          timeline.respostas.map((r) => (
            <div key={r.respostaId} className="card" style={{ marginBottom: 12 }}>
              <div className="form-row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span
                  className={
                    r.tipo === 'RESPOSTA' ? 'badge ok' : r.tipo === 'BOUNCE' ? 'badge' : 'badge dim'
                  }
                >
                  {r.tipo === 'BOUNCE'
                    ? 'BOUNCE — e-mail não entregue'
                    : r.tipo === 'BACEN'
                      ? 'BACEN — protocolo da ouvidoria'
                      : 'Resposta do banco'}
                </span>
                <strong>{r.banco?.nome ?? r.de ?? '—'}</strong>
                <span className="page-sub">{dataBr(r.recebidaEm)}</span>
              </div>
              {r.assunto !== null ? <p style={{ fontWeight: 600 }}>{r.assunto}</p> : null}
              {r.corpoTexto !== null ? (
                <p style={{ whiteSpace: 'pre-wrap' }}>{r.corpoTexto}</p>
              ) : null}
              {r.anexos.length > 0 ? (
                <p>
                  {r.anexos.map((a, i) => (
                    <a
                      key={`${r.respostaId}-${String(i)}`}
                      href={`/api/corvo-anexo?respostaId=${encodeURIComponent(r.respostaId)}&indice=${String(i)}`}
                      style={{ marginRight: 12 }}
                    >
                      📎 {a.nome}
                    </a>
                  ))}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Dossiê de integridade (Corvo)</h3>
        <p className="page-sub">
          Pacote de prova da cadeia de envio aos bancos (.eml originais + hashes). Cada versão é
          preservada — nada é sobrescrito; o advogado confere o hash-raiz ao lado do arquivo.
        </p>
        {dossieAtual === null ? (
          <div className="empty">
            Nenhuma versão baixada ainda — chega sozinho quando os bancos são notificados
            {cpfDossie !== null ? ' (ou clique em Atualizar dossiê)' : ''}.
          </div>
        ) : (
          <>
            <div className="form-row" style={{ flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <div>
                <div className="page-sub">Gerado em</div>
                <strong>
                  {dossieAtual.geradoEm !== ''
                    ? new Date(dossieAtual.geradoEm).toLocaleString('pt-BR')
                    : '—'}
                </strong>
              </div>
              <div>
                <div className="page-sub">Envios / respostas</div>
                <strong>
                  {dossieAtual.resumo.envios ?? '—'} / {dossieAtual.resumo.respostas ?? '—'}
                </strong>
              </div>
              <div>
                <div className="page-sub">Hash-raiz (confira com o advogado)</div>
                <code style={{ fontSize: 12 }}>{dossieAtual.hashRaiz}</code>
                <button style={{ marginLeft: 6 }} onClick={() => copiarHash(dossieAtual.hashRaiz)}>
                  copiar
                </button>
              </div>
              <a
                href={`/api/corvo-dossie?cpf=${encodeURIComponent(dossieAtual.cpf)}&hash=${encodeURIComponent(dossieAtual.hashRaiz)}`}
              >
                <button>Baixar ZIP ({Math.round(dossieAtual.tamanho / 1024)} KB)</button>
              </a>
            </div>
            {timeline.dossies.length > 1 ? (
              <p className="page-sub" style={{ marginTop: 10 }}>
                Versões anteriores:{' '}
                {timeline.dossies.slice(1).map((d) => (
                  <a
                    key={d.hashRaiz}
                    href={`/api/corvo-dossie?cpf=${encodeURIComponent(d.cpf)}&hash=${encodeURIComponent(d.hashRaiz)}`}
                    style={{ marginRight: 10 }}
                    title={d.hashRaiz}
                  >
                    {d.geradoEm !== ''
                      ? new Date(d.geradoEm).toLocaleString('pt-BR')
                      : d.hashRaiz.slice(0, 12)}
                  </a>
                ))}
              </p>
            ) : null}
          </>
        )}
        {cpfDossie !== null ? (
          <div style={{ marginTop: 10 }}>
            <button disabled={busy} onClick={() => void atualizarDossie()}>
              {busy ? 'Atualizando…' : 'Atualizar dossiê'}
            </button>
          </div>
        ) : null}
        {avisoDossie !== null ? (
          <p className="page-sub" style={{ marginTop: 8 }}>
            {avisoDossie}
          </p>
        ) : null}
      </div>
    </>
  );
}
