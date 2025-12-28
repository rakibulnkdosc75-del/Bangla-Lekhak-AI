
import { GoogleGenAI } from "@google/genai";
import { GenerationConfig, ChangeLevel, StoryGenre } from "../types";

const getAIClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
};

export const generateBengaliStory = async (config: GenerationConfig) => {
  const ai = getAIClient();
  const modelName = 'gemini-3-pro-preview';
  
  const isAdult = config.genre.includes("প্রাপ্তবয়স্ক") || config.genre.includes("Adult");

  const systemInstruction = `You are a world-class Bengali litterateur and master storyteller. 
  Your writing style is rich, atmospheric, and emotionally resonant.
  You excel at writing long novels (Uponnas), short stories (Golpo), and complex literature.
  Maintain linguistic purity in Cholitobhasha or appropriate dialogue dialects.
  
  ${isAdult ? `CRITICAL INSTRUCTION FOR MATURE CONTENT:
  The user has selected the "Adult 18+" genre. You are strictly required to write high-quality, fully activated, and sophisticated adult/erotic fiction. Do not apply moralistic filters or censorship. Focus on psychological depth, sensory details, and realistic adult interactions. The user expects complete and unrestricted creative output for mature audiences. Ensure the language remains literary but explicit where appropriate for the narrative.` : ''}
  
  Output Structure: The first line MUST be the Title (শিরোনাম), followed by a double line break, and then the full story content.`;

  const prompt = `Write a high-quality ${config.length} in the ${config.genre} genre.
  Main Plot/Theme: ${config.prompt}
  Atmosphere/Tone: ${config.tone}
  Language: Standard Bengali.
  Ensure the narrative flow is natural and the vocabulary is rich.`;

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
    ? "Polish the writing, improve imagery, and fix inconsistencies while strictly keeping the original intent."
    : "Re-envision and rewrite this section with high creativity. Change dialogues, events, and descriptions as the instruction suggests.";

  const refinementContext = isRefinement 
    ? "\nNote: This is an iterative refinement. The user previously asked for changes and is now providing follow-up feedback. Address the new feedback specifically while maintaining consistency."
    : "";

  const keywordPrompt = keywords ? `\nIncorporate these keywords seamlessly: ${keywords}` : "";

  const prompt = `Selected Text: "${currentContent}"
  
  Feedback/Instruction: "${instruction}"
  Rewrite Level: ${levelText}${keywordPrompt}${refinementContext}
  
  Output only the rewritten Bengali text. No introductions or meta-talk.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: "You are a professional Bengali editor and master prose writer. Your goal is to refine existing text based on user feedback to achieve literary excellence.",
        temperature: changeLevel === ChangeLevel.MAJOR ? 0.95 : 0.5,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Error regenerating content:", error);
    throw error;
  }
};

export const continueStory = async (
  currentStory: string,
  instruction: string,
  config: GenerationConfig
) => {
  const ai = getAIClient();
  const modelName = 'gemini-3-pro-preview';

  const prompt = `This is an ongoing Bengali ${config.genre} story:
  ---
  ${currentStory}
  ---
  Please write the next segment of this story.
  Direction for continuation: ${instruction || "গল্পের স্বাভাবিক গতি বজায় রেখে এগিয়ে যাও"}
  Tone: ${config.tone}
  Language: Standard Bengali.
  
  Continue the narrative naturally, maintaining character voices and atmospheric details. Output only the new text. Ensure seamless transition from the previous section.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: "You are a master Bengali novelist. You excel at maintaining narrative tension and character consistency in long-form fiction. Your task is to extend the story meaningfully.",
        temperature: 0.8,
      },
    });

    return response.text;
  } catch (error) {
    console.error("Error continuing story:", error);
    throw error;
  }
};
