import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { logger } from "../utils/logger";
import { config } from "../config";
import type { ParsedDocument } from "./document-loader";

export interface ChunkMetadata {
  source: string;
  chunkIndex: number;
  totalChunks: number;
  documentTitle: string;
  pageEstimate: number;
}

/**
 * Chunking service — splits parsed documents into overlapping chunks
 * suitable for embedding and vector search.
 *
 * Current strategy: RecursiveCharacterTextSplitter with paragraph → sentence
 * → word fallback hierarchy. Works well for prose-heavy documents like
 * legal texts and safety regulations.
 *
 * TODO (issue #3): Implement table-aware chunking for bill-of-quantities
 * documents where tabular data loses structure with character-based splitting.
 * Possible approaches:
 *   1. Pre-detect tables via regex, extract as structured JSON, embed separately
 *   2. Use unstructured.io partition_pdf for layout-aware extraction
 *   3. Larger chunk sizes (2000+) for table-heavy sections
 */
export class ChunkingService {
  private splitter: RecursiveCharacterTextSplitter;

  constructor(
    chunkSize: number = config.chunking.chunkSize,
    chunkOverlap: number = config.chunking.chunkOverlap
  ) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: [
        "\n\n",  // Paragraph breaks (highest priority)
        "\n",    // Line breaks
        ". ",    // Sentence boundaries
        ", ",    // Clause boundaries
        " ",     // Words
        "",      // Characters (last resort)
      ],
      lengthFunction: (text: string) => text.length,
    });

    logger.info(
      `ChunkingService initialized: size=${chunkSize}, overlap=${chunkOverlap}`
    );
  }

  /**
   * Split a single document into chunks with metadata.
   */
  async chunkDocument(doc: ParsedDocument): Promise<Document<ChunkMetadata>[]> {
    const rawChunks = await this.splitter.splitText(doc.content);

    const documents = rawChunks.map((text, index) => {
      // Estimate which page this chunk is from based on position
      const charPosition = doc.content.indexOf(text);
      const pageEstimate = Math.ceil(
        (charPosition / doc.content.length) * doc.pageCount
      );

      return new Document<ChunkMetadata>({
        pageContent: text,
        metadata: {
          source: doc.filename,
          chunkIndex: index,
          totalChunks: rawChunks.length,
          documentTitle: doc.metadata.title,
          pageEstimate: Math.max(1, pageEstimate),
        },
      });
    });

    logger.info(
      `Chunked "${doc.filename}": ${documents.length} chunks ` +
        `(avg ${Math.round(doc.content.length / documents.length)} chars/chunk)`
    );

    return documents;
  }

  /**
   * Chunk all documents, returning a flat array ready for embedding.
   */
  async chunkAll(docs: ParsedDocument[]): Promise<Document<ChunkMetadata>[]> {
    const allChunks: Document<ChunkMetadata>[] = [];

    for (const doc of docs) {
      const chunks = await this.chunkDocument(doc);
      allChunks.push(...chunks);
    }

    logger.info(
      `Total chunks across ${docs.length} documents: ${allChunks.length}`
    );
    return allChunks;
  }

  /**
   * Get chunk statistics for debugging / quality evaluation.
   */
  getChunkStats(chunks: Document<ChunkMetadata>[]): {
    count: number;
    avgLength: number;
    minLength: number;
    maxLength: number;
    bySource: Record<string, number>;
  } {
    const lengths = chunks.map((c) => c.pageContent.length);
    const bySource: Record<string, number> = {};

    for (const chunk of chunks) {
      const src = chunk.metadata.source;
      bySource[src] = (bySource[src] || 0) + 1;
    }

    return {
      count: chunks.length,
      avgLength: Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length),
      minLength: Math.min(...lengths),
      maxLength: Math.max(...lengths),
      bySource,
    };
  }
}
