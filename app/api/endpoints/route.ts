import { NextResponse } from "next/server";
import { getEndpoints, EndpointPublic } from "@/lib/endpoints";

export async function GET() {
    const endpoints = getEndpoints();
    const publicEndpoints: EndpointPublic[] = endpoints.map(e => ({
        id: e.id,
        name: e.name,
        defaultModel: e.defaultModel
    }));
    return NextResponse.json(publicEndpoints);
}
