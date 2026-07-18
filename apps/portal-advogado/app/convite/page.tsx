'use client';
// CONVITE (GO-LIVE-04) — o advogado convidado pelo escritório cria a PRÓPRIA
// senha a partir do link assinado (?t=). Tela NUA (fora do shell). Nunca existe
// cadastro público: sem convite válido, nada acontece (fail-closed no servidor).
import { useState, type ReactElement } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { definirSenhaAdvogado } from '../../lib/actions';

const CONVITE_AUSENTE =
  'Este link de convite está incompleto ou expirou. Peça um novo ao escritório.';

const ConvitePage = (): ReactElement => {
  const router = useRouter();
  const token = useSearchParams().get('t') ?? '';
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const concluir = async (): Promise<void> => {
    if (busy) return;
    setErro(null);
    if (senha.length < 8) { setErro('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (senha !== confirmar) { setErro('As senhas não conferem.'); return; }
    setBusy(true);
    const result = await definirSenhaAdvogado(token, senha);
    if (!result.ok) {
      setErro(result.error ?? CONVITE_AUSENTE);
    } else {
      router.push('/login');
    }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 420, margin: '10vh auto', padding: '0 16px' }}>
      <div className="card">
        <h1 className="page-title">Crie a sua senha</h1>
        {token === '' ? (
          <div className="error-box" style={{ marginTop: 12 }}>{CONVITE_AUSENTE}</div>
        ) : (
          <>
            <p className="page-sub">
              Você foi convidado pelo escritório. Defina a sua senha pessoal para acessar o portal.
            </p>
            <form
              className="form-row"
              onSubmit={(e) => { e.preventDefault(); void concluir(); }}
              style={{ flexDirection: 'column', alignItems: 'stretch' }}
            >
              <input
                type="password"
                placeholder="Nova senha (mínimo 8 caracteres)"
                value={senha}
                autoFocus
                onChange={(e) => { setSenha(e.target.value); }}
              />
              <input
                type="password"
                placeholder="Confirme a senha"
                value={confirmar}
                onChange={(e) => { setConfirmar(e.target.value); }}
              />
              <button type="submit" className="primary" disabled={busy || senha === '' || confirmar === ''}>
                Criar senha e continuar
              </button>
            </form>
          </>
        )}
        {erro ? <div className="error-box" style={{ marginTop: 12 }}>{erro}</div> : null}
      </div>
    </div>
  );
};

export default ConvitePage;
