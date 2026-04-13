import { VectorStoreService } from "./vector-store";
import { LLMService } from "./llm-service";
import { logger } from "../utils/logger";
import { config } from "../config";
import { expandQueryVariants, normalizeForEmbedding } from "../utils/serbian-text";

export interface RAGResponse {
  answer: string;
  sources: {
    document: string;
    chunkIndex: number;
    relevanceScore: number;
    pageEstimate: number;
    excerpt: string;
  }[];
  metadata: {
    model: string;
    processingTimeMs: number;
    chunksRetrieved: number;
    queryVariants: string[];
  };
}

/**
 * RAG Service — the core orchestration layer.
 *
 * Implements the Retrieval-Augmented Generation pipeline:
 *   1. RETRIEVE: Find relevant document chunks via vector similarity search
 *   2. AUGMENT: Build a context window from retrieved chunks
 *   3. GENERATE: Pass context + query to Llama 3 for answer generation
 *
 * The key insight of RAG is that it grounds the LLM's output in actual
 * company documents, dramatically reducing hallucination while keeping
 * the conversational interface that site managers expect.
 */
export class RAGService {
  private vectorStore: VectorStoreService;
  private llm: LLMService;

  constructor() {
    this.vectorStore = new VectorStoreService();
    this.llm = new LLMService();
  }

  /**
   * Initialize connections to ChromaDB and verify Ollama health.
   */
  async initialize(): Promise<void> {
    await this.vectorStore.initialize();

    const llmHealthy = await this.llm.healthCheck();
    if (!llmHealthy) {
      logger.warn(
        "Ollama health check failed — LLM may not be running. " +
          `Verify Ollama is available at ${config.ollama.baseUrl}`
      );
    } else {
      logger.info("RAG Service fully initialized and ready.");
    }
  }

  /**
   * Main query method — the full RAG pipeline.
   */
  async query(userQuery: string): Promise<RAGResponse> {
    const startTime = Date.now();
    logger.info(`RAG query: "${userQuery}"`);

    // Step 1: RETRIEVE — find relevant chunks
    // Expand query to handle Serbian diacritics variants
    const queryVariants = expandQueryVariants(userQuery);
    const allResults = [];

    for (const variant of queryVariants) {
      const results = await this.vectorStore.similaritySearch(
        variant,
        config.retrieval.topK
      );
      allResults.push(...results);
    }

    // Deduplicate by chunk content and keep highest scores
    const deduplicated = this.deduplicateResults(allResults);

    // Filter by relevance threshold
    const relevant = deduplicated.filter(
      (r) => r.score >= config.retrieval.scoreThreshold
    );

    if (relevant.length === 0) {
      logger.warn(`No relevant chunks found for query: "${userQuery}"`);
      return {
        answer:
          "Na osnovu dostupne dokumentacije, ne mogu da pronađem odgovor " +
          "na ovo pitanje. Molim vas, pokušajte da preformulišete pitanje " +
          "ili proverite da li je relevantan dokument učitan u sistem.",
        sources: [],
        metadata: {
          model: config.ollama.llmModel,
          processingTimeMs: Date.now() - startTime,
          chunksRetrieved: 0,
          queryVariants,
        },
      };
    }

    // Step 2: AUGMENT — build context from top chunks
    const contextChunks = relevant.slice(0, config.retrieval.topK);
    const context = contextChunks
      .map(
        (r, i) =>
          `[Izvor: ${r.document.metadata.source}, str. ~${r.document.metadata.pageEstimate}]\n${r.document.pageContent}`
      )
      .join("\n\n---\n\n");

    const sourceNames = [
      ...new Set(contextChunks.map((r) => r.document.metadata.source)),
    ];

    // Step 3: GENERATE — get answer from Llama 3
    const { answer } = await this.llm.generateResponse(
      userQuery,
      context,
      sourceNames
    );

    const processingTimeMs = Date.now() - startTime;
    logger.info(`RAG pipeline completed in ${processingTimeMs}ms`);

    return {
      answer,
      sources: contextChunks.map((r) => ({
        document: r.document.metadata.source,
        chunkIndex: r.document.metadata.chunkIndex,
        relevanceScore: parseFloat(r.score.toFixed(4)),
        pageEstimate: r.document.metadata.pageEstimate,
        excerpt: r.document.pageContent.substring(0, 150) + "...",
      })),
      metadata: {
        model: config.ollama.llmModel,
        processingTimeMs,
        chunksRetrieved: contextChunks.length,
        queryVariants,
      },
    };
  }

  /**
   * Query with document filter — search within a specific document only.
   * Useful when the user says "according to the safety regulations..."
   */
  async queryDocument(
    userQuery: string,
    documentName: string
  ): Promise<RAGResponse> {
    const startTime = Date.now();
    logger.info(
      `RAG filtered query: "${userQuery}" in document "${documentName}"`
    );

    const results = await this.vectorStore.filteredSearch(
      userQuery,
      { source: documentName },
      config.retrieval.topK
    );

    if (results.length === 0) {
      return {
        answer: `U dokumentu "${documentName}" nisam pronašao relevantne informacije za vaše pitanje.`,
        sources: [],
        metadata: {
          model: config.ollama.llmModel,
          processingTimeMs: Date.now() - startTime,
          chunksRetrieved: 0,
          queryVariants: [userQuery],
        },
      };
    }

    const context = results
      .map((r) => r.document.pageContent)
      .join("\n\n---\n\n");

    const { answer } = await this.llm.generateResponse(
      userQuery,
      context,
      [documentName]
    );

    return {
      answer,
      sources: results.map((r) => ({
        document: r.document.metadata.source,
        chunkIndex: r.document.metadata.chunkIndex,
        relevanceScore: parseFloat(r.score.toFixed(4)),
        pageEstimate: r.document.metadata.pageEstimate,
        excerpt: r.document.pageContent.substring(0, 150) + "...",
      })),
      metadata: {
        model: config.ollama.llmModel,
        processingTimeMs: Date.now() - startTime,
        chunksRetrieved: results.length,
        queryVariants: [userQuery],
      },
    };
  }

  /**
   * Expose vector store for the ingestion pipeline.
   */
  getVectorStore(): VectorStoreService {
    return this.vectorStore;
  }

  /**
   * Remove duplicate chunks that were returned from multiple query variants.
   * Keeps the result with the highest similarity score.
   */
  private deduplicateResults(
    results: { document: any; score: number }[]
  ): { document: any; score: number }[] {
    const seen = new Map<string, { document: any; score: number }>();

    for (const result of results) {
      const key = `${result.document.metadata.source}:${result.document.metadata.chunkIndex}`;
      const existing = seen.get(key);

      if (!existing || result.score > existing.score) {
        seen.set(key, result);
      }
    }

    return Array.from(seen.values()).sort((a, b) => b.score - a.score);
  }
}
