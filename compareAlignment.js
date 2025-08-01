import fs from 'fs';

const base_path = './project/smallchunk/'
const originalPath = base_path + 'callout_fixed.json';
const realignedPath = base_path + 'callout_realigned.json';
const outputPath = base_path + 'alignment_differences.json';

function loadTranscriptions(path) {
  const raw = fs.readFileSync(path, 'utf8');
  const json = JSON.parse(raw);

  if (json.result?.output?.[0]?.transcriptions) {
    return json.result.output.flatMap(c => c.transcriptions);
  } else if (Array.isArray(json)) {
    return json;
  } else {
    throw new Error(`Invalid format in ${path}`);
  }
}

function compareAlignments(original, realigned) {
  const differences = [];

  for (let i = 0; i < Math.min(original.length, realigned.length); i++) {
    const orig = original[i];
    const updated = realigned[i];

    const sameText = orig.transcription?.trim() === updated.transcription?.trim();
    const speakerChanged = orig.aligned_speaker !== updated.aligned_speaker;

    if (sameText && speakerChanged) {
      differences.push({
        index: i,
        start: orig.start,
        end: orig.end,
        text: orig.transcription,
        original: orig.aligned_speaker,
        updated: updated.aligned_speaker,
      });
    }
  }

  return differences;
}

// Utility functions for text analysis
function estimateTokens(text) {
  return Math.ceil((text?.split(/\s+/).length || 0) / 0.75);
}

function countLetters(text) {
  return (text?.match(/[a-zA-Z]/g) || []).length;
}

function countWords(text) {
  return (text?.trim().split(/\s+/).length || 0);
}

function countSentences(text) {
  return (text?.match(/[.!?]+/g) || []).length;
}

function countPunctuation(text) {
  return (text?.match(/[.,!?;:'"()\[\]{}]/g) || []).length;
}

// Comprehensive analysis function that combines all metrics
function generateComprehensiveAnalysis(differences, originalData) {
  const speakerStats = {};
  const speakerTurns = [];
  const speakerMovements = {}; // Track movements between speakers
  let lastSpeaker = null;
  let currentMonologue = { speaker: null, start: null, end: null };
  const overlaps = [];
  const totals = {
    segments: 0,
    totalDuration: 0,
    tokenCount: 0,
    wordCount: 0,
    letterCount: 0,
    sentenceCount: 0,
    punctuationCount: 0
  };

  // Process each difference
  for (let i = 0; i < differences.length; i++) {
    const { start, end, text, updated } = differences[i];
    const duration = end - start;
    const tokens = estimateTokens(text);
    const words = countWords(text);
    const letters = countLetters(text);
    const sentences = countSentences(text);
    const punct = countPunctuation(text);

    // Initialize speaker stats if needed
    if (!speakerStats[updated]) {
      speakerStats[updated] = {
        segments: 0,
        totalDuration: 0,
        totalWords: 0,
        totalTokens: 0,
        totalLetters: 0,
        totalSentences: 0,
        totalPunctuation: 0,
        confidenceSum: 0,
        confidenceCount: 0,
        monologues: [],
        allWords: [],
        timeRanges: []
      };
    }

    const stats = speakerStats[updated];
    stats.segments++;
    stats.totalDuration += duration;
    stats.totalWords += words;
    stats.totalTokens += tokens;
    stats.totalLetters += letters;
    stats.totalSentences += sentences;
    stats.totalPunctuation += punct;
    stats.allWords.push(...text.split(/\s+/));
    stats.timeRanges.push({ start, end, duration });

    // Update totals
    totals.segments++;
    totals.totalDuration += duration;
    totals.tokenCount += tokens;
    totals.letterCount += letters;
    totals.wordCount += words;
    totals.sentenceCount += sentences;
    totals.punctuationCount += punct;

    // Get confidence from original data
    const originalSegment = originalData[differences[i].index];
    if (originalSegment?.confidence != null) {
      stats.confidenceSum += originalSegment.confidence;
      stats.confidenceCount++;
    }

    // Detect speaker turns and track movements
    if (updated !== lastSpeaker) {
      speakerTurns.push({ from: lastSpeaker, to: updated, time: start });
      
      // Track movement between speakers
      const fromSpeaker = lastSpeaker || 'Silence';
      const toSpeaker = updated || 'Silence';
      const movementKey = `${fromSpeaker} → ${toSpeaker}`;
      
      if (!speakerMovements[movementKey]) {
        speakerMovements[movementKey] = {
          count: 0,
          from: fromSpeaker,
          to: toSpeaker,
          times: []
        };
      }
      
      speakerMovements[movementKey].count++;
      speakerMovements[movementKey].times.push(start);
      
      lastSpeaker = updated;
    }

    // Detect monologues
    if (currentMonologue.speaker !== updated) {
      if (currentMonologue.speaker) {
        speakerStats[currentMonologue.speaker].monologues.push(currentMonologue.end - currentMonologue.start);
      }
      currentMonologue = { speaker: updated, start, end };
    } else {
      currentMonologue.end = end;
    }

    // Detect overlaps
    for (let j = i + 1; j < differences.length; j++) {
      const next = differences[j];
      if (next.start >= end) break;
      if (next.updated !== updated) {
        overlaps.push({ 
          i, 
          speakerA: updated, 
          speakerB: next.updated, 
          range: [start, next.end],
          duration: next.end - start
        });
      }
    }
  }

  // Finalize current monologue
  if (currentMonologue.speaker) {
    speakerStats[currentMonologue.speaker].monologues.push(currentMonologue.end - currentMonologue.start);
  }

  // Calculate advanced metrics for each speaker
  const advanced = {};
  for (const [speaker, stats] of Object.entries(speakerStats)) {
    const avgDuration = stats.totalDuration / stats.segments;
    const wordsPerSegment = stats.totalWords / stats.segments;
    const tokensPerSecond = stats.totalTokens / stats.totalDuration;
    const longestMonologue = Math.max(...stats.monologues, 0);
    const confidenceAvg = stats.confidenceCount ? stats.confidenceSum / stats.confidenceCount : null;
    const uniqueWords = new Set(stats.allWords.map(w => w.toLowerCase().replace(/[^a-z]/g, '')));
    const vocabularyRichness = uniqueWords.size / stats.allWords.length;
    const avgSegmentLength = stats.totalWords / stats.segments;
    const speakingRate = stats.totalWords / (stats.totalDuration / 60); // words per minute

    advanced[speaker] = {
      averageSegmentDuration: avgDuration,
      wordsPerSegment,
      tokensPerSecond,
      longestMonologue,
      confidenceAvg,
      vocabularyRichness: +vocabularyRichness.toFixed(3),
      avgSegmentLength,
      speakingRate: +speakingRate.toFixed(1),
      totalUniqueWords: uniqueWords.size,
      timeRanges: stats.timeRanges
    };
  }

  return {
    summary: speakerStats,
    totals,
    advanced,
    speakerTurnCount: speakerTurns.length,
    overlapCount: overlaps.length,
    speakerTurns: speakerTurns.slice(0, 10), // Top 10 turns
    overlaps: overlaps.slice(0, 5), // Top 5 overlaps
    speakerMovements: speakerMovements, // All speaker movements
    analysis: {
      totalDuration: totals.totalDuration,
      averageSegmentDuration: totals.totalDuration / totals.segments,
      totalWords: totals.wordCount,
      averageWordsPerSegment: totals.wordCount / totals.segments,
      speakingRate: totals.wordCount / (totals.totalDuration / 60)
    }
  };
}

function generateModernMarkdownReport(analysis) {
  const { summary, totals, advanced, speakerTurnCount, overlapCount, speakerTurns, overlaps, speakerMovements, analysis: overallAnalysis } = analysis;
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  const formatPercentage = (value, total) => {
    return ((value / total) * 100).toFixed(1);
  };

  const getSpeakerColor = (index) => {
    const colors = ['🔵', '🟢', '🟡', '🟠', '🔴', '🟣', '⚪', '⚫'];
    return colors[index % colors.length];
  };

  const speakers = Object.keys(summary);
  
  return `# 🎙️ Speaker Alignment Analysis Report

## 📊 Executive Summary

> **Analysis completed on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}**

### 🎯 Key Metrics
- **Total Segments**: ${totals.segments.toLocaleString()}
- **Total Duration**: ${formatTime(totals.totalDuration)}
- **Total Words**: ${totals.wordCount.toLocaleString()}
- **Speaker Turns**: ${speakerTurnCount}
- **Overlaps Detected**: ${overlapCount}

### 📈 Speaking Patterns
- **Average Segment Duration**: ${overallAnalysis.averageSegmentDuration.toFixed(2)}s
- **Average Words per Segment**: ${overallAnalysis.averageWordsPerSegment.toFixed(1)}
- **Overall Speaking Rate**: ${overallAnalysis.speakingRate.toFixed(1)} words/minute

### 🔄 Most Common Speaker Transitions
${Object.entries(speakerMovements)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 5) // Top 5 most common transitions
  .map(([movement, data], index) => {
    const percentage = ((data.count / speakerTurnCount) * 100).toFixed(1);
    return `${index + 1}. **${movement}**: ${data.count} times (${percentage}%)`;
  }).join('\n')}

---

## 👥 Speaker Breakdown

${speakers.map((speaker, index) => {
  const stats = summary[speaker];
  const adv = advanced[speaker];
  const color = getSpeakerColor(index);
  
  return `### ${color} ${speaker}

| Metric | Value | Percentage |
|--------|-------|------------|
| **Segments** | ${stats.segments} | ${formatPercentage(stats.segments, totals.segments)}% |
| **Duration** | ${formatTime(stats.totalDuration)} | ${formatPercentage(stats.totalDuration, totals.totalDuration)}% |
| **Words** | ${stats.totalWords.toLocaleString()} | ${formatPercentage(stats.totalWords, totals.wordCount)}% |
| **Tokens** | ${stats.totalTokens.toLocaleString()} | - |
| **Sentences** | ${stats.totalSentences} | - |

#### 📊 Advanced Metrics
- **Average Segment Duration**: ${adv.averageSegmentDuration.toFixed(2)}s
- **Words per Segment**: ${adv.wordsPerSegment.toFixed(1)}
- **Speaking Rate**: ${adv.speakingRate} words/minute
- **Longest Monologue**: ${formatTime(adv.longestMonologue)}
- **Vocabulary Richness**: ${(adv.vocabularyRichness * 100).toFixed(1)}%
- **Unique Words**: ${adv.totalUniqueWords}
${adv.confidenceAvg ? `- **Average Confidence**: ${(adv.confidenceAvg * 100).toFixed(1)}%` : ''}

---
`;
}).join('\n')}

## 🔄 Speaker Turn Analysis

### 📊 Speaker Movement Statistics
| Movement | Count | Percentage |
|----------|-------|------------|
${Object.entries(speakerMovements)
  .sort((a, b) => b[1].count - a[1].count) // Sort by count descending
  .map(([movement, data]) => {
    const percentage = ((data.count / speakerTurnCount) * 100).toFixed(1);
    return `| **${movement}** | ${data.count} | ${percentage}% |`;
  }).join('\n')}

### 📈 Movement Breakdown
${Object.entries(speakerMovements)
  .sort((a, b) => b[1].count - a[1].count)
  .map(([movement, data]) => {
    const percentage = ((data.count / speakerTurnCount) * 100).toFixed(1);
    return `- **${movement}**: ${data.count} times (${percentage}% of all turns)`;
  }).join('\n')}

### Recent Speaker Changes
${speakerTurns.map((turn, index) => {
  const from = turn.from || 'Silence';
  const to = turn.to || 'Silence';
  return `${index + 1}. **${from}** → **${to}** (${formatTime(turn.time)})`;
}).join('\n')}

${overlaps.length > 0 ? `
### 🎭 Overlapping Speech
${overlaps.map((overlap, index) => {
  return `${index + 1}. **${overlap.speakerA}** + **${overlap.speakerB}** (${formatTime(overlap.duration)})`;
}).join('\n')}
` : ''}

---

## 📋 Detailed Statistics

### 📊 Summary Table
| Speaker | Segments | Duration | Words | Tokens | Sentences | Punctuation |
|---------|----------|----------|-------|--------|-----------|-------------|
${speakers.map(speaker => {
  const stats = summary[speaker];
  return `| ${speaker} | ${stats.segments} | ${formatTime(stats.totalDuration)} | ${stats.totalWords.toLocaleString()} | ${stats.totalTokens.toLocaleString()} | ${stats.totalSentences} | ${stats.totalPunctuation} |`;
}).join('\n')}
| **TOTAL** | ${totals.segments} | ${formatTime(totals.totalDuration)} | ${totals.wordCount.toLocaleString()} | ${totals.tokenCount.toLocaleString()} | ${totals.sentenceCount} | ${totals.punctuationCount} |

### 🎯 Performance Metrics
| Metric | Value |
|--------|-------|
| **Total Duration** | ${formatTime(totals.totalDuration)} |
| **Average Segment Duration** | ${overallAnalysis.averageSegmentDuration.toFixed(2)}s |
| **Total Words** | ${totals.wordCount.toLocaleString()} |
| **Average Words per Segment** | ${overallAnalysis.averageWordsPerSegment.toFixed(1)} |
| **Speaking Rate** | ${overallAnalysis.speakingRate.toFixed(1)} words/minute |
| **Speaker Turns** | ${speakerTurnCount} |
| **Overlaps** | ${overlapCount} |

---

*Report generated by Media Transcript Analyzer*`;
}

function compareFieldDifferences(original, realigned, fieldName) {
  const diffs = [];

  for (let i = 0; i < Math.min(original.length, realigned.length); i++) {
    const orig = original[i];
    const updated = realigned[i];

    const origField = orig[fieldName];
    const updatedField = updated[fieldName];

    if (origField !== updatedField) {
      diffs.push({
        index: i,
        start: orig.start,
        end: orig.end,
        text: orig.transcription,
        original: origField,
        updated: updatedField
      });
    }
  }

  return diffs;
}

// Main execution
try {
  const originalData = loadTranscriptions(originalPath);
  const realignedData = loadTranscriptions(realignedPath);

  const diffs = compareAlignments(originalData, realignedData);

  if (diffs.length === 0) {
    console.log('✅ No speaker alignment differences found!');
    fs.writeFileSync(outputPath, JSON.stringify({ message: "No speaker alignment differences found." }, null, 2));
  } else {
    console.log(`🔍 Found ${diffs.length} alignment changes:\n`);

    // Write differences to JSON file
    fs.writeFileSync(outputPath, JSON.stringify(diffs, null, 2));
    console.log(`📝 Differences written to: ${outputPath}`);

         // Compare speaker field differences
     const speakerFieldDiffs = compareFieldDifferences(originalData, realignedData, 'speaker');
     if (speakerFieldDiffs.length > 0) {
       const speakerDiffPath = base_path + 'speaker_field_differences.json';
       fs.writeFileSync(speakerDiffPath, JSON.stringify(speakerFieldDiffs, null, 2));
       console.log(`📁 Speaker field differences written to: ${speakerDiffPath}`);
     } else {
       console.log('✅ No differences in speaker field');
     }

     // Generate comprehensive analysis
     const comprehensiveAnalysis = generateComprehensiveAnalysis(diffs, originalData);

     // Save comprehensive analysis JSON
     const analysisPath = base_path + 'alignment_comprehensive_analysis.json';
     fs.writeFileSync(analysisPath, JSON.stringify(comprehensiveAnalysis, null, 2));
     console.log(`📊 Comprehensive analysis written to: ${analysisPath}`);

     // Generate and save modern markdown report
     const markdown = generateModernMarkdownReport(comprehensiveAnalysis);
     const mdPath = base_path + 'alignment_summary.md';
     fs.writeFileSync(mdPath, markdown);
     console.log(`📘 Modern markdown report written to: ${mdPath}`);

     // Also save legacy summary for compatibility
     const legacySummary = {
       summary: comprehensiveAnalysis.summary,
       totals: comprehensiveAnalysis.totals
     };
     const summaryPath = base_path + 'alignment_summary.json';
     fs.writeFileSync(summaryPath, JSON.stringify(legacySummary, null, 2));
     console.log(`📊 Legacy summary JSON written to: ${summaryPath}`);
  }
} catch (err) {
  console.error('❌ Comparison failed:', err.message);
}
  