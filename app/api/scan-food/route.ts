import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { imageBase64 } = await request.json();

    if (!imageBase64) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    // Call OpenAI Vision API to analyze food
    const response = await openai.chat.completions.create({
      model: 'gpt-4-vision-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: `Analyze this food image and estimate the nutritional content. 
              Respond ONLY with valid JSON (no markdown, no code blocks) in this exact format:
              {
                "foodName": "name of the food",
                "servingSize": "estimated serving size (e.g., '1 cup' or '100g')",
                "calories": number,
                "protein": number (in grams),
                "carbs": number (in grams),
                "fat": number (in grams),
                "fiber": number (in grams),
                "confidence": "high" | "medium" | "low"
              }
              
              Be conservative in estimates. If unsure about serving size, assume a standard portion.`,
            },
          ],
        },
      ],
      max_tokens: 200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'No response from OpenAI' },
        { status: 500 }
      );
    }

    // Parse the JSON response
    const nutrition = JSON.parse(content);

    return NextResponse.json(nutrition);
  } catch (error: any) {
    console.error('Food scanning error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to scan food' },
      { status: 500 }
    );
  }
}
