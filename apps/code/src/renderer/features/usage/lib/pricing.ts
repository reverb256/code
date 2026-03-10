interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheHitsPerMTok: number;
  cache5mWritePerMTok: number;
  cache1hWritePerMTok: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-6-20250514": {
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheHitsPerMTok: 0.5,
    cache5mWritePerMTok: 6.25,
    cache1hWritePerMTok: 10,
  },
  "claude-opus-4-6": {
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheHitsPerMTok: 0.5,
    cache5mWritePerMTok: 6.25,
    cache1hWritePerMTok: 10,
  },
  "claude-opus-4-5-20251101": {
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheHitsPerMTok: 0.5,
    cache5mWritePerMTok: 6.25,
    cache1hWritePerMTok: 10,
  },
  "claude-opus-4-5": {
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheHitsPerMTok: 0.5,
    cache5mWritePerMTok: 6.25,
    cache1hWritePerMTok: 10,
  },
  "claude-opus-4-1-20250501": {
    inputPerMTok: 15,
    outputPerMTok: 75,
    cacheHitsPerMTok: 1.5,
    cache5mWritePerMTok: 18.75,
    cache1hWritePerMTok: 30,
  },
  "claude-opus-4-1": {
    inputPerMTok: 15,
    outputPerMTok: 75,
    cacheHitsPerMTok: 1.5,
    cache5mWritePerMTok: 18.75,
    cache1hWritePerMTok: 30,
  },
  "claude-opus-4-20250514": {
    inputPerMTok: 15,
    outputPerMTok: 75,
    cacheHitsPerMTok: 1.5,
    cache5mWritePerMTok: 18.75,
    cache1hWritePerMTok: 30,
  },
  "claude-opus-4": {
    inputPerMTok: 15,
    outputPerMTok: 75,
    cacheHitsPerMTok: 1.5,
    cache5mWritePerMTok: 18.75,
    cache1hWritePerMTok: 30,
  },
  "claude-sonnet-4-6-20250514": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheHitsPerMTok: 0.3,
    cache5mWritePerMTok: 3.75,
    cache1hWritePerMTok: 6,
  },
  "claude-sonnet-4-6": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheHitsPerMTok: 0.3,
    cache5mWritePerMTok: 3.75,
    cache1hWritePerMTok: 6,
  },
  "claude-sonnet-4-5-20251022": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheHitsPerMTok: 0.3,
    cache5mWritePerMTok: 3.75,
    cache1hWritePerMTok: 6,
  },
  "claude-sonnet-4-5": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheHitsPerMTok: 0.3,
    cache5mWritePerMTok: 3.75,
    cache1hWritePerMTok: 6,
  },
  "claude-sonnet-4-20250514": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheHitsPerMTok: 0.3,
    cache5mWritePerMTok: 3.75,
    cache1hWritePerMTok: 6,
  },
  "claude-sonnet-4": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheHitsPerMTok: 0.3,
    cache5mWritePerMTok: 3.75,
    cache1hWritePerMTok: 6,
  },
  "claude-3-7-sonnet-20250219": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheHitsPerMTok: 0.3,
    cache5mWritePerMTok: 3.75,
    cache1hWritePerMTok: 6,
  },
  "claude-sonnet-3-7": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheHitsPerMTok: 0.3,
    cache5mWritePerMTok: 3.75,
    cache1hWritePerMTok: 6,
  },
  "claude-haiku-4-5-20251022": {
    inputPerMTok: 1,
    outputPerMTok: 5,
    cacheHitsPerMTok: 0.1,
    cache5mWritePerMTok: 1.25,
    cache1hWritePerMTok: 2,
  },
  "claude-haiku-4-5": {
    inputPerMTok: 1,
    outputPerMTok: 5,
    cacheHitsPerMTok: 0.1,
    cache5mWritePerMTok: 1.25,
    cache1hWritePerMTok: 2,
  },
  "claude-3-5-haiku-20241022": {
    inputPerMTok: 0.8,
    outputPerMTok: 4,
    cacheHitsPerMTok: 0.08,
    cache5mWritePerMTok: 1,
    cache1hWritePerMTok: 1.6,
  },
  "claude-haiku-3-5": {
    inputPerMTok: 0.8,
    outputPerMTok: 4,
    cacheHitsPerMTok: 0.08,
    cache5mWritePerMTok: 1,
    cache1hWritePerMTok: 1.6,
  },
  "claude-3-opus-20240229": {
    inputPerMTok: 15,
    outputPerMTok: 75,
    cacheHitsPerMTok: 1.5,
    cache5mWritePerMTok: 18.75,
    cache1hWritePerMTok: 30,
  },
  "claude-opus-3": {
    inputPerMTok: 15,
    outputPerMTok: 75,
    cacheHitsPerMTok: 1.5,
    cache5mWritePerMTok: 18.75,
    cache1hWritePerMTok: 30,
  },
  "claude-3-haiku-20240307": {
    inputPerMTok: 0.25,
    outputPerMTok: 1.25,
    cacheHitsPerMTok: 0.03,
    cache5mWritePerMTok: 0.3,
    cache1hWritePerMTok: 0.5,
  },
  "claude-haiku-3": {
    inputPerMTok: 0.25,
    outputPerMTok: 1.25,
    cacheHitsPerMTok: 0.03,
    cache5mWritePerMTok: 0.3,
    cache1hWritePerMTok: 0.5,
  },
};

const PRICING_REFERENCE = [
  { name: "Claude Opus 4.6", key: "claude-opus-4-6" },
  { name: "Claude Opus 4.5", key: "claude-opus-4-5" },
  { name: "Claude Opus 4.1", key: "claude-opus-4-1" },
  { name: "Claude Opus 4", key: "claude-opus-4" },
  { name: "Claude Sonnet 4.6", key: "claude-sonnet-4-6" },
  { name: "Claude Sonnet 4.5", key: "claude-sonnet-4-5" },
  { name: "Claude Sonnet 4", key: "claude-sonnet-4" },
  { name: "Claude Haiku 4.5", key: "claude-haiku-4-5" },
  { name: "Claude Haiku 3.5", key: "claude-haiku-3-5" },
  { name: "Claude Haiku 3", key: "claude-haiku-3" },
] as const;

export { MODEL_PRICING, PRICING_REFERENCE };
export type { ModelPricing };

export function getModelPricing(modelId: string): ModelPricing {
  if (MODEL_PRICING[modelId]) return MODEL_PRICING[modelId];

  const lowerModel = modelId.toLowerCase();
  if (lowerModel.includes("opus-4-6") || lowerModel.includes("opus-4.6"))
    return MODEL_PRICING["claude-opus-4-6"];
  if (lowerModel.includes("opus-4-5") || lowerModel.includes("opus-4.5"))
    return MODEL_PRICING["claude-opus-4-5"];
  if (lowerModel.includes("opus-4-1") || lowerModel.includes("opus-4.1"))
    return MODEL_PRICING["claude-opus-4-1"];
  if (lowerModel.includes("opus-4") || lowerModel.includes("opus4"))
    return MODEL_PRICING["claude-opus-4"];
  if (lowerModel.includes("opus-3") || lowerModel.includes("opus3"))
    return MODEL_PRICING["claude-opus-3"];
  if (lowerModel.includes("sonnet-4-6") || lowerModel.includes("sonnet-4.6"))
    return MODEL_PRICING["claude-sonnet-4-6"];
  if (lowerModel.includes("sonnet-4-5") || lowerModel.includes("sonnet-4.5"))
    return MODEL_PRICING["claude-sonnet-4-5"];
  if (lowerModel.includes("sonnet-4") || lowerModel.includes("sonnet4"))
    return MODEL_PRICING["claude-sonnet-4"];
  if (lowerModel.includes("sonnet-3") || lowerModel.includes("sonnet3"))
    return MODEL_PRICING["claude-sonnet-3-7"];
  if (lowerModel.includes("haiku-4-5") || lowerModel.includes("haiku-4.5"))
    return MODEL_PRICING["claude-haiku-4-5"];
  if (lowerModel.includes("haiku-3-5") || lowerModel.includes("haiku-3.5"))
    return MODEL_PRICING["claude-haiku-3-5"];
  if (lowerModel.includes("haiku-3") || lowerModel.includes("haiku3"))
    return MODEL_PRICING["claude-haiku-3"];

  return MODEL_PRICING["claude-sonnet-4"];
}

export function calculateModelCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheWriteTokens = 0,
): number {
  const pricing = getModelPricing(modelId);
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMTok;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMTok;
  const cacheReadCost =
    (cacheReadTokens / 1_000_000) * pricing.cacheHitsPerMTok;
  const cacheWriteCost =
    (cacheWriteTokens / 1_000_000) * pricing.cache5mWritePerMTok;
  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

export function getModelDisplayName(modelId: string): string {
  const lowerModel = modelId.toLowerCase();
  if (lowerModel.includes("opus-4-6") || lowerModel.includes("opus-4.6"))
    return "Claude Opus 4.6";
  if (lowerModel.includes("opus-4-5") || lowerModel.includes("opus-4.5"))
    return "Claude Opus 4.5";
  if (lowerModel.includes("opus-4-1") || lowerModel.includes("opus-4.1"))
    return "Claude Opus 4.1";
  if (lowerModel.includes("opus-4") || lowerModel.includes("opus4"))
    return "Claude Opus 4";
  if (lowerModel.includes("opus-3") || lowerModel.includes("opus3"))
    return "Claude Opus 3";
  if (lowerModel.includes("sonnet-4-6") || lowerModel.includes("sonnet-4.6"))
    return "Claude Sonnet 4.6";
  if (lowerModel.includes("sonnet-4-5") || lowerModel.includes("sonnet-4.5"))
    return "Claude Sonnet 4.5";
  if (lowerModel.includes("sonnet-4") || lowerModel.includes("sonnet4"))
    return "Claude Sonnet 4";
  if (lowerModel.includes("sonnet-3") || lowerModel.includes("sonnet3"))
    return "Claude Sonnet 3.7";
  if (lowerModel.includes("haiku-4-5") || lowerModel.includes("haiku-4.5"))
    return "Claude Haiku 4.5";
  if (lowerModel.includes("haiku-3-5") || lowerModel.includes("haiku-3.5"))
    return "Claude Haiku 3.5";
  if (lowerModel.includes("haiku-3") || lowerModel.includes("haiku3"))
    return "Claude Haiku 3";
  return modelId;
}
