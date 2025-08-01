import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const { segments } = await req.json();
    if (!Array.isArray(segments) || segments.length < 2) {
      return new Response(JSON.stringify({
        error: "Request must include at least 2 segments."
      }), { status: 400 });
    }

    const prompt = buildPrompt(segments);
    const parsed = await tryRealignWithRetry(prompt, 3);

    return new Response(JSON.stringify(parsed), {
      headers: {
        "Content-Type": "application/json"
      }
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({
      error: "Internal Server Error"
    }), {
      status: 500
    });
  }
});

function buildPrompt(segments: { speaker: string; text: string }[]) {
  const conversation = segments.map((s) =>
    `${s.speaker || "Unknown"}: ${s.text}`
  ).join("\n");

  return `
  You are a transcription editor. The following conversation has possibly incorrect speaker labels.
  
  🛑 Only return a valid JSON array — do NOT include explanations, comments, or any extra text.
  Format: [{"speaker": "SPEAKER_01", "text": "..."}, ...]
  
  Conversation:
  ${conversation}
  
  Realigned:
  `;
}

async function tryRealignWithRetry(prompt: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await callTogetherAI(prompt);
      return parseAIResponse(response);
    } catch (err) {
      console.warn(`⚠️ Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxRetries) {
        await delay(1000);
      } else {
        throw new Error(err.message); // Sends raw output in error message
      }
    }
  }
}


function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callTogetherAI(prompt: string) {
  const response = await fetch("https://api.together.xyz/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("TOGETHER_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3
    })
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function parseAIResponse(aiText: string) {
  try {
    const jsonStart = aiText.indexOf("[");
    const jsonEnd = aiText.lastIndexOf("]") + 1;

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("No valid JSON array found.");
    }

    const json = aiText.slice(jsonStart, jsonEnd);
    return JSON.parse(json);
  } catch (err) {
    console.error("🧨 Failed to parse AI response. Raw output:");
    console.error(aiText);
    throw new Error("Invalid AI response format.");
  }
}

