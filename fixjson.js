import fs from 'fs';

const base_path = './project/bigchunk/'
const inputPath = base_path + 'call out.txt';
const outputPath = base_path + 'callout_fixed.json';

function isJsonObject(line) {
  try {
    JSON.parse(line.trim().replace(/,$/, ''));
    return true;
  } catch {
    return false;
  }
}

function fixTranscriptionsArray(raw) {
  const cleaned = raw.replace(/\u00A0/g, ' '); // Fix non-breaking spaces
  const match = cleaned.match(/"transcriptions":\s*\[/);
  if (!match) throw new Error('Could not locate transcriptions array');

  const startIdx = match.index + match[0].length;
  const endIdx = cleaned.indexOf(']', startIdx); // get till approximate end of array

  // Get potential object blocks
  const arraySlice = cleaned.slice(startIdx, endIdx).trim();

  const lines = arraySlice.split('},').map(s => s.trim() + '}'); // guess at line breaks
  const validObjects = [];

  for (let i = 0; i < lines.length; i++) {
    const objStr = lines[i].replace(/,$/, '').trim();
    if (isJsonObject(objStr)) {
      validObjects.push(JSON.parse(objStr));
    } else {
      console.warn(`⚠️ Skipping invalid entry at index ${i}`);
    }
  }

  return validObjects;
}

try {
  const raw = fs.readFileSync(inputPath, 'utf8');
  const transcriptions = fixTranscriptionsArray(raw);

  const outputJson = {
    id: 'recovered-file',
    result: {
      output: [
        {
          name: 'recovered_chunk.wav',
          transcriptions
        }
      ]
    }
  };

  fs.writeFileSync(outputPath, JSON.stringify(outputJson, null, 2));
  console.log(`✅ Recovered ${transcriptions.length} transcription entries.`);
  console.log(`📁 Output saved to: ${outputPath}`);
} catch (err) {
  console.error('❌ Final clean attempt failed:', err.message);
}
