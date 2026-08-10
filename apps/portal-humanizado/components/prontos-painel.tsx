'use client';
// CLIENTES PRONTOS (pedido do dono, 2026-08-09) — quem entregou os 4
// documentos deixa de ser "atendimento" e vira CLIENTE. Esta é a agenda
// permanente deles: organizada por ESTADO e por ADVOGADO responsável, com
// busca por nome/telefone — para quando for preciso chamar de volta (pedir um
// documento novo, avisar de uma fase do processo). Só leitura + atalho para a
// conversa; nada aqui dispara mensagem.
import { useMemo, useState, type ReactElement } from 'react';
import Link from 'next/link';

export interface ClientePronto {
  chatId: string;
  nome: string;
  telefone: string;
  uf: string;
  contratos: number;
  potencial: number;
  confirmadoEm: string;
  advogadoId: string | null;
}

export interface AdvogadoOpcao {
  id: string;
  nome: string;
}

const SEM_ADVOGADO = '__sem__';

function dataBr(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

function moeda(v: number): string {
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
}

function telefoneBr(bruto: string): string {
  const d = bruto.replace(/\D/g, '').replace(/^55/, '');
  if (d.length < 10) return bruto;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

export default function ProntosPainel({
  clientes,
  advogados,
}: {
  clientes: ClientePronto[];
  advogados: AdvogadoOpcao[];
}): ReactElement {
  const [uf, setUf] = useState<string | null>(null);
  const [advogado, setAdvogado] = useState<string | null>(null);
  const [busca, setBusca] = useState('');

  const nomeDoAdvogado = useMemo(() => {
    const mapa = new Map(advogados.map((a) => [a.id, a.nome]));
    return (id: string | null): string =>
      id === null ? '—' : (mapa.get(id) ?? 'advogado removido');
  }, [advogados]);

  // Contagens dos chips (sempre sobre o total, para a secretária ver o mapa).
  const porUf = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of clientes) m.set(c.uf || 'SEM UF', (m.get(c.uf || 'SEM UF') ?? 0) + 1);
    return [...m.entries()].sort(([a], [b]) =>
      a === 'SEM UF' ? 1 : b === 'SEM UF' ? -1 : a.localeCompare(b),
    );
  }, [clientes]);

  const porAdvogado = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of clientes) {
      const chave = c.advogadoId ?? SEM_ADVOGADO;
      m.set(chave, (m.get(chave) ?? 0) + 1);
    }
    return [...m.entries()].sort(([a], [b]) =>
      a === SEM_ADVOGADO
        ? 1
        : b === SEM_ADVOGADO
          ? -1
          : nomeDoAdvogado(a).localeCompare(nomeDoAdvogado(b)),
    );
  }, [clientes, nomeDoAdvogado]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const qDigitos = q.replace(/\D/g, '');
    return clientes
      .filter((c) => uf === null || (c.uf || 'SEM UF') === uf)
      .filter((c) => advogado === null || (c.advogadoId ?? SEM_ADVOGADO) === advogado)
      .filter(
        (c) =>
          q === '' ||
          c.nome.toLowerCase().includes(q) ||
          (qDigitos !== '' && c.telefone.replace(/\D/g, '').includes(qDigitos)),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [clientes, uf, advogado, busca]);

  const potencialTotal = filtrados.reduce((s, c) => s + c.potencial, 0);
  const contratosTotal = filtrados.reduce((s, c) => s + c.contratos, 0);

  return (
    <>
      <div className="prontos-resumo">
        <div className="prontos-card">
          <span className="prontos-valor">{filtrados.length}</span>
          <span className="prontos-rotulo">
            cliente(s){uf !== null ? ` em ${uf}` : ''}
            {advogado !== null
              ? ` · ${nomeDoAdvogado(advogado === SEM_ADVOGADO ? null : advogado)}`
              : ''}
          </span>
        </div>
        <div className="prontos-card">
          <span className="prontos-valor">{contratosTotal}</span>
          <span className="prontos-rotulo">contratos</span>
        </div>
        <div className="prontos-card">
          <span className="prontos-valor">{moeda(potencialTotal)}</span>
          <span className="prontos-rotulo">potencial somado</span>
        </div>
      </div>

      <div className="filtro-uf">
        <button
          type="button"
          className={`chip-uf${uf === null ? ' ativo' : ''}`}
          onClick={() => setUf(null)}
        >
          Todos os estados ({clientes.length})
        </button>
        {porUf.map(([sigla, quantos]) => (
          <button
            key={sigla}
            type="button"
            className={`chip-uf${uf === sigla ? ' ativo' : ''}`}
            onClick={() => setUf(sigla)}
          >
            {sigla} ({quantos})
          </button>
        ))}
      </div>

      <div className="filtro-uf">
        <button
          type="button"
          className={`chip-uf${advogado === null ? ' ativo' : ''}`}
          onClick={() => setAdvogado(null)}
        >
          Todos os advogados
        </button>
        {porAdvogado.map(([id, quantos]) => (
          <button
            key={id}
            type="button"
            className={`chip-uf${advogado === id ? ' ativo' : ''}`}
            onClick={() => setAdvogado(id)}
          >
            {id === SEM_ADVOGADO ? 'sem advogado' : nomeDoAdvogado(id)} ({quantos})
          </button>
        ))}
      </div>

      <input
        type="search"
        className="prontos-busca"
        placeholder="Buscar cliente por nome ou telefone…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />

      {filtrados.length === 0 ? (
        <div className="empty">
          Nenhum cliente neste recorte. Quando alguém completar os 4 documentos, aparece aqui
          automaticamente.
        </div>
      ) : (
        <div className="prontos-tabela">
          <table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>UF</th>
                <th>Advogado responsável</th>
                <th>Contratos</th>
                <th>Potencial</th>
                <th>Cliente desde</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.chatId}>
                  <td>
                    <div className="prontos-nome">{c.nome}</div>
                    <div className="prontos-fone">{telefoneBr(c.telefone)}</div>
                  </td>
                  <td>{c.uf || '—'}</td>
                  <td>{nomeDoAdvogado(c.advogadoId)}</td>
                  <td>{c.contratos}</td>
                  <td>{moeda(c.potencial)}</td>
                  <td>{dataBr(c.confirmadoEm)}</td>
                  <td>
                    <Link className="btn" href={`/chat/${encodeURIComponent(c.chatId)}`}>
                      Abrir conversa
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
