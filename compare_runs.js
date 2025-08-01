import fs from 'fs';
import path from 'path';

const run1Path = './project/bigchunk/callout_realigned.json';
const run2Path = './project/smallchunk/callout_realigned.json';

function loadSegments(p) {
  const raw = fs.readFileSync(p, 'utf8');
  const json = JSON.parse(raw);
  return Array.isArray(json)
    ? json
    : json.result?.output?.flatMap(c => c.transcriptions) || [];
}

function compareSegments(run1, run2) {
  const diffs = [];
  const alignedSpeakerDiffs = [];
  const speakerDiffs = [];

  for (let i = 0; i < Math.min(run1.length, run2.length); i++) {
    const seg1 = run1[i];
    const seg2 = run2[i];

    const sameText = seg1.transcription?.trim() === seg2.transcription?.trim();
    if (!sameText) continue;

    if (seg1.aligned_speaker !== seg2.aligned_speaker) {
      alignedSpeakerDiffs.push({
        index: i,
        text: seg1.transcription,
        run1: seg1.aligned_speaker,
        run2: seg2.aligned_speaker
      });
    }

    if (seg1.speaker !== seg2.speaker) {
      speakerDiffs.push({
        index: i,
        text: seg1.transcription,
        run1: seg1.speaker,
        run2: seg2.speaker
      });
    }

    if (seg1.aligned_speaker !== seg2.aligned_speaker || seg1.speaker !== seg2.speaker) {
      diffs.push({ index: i, text: seg1.transcription, run1: seg1, run2: seg2 });
    }
  }

  return { diffs, alignedSpeakerDiffs, speakerDiffs };
}

function generateMarkdown(diffs, aligned, speaker) {
  const lines = [
    '# 🔍 Realignment Comparison Report',
    '',
    `**Total Matching Segments:** ${diffs.length}`,
    `**Aligned Speaker Differences:** ${aligned.length}`,
    `**Original Speaker Differences:** ${speaker.length}`,
    '',
    '## 🎙️ Sample Aligned Speaker Differences',
    '',
    '| Index | Text | Run 1 | Run 2 |',
    '|-------|------|-------|-------|',
    ...aligned.slice(0, 10).map(d =>
      `| ${d.index} | ${d.text.slice(0, 60)} | ${d.run1} | ${d.run2} |`
    )
  ];
  return lines.join('\n');
}

try {
  const segs1 = loadSegments(run1Path);
  const segs2 = loadSegments(run2Path);

  const { diffs, alignedSpeakerDiffs, speakerDiffs } = compareSegments(segs1, segs2);

  fs.writeFileSync('./comparison_differences.json', JSON.stringify(diffs, null, 2));
  fs.writeFileSync('./comparison_aligned_diffs.json', JSON.stringify(alignedSpeakerDiffs, null, 2));
  fs.writeFileSync('./comparison_speaker_diffs.json', JSON.stringify(speakerDiffs, null, 2));

  const md = generateMarkdown(diffs, alignedSpeakerDiffs, speakerDiffs);
  fs.writeFileSync('./comparison_report.md', md);

  console.log('✅ Comparison complete. Reports saved.');
} catch (err) {
  console.error('❌ Failed to generate comparison:', err.message);
}
