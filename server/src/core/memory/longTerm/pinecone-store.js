/**
 * NOTE (pinecone-store.js):
 * Purpose: Wrapper for Pinecone Vector Store integration with Long-Term Memory.
 * Controls: Namespace isolation per user (user_{userId}), max 100 records per batch.
 * Behavior: namespace().upsert() after MongoDB save, query() with reranking for retrieval.
 * Integration notes: ONLY used for LTM, not Working/Episodic Memory. Index created via UI/CLI, NOT code.
 */

const { Pinecone } = require('@pinecone-database/pinecone');

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const INDEX_NAME = 'long-term-memory';
const BATCH_SIZE = 100; // Max records per batch

let pc = null;
let index = null;

/**
 * Initialize Pinecone client (call once at startup)
 * @returns {Promise<void>}
 */
async function initialize() {
  if (!PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY not found in environment variables');
  }

  try {
    pc = new Pinecone({ apiKey: PINECONE_API_KEY });
    
    // Verify index exists by listing indexes
    const indexList = await pc.listIndexes();
    const indexExists = indexList.indexes?.some(idx => idx.name === INDEX_NAME);
    
    if (!indexExists) {
      console.warn(`[Pinecone] Index '${INDEX_NAME}' not found. Available indexes:`, indexList.indexes?.map(i => i.name).join(', ') || 'none');
      throw new Error(`Pinecone index '${INDEX_NAME}' does not exist. Create it via Pinecone UI or CLI first.`);
    }

    // Connect to index
    index = pc.index(INDEX_NAME);
    console.log(`[Pinecone] Connected to index '${INDEX_NAME}'`);
  } catch (error) {
    console.error('[Pinecone] Initialization failed:', error.message);
    throw error;
  }
}

/**
 * Get namespace for user
 * @param {string} userId - MongoDB User ID
 * @returns {string} - Namespace (user_{userId})
 */
function getUserNamespace(userId) {
  return `user_${userId}`;
}

/**
 * Upsert single memory record to Pinecone
 * @param {string} userId - User ID
 * @param {object} memoryItem - Memory item from MongoDB
 * @returns {Promise<void>}
 */
async function upsertMemory(userId, memoryItem) {
  if (!index) {
    throw new Error('Pinecone not initialized. Call initialize() first.');
  }

  const namespace = getUserNamespace(userId);
  
  const record = {
    id: memoryItem._id.toString(),
    // Use 'data' for Inference API (automatic embeddings) instead of 'values'
    data: memoryItem.content,
    metadata: {
      content: memoryItem.content,
      category: memoryItem.category,
      impactScore: memoryItem.impactScore,
      eventDate: memoryItem.eventDate ? memoryItem.eventDate.toISOString() : new Date().toISOString(),
      createdAt: memoryItem.createdAt.toISOString(),
      accessCount: memoryItem.accessCount || 0
    }
  };

  try {
    await index.namespace(namespace).upsert([record]);
    console.log(`[Pinecone] Upserted memory ${record.id} to namespace ${namespace}`);
  } catch (error) {
    console.error('[Pinecone] Upsert failed:', error.message);
    throw error;
  }
}

/**
 * Upsert multiple memories in batches
 * Used for initial migration or bulk synchronization
 * @param {string} userId - User ID
 * @param {Array<object>} memoryItems - Array of memory items from MongoDB
 * @returns {Promise<number>} - Number of records upserted
 */
async function upsertMemoriesBatch(userId, memoryItems) {
  if (!index) {
    throw new Error('Pinecone not initialized. Call initialize() first.');
  }

  const namespace = getUserNamespace(userId);
  let totalUpserted = 0;

  // Process in batches of 100
  for (let i = 0; i < memoryItems.length; i += BATCH_SIZE) {
    const batch = memoryItems.slice(i, i + BATCH_SIZE);
    
    const records = batch.map(mem => ({
      id: mem._id.toString(),
      // Use 'data' for Inference API (automatic embeddings) instead of 'values'
      data: mem.content,
      metadata: {
        content: mem.content,
        category: mem.category,
        impactScore: mem.impactScore,
        eventDate: mem.eventDate ? mem.eventDate.toISOString() : new Date().toISOString(),
        createdAt: mem.createdAt.toISOString(),
        accessCount: mem.accessCount || 0
      }
    }));

    try {
      await index.namespace(namespace).upsert(records);
      totalUpserted += records.length;
      console.log(`[Pinecone] Upserted batch ${i / BATCH_SIZE + 1}: ${records.length} records`);
      
      // Rate limiting between batches
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[Pinecone] Batch upsert failed for batch ${i / BATCH_SIZE + 1}:`, error.message);
      throw error;
    }
  }

  console.log(`[Pinecone] Total upserted: ${totalUpserted} memories for user ${userId}`);
  return totalUpserted;
}

/**
 * Search memories using semantic vector search with reranking
 * @param {string} userId - User ID
 * @param {string} queryText - Search query
 * @param {object} options - Search options
 * @param {number} options.topK - Number of results (default: 5)
 * @param {object} options.filter - Metadata filter (optional)
 * @returns {Promise<Array>} - Array of search results
 */
async function searchMemories(userId, queryText, options = {}) {
  if (!index) {
    throw new Error('Pinecone not initialized. Call initialize() first.');
  }

  const {
    topK = 5,
    filter = null
  } = options;

  const namespace = getUserNamespace(userId);

  try {
    // Build query options
    const queryOptions = {
      topK: topK,
      includeMetadata: true,
      includeValues: false
    };

    // Add filter if provided
    if (filter) {
      queryOptions.filter = filter;
    }

    // Query using inference (automatic embeddings from query text)
    const results = await index.namespace(namespace).query({
      data: queryText,
      ...queryOptions
    });

    // Process results
    const memories = results.matches.map(match => ({
      memoryId: match.id,
      score: match.score,
      content: match.metadata.content,
      category: match.metadata.category,
      impactScore: match.metadata.impactScore,
      eventDate: new Date(match.metadata.eventDate),
      createdAt: new Date(match.metadata.createdAt),
      accessCount: match.metadata.accessCount
    }));

    console.log(`[Pinecone] Search returned ${memories.length} results for query: "${queryText}"`);
    return memories;

  } catch (error) {
    console.error('[Pinecone] Search failed:', error.message);
    throw error;
  }
}

/**
 * Search by category without text query (list memories in category)
 * @param {string} userId - User ID
 * @param {string} category - Category name
 * @param {number} topK - Number of results
 * @returns {Promise<Array>} - Array of memories
 */
async function searchByCategory(userId, category, topK = 10) {
  if (!index) {
    throw new Error('Pinecone not initialized. Call initialize() first.');
  }

  const namespace = getUserNamespace(userId);

  try {
    // Use dummy query vector for filter-only search
    const results = await index.namespace(namespace).query({
      topK: topK,
      filter: { category: { $eq: category } },
      includeMetadata: true,
      includeValues: false
    });

    const memories = results.matches.map(match => ({
      memoryId: match.id,
      score: match.score || 0,
      content: match.metadata.content,
      category: match.metadata.category,
      impactScore: match.metadata.impactScore,
      eventDate: new Date(match.metadata.eventDate),
      createdAt: new Date(match.metadata.createdAt),
      accessCount: match.metadata.accessCount
    }));

    return memories;

  } catch (error) {
    console.error('[Pinecone] Search by category failed:', error.message);
    throw error;
  }
}

/**
 * Delete specific memory from Pinecone
 * @param {string} userId - User ID
 * @param {string} memoryId - MongoDB memory item ID
 * @returns {Promise<void>}
 */
async function deleteMemory(userId, memoryId) {
  if (!index) {
    throw new Error('Pinecone not initialized. Call initialize() first.');
  }

  const namespace = getUserNamespace(userId);

  try {
    await index.namespace(namespace).deleteMany([memoryId]);
    console.log(`[Pinecone] Deleted memory ${memoryId} from namespace ${namespace}`);
  } catch (error) {
    console.error('[Pinecone] Delete failed:', error.message);
    throw error;
  }
}

/**
 * Delete multiple memories from Pinecone
 * @param {string} userId - User ID
 * @param {Array<string>} memoryIds - Array of MongoDB memory item IDs
 * @returns {Promise<void>}
 */
async function deleteMemoriesBatch(userId, memoryIds) {
  if (!index) {
    throw new Error('Pinecone not initialized. Call initialize() first.');
  }

  const namespace = getUserNamespace(userId);

  try {
    await index.namespace(namespace).deleteMany(memoryIds);
    console.log(`[Pinecone] Deleted ${memoryIds.length} memories from namespace ${namespace}`);
  } catch (error) {
    console.error('[Pinecone] Batch delete failed:', error.message);
    throw error;
  }
}

/**
 * Delete ALL memories for a user (namespace)
 * WARNING: Use with caution - this is irreversible
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function deleteAllUserMemories(userId) {
  if (!index) {
    throw new Error('Pinecone not initialized. Call initialize() first.');
  }

  const namespace = getUserNamespace(userId);

  try {
    await index.namespace(namespace).deleteAll();
    console.log(`[Pinecone] Deleted all memories from namespace ${namespace}`);
  } catch (error) {
    console.error('[Pinecone] Delete all failed:', error.message);
    throw error;
  }
}

/**
 * Get statistics for user's memories in Pinecone
 * @param {string} userId - User ID
 * @returns {Promise<object>} - Namespace stats
 */
async function getNamespaceStats(userId) {
  if (!index) {
    throw new Error('Pinecone not initialized. Call initialize() first.');
  }

  const namespace = getUserNamespace(userId);

  try {
    const stats = await index.describeIndexStats();

    return {
      namespace,
      recordCount: stats.namespaces?.[namespace]?.recordCount || 0,
      totalRecords: stats.totalRecordCount || 0
    };
  } catch (error) {
    console.error('[Pinecone] Stats retrieval failed:', error.message);
    throw error;
  }
}

module.exports = {
  initialize,
  upsertMemory,
  upsertMemoriesBatch,
  searchMemories,
  searchByCategory,
  deleteMemory,
  deleteMemoriesBatch,
  deleteAllUserMemories,
  getNamespaceStats
};
