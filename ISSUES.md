## Issue #1 (closed) — Initial project setup
## Labels: setup
## ─────────────────────────────────────────────

**Title:** Project scaffolding: Express + LangChain + TypeScript

Set up the base project:
- [x] TypeScript configuration
- [x] Express server with health endpoint
- [x] LangChain.js + Ollama integration
- [x] ChromaDB client setup
- [x] Environment config module
- [x] Winston logging

---

## ─────────────────────────────────────────────
## Issue #2 (closed) — Document ingestion pipeline
## Labels: feature, core
## ─────────────────────────────────────────────

**Title:** Implement PDF ingestion pipeline

Build the full document processing flow:
- [x] PDF text extraction via `pdf-parse`
- [x] Text cleaning (whitespace, hyphenation, headers)
- [x] RecursiveCharacterTextSplitter with 1000/200 config
- [x] Embedding generation via `nomic-embed-text`
- [x] ChromaDB storage with metadata (source, page, chunk index)
- [x] CLI script (`npm run ingest`)

Tested with 3 initial documents — ingestion takes ~45s on my machine (M2 MacBook). Should be faster on client's servers.

---

## ─────────────────────────────────────────────
## Issue #3 (open) — Table-aware chunking
## Labels: enhancement, chunking
## ─────────────────────────────────────────────

**Title:** Chunking breaks table structure in bill-of-quantities documents

**Problem:**
The `Predmer_i_predracun_radova_Faza_1.pdf` contains detailed cost tables (item description, unit, quantity, price). When processed by `RecursiveCharacterTextSplitter`, table rows get split across chunks, losing the column→value relationship.

Example of a broken chunk:
```
...nabavka, transport i ugradnja betona
C30/37 za temeljnu plocu d=60cm

m3   891,00   18.500,00   16.483.500,00

3.3 Nabavka, secenje i postavljanje armature...
```

The LLM can't reliably answer "What is the unit price for C30/37 concrete?" because the item description and price end up in different chunks or the table structure is flattened.

**Possible solutions:**
1. Pre-detect tables via regex (look for aligned numbers/units), extract as structured JSON, embed as `"C30/37 concrete for foundation slab: 891 m3 × 18,500 RSD = 16,483,500 RSD"` 
2. Use `unstructured` Python library for layout-aware PDF parsing (would need a Python sidecar service)
3. Increase chunk size to 2000+ specifically for table-heavy documents
4. Use `pdfplumber` table extraction as a preprocessing step

Going to prototype option 1 first since it keeps everything in Node.js.

---

## ─────────────────────────────────────────────
## Issue #4 (closed) — Basic RAG query endpoint
## Labels: feature, core
## ─────────────────────────────────────────────

**Title:** Implement RAG query endpoint with Llama 3

- [x] Vector similarity search (top-K retrieval)
- [x] Context building from retrieved chunks
- [x] System prompt for Serbian construction domain
- [x] POST `/api/query` endpoint
- [x] Response includes sources with relevance scores
- [x] Document-filtered search option

---

## ─────────────────────────────────────────────
## Issue #5 (open) — Response quality evaluation
## Labels: testing, quality
## ─────────────────────────────────────────────

**Title:** Build evaluation dataset for response quality testing

Need a systematic way to measure answer quality before deploying to client.

**Plan:**
1. Create a set of 30-50 test questions with expected answers (ground truth from documents)
2. Categories:
   - Factual lookup: "What is the deadline for issuing a building permit?" (exact answer in docs)
   - Numerical: "What is the total cost of earthworks in Phase 1?" (requires reading tables)
   - Cross-document: "What safety equipment is required during foundation work?" (needs to combine safety doc + bill of quantities)
   - Negative: "What is the company's revenue?" (should say "not found in documents")
3. Metrics: answer correctness, source attribution accuracy, response language (should be Serbian)

First 10 test questions drafted — will expand after resolving #3 (table chunking).

---

## ─────────────────────────────────────────────
## Issue #6 (closed) — Serbian text utilities
## Labels: i18n
## ─────────────────────────────────────────────

**Title:** Add Serbian diacritics handling utilities

- [x] Strip diacritics function (č→c, š→s, etc.)
- [x] Query expansion for diacritic variants
- [x] Script detection (Latin vs Cyrillic)
- [x] Construction domain term dictionary

---

## ─────────────────────────────────────────────
## Issue #7 (open) — Diacritics normalization layer
## Labels: bug, i18n
## ─────────────────────────────────────────────

**Title:** Inconsistent diacritics between documents cause retrieval misses

**Problem:**
The `Zakon_o_planiranju_i_izgradnji_2023.pdf` uses ASCII transliteration throughout (`gradjevinska` instead of `građevinska`), while newer documents use proper Unicode diacritics. This means:

- Query "građevinska dozvola" → finds newer docs but misses the law
- Query "gradjevinska dozvola" → finds the law but misses newer docs

Current `expandQueryVariants()` helps but doesn't cover all cases.

**Proposed fix:**
Normalize ALL text to ASCII before embedding (strip diacritics). Store original text in metadata for display. This way both "građevinska" and "gradjevinska" map to the same vector space.

Trade-off: we lose the ability to distinguish č/ć (both map to 'c'), but for this domain it shouldn't cause problems.

---

## ─────────────────────────────────────────────
## Issue #8 (open) — Llama 3 language switching
## Labels: bug, llm
## ─────────────────────────────────────────────

**Title:** Llama 3 8B sometimes switches to English mid-response

When the source context contains mixed Serbian/English text (e.g., technical specs with English abbreviations like "BRGP", "PGD"), Llama 3 8B occasionally generates part of the response in English.

Example query: "Šta je PGD?" → starts in Serbian, then switches:
> "PGD je Projekat za građevinsku dozvolu. It is required for obtaining a building permit and contains..."

System prompt already specifies Serbian output. Options:
1. Stronger prompt enforcement ("NIKADA ne odgovaraj na engleskom")
2. Post-processing: detect language switches and re-query
3. Wait for deployment on Llama 3 70B (better instruction following)

Low priority — happens in ~10% of queries. Will revisit after 70B deployment.
