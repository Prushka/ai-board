import { NextResponse } from "next/server";
import { withOpenAIClient } from "@/lib/openai-client";

export async function POST(req: Request) {
  const { text, targetLanguage, model } = await req.json();

  if (!text || !targetLanguage || !model) {
    return NextResponse.json(
      { error: "Missing required fields: text, targetLanguage, model" },
      { status: 400 }
    );
  }

  try {
    const translatedText = await withOpenAIClient(async (openai) => {
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Detect the language of the provided text and translate it into ${targetLanguage}. Output ONLY the translated text, do not include any explanations or surrounding quotes.`,
          },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.3,
      });
      return completion.choices[0].message.content;
    });

    return NextResponse.json({ translatedText });
  } catch (error: any) {
    console.error("Error translating text:", error);
    return NextResponse.json(
      { error: error.message || "Failed to translate text" },
      { status: 500 }
    );
  }
}
