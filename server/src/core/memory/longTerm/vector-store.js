/**
 * NOTE (vector-store.js):
 * Purpose: Interface for vector storage (Pinecone/Qdrant) for semantic memory search.
 * Controls: Store/retrieve/update/delete embeddings, semantic search by similarity.
 * Behavior: Abstraction layer over vector DB, uses OpenAI embeddings (text-embedding-3-small).
 * Integration notes: Used by long-term-memory.js and memory-merger.js. Requires VECTOR_STORE_URL env var.
 */

const embeddingGenerator = require('../shared/embedding-generator');

// Configuration (select vector store provider)
const VECTOR_STORE_PROVIDER = process.env.VECTOR_STORE_PROVIDER || 'pinecone'; // 'pinecone' or 'qdrant'
const VECTOR_STORE_URL = process.env.VECTOR_STORE_URL;
const VECTOR_STORE_API_KEY = process.env.VECTOR_STORE_API_KEY;
const VECTOR_INDEX_NAME = process.env.VECTOR_INDEX_NAME || 'ltm-memories';

/**
 * Store embedding in vector database
 * @param {string} userId - User ID
 * @param {string} content - Memory content
 * @param {object} metadata - Metadata (category, impactScore, etc.)
 * @returns {Promise<string>} - Vector ID
 */
async function storeEmbedding(userId, content, metadata = {}) {
  const embedding = await embeddingGenerator.generate(content);
  
  const vectorId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const vectorData = {
    id: vectorId,
    values: embedding,
    metadata: {
      userId,
      content,
      category: metadata.category || 'unknown',
      impactScore: metadata.impactScore || 0,
      createdAt: new Date().toISOString()
    }
  };

  // TODO: Implement actual vector store integration
  if (VECTOR_STORE_PROVIDER === 'pinecone') {
    await storeToPinecone(vectorData);
  } else if (VECTOR_STORE_PROVIDER === 'qdrant') {
    await storeToQdrant(vectorData);
  } else {
    // CRITICAL WARNING: In-memory storage is NOT persistent
    console.error('[CRITICAL] Vector store not configured - using volatile in-memory storage!');
    console.error('[CRITICAL] Long-term memories will be LOST on server restart!');
    console.error('[CRITICAL] Set VECTOR_STORE_PROVIDER and VECTOR_STORE_URL in .env');
    console.error('[CRITICAL] Options: "pinecone" or "qdrant"');
    
    if (!global.__vectorStore) {
      global.__vectorStore = new Map();
      console.warn('[VectorStore] Initialized in-memory store (NON-PERSISTENT)');
    }
    global.__vectorStore.set(vectorId, vectorData);
  }

  console.log(`[VectorStore] Stored embedding: ${vectorId}`);
  return vectorId;
}

/**
 * Search for similar memories
 * @param {string} userId - User ID
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<Array>} - Similar memories
 */
async function search(userId, query, options = {}) {
  const {
    limit = 5,
    minScore = 0.7,
    category = null
  } = options;

  const queryEmbedding = await embeddingGenerator.generate(query);

  let results = [];

  // TODO: Implement actual vector store search
  if (VECTOR_STORE_PROVIDER === 'pinecone') {
    results = await searchInPinecone(queryEmbedding, { userId, limit, category });
  } else if (VECTOR_STORE_PROVIDER === 'qdrant') {
    results = await searchInQdrant(queryEmbedding, { userId, limit, category });
  } else {
    // Fallback: in-memory search
    if (global.__vectorStore) {
      const allVectors = Array.from(global.__vectorStore.values());
      const userVectors = allVectors.filter(v => v.metadata.userId === userId);
      
      const scored = userVectors.map(v => ({
        id: v.id,
        score: embeddingGenerator.cosineSimilarity(queryEmbedding, v.values),
        metadata: v.metadata
      }));

      results = scored
        .filter(r => r.score >= minScore && (!category || r.metadata.category === category))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }
  }

  return results;
}

/**
 * Get embedding by ID
 * @param {string} vectorId - Vector ID
 * @returns {Promise<Array|null>} - Embedding vector
 */
async function getEmbedding(vectorId) {
  // TODO: Implement actual retrieval
  if (global.__vectorStore && global.__vectorStore.has(vectorId)) {
    return global.__vectorStore.get(vectorId).values;
  }

  return null;
}

/**
 * Update embedding content
 * @param {string} vectorId - Vector ID
 * @param {string} newContent - New content
 * @returns {Promise<boolean>} - Success
 */
async function updateEmbedding(vectorId, newContent) {
  const newEmbedding = await embeddingGenerator.generate(newContent);

  // TODO: Implement actual update
  if (global.__vectorStore && global.__vectorStore.has(vectorId)) {
    const existing = global.__vectorStore.get(vectorId);
    existing.values = newEmbedding;
    existing.metadata.content = newContent;
    existing.metadata.updatedAt = new Date().toISOString();
    return true;
  }

  return false;
}

/**
 * Delete embedding
 * @param {string} vectorId - Vector ID
 * @returns {Promise<boolean>} - Success
 */
async function deleteEmbedding(vectorId) {
  // TODO: Implement actual deletion
  if (global.__vectorStore && global.__vectorStore.has(vectorId)) {
    global.__vectorStore.delete(vectorId);
    console.log(`[VectorStore] Deleted embedding: ${vectorId}`);
    return true;
  }

  return false;
}

/**
 * Store to Pinecone (placeholder)
 * @param {object} vectorData - Vector data
 */
async function storeToPinecone(vectorData) {
  // TODO: Implement Pinecone SDK integration
  /*
  const { PineconeClient } = require('@pinecone-database/pinecone');
  const pinecone = new PineconeClient();
  await pinecone.init({
    apiKey: VECTOR_STORE_API_KEY,
    environment: 'us-west1-gcp'
  });

  const index = pinecone.Index(VECTOR_INDEX_NAME);
  await index.upsert({
    upsertRequest: {
      vectors: [vectorData]
    }
  });
  */

  console.warn('[VectorStore] Pinecone integration not implemented');
}

/**
 * Search in Pinecone (placeholder)
 * @param {Array} queryEmbedding - Query vector
 * @param {object} options - Search options
 * @returns {Promise<Array>} - Results
 */
async function searchInPinecone(queryEmbedding, options) {
  // TODO: Implement Pinecone search
  /*
  const { PineconeClient } = require('@pinecone-database/pinecone');
  const pinecone = new PineconeClient();
  await pinecone.init({
    apiKey: VECTOR_STORE_API_KEY,
    environment: 'us-west1-gcp'
  });

  const index = pinecone.Index(VECTOR_INDEX_NAME);
  const queryResponse = await index.query({
    queryRequest: {
      vector: queryEmbedding,
      topK: options.limit,
      filter: {
        userId: options.userId,
        ...(options.category && { category: options.category })
      },
      includeMetadata: true
    }
  });

  return queryResponse.matches.map(match => ({
    id: match.id,
    score: match.score,
    metadata: match.metadata
  }));
  */

  console.warn('[VectorStore] Pinecone search not implemented');
  return [];
}

/**
 * Store to Qdrant (placeholder)
 * @param {object} vectorData - Vector data
 */
async function storeToQdrant(vectorData) {
  // TODO: Implement Qdrant integration
  /*
  const { QdrantClient } = require('@qdrant/js-client-rest');
  const client = new QdrantClient({ url: VECTOR_STORE_URL, apiKey: VECTOR_STORE_API_KEY });

  await client.upsert(VECTOR_INDEX_NAME, {
    wait: true,
    points: [
      {
        id: vectorData.id,
        vector: vectorData.values,
        payload: vectorData.metadata
      }
    ]
  });
  */

  console.warn('[VectorStore] Qdrant integration not implemented');
}

/**
 * Search in Qdrant (placeholder)
 * @param {Array} queryEmbedding - Query vector
 * @param {object} options - Search options
 * @returns {Promise<Array>} - Results
 */
async function searchInQdrant(queryEmbedding, options) {
  // TODO: Implement Qdrant search
  /*
  const { QdrantClient } = require('@qdrant/js-client-rest');
  const client = new QdrantClient({ url: VECTOR_STORE_URL, apiKey: VECTOR_STORE_API_KEY });

  const searchResult = await client.search(VECTOR_INDEX_NAME, {
    vector: queryEmbedding,
    limit: options.limit,
    filter: {
      must: [
        { key: 'userId', match: { value: options.userId } },
        ...(options.category ? [{ key: 'category', match: { value: options.category } }] : [])
      ]
    },
    with_payload: true
  });

  return searchResult.map(hit => ({
    id: hit.id,
    score: hit.score,
    metadata: hit.payload
  }));
  */

  console.warn('[VectorStore] Qdrant search not implemented');
  return [];
}

/**
 * Get statistics
 * @param {string} userId - User ID (optional)
 * @returns {Promise<object>} - Stats
 */
async function getStats(userId = null) {
  if (global.__vectorStore) {
    const allVectors = Array.from(global.__vectorStore.values());
    const userVectors = userId 
      ? allVectors.filter(v => v.metadata.userId === userId)
      : allVectors;

    return {
      total: userVectors.length,
      byCategory: userVectors.reduce((acc, v) => {
        acc[v.metadata.category] = (acc[v.metadata.category] || 0) + 1;
        return acc;
      }, {})
    };
  }

  return { total: 0, byCategory: {} };
}

module.exports = {
  storeEmbedding,
  search,
  getEmbedding,
  updateEmbedding,
  deleteEmbedding,
  getStats
};
