import OpenAI from "openai";
import { getEndpoint } from "@/lib/endpoints";

const BLOCK_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Use globalThis to persist state across hot reloads in development
const globalState = globalThis as unknown as {
  _failedApiKeys: Map<string, number>;
};

if (!globalState._failedApiKeys) {
  globalState._failedApiKeys = new Map<string, number>();
}

export async function withOpenAIClient<T>(
  operation: (client: OpenAI) => Promise<T>,
  scope: string = "global",
  endpointId?: string
): Promise<T> {
  const endpoint = getEndpoint(endpointId || 'default');

  if (!endpoint) {
    throw new Error("No OpenAI endpoint configured");
  }

  const allKeys = endpoint.apiKey.split(",").map((k) => k.trim()).filter(Boolean);
  const baseURL = endpoint.baseURL;

  if (allKeys.length === 0) {
    throw new Error(`OpenAI API key not configured for endpoint '${endpoint.name}'`);
  }

  const now = Date.now();

  // Clean up expired keys for next usage check
  for (const [key, timestamp] of globalState._failedApiKeys.entries()) {
      if (now - timestamp > BLOCK_DURATION) {
          globalState._failedApiKeys.delete(key);
      }
  }

  // Get available keys
  const availableKeys = allKeys.filter((key) => {
      const blockKey = `${key}::${scope}`;
      return !globalState._failedApiKeys.has(blockKey)
  });

  if (availableKeys.length === 0) {
    throw new Error(`All API keys are currently blocked for scope '${scope}' or unavailable due to previous errors for endpoint '${endpoint.name}'.`);
  }

  let lastError: any;

  for (const apiKey of availableKeys) {
    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
            timeout: 30 * 1000,
            maxRetries: 0,
      });

      return await operation(openai);
    } catch (error: any) {
        lastError = error;
        console.error(`Operation failed with key ending in ...${apiKey.slice(-4)} for scope '${scope}':`, error.message || error);

        // Determine if error warrants switching keys
        // 401: Unauthorized (Invalid Key)
        // 429: Too Many Requests (Rate Limit or Quota)
        // 403: Forbidden (Access Denied)
        // insufficient_quota: OpenAI specific
        const status = error?.status || error?.response?.status;
        const isQuotaError = error?.error?.code === 'insufficient_quota';
        const shouldSwitch = status === 401 || status === 429 || status === 403 || isQuotaError;

        if (shouldSwitch) {
            console.warn(`Blocking API key ending in ...${apiKey.slice(-4)} for scope '${scope}' for 24 hours`);
            globalState._failedApiKeys.set(`${apiKey}::${scope}`, Date.now());
            // If we have more keys, continue to the next one
            if (availableKeys.indexOf(apiKey) < availableKeys.length - 1) {
                continue;
            }
        } else {
            // For other errors (e.g. 400 Bad Request, 500 Server Error), do not rotate keys, just throw.
            throw error;
        }
    }
  }

  throw lastError || new Error("Failed to execute OpenAI operation");
}
