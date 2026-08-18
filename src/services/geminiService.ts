import { GoogleGenAI } from "@google/genai";
import { User, CycleData, LogEntry } from "../types";

/**
 * WARNING: This service runs on the client-side and includes a hardcoded API key.
 * This is done per your request for APK compatibility (serverless/standalone builds).
 * NOTE: Anyone who inspects your app's bundle (APK) can potentially see this key.
 * For a secure production web app, always use a backend proxy to keep keys secret.
 */
const API_KEY = "AIzaSyDF_onaERXUVEK65yCD2Ipela76_sEGvcU";

const ai = new GoogleGenAI({
  apiKey: API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export const geminiService = {
  async chat(message: string, history: any[], context: { user: User, cycles: CycleData[], logs: LogEntry[], currentPhase?: string, dayInCycle?: string, symptoms?: string[], today?: string }) {
    const recentLogs = context.logs
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 3)
      .map(l => `${l.date}: ${l.mood}, symptoms: ${l.symptoms?.join(', ') || 'none'}`);

    const prompt = `
You are Luna, a supportive and knowledgeable menstrual health assistant.

Your role:
- Help users understand their menstrual cycle
- Provide safe, general health guidance (NOT medical diagnosis)
- Offer emotional support and practical, actionable tips

STRICT RULES:
- Never give medical diagnosis
- Never prescribe medication
- Always include this disclaimer if giving health advice:
"This is general information, not medical advice."

TONE:
- Friendly, calm, and supportive
- Simple and easy to understand
- Never robotic

RESPONSE STRUCTURE:
1. Acknowledge the user's situation
2. Explain based on their current cycle phase
3. Give 2–4 practical tips
4. Add warning signs only if necessary

------------------------

USER CONTEXT:

Age: ${context.user?.age || 'Not provided'}
Cycle Length: ${context.user?.cycleLength || 'Unknown'}
Regularity: ${!context.user?.isIrregular ? 'Regular' : 'Irregular'}

Current Phase: ${context.currentPhase || 'Unknown'}
Day in Cycle: ${context.dayInCycle || 'Unknown'}

Symptoms: ${context.symptoms?.join(', ') || 'None'}

Recent Logs:
${recentLogs.map(l => '- ' + l).join('\n') || 'No logs'}

------------------------

PHASE GUIDANCE:

${context.currentPhase === 'Menstrual Phase' ? `
Focus: Rest and recovery
Common symptoms: cramps, fatigue
Tips: hydration, warm compress, iron-rich foods
` : ''}

${context.currentPhase === 'Follicular Phase' ? `
Focus: Energy building
Common: motivation increase
Tips: exercise, planning tasks
` : ''}

${context.currentPhase === 'Ovulation Phase' ? `
Focus: Peak energy and fertility
Common: confidence, social mood
Tips: hydration, social activities
` : ''}

${context.currentPhase === 'Luteal Phase' ? `
Focus: Emotional balance
Common: mood swings, bloating
Tips: reduce caffeine, sleep, light exercise
` : ''}

------------------------

USER QUESTION:
"${message}"

------------------------

Respond now as Luna:
`;

    try {
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        history: (history || []).map(m => ({
          role: m.role,
          parts: [{ text: m.parts[0].text }]
        })),
        config: {
          systemInstruction: prompt,
        }
      });

      const response = await chat.sendMessage({ message });
      return { text: response.text };
    } catch (error) {
      console.error("Gemini Service Error:", error);
      throw error;
    }
  }
};
