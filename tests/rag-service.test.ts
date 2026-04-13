/**
 * RAG Service Integration Tests
 *
 * These tests require Ollama and ChromaDB to be running.
 * Run with: npx jest tests/rag-service.test.ts
 *
 * TODO: Add unit tests with mocked vector store and LLM
 * for faster CI pipeline execution.
 */

import { RAGService } from "../src/services/rag-service";
import { DocumentLoader } from "../src/services/document-loader";
import { ChunkingService } from "../src/services/chunking-service";

describe("RAG Service", () => {
  let ragService: RAGService;

  beforeAll(async () => {
    ragService = new RAGService();
    await ragService.initialize();
  }, 30000);

  describe("Document Loading", () => {
    it("should discover PDF files in docs directory", async () => {
      const loader = new DocumentLoader("./docs");
      const files = await loader.discoverDocuments();
      expect(files.length).toBeGreaterThan(0);
      expect(files.every((f) => f.endsWith(".pdf"))).toBe(true);
    });

    it("should parse PDF and extract text content", async () => {
      const loader = new DocumentLoader("./docs");
      const files = await loader.discoverDocuments();
      const doc = await loader.parseDocument(files[0]);

      expect(doc.content.length).toBeGreaterThan(100);
      expect(doc.pageCount).toBeGreaterThan(0);
      expect(doc.filename).toBeTruthy();
    });
  });

  describe("Chunking", () => {
    it("should split document into chunks with overlap", async () => {
      const loader = new DocumentLoader("./docs");
      const docs = await loader.parseAll();
      const chunker = new ChunkingService(1000, 200);
      const chunks = await chunker.chunkAll(docs);

      expect(chunks.length).toBeGreaterThan(docs.length);

      // Each chunk should be <= chunkSize (with some tolerance)
      for (const chunk of chunks) {
        expect(chunk.pageContent.length).toBeLessThanOrEqual(1200);
      }

      // Chunks should have metadata
      for (const chunk of chunks) {
        expect(chunk.metadata.source).toBeTruthy();
        expect(chunk.metadata.chunkIndex).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Query Pipeline", () => {
    it("should answer a question about construction permits", async () => {
      const result = await ragService.query(
        "Koji je rok za izdavanje gradjevinske dozvole?"
      );

      expect(result.answer).toBeTruthy();
      expect(result.answer.length).toBeGreaterThan(20);
      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.metadata.model).toBe("llama3");
    }, 60000);

    it("should answer a question about safety equipment", async () => {
      const result = await ragService.query(
        "Koja licna zastitna oprema je obavezna na gradilistu?"
      );

      expect(result.answer).toBeTruthy();
      expect(result.sources.length).toBeGreaterThan(0);
      // Should reference the safety document
      const safetySource = result.sources.find((s) =>
        s.document.includes("Bezbednost")
      );
      expect(safetySource).toBeTruthy();
    }, 60000);

    it("should return no-answer response for irrelevant queries", async () => {
      const result = await ragService.query(
        "Kolika je trenutna cena bitcoina?"
      );

      // Should indicate the answer is not in documents
      expect(result.answer).toContain("ne mogu");
    }, 60000);

    it("should filter search to specific document", async () => {
      const result = await ragService.queryDocument(
        "Koji su zemljani radovi predvidjeni?",
        "Predmer_i_predracun_radova_Faza_1.pdf"
      );

      expect(result.answer).toBeTruthy();
      // All sources should be from the specified document
      for (const source of result.sources) {
        expect(source.document).toBe("Predmer_i_predracun_radova_Faza_1.pdf");
      }
    }, 60000);
  });
});
