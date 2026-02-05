import { NextResponse } from "next/server";
import { withOpenAIClient } from "@/lib/openai-client";

export async function POST(req: Request) {
  const { image, endpoint, model } = await req.json();

  console.log("OCR Request:", { model });

  if (!image || !model) {
    return NextResponse.json(
      { error: "Missing image data or model" },
      { status: 400 }
    );
  }

  try {
    const text = await withOpenAIClient(async (openai) => {
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe the text in this image exactly as it appears. Do not translate or interpret it. Output ONLY the text." },
              {
                type: "image_url",
                image_url: {
                  "url": image, // Expecting data:image/jpeg;base64,...
                },
              },
            ],
          },
        ],
      });
      return response.choices[0].message.content;
    }, "ocr", endpoint);

    return NextResponse.json({ text });
  } catch (error: unknown) {
    console.error("OCR failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to extract text from image";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
