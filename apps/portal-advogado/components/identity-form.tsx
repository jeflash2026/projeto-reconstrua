'use client';
// Identificação do advogado (cookie) — transporte provisório até o login da
// Governança (DF-12). O ISOLAMENTO real é imposto no servidor, por atribuição.
import { useEffect, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';

const IdentityForm = (): ReactElement => {
  const router = useRouter();
  const [id, setId] = useState('');

  useEffect(() => {
    const cookie = document.cookie.split('; ').find((c) => c.startsWith('advogado-id='));
    if (cookie) setId(decodeURIComponent(cookie.split('=')[1] ?? ''));
  }, []);

  const save = (): void => {
    document.cookie = `advogado-id=${encodeURIComponent(id.trim())}; path=/; max-age=2592000`;
    router.refresh();
  };
  const clear = (): void => {
    document.cookie = 'advogado-id=; path=/; max-age=0';
    setId('');
    router.refresh();
  };

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3>Identificação</h3>
      <div className="form-row">
        <input placeholder="Seu ID de advogado (fornecido pelo Administrador)" value={id} onChange={(e) => { setId(e.target.value); }} />
        <button className="primary" onClick={save}>
          Entrar
        </button>
        <button onClick={clear}>Sair</button>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)' }}>
        Autenticação definitiva pertence à Governança (DF-12). O isolamento é garantido no servidor: você só acessa o
        que foi atribuído a você pelo Administrador.
      </p>
    </div>
  );
};

export default IdentityForm;
