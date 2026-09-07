const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const METRIC_KEYS: Record<string, string[]> = {
    crypto: ["volume", "sentiment", "smartMoney"],
    prediction: ["volume", "participants"],
    bstock: ["volume", "marketCap"],
};

export async function suggestWeights(assetClass: string, description: string): Promise<Record<string, number>> {
    const keys = METRIC_KEYS[assetClass];
    if (!keys) throw new Error(`Unknown asset class: ${assetClass}`);

    const res = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: `You convert a short self-description into portfolio-scoring weights. Return ONLY a JSON object with exactly these keys: ${keys.join(", ")}. Each value must be a number between 0 and 1. No explanation, no markdown — just the JSON object.`,
                },
                { role: "user", content: description },
            ],
            temperature: 0.3,
        }),
    });

    if (!res.ok) throw new Error(`Groq request failed: ${res.status}`);

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "{}";

    let parsed: Record<string, number>;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error("AI returned an unexpected format — try rephrasing.");
    }

    const result: Record<string, number> = {};
    for (const key of keys) {
        const val = parsed[key];
        result[key] = typeof val === "number" && val >= 0 && val <= 1 ? val : 1 / keys.length;
    }
    return result;
}