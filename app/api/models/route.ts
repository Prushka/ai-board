import { NextResponse } from "next/server";
import { withOpenAIClient } from "@/lib/openai-client";
import { getEndpoint } from "@/lib/endpoints";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const endpointId = searchParams.get('endpoint') || undefined;

  try {
    const modelsList = await withOpenAIClient(async (openai) => {
      const response = await openai.models.list();
      return response.data;
    }, "list-models", endpointId);

    const endpointConfig = getEndpoint(endpointId || 'default');

    return NextResponse.json({
        data: modelsList,
        defaultModel: endpointConfig?.defaultModel
    });
  } catch (error: unknown) {
    console.error("Error fetching models:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch models";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
