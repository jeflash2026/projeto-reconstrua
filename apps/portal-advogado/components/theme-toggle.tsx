'use client';
// Alternância de tema — dark é o padrão; escolha persiste em localStorage.
import { useEffect, useState, type ReactElement } from 'react';

const ThemeToggle = (): ReactElement => {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('ahrios-advogado-theme');
    if (saved === 'light') {
      setLight(true);
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggle = (): void => {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle('light', next);
    window.localStorage.setItem('ahrios-advogado-theme', next ? 'light' : 'dark');
  };

  return (
    <button onClick={toggle} title="Alternar tema" style={{ width: '100%', marginTop: 12 }}>
      {light ? '🌙 Modo escuro' : '☀️ Modo claro'}
    </button>
  );
};

export default ThemeToggle;
