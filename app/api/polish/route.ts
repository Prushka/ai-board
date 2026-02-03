import { NextResponse } from "next/server";
import { withOpenAIClient } from "@/lib/openai-client";

export async function POST(req: Request) {
  const { text, model } = await req.json();

  if (!text || !model) {
    return NextResponse.json(
      { error: "Missing required fields: text, model" },
      { status: 400 }
    );
  }

  try {
    const polishedText = await withOpenAIClient(async (openai) => {
      const systemContent = `You are a professional writing assistant. 
      Task:
      1. Polish the input text to fix grammar, improve clarity, and ensure natural flow.
      2. Punctuation: Fix any punctuation errors.
      3. Tone: Preserve the original tone (e.g., if it's casual, keep it casual; if formal, keep it formal).
      4. Output: Return specific JSON format.
      
      JSON Structure:
      {
        "polishedText": "The improved version of the text",
        "changes": [
           { "original": "text part", "change": "reason for change" } 
        ]
      }
      
      Note on changes: "changes" array is optional, mainly translate/polish usage. Actually for now let's just return text and maybe explanation if needed but the UI just shows text. Let's stick to text for simplicity unless I want to show diffs. The user asked for "different UI", let's make it simple first.
      
      Wait, the Translator uses a specific JSON structure for tokens.
      For Polisher, maybe we just want the text? 
      "Output ONLY the polished text" was user's previous style request for translator before we added tokens.
      The user request for polisher: "fixes grammar, keeps the tone, and makes it more natural".
      
      Let's use JSON to be safe and extendable.
      
      JSON Structure:
      {
        "polishedText": "The polished text"
      }
      `;

      const completion = await openai.chat.completions.create({
        model: model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: systemContent,
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
      });
      return completion.choices[0].message.content;
    }, model);

    const parsedData = JSON.parse(polishedText || "{}");
    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error("Error polishing text:", error);
    return NextResponse.json(
      { error: error.message || "Failed to polish text" },
      { status: 500 }
    );
  }
}
