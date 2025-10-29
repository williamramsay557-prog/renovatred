import { GoogleGenAI, Type } from "@google/genai";
import { Task, Property, ChatMessage } from '../src/types';

// This function runs on the server, so it's safe to use process.env for the API key.
// The key is stored in Vercel's environment variables, NOT in the browser.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface ApiRequestBody {
    action: 'generateTaskDetails' | 'getTaskChatResponse' | 'getProjectChatResponse' | 'generateGuidingTaskIntroduction' | 'generateProjectSummary' | 'generateVisionStatement';
    payload: any;
}

export const config = {
  runtime: 'edge',
};

// This is the single, secure endpoint that the frontend calls.
export default async function handler(req: Request) {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const { action, payload } = (await req.json()) as ApiRequestBody;
        let result: any;

        // The handler calls the appropriate function based on the action.
        switch (action) {
            case 'generateTaskDetails':
                result = await generateTaskDetails(payload.task, payload.property);
                break;
            case 'getTaskChatResponse':
                 result = await getTaskChatResponse(payload.task, payload.history, payload.property);
                break;
            case 'getProjectChatResponse':
                result = await getProjectChatResponse(payload.history, payload.property, payload.tasks);
                break;
            case 'generateGuidingTaskIntroduction':
                 result = await generateGuidingTaskIntroduction(payload.taskTitle, payload.taskRoom, payload.property);
                break;
            case 'generateProjectSummary':
                result = await generateProjectSummary(payload.property, payload.tasks);
                break;
            case 'generateVisionStatement':
                 result = await generateVisionStatement(payload.history);
                break;
            default:
                throw new Error(`Invalid action: ${action}`);
        }

        return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error) {
        console.error(`Error in /api/gemini for action:`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return new Response(JSON.stringify({ error: `An internal server error occurred: ${errorMessage}` }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

// --- YOUR FULL AI CHARTER, NOW RUNNING SECURELY ON THE SERVER ---

const generateTaskDetails = async (task: Task, property: Property): Promise<Partial<Task>> => {
    const model = 'gemini-2.5-pro';
    const schema = {
        type: Type.OBJECT,
        properties: {
            guide: { type: Type.ARRAY, description: "A detailed, step-by-step checklist for completing the task.", items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, completed: { type: Type.BOOLEAN, default: false } }, required: ['text', 'completed'] } },
            materials: { type: Type.ARRAY, description: "A list of materials needed, with estimated costs and shopping links.", items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, cost: { type: Type.NUMBER, description: "Estimated cost in GBP (£)" }, link: { type: Type.STRING, description: "A UK-specific shopping link, preferably from Amazon.co.uk." }, completed: { type: Type.BOOLEAN, default: false } }, required: ['text', 'completed'] } },
            tools: { type: Type.ARRAY, description: "A list of tools required, with links for purchasing if needed.", items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, cost: { type: Type.NUMBER, description: "Estimated cost in GBP (£) if the user needs to buy it." }, link: { type: Type.STRING, description: "A UK-specific shopping link, preferably from Amazon.co.uk." }, owned: { type: Type.BOOLEAN, default: false } }, required: ['text', 'owned'] } },
            safety: { type: Type.ARRAY, description: "Crucial safety warnings and required personal protective equipment (PPE).", items: { type: Type.STRING } },
            cost: { type: Type.STRING, description: "A brief, one-sentence summary of the total estimated cost." },
            time: { type: Type.STRING, description: "A realistic time estimate for a single person to complete the task (e.g., '4-6 hours', '2 days')." },
            hiringInfo: { type: Type.STRING, description: "Advice on when to hire a professional for this task, including what qualifications to look for (e.g., 'NICEIC certified electrician'). This should be a well-reasoned paragraph." }
        },
    };

    const systemInstruction = `You are an expert DIY and home renovation assistant for a UK-based user. Your role is to take a user's request from a chat conversation about a specific task and generate a complete, structured plan for them.

    **CONTEXT:**
    - Project: ${property.name}
    - Room: ${task.room}
    - The user wants a plan for the task: "${task.title}"
    - The user's vision for the project is: "${property.visionStatement || 'Not specified'}"

    **YOUR TASK:**
    Analyze the provided chat history for the task. Based on the user's questions, goals, and skill level mentioned, generate a comprehensive and actionable plan.

    **RULES:**
    1.  **Be Thorough:** Provide detailed steps in the 'guide'. Don't assume prior knowledge.
    2.  **Be UK-Specific:** Recommend materials and tools from UK suppliers. Costs must be in GBP (£). Links should point to amazon.co.uk where possible.
    3.  **Safety First:** The 'safety' section is non-negotiable. Always include relevant warnings and PPE.
    4.  **Realistic Estimates:** Provide practical cost and time estimates.
    5.  **Honest Advice:** Use the 'hiringInfo' section to advise the user when a task is too complex, dangerous, or requires certified professionals (e.g., gas, complex electrics).
    6.  **Affiliate Links:** For every shopping link you generate, create a search link on amazon.co.uk. For example, for "wood primer", the link should be "https://www.amazon.co.uk/s?k=wood+primer".
    7.  **JSON Output:** You MUST return ONLY a valid JSON object that conforms to the provided schema. Do not include any explanatory text or markdown formatting.`;

    const contents = task.chatHistory.map(msg => ({ role: msg.role, parts: msg.parts }));

    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction, responseMimeType: "application/json", responseSchema: schema } });
    let jsonText = response.text.trim();
    const parsedJson = JSON.parse(jsonText);

    const addAffiliateTag = (link: string | undefined) => link ? `${link}&tag=RENOVATR-21` : undefined;
    if (parsedJson.materials) {
        parsedJson.materials.forEach((item: { link?: string }) => {
            item.link = addAffiliateTag(item.link);
        });
    }
    if (parsedJson.tools) {
        parsedJson.tools.forEach((item: { link?: string }) => {
            item.link = addAffiliateTag(item.link);
        });
    }
        
    return parsedJson;
};

const getTaskChatResponse = async (task: Task, history: ChatMessage[], property: Property): Promise<ChatMessage> => {
    const model = 'gemini-2.5-flash';
    const contents = history.map(msg => ({ role: msg.role, parts: msg.parts }));
    const systemInstruction = `You are a friendly and encouraging DIY expert providing advice for a UK user.
    - Project: ${property.name}
    - Room: ${task.room}
    - Task: "${task.title}"
    Your goal is to answer the user's questions about this specific task. If you have enough information to create a full plan, respond with the user's answer and then include the special command "[GENERATE_PLAN]". If the user provides a significant update or change, you can use the command "[UPDATE_PLAN]" followed by a JSON object of the fields to update, e.g., "[UPDATE_PLAN] { "cost": "£150-£200" }". Otherwise, just provide a helpful, conversational response.`;
    
    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction } });
    return { role: 'model', parts: [{ text: response.text }] };
};

const getProjectChatResponse = async (history: ChatMessage[], property: Property, tasks: Task[]): Promise<ChatMessage> => {
    const model = 'gemini-2.5-flash';
    const contents = history.map(msg => ({ role: msg.role, parts: msg.parts }));
    const existingTasks = tasks.map(t => `- ${t.title} (${t.room})`).join('\n');

    const systemInstruction = `You are a helpful and inspiring project assistant for a UK-based DIY renovator. Your goal is to help them define their vision for their project: "${property.name}".
    - Existing Rooms: ${property.rooms.map(r => r.name).join(', ')}
    - Existing Tasks: \n${existingTasks}
    Engage in a friendly conversation. Ask clarifying questions. If the user mentions a specific, actionable task, you MUST embed a special command in your response: [SUGGEST_TASK:{"title": "Task Title", "room": "Room Name"}]. For example, if they say "I need to paint the living room", you would include [SUGGEST_TASK:{"title": "Paint the living room", "room": "Living Room"}]. You can suggest multiple tasks. Otherwise, just provide a helpful, conversational response.`;

    const response = await ai.models.generateContent({ model, contents, config: { systemInstruction } });
    return { role: 'model', parts: [{ text: response.text }] };
};

const generateGuidingTaskIntroduction = async (taskTitle: string, taskRoom: string, property: Property): Promise<ChatMessage> => {
    const model = 'gemini-2.5-flash';
    const context = `The user is starting a new task: "${taskTitle}" in the room: "${taskRoom}" for their project: "${property.name}". Their overall vision is: "${property.visionStatement || 'Not defined yet'}". 
    Your job is to write a friendly, engaging first message for the task-specific chat window. Ask one or two clarifying questions to help them get started. For example, ask about the current state of the room, their desired outcome, or their skill level. Keep it brief and encouraging.`;

    const response = await ai.models.generateContent({ model, contents: context });
    return { role: 'model', parts: [{ text: response.text }] };
};

const generateProjectSummary = async (property: Property, tasks: Task[]): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const taskSummary = tasks.map(t => `- ${t.title} (${t.status})`).join('\n');
    const prompt = `Based on the following project information, generate a one-paragraph (2-3 sentences) summary.
    - Project: ${property.name}
    - Vision: ${property.visionStatement || 'Not defined yet'}
    - Rooms: ${property.rooms.map(r => r.name).join(', ')}
    - Tasks:\n${taskSummary}
    The summary should be encouraging and reflect the current state of the project.`;

    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text;
};

const generateVisionStatement = async (history: ChatMessage[]): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const prompt = `Analyze the following conversation between a user and an AI assistant about a home renovation project. Based on the user's messages, distill their goals and desired aesthetic into a single, inspiring "Vision Statement" sentence. The statement should be concise and capture the essence of what the user wants to achieve. Return only the vision statement text, without any additional formatting or explanation.`;
    
    const contents = history.map(msg => ({ role: msg.role, parts: msg.parts }));
    const response = await ai.models.generateContent({ model, contents: prompt });
    return response.text.trim().replace(/"/g, ""); // Remove quotes
};
