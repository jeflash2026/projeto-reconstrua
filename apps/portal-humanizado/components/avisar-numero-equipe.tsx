'use client';
// ─────────────────────────────────────────────────────────────────────────────
// AVISO DO NÚMERO DA EQUIPE (pedido do dono, 2026-10-09).
//
// A Layara chama do número dela e uma parte dos clientes nunca responde. Para
// quem tem 60+ e ouve falar de golpe todo dia, número desconhecido no WhatsApp
// é motivo para ignorar — não é desinteresse. Este botão manda a AHRI, que a
// pessoa JÁ conhece, avalizar o número da equipe. Não cobra documento nenhum.
//
// O ritual é o mesmo dos outros disparos (decreto anti-automático): nada sai
// sem o clique, a confirmação mostra o número exato de pessoas e o resultado
// volta na tela. O alvo é calculado no servidor — quem recebeu a documentação
// e não voltou, menos quem já recebeu template nas últimas 24h.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { avisarNumeroDaEquipe } from '../lib/actions';

const TETO = 60;

const AvisarNumeroEquipe = ({
  quantos,
  uf,
}: {
  /** Quantos clientes da fila estão sem retorno (já calculado pela mesa). */
  quantos: number;
  /** Estado em foco, quando a mesa está filtrada — o lote respeita o filtro. */
  uf?: string | null;
}): ReactElement | null => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  if (quantos === 0) return null;
  const alvo = Math.min(quantos, TETO);

  const disparar = async (): Promise<void> => {
    if (busy) return;
    const ondeTexto = uf != null && uf !== '' ? ` de ${uf}` : '';
    const confirma = window.confirm(
      `Avisar ${String(alvo)} cliente${alvo === 1 ? '' : 's'}${ondeTexto} de que o WhatsApp (16) 98819-4806 é da nossa equipe?\n\n` +
        'Vai só para quem recebeu a documentação e ainda não respondeu. ' +
        'Quem já recebeu alguma mensagem nossa nas últimas 24h fica de fora.\n\n' +
        'A mensagem não cobra documento — apenas avaliza o número da Layara.',
    );
    if (!confirma) return;
    setBusy(true);
    setAviso(null);
    const r = await avisarNumeroDaEquipe(uf ?? null, TETO);
    setBusy(false);
    if (!r.ok) {
      setAviso(r.erro ?? 'não foi possível disparar');
      return;
    }
    setAviso(
      `${String(r.enviados)} de ${String(r.alvos)} avisado(s).${r.erro !== undefined ? ` ${r.erro}` : ''}`,
    );
    router.refresh();
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <button
        type="button"
        className="btn"
        disabled={busy}
        title="Manda a AHRI avisar que o WhatsApp da Layara é nosso — só para quem não respondeu"
        onClick={() => {
          void disparar();
        }}
      >
        {busy
          ? 'Enviando…'
          : `📣 Avisar o número da equipe (${String(alvo)}${quantos > TETO ? ` de ${String(quantos)}` : ''})`}
      </button>
      {aviso !== null ? <span className="badge">{aviso}</span> : null}
    </span>
  );
};

export default AvisarNumeroEquipe;
