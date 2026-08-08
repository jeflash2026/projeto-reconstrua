'use client';
// FORMULÁRIO de cliente (novo + edição) — espelho do original: dados civis,
// contatos, endereço e observações. Anexos entram no DETALHE, após criar.
import { useState, type ReactElement } from 'react';
import type { ClienteJuridico } from '../lib/api';

const UFS =
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export default function ClienteForm({
  cliente = null,
}: {
  cliente?: ClienteJuridico | null;
}): ReactElement {
  const [dados, setDados] = useState<Record<string, string>>({
    nome: cliente?.nome ?? '',
    nascimento: cliente?.nascimento ?? '',
    sexo: cliente?.sexo ?? '',
    cpfCnpj: cliente?.cpfCnpj ?? '',
    rg: cliente?.rg ?? '',
    orgaoEmissor: cliente?.orgaoEmissor ?? '',
    ufEmissao: cliente?.ufEmissao ?? '',
    email: cliente?.email ?? '',
    telefone: cliente?.telefone ?? '',
    celular1: cliente?.celular1 ?? '',
    celular2: cliente?.celular2 ?? '',
    logradouro: cliente?.endereco.logradouro ?? '',
    numero: cliente?.endereco.numero ?? '',
    bairro: cliente?.endereco.bairro ?? '',
    complemento: cliente?.endereco.complemento ?? '',
    cep: cliente?.endereco.cep ?? '',
    cidade: cliente?.endereco.cidade ?? '',
    uf: cliente?.endereco.uf ?? '',
    observacoes: cliente?.observacoes ?? '',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const campo = (
    chave: string,
    rotulo: string,
    extra?: Partial<{ tipo: string }>,
  ): ReactElement => (
    <label className="campo" key={chave}>
      <span>{rotulo}</span>
      <input
        type={extra?.tipo ?? 'text'}
        value={dados[chave] ?? ''}
        onChange={(e) => setDados((d) => ({ ...d, [chave]: e.target.value }))}
      />
    </label>
  );

  async function salvar(): Promise<void> {
    setErro(null);
    if (dados['nome']?.trim() === '') {
      setErro('o nome do cliente é obrigatório');
      return;
    }
    setOcupado(true);
    try {
      const destino =
        cliente === null ? '/juridico/api/j/clientes' : `/juridico/api/j/clientes/${cliente.id}`;
      const res = await fetch(destino, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          dados: {
            ...dados,
            endereco: {
              logradouro: dados['logradouro'],
              numero: dados['numero'],
              bairro: dados['bairro'],
              complemento: dados['complemento'],
              cep: dados['cep'],
              cidade: dados['cidade'],
              uf: dados['uf'],
            },
          },
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; valor?: string };
      if (!res.ok) {
        setErro(data.error ?? 'falha ao salvar');
        return;
      }
      window.location.href =
        cliente === null && typeof data.valor === 'string'
          ? `/juridico/clientes/${data.valor}`
          : `/juridico/clientes/${cliente?.id ?? ''}`;
    } catch {
      setErro('falha de rede — tente de novo');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <div className="secao-form">
        <h3>Identificação</h3>
        <div className="form-grade">
          {campo('nome', 'Nome do cliente *')}
          {campo('nascimento', 'Data de nascimento', { tipo: 'date' })}
          <label className="campo">
            <span>Sexo</span>
            <select
              value={dados['sexo'] ?? ''}
              onChange={(e) => setDados((d) => ({ ...d, sexo: e.target.value }))}
            >
              <option value="">Selecione</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
              <option value="Outro">Outro</option>
            </select>
          </label>
          {campo('cpfCnpj', 'CPF/CNPJ')}
          {campo('rg', 'RG')}
          {campo('orgaoEmissor', 'Órgão emissor RG')}
          <label className="campo">
            <span>UF emissão RG</span>
            <select
              value={dados['ufEmissao'] ?? ''}
              onChange={(e) => setDados((d) => ({ ...d, ufEmissao: e.target.value }))}
            >
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="secao-form">
        <h3>Contato</h3>
        <div className="form-grade">
          {campo('email', 'E-mail')}
          {campo('telefone', 'Telefone')}
          {campo('celular1', 'Celular 1')}
          {campo('celular2', 'Celular 2')}
        </div>
      </div>

      <div className="secao-form">
        <h3>Endereço</h3>
        <div className="form-grade">
          {campo('logradouro', 'Logradouro')}
          {campo('numero', 'Nº')}
          {campo('bairro', 'Bairro')}
          {campo('complemento', 'Complemento')}
          {campo('cep', 'CEP')}
          {campo('cidade', 'Cidade')}
          <label className="campo">
            <span>UF</span>
            <select
              value={dados['uf'] ?? ''}
              onChange={(e) => setDados((d) => ({ ...d, uf: e.target.value }))}
            >
              <option value="">—</option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="secao-form">
        <h3>Observações</h3>
        <textarea
          value={dados['observacoes'] ?? ''}
          onChange={(e) => setDados((d) => ({ ...d, observacoes: e.target.value }))}
        />
      </div>

      {erro !== null ? <div className="erro-box">{erro}</div> : null}
      <div className="form-rodape">
        <a className="btn" href="/juridico/clientes">
          Cancelar
        </a>
        <button className="btn primario" disabled={ocupado} onClick={() => void salvar()}>
          {ocupado ? 'Salvando…' : cliente === null ? 'Cadastrar cliente' : 'Salvar alterações'}
        </button>
      </div>
    </>
  );
}
