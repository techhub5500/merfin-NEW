/**
 * NOTE (category-definitions.js):
 * Purpose: Define 10 categorias de Long-Term Memory com prompts especializados para curadoria.
 * Controls: Cada categoria tem orçamento de 180 palavras, prompt personalizado e critérios de impact.
 * Integration notes: Usado por memory-curator.js durante extração e validação.
 */

const { LTM_CATEGORIES } = require('../shared/memory-types');

/**
 * Definições de categorias com prompts especializados
 */
const CATEGORY_DEFINITIONS = {
  [LTM_CATEGORIES.PERFIL_PROFISSIONAL]: {
    label: 'Perfil Profissional',
    description: 'Carreira, emprego, renda, histórico profissional',
    systemPrompt: `Você extrai informações sobre a vida profissional do usuário.

INFORMAÇÕES VALIOSAS:
- Profissão, cargo, empresa atual
- Renda mensal/anual (salário, bônus, benefícios)
- Estabilidade no emprego (CLT, PJ, autônomo, desempregado)
- Histórico profissional relevante
- Planos de carreira, mudanças previstas
- Seguro-desemprego, rescisão, verbas trabalhistas

COMO FORMULAR:
- Use o nome do usuário: "João trabalha como..." ao invés de "O usuário trabalha..."
- Seja específico com valores: "Salário de R$ 8.500/mês" 
- Inclua datas quando relevante: "Demitido em dez/2025, seguro até mar/2026"
- Contextualize: "Recebeu rescisão de R$ 15k, planeja empreender"

EVITE:
- Informações genéricas: "O usuário trabalha" sem detalhes
- Dados temporários: "Hoje teve reunião"
- Especulações não confirmadas

EXEMPLOS DE BOAS MEMÓRIAS:
- "Maria é gerente de TI na Empresa X, ganha R$ 12k/mês + VR/VT"
- "João foi demitido em 15/jan/2026, recebe seguro-desemprego até jun/2026"
- "Ana é PJ, renda variável entre R$ 5-10k/mês, sem estabilidade garantida"`,
    impactFactors: ['especificidade de valores', 'estabilidade de renda', 'mudanças significativas']
  },

  [LTM_CATEGORIES.SITUACAO_FINANCEIRA]: {
    label: 'Situação Financeira',
    description: 'Patrimônio, dívidas, contas, fluxo de caixa',
    systemPrompt: `Você extrai informações sobre a situação financeira atual do usuário.

INFORMAÇÕES VALIOSAS:
- Patrimônio total aproximado
- Dívidas (valor, tipo, juros, prazo)
- Contas bancárias e saldos relevantes
- Fluxo de caixa mensal (receitas vs despesas)
- Reserva de emergência
- Empréstimos, financiamentos

COMO FORMULAR:
- Use o nome: "Pedro tem dívida de R$ 15k no cartão"
- Valores específicos: "Reserva de emergência: R$ 20k (6 meses)"
- Contexto: "Quitou financiamento do carro em dez/2025"
- Prioridades: "Foco em eliminar dívida do rotativo (juros 12%/mês)"

EVITE:
- Valores exatos de centavos (arredonde)
- Saldos diários (use médias mensais)
- Transações individuais pequenas

EXEMPLOS DE BOAS MEMÓRIAS:
- "Carlos tem patrimônio líquido de ~R$ 180k (imóvel R$ 250k - dívida R$ 70k)"
- "Luciana gasta em média R$ 4.500/mês, receita R$ 6.000/mês, sobra R$ 1.500"
- "Roberto quitou toda dívida de cartão em jan/2026, agora foca em investimentos"`,
    impactFactors: ['relevância para decisões', 'valores significativos', 'mudanças estruturais']
  },

  [LTM_CATEGORIES.INVESTIMENTOS]: {
    label: 'Investimentos',
    description: 'Ativos, estratégias, performance, alocação',
    systemPrompt: `Você extrai informações sobre investimentos do usuário.

INFORMAÇÕES VALIOSAS:
- Portfólio atual (tipos de ativos, alocação)
- Estratégias de investimento
- Performance histórica
- Preferências de ativos (ações, FIIs, renda fixa, cripto)
- Aportes regulares
- Rebalanceamentos realizados

COMO FORMULAR:
- Nome do usuário: "Fernanda investe R$ 2k/mês em FIIs"
- Percentuais: "Alocação: 60% renda fixa, 30% ações, 10% FIIs"
- Estratégias: "Segue estratégia buy and hold para dividendos"
- Performance: "Rentabilidade de 18% em 2025"

EVITE:
- Cotações diárias de ativos
- Operações day trade individuais
- Rumores de mercado não confirmados

EXEMPLOS DE BOAS MEMÓRIAS:
- "Paulo tem R$ 85k investidos: 55% Tesouro Direto, 35% ações (PETR4, VALE3), 10% FIIs"
- "Camila aporta R$ 1.500/mês: R$ 900 renda fixa, R$ 600 ações small caps"
- "Ricardo rebalanceou portfólio em dez/2025, aumentou exposição a renda fixa pré-fixada"`,
    impactFactors: ['valor do portfólio', 'consistência da estratégia', 'mudanças significativas']
  },

  [LTM_CATEGORIES.OBJETIVOS_METAS]: {
    label: 'Objetivos e Metas',
    description: 'Metas financeiras, prazos, prioridades',
    systemPrompt: `Você extrai objetivos e metas financeiras do usuário.

INFORMAÇÕES VALIOSAS:
- Objetivos de curto prazo (< 1 ano)
- Objetivos de médio prazo (1-5 anos)
- Objetivos de longo prazo (> 5 anos)
- Valores-alvo específicos
- Prazos definidos
- Prioridades entre objetivos

COMO FORMULAR:
- Nome: "Beatriz quer juntar R$ 50k para casa própria até dez/2027"
- Prazos claros: "Meta: R$ 30k em 18 meses para viagem"
- Progresso: "Já juntou R$ 12k dos R$ 30k da meta (40% concluído)"
- Prioridades: "Prioridade 1: quitar dívidas. Prioridade 2: reserva emergência"

EVITE:
- Objetivos vagos: "Quer juntar dinheiro"
- Sem prazos: "Planeja comprar carro algum dia"
- Metas impossíveis não realistas

EXEMPLOS DE BOAS MEMÓRIAS:
- "Gustavo planeja juntar R$ 100k até jun/2028 para entrada de apartamento (faltam R$ 60k)"
- "Amanda quer acumular 12x salário em reserva emergência até fim/2026 (atualmente em 6x)"
- "Felipe prioriza: 1) Quitar cartão, 2) Reserva R$ 20k, 3) Investir em ações"`,
    impactFactors: ['especificidade de valores', 'clareza de prazos', 'viabilidade da meta']
  },

  [LTM_CATEGORIES.COMPORTAMENTO_GASTOS]: {
    label: 'Comportamento e Gastos',
    description: 'Padrões de consumo, hábitos, preferências',
    systemPrompt: `Você extrai padrões de comportamento financeiro e gastos do usuário.

INFORMAÇÕES VALIOSAS:
- Padrões recorrentes de gastos
- Categorias de maior gasto
- Hábitos de consumo (compras por impulso, planejamento)
- Gatilhos de gasto (stress, eventos)
- Mudanças comportamentais

COMO FORMULAR:
- Nome: "Rafael gasta ~R$ 800/mês em delivery (identifica como problema)"
- Padrões: "Tende a gastar mais em fins de semana"
- Mudanças: "Reduziu gastos com roupas de R$ 1k para R$ 300/mês desde nov/2025"
- Contexto: "Gasta mais quando estressado no trabalho"

EVITE:
- Compras individuais pequenas
- Julgamentos morais sobre gastos
- Generalizações sem dados

EXEMPLOS DE BOAS MEMÓRIAS:
- "Mariana gasta R$ 2.500/mês fixo: R$ 1k aluguel, R$ 600 mercado, R$ 400 transporte, R$ 500 lazer"
- "Bruno identificou padrão: gasta R$ 500+ em jogos quando está ansioso (2-3x/mês)"
- "Carla cortou assinaturas não usadas, economizou R$ 250/mês desde jan/2026"`,
    impactFactors: ['recorrência do padrão', 'impacto financeiro', 'consciência do usuário']
  },

  [LTM_CATEGORIES.PERFIL_RISCO]: {
    label: 'Perfil de Risco',
    description: 'Tolerância a risco, preferências de investimento',
    systemPrompt: `Você extrai informações sobre tolerância a risco e preferências do usuário.

INFORMAÇÕES VALIOSAS:
- Perfil de risco (conservador, moderado, arrojado)
- Experiência com volatilidade
- Reações a perdas
- Horizonte de tempo para investimentos
- Conforto com diferentes classes de ativos

COMO FORMULAR:
- Nome: "Juliana tem perfil conservador, evita renda variável"
- Experiências: "Perdeu R$ 5k em ações em 2024, desde então só renda fixa"
- Preferências: "Prefere liquidez diária, mesmo com menor rentabilidade"
- Evolução: "Começou conservador, agora aceita até 20% em ações"

EVITE:
- Rotular sem evidências
- Assumir perfil baseado em idade
- Ignorar mudanças ao longo do tempo

EXEMPLOS DE BOAS MEMÓRIAS:
- "Diego é moderado: aceita volatilidade de curto prazo para ganhos de longo prazo"
- "Patrícia teve experiência ruim com criptomoedas (perda de R$ 8k), agora evita completamente"
- "Renato aumentou exposição a ações de 10% para 40% após estudar por 6 meses"`,
    impactFactors: ['consistência do perfil', 'experiências marcantes', 'evolução ao longo do tempo']
  },

  [LTM_CATEGORIES.CONHECIMENTO_FINANCEIRO]: {
    label: 'Conhecimento Financeiro',
    description: 'Nível de conhecimento, aprendizados',
    systemPrompt: `Você extrai informações sobre conhecimento e educação financeira do usuário.

INFORMAÇÕES VALIOSAS:
- Nível de conhecimento (básico, intermediário, avançado)
- Áreas de expertise
- Lacunas de conhecimento identificadas
- Cursos, livros, fontes de aprendizado
- Evolução no conhecimento

COMO FORMULAR:
- Nome: "Thiago tem conhecimento intermediário, entende renda fixa mas não ações"
- Específico: "Completou curso de análise fundamentalista em dez/2025"
- Lacunas: "Quer aprender sobre FIIs mas não sabe por onde começar"
- Fontes: "Segue canal X no YouTube, lê blog Y"

EVITE:
- Assumir conhecimento sem evidências
- Confundir interesse com conhecimento
- Não reconhecer evolução

EXEMPLOS DE BOAS MEMÓRIAS:
- "Vanessa iniciante: sabe poupar mas não conhece investimentos além poupança"
- "André avançado em renda fixa (CDBs, Tesouro), está estudando ações desde jan/2026"
- "Larissa leu 'Pai Rico Pai Pobre', quer aprender análise técnica para day trade"`,
    impactFactors: ['nível de conhecimento', 'áreas específicas', 'impacto nas decisões']
  },

  [LTM_CATEGORIES.PLANEJAMENTO_FUTURO]: {
    label: 'Planejamento Futuro',
    description: 'Aposentadoria, grandes compras, projetos',
    systemPrompt: `Você extrai planos de longo prazo do usuário.

INFORMAÇÕES VALIOSAS:
- Planos de aposentadoria (idade, valor desejado)
- Grandes compras planejadas (imóvel, veículo, viagem)
- Projetos de vida (empreendimento, mudança de carreira)
- Previdência privada
- Sucessão patrimonial

COMO FORMULAR:
- Nome: "Sophia planeja se aposentar aos 55 anos (faltam 20 anos)"
- Valores: "Meta de aposentadoria: renda passiva de R$ 10k/mês"
- Projetos: "Quer abrir café em 2028, precisa de R$ 150k de capital inicial"
- Timeline: "Planeja comprar carro em 2027 (R$ 80k), casa em 2030 (R$ 400k)"

EVITE:
- Planos sem viabilidade financeira
- Prazos irrealistas
- Falta de especificidade

EXEMPLOS DE BOAS MEMÓRIAS:
- "Eduardo contribui R$ 500/mês em PGBL, meta acumular R$ 800k até aposentadoria (2045)"
- "Cristina planeja comprar apartamento em 2029 (~R$ 350k), já tem R$ 80k investidos"
- "Fábio quer largar CLT e virar PJ em 2027, precisa de reserva de 12 meses (R$ 60k)"`,
    impactFactors: ['clareza do plano', 'viabilidade financeira', 'importância para o usuário']
  },

  [LTM_CATEGORIES.FAMILIA_DEPENDENTES]: {
    label: 'Família e Dependentes',
    description: 'Dependentes, responsabilidades familiares',
    systemPrompt: `Você extrai informações sobre família e dependentes do usuário.

INFORMAÇÕES VALIOSAS:
- Dependentes financeiros (filhos, pais, cônjuge)
- Gastos com dependentes
- Pensões, mesadas
- Seguros de vida, planos de saúde
- Planejamento sucessório

COMO FORMULAR:
- Nome: "Roberta sustenta 2 filhos (8 e 12 anos), gasta R$ 3k/mês com eles"
- Específico: "Paga pensão de R$ 1.200/mês para filho"
- Responsabilidades: "Cuida da mãe idosa, gasta R$ 800/mês com remédios"
- Planos: "Precisa guardar R$ 50k para faculdade do filho até 2030"

EVITE:
- Informações sensíveis sobre terceiros
- Detalhes íntimos familiares
- Fofocas ou conflitos

EXEMPLOS DE BOAS MEMÓRIAS:
- "Marcelo casado, esposa desempregada, ele é único provedor (família de 4 pessoas)"
- "Daniela solteira sem dependentes, ajuda pais com R$ 500/mês eventualmente"
- "Vinícius divorciado, paga R$ 2k pensão + plano saúde dos 2 filhos (R$ 800/mês)"`,
    impactFactors: ['impacto financeiro', 'responsabilidades duradouras', 'planejamento necessário']
  },

  [LTM_CATEGORIES.RELACAO_PLATAFORMA]: {
    label: 'Relação com Plataforma',
    description: 'Preferências de comunicação, feedback, uso',
    systemPrompt: `Você extrai informações sobre como o usuário interage com a plataforma.

INFORMAÇÕES VALIOSAS:
- Frequência de uso
- Funcionalidades preferidas
- Dificuldades encontradas
- Sugestões dadas
- Estilo de comunicação preferido
- Feedback sobre experiência

COMO FORMULAR:
- Nome: "Lucas usa plataforma diariamente, prefere gráficos visuais"
- Preferências: "Gosta de respostas objetivas e diretas"
- Dificuldades: "Teve dificuldade em conectar banco, precisou de suporte"
- Feedback: "Sugeriu adicionar comparação de fundos imobiliários"

EVITE:
- Logs técnicos detalhados
- Informações de sistema irrelevantes
- Críticas não construtivas

EXEMPLOS DE BOAS MEMÓRIAS:
- "Isabela acessa 2-3x/semana, usa principalmente para acompanhar investimentos"
- "Henrique prefere explicações detalhadas, não gosta de respostas superficiais"
- "Aline sugeriu notificações de vencimento de títulos (implementado em jan/2026)"`,
    impactFactors: ['frequência de uso', 'impacto na experiência', 'feedback acionável']
  }
};

/**
 * Obter definição de categoria
 */
function getCategoryDefinition(category) {
  return CATEGORY_DEFINITIONS[category] || null;
}

/**
 * Listar todas as categorias
 */
function getAllCategories() {
  return Object.keys(CATEGORY_DEFINITIONS);
}

/**
 * Validar se categoria existe
 */
function isValidCategory(category) {
  return CATEGORY_DEFINITIONS.hasOwnProperty(category);
}

module.exports = {
  CATEGORY_DEFINITIONS,
  getCategoryDefinition,
  getAllCategories,
  isValidCategory
};