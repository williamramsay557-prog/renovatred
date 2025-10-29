import { ChatMessage, Property, Task } from '../types';

/**
 * A generic, type-safe function to call our secure backend endpoint with cancellation support.
 * @param action The specific API action to perform.
 * @param payload The data to send to the API.
 * @param signal An optional AbortSignal to cancel the request.
 * @returns A promise that resolves with the typed API response.
 */
async function callGeminiApi<T>(action: string, payload: unknown, signal?: AbortSignal): Promise<T> {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, payload }),
        signal, // Pass the signal to the fetch request
    });

    if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
        console.error(`API call failed for action ${action}:`, errorBody);
        throw new Error(`Server error for ${action}: ${errorBody.error || response.statusText}`);
    }

    // Cast the response to the expected generic type
    return response.json() as Promise<T>;
}


// Updated service functions with explicit return types and optional signal propagation
export const generateTaskDetails = async (task: Task, property: Property, signal?: AbortSignal): Promise<Partial<Task>> => {
    return callGeminiApi<Partial<Task>>('generateTaskDetails', { task, property }, signal);
};

export const getTaskChatResponse = async (task: Task, history: ChatMessage[], property: Property, signal?: AbortSignal): Promise<ChatMessage> => {
    return callGeminiApi<ChatMessage>('getTaskChatResponse', { task, history, property }, signal);
};

export const getProjectChatResponse = async (history: ChatMessage[], property: Property, tasks: Task[], signal?: AbortSignal): Promise<ChatMessage> => {
    return callGeminiApi<ChatMessage>('getProjectChatResponse', { history, property, tasks }, signal);
};

export const generateGuidingTaskIntroduction = async (taskTitle: string, taskRoom: string, property: Property, signal?: AbortSignal): Promise<ChatMessage> => {
    try {
        return await callGeminiApi<ChatMessage>('generateGuidingTaskIntroduction', { taskTitle, taskRoom, property }, signal);
    } catch (error) {
         console.error("Error generating guiding task introduction:", error);
        // Fallback message if the API call is aborted or fails
        return { role: 'model', parts: [{ text: `Let's plan out how to '${taskTitle}'. What's your vision for this task?` }] };
    }
};

export const generateProjectSummary = async (property: Property, tasks: Task[], signal?: AbortSignal): Promise<string> => {
    return callGeminiApi<string>('generateProjectSummary', { property, tasks }, signal);
};

export const generateVisionStatement = async (history: ChatMessage[], signal?: AbortSignal): Promise<string> => {
    return callGeminiApi<string>('generateVisionStatement', { history }, signal);
};
