/**
 * NOTE (index.js):
 * Purpose: Entry point do módulo Simplista.
 * Exporta todos os componentes para uso externo.
 */

// Agente principal
const { 
	SimplistaAgent, 
	createSimplistaAgent, 
	getSimplistaAgent 
} = require('./simplista-agent');

// Componentes
const { QueryClassifier, queryClassifier } = require('./query-classifier');
const { FinanceBridgeConnector, financeBridgeConnector } = require('./finance-bridge-connector');
const { SerperConnector, serperConnector } = require('./serper-connector');
const { DialogueManager, dialogueManager } = require('./dialogue-manager');
const { ResponseBuilder, responseBuilder } = require('./response-builder');

// Utilitários
const { SimplistaLogger, logger } = require('./simplista-logger');
const { SimplistaCache, simplistaCache } = require('./simplista-cache');

module.exports = {
	// Agente
	SimplistaAgent,
	createSimplistaAgent,
	getSimplistaAgent,
	
	// Componentes
	QueryClassifier,
	queryClassifier,
	FinanceBridgeConnector,
	financeBridgeConnector,
	SerperConnector,
	serperConnector,
	DialogueManager,
	dialogueManager,
	ResponseBuilder,
	responseBuilder,
	
	// Utilitários
	SimplistaLogger,
	logger,
	SimplistaCache,
	simplistaCache
};
