
import { GoogleGenAI } from "@google/genai";
import { Tone, Platform, AspectRatio, ImageSize, Language, ImageData, OnboardingData } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export async function generateSocialText(
  idea: string, 
  tone: Tone, 
  platform: Platform, 
  language: Language, 
  onboarding: OnboardingData | null,
  uploadedImage?: ImageData
): Promise<{ text: string, suggestedTime: string }> {
  const ai = getAIClient();
  
  const businessContext = onboarding ? `
    Business Name: ${onboarding.businessName}
    Nature of Business: ${onboarding.natureOfBusiness}
    Target Demographic: ${onboarding.targetDemographic}
    Key Location: ${onboarding.keyLocation}
    Brand Values: ${onboarding.brandValues}
  ` : "No specific business context provided.";

  const systemInstruction = `You are a world-class social media strategist for ${onboarding?.businessName || 'a premium brand'}. 
    Your task is to generate highly engaging, platform-optimized content for ${platform}.
    The desired tone is ${tone}.
    The output MUST be written entirely in ${language}.
    
    BUSINESS CONTEXT & STRATEGY:
    ${businessContext}

    Strategy Requirements:
    - Use vocabulary that appeals specifically to the Target Demographic.
    - Reference ${onboarding?.keyLocation || 'global context'} where appropriate.
    - Align messaging with the specified Brand Values.
    
    Platform-specific constraints:
    - LinkedIn: Professional, authoritative, industry-focused. 2-3 paragraphs.
    - Twitter/X: Punchy, viral, conversational. Max 280 chars.
    - Instagram: Aesthetic, visual-first caption with relevant hashtags.
    - Facebook: Engaging, community-focused, friendly. Good for storytelling.
    - Email: Start with a clear [SUBJECT LINE]. Followed by a compelling body with a strong CTA. Formal or friendly depending on tone.
    
    MANDATORY JSON OUTPUT FORMAT:
    {
      "postContent": "The full text of the post. If Email, include the Subject Line at the start.",
      "suggestedPostingTime": "A specific time optimized for the target demographic and location provided."
    }
    Return ONLY the JSON.`;

  try {
    const parts: any[] = [{ text: `Generate a ${tone} post for ${platform} about: ${idea}. Language: ${language}.` }];
    
    if (uploadedImage) {
      parts.push({
        inlineData: {
          data: uploadedImage.data,
          mimeType: uploadedImage.mimeType
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        systemInstruction,
        temperature: 0.85,
        responseMimeType: "application/json"
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    return {
      text: parsed.postContent || "Unable to generate content.",
      suggestedTime: parsed.suggestedPostingTime || "Optimal window"
    };
  } catch (error: any) {
    console.error("Gemini Text API Error:", error);
    throw new Error(error.message || "Connection to text model failed.");
  }
}

export async function generateSocialImage(
  visualIdea: string, 
  platform: Platform, 
  aspectRatio: AspectRatio, 
  size: ImageSize, 
  language: Language, 
  onboarding: OnboardingData | null,
  uploadedImage?: ImageData
): Promise<string> {
  const ai = getAIClient();
  const model = size === '1K' ? 'gemini-2.5-flash-image' : 'gemini-3-pro-image-preview';
  
  const businessContext = onboarding ? `Business: ${onboarding.businessName}, Nature: ${onboarding.natureOfBusiness}, Audience: ${onboarding.targetDemographic}` : "";

  const platformStyle: Record<Platform, string> = {
    LinkedIn: "High-end corporate photography, clean, minimal, office environment, professional lighting.",
    Twitter: "Modern digital illustration or sharp editorial photography with high contrast.",
    Instagram: "Lifestyle photography, warm lighting, aesthetic composition, influencer style.",
    Facebook: "Friendly, bright, relatable outdoor photography with natural colors.",
    Email: "Polished studio photography, clean background, focus on product or human connection."
  };

  // Drastically improved prompt to minimize text-only responses and safety triggers
  const promptText = `GENERATE IMAGE:
Subject: ${visualIdea}
Visual Style: ${platformStyle[platform]}
Context: ${businessContext}
Technical: Cinematic lighting, 8k resolution, professional focus.
CRITICAL CONSTRAINT: DO NOT OUTPUT TEXT. DO NOT OUTPUT LOGOS. DO NOT OUTPUT SYMBOLS.
Task: Provide a visual asset for a social media campaign. ${uploadedImage ? "Reference the provided image for structural inspiration." : ""}`;

  try {
    const imageConfig: any = { aspectRatio };
    if (model === 'gemini-3-pro-image-preview') {
      imageConfig.imageSize = size;
    }

    const parts: any[] = [];
    if (uploadedImage) {
      parts.push({
        inlineData: {
          data: uploadedImage.data,
          mimeType: uploadedImage.mimeType
        }
      });
    }
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        imageConfig
      }
    });

    let imageUrl = '';
    const candidate = response.candidates?.[0];
    
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData) {
          imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      const reason = candidate?.finishReason || 'Unknown';
      console.warn(`Image Model returned no image. Finish Reason: ${reason}`);
      throw new Error(`The AI service didn't produce an image (Reason: ${reason}). This usually happens when the prompt is too vague or triggers a safety filter. Try describing the scene without using text or logos.`);
    }
    
    return imageUrl;
  } catch (error: any) {
    console.error("Gemini Image API Error:", error);
    throw new Error(error.message || "The image generation service encountered a problem.");
  }
}
