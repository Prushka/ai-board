export interface EndpointConfig {
    id: string;
    name: string;
    apiKey: string;
    baseURL: string;
    defaultModel?: string;
}

export interface EndpointPublic {
    id: string;
    name: string;
    defaultModel?: string;
}

export function getEndpoints(): EndpointConfig[] {
    const endpoints: EndpointConfig[] = [];

    // Parse endpoints from OPENAI_ENDPOINTS json env var
    // Format: [{"name": "Local", "url": "...", "key": "...", "defaultModel": "..."}]
    if (process.env.OPENAI_ENDPOINTS) {
        try {
            const parsed = JSON.parse(process.env.OPENAI_ENDPOINTS);
            if (Array.isArray(parsed)) {
                parsed.forEach((ep, index) => {
                    const id = ep.id || `custom-${index}`;
                    if (ep.key && ep.url) {
                        endpoints.push({
                            id: id,
                            name: ep.name || `Endpoint ${index + 1}`,
                            apiKey: ep.key,
                            baseURL: ep.url,
                            defaultModel: ep.defaultModel
                        });
                    }
                });
            }
        } catch (e) {
            console.error("Failed to parse OPENAI_ENDPOINTS", e);
        }
    }

    // Fallback if nothing configured, for dev purposes or preventing crash
    if (endpoints.length === 0) {
        // Just empty or maybe a mock
    }

    return endpoints;
}

export function getEndpoint(id: string): EndpointConfig | undefined {
    const endpoints = getEndpoints();
    return endpoints.find(e => e.id === id) || endpoints[0];
}
