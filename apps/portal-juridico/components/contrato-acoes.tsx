'use client';
// AÇÕES do contrato — encerrar (data + motivo) e mover para excluídos (motivo),
// como no original. Confirmação explícita nas duas.
import { useState, type ReactElement } from 'react';

export default function ContratoAcoes({
  contratoId,
  status,
}: {
  contratoId: string;
  status: string;
}): ReactElement {
  const hoje = new Date().toISOString().slice(0, 10);
  const [dataEnc, setDataEnc] = useState(hoje);
  const [motivoEnc, setMotivoEnc] = useState('');
  const [motivoExc, setMotivoExc] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function agir(payload: Record<string, unknown>, confirmacao: string): Promise<void> {
    if (!window.confirm(confirmacao)) return;
    setErro(null);
    setOcupado(true);
    try {
      const res = await fetch(`/juridico/api/j/contratos/${contratoId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErro(data.error ?? 'falha na ação');
        return;
      }
      window.location.reload();
    } catch {
      setErro('falha de rede — tente de novo');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="grade-2">
      {status === 'ativo' ? (
        <div className="secao-form">
          <h3>Encerrar</h3>
          <div className="form-grade">
            <label className="campo">
              <span>Data</span>
              <input type="date" value={dataEnc} onChange={(e) => setDataEnc(e.target.value)} />
            </label>
            <label className="campo">
              <span>Motivo</span>
              <input value={motivoEnc} onChange={(e) => setMotivoEnc(e.target.value)} />
            </label>
          </div>
          <div className="form-rodape">
            <button
              className="btn"
              disabled={ocupado}
              onClick={() =>
                void agir(
                  { acao: 'encerrar', data: dataEnc, motivo: motivoEnc },
                  'Encerrar este contrato?',
                )
              }
            >
              Encerrar contrato
            </button>
          </div>
        </div>
      ) : null}
      {status !== 'excluido' ? (
        <div className="secao-form">
          <h3>Excluir</h3>
          <div className="form-grade">
            <label className="campo">
              <span>Motivo</span>
              <input value={motivoExc} onChange={(e) => setMotivoExc(e.target.value)} />
            </label>
          </div>
          <div className="form-rodape">
            <button
              className="btn perigo"
              disabled={ocupado}
              onClick={() =>
                void agir(
                  { acao: 'excluir', motivo: motivoExc },
                  'Mover este contrato para os excluídos?',
                )
              }
            >
              Mover para excluídos
            </button>
          </div>
        </div>
      ) : null}
      {erro !== null ? <div className="erro-box">{erro}</div> : null}
    </div>
  );
}
