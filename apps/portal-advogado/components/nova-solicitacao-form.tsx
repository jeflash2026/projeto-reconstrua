'use client';
// 15C-2 · TELA 3 — Nova Solicitação. Formulário simples + PREVIEW ao vivo da
// mensagem que a AHRI enviará (mesmo formato do backend). "Categoria" é açúcar
// de apresentação: sugere nomes comuns de documento (o domínio não muda).
import { useMemo, useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { solicitarDocumento } from '../lib/actions';
import { previewMensagemAhri } from './solicitacao-status';

// Decreto HISCON-ONLY (2026-07-22): o atendimento inicial coleta SÓ o HISCON;
// RG/CNH e comprovante de endereço são solicitados AQUI, pelo advogado, com um
// clique — presets prontos na primeira categoria.
const CATEGORIAS: Readonly<Record<string, readonly string[]>> = {
  'Documentação do cliente': ['RG (frente e verso) ou CNH', 'Comprovante de endereço'],
  Representação: ['Procuração', 'Contrato de honorários assinado'],
  'Benefício INSS': [
    'Carta de Concessão',
    'Extrato de margem consignável (Meu INSS)',
    'Extrato de pagamento do benefício',
  ],
  Bancários: ['Extrato Bancário', 'Contrato do empréstimo', 'Fatura do cartão consignado'],
  Judiciais: ['Documento solicitado pelo Juízo', 'Comprovante de residência atualizado'],
  Outros: [],
};

export interface MeuCliente {
  missionId: string;
  chatId: string;
  nome: string;
}

const NovaSolicitacaoForm = ({
  casoInicial,
  clienteInicial,
  requestedBy,
  meusClientes = [],
}: {
  casoInicial: string;
  clienteInicial: string;
  requestedBy: string;
  meusClientes?: MeuCliente[];
}): ReactElement => {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [caseId, setCaseId] = useState(casoInicial);
  const [clientId, setClientId] = useState(clienteInicial);
  // Decreto Tráfego Pago: seleção do cliente PELO NOME (destinados a mim) —
  // caso (missionId) e WhatsApp saem da seleção; digitação vira exceção.
  const escolherCliente = (missionId: string): void => {
    const c = meusClientes.find((m) => m.missionId === missionId);
    if (c) {
      setCaseId(c.missionId);
      setClientId(c.chatId);
    }
  };
  const [categoria, setCategoria] = useState<string>('Documentação do cliente');
  const [documento, setDocumento] = useState('');
  const [prioridade, setPrioridade] = useState<'normal' | 'alta'>('normal');
  const [prazo, setPrazo] = useState('');
  const [lembrete, setLembrete] = useState<'nenhum' | '24h' | '48h' | '72h' | 'semanal'>('nenhum');
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  // Decreto Tráfego Pago · B1: documento PARA ASSINATURA (procuração/contrato de
  // honorários) — o advogado anexa; a AHRI envia o arquivo ao cliente assinar.
  const [anexo, setAnexo] = useState<{ fileName: string; mimeType: string; base64: string } | null>(
    null,
  );
  const ehAssinatura = /procura[çc][ãa]o|honor[áa]rios/i.test(documento);

  const preview = useMemo(
    () => previewMensagemAhri(documento, mensagem, requestedBy, ehAssinatura),
    [documento, mensagem, requestedBy, ehAssinatura],
  );

  const aoEscolherArquivo = (file: File | null): void => {
    if (file === null) {
      setAnexo(null);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErro('Arquivo muito grande (máx. 8 MB).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // readAsDataURL sempre produz string; ArrayBuffer nunca ocorre neste modo.
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      setAnexo({ fileName: file.name, mimeType: file.type || 'application/pdf', base64 });
      setErro(null);
    };
    reader.readAsDataURL(file);
  };

  const enviar = (): void => {
    if (documento.trim() === '') {
      setErro('Informe o documento que você precisa.');
      return;
    }
    if (caseId.trim() === '' || clientId.trim() === '') {
      setErro('Caso e cliente são obrigatórios.');
      return;
    }
    setErro(null);
    iniciar(() => {
      // Transition síncrona + IIFE async (tipagens React 18 e 19).
      void (async () => {
        const r = await solicitarDocumento({
          caseId: caseId.trim(),
          clientId: clientId.trim(),
          documentName: documento.trim(),
          requestedByName: requestedBy,
          ...(mensagem.trim() !== '' ? { optionalMessage: mensagem.trim() } : {}),
          priority: prioridade,
          ...(prazo !== '' ? { dueAt: new Date(`${prazo}T23:59:59`).toISOString() } : {}),
          reminderPolicy: lembrete,
          ...(anexo !== null ? { anexo } : {}),
        });
        if (!r.ok || r.solicitacao === null) {
          setErro(r.error ?? 'falha ao criar');
          return;
        }
        if (r.error !== null) {
          setErro(r.error);
          return;
        } // criada, mas o envio falhou — mostrar antes de sair
        router.push(`/solicitacoes/${r.solicitacao.requestId}`);
      })();
    });
  };

  return (
    <div className="sol-form-wrap">
      <div className="sol-form">
        {meusClientes.length > 0 ? (
          <label className="sol-label">
            Cliente *
            <select
              className="sol-input"
              value={meusClientes.find((m) => m.missionId === caseId) ? caseId : ''}
              onChange={(e) => {
                escolherCliente(e.target.value);
              }}
            >
              <option value="" disabled>
                Selecione o cliente destinado a você…
              </option>
              {meusClientes.map((c) => (
                <option key={c.missionId} value={c.missionId}>
                  {c.nome}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <p className="sol-nota">
              Nenhum cliente destinado a você ainda — o escritório encaminha pelos painéis. Se
              precisar, informe manualmente:
            </p>
            <label className="sol-label">
              Caso
              <input
                className="sol-input mono"
                value={caseId}
                onChange={(e) => {
                  setCaseId(e.target.value);
                }}
                placeholder="id do caso/missão"
              />
            </label>
            <label className="sol-label">
              Cliente (WhatsApp)
              <input
                className="sol-input mono"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                }}
                placeholder="5541999999999@s.whatsapp.net"
              />
            </label>
          </>
        )}

        <label className="sol-label">
          Categoria
          <select
            className="sol-input"
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value);
            }}
          >
            {Object.keys(CATEGORIAS).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        {CATEGORIAS[categoria] && CATEGORIAS[categoria].length > 0 ? (
          <div className="sol-sugestoes">
            {CATEGORIAS[categoria].map((d) => (
              <button
                key={d}
                type="button"
                className={`sol-chip${documento === d ? ' ativo' : ''}`}
                onClick={() => {
                  setDocumento(d);
                }}
              >
                {d}
              </button>
            ))}
          </div>
        ) : null}

        <label className="sol-label">
          Documento *
          <input
            className="sol-input"
            value={documento}
            onChange={(e) => {
              setDocumento(e.target.value);
            }}
            placeholder="ex.: Procuração"
          />
        </label>

        <div className="sol-linha">
          <label className="sol-label">
            Prioridade
            <select
              className="sol-input"
              value={prioridade}
              onChange={(e) => {
                setPrioridade(e.target.value as 'normal' | 'alta');
              }}
            >
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
            </select>
          </label>
          <label className="sol-label">
            Prazo
            <input
              className="sol-input"
              type="date"
              value={prazo}
              onChange={(e) => {
                setPrazo(e.target.value);
              }}
            />
          </label>
          <label className="sol-label">
            Lembrete automático
            <select
              className="sol-input"
              value={lembrete}
              onChange={(e) => {
                setLembrete(e.target.value as typeof lembrete);
              }}
            >
              <option value="nenhum">Nenhum</option>
              <option value="24h">A cada 24h</option>
              <option value="48h">A cada 48h</option>
              <option value="72h">A cada 72h</option>
              <option value="semanal">Semanal</option>
            </select>
          </label>
        </div>

        <label className="sol-label">
          Mensagem opcional ao cliente
          <textarea
            className="sol-input"
            rows={2}
            value={mensagem}
            onChange={(e) => {
              setMensagem(e.target.value);
            }}
            placeholder="ex.: Precisamos deste documento para distribuição da ação."
          />
        </label>

        <label className="sol-label">
          Anexar documento para assinatura{' '}
          {ehAssinatura ? '(recomendado para procuração/honorários)' : '(opcional)'}
          <input
            className="sol-input"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => {
              aoEscolherArquivo(e.target.files?.[0] ?? null);
            }}
          />
        </label>
        {anexo !== null ? (
          <p className="sol-nota">
            📎 {anexo.fileName} — a AHRI enviará este arquivo ao cliente para assinar e devolver.
          </p>
        ) : ehAssinatura ? (
          <p className="sol-nota">
            Sem anexo, a AHRI apenas pedirá o documento — para assinatura, anexe o arquivo.
          </p>
        ) : null}

        {erro ? <p className="sol-erro">{erro}</p> : null}
        <button
          className="sol-btn sol-btn-primario sol-btn-grande"
          onClick={enviar}
          disabled={pendente}
        >
          {pendente ? 'Enviando à AHRI…' : 'Solicitar Documento'}
        </button>
        <p className="sol-nota">
          A AHRI conversa com o cliente por você e avisa quando o documento chegar.
        </p>
      </div>

      <div className="sol-preview">
        <div className="sol-preview-titulo">A AHRI enviará esta mensagem:</div>
        <div className="sol-preview-bolha">{preview}</div>
      </div>
    </div>
  );
};

export default NovaSolicitacaoForm;
