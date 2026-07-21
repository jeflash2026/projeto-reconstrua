import type { LucideIcon } from 'lucide-react';
import {
  BadgeDollarSign,
  FileSearch,
  Landmark,
  LockKeyhole,
  ScanSearch,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';

export const navigation = [
  { label: 'O que fazemos', href: '#problemas' },
  { label: 'Método', href: '#como-funciona' },
  { label: 'Segurança', href: '#beneficios' },
  { label: 'Dúvidas', href: '#perguntas' },
];

export type Problem = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  measure: string;
};

export const problems: Problem[] = [
  {
    eyebrow: '01 / Leitura contratual',
    title: 'Descontos que não fazem sentido.',
    description:
      'Mapeamos cláusulas, taxas, margens e condições que merecem uma segunda leitura especializada.',
    icon: FileSearch,
    measure: 'Contrato sob lente técnica',
  },
  {
    eyebrow: '02 / Contratação',
    title: 'Operações que você não reconhece.',
    description:
      'Organizamos os sinais de contratação irregular para que cada informação seja analisada com precisão.',
    icon: ScanSearch,
    measure: 'Histórico em uma visão',
  },
  {
    eyebrow: '03 / Margem consignável',
    title: 'Uma renda que ficou apertada demais.',
    description:
      'Entendemos como as parcelas impactam o seu benefício e quais documentos precisam ser revisados.',
    icon: WalletCards,
    measure: 'Impacto mensal visível',
  },
  {
    eyebrow: '04 / Revisão jurídica',
    title: 'Um caso que pede estratégia.',
    description:
      'A tecnologia reduz ruído. A decisão jurídica é sempre construída por um advogado especialista.',
    icon: Landmark,
    measure: 'Análise humana final',
  },
];

export const processSteps = [
  {
    number: '01',
    title: 'Você envia seus documentos',
    detail: 'De forma guiada, segura e no seu ritmo.',
    icon: LockKeyhole,
  },
  {
    number: '02',
    title: 'Nossa IA organiza tudo',
    detail: 'Extrai as informações relevantes e cria uma linha do tempo.',
    icon: ScanSearch,
  },
  {
    number: '03',
    title: 'Advogado especialista revisa',
    detail: 'A estratégia começa com leitura técnica e contexto humano.',
    icon: ShieldCheck,
  },
  {
    number: '04',
    title: 'Caso é preparado',
    detail: 'Cada etapa ganha documentação, clareza e prioridade.',
    icon: FileSearch,
  },
  {
    number: '05',
    title: 'Você acompanha pelo portal',
    detail: 'Status, próximos passos e conversas em um só lugar.',
    icon: BadgeDollarSign,
  },
];

export const benefits = [
  {
    index: 'A',
    title: 'Clareza antes de qualquer decisão',
    description:
      'Traduzimos documentos e possibilidades jurídicas para uma conversa que você realmente entende.',
  },
  {
    index: 'B',
    title: 'Tecnologia que serve às pessoas',
    description: 'A IA organiza o volume. A sensibilidade e a estratégia continuam sendo humanas.',
  },
  {
    index: 'C',
    title: 'Privacidade como arquitetura',
    description:
      'A troca de informações é desenhada para ser discreta, rastreável e protegida desde o primeiro contato.',
  },
  {
    index: 'D',
    title: 'Uma jornada sem caixas-pretas',
    description: 'Você sabe onde seu caso está, o que vem a seguir e quem está olhando por ele.',
  },
];

export const indicators = [
  { value: '05', label: 'etapas para transformar documentos em direção' },
  { value: '24h', label: 'para consultar seu portal, quando precisar' },
  { value: '01', label: 'visão unificada do seu caso' },
  { value: '100%', label: 'foco em consignado INSS' },
];

export const testimonials = [
  {
    quote:
      'Eu não precisava de promessas. Precisava que alguém explicasse, com calma, o que estava acontecendo.',
    label: 'Cliente do Projeto Reconstrua',
    context: 'Identidade preservada para proteger a privacidade.',
  },
  {
    quote:
      'A sensação mudou quando vi todos os contratos organizados e entendi qual era o próximo passo.',
    label: 'Cliente do Projeto Reconstrua',
    context: 'Identidade preservada para proteger a privacidade.',
  },
  {
    quote: 'Nunca senti que era só mais um número. Havia método, mas havia também escuta.',
    label: 'Cliente do Projeto Reconstrua',
    context: 'Identidade preservada para proteger a privacidade.',
  },
];

export const faqItems = [
  {
    question: 'Quais documentos preciso enviar para começar?',
    answer:
      'O ponto de partida costuma incluir documento de identificação, extratos do benefício e contratos ou comprovantes que você tiver. Se algo estiver faltando, nossa equipe orienta os próximos passos.',
  },
  {
    question: 'A inteligência artificial toma decisões sobre o meu caso?',
    answer:
      'Não. A IA é usada para organizar informações e reduzir tarefas repetitivas. A análise jurídica, a estratégia e toda orientação são conduzidas por advogado especialista.',
  },
  {
    question: 'Como acompanho o andamento?',
    answer:
      'Você recebe acesso ao portal do Projeto Reconstrua, onde pode acompanhar o status, os documentos solicitados e as atualizações importantes do seu caso.',
  },
  {
    question: 'A análise inicial tem compromisso?',
    answer:
      'O primeiro contato serve para entendermos seu cenário e explicarmos o caminho possível. A contratação e seus termos são sempre apresentados de forma transparente antes de qualquer decisão.',
  },
  {
    question: 'Meus dados ficam protegidos?',
    answer:
      'Tratamos cada documento como informação sensível. Os dados são solicitados apenas quando necessários à análise e são compartilhados com a equipe responsável pelo atendimento.',
  },
];
