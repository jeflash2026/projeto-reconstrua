'use client';
// Alternância de tema — a identidade do projeto (papel claro, lateral escura) é
// o padrão desde 2026-09-17; o modo escuro quente é opcional e a escolha
// persiste em localStorage (chave nova: a antiga guardava o tema escuro antigo).
import { useEffect, useState, type ReactElement } from 'react';

const CHAVE = 'reconstrua-advogado-tema';

const ThemeToggle = (): ReactElement => {
  const [escuro, setEscuro] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(CHAVE) === 'dark') {
      setEscuro(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggle = (): void => {
    const next = !escuro;
    setEscuro(next);
    document.documentElement.classList.toggle('dark', next);
    window.localStorage.setItem(CHAVE, next ? 'dark' : 'light');
  };

  return (
    <button onClick={toggle} title="Alternar tema" style={{ width: '100%', marginTop: 12 }}>
      {escuro ? '☀️ Modo claro' : '🌙 Modo escuro'}
    </button>
  );
};

export default ThemeToggle;
