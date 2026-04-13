# Local AI Knowledge Assistant for Construction Enterprises

Query 1:



https://github.com/user-attachments/assets/7951ec6f-9afd-4fc5-90e6-121ebabd2792



Query 2:



https://github.com/user-attachments/assets/45023219-eb49-439f-8911-945dbc7a364f



Final Screenshot:

<img width="1512" height="922" alt="Screenshot 2026-04-13 at 18 08 26" src="https://github.com/user-attachments/assets/13d111fb-28c5-40fc-afec-f246fad9c323" />


![Status](https://img.shields.io/badge/status-in%20development-yellow) ![Node](https://img.shields.io/badge/node-20%2B-green) ![Llama](https://img.shields.io/badge/LLM-Llama%203%208B-blue) ![LangChain](https://img.shields.io/badge/orchestration-LangChain.js-orange) ![ChromaDB](https://img.shields.io/badge/vector%20db-ChromaDB-purple) ![TypeScript](https://img.shields.io/badge/lang-TypeScript-blue) ![License](https://img.shields.io/badge/license-private-red)

> **On-premise RAG system** for a Serbian construction company — providing engineers and site managers with instant AI-powered access to technical documentation, safety regulations, and project contracts. All data stays on the local network.

```
Tech Stack:  Node.js 20 · TypeScript · LangChain.js · Llama 3 8B · Ollama · ChromaDB · Express.js
Domain:      Construction / Civil Engineering (Serbia)
Deployment:  On-premise (2× NVIDIA A100 cluster, planned)
Documents:   ~4,000 pages across regulations, contracts, safety manuals, bills of quantities
Language:    Serbian (Latin script) — multilingual retrieval
```

## Project Overview

A large-scale construction company based in Belgrade, Serbia, manages thousands of pages of technical documentation across multiple active sites. Engineers currently waste **2–3 hours daily** searching through PDFs for specific regulations, material specs, and safety requirements.

This system replaces manual document lookup with a **conversational AI interface** that understands context, answers in Serbian, and cites exact source documents — all running on the company's internal servers with zero data leaving the network.

### Why Local / On-Premise?

Construction and infrastructure companies handle sensitive data: project blueprints, government contracts, financial estimates, and employee safety records. Serbian data protection law (*Zakon o zaštiti podataka o ličnosti*, ZZPL) and internal compliance rules prohibit sending this data to external cloud AI services. This system runs entirely on local hardware using open-source models.

## Current Status

### ✅ Completed
- [x] Project architecture and tech stack selection
- [x] Document ingestion pipeline (PDF parsing + text extraction)
- [x] Text chunking with overlap (RecursiveCharacterTextSplitter, 1000/200)
- [x] Local embedding generation via Ollama (`nomic-embed-text`)
- [x] ChromaDB vector store integration (persistent storage)
- [x] Basic RAG chain with Llama 3 (8B) via Ollama
- [x] Express.js API server with query endpoint
- [x] Initial document set: construction law, bill of quantities, safety regulations

### 🔄 In Progress
- [ ] Chunking strategy optimization — testing different chunk sizes for tables vs. prose (#3)
- [ ] Response quality evaluation on domain-specific queries - number 3
- [ ] Serbian language handling improvements (diacritics normalization) - number 7

### 📋 Planned
- [ ] Multi-document cross-referencing (e.g., link safety rules to specific project phases)
- [ ] Web UI for site managers (simple chat interface)
- [ ] Document versioning — track regulation updates across years
- [ ] Role-based access (project managers vs. engineers vs. safety officers)
- [ ] Deployment scripts for client's on-prem cluster (2× NVIDIA A100 nodes)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  REST API    │  │  Web Chat UI │  │  Slack Bot     │  │
│  │  (Express)   │  │  (planned)   │  │  (planned)     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │
│         └─────────────────┼─────────────────┘           │
│                           │                              │
│  ┌────────────────────────▼─────────────────────────┐   │
│  │              RAG Orchestration Layer               │   │
│  │  ┌──────────┐  ┌────────────┐  ┌──────────────┐  │   │
│  │  │  Query    │  │  Context   │  │  Response     │  │   │
│  │  │  Router   │  │  Builder   │  │  Generator    │  │   │
│  │  └────┬─────┘  └─────┬──────┘  └──────┬───────┘  │   │
│  └───────┼──────────────┼────────────────┼───────────┘   │
│          │              │                │               │
│  ┌───────▼──────┐ ┌─────▼──────┐  ┌──────▼───────────┐  │
│  │  ChromaDB    │ │  Chunking  │  │  Llama 3 (8B)    │  │
│  │  Vector DB   │ │  Engine    │  │  via Ollama      │  │
│  └──────────────┘ └────────────┘  └──────────────────┘  │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Document Ingestion Pipeline           │   │
│  │  PDF Parser → Text Extractor → Chunker → Embedder │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | Node.js 20+ (TypeScript) | Client's existing infra, team familiarity |
| AI Orchestration | LangChain.js | Mature RAG abstractions, active community |
| LLM | Llama 3 8B (via Ollama) | Best open-source quality/speed ratio at 8B |
| Embeddings | `nomic-embed-text` (via Ollama) | Strong multilingual performance, runs locally |
| Vector Database | ChromaDB | Simple setup, persistent storage, good for <100k docs |
| PDF Processing | `pdf-parse` | Reliable text extraction from structured PDFs |
| API Layer | Express.js | Lightweight, well-known |
| Future UI | React (Vite) | Planned for Phase 2 |

## Quick Start

### Prerequisites

1. **Node.js 20+** and npm
2. **Ollama** installed and running locally:
   ```bash
   # Install Ollama (Linux)
   curl -fsSL https://ollama.ai/install.sh | sh

   # Pull required models
   ollama pull llama3
   ollama pull nomic-embed-text
   ```
3. **ChromaDB** running:
   ```bash
   # Via Docker
   docker run -d -p 8000:8000 chromadb/chroma
   ```

### Installation

```bash
git clone https://github.com/[username]/local-rag-construction-assistant.git
cd local-rag-construction-assistant
npm install
```

### Configuration

Copy the example environment file and adjust:

```bash
cp .env.example .env
```

Key settings:
```env
OLLAMA_BASE_URL=http://localhost:11434
CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION=construction_docs
LLM_MODEL=llama3
EMBEDDING_MODEL=nomic-embed-text
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
```

### Ingest Documents

```bash
# Process all PDFs in /docs and store embeddings
npx ts-node src/scripts/ingest.ts
```

### Run the Server

```bash
# Development
npx ts-node src/server.ts

# The API will be available at http://localhost:3001
```

### Query Example

```bash
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Koji je rok za izdavanje gradjevinske dozvole?"}'
```

Response:
```json
{
  "answer": "Prema Zakonu o planiranju i izgradnji, nadležni organ je dužan da donese rešenje po zahtevu za izdavanje građevinske dozvole u roku od pet radnih dana od dana podnošenja zahteva.",
  "sources": [
    {
      "document": "Zakon_o_planiranju_i_izgradnji_2023.pdf",
      "page": 3,
      "relevance": 0.92
    }
  ],
  "model": "llama3",
  "processingTime": "2.3s"
}
```

### Live Test Run

Real queries executed against the running system on the initial document set (3 PDFs, ~750 chunks).

**Query 1 — Optical network installation requirements**
```bash
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Za koje objekte je obavezno projektovanje unutrasnjih instalacija za opticku mrezu?"}'
```

```json
{
  "answer": "...(answer referencing work-at-height regulations instead of optical network specs)...",
  "sources": [
    { "document": "Bezbednost_i_zdravlje_na_radu_Gradiliste_Beograd.pdf", "pageEstimate": 13, "relevanceScore": 0.529 },
    { "document": "Predmer_i_predracun_radova_Faza_1.pdf", "pageEstimate": 17, "relevanceScore": 0.503 }
  ],
  "metadata": { "model": "llama3", "processingTimeMs": 20274, "chunksRetrieved": 4 }
}
```

**Query 2 — Minister's prescriptions related to energy passports**
```bash
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "Sta tacno ministar propisuje u vezi sa energetskim pasosima?"}'
```

```json
{
  "answer": "...(answer referencing artificial lighting regulations instead of energy passports)...",
  "sources": [
    { "document": "Bezbednost_i_zdravlje_na_radu_Gradiliste_Beograd.pdf", "pageEstimate": 16, "relevanceScore": 0.385 },
    { "document": "Predmer_i_predracun_radova_Faza_1.pdf", "pageEstimate": 3, "relevanceScore": 0.352 }
  ],
  "metadata": { "model": "llama3", "processingTimeMs": 10292, "chunksRetrieved": 4 }
}
```

#### Test Results Analysis

**What works well:**
- Pipeline is fully operational end-to-end: ingestion → embedding → retrieval → generation
- Source attribution, relevance scoring, and processing time all function correctly
- Response latency is acceptable (~10–20s on CPU, target <3s on A100 cluster)

**Identified issue — Retrieval noise (cross-domain interference):**

Both queries demonstrate a known RAG failure mode: the retrieval step pulls chunks that are statistically similar at the embedding level but semantically irrelevant to the question.

- Query 1 (optical network): Top retrieved chunk was from the safety manual, not the bill of quantities — because construction safety docs share numeric and spatial vocabulary with installation specs.
- Query 2 (energy passports): The current document set contains no dedicated energy passport regulations. The retriever fell back to the closest lexical match (sections mentioning "ministar" and "energetski") from unrelated documents.

**Root causes:**
1. Small document corpus (3 PDFs) — no correct source exists for some queries yet
2. Chunk boundaries split context that should stay together (especially in tables and numbered lists)
3. No reranking step — raw cosine similarity is the only relevance signal

**Planned fixes:** reranking layer - issue number 5, table-aware chunking - issue number 3, corpus expansion with full regulatory dataset in Phase 2.

## Project Structure

```
local-rag-construction-assistant/
├── src/
│   ├── server.ts                 # Express API entry point
│   ├── config/
│   │   └── index.ts              # Environment configuration
│   ├── services/
│   │   ├── rag-service.ts        # Core RAG orchestration
│   │   ├── document-loader.ts    # PDF ingestion & text extraction
│   │   ├── chunking-service.ts   # Text splitting strategies
│   │   ├── vector-store.ts       # ChromaDB operations
│   │   └── llm-service.ts        # Ollama/Llama 3 interface
│   ├── utils/
│   │   ├── serbian-text.ts       # Serbian language utilities
│   │   └── logger.ts             # Structured logging
│   └── scripts/
│       └── ingest.ts             # Document ingestion CLI script
├── docs/                          # Knowledge base (source PDFs)
│   ├── Zakon_o_planiranju_i_izgradnji_2023.pdf
│   ├── Predmer_i_predracun_radova_Faza_1.pdf
│   └── Bezbednost_i_zdravlje_na_radu_Gradiliste_Beograd.pdf
├── tests/
│   └── rag-service.test.ts       # Integration tests
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## Known Issues & Notes

- **Chunking tables**: PDF tables (e.g., bill of quantities) lose structure when split by character count. Investigating table-aware chunking — see issue 3.
- **Serbian diacritics**: Some older documents use ASCII transliteration (`č→c`, `š→s`). Need normalization layer before embedding — see issue 7.
- **Llama 3 8B context window**: 8K tokens limits the amount of context we can pass. Exploring retrieval compression and the 70B model for production deployment on client's A100 cluster.
- **Response language**: Llama 3 sometimes switches to English mid-response when the source document mixes languages. Added system prompt enforcement but not 100% reliable yet.

## License

Private project — not for redistribution.
