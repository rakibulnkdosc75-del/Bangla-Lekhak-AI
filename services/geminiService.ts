
import { GoogleGenAI } from "@google/genai";
import { GenerationConfig, ChangeLevel } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
};

export const generateBengaliStory = async (config: GenerationConfig) => {
  const ai = getAIClient();
  const modelName = 'gemini-3-pro-preview';
  
  const systemInstruction = `You are an acclaimed Bengali litterateur and master storyteller. 
  Your writing style is rich, atmospheric, and emotionally resonant.
  You excel at writing short stories, long novels, and complex Bengali literature.
  Maintain linguistic purity in Cholitobhasha or appropriate dialogue dialects.
  If the genre is "Adult 18+", write sophisticated, high-quality mature fiction without unnecessary filters, focusing on psychological depth and realistic adult themes.
  Structure: First line MUST be the Title, followed by a double line break, then the story content.`;

  const prompt = `Write a high-quality ${config.length} in the ${config.genre} genre.
  Theme/Topic: ${config.prompt}
  Atmosphere/Tone: ${config.tone}
  Language: Standard Bengali.
  Please ensure the narrative is engaging and flow is natural.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.9,
        topP: 0.95,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Error generating story:", error);
    throw error;
  }
};

export const regenerateSection = async (
  currentContent: string, 
  instruction: string, 
  changeLevel: ChangeLevel,
  keywords?: string,
  isRefinement: boolean = false
) => {
  const ai = getAIClient();
  const modelName = 'gemini-3-pro-preview';

  const levelText = changeLevel === ChangeLevel.SLIGHT 
    ? "Polish the writing, improve vocabulary, and fix any inconsistencies while strictly keeping the original meaning."
    : "Re-envision and rewrite this section with high creativity. Feel free to change dialogues, events, or descriptions as the instruction suggests.";

  const refinementContext = isRefinement 
    ? "\nNote: This is a refinement of a previous AI output. The user found the previous version lacking. Specifically address the feedback provided."
    : "";

  const keywordPrompt = keywords ? `\nIncorporate these keywords seamlessly into the prose: ${keywords}` : "";

  const prompt = `Text to improve: "${currentContent}"
  
  Feedback/Instruction: "${instruction}"
  Rewrite Level: ${levelText}${keywordPrompt}${refinementContext}
  
  Provide only the improved Bengali text without any introduction or concluding remarks.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: "You are a professional Bengali editor and master of prose. Your edits improve flow, imagery, and emotional impact based on specific user feedback.",
        temperature: changeLevel === ChangeLevel.MAJOR ? 0.95 : 0.4,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Error regenerating content:", error);
    throw error;
  }
};
