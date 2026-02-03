import OpenAI from "openai";

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
  scope: string = "global"
): Promise<T> {
  const allKeys = process.env.OPENAI_API_KEY?.split(",").map((k) => k.trim()).filter(Boolean) || [];
  const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (allKeys.length === 0) {
    throw new Error("OpenAI API key not configured");
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
    throw new Error(`All API keys are currently blocked for scope '${scope}' or unavailable due to previous errors.`);
  }

  let lastError: any;

  for (const apiKey of availableKeys) {
    try {
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
      });

      return await operation(openai);
    } catch (error: any) {
      lastError = error;
      console.error(`Operation failed with key ending in ...${apiKey.slice(-4)} for scope '${scope}':`, error.message);

      // Determine if error warrants switching keys
      // 401: Unauthorized (Invalid Key)
      // 429: Too Many Requests (Rate Limit or Quota)
      // 403: Forbidden (Access Denied)
      const status = error?.status || error?.response?.status;
      const shouldSwitch = status === 401 || status === 429 || status === 403;

      if (shouldSwitch) {
        console.warn(`Blocking key ending in ...${apiKey.slice(-4)} for scope '${scope}' for 24 hours.`);
        const blockKey = `${apiKey}::${scope}`;
        globalState._failedApiKeys.set(blockKey, Date.now());
        continue; // Try next key
      } else {
        // For other errors (Use input error 400, Server error 500), do not rotate keys, just fail.
        throw error;
      }
    }
  }

  throw lastError || new Error("Failed to execute OpenAI operation");
}
