/**
 * Document Ingestion Script
 *
 * Processes all PDFs in the /docs directory and stores their embeddings
 * in ChromaDB. Run this after adding new documents to the knowledge base.
 *
 * Usage:
 *   npx ts-node src/scripts/ingest.ts
 *   npx ts-node src/scripts/ingest.ts --clear   # wipe and re-ingest
 */

import { DocumentLoader } from "../services/document-loader";
import { ChunkingService } from "../services/chunking-service";
import { VectorStoreService } from "../services/vector-store";
import { config } from "../config";
import { logger } from "../utils/logger";

async function ingest() {
  const startTime = Date.now();
  const shouldClear = process.argv.includes("--clear");

  logger.info("=== Document Ingestion Pipeline ===");
  logger.info(`Docs directory: ${config.paths.docsDir}`);
  logger.info(`Chunk size: ${config.chunking.chunkSize}, overlap: ${config.chunking.chunkOverlap}`);
  logger.info(`Embedding model: ${config.ollama.embeddingModel}`);

  // Step 1: Load documents
  logger.info("\n--- Step 1: Loading documents ---");
  const loader = new DocumentLoader(config.paths.docsDir);
  const documents = await loader.parseAll();

  if (documents.length === 0) {
    logger.error("No documents found. Add PDFs to the /docs directory.");
    process.exit(1);
  }

  // Step 2: Chunk documents
  logger.info("\n--- Step 2: Chunking documents ---");
  const chunker = new ChunkingService();
  const chunks = await chunker.chunkAll(documents);

  const stats = chunker.getChunkStats(chunks);
  logger.info(`Chunk statistics:`);
  logger.info(`  Total chunks: ${stats.count}`);
  logger.info(`  Avg length: ${stats.avgLength} chars`);
  logger.info(`  Min/Max: ${stats.minLength} / ${stats.maxLength} chars`);
  logger.info(`  By source:`);
  for (const [source, count] of Object.entries(stats.bySource)) {
    logger.info(`    ${source}: ${count} chunks`);
  }

  // Step 3: Store embeddings
  logger.info("\n--- Step 3: Generating embeddings & storing in ChromaDB ---");
  const vectorStore = new VectorStoreService();
  await vectorStore.initialize();

  if (shouldClear) {
    logger.warn("--clear flag set: wiping existing collection...");
    await vectorStore.clearCollection();
  }

  await vectorStore.addDocuments(chunks);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info(`\n=== Ingestion complete in ${elapsed}s ===`);
  logger.info(`  Documents: ${documents.length}`);
  logger.info(`  Chunks: ${chunks.length}`);
  logger.info(`  Collection: ${config.chroma.collection}`);
}

ingest().catch((err) => {
  logger.error("Ingestion failed:", err);
  process.exit(1);
});
