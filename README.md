# Media Transcript Analyzer

A powerful tool for batch-correcting speaker alignment in media transcripts using AI-powered analysis. This project combines Supabase Edge Functions with Together AI to automatically realign speaker labels in conversation transcripts.

## 🎯 Features

- **AI-Powered Speaker Realignment**: Uses Together AI's DeepSeek model to intelligently correct speaker labels
- **Batch Processing**: Processes large transcripts in configurable batches with overlap for consistency
- **Supabase Edge Function Integration**: Scalable serverless processing via Supabase Edge Functions
- **Comparison Tools**: Compare different realignment runs to analyze differences
- **Token-Based Batching**: Smart batching based on token count to optimize AI processing
- **Retry Logic**: Robust error handling with automatic retries for failed requests

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Input JSON    │───▶│  Batch Processor │───▶│ Supabase Edge   │
│   Transcripts    │    │  (Token-based)   │    │   Function      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Output JSON    │◀───│  Response Parser │◀───│  Together AI    │
│  Realigned      │    │  & Validator     │    │  DeepSeek Model │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

- Node.js (v16 or higher)
- Supabase account with Edge Functions enabled
- Together AI API key
- Environment variables configured

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy the example environment file and configure your credentials:

```bash
cp example.env .env
```

Edit `.env` with your actual values:

```env
SUPABASE_EDGE_URL=your_supabase_edge_function_url
SUPABASE_ANON_KEY=your_supabase_anon_key
TOGETHER_API_KEY=your_together_ai_api_key
```

### 3. Prepare Your Data

Place your transcript JSON files in the `project/` directory. The expected format is:

```json
{
  "result": {
    "output": [
      {
        "transcriptions": [
          {
            "speaker": "SPEAKER_01",
            "transcription": "Hello, how are you?",
            "start_time": 0.0,
            "end_time": 2.5
          }
        ]
      }
    ]
  }
}
```

### 4. Run Speaker Realignment

```bash
npm start
```

This will:
- Load transcripts from `project/smallchunk/callout_fixed.json`
- Process them in batches using the Supabase Edge Function
- Save realigned results to `project/smallchunk/callout_realigned.json`

### 5. Compare Results (Optional)

```bash
node compare_runs.js
```

This generates comparison reports between different realignment runs.

## 📁 Project Structure

```
media-transcript-analyzer/
├── diarize.js                 # Main processing script
├── edge-function-diarize.ts   # Supabase Edge Function
├── compare_runs.js            # Comparison analysis tool
├── fixjson.js                 # JSON formatting utility
├── project/                   # Data directory
│   ├── smallchunk/           # Small batch processing results
│   └── bigchunk/             # Large batch processing results
├── package.json
└── README.md
```

## ⚙️ Configuration

### Batch Processing Settings

In `diarize.js`, you can adjust:

- `BATCH_SIZE`: Number of segments per batch (default: 50)
- `OVERLAP`: Overlap between batches (default: 10)
- `maxTokens`: Maximum tokens per batch for AI processing (default: 3000)

### AI Model Settings

In `edge-function-diarize.ts`:

- Model: `deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free`
- Temperature: 0.3 (for consistent results)
- Max retries: 3

## 🔧 Available Scripts

- `npm start`: Run the main speaker realignment process
- `npm run fixjson`: Fix JSON formatting issues
- `node compare_runs.js`: Compare different realignment runs

## 📊 Output Files

### Main Output
- `callout_realigned.json`: Final realigned transcript with corrected speaker labels
- `callout_realigned_partial.json`: Partial results during processing

### Comparison Reports
- `comparison_report.md`: Human-readable comparison summary
- `comparison_differences.json`: Detailed differences between runs
- `comparison_aligned_diffs.json`: Speaker alignment differences
- `comparison_speaker_diffs.json`: Original speaker differences

## 🤖 AI Processing

The system uses Together AI's DeepSeek model to:

1. **Analyze Context**: Understand conversation flow and speaker patterns
2. **Correct Labels**: Fix incorrect speaker assignments based on context
3. **Maintain Consistency**: Ensure speaker labels are consistent throughout the transcript
4. **Handle Edge Cases**: Deal with overlapping speech, interruptions, and unclear segments

## 🔍 Quality Assurance

The comparison tools help you:

- **Validate Results**: Compare different processing runs
- **Identify Patterns**: Find systematic issues in speaker labeling
- **Measure Accuracy**: Quantify improvements in speaker alignment
- **Debug Issues**: Pinpoint specific segments with problems

## 🛠️ Troubleshooting

### Common Issues

1. **Missing Environment Variables**
   ```
   ❌ SUPABASE_EDGE_URL is missing in .env
   ```
   Solution: Ensure all required environment variables are set in `.env`

2. **API Rate Limits**
   ```
   Error 429: Too Many Requests
   ```
   Solution: Reduce batch size or add delays between requests

3. **JSON Parsing Errors**
   ```
   Failed to parse AI response
   ```
   Solution: Check the AI model response format and adjust parsing logic

### Debug Mode

Enable detailed logging by modifying the console output in `diarize.js`:

```javascript
console.log(`Processing batch ${i + 1}/${batches.length}`);
```

## 📈 Performance Tips

- **Batch Size**: Larger batches are more efficient but may hit token limits
- **Overlap**: More overlap improves consistency but increases processing time
- **Retry Logic**: The system automatically retries failed requests
- **Token Management**: The system estimates tokens to optimize batch sizes

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with sample data
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Supabase** for Edge Functions infrastructure
- **Together AI** for the DeepSeek model
- **Node.js** community for the excellent ecosystem

---

**Note**: This tool is designed for processing media transcripts and may require adjustments for different input formats or specific use cases.
