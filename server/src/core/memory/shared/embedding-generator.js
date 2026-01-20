/**
 * NOTE (embedding-generator.js):
 * Purpose: Generate vector embeddings for semantic search in memory system.
 * Controls: Integration with OpenAI Embeddings API, batch generation, cosine similarity calculation.
 * Integration notes: Used by Long-Term Memory vector store for semantic retrieval.
 * Requires: OPENAI_API_KEY in environment variables.
 */

// Note: In production, use actual OpenAI SDK. This is a placeholder structure.
// Install: npm install openai

/**
 * Generate embedding for a single text
 * @param {string} text - Text to embed
 * @param {string} model - Model name (default: text-embedding-3-small)
 * @returns {Promise<number[]>} - Embedding vector
 */
async function generate(text, model = 'text-embedding-3-small') {
  if (!text || typeof text !== 'string') {
    throw new Error('Text must be a non-empty string');
  }
  
  // CRITICAL WARNING: OpenAI embeddings not configured
  if (!process.env.OPENAI_API_KEY) {
    console.error('[CRITICAL] OPENAI_API_KEY not set - semantic search will NOT work properly!');
    console.error('[CRITICAL] Add OPENAI_API_KEY to .env and install: npm install openai');
  }
  
  // TODO: Integrate with actual OpenAI SDK when available
  // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // const response = await openai.embeddings.create({
  //   model: model,
  //   input: text
  // });
  // return response.data[0].embedding;
  
  // Placeholder: return mock embedding (WARNING: NOT FOR PRODUCTION)
  console.warn('[EmbeddingGenerator] Using MOCK embeddings - semantic search is DISABLED');
  return new Array(1536).fill(0).map(() => Math.random());
}

/**
 * Generate embeddings for multiple texts (batch)
 * @param {string[]} texts - Array of texts to embed
 * @param {string} model - Model name
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
async function generateBatch(texts, model = 'text-embedding-3-small') {
  if (!Array.isArray(texts) || texts.length === 0) {
    throw new Error('Texts must be a non-empty array');
  }
  
  // TODO: Integrate with actual OpenAI SDK for batch processing
  // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  // const response = await openai.embeddings.create({
  //   model: model,
  //   input: texts
  // });
  // return response.data.map(item => item.embedding);
  
  // Placeholder: generate mock embeddings
  console.warn('OpenAI batch embedding generation not yet configured. Returning mock embeddings.');
  return texts.map(() => new Array(1536).fill(0).map(() => Math.random()));
}

/**
 * Calculate cosine similarity between two vectors
 * @param {number[]} vectorA - First vector
 * @param {number[]} vectorB - Second vector
 * @returns {number} - Cosine similarity (-1 to 1)
 */
function cosineSimilarity(vectorA, vectorB) {
  if (!Array.isArray(vectorA) || !Array.isArray(vectorB)) {
    throw new Error('Both inputs must be arrays');
  }
  
  if (vectorA.length !== vectorB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < vectorA.length; i++) {
    dotProduct += vectorA[i] * vectorB[i];
    magnitudeA += vectorA[i] * vectorA[i];
    magnitudeB += vectorB[i] * vectorB[i];
  }
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Find most similar vectors from a list
 * @param {number[]} queryVector - Query vector
 * @param {Array<{id: string, vector: number[], metadata: *}>} vectors - List of vectors to search
 * @param {number} topK - Number of results to return
 * @returns {Array<{id: string, similarity: number, metadata: *}>} - Top K similar vectors
 */
function findMostSimilar(queryVector, vectors, topK = 5) {
  const similarities = vectors.map(item => ({
    id: item.id,
    similarity: cosineSimilarity(queryVector, item.vector),
    metadata: item.metadata
  }));
  
  // Sort by similarity descending
  similarities.sort((a, b) => b.similarity - a.similarity);
  
  return similarities.slice(0, topK);
}

module.exports = {
  generate,
  generateBatch,
  cosineSimilarity,
  findMostSimilar
};
