import { NextResponse } from "next/server";
import { withOpenAIClient } from "@/lib/openai-client";

export async function POST(req: Request) {
  const { text, targetLanguage, model, previousLanguage, endpoint } = await req.json();

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
      5. Provide the output in strictly valid JSON format.

      JSON Structure:
      {
        "translatedText": "The complete translated sentence",
        "tokens": [
          { "text": "word_or_char", "pronunciation": "pinyin_or_phonetic" }
        ]
      }

      Rules for "tokens":
      - Split the translated text into meaningful tokens (words for whitespace languages, characters or compound words for CJK).
      - Include newline characters (\\n) as separate tokens where they appear in the text.
      - "pronunciation":
        - For Chinese: Use Pinyin with tone marks.
        - For Japanese: ALWAYS use Romaji (Latin script). Do NOT use Hiragana or Katakana.
        - For Korean: Use Revised Romanization.
        - For Russian/Kazakh: Use Latin transliteration.
        - For others (e.g. English, French, Spanish): Always use IPA or standard simple phonetic transcription.
        - If punctuation or space, leave pronunciation empty.
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
    }, model, endpoint); // Scope is the model name

    // Parse the JSON string from OpenAI
    const parsedData = JSON.parse(responseData || "{}");

    return NextResponse.json(parsedData);
  } catch (error: unknown) {
    console.error("Error translating text:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to translate text";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
