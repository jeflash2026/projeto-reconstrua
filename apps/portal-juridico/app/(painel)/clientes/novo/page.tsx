import type { ReactElement } from 'react';
import ClienteForm from '../../../../components/cliente-form';

export default function NovoClientePage(): ReactElement {
  return (
    <>
      <h1 className="titulo">Novo cliente</h1>
      <p className="subtitulo">Cadastro civil completo — anexos entram depois, no perfil.</p>
      <ClienteForm />
    </>
  );
}
