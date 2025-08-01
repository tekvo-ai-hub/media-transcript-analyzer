import fs from 'fs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const SUPABASE_EDGE_URL = process.env.SUPABASE_EDGE_URL;
if (!SUPABASE_EDGE_URL) throw new Error('❌ SUPABASE_EDGE_URL is missing in .env');

const base_path = './project/smallchunk/'
const inputPath = base_path + 'callout_fixed.json';
const finalOutputPath = base_path + 'callout_realigned.json';
const partialOutputPath = base_path + 'callout_realigned_partial.json';
const BATCH_FOLDER = base_path + 'realigned_batches';
const BATCH_SIZE = 50;
const OVERLAP = 10;

function estimateTokens(text) {
    return Math.ceil(text.split(' ').length / 0.75);
  }
  
  function createTokenBasedBatches(segments, maxTokens = 3000, overlapRatio = 0.25) {
    const batches = [];
    let batch = [];
    let tokenCount = 0;
    let i = 0;
  
    while (i < segments.length) {
      const segment = segments[i];
      const segmentTokens = estimateTokens(segment.transcription || '');
  
      if (batch.length > 0 && (tokenCount + segmentTokens) > maxTokens) {
        // Add current batch and prepare next with overlap
        const overlapSize = Math.floor(batch.length * overlapRatio);
        const overlapSegments = batch.slice(-overlapSize);
        batches.push(batch);
        batch = [...overlapSegments];
        tokenCount = overlapSegments.reduce((sum, seg) =>
          sum + estimateTokens(seg.transcription || ''), 0
        );
      }
  
      batch.push(segment);
      tokenCount += segmentTokens;
      i++;
    }
  
    if (batch.length >= 2) {
      batches.push(batch);
    }
  
    return batches;
  }
  

function loadSegmentsFromFile() {
  const raw = fs.readFileSync(inputPath, 'utf-8');
  const json = JSON.parse(raw);
  return json.result.output.flatMap(chunk => chunk.transcriptions);
}

function createBatches(segments, batchSize = BATCH_SIZE, overlap = OVERLAP) {
  const batches = [];
  for (let i = 0; i < segments.length; i += (batchSize - overlap)) {
    const batch = segments.slice(i, i + batchSize);
    if (batch.length < batchSize) break;
    batches.push(batch);
  }
  return batches;
}

function convertToTextOnly(segments) {
  return segments.map(s => ({
    speaker: s.speaker || 'Unknown',
    text: s.transcription,
  }));
}

async function realignBatch(batch) {
  const payload = { segments: convertToTextOnly(batch) };

  const res = await fetch(SUPABASE_EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  return data;

}

async function realignAllSegments() {
  const originalSegments = loadSegmentsFromFile();
//   const batches = createTokenBasedBatches(originalSegments, 8192, 0.3);
const batches = createBatches(originalSegments);

  if (!fs.existsSync(BATCH_FOLDER)) fs.mkdirSync(BATCH_FOLDER);

  const realigned = [];

  for (let i = 0; i < batches.length; i++) {
    console.log(`🔄 Processing batch ${i + 1} of ${batches.length}`);
    const startTime = Date.now(); // Start timer
  
    try {
      const result = await realignBatch(batches[i]);
      const keepStart = i === 0 ? 0 : OVERLAP;
  
      for (let j = keepStart; j < result.length; j++) {
        const originalIndex = i * (BATCH_SIZE - OVERLAP) + j;
        if (originalIndex < originalSegments.length) {
          originalSegments[originalIndex].aligned_speaker = result[j].speaker;
        }
      }
  
      // ✅ Save per-batch result
      const batchFileName = `realigned_batch_${String(i + 1).padStart(3, '0')}.json`;
      fs.writeFileSync(path.join(BATCH_FOLDER, batchFileName), JSON.stringify(result, null, 2));
      console.log(`📄 Saved batch to: ${batchFileName}`);
  
      // ✅ Save partial alignment result
      fs.writeFileSync(partialOutputPath, JSON.stringify(originalSegments, null, 2));
      console.log(`💾 Intermediate result saved to: ${partialOutputPath}`);
  
      const timeTakenSec = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`⏱️ Batch ${i + 1} processed in ${timeTakenSec} seconds\n`);
    } catch (err) {
      console.error(`❌ Failed batch ${i + 1}:`, err.message);
    }
  }
  

  // ✅ Final save
  fs.writeFileSync(finalOutputPath, JSON.stringify(originalSegments, null, 2));
  console.log(`✅ Realignment complete. Final output saved to: ${finalOutputPath}`);
}

realignAllSegments();
