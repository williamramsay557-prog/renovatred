import { ChatMessage, Property, Task } from '../types';
import { logger } from '../utils/logger';

/**
 * A generic, type-safe function to call our secure backend endpoint with cancellation support.
 * @param {string} action - The specific API action to perform
 * @param {unknown} payload - The data to send to the API
 * @param {AbortSignal} signal - Optional AbortSignal to cancel the request
 * @returns {Promise<T>} A promise that resolves with the typed API response
 * @throws {Error} If the API request fails
 */
async function callGeminiApi<T>(action: string, payload: unknown, signal?: AbortSignal): Promise<T> {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action, payload }),
            signal,
        });

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
            logger.error(`API call failed for action ${action}`, undefined, { action, status: response.status, errorBody });
            throw new Error(`Server error for ${action}: ${errorBody.error || response.statusText}`);
        }

        return response.json() as Promise<T>;
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            logger.info(`Request aborted for action ${action}`);
            throw error;
        }
        logger.error(`Unexpected error in callGeminiApi`, error, { action });
        throw error;
    }
}


/**
 * Generate detailed task information including materials, tools, costs, and safety warnings
 * @param {Task} task - The task to generate details for
 * @param {Property} property - The property/project context
 * @param {AbortSignal} signal - Optional signal to cancel the request
 * @returns {Promise<Partial<Task>>} Partial task object with generated details
 */
export const generateTaskDetails = async (task: Task, property: Property, signal?: AbortSignal): Promise<Partial<Task>> => {
    return callGeminiApi<Partial<Task>>('generateTaskDetails', { task, property }, signal);
};

/**
 * Get AI chat response for a specific task conversation
 * @param {Task} task - The task being discussed
 * @param {ChatMessage[]} history - Previous chat messages
 * @param {Property} property - The property/project context
 * @param {AbortSignal} signal - Optional signal to cancel the request
 * @returns {Promise<ChatMessage>} AI-generated chat message
 */
export const getTaskChatResponse = async (task: Task, history: ChatMessage[], property: Property, signal?: AbortSignal): Promise<ChatMessage> => {
    return callGeminiApi<ChatMessage>('getTaskChatResponse', { task, history, property }, signal);
};

/**
 * Get AI chat response for project-level conversation
 * @param {ChatMessage[]} history - Previous chat messages
 * @param {Property} property - The property/project context
 * @param {Task[]} tasks - All project tasks
 * @param {AbortSignal} signal - Optional signal to cancel the request
 * @returns {Promise<ChatMessage>} AI-generated chat message
 */
export const getProjectChatResponse = async (history: ChatMessage[], property: Property, tasks: Task[], signal?: AbortSignal): Promise<ChatMessage> => {
    return callGeminiApi<ChatMessage>('getProjectChatResponse', { history, property, tasks }, signal);
};

/**
 * Generate an introductory AI message when a task is first opened
 * @param {string} taskTitle - The title of the task
 * @param {string} taskRoom - The room where the task will be performed
 * @param {Property} property - The property/project context
 * @param {AbortSignal} signal - Optional signal to cancel the request
 * @returns {Promise<ChatMessage>} AI-generated introduction message
 */
export const generateGuidingTaskIntroduction = async (taskTitle: string, taskRoom: string, property: Property, signal?: AbortSignal): Promise<ChatMessage> => {
    try {
        return await callGeminiApi<ChatMessage>('generateGuidingTaskIntroduction', { taskTitle, taskRoom, property }, signal);
    } catch (error) {
        logger.error("Failed to generate guiding task introduction", error, { taskTitle, taskRoom });
        // Fallback message if the API call is aborted or fails
        return { role: 'model', parts: [{ text: `Let's plan out how to '${taskTitle}'. What's your vision for this task?` }] };
    }
};

/**
 * Generate a summary of the entire renovation project
 * @param {Property} property - The property/project context
 * @param {Task[]} tasks - All project tasks
 * @param {AbortSignal} signal - Optional signal to cancel the request
 * @returns {Promise<string>} AI-generated project summary
 */
export const generateProjectSummary = async (property: Property, tasks: Task[], signal?: AbortSignal): Promise<string> => {
    return callGeminiApi<string>('generateProjectSummary', { property, tasks }, signal);
};

/**
 * Extract and generate a vision statement from chat history
 * @param {ChatMessage[]} history - Chat messages containing user's vision
 * @param {AbortSignal} signal - Optional signal to cancel the request
 * @returns {Promise<string>} AI-generated vision statement
 */
export const generateVisionStatement = async (history: ChatMessage[], signal?: AbortSignal): Promise<string> => {
    return callGeminiApi<string>('generateVisionStatement', { history }, signal);
};
