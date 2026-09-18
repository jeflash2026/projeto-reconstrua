'use client';
// FILA DE FOLLOW-UP — o dono marca quem recebe e aprova o envio (regra da
// casa: nada sai por iniciativa da AHRI sem confirmação).
import { useRouter } from 'next/navigation';
import { useState, type ReactElement } from 'react';
import { enviarFollowups } from '../lib/actions';
import { haQuanto, telefoneBr } from '../lib/api';

export interface FollowupItem {
  id: string;
  nome: string | null;
  cidade: string | null;
  resumo: string | null;
  followupDevidoEm: string | null;
  dentroDaJanela: boolean;
}

export const FollowupsForm = ({
  itens,
  modeloConfigurado,
}: {
  itens: FollowupItem[];
  modeloConfigurado: boolean;
}): ReactElement => {
  const router = useRouter();
  const enviaveis = itens.filter((i) => i.dentroDaJanela || modeloConfigurado);
  const [marcados, setMarcados] = useState<Set<string>>(new Set(enviaveis.map((i) => i.id)));
  const [ocupado, setOcupado] = useState(false);
  const [retorno, setRetorno] = useState<{ ok: number; falhas: string[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const alternar = (id: string): void => {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const enviar = async (): Promise<void> => {
    if (ocupado || marcados.size === 0) return;
    setOcupado(true);
    setErro(null);
    const r = await enviarFollowups([...marcados]);
    setOcupado(false);
    if (!r.ok || r.resultados === undefined) {
      setErro(r.error ?? 'não foi possível enviar');
      return;
    }
    setRetorno({
      ok: r.resultados.filter((x) => x.ok).length,
      falhas: r.resultados.filter((x) => !x.ok).map((x) => `${telefoneBr(x.id)}: ${x.detalhe}`),
    });
    router.refresh();
  };

  return (
    <div className="cartao">
      <table className="tabela">
        <thead>
          <tr>
            <th style={{ width: 36 }} />
            <th>Lead</th>
            <th>Caso</th>
            <th>Devido</th>
            <th>Como sai</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => {
            const pode = i.dentroDaJanela || modeloConfigurado;
            return (
              <tr key={i.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={marcados.has(i.id)}
                    disabled={!pode}
                    onChange={() => {
                      alternar(i.id);
                    }}
                  />
                </td>
                <td>
                  <a href={`/cnh/leads/${i.id}`} style={{ fontWeight: 700 }}>
                    {i.nome ?? telefoneBr(i.id)}
                  </a>
                  <div className="lead-sub">{i.cidade ?? ''}</div>
                </td>
                <td>{i.resumo ?? '—'}</td>
                <td>{haQuanto(i.followupDevidoEm)}</td>
                <td>
                  {i.dentroDaJanela ? (
                    <span className="selo ok">mensagem normal</span>
                  ) : modeloConfigurado ? (
                    <span className="selo ahri">modelo aprovado</span>
                  ) : (
                    <span className="selo ruim">sem modelo aprovado</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="acoes" style={{ marginTop: 14 }}>
        <button
          className="btn primario"
          disabled={ocupado || marcados.size === 0}
          onClick={() => void enviar()}
        >
          {ocupado ? 'Enviando…' : `Aprovar e enviar (${String(marcados.size)})`}
        </button>
      </div>
      {retorno !== null ? (
        <div className={retorno.falhas.length === 0 ? 'ok-box' : 'erro'}>
          {retorno.ok} enviado(s).
          {retorno.falhas.length > 0 ? ` Não enviados: ${retorno.falhas.join(' · ')}` : ''}
        </div>
      ) : null}
      {erro !== null ? <div className="erro">{erro}</div> : null}
    </div>
  );
};
