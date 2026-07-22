// ─────────────────────────────────────────────────────────────────────────────
// A CARTA VIVA — página única do Portal do Cliente (5 documentos congelados).
// O Portal NÃO interpreta, NÃO calcula, NÃO decide (Princípio 3): renderiza as
// strings autorizadas da projeção segura, na ordem das 5 perguntas (Princípio 4).
// Demo (?demo | ?demo=processo) existe SÓ em desenvolvimento — palco da homologação.
// ─────────────────────────────────────────────────────────────────────────────
import { cookies } from 'next/headers';
import type { ReactElement } from 'react';
import { fetchAcompanhamento, type AcompanhamentoCliente } from '../lib/api';
import { demoPayload } from '../lib/demo';
import { dataHumana, saudacaoPorHora } from '../lib/format';
import AutoRefresh from '../components/auto-refresh';
import Presenca from '../components/presenca';
import Caminho from '../components/caminho';
import Pergunta from '../components/pergunta';
import NovidadeBalao from '../components/novidade-balao';
import VoltarAoWhatsApp from '../components/voltar-ao-whatsapp';

/** Sem acesso válido: nunca "login" — sempre a volta ao relacionamento (D4/Princípio 8). */
const PedirLink = (): ReactElement => (
  <main className="carta">
    <Presenca estado="atenta" />
    <section className="bloco saudacao">
      <h1>Oi! Este link já expirou.</h1>
      <p>
        Por segurança, os links de acesso duram um tempo limitado. Me chama no WhatsApp que eu te
        envio um novo agora mesmo.
      </p>
    </section>
    <section className="bloco fecho">
      <VoltarAoWhatsApp numero="554137989737" />
    </section>
  </main>
);

const Pagina = async ({
  searchParams,
}: {
  searchParams: { demo?: string };
}): Promise<ReactElement> => {
  const agora = new Date();

  // Demo APENAS em desenvolvimento (validação da experiência — nunca em produção).
  const demo = process.env.NODE_ENV !== 'production' && searchParams.demo !== undefined;
  const token = cookies().get('portal_cliente')?.value ?? null;
  const dados: AcompanhamentoCliente | null = demo
    ? demoPayload(searchParams.demo)
    : token !== null
      ? await fetchAcompanhamento(token)
      : null;

  if (dados === null) return <PedirLink />;

  return (
    <main className="carta">
      <AutoRefresh seconds={60} />
      <Presenca estado={dados.presenca} />

      {/* Saudação + a frase de abertura (UX §2) — a resposta nº 1 */}
      <section className="bloco saudacao">
        <h1>
          {saudacaoPorHora(agora)}, {dados.quem}.
        </h1>
        <p>{dados.fraseAbertura}</p>
      </section>

      {/* "Preciso fazer alguma coisa?" — o maior redutor de ansiedade, acima da dobra */}
      <section className="bloco pilula">
        <span className="pilula__check" aria-hidden>
          ✓
        </span>
        <p>{dados.precisaFazerAlgo}</p>
      </section>

      <Pergunta titulo="O que está acontecendo agora">
        <p>{dados.agora}</p>
      </Pergunta>

      <section className="bloco pergunta">
        <h2>O caminho do seu caso</h2>
        <Caminho etapas={dados.etapas} agora={dados.agora} />
      </section>

      <Pergunta titulo="O que acontece depois">
        <p>{dados.proximoPasso}</p>
      </Pergunta>

      {/* A frase completa (incl. previsão/atraso honesto) vem pronta da visão (P3). */}
      <Pergunta titulo="Quanto tempo costuma levar">
        <p>{dados.quantoTempo}</p>
      </Pergunta>

      <section className="bloco pergunta">
        <h2>Novidades</h2>
        {dados.atualizacoes.length === 0 ? (
          <p>
            Ainda não há novidades — e isso é normal nesta fase. Eu te aviso na hora em que algo
            acontecer, aqui e no WhatsApp.
          </p>
        ) : (
          <>
            {dados.atualizacoes.map((n) => (
              <NovidadeBalao
                key={`${n.quando}-${n.texto.slice(0, 12)}`}
                quando={dataHumana(n.quando, agora)}
                texto={n.texto}
              />
            ))}
            <p className="novidades__rodape">Para responder, é só me chamar no WhatsApp.</p>
          </>
        )}
      </section>

      {dados.advogado !== null ? (
        <Pergunta titulo="Quem está cuidando do seu processo">
          <p>
            Quem cuida do seu processo é <strong>{dados.advogado.nome}</strong>.
          </p>
          {dados.processo !== null ? (
            <p>Número do seu processo na Justiça: {dados.processo.numero}</p>
          ) : null}
        </Pergunta>
      ) : null}

      {dados.documentosRecebidos.length > 0 ? (
        <section className="bloco pergunta">
          <h2>Documentos que você já me enviou</h2>
          <div className="docs">
            {dados.documentosRecebidos.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bloco fecho">
        <p>Qualquer dúvida, é só me chamar — estou no WhatsApp.</p>
        <VoltarAoWhatsApp numero={dados.whatsapp} />
      </section>
    </main>
  );
};

export default Pagina;
