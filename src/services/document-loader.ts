import fs from "fs";
import path from "path";
import pdf from "pdf-parse";
import { logger } from "../utils/logger";

export interface ParsedDocument {
  filename: string;
  filepath: string;
  content: string;
  pageCount: number;
  metadata: {
    title: string;
    author: string | null;
    creationDate: string | null;
    fileSize: number;
  };
}

/**
 * Load and parse all PDF documents from the knowledge base directory.
 *
 * Current approach: full-text extraction via pdf-parse.
 * Known limitation: tables (e.g., bill of quantities) lose their
 * column structure. See issue #3 for table-aware extraction plans.
 */
export class DocumentLoader {
  private docsDir: string;

  constructor(docsDir: string) {
    this.docsDir = docsDir;
  }

  /**
   * Discover all PDF files in the docs directory.
   */
  async discoverDocuments(): Promise<string[]> {
    const files = fs.readdirSync(this.docsDir);
    const pdfFiles = files.filter(
      (f) => f.toLowerCase().endsWith(".pdf") && !f.startsWith(".")
    );
    logger.info(`Discovered ${pdfFiles.length} PDF documents in ${this.docsDir}`);
    return pdfFiles.map((f) => path.join(this.docsDir, f));
  }

  /**
   * Parse a single PDF file and extract text content.
   */
  async parseDocument(filepath: string): Promise<ParsedDocument> {
    const filename = path.basename(filepath);
    logger.info(`Parsing document: ${filename}`);

    const buffer = fs.readFileSync(filepath);
    const stats = fs.statSync(filepath);

    try {
      const data = await pdf(buffer);

      const parsed: ParsedDocument = {
        filename,
        filepath,
        content: this.cleanExtractedText(data.text),
        pageCount: data.numpages,
        metadata: {
          title: data.info?.Title || filename.replace(".pdf", ""),
          author: data.info?.Author || null,
          creationDate: data.info?.CreationDate || null,
          fileSize: stats.size,
        },
      };

      logger.info(
        `Parsed "${filename}": ${parsed.pageCount} pages, ${parsed.content.length} chars`
      );
      return parsed;
    } catch (error) {
      logger.error(`Failed to parse ${filename}:`, error);
      throw new Error(`PDF parsing failed for ${filename}: ${error}`);
    }
  }

  /**
   * Parse all documents in the directory.
   */
  async parseAll(): Promise<ParsedDocument[]> {
    const filepaths = await this.discoverDocuments();
    const results: ParsedDocument[] = [];

    for (const fp of filepaths) {
      try {
        const doc = await this.parseDocument(fp);
        results.push(doc);
      } catch (err) {
        logger.error(`Skipping document ${fp}: ${err}`);
      }
    }

    logger.info(`Successfully parsed ${results.length}/${filepaths.length} documents`);
    return results;
  }

  /**
   * Clean raw PDF text output.
   * Fixes common extraction artifacts: excessive whitespace,
   * broken lines, header/footer repetitions.
   */
  private cleanExtractedText(raw: string): string {
    let text = raw;

    // Collapse multiple newlines into double newlines (paragraph breaks)
    text = text.replace(/\n{3,}/g, "\n\n");

    // Fix hyphenation at line breaks (common in PDF extraction)
    text = text.replace(/(\w)-\n(\w)/g, "$1$2");

    // Collapse multiple spaces
    text = text.replace(/ {2,}/g, " ");

    // Trim each line
    text = text
      .split("\n")
      .map((line) => line.trim())
      .join("\n");

    return text.trim();
  }
}
