import { GoogleGenAI, Type } from "@google/genai";
import { ChatMessage, Property, Task, TaskStatus } from '../types';

/*
================================================================================
==  THE RENOVATR AI CHARTER: CORE PRINCIPLES & GUIDING PHILOSOPHY          ==
================================================================================

This document outlines the foundational principles that govern the AI's personality,
decision-making, and interaction style. All AI functions in this service must
adhere to this charter to ensure a consistent, helpful, and inspiring user experience.

--------------------------------------------------------------------------------
1. The AI is a Creative Partner, Not a Passive Tool.
--------------------------------------------------------------------------------
   - The AI's primary role is not to just schedule tasks, but to act as a curious,
     creative guide. It should be proactive, ask insightful questions, and help
     the user explore and define their vision, rather than just waiting for
     instructions. It should proactively ask for photos when it's more
     efficient than a long text description.

--------------------------------------------------------------------------------
2. The "Vision" is the North Star.
--------------------------------------------------------------------------------
   - Every piece of advice, every task suggested, and every plan generated must
     be filtered through the lens of the user's desired "feel" and aesthetic.
   - The core mantra is: "Be stubborn on the vision, but flexible on the details."

--------------------------------------------------------------------------------
3. Planning is a Staged, Conversational Journey.
--------------------------------------------------------------------------------
   - The app must avoid overwhelming the user with long lists. The correct
     planning flow is always:
       a. Understand the Vision.
       b. Understand the Current State (asking for photos is key).
       c. Suggest the *next logical stage* of tasks in the correct chronological order.

--------------------------------------------------------------------------------
4. Embed Real-World, Practical DIY Wisdom.
--------------------------------------------------------------------------------
   - The AI's advice must be grounded in practical experience. This includes
     seamlessly integrating principles like:
       a. The "Test First" Principle: Always advise trying a new technique or
          material on a small, inconspicuous area first.
       b. The "Balanced Pace" Principle: Encourage careful work, but advise that
          if progress is too slow or mistakes are frequent, it's a sign to
          step back and learn more rather than pushing through.
       c. The "Simplicity" Principle: Always favor the simplest, most direct
          solution that achieves the desired quality.

--------------------------------------------------------------------------------
5. The User is Always in Control.
--------------------------------------------------------------------------------
   - The AI is a guide and a co-pilot, not the pilot. It suggests, advises, and
     plans, but the user must make the final decision.
   - This means tasks are only created when the user clicks the "Add" button,
     and detailed plans are only modified with the user's consent.

================================================================================
*/


const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateTaskDetails = async (task: Task, property: Property): Promise<Partial<Task>> => {
    const model = 'gemini-2.5-pro';

    const schema = {
        type: Type.OBJECT,
        properties: {
            guide: {
                type: Type.ARRAY,
                description: 'A step-by-step guide to complete the task. Each step should be a clear, actionable instruction.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING, description: "The instruction for this step." },
                        completed: { type: Type.BOOLEAN, description: "Always false initially." }
                    },
                    required: ['text', 'completed']
                }
            },
            materials: {
                type: Type.ARRAY,
                description: 'A list of materials needed for the task, including estimated costs and optional links to purchase online.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING, description: "Name of the material and quantity." },
                        cost: { type: Type.NUMBER, description: "Estimated cost in GBP (£)." },
                        link: { type: Type.STRING, description: "Optional URL to an online retailer." },
                        completed: { type: Type.BOOLEAN, description: "Whether the material has been purchased. Always false initially." }
                    },
                    required: ['text', 'completed']
                }
            },
            tools: {
                type: Type.ARRAY,
                description: 'A list of tools needed for the task, including estimated costs if they need to be bought.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        text: { type: Type.STRING, description: "Name of the tool." },
                        cost: { type: Type.NUMBER, description: "Estimated cost in GBP (£) if it needs to be purchased." },
                        link: { type: Type.STRING, description: "Optional URL to an online retailer." },
                        owned: { type: Type.BOOLEAN, description: "Whether the tool is already owned. Always false initially." }
                    },
                    required: ['text', 'owned']
                }
            },
            safety: {
                type: Type.ARRAY,
                description: 'A list of important safety considerations for this task.',
                items: { type: Type.STRING }
            },
            cost: { type: Type.STRING, description: 'A string representing the total estimated cost range, e.g., "£150 - £250".' },
            time: { type: Type.STRING, description: 'A string representing the total estimated time to complete, e.g., "1-2 days".' },
            hiringInfo: { type: Type.STRING, description: 'Brief advice on when to consider hiring a professional for this task. You MUST include a rough estimated cost range in GBP (£) for hiring a professional for this specific task.' }
        }
    };
    
    const contents = task.chatHistory.map(msg => ({
        role: msg.role,
        parts: msg.parts
    }));

    const systemInstruction = `You are an expert DIY and home renovation assistant. Your role is to provide detailed, practical, and safe advice for renovation tasks.
    The user is working on their property named "${property.name}". The current task is "${task.title}" in the room "${task.room}".
    The overall project vision is: "${property.visionStatement || 'not defined'}". All recommendations must align with this vision.
    Based on the user's request, generate a comprehensive plan. Costs must be in GBP (£).
    For any generated 'link' properties for materials or tools, create a search URL on amazon.co.uk. For example, for "2-inch paintbrush", the link should be "https://www.amazon.co.uk/s?k=2-inch+paintbrush".
    The user has provided the following chat history for context.
    Generate a JSON object that strictly follows the provided schema. Do not add any extra text or markdown formatting around the JSON object.
    
    Adhere to the RENOVATR AI CHARTER. A core principle of your advice is risk mitigation. For any step that involves applying a new material or using a new technique (e.g., painting, staining, stripping), you should *always* include a sub-step or a note to 'test your approach on a small, inconspicuous area first to check the results before committing to the full space.'
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        });

        let jsonText = response.text.trim();
        const parsedJson = JSON.parse(jsonText);

        // Post-process to add affiliate tags to the links
        const addAffiliateTag = (link: string) => {
            if (!link || !link.includes('amazon.co.uk')) return link;
            // NOTE FOR DEVELOPER: In a real backend, you would replace RENOVATR-21
            // with your actual, securely-stored Amazon Associates tag.
            return `${link}&tag=RENOVATR-21`;
        };

        if (parsedJson.materials) {
            parsedJson.materials.forEach((item: { link?: string }) => {
                if (item.link) item.link = addAffiliateTag(item.link);
            });
        }
        if (parsedJson.tools) {
            parsedJson.tools.forEach((item: { link?: string }) => {
                if (item.link) item.link = addAffiliateTag(item.link);
            });
        }
        
        return parsedJson as Partial<Task>;

    } catch (error) {
        console.error("Error generating task details:", error);
        throw new Error("Failed to generate task details from Gemini.");
    }
};

const getDynamicTaskSystemInstruction = (task: Task, property: Property): string => {
    const fullContext = `
    You have been fully briefed on the main project vision chat and any photos associated with this room.
    The overall project vision is: "${property.visionStatement || 'not defined'}".
    Main project chat history:
    ${property.projectChatHistory.map(m => `${m.role}: ${m.parts.map(p => (p as {text: string}).text).join(' ')}`).join('\n')}
    
    Before responding, analyze all this context to avoid asking for information you already have.
    `;

    if (task.guide && task.guide.length > 0) {
        return `You are a DIY expert helping a user execute a plan for the task: "${task.title}". 
        The plan has already been generated and is visible to the user. 
        Your role is now to act as a supervisor and helper. 
        Answer questions about the existing steps, provide encouragement, and discuss potential issues. 
        If the user wants to make a change, discuss it with them. If you both agree, you MUST end your response with the special command to update the plan.
        The command is: [UPDATE_PLAN] followed by a JSON object containing the new 'guide', 'materials', or 'tools' array.
        Ensure the JSON payload for [UPDATE_PLAN] is a valid, compact, single-line string.
        Example: [UPDATE_PLAN]{"guide": [{"text": "New step 1", "completed": false}]}
        ${fullContext}
        Adhere to the RENOVATR AI CHARTER.`;
    } 
    else {
        return `You are a DIY expert helping a user plan a new task: "${task.title}". 
        Your goal is to gather enough information to create a detailed step-by-step plan. 
        Be a curious guide. Ask clarifying questions to understand their vision for this specific task, their budget, their DIY experience level, and the current state of the item.
        Once you feel you have enough information to create a comprehensive plan, you MUST end your final response with the special command: [GENERATE_PLAN]
        ${fullContext}
        Adhere to the RENOVATR AI CHARTER.`;
    }
};

export const getTaskChatResponse = async (task: Task, history: ChatMessage[], property: Property): Promise<ChatMessage> => {
    const model = 'gemini-2.5-flash';

    const contents = history.map(msg => ({
        role: msg.role,
        parts: msg.parts
    }));

    const systemInstruction = getDynamicTaskSystemInstruction(task, property);

    try {
        const response = await ai.models.generateContent({
            model,
            contents,
            config: { systemInstruction }
        });

        const responseText = response.text;
        return { role: 'model', parts: [{ text: responseText }] };

    } catch (error) {
        console.error("Error getting task chat response:", error);
        throw new Error("Failed to get task chat response from Gemini.");
    }
}

export const getProjectChatResponse = async (history: ChatMessage[], property: Property, tasks: Task[]): Promise<ChatMessage> => {
    const model = 'gemini-2.5-flash';

    const contents = history.map(msg => ({
        role: msg.role,
        parts: msg.parts
    }));
    
    const taskSummary = tasks.length > 0
        ? `Here is the current status and progress of all tasks: ${tasks.map(t => {
            let progress = '';
            if (t.guide && t.guide.length > 0) {
                const completed = t.guide.filter(i => i.completed).length;
                progress = `, ${completed}/${t.guide.length} steps complete`;
            }
            return `'${t.title}' (${t.status}${progress})`;
        }).join('; ')}.`
        : "No tasks have been created yet.";

    const systemInstruction = `You are a helpful project assistant for a home renovation project called "${property.name}".
    Your goal is to help the user define their vision, brainstorm ideas, and break down the project into manageable tasks. You are also aware of the project's progress at a granular level.
    ${taskSummary}
    
    Adhere to the RENOVATR AI CHARTER. Your process must be staged and conversational:
    1. First, focus on understanding the user's overall vision and desired 'feel' for a room or the project.
    2. Once you have a sense of the vision, your next goal is to understand the *current condition* of that room. Ask clarifying questions. When it seems more convenient than a long text description, proactively ask for photos.
    3. Only after understanding BOTH the vision and the current state, should you suggest a small, logical first set of tasks.
    4. Ensure the suggested tasks are in the correct chronological order (e.g., preparation tasks like floor sanding should be suggested before finishing tasks like painting).
    
    When you suggest tasks, you MUST format them as a special command inside your response, like this:
    "Here are a few tasks we could start with: [SUGGEST_TASK:{"title": "Prepare and paint the woodwork", "room": "Bedroom"}]"
    You can suggest multiple tasks in one response. Do not add them automatically. The user needs to click a button.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents,
            config: {
                systemInstruction: systemInstruction
            }
        });

        return { role: 'model', parts: [{ text: response.text }] };

    } catch (error) {
        console.error("Error getting chat response:", error);
        throw new Error("Failed to get chat response from Gemini.");
    }
};

export const generateGuidingTaskIntroduction = async (taskTitle: string, taskRoom: string, property: Property): Promise<ChatMessage> => {
    const model = 'gemini-2.5-flash';
    const room = property.rooms.find(r => r.name === taskRoom);
    
    const context = `
    The user is starting a new task: "${taskTitle}" in the room: "${taskRoom}".
    The overall project is "${property.name}".
    
    CONTEXT: You have been fully briefed on the main project vision chat and any photos associated with this room. 
    Review this context to avoid asking for information that has already been provided (e.g., if a photo of the room exists, acknowledge it instead of asking for one).

    Main project vision chat history:
    ${property.projectChatHistory.map(m => `${m.role}: ${m.parts.map(p => (p as {text: string}).text).join(' ')}`).join('\n')}
    
    This room already has ${room?.photos.length || 0} photos in its timeline.
    
    Based on all this information, your goal is to create a friendly, guiding, and proactive opening message for this specific task's chat assistant.
    The message should:
    1. Acknowledge the task and room.
    2. Show awareness of the overall project vision from the chat history.
    3. End with a specific, open-ended question that prompts the user for details needed to start planning (e.g., ask about the user's specific goals for the finish, their experience level, etc.).
    
    Example: "Okay, let's get started on painting the bedroom. I see from our main chat that you're going for a calm, minimalist feel. I've also seen the photos of the room. To help create the best plan, could you tell me a bit about your DIY experience level?"
    
    Generate only the text for the message.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: context,
        });
        return { role: 'model', parts: [{ text: response.text }] };
    } catch (error) {
        console.error("Error generating guiding task introduction:", error);
        return { role: 'model', parts: [{ text: `Let's plan out how to '${taskTitle}'. What's your vision for this task?` }] };
    }
};


export const generateProjectSummary = async (property: Property, tasks: Task[]): Promise<string> => {
    const model = 'gemini-2.5-flash';

    const prompt = `
    Based on the following project information, generate a concise, encouraging, and helpful summary (2-3 sentences) of the project's current state.
    
    Project Name: ${property.name}
    Vision Statement: ${property.visionStatement || 'Not specified.'}
    Rooms: ${property.rooms.map(r => r.name).join(', ')}
    
    Tasks:
    - To Do: ${tasks.filter(t => t.status === 'To Do' || t.status === 'In Progress').length}
    - Complete: ${tasks.filter(t => t.status === 'Complete').length}

    Focus on what's been achieved and what's next. Keep the tone positive and motivational.
    `;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Error generating project summary:", error);
        throw new Error("Failed to generate project summary.");
    }
};

export const generateVisionStatement = async (history: ChatMessage[]): Promise<string> => {
    const model = 'gemini-2.5-flash';
    const prompt = `Analyze the following conversation about a home renovation project.
    Summarize the user's desired aesthetic, "feel", and key non-negotiables into a single, concise sentence.
    This statement will be used as a guiding principle for all future advice.
    
    Conversation:
    ${history.map(m => `${m.role}: ${m.parts.map(p => (p as { text: string }).text).join(' ')}`).join('\n')}
    
    Example output: "The user wants a cozy, rustic feel with warm, natural materials and a focus on handcrafted details."
    
    Generate only the single sentence summary.
    `;
    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error generating vision statement", error);
        return "";
    }
};