# Script Summarizer & Topic Extractor

**Industry:** Media

**Repository:** [tekvo-ai-hub/media-transcript-analyzer](https://github.com/tekvo-ai-hub/media-transcript-analyzer)

## Description
Local LLM-powered summarizer and topic extractor for podcasts & video scripts.

## Requirements
### Functional
- Upload transcript.
- Extract summary and themes.
- Support multiple formats.
### Non-Functional
- Runs offline.
- Fast summarization.
- Markdown export.
## Solution Design
**LLM:** Gemma 2B (quantized)
**Vector DB:** ChromaDB

### Components
- Transcript Ingestor
- Topic Extractor
- Summarizer
- Markdown Exporter
### Data Flow
$ TXT → Chunk → Embed → Summarize → Themes → Export

### Tech Stack
- **Frontend:** Electron
- **Backend:** Node.js
- **Storage:** Local FS
- **Deployment:** Electron App
