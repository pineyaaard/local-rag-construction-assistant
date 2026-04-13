import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Document } from "@langchain/core/documents";
import { logger } from "../utils/logger";
import { config } from "../config";
import type { ChunkMetadata } from "./chunking-service";

/**
 * Vector store service — manages document embeddings in ChromaDB.
 *
 * Uses Ollama's `nomic-embed-text` model for local embedding generation.
 * No data leaves the network — embeddings are computed on-premise and
 * stored in a local ChromaDB instance.
 *
 * ChromaDB was chosen over FAISS for this project because:
 * - Persistent storage out of the box (survives server restarts)
 * - Metadata filtering (filter by source document, page, etc.)
 * - Simple HTTP API (easy to deploy on client's infrastructure)
 * - Good enough performance for <100k document chunks
 *
 * For larger deployments (>500k chunks), consider migrating to
 * Milvus or Weaviate with GPU-accelerated indexing.
 */
export class VectorStoreService {
  private embeddings: OllamaEmbeddings;
  private vectorStore: Chroma | null = null;

  constructor() {
    this.embeddings = new OllamaEmbeddings({
      model: config.ollama.embeddingModel,
      baseUrl: config.ollama.baseUrl,
    });

    logger.info(
      `VectorStoreService initialized with model: ${config.ollama.embeddingModel}`
    );
  }

  /**
   * Initialize connection to ChromaDB collection.
   * Creates the collection if it doesn't exist.
   */
  async initialize(): Promise<void> {
    this.vectorStore = new Chroma(this.embeddings, {
      url: config.chroma.url,
      collectionName: config.chroma.collection,
    });
    logger.info(`Connected to ChromaDB collection: ${config.chroma.collection}`);
  }

  /**
   * Add document chunks to the vector store.
   * Generates embeddings locally via Ollama and stores them in ChromaDB.
   */
  async addDocuments(documents: Document<ChunkMetadata>[]): Promise<void> {
    if (!this.vectorStore) {
      throw new Error("VectorStoreService not initialized. Call initialize() first.");
    }

    const batchSize = 50; // ChromaDB performs better with batched inserts
    const totalBatches = Math.ceil(documents.length / batchSize);

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      logger.info(
        `Embedding batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`
      );

      await this.vectorStore.addDocuments(batch);
    }

    logger.info(`Added ${documents.length} chunks to vector store`);
  }

  /**
   * Perform similarity search for a given query.
   * Returns the top-K most relevant document chunks with scores.
   */
  async similaritySearch(
    query: string,
    topK: number = config.retrieval.topK
  ): Promise<{ document: Document<ChunkMetadata>; score: number }[]> {
    if (!this.vectorStore) {
      throw new Error("VectorStoreService not initialized. Call initialize() first.");
    }

    const results = await this.vectorStore.similaritySearchWithScore(query, topK);

    // ChromaDB returns [document, score] tuples
    // Lower score = more similar (cosine distance)
    const formatted = results.map(([doc, score]) => ({
      document: doc as Document<ChunkMetadata>,
      score: 1 - score, // Convert distance to similarity (0-1)
    }));

    logger.debug(
      `Query: "${query.substring(0, 60)}..." → ${formatted.length} results ` +
        `(best score: ${formatted[0]?.score.toFixed(3) || "N/A"})`
    );

    return formatted;
  }

  /**
   * Search with metadata filtering.
   * Example: search only within a specific document.
   */
  async filteredSearch(
    query: string,
    filter: { source?: string },
    topK: number = config.retrieval.topK
  ): Promise<{ document: Document<ChunkMetadata>; score: number }[]> {
    if (!this.vectorStore) {
      throw new Error("VectorStoreService not initialized. Call initialize() first.");
    }

    const chromaFilter: Record<string, string> = {};
    if (filter.source) {
      chromaFilter["source"] = filter.source;
    }

    const results = await this.vectorStore.similaritySearchWithScore(
      query,
      topK,
      chromaFilter
    );

    return results.map(([doc, score]) => ({
      document: doc as Document<ChunkMetadata>,
      score: 1 - score,
    }));
  }

  /**
   * Delete all documents from the collection.
   * Used during re-ingestion to avoid duplicate chunks.
   */
  async clearCollection(): Promise<void> {
    if (!this.vectorStore) {
      throw new Error("VectorStoreService not initialized.");
    }

    // ChromaDB: delete collection and recreate
    await this.vectorStore.delete({ filter: {} });
    logger.warn(`Cleared all documents from collection: ${config.chroma.collection}`);
  }

  /**
   * Get the embeddings instance (for use in other services).
   */
  getEmbeddings(): OllamaEmbeddings {
    return this.embeddings;
  }
}
