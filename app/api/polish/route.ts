import { NextResponse } from "next/server";
import { withOpenAIClient } from "@/lib/openai-client";

export async function POST(req: Request) {
  const { text, model, endpoint, isFastMode } = await req.json();

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
      4. Structure: Strictly preserve all original line breaks, paragraph breaks, and blank lines. Do not merge lines or paragraphs.
      5. Output: Return only the polished text.
      `;

      const completion = await openai.chat.completions.create({
        model: model,
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
        ...(isFastMode ? { reasoning_effort: "low" } : {}),
      });
      return completion.choices[0].message.content;
    }, model, endpoint);

    return NextResponse.json({ polishedText });
  } catch (error: any) {
    console.error("Error polishing text:", error);
    return NextResponse.json(
      { error: error.message || "Failed to polish text" },
      { status: 500 }
    );
  }
}
