import { NextResponse } from "next/server";
import { withOpenAIClient } from "@/lib/openai-client";

export async function POST(req: Request) {
  const { text, targetLanguage, model, previousLanguage, endpoint, isFastMode } = await req.json();

  console.log("Translate Request:", {
    text: text?.substring(0, 100) + (text?.length > 100 ? "..." : ""),
    isFastMode,
    model
  });

  if (!text || !targetLanguage || !model) {
    return NextResponse.json(
      { error: "Missing required fields: text, targetLanguage, model" },
      { status: 400 }
    );
  }

  try {
    const responseData = await withOpenAIClient(async (openai) => {
      const directionInstruction = previousLanguage
        ? `2. Direction: If the detected input language is "${targetLanguage}", translate to "${previousLanguage}". Otherwise, translate to "${targetLanguage}".`
        : `2. Direction: Translate the input text to "${targetLanguage}".`;

      const systemContent = `You are a professional translator.
      Task:
      1. Detect the input language.
      ${directionInstruction}
      3. Quality: Ensure the translation is natural, idiomatic, and conversational.
      4. Structure: Strictly preserve all original line breaks, paragraph breaks, and blank lines. Do not merge lines or paragraphs.
      5. Output only the translated text.`;

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
        ...(isFastMode ? { reasoning_effort: "minimal" } : {}),
      });
      return completion.choices[0].message.content;
    }, model, endpoint); // Scope is the model name

    return NextResponse.json({ translatedText: responseData });
  } catch (error: unknown) {
    console.error("Error translating text:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to translate text";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
