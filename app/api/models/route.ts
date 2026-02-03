import { NextResponse } from "next/server";
import { withOpenAIClient } from "@/lib/openai-client";

export async function GET() {
  try {
    const modelsList = await withOpenAIClient(async (openai) => {
      const response = await openai.models.list();
      return response.data;
    });

    return NextResponse.json(modelsList);
  } catch (error: any) {
    console.error("Error fetching models:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch models" },
      { status: 500 }
    );
  }
}
