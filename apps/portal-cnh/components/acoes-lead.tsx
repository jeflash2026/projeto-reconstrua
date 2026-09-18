'use client';
// AÇÕES sobre um lead (assumir, devolver, mensagem da equipe, contrato,
// pagamento, etapa, descarte, reabrir). Cada uma é assinada pela sessão no
// servidor; depois de agir, a página recarrega os dados.
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import {
  assumirLead,
  contratoEnviado,
  descartarLead,
  devolverLead,
  marcarVistoLead,
  mensagemAoLead,
  moverEtapaLead,
  pagamentoConfirmado,
  reabrirLead,
  type ResultadoAcao,
} from '../lib/actions';
import { ETAPAS, MOTIVOS_DESCARTE, ROTULO_ETAPA, type EtapaCnh } from '../lib/api';

export const AcoesLead = ({
  id,
  etapa,
  modo,
  dentroDaJanela,
  temAtencao,
  contratoEnviadoEm,
  pagamentoConfirmadoEm,
}: {
  id: string;
  etapa: EtapaCnh;
  modo: 'ahri' | 'humano';
  dentroDaJanela: boolean;
  temAtencao: boolean;
  contratoEnviadoEm: string | null;
  pagamentoConfirmadoEm: string | null;
}): ReactElement => {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [novaEtapa, setNovaEtapa] = useState<string>(etapa);
  const [motivo, setMotivo] = useState('outro');

  const agir = async (acao: () => Promise<ResultadoAcao>, limparTexto = false): Promise<void> => {
    if (ocupado) return;
    setOcupado(true);
    setErro(null);
    const r = await acao();
    setOcupado(false);
    if (!r.ok) {
      setErro(r.error ?? 'não foi possível');
      return;
    }
    if (limparTexto) setTexto('');
    router.refresh();
  };

  return (
    <>
      <div className="cartao">
        <h2>Quem responde</h2>
        <p className="nota" style={{ marginTop: 0 }}>
          {modo === 'ahri'
            ? 'A AHRI está conduzindo pelo roteiro. Assuma se quiser falar você mesmo.'
            : 'A equipe está com este lead: a AHRI não responde enquanto você não devolver.'}
        </p>
        <div className="acoes">
          {modo === 'ahri' ? (
            <button
              className="btn primario"
              disabled={ocupado}
              onClick={() => void agir(() => assumirLead(id))}
            >
              Assumir a conversa
            </button>
          ) : (
            <button
              className="btn"
              disabled={ocupado}
              onClick={() => void agir(() => devolverLead(id))}
            >
              Devolver para a AHRI
            </button>
          )}
          {temAtencao ? (
            <button
              className="btn"
              disabled={ocupado}
              onClick={() => void agir(() => marcarVistoLead(id))}
            >
              Marcar como visto
            </button>
          ) : null}
        </div>
      </div>

      <div className="cartao">
        <h2>Mensagem da equipe</h2>
        {dentroDaJanela ? (
          <>
            <label className="campo">
              <span>Sai pelo WhatsApp da CNH, assinada no histórico com o seu nome</span>
              <textarea
                value={texto}
                onChange={(e) => {
                  setTexto(e.target.value);
                }}
                placeholder="Escreva para o cliente…"
              />
            </label>
            <button
              className="btn primario"
              disabled={ocupado || texto.trim() === ''}
              onClick={() => void agir(() => mensagemAoLead(id, texto), true)}
            >
              Enviar
            </button>
            {modo === 'ahri' ? (
              <p className="nota">
                Dica: assuma a conversa antes, para a AHRI não responder junto.
              </p>
            ) : null}
          </>
        ) : (
          <p className="nota" style={{ marginTop: 0 }}>
            O cliente está há mais de 24 h sem escrever. A Meta só aceita o modelo aprovado — use a
            fila de follow-ups, ou espere o cliente responder.
          </p>
        )}
      </div>

      <div className="cartao">
        <h2>Contrato e pagamento</h2>
        <div className="acoes">
          <button
            className="btn"
            disabled={ocupado || contratoEnviadoEm !== null}
            onClick={() => void agir(() => contratoEnviado(id))}
          >
            {contratoEnviadoEm !== null ? 'Contrato enviado ✓' : 'Marcar contrato enviado'}
          </button>
          <button
            className="btn"
            disabled={ocupado || pagamentoConfirmadoEm !== null}
            onClick={() => void agir(() => pagamentoConfirmado(id))}
          >
            {pagamentoConfirmadoEm !== null ? 'Pagamento confirmado ✓' : 'Confirmar pagamento'}
          </button>
        </div>
      </div>

      <div className="cartao">
        <h2>Etapa e descarte</h2>
        <label className="campo">
          <span>Mover para a etapa</span>
          <select
            value={novaEtapa}
            onChange={(e) => {
              setNovaEtapa(e.target.value);
            }}
          >
            {ETAPAS.map((e) => (
              <option key={e} value={e}>
                {ROTULO_ETAPA[e]}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn"
          disabled={ocupado || novaEtapa === etapa}
          onClick={() => void agir(() => moverEtapaLead(id, novaEtapa))}
        >
          Mover
        </button>
        <div style={{ height: 14 }} />
        {etapa === 'descartado' ? (
          <button
            className="btn primario"
            disabled={ocupado}
            onClick={() => void agir(() => reabrirLead(id))}
          >
            Reabrir e devolver para a AHRI
          </button>
        ) : (
          <>
            <label className="campo">
              <span>Descartar (não envia mensagem ao cliente)</span>
              <select
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                }}
              >
                {MOTIVOS_DESCARTE.map((m) => (
                  <option key={m.valor} value={m.valor}>
                    {m.rotulo}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn perigo"
              disabled={ocupado}
              onClick={() => void agir(() => descartarLead(id, motivo))}
            >
              Descartar lead
            </button>
          </>
        )}
      </div>
      {erro !== null ? <div className="erro">{erro}</div> : null}
    </>
  );
};
