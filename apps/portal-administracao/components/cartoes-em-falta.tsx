'use client';
// CARTÕES EM FALTA (caso REAL Luiz Carlos da Cunha, 2026-09-28) — HISCONs em que
// o cartão consignado só existe na tabela mensal "DESCONTOS DE CARTÃO". O leitor
// posicional pula essa tabela de propósito (contar linha de mês como contrato
// foi o que inflou o caso Nycollas), e com isso o cliente perdia RMC e RCC
// inteiros: cada um vale 1 processo no guia, no dossiê e no abate do advogado.
//
// O clique é a autorização EXPLÍCITA do dono. A operação é ADITIVA: a leitura
// dos empréstimos vai inteira para o texto novo, os cartões entram no fim, e o
// texto anterior fica no backup — reversível.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { pdAplicarCartoesEmFalta, type CartoesEmFaltaRelatorio } from '../lib/actions';

const CartoesEmFalta = ({
  relatorio,
}: {
  relatorio: CartoesEmFaltaRelatorio | null;
}): ReactElement => {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState<CartoesEmFaltaRelatorio | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const aplicar = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    const r = await pdAplicarCartoesEmFalta();
    if (r === null) setErro('A API não respondeu — tente novamente.');
    else {
      setFeito(r);
      router.refresh();
    }
    setBusy(false);
    setConfirmando(false);
  };

  if (relatorio === null) {
    return (
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Cartões em falta</h3>
        <div className="empty">API indisponível (ou ainda sem o deploy desta versão).</div>
      </div>
    );
  }

  const alvo = feito ?? relatorio;
  const nada = alvo.comCartoesEmFalta === 0;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Cartões em falta na leitura ({alvo.comCartoesEmFalta})</h3>
      <p className="page-sub" style={{ marginTop: 0 }}>
        Clientes cujo HISCON tem cartão consignado só na tabela mensal de descontos — a leitura saiu
        sem RMC/RCC, e cada cartão perdido é <strong>1 processo a menos</strong> no guia, no dossiê
        e no abate do advogado. Aplicar acrescenta os cartões ao texto lido; a leitura dos
        empréstimos não é tocada e o texto anterior fica no backup.
      </p>

      {feito !== null ? (
        <div className="badge ok" style={{ marginBottom: 10 }}>
          {feito.aplicados} cliente(s) atualizados · {feito.cartoesEncontrados} cartão(ões)
          devolvido(s) à leitura.
        </div>
      ) : null}
      {erro !== null ? <div className="error-box">{erro}</div> : null}

      {nada ? (
        <div className="empty">
          Nenhum cliente nessa situação — {alvo.clientes} HISCON(s) conferidos.
        </div>
      ) : (
        <>
          <p style={{ fontSize: 14 }}>
            <strong>{alvo.cartoesEncontrados}</strong> cartão(ões) em{' '}
            <strong>{alvo.comCartoesEmFalta}</strong> cliente(s), de {alvo.clientes} HISCON(s)
            conferidos.
          </p>
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>Cliente (conversa)</th>
                  <th style={{ textAlign: 'center' }}>Cartões</th>
                  <th>Modalidade · banco</th>
                </tr>
              </thead>
              <tbody>
                {alvo.linhas
                  .filter((l) => l.resultado === 'CARTOES_ENCONTRADOS')
                  .map((l) => (
                    <tr key={l.chatId}>
                      <td className="mono">{l.chatId.split('@')[0]}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{l.cartoes}</td>
                      <td style={{ fontSize: 13 }}>{l.modalidades.join(' · ')}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {feito === null ? (
            confirmando ? (
              <div className="form-row" style={{ gap: 8 }}>
                <button className="primary" disabled={busy} onClick={() => void aplicar()}>
                  {busy
                    ? 'Aplicando…'
                    : `Confirmar — atualizar ${alvo.comCartoesEmFalta} cliente(s)`}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setConfirmando(false);
                  }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                className="primary"
                onClick={() => {
                  setConfirmando(true);
                }}
              >
                Devolver os cartões à leitura
              </button>
            )
          ) : null}
        </>
      )}
    </div>
  );
};

export default CartoesEmFalta;
