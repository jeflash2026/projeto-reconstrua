'use client';
// CENTRAL DE PERÍCIA DIGITAL — detalhe do caso: abas (Contratos, Documentos,
// Minuta, Revisão, Custódia) + os atos do ciclo. A emissão só ocorre pelo portão
// único do servidor (revisão humana obrigatória); esta tela apenas o aciona.
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import {
  pdAprovar,
  pdAssinar,
  pdGerarMinuta,
  pdIniciarAnalise,
  pdLiberar,
  pdRegistrarChecklist,
  pdRegistrarDocumento,
  pdRegistrarValoresBanco,
  pdSubmeterRevisao,
  type PdCaso,
  type PdEventoCustodia,
} from '../lib/actions';

type Aba =
  'contratos' | 'documentos' | 'financeiro' | 'verificacoes' | 'minuta' | 'revisao' | 'custodia';

const ITENS_BIOMETRIA = [
  'Arquivo original ou imagem inserida em PDF',
  'Resolução',
  'Metadados da imagem',
  'Data de captura',
  'Vínculo com a sessão',
  'Vínculo criptográfico com o contrato',
  'Relatório de liveness',
  'Prova de vida ativa',
  'Prova de vida passiva',
  'Análise de profundidade',
  'Presença de marcas d’água',
  'Identificador da sessão',
  'Possível reaproveitamento de imagem',
];
const ITENS_DOCUMENTO_ID = [
  'Presença de frente e verso',
  'Qualidade da imagem',
  'Metadados',
  'OCR',
  'Consistência entre nome, CPF, RG e data de nascimento',
  'Data da captura',
  'Vínculo com a sessão',
  'Documento já existente na base bancária',
  'Sinais observáveis de montagem',
  'Divergências entre dados',
];
const STATUS_CHECKLIST = [
  'NECESSITA_REVISAO',
  'PRESENTE',
  'AUSENTE',
  'INCONSISTENTE',
  'NAO_APLICAVEL',
];

const CONCLUSOES: Record<string, string> = {
  A: 'A — Elementos tecnicamente consistentes',
  B: 'B — Elementos insuficientes para atribuição segura de autoria',
  C: 'C — Inconsistências técnicas relevantes identificadas',
  D: 'D — Impossibilidade de conclusão com os documentos disponíveis',
  E: 'E — Necessidade de documentação complementar',
};

const PericiaDigitalCaso = ({
  caso,
  trilha,
  integro,
}: {
  caso: PdCaso;
  trilha: PdEventoCustodia[];
  integro: boolean | null;
}): ReactElement => {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>('contratos');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conclusao, setConclusao] = useState('E');

  const agir = async (fn: () => Promise<{ ok: boolean; error: string | null }>): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setErro(null);
    const r = await fn();
    if (!r.ok) setErro(r.error ?? 'operação recusada');
    else router.refresh();
    setBusy(false);
  };

  const enviarArquivo = (file: File | null): void => {
    if (file === null || busy) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      void agir(() =>
        pdRegistrarDocumento(caso.id, {
          nomeOriginal: file.name,
          base64,
          categoria: 'DOCUMENTOS_DO_BANCO',
          origem: 'BANCO',
          responsavelEnvio: 'admin',
        }),
      );
    };
    reader.readAsDataURL(file);
  };

  const minutaAtual = caso.minutaVersoes[caso.minutaVersoes.length - 1] ?? null;

  return (
    <>
      {erro ? (
        <div className="error-box" style={{ marginBottom: 12 }}>
          {erro}
        </div>
      ) : null}

      {/* Ações do ciclo — o servidor recusa transições inválidas. */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ flexWrap: 'wrap' }}>
          <button disabled={busy} onClick={() => void agir(() => pdIniciarAnalise(caso.id))}>
            Iniciar análise
          </button>
          <select
            value={conclusao}
            onChange={(e) => {
              setConclusao(e.target.value);
            }}
          >
            {Object.entries(CONCLUSOES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button
            disabled={busy}
            onClick={() => void agir(() => pdGerarMinuta(caso.id, conclusao))}
          >
            Gerar minuta
          </button>
          <button disabled={busy} onClick={() => void agir(() => pdSubmeterRevisao(caso.id))}>
            Submeter à revisão
          </button>
          <button disabled={busy} onClick={() => void agir(() => pdAssinar(caso.id))}>
            Assinar (após aprovação)
          </button>
          <button
            className="primary"
            disabled={busy}
            onClick={() => void agir(() => pdLiberar(caso.id))}
          >
            Liberar ao advogado
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="form-row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {(
          [
            'contratos',
            'documentos',
            'financeiro',
            'verificacoes',
            'minuta',
            'revisao',
            'custodia',
          ] as Aba[]
        ).map((a) => (
          <button
            key={a}
            className={aba === a ? 'primary' : ''}
            onClick={() => {
              setAba(a);
            }}
          >
            {a[0]?.toUpperCase()}
            {a.slice(1)}
          </button>
        ))}
      </div>

      {aba === 'contratos' ? (
        <div className="card">
          <h3>Contratos ({caso.fichas.length})</h3>
          {caso.fichas.map((f, i) => (
            <div key={i} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
              <strong>{f.contrato}</strong> · {f.bancoNome} ({f.bancoCodigo}) ·{' '}
              <span className="badge accent">{f.classificacao}</span>
              <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 4 }}>
                Situação: {f.situacao} · Parcelas: {f.qtdeParcelas} · Parcela: {f.valorParcela} ·
                Liberado: {f.valorEmprestado} · {f.competenciaInicio}–{f.competenciaFim}
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>{f.observacao}</div>
            </div>
          ))}
        </div>
      ) : null}

      {aba === 'documentos' ? (
        <div className="card">
          <h3>Documentos ({caso.documentos.length})</h3>
          <label className="sol-label" style={{ marginBottom: 10, display: 'block' }}>
            Registrar documento (o original é preservado e recebe hash SHA-256)
            <input
              type="file"
              onChange={(e) => {
                enviarArquivo(e.target.files?.[0] ?? null);
              }}
            />
          </label>
          {caso.documentos.length === 0 ? (
            <div className="empty">Nenhum documento registrado.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Arquivo</th>
                    <th>Categoria</th>
                    <th>Origem</th>
                    <th>SHA-256</th>
                  </tr>
                </thead>
                <tbody>
                  {caso.documentos.map((d) => (
                    <tr key={d.id}>
                      <td>
                        {d.nomeOriginal}
                        {d.derivadoDe ? ' (derivado)' : ''}
                      </td>
                      <td>{d.categoria}</td>
                      <td>{d.origem}</td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        {d.hashSha256.slice(0, 24)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {aba === 'financeiro' ? <FinanceiroForm caso={caso} busy={busy} agir={agir} /> : null}

      {aba === 'verificacoes' ? (
        <>
          <ChecklistForm
            titulo="Selfie, biometria e prova de vida (6D)"
            tipo="BIOMETRIA"
            itens={ITENS_BIOMETRIA}
            casoId={caso.id}
            busy={busy}
            agir={agir}
          />
          <ChecklistForm
            titulo="Documento de identificação (6E)"
            tipo="DOCUMENTO_ID"
            itens={ITENS_DOCUMENTO_ID}
            casoId={caso.id}
            busy={busy}
            agir={agir}
          />
        </>
      ) : null}

      {aba === 'minuta' ? (
        <div className="card">
          <h3>Minuta {minutaAtual ? `(versão ${String(minutaAtual.versao)})` : ''}</h3>
          {minutaAtual === null ? (
            <div className="empty">Nenhuma minuta gerada. Use “Gerar minuta”.</div>
          ) : (
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, lineHeight: 1.5 }}>
              {minutaAtual.texto}
            </pre>
          )}
        </div>
      ) : null}

      {aba === 'revisao' ? <RevisaoPerito caso={caso} busy={busy} agir={agir} /> : null}

      {aba === 'custodia' ? (
        <div className="card">
          <h3>Cadeia de custódia</h3>
          <p className="page-sub" style={{ marginTop: 0 }}>
            Integridade:{' '}
            {integro === null ? (
              '—'
            ) : integro ? (
              <span className="badge ok">íntegra (hash encadeado válido)</span>
            ) : (
              <span className="badge bad">ADULTERADA</span>
            )}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ação</th>
                  <th>Usuário</th>
                  <th>Quando</th>
                  <th>Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {trilha.map((e) => (
                  <tr key={e.seq}>
                    <td>{e.seq}</td>
                    <td>{e.acao}</td>
                    <td>{e.usuario}</td>
                    <td className="mono" style={{ fontSize: 11 }}>
                      {new Date(e.em).toLocaleString('pt-BR')}
                    </td>
                    <td style={{ fontSize: 12 }}>{e.detalhe ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </>
  );
};

function ChecklistForm({
  titulo,
  tipo,
  itens,
  casoId,
  busy,
  agir,
}: {
  titulo: string;
  tipo: 'BIOMETRIA' | 'DOCUMENTO_ID';
  itens: string[];
  casoId: string;
  busy: boolean;
  agir: (fn: () => Promise<{ ok: boolean; error: string | null }>) => Promise<void>;
}): ReactElement {
  const [estado, setEstado] = useState<Record<string, { status: string; obs: string }>>(() =>
    Object.fromEntries(itens.map((i) => [i, { status: 'NECESSITA_REVISAO', obs: '' }])),
  );
  const set = (item: string, campo: 'status' | 'obs', v: string): void =>
    setEstado((p) => ({ ...p, [item]: { ...p[item]!, [campo]: v } }));

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>{titulo}</h3>
      <p className="page-sub" style={{ marginTop: 0 }}>
        Observação do perito, item a item. A automação não conclui fraude/replay/reaproveitamento
        sem evidência suficiente.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Status</th>
              <th>Observação</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <tr key={item}>
                <td style={{ fontSize: 13 }}>{item}</td>
                <td>
                  <select
                    value={estado[item]?.status ?? 'NECESSITA_REVISAO'}
                    onChange={(e) => set(item, 'status', e.target.value)}
                  >
                    {STATUS_CHECKLIST.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={estado[item]?.obs ?? ''}
                    onChange={(e) => set(item, 'obs', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        className="primary"
        style={{ marginTop: 10 }}
        disabled={busy}
        onClick={() =>
          void agir(() =>
            pdRegistrarChecklist(
              casoId,
              tipo,
              itens.map((item) => ({
                item,
                status: estado[item]?.status ?? 'NECESSITA_REVISAO',
                observacao: estado[item]?.obs?.trim() ? estado[item].obs.trim() : null,
              })),
            ),
          )
        }
      >
        Salvar checklist
      </button>
    </div>
  );
}

function FinanceiroForm({
  caso,
  busy,
  agir,
}: {
  caso: PdCaso;
  busy: boolean;
  agir: (fn: () => Promise<{ ok: boolean; error: string | null }>) => Promise<void>;
}): ReactElement {
  const [f, setF] = useState({
    valorContratoDeclarado: '',
    valorCreditado: '',
    dataCredito: '',
    contaDestinataria: '',
    titularidade: '',
    valorRefinanciado: '',
    valorQuitacao: '',
    trocoLiberado: '',
  });
  const set = (k: keyof typeof f, v: string): void => setF((prev) => ({ ...prev, [k]: v }));
  const numOrNull = (s: string): number | null => {
    const n = Number(s.replace(',', '.'));
    return s.trim() === '' || !Number.isFinite(n) ? null : n;
  };
  const strOrNull = (s: string): string | null => (s.trim() === '' ? null : s.trim());

  const campos: [keyof typeof f, string, 'num' | 'str'][] = [
    ['valorContratoDeclarado', 'Valor do contrato (documento do banco)', 'num'],
    ['valorCreditado', 'Valor creditado ao beneficiário', 'num'],
    ['dataCredito', 'Data do crédito', 'str'],
    ['contaDestinataria', 'Conta destinatária', 'str'],
    ['titularidade', 'Titularidade da conta', 'str'],
    ['valorRefinanciado', 'Valor refinanciado', 'num'],
    ['valorQuitacao', 'Valor de quitação', 'num'],
    ['trocoLiberado', 'Troco liberado', 'num'],
  ];

  return (
    <div className="card">
      <h3>Fluxo financeiro (valores do banco)</h3>
      <p className="page-sub" style={{ marginTop: 0 }}>
        Informe o que os documentos do banco trazem. O sistema compara com o HISCON e aponta
        divergências — o crédito é um elemento do caso, nunca prova de autoria.
      </p>
      <div className="form-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        {campos.map(([k, rotulo]) => (
          <label key={k} className="sol-label">
            {rotulo}
            <input value={f[k]} onChange={(e) => set(k, e.target.value)} />
          </label>
        ))}
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            void agir(() =>
              pdRegistrarValoresBanco(caso.id, {
                valorContratoDeclarado: numOrNull(f.valorContratoDeclarado),
                valorCreditado: numOrNull(f.valorCreditado),
                dataCredito: strOrNull(f.dataCredito),
                contaDestinataria: strOrNull(f.contaDestinataria),
                titularidade: strOrNull(f.titularidade),
                valorRefinanciado: numOrNull(f.valorRefinanciado),
                valorQuitacao: numOrNull(f.valorQuitacao),
                trocoLiberado: numOrNull(f.trocoLiberado),
              }),
            )
          }
        >
          Salvar valores do banco
        </button>
      </div>
    </div>
  );
}

function RevisaoPerito({
  caso,
  busy,
  agir,
}: {
  caso: PdCaso;
  busy: boolean;
  agir: (fn: () => Promise<{ ok: boolean; error: string | null }>) => Promise<void>;
}): ReactElement {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [qualificacao, setQualificacao] = useState('');
  const [especialidades, setEspecialidades] = useState('');
  const [registro, setRegistro] = useState('');
  const [curriculo, setCurriculo] = useState('');
  const [declara, setDeclara] = useState(false);
  const [examinou, setExaminou] = useState(false);

  if (caso.aprovacao !== null) {
    return (
      <div className="card">
        <h3>Revisão do perito</h3>
        <p>
          Aprovado por <strong>{caso.aprovacao.perito.nomeCompleto}</strong> em{' '}
          {new Date(caso.aprovacao.aprovadoEm).toLocaleString('pt-BR')}.
          {caso.aprovacao.assinadoEm
            ? ` Assinado em ${new Date(caso.aprovacao.assinadoEm).toLocaleString('pt-BR')}.`
            : ' Aguardando assinatura.'}
        </p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Revisão e aprovação do perito</h3>
      <p className="page-sub" style={{ marginTop: 0 }}>
        A automação não aprova sozinha. Preencha a identificação e as declarações do perito humano.
      </p>
      <div className="form-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <input placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
        <input placeholder="CPF" value={cpf} onChange={(e) => setCpf(e.target.value)} />
        <input
          placeholder="Qualificação profissional"
          value={qualificacao}
          onChange={(e) => setQualificacao(e.target.value)}
        />
        <input
          placeholder="Especialidades"
          value={especialidades}
          onChange={(e) => setEspecialidades(e.target.value)}
        />
        <input
          placeholder="Registro profissional (opcional)"
          value={registro}
          onChange={(e) => setRegistro(e.target.value)}
        />
        <textarea
          placeholder="Currículo resumido"
          rows={3}
          value={curriculo}
          onChange={(e) => setCurriculo(e.target.value)}
        />
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={declara} onChange={(e) => setDeclara(e.target.checked)} />{' '}
          Declaro responsabilidade técnica pelo conteúdo.
        </label>
        <label style={{ fontSize: 13 }}>
          <input
            type="checkbox"
            checked={examinou}
            onChange={(e) => setExaminou(e.target.checked)}
          />{' '}
          Confirmo que examinei os arquivos do caso.
        </label>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            void agir(() =>
              pdAprovar(caso.id, {
                nomeCompleto: nome,
                cpf,
                qualificacao,
                especialidades,
                registroProfissional: registro.trim() === '' ? null : registro,
                curriculoResumido: curriculo,
                declaracaoResponsabilidade: declara,
                confirmouExameDosArquivos: examinou,
              }),
            )
          }
        >
          Aprovar como perito
        </button>
      </div>
    </div>
  );
}

export default PericiaDigitalCaso;
