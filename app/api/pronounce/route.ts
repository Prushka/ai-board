import { NextResponse } from "next/server";
import { withOpenAIClient } from "@/lib/openai-client";

export async function POST(req: Request) {
  const { text, language, model, endpoint, isFastMode, previousLanguage } = await req.json();

  console.log("Pronounce Request:", {
    text: text?.substring(0, 100) + (text?.length > 100 ? "..." : ""),
    language,
    previousLanguage,
    isFastMode,
    model
  });

  if (!text || !language || !model) {
    return NextResponse.json(
      { error: "Missing required fields: text, language, model" },
      { status: 400 }
    );
  }

  try {
    const responseData = await withOpenAIClient(async (openai) => {
      const languageInstruction = previousLanguage
        ? `The input text can be in either "${language}" or "${previousLanguage}". Detect the language.`
        : `The input text is in language "${language}".`;

      const systemContent = `You are a linguistic expert.
      Task:
      ${languageInstruction}
      Analyze the text and provide tokenization and pronunciation.

      Output:
      Provide the output in strictly valid JSON format.

      JSON Structure:
      {
        "tokens": [
          { "text": "word_or_char", "pronunciation": "pinyin_or_phonetic" }
        ]
      }

      Rules for "tokens":
      - Split the text into meaningful tokens (words for whitespace languages, characters or compound words for CJK).
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
        ...(isFastMode ? { reasoning_effort: "minimal" } : {}),
      });
      return completion.choices[0].message.content;
    }, model, endpoint);

    // Parse the JSON string from OpenAI
    const parsedData = JSON.parse(responseData || "{}");

    return NextResponse.json(parsedData);
  } catch (error: unknown) {
    console.error("Error pronouncing text:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate pronunciation";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
