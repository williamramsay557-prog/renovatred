import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateTaskDetails, getTaskChatResponse } from '../services/geminiService';

global.fetch = vi.fn();

describe('geminiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateTaskDetails', () => {
    it('should successfully generate task details', async () => {
      const mockTask = {
        id: '1',
        title: 'Paint the room',
        room: 'Living Room',
        chatHistory: [],
        status: 'todo' as const,
        priority: 1,
      };

      const mockProperty = {
        id: 'prop1',
        name: 'My Home',
        rooms: [],
        projectChatHistory: [],
      };

      const mockResponse = {
        guide: [{ text: 'Step 1', completed: false }],
        materials: [],
        tools: [],
        safety: ['Wear mask'],
        cost: '£100-£150',
        time: '4-6 hours',
        hiringInfo: 'Consider hiring for large rooms',
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await generateTaskDetails(mockTask, mockProperty);
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith('/api/gemini', expect.any(Object));
    });

    it('should handle API errors gracefully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ error: 'Server error' }),
      });

      const mockTask = {
        id: '1',
        title: 'Paint the room',
        room: 'Living Room',
        chatHistory: [],
        status: 'todo' as const,
        priority: 1,
      };

      const mockProperty = {
        id: 'prop1',
        name: 'My Home',
        rooms: [],
        projectChatHistory: [],
      };

      await expect(generateTaskDetails(mockTask, mockProperty)).rejects.toThrow();
    });
  });
});
