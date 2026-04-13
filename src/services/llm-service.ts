import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { logger } from "../utils/logger";
import { config } from "../config";
import { detectSerbianScript } from "../utils/serbian-text";

/**
 * LLM Service — manages interaction with Llama 3 via Ollama.
 *
 * Key considerations for this project:
 * - Temperature is kept very low (0.1) because we need factual answers
 *   from construction documents, not creative responses.
 * - System prompt enforces Serbian language output and strict adherence
 *   to source material (no hallucination).
 * - Context window: Llama 3 8B supports 8K tokens. With our prompt
 *   template (~500 tokens) and retrieved context (~2000-3000 tokens),
 *   we have ~4K-5K tokens for the response. Sufficient for most queries.
 *
 * For production on the client's A100 cluster, we'll switch to Llama 3 70B
 * which gives better Serbian language understanding and 128K context window.
 */
export class LLMService {
  private llm: ChatOllama;

  constructor() {
    this.llm = new ChatOllama({
      model: config.ollama.llmModel,
      baseUrl: config.ollama.baseUrl,
      temperature: config.ollama.temperature,
      numCtx: config.ollama.numCtx,
    });

    logger.info(
      `LLMService initialized: model=${config.ollama.llmModel}, ` +
        `temp=${config.ollama.temperature}, ctx=${config.ollama.numCtx}`
    );
  }

  /**
   * Generate a response based on retrieved context and user query.
   * This is the "Generation" step in RAG.
   */
  async generateResponse(
    query: string,
    context: string,
    sources: string[]
  ): Promise<{ answer: string; tokensUsed: number }> {
    const queryLang = detectSerbianScript(query);
    const systemPrompt = this.buildSystemPrompt(queryLang);

    const userPrompt = this.buildUserPrompt(query, context, sources);

    logger.debug(`Generating response for: "${query.substring(0, 80)}..."`);
    const startTime = Date.now();

    try {
      const response = await this.llm.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);

      const answer = typeof response.content === "string"
        ? response.content
        : String(response.content);

      const elapsed = Date.now() - startTime;
      logger.info(`LLM response generated in ${elapsed}ms`);

      return {
        answer,
        tokensUsed: answer.split(/\s+/).length * 1.3, // rough estimate
      };
    } catch (error) {
      logger.error("LLM generation failed:", error);
      throw new Error(`Failed to generate response: ${error}`);
    }
  }

  /**
   * Build the system prompt that controls Llama 3's behavior.
   *
   * Critical points:
   * 1. Force Serbian language output (Llama 3 tends to switch to English)
   * 2. Strict grounding — only answer from provided context
   * 3. Cite sources with document names
   * 4. Admit when the answer isn't in the documents
   */
  private buildSystemPrompt(queryLang: "latin" | "cyrillic" | "unknown"): string {
    return `Ti si AI asistent za građevinsko preduzeće u Srbiji. Tvoj zadatak je da odgovaraš na pitanja inženjera i rukovodilaca gradilišta koristeći ISKLJUČIVO informacije iz dostavljenih dokumenata.

PRAVILA:
1. Odgovaraj ISKLJUČIVO na srpskom jeziku (latinica).
2. Koristi SAMO informacije iz priloženog konteksta. Ne izmišljaj podatke.
3. Ako odgovor nije u dokumentima, reci: "Na osnovu dostupne dokumentacije, ne mogu da pronađem odgovor na ovo pitanje."
4. Navedi iz kog dokumenta dolazi informacija (npr. "Prema Zakonu o planiranju i izgradnji...").
5. Za tehničke podatke (mere, rokove, cene) budi precizan — citiraj tačne brojeve iz dokumenata.
6. Koristi profesionalnu terminologiju građevinske struke.
7. Ako je pitanje nejasno, zatraži pojašnjenje.`;
  }

  /**
   * Build the user prompt with retrieved context.
   */
  private buildUserPrompt(
    query: string,
    context: string,
    sources: string[]
  ): string {
    const sourceList = sources
      .map((s, i) => `  ${i + 1}. ${s}`)
      .join("\n");

    return `KONTEKST IZ DOKUMENATA:
---
${context}
---

IZVORI:
${sourceList}

PITANJE KORISNIKA:
${query}

Odgovori na pitanje koristeći isključivo informacije iz priloženog konteksta. Navedi izvor.`;
  }

  /**
   * Health check — verify Ollama is running and model is available.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.llm.invoke([
        new HumanMessage("Odgovori sa jednom rečju: spreman"),
      ]);
      return typeof response.content === "string" && response.content.length > 0;
    } catch {
      return false;
    }
  }
}
