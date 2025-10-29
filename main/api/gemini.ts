import { ChatMessage, Property, Task } from '../types';

// A generic function to call our secure backend endpoint
async function callGeminiApi(action: string, payload: any) {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, payload }),
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        console.error(`API call failed for action ${action}:`, errorBody);
        throw new Error(`Server error for ${action}: ${errorBody.error || response.statusText}`);
    }

    return response.json();
}

export const generateTaskDetails = async (task: Task, property: Property): Promise<Partial<Task>> => {
    return callGeminiApi('generateTaskDetails', { task, property });
};

export const getTaskChatResponse = async (task: Task, history: ChatMessage[], property: Property): Promise<ChatMessage> => {
    return callGeminiApi('getTaskChatResponse', { task, history, property });
};

export const getProjectChatResponse = async (history: ChatMessage[], property: Property, tasks: Task[]): Promise<ChatMessage> => {
    return callGeminiApi('getProjectChatResponse', { history, property, tasks });
};

export const generateGuidingTaskIntroduction = async (taskTitle: string, taskRoom: string, property: Property): Promise<ChatMessage> => {
    try {
        return await callGeminiApi('generateGuidingTaskIntroduction', { taskTitle, taskRoom, property });
    } catch (error) {
         console.error("Error generating guiding task introduction:", error);
        return { role: 'model', parts: [{ text: `Let's plan out how to '${taskTitle}'. What's your vision for this task?` }] };
    }
};

export const generateProjectSummary = async (property: Property, tasks: Task[]): Promise<string> => {
    return callGeminiApi('generateProjectSummary', { property, tasks });
};

export const generateVisionStatement = async (history: ChatMessage[]): Promise<string> => {
    return callGeminiApi('generateVisionStatement', { history });
};
