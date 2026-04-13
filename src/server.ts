import express from "express";
import cors from "cors";
import { RAGService } from "./services/rag-service";
import { config } from "./config";
import { logger } from "./utils/logger";

const app = express();
app.use(cors());
app.use(express.json());

// Initialize RAG service
const ragService = new RAGService();

/**
 * POST /api/query
 * Main endpoint — ask a question about construction documents.
 *
 * Request body:
 *   { "query": "Koji je rok za izdavanje građevinske dozvole?" }
 *
 * Optional:
 *   { "query": "...", "document": "Zakon_o_planiranju_i_izgradnji_2023.pdf" }
 *   → restricts search to a specific document
 */
app.post("/api/query", async (req, res) => {
  try {
    const { query, document: docFilter } = req.body;

    if (!query || typeof query !== "string") {
      return res.status(400).json({
        error: "Missing or invalid 'query' field. Provide a string question.",
      });
    }

    if (query.length > 2000) {
      return res.status(400).json({
        error: "Query too long. Maximum 2000 characters.",
      });
    }

    logger.info(`API query: "${query.substring(0, 100)}..."`);

    const result = docFilter
      ? await ragService.queryDocument(query, docFilter)
      : await ragService.query(query);

    return res.json(result);
  } catch (error) {
    logger.error("Query endpoint error:", error);
    return res.status(500).json({
      error: "Internal server error. Check if Ollama and ChromaDB are running.",
    });
  }
});

/**
 * GET /api/documents
 * List all documents in the knowledge base.
 */
app.get("/api/documents", async (_req, res) => {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const docsDir = config.paths.docsDir;

    const files = fs.readdirSync(docsDir)
      .filter((f: string) => f.toLowerCase().endsWith(".pdf"))
      .map((f: string) => {
        const stats = fs.statSync(path.join(docsDir, f));
        return {
          filename: f,
          size: stats.size,
          lastModified: stats.mtime,
        };
      });

    return res.json({ documents: files, count: files.length });
  } catch (error) {
    logger.error("Documents endpoint error:", error);
    return res.status(500).json({ error: "Failed to list documents." });
  }
});

/**
 * GET /api/health
 * Health check endpoint for monitoring.
 */
app.get("/api/health", async (_req, res) => {
  return res.json({
    status: "ok",
    service: "local-rag-construction-assistant",
    version: "0.2.0",
    config: {
      llmModel: config.ollama.llmModel,
      embeddingModel: config.ollama.embeddingModel,
      chromaCollection: config.chroma.collection,
      chunkSize: config.chunking.chunkSize,
    },
  });
});

/**
 * Start the server and initialize RAG service.
 */
async function main() {
  try {
    logger.info("Initializing RAG service...");
    await ragService.initialize();

    app.listen(config.server.port, config.server.host, () => {
      logger.info(
        `Server running at http://${config.server.host}:${config.server.port}`
      );
      logger.info(`  POST /api/query     — Ask a question`);
      logger.info(`  GET  /api/documents — List knowledge base`);
      logger.info(`  GET  /api/health    — Health check`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
