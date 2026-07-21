import { ArrowUpRight, Instagram, Linkedin, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="site-footer__top">
          <div>
            <BrandMark />
            <p>
              Inteligência jurídica e presença humana para quem precisa revisar empréstimos
              consignados do INSS.
            </p>
          </div>
          <div className="site-footer__links">
            <div>
              <span>EXPLORAR</span>
              <a href="#problemas">O que fazemos</a>
              <a href="#como-funciona">Como funciona</a>
              <a href="#perguntas">Dúvidas frequentes</a>
            </div>
            <div>
              <span>CONTATO</span>
              <a href="mailto:contato@projetoreconstrua.com.br">
                contato@projetoreconstrua.com.br <ArrowUpRight size={13} />
              </a>
              <a href="#analise">
                Solicitar análise <ArrowUpRight size={13} />
              </a>
            </div>
            <div>
              <span>REDES</span>
              <a href="#" aria-label="Instagram do Projeto Reconstrua">
                <Instagram size={17} />
              </a>
              <a href="#" aria-label="LinkedIn do Projeto Reconstrua">
                <Linkedin size={17} />
              </a>
            </div>
          </div>
        </div>
        <div className="site-footer__bottom">
          <p>© 2026 Projeto Reconstrua. Todos os direitos reservados.</p>
          <p className="site-footer__legal">
            <ShieldCheck size={14} aria-hidden="true" />
            Informação, cuidado e transparência em cada etapa.
          </p>
          <div>
            <a href="#">Privacidade</a>
            <a href="#">Termos</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
