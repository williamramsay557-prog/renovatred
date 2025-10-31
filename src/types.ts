// Define the Part type locally as it's not a public export from @google/genai
export interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

export interface UserPreferences {
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'professional';
    budgetRange: 'tight' | 'moderate' | 'flexible' | 'unlimited';
    measurementUnit: 'metric' | 'imperial';
    notifications: {
        email: boolean;
        taskReminders: boolean;
        friendActivity: boolean;
        weeklyDigest: boolean;
    };
    privacy: {
        profileVisibility: 'public' | 'friends' | 'private';
        showProjects: boolean;
        showProgress: boolean;
    };
    location?: string;
    bio?: string;
}

export interface User {
    id: string;
    name: string;
    avatarUrl: string;
    friendIds: string[];
    email?: string;
    preferences?: UserPreferences;
}

export interface Comment {
    id: string;
    userId: string;
    text: string;
    timestamp: string;
}

export interface FeedPost {
    id:string;
    projectId: string; 
    userId: string;
    timestamp: string;
    text: string;
    imageUrl?: string;
    projectName: string;
    roomName: string;
    likedBy: string[];
    comments: Comment[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    parts: Part[];
    suggestions?: Array<{
        title: string;
        room: string;
    }>;
}

export enum TaskStatus {
    ToDo = 'To Do',
    InProgress = 'In Progress',
    Complete = 'Complete',
}

export interface ChecklistItem {
    text: string;
    completed: boolean;
}

export interface MaterialItem {
    text: string;
    cost?: number;
    link?: string;
    completed: boolean;
}

export interface ToolItem {
    text: string;
    cost?: number;
    link?: string;
    owned: boolean;
}

export interface Task {
    id: string;
    title: string;
    room: string;
    status: TaskStatus;
    priority: number;
    chatHistory: ChatMessage[];
    guide?: ChecklistItem[];
    safety?: string[];
    materials?: MaterialItem[];
    tools?: ToolItem[];
    cost?: string;
    time?: string;
    hiringInfo?: string;
    hasBeenOpened?: boolean;
}

export interface Room {
    id: string;
    name: string;
    photos: string[];
    aiSummary?: string;
}

export interface Property {
    id: string;
    name: string;
    rooms: Room[];
    visionStatement?: string;
    projectChatHistory: ChatMessage[];
}

// NEW: Top-level container for a single project
export interface Project {
    id: string;
    userId: string;
    property: Property;
    tasks: Task[];
    feedPosts: FeedPost[];
}

export enum View {
    Dashboard = 'Dashboard',
    Overview = 'Overview',
    RoomProgress = 'Room Progress',
    ProjectChat = 'Project Chat',
}

// Top level app view state
export type AppView = 'landing' | 'setup' | 'main';
// View state within the main app
export type MainView = 'feed' | 'profile' | 'project';