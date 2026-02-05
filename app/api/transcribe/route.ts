import { NextResponse } from "next/server";
import { withOpenAIClient } from "@/lib/openai-client";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const model = formData.get("model") as string || "gemini-3-flash-preview";
    const endpoint = formData.get("endpoint") as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log("Transcribe Request:", { model });

    // Convert file to base64
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Audio = buffer.toString("base64");

    // Determine format from file type or extension
    let format = "wav";
    if (file.type.includes("mp3")) format = "mp3";
    else if (file.type.includes("mp4")) format = "mp4"; // aac
    else if (file.type.includes("aac")) format = "aac";
    else if (file.type.includes("ogg")) format = "ogg";
    else if (file.type.includes("flac")) format = "flac";
    // Detect from extension if mime check is ambiguous or generic
    else if (file.name.endsWith(".wav")) format = "wav";
    else if (file.name.endsWith(".mp3")) format = "mp3";
    else if (file.name.endsWith(".mp4")) format = "mp4";
    else if (file.name.endsWith(".webm")) format = "webm"; // Not officially supported by all, but pass it if present

    const text = await withOpenAIClient(async (openai) => {
      const response = await openai.chat.completions.create({
        model: model,
        messages: [
          {
             role: "user",
             content: [
               { type: "text", text: "Transcribe the audio exactly. Output only the text." },
               {
                 type: "input_audio",
                 input_audio: {
                   data: base64Audio,
                   format: format,
                 }
               }
             ] as any,
          }
        ],
      });
      return response.choices[0].message.content;
    }, "transcribe", endpoint);

    return NextResponse.json({ text });
  } catch (error: unknown) {
    console.error("Transcription failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to transcribe audio";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
