'use client';
// CONVITE (GO-LIVE-04) — o advogado convidado pelo escritório cria a PRÓPRIA
// senha a partir do link assinado (?t=). Tela NUA (fora do shell). Nunca existe
// cadastro público: sem convite válido, nada acontece (fail-closed no servidor).
import { useState, type ReactElement } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { definirSenhaAdvogado } from '../../lib/actions';

const CONVITE_AUSENTE =
  'Este link de convite está incompleto ou expirou. Peça um novo ao escritório.';

/** CPF com máscara (000.000.000-00) para exibição. */
function cpfBr(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

const ConvitePage = (): ReactElement => {
  const router = useRouter();
  const token = useSearchParams().get('t') ?? '';
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Caso real 2026-07-29: senha criada com o cadastro SEM CPF ⇒ o login por CPF
  // dava "credenciais inválidas" sem explicação. Agora a tela CONFIRMA o CPF de
  // login — ou avisa, na hora, que o escritório precisa cadastrá-lo.
  const [feito, setFeito] = useState<{ loginCpf: string | null } | null>(null);

  const concluir = async (): Promise<void> => {
    if (busy) return;
    setErro(null);
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (senha !== confirmar) {
      setErro('As senhas não conferem.');
      return;
    }
    setBusy(true);
    const result = await definirSenhaAdvogado(token, senha);
    if (!result.ok) {
      setErro(result.error ?? CONVITE_AUSENTE);
    } else if (result.loginCpf ?? null) {
      setFeito({ loginCpf: result.loginCpf ?? null });
    } else {
      setFeito({ loginCpf: null }); // senha criada, mas o cadastro não tem CPF
    }
    setBusy(false);
  };

  if (feito !== null) {
    return (
      <div style={{ maxWidth: 420, margin: '10vh auto', padding: '0 16px' }}>
        <div className="card">
          <h1 className="page-title">Senha criada!</h1>
          {feito.loginCpf !== null ? (
            <>
              <p className="page-sub">
                Tudo pronto. Para entrar, use o seu CPF{' '}
                <strong className="mono">{cpfBr(feito.loginCpf)}</strong> e a senha que você acabou
                de criar.
              </p>
              <button
                className="primary"
                onClick={() => {
                  router.push('/login');
                }}
              >
                Ir para o login
              </button>
            </>
          ) : (
            <div className="error-box" style={{ marginTop: 12 }}>
              A sua senha foi criada, mas o seu cadastro ainda não tem um CPF de login — e o acesso
              é feito pelo CPF. Peça ao escritório para cadastrar o seu CPF no painel (Equipe →
              Advogados) e então entre normalmente com CPF + a senha que você criou agora.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: '10vh auto', padding: '0 16px' }}>
      <div className="card">
        <h1 className="page-title">Crie ou redefina a sua senha</h1>
        {token === '' ? (
          <div className="error-box" style={{ marginTop: 12 }}>
            {CONVITE_AUSENTE}
          </div>
        ) : (
          <>
            <p className="page-sub">
              Você recebeu este link do escritório. Defina a sua senha pessoal para acessar o portal
              — se já tinha uma senha, a nova substitui a antiga.
            </p>
            <form
              className="form-row"
              onSubmit={(e) => {
                e.preventDefault();
                void concluir();
              }}
              style={{ flexDirection: 'column', alignItems: 'stretch' }}
            >
              <input
                type="password"
                placeholder="Nova senha (mínimo 8 caracteres)"
                value={senha}
                autoFocus
                onChange={(e) => {
                  setSenha(e.target.value);
                }}
              />
              <input
                type="password"
                placeholder="Confirme a senha"
                value={confirmar}
                onChange={(e) => {
                  setConfirmar(e.target.value);
                }}
              />
              <button
                type="submit"
                className="primary"
                disabled={busy || senha === '' || confirmar === ''}
              >
                Criar senha e continuar
              </button>
            </form>
          </>
        )}
        {erro ? (
          <div className="error-box" style={{ marginTop: 12 }}>
            {erro}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ConvitePage;
