/**
 * NOTE (serverAgent.js):
 * Purpose: Servidor Express dedicado exclusivamente aos agentes de IA. Separado do server.js
 * principal para permitir escalabilidade independente, configurações especializadas e deploys isolados.
 * 
 * RESPONSABILIDADES:
 * - Receber e validar requisições de agentes usando contratos (contracts.js)
 * - Roteamento dinâmico: mapeia agent_name para instância correta do agente
 * - Streaming SSE: eventos em tempo real para frontend (tool:call, data:partial, etc)
 * - Gerenciamento de cache: injeta ToolContext em todas as requisições
 * - Health checks: status de agentes, MongoDB, cache e métricas de sistema
 * - Métricas de AgentOps: invalidação de cache, estatísticas de performance
 * 
 * ENDPOINTS PRINCIPAIS:
 * - POST /agent/execute - Executa ação em qualquer agente registrado
 * - POST /api/agent/execute - Alias do endpoint principal (compatibilidade)
 * - GET /api/agent/health - Health check completo com status de todos os agentes
 * - GET /health - Health check simples e rápido
 * - GET /api/agents/list - Lista todos os agentes disponíveis e suas ações
 * - GET /stream/agents/:sessionId - Streaming SSE de eventos do agente
 * - POST /api/agents/stream-demo - Demo de streaming (desenvolvimento)
 * - POST /api/agent/cache/invalidate - Invalidação manual de cache (debug)
 * - GET /api/agent/cache/stats - Estatísticas de cache (monitoramento)
 * 
 * SISTEMA DE ROTEAMENTO DINÂMICO:
 * O objeto `agents` mapeia nomes de agentes para suas instâncias:
 * - DataAgent (Etapa 2) ✅ - Consultas ao banco de dados
 * - OrchestratorAgent (Etapa 4) - Coordenador ReAct
 * - AnalystAgent (Etapa 5) - Análises financeiras
 * - ResearchAgent (Etapa 5) - Pesquisa externa (Serper/Tavily)
 * - StrategistAgent (Etapa 6) - Estratégias de investimento
 * - TransactionAgent (Etapa 6) - Execução de transações
 * - ValidatorAgent (Etapa 6) - Validação e compliance
 * 
 * VALIDAÇÃO E SEGURANÇA:
 * - Todas as requisições validadas por contracts.js (Joi schemas)
 * - Rejeita agent_name não registrados com 404
 * - Rejeita requisições malformadas com 400
 * - Headers de segurança (Helmet.js)
 * - CORS configurado para origem permitida
 * - Graceful shutdown (SIGTERM/SIGINT)
 * 
 * INTEGRAÇÃO:
 * - ToolContext: Cache global injetado em todas as requisições
 * - MongoDB: Conexão compartilhada, validação de estado
 * - Streaming: EventEmitter para SSE com cleanup automático
 * - Logger: Winston estruturado (futuro)
 * 
 * CONFIGURAÇÃO:
 * - Porta: process.env.AGENT_PORT (padrão: 5000)
 * - CORS: process.env.CORS_ORIGIN (padrão: http://localhost:3000)
 * - MongoDB: process.env.MONGO_URI ou MONGODB_URI
 * 
 * Controls: Valida contratos, roteia para agente correto, injeta ToolContext, streaming SSE.
 * Behavior: Servidor dedicado para agentes, separado do server.js principal.
 * Integration notes: Adicionar novos agentes no objeto `agents`. Usar validateRequest()
 * antes de processar. Emitir eventos de streaming via `streaming.emit()`.
 * 
 * ATUALIZAÇÃO (Etapa 2 - DataAgent): ✅ COMPLETA
 * - Roteamento dinâmico implementado
 * - DataAgent registrado e funcional
 * - Health check completo com métricas de sistema
 * - Endpoint /api/agents/list para descoberta de agentes
 * - Cache manager integrado com estatísticas
 * - Validação robusta de requisições
 * - Graceful shutdown implementado
 */
const path = require('path');
// Forçar carregamento do .env na raiz do projeto quando o serverAgent é executado
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ===== INICIALIZAR LOGGER ANTES DE TUDO =====
const { initLogger } = require('./src/utils/logger');
const logger = initLogger({
  debugMode: process.env.DEBUG_MODE === 'true' // Lê do .env
});

const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');

const app = express();

// Security middlewares
app.use(helmet()); // Set security HTTP headers
// Allow multiple origins for CORS (localhost and 127.0.0.1)
const allowedOrigins = [
	'http://localhost:3000',
	'http://localhost:5500',
	'http://127.0.0.1:3000',
	'http://127.0.0.1:5500',
	process.env.CORS_ORIGIN
].filter(Boolean);

app.use(cors({
	origin: function(origin, callback) {
		// Allow requests with no origin (mobile apps, Postman, etc)
		if (!origin) return callback(null, true);
		
		if (allowedOrigins.indexOf(origin) !== -1) {
			callback(null, true);
		} else {
			callback(new Error('Not allowed by CORS'));
		}
	},
	credentials: true
}));

// Body parsing with size limit
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
const authRoutes = require('./src/routes/authRoutes');
app.use('/api/auth', authRoutes);

// --- Data Agent Routes ---
const DataAgent = require('./src/agents/data/data-agent');
const { validateRequest } = require('./src/agents/shared/contracts');
const ToolContext = require('./src/core/toolContext/tool-context');
const JuniorAgent = require('./src/agents/junior/junior/junior-agent');

// Instancia ToolContext global
const toolContext = new ToolContext();

// ===== ROTEAMENTO DINÂMICO DE AGENTES =====
// Sistema que mapeia agent_name para instância correta
// Futuros agentes serão adicionados aqui conforme forem implementados
const agents = {
	'DataAgent': new DataAgent(),
	'JuniorAgent': new JuniorAgent()
	// 'AnalystAgent': new AnalystAgent(),       // Etapa 5
	// 'ResearchAgent': new ResearchAgent(),     // Etapa 5
	// 'StrategistAgent': new StrategistAgent(), // Etapa 6
	// 'TransactionAgent': new TransactionAgent(), // Etapa 6
	// 'ValidatorAgent': new ValidatorAgent(),   // Etapa 6
	// 'OrchestratorAgent': new OrchestratorAgent() // Etapa 4
};

// Função auxiliar para obter agente
const getAgent = (agentName) => {
	const agent = agents[agentName];
	if (!agent) {
		throw new Error(`Agent "${agentName}" não encontrado. Agentes disponíveis: ${Object.keys(agents).join(', ')}`);
	}
	return agent;
};

// ===== ENDPOINT PRINCIPAL PARA EXECUTAR AGENTES =====
// Aceita requisições para qualquer agente registrado no sistema
const executeAgentHandler = async (req, res) => {
	try {
		// Valida requisição contra contrato
		const validation = validateRequest(req.body);
		
		if (!validation.valid) {
			return res.status(400).json({
				status: 'error',
				error: {
					code: 'INVALID_REQUEST',
					message: validation.error,
					type: 'ValidationError'
				}
			});
		}

		const request = validation.value;

		// Busca o agente correto baseado em agent_name
		let agent;
		try {
			agent = getAgent(request.agent_name);
		} catch (error) {
			return res.status(404).json({
				status: 'error',
				error: {
					code: 'AGENT_NOT_FOUND',
					message: error.message,
					type: 'NotFoundError'
				}
			});
		}

		// Adiciona ToolContext ao contexto da requisição
		if (!request.context) {
			request.context = {};
		}
		request.context.toolContext = toolContext;

		// Adiciona informações da sessão
		request.context.session_id = request.session_id || req.body.session_id;
		request.context.user_id = request.user_id || req.body.user_id;

		// Executa o agente
		const result = await agent.run(request);

		// Retorna resposta
		res.json(result);

	} catch (error) {
		console.error('Erro ao executar agente:', error);
		res.status(500).json({
			status: 'error',
			error: {
				code: 'INTERNAL_ERROR',
				message: 'Erro interno do servidor',
				type: 'InternalError',
				details: process.env.NODE_ENV === 'development' ? error.stack : undefined
			}
		});
	}
};

// Registra handler em ambas as rotas (compatibilidade)
app.post('/agent/execute', executeAgentHandler);
app.post('/api/agent/execute', executeAgentHandler);

// ===== HEALTH CHECK COMPLETO =====
// Retorna status de todos os agentes registrados
app.get('/api/agent/health', (req, res) => {
	const cacheManager = require('./src/agents/data/cache-manager');
	const cacheStats = cacheManager.getStats();

	// Verifica status de cada agente
	const agentStatuses = {};
	for (const [name, agent] of Object.entries(agents)) {
		agentStatuses[name] = agent ? 'active' : 'inactive';
	}

	res.json({
		status: 'healthy',
		timestamp: new Date().toISOString(),
		agents: agentStatuses,
		agents_count: Object.keys(agents).length,
		database: {
			mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
			readyState: mongoose.connection.readyState
		},
		cache: {
			status: 'active',
			...cacheStats
		},
		system: {
			uptime: process.uptime(),
			memory: {
				used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
				total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
				unit: 'MB'
			},
			node_version: process.version
		}
	});
});

// Endpoint para invalidar cache (útil para desenvolvimento/debug)
app.post('/api/agent/cache/invalidate', async (req, res) => {
	try {
		const cacheManager = require('./src/agents/data/cache-manager');
		const { user_id, account_id, pattern } = req.body;

		const count = await cacheManager.invalidate({
			user_id,
			account_id,
			pattern
		});

		res.json({
			status: 'success',
			message: `${count} chaves de cache invalidadas`,
			invalidated_count: count
		});

	} catch (error) {
		res.status(500).json({
			status: 'error',
			message: error.message
		});
	}
});

// Endpoint para estatísticas de cache
app.get('/api/agent/cache/stats', (req, res) => {
	const cacheManager = require('./src/agents/data/cache-manager');
	const stats = cacheManager.getStats();

	res.json({
		status: 'success',
		cache_stats: stats,
		timestamp: new Date().toISOString()
	});
});

// Health check endpoint (geral do servidor - simples e rápido)
app.get('/health', (req, res) => {
	res.json({ 
		status: 'ok', 
		service: 'Agent Server',
		timestamp: new Date().toISOString(),
		mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
		agents_loaded: Object.keys(agents).length
	});
});

// Endpoint para listar agentes disponíveis
app.get('/api/agents/list', (req, res) => {
	const agentsList = Object.keys(agents).map(name => ({
		name,
		status: 'active',
		actions: agents[name].actionMap ? Object.keys(agents[name].actionMap) : []
	}));

	res.json({
		status: 'success',
		agents: agentsList,
		total: agentsList.length,
		timestamp: new Date().toISOString()
	});
});

// ===== ENDPOINT PARA PROCESSAMENTO DE CHAT =====
// Processa mensagens de chat usando o JuniorAgent
app.post('/api/chat/process', async (req, res) => {
	try {
		// Log apenas campos essenciais (não o body completo)
		console.log('[SERVER] 📥 POST /api/chat/process - Campos extraídos:', {
			message: req.body.message?.substring(0, 50) + (req.body.message?.length > 50 ? '...' : ''),
			sessionId: req.body.sessionId,
			historyLength: req.body.history?.length || 0,
			userId: req.body.userId,
			chatId: req.body.chatId
		});
		
		const { message, sessionId, history, userId, chatId } = req.body;
		
		console.log('[SERVER] 🔍 Campos extraídos:', {
			message: message ? `${message.substring(0, 50)}...` : 'AUSENTE',
			sessionId: sessionId || 'AUSENTE',
			historyLength: Array.isArray(history) ? history.length : 'AUSENTE',
			userId: userId || '❌ AUSENTE',
			chatId: chatId || 'AUSENTE'
		});

		// Validação básica
		if (!message || typeof message !== 'string') {
			console.error('[SERVER] ❌ Validação falhou: mensagem inválida');
			return res.status(400).json({
				status: 'error',
				error: {
					code: 'INVALID_MESSAGE',
					message: 'Mensagem inválida ou ausente',
					type: 'ValidationError'
				}
			});
		}

		// Validate required fields for memory system
		if (!userId) {
			console.error('[SERVER] ❌ Validação falhou: userId ausente no request body');
			return res.status(400).json({
				status: 'error',
				error: {
					code: 'MISSING_USER_ID',
					message: 'userId é obrigatório para sistema de memória',
					type: 'ValidationError'
				}
			});
		}
		
		console.log('[SERVER] ✅ Validações passaram, processando mensagem...');

		// Generate sessionId and chatId if not provided
		const finalSessionId = sessionId || `session_${userId}_${Date.now()}`;
		const finalChatId = chatId || `chat_${userId}_${Date.now()}`;

		console.log('[SERVER] 🔧 IDs finalizados:', {
			userId,
			sessionId: finalSessionId,
			chatId: finalChatId,
			messageLength: message.length
		});

		// Processa a mensagem usando JuniorAgent
		console.log('[SERVER] 📤 Enviando para JuniorAgent...');
		const result = await agents['JuniorAgent'].run({
			action: 'process_chat_message',
			parameters: { 
				message, 
				sessionId: finalSessionId, 
				chatId: finalChatId,
				userId,
				history 
			}
		});

		console.log('[SERVER] ✅ JuniorAgent processou com sucesso:', {
			status: result.status,
			hasResponse: !!result.data?.response,
			responseLength: result.data?.response?.length || 0
		});

		// Retorna resposta
		// result tem a estrutura: { status: 'success', data: { response, sessionId, timestamp }, ... }
		const responsePayload = {
			status: 'success',
			...result.data,
			sessionId: finalSessionId,
			chatId: finalChatId,
			timestamp: new Date().toISOString()
		};

		console.log('[CHAT] Enviando resposta para o cliente:', JSON.stringify(responsePayload, null, 2));

		res.json(responsePayload);

	} catch (error) {
		console.error('Erro no processamento de chat:', error);
		res.status(500).json({
			status: 'error',
			error: {
				code: 'CHAT_PROCESSING_ERROR',
				message: error.message || 'Erro interno ao processar mensagem',
				type: 'InternalError'
			}
		});
	}
});

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const PORT = process.env.AGENT_PORT || 5000;

if (!MONGO_URI) {
	console.error('MONGO_URI not set in .env');
	process.exit(1);
}

// Remove deprecated options
mongoose.connect(MONGO_URI)
	.then(async () => {
		console.log('Connected to MongoDB');
		
		// Initialize Pinecone Vector Store
		try {
			const pineconeStore = require('./src/core/memory/longTerm/pinecone-store');
			await pineconeStore.initialize();
			console.log('Pinecone Vector Store initialized');
		} catch (error) {
			console.error('Failed to initialize Pinecone (will continue without vector search):', error.message);
			// Continue without Pinecone - MongoDB is source of truth
		}
		
		const server = app.listen(PORT, () => {
			console.log(`serverAgent listening on port ${PORT}`);
		});

		// Graceful shutdown
		const gracefulShutdown = async (signal) => {
			console.log(`\n${signal} received. Starting graceful shutdown...`);
			
			server.close(async () => {
				console.log('HTTP server closed');
				
				try {
					await mongoose.connection.close();
					console.log('MongoDB connection closed');
					
					// Encerrar logger
					const { shutdownLogger } = require('./src/utils/logger');
					shutdownLogger();
					
					process.exit(0);
				} catch (err) {
					console.error('Error during shutdown:', err);
					process.exit(1);
				}
			});
			
			// Force shutdown after 10 seconds
			setTimeout(() => {
				console.error('Forced shutdown after timeout');
				process.exit(1);
			}, 10000);
		};

		process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
		process.on('SIGINT', () => gracefulShutdown('SIGINT'));
	})
	.catch(err => {
		console.error('Failed to connect to MongoDB', err);
		process.exit(1);
	});

// --- Streaming: import emitter utilities and add SSE endpoint + demo route ---
const streaming = require('./src/core/streaming/event-emitter');
const { EVENT_TYPES } = require('./src/core/streaming/event-types');
const streamFormatter = require('./src/core/streaming/stream-formatter');

// SSE endpoint: client connects to receive events for a given sessionId
app.get('/stream/agents/:sessionId', (req, res) => {
	const { sessionId } = req.params;

	// Set SSE headers
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache');
	res.setHeader('Connection', 'keep-alive');
	if (res.flushHeaders) res.flushHeaders();

	// Listener that writes formatted events to the SSE response
	const onEvent = (event) => {
		try {
			res.write(streamFormatter.formatEvent(event.type, event.payload));
		} catch (err) {
			console.error('[SSE] Failed to write event to stream:', err);
		}
	};

	// Register for session events
	streaming.on(sessionId, onEvent);

	// Send initial handshake
	res.write(streamFormatter.formatEvent(EVENT_TYPES.NODE_START, { message: 'connected' }));

	// Cleanup when client disconnects
	req.on('close', () => {
		streaming.off(sessionId, onEvent);
	});
});

// Demo route to simulate an agent emitting streaming events for a session
app.post('/api/agents/stream-demo', (req, res) => {
	const { sessionId } = req.body || {};
	if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

	// A simulated sequence of events
	setTimeout(() => streaming.emit(sessionId, EVENT_TYPES.TOOL_CALL, { message: 'Consultando saldo atual...' }), 200);
	setTimeout(() => streaming.emit(sessionId, EVENT_TYPES.DATA_PARTIAL, { message: 'Saldo parcial: R$ 5.200,00' }), 900);
	setTimeout(() => streaming.emit(sessionId, EVENT_TYPES.THOUGHT_REASONING, { message: 'Analisando histórico de gastos...' }), 1600);
	setTimeout(() => streaming.emit(sessionId, EVENT_TYPES.TOOL_CALL, { message: 'Calculando projeções...' }), 2600);
	setTimeout(() => streaming.emit(sessionId, EVENT_TYPES.FINAL_ANSWER, { message: 'Resposta final: projeção concluída.' }), 4200);

	return res.status(202).json({ status: 'started' });
});
