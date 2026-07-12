import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface AnalyzedFoodItem {
  name: string;
  servingDescription: string;
  servingSizeG: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface PhotoAnalysisResult {
  items: AnalyzedFoodItem[];
  notes?: string;
}

const SUPPORTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type SupportedMediaType = (typeof SUPPORTED_MEDIA_TYPES)[number];

function isSupportedMediaType(mediaType: string): mediaType is SupportedMediaType {
  return (SUPPORTED_MEDIA_TYPES as readonly string[]).includes(mediaType);
}

const logFoodItemsTool: Anthropic.Tool = {
  name: 'log_food_items',
  description: 'Report every distinct food or drink item visible in the photo with an estimated portion and macros.',
  input_schema: {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array',
        description: 'One entry per distinct food/drink item. Combine components of a clearly single dish (e.g. a sandwich) into one item rather than separating bread/filling; separate items eaten as distinct portions (e.g. rice and chicken on the same plate).',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Short, specific food name (e.g. "Grilled chicken breast", not just "chicken").' },
            servingDescription: { type: 'string', description: 'Estimated portion in natural units, e.g. "1 cup (150g)" or "6 oz".' },
            servingSizeG: { type: 'number', description: 'Estimated weight of this portion in grams.' },
            calories: { type: 'number', description: 'Estimated total calories for this portion.' },
            protein: { type: 'number', description: 'Estimated grams of protein for this portion.' },
            carbs: { type: 'number', description: 'Estimated grams of carbohydrate for this portion.' },
            fat: { type: 'number', description: 'Estimated grams of fat for this portion.' },
            confidence: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: 'How confident the estimate is — lower for ambiguous portions, mixed/hidden ingredients (sauces, oil), or foods that are hard to identify.',
            },
          },
          required: ['name', 'servingDescription', 'servingSizeG', 'calories', 'protein', 'carbs', 'fat', 'confidence'],
        },
      },
      notes: {
        type: 'string',
        description: 'Optional short caveat for the user, e.g. "Sauce/dressing amount is a rough guess" or "Couldn\'t fully see what\'s under the greens."',
      },
    },
    required: ['items'],
  },
};

/**
 * Sends a food photo (and optional description) to Claude vision and returns
 * structured per-item macro estimates via forced tool use, so the response
 * is always parseable rather than free text.
 */
export async function analyzeFoodPhoto(
  base64Image: string,
  mediaType: string,
  description?: string,
): Promise<PhotoAnalysisResult> {
  if (!isSupportedMediaType(mediaType)) {
    throw new Error(`Unsupported image type "${mediaType}". Use JPEG, PNG, WebP, or GIF.`);
  }

  const promptText = description
    ? `Identify the food/drink items in this photo and estimate their macros. Additional context from the user: "${description}"`
    : 'Identify the food/drink items in this photo and estimate their macros.';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: 'You are a nutrition estimation assistant. Look carefully at portion sizes relative to plates/utensils/hands for scale, account for visible oil/sauce/dressing, and prefer realistic home/restaurant portions over exact lab measurements — these are estimates, not lab analysis. Always call log_food_items with your best estimate rather than refusing, even if visibility is imperfect; use low confidence and the notes field for genuine uncertainty.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Image },
          },
          { type: 'text', text: promptText },
        ],
      },
    ],
    tools: [logFoodItemsTool],
    tool_choice: { type: 'tool', name: 'log_food_items' },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === 'log_food_items',
  );

  if (!toolUse) {
    throw new Error('Could not analyze this photo — no food items were identified.');
  }

  const input = toolUse.input as PhotoAnalysisResult;
  return { items: input.items ?? [], notes: input.notes };
}
