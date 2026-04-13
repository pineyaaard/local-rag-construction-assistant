import dotenv from "dotenv";
dotenv.config();

export const config = {
  // Ollama (local LLM server)
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    llmModel: process.env.LLM_MODEL || "llama3",
    embeddingModel: process.env.EMBEDDING_MODEL || "nomic-embed-text",
    temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.1"),
    numCtx: parseInt(process.env.LLM_NUM_CTX || "8192", 10),
  },

  // ChromaDB (vector store)
  chroma: {
    url: process.env.CHROMA_URL || "http://localhost:8000",
    collection: process.env.CHROMA_COLLECTION || "construction_docs",
  },

  // Document processing
  chunking: {
    chunkSize: parseInt(process.env.CHUNK_SIZE || "1000", 10),
    chunkOverlap: parseInt(process.env.CHUNK_OVERLAP || "200", 10),
  },

  // RAG retrieval
  retrieval: {
    topK: parseInt(process.env.RETRIEVAL_TOP_K || "4", 10),
    scoreThreshold: parseFloat(process.env.SCORE_THRESHOLD || "0.3"),
  },

  // Server
  server: {
    port: parseInt(process.env.PORT || "3001", 10),
    host: process.env.HOST || "0.0.0.0",
  },

  // Paths
  paths: {
    docsDir: process.env.DOCS_DIR || "./docs",
    chromaPersist: process.env.CHROMA_PERSIST_DIR || "./data/chroma",
  },
} as const;
