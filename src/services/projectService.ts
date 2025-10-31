import { supabase } from './supabaseClient';
import { Project, Task, FeedPost, ChatMessage, Room, User, Property, Comment } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { 
    apiGetProjects, 
    apiGetProject, 
    apiCreateProject, 
    apiUpdateProject, 
    apiDeleteProject,
    apiCreateTask,
    apiUpdateTask,
    apiDeleteTask,
    apiCreateRoom,
    apiDeleteRoom,
    apiAddPhotoToRoom,
    apiUploadImage
} from './apiClient';

// ============================================================================
// FEATURE FLAG: Server-Side API Migration
// Set to true to use secure server-side API, false for legacy client-side
// ============================================================================
const USE_SERVER_API = false; // TODO: Enable after RLS policies are deployed

// Helper to convert base64 to a File object for uploading
const dataURLtoFile = (dataurl: string, filename: string): File | null => {
    const arr = dataurl.split(',');
    if (arr.length < 2) return null;
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch) return null;
    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

/**
 * Upload an image to Supabase storage
 * @param {string} dataUrl - Base64 encoded image data URL
 * @param {string} fileNamePrefix - Prefix for the uploaded file name
 * @returns {Promise<string>} Public URL of the uploaded image
 * @throws {Error} If image conversion or upload fails
 */
export const uploadImage = async (dataUrl: string, fileNamePrefix: string): Promise<string> => {
    try {
        const file = dataURLtoFile(dataUrl, `${fileNamePrefix}.png`);
        if (!file) {
            logger.error('Failed to convert data URL to file', undefined, { fileNamePrefix });
            throw new Error("Could not convert data URL to file");
        }
        
        const filePath = `public/${fileNamePrefix}-${uuidv4()}`;
        const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, file);

        if (uploadError) {
            logger.error('Failed to upload image to storage', uploadError, { filePath });
            throw uploadError;
        }

        const { data } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);
        
        logger.info('Image uploaded successfully', { filePath, url: data.publicUrl });
        return data.publicUrl;
    } catch (error) {
        logger.error('Unexpected error in uploadImage', error, { fileNamePrefix });
        throw error;
    }
};

// --- User & Friend Management ---
export const getAllUsers = async (): Promise<User[]> => {
    const { data, error } = await supabase.from('users').select('id, name, avatar_url');
    if (error) throw error;
    return data.map(u => ({...u, avatarUrl: u.avatar_url, friendIds: []})); // friendIds will be populated on the main user
};

export const getUserById = async (userId: string): Promise<User | undefined> => {
    const { data, error } = await supabase.from('users').select('id, name, avatar_url').eq('id', userId).single();
    if (error) throw error;
    // Note: This simplified version doesn't fetch friendIds. The main `getCurrentUser` in authService does.
    return data ? { ...data, avatarUrl: data.avatar_url, friendIds: [] } : undefined;
}

export const addFriend = async (currentUserId: string, friendId: string): Promise<void> => {
    const { error } = await supabase.from('friends').insert([
        { user_id_1: currentUserId, user_id_2: friendId },
        { user_id_1: friendId, user_id_2: currentUserId } // Make friendship mutual
    ]);
    if (error) throw error;
};

export const removeFriend = async (currentUserId: string, friendId: string): Promise<void> => {
     const { error } = await supabase.from('friends').delete()
        .or(`(user_id_1.eq.${currentUserId},user_id_2.eq.${friendId}),(user_id_1.eq.${friendId},user_id_2.eq.${currentUserId})`);
    if (error) throw error;
};

// --- Project Management ---

/**
 * Get all projects for a user
 * @param userId - User ID (ignored when USE_SERVER_API is true, uses auth token)
 */
export const getProjectsForUser = async (userId: string): Promise<Project[]> => {
    if (USE_SERVER_API) {
        logger.info('Fetching projects via server API');
        return await apiGetProjects();
    }
    
    // Legacy client-side method
    logger.warn('Using legacy client-side project fetch');
    const { data: projectsData, error } = await supabase
        .from('projects')
        .select(`
            id,
            user_id,
            name,
            vision_statement,
            project_chat_history,
            rooms(*),
            tasks(*)
        `)
        .eq('user_id', userId);
    
    if (error) throw error;

    return projectsData.map(p => ({
        id: p.id,
        userId: p.user_id,
        property: {
            id: p.id,
            name: p.name,
            rooms: p.rooms.map((r: any) => ({...r, aiSummary: r.ai_summary})),
            visionStatement: p.vision_statement,
            projectChatHistory: p.project_chat_history,
        },
        tasks: p.tasks.map((t: any) => ({
            ...t,
            chatHistory: t.chat_history,
            hiringInfo: t.hiring_info,
            hasBeenOpened: t.has_been_opened
        })),
        feedPosts: []
    }));
};

export const getProjectById = async (projectId: string): Promise<Project | undefined> => {
    if (USE_SERVER_API) {
        logger.info('Fetching project by ID via server API', { projectId });
        try {
            return await apiGetProject(projectId);
        } catch (error) {
            if (error instanceof Error && error.message.includes('404')) {
                return undefined;
            }
            throw error;
        }
    }
    
    // Legacy client-side method
    logger.warn('Using legacy client-side project fetch by ID');
    const { data, error } = await supabase
        .from('projects')
        .select(`
            id,
            user_id,
            name,
            vision_statement,
            project_chat_history,
            rooms(*),
            tasks(*)
        `)
        .eq('id', projectId)
        .single();
    if (error) throw error;
    if (!data) return undefined;

    return {
        id: data.id,
        userId: data.user_id,
        property: {
            id: data.id,
            name: data.name,
            rooms: data.rooms.map((r: any) => ({...r, aiSummary: r.ai_summary})),
            visionStatement: data.vision_statement,
            projectChatHistory: data.project_chat_history,
        },
        tasks: data.tasks.map((t: any) => ({
            ...t,
            chatHistory: t.chat_history,
            hiringInfo: t.hiring_info,
            hasBeenOpened: t.has_been_opened
        })),
        feedPosts: []
    };
}

export const createProject = async (userId: string, property: Property): Promise<Project> => {
    if (USE_SERVER_API) {
        logger.info('Creating project via server API');
        const { projectId } = await apiCreateProject(property);
        const project = await getProjectById(projectId);
        if (!project) throw new Error('Failed to retrieve created project');
        return project;
    }
    
    // Legacy client-side method
    logger.warn('Using legacy client-side project creation');
    const { data: projectData, error: projectError } = await supabase.from('projects').insert({
        user_id: userId,
        name: property.name,
        vision_statement: property.visionStatement,
        project_chat_history: property.projectChatHistory
    }).select().single();

    if (projectError) throw projectError;

    const roomsToInsert = property.rooms.map(room => ({
        project_id: projectData.id,
        name: room.name,
        photos: room.photos
    }));

    if (roomsToInsert.length > 0) {
        const { error: roomsError } = await supabase.from('rooms').insert(roomsToInsert);
        if (roomsError) throw roomsError;
    }
    
    return getProjectById(projectData.id).then(p => p!);
};

export const deleteProject = async (projectId: string): Promise<void> => {
    if (USE_SERVER_API) {
        logger.info('Deleting project via server API', { projectId });
        await apiDeleteProject(projectId);
        return;
    }
    
    // Legacy client-side method
    logger.warn('Using legacy client-side project deletion');
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;
};


// --- Feed Management ---
export const getFeedForUser = async (userId: string): Promise<FeedPost[]> => {
    // 1. Get user and their friends
    const { data: friendsData, error: friendsError } = await supabase.from('friends').select('user_id_2').eq('user_id_1', userId);
    if (friendsError) throw friendsError;
    const friendIds = friendsData.map(f => f.user_id_2);
    const visibleUserIds = [userId, ...friendIds];

    // 2. Get all posts from visible users
    const { data: postsData, error: postsError } = await supabase
        .from('feed_posts')
        .select('*')
        .in('user_id', visibleUserIds)
        .order('timestamp', { ascending: false });
    if (postsError) throw postsError;

    if (postsData.length === 0) return [];

    const postIds = postsData.map(p => p.id);

    // 3. Get all comments and likes for those posts in parallel
    const [
        { data: commentsData, error: commentsError },
        { data: likesData, error: likesError }
    ] = await Promise.all([
        supabase.from('post_comments').select('*').in('post_id', postIds),
        supabase.from('post_likes').select('*').in('post_id', postIds)
    ]);

    if (commentsError) throw commentsError;
    if (likesError) throw likesError;

    // 4. Map likes and comments to their posts
    return postsData.map(post => {
        const postComments = commentsData
            .filter(c => c.post_id === post.id)
            .map(c => ({...c, userId: c.user_id}));
            
        const postLikes = likesData
            .filter(l => l.post_id === post.id)
            .map(l => l.user_id);
        
        return {
            id: post.id,
            projectId: post.project_id,
            userId: post.user_id,
            timestamp: post.timestamp,
            text: post.text,
            imageUrl: post.image_url,
            projectName: post.project_name,
            roomName: post.room_name,
            likedBy: postLikes,
            comments: postComments,
        };
    });
};

export const addPost = async (post: Omit<FeedPost, 'id' | 'likedBy' | 'comments'>): Promise<void> => {
    const { error } = await supabase.from('feed_posts').insert({
        project_id: post.projectId,
        user_id: post.userId,
        timestamp: post.timestamp,
        text: post.text,
        image_url: post.imageUrl,
        project_name: post.projectName,
        room_name: post.roomName,
    });
    if (error) throw error;
};

export const likePost = async (postId: string, userId: string): Promise<void> => {
    const { error } = await supabase.from('post_likes').insert({ post_id: postId, user_id: userId });
    if (error) throw error;
};

export const unlikePost = async (postId: string, userId: string): Promise<void> => {
    const { error } = await supabase.from('post_likes').delete().match({ post_id: postId, user_id: userId });
    if (error) throw error;
};

export const addCommentToPost = async (postId: string, userId: string, text: string): Promise<void> => {
    const { error } = await supabase.from('post_comments').insert({ post_id: postId, user_id: userId, text: text });
    if (error) throw error;
};


// --- Generic Project Data Mutations ---
export const updateProperty = async (projectId: string, updatedProperty: Property): Promise<void> => {
    if (USE_SERVER_API) {
        logger.info('Updating property via server API', { projectId });
        await apiUpdateProject(projectId, updatedProperty);
        return;
    }
    
    // Legacy client-side method
    logger.warn('Using legacy client-side property update');
    const { error } = await supabase.from('projects')
        .update({
            name: updatedProperty.name,
            vision_statement: updatedProperty.visionStatement,
            project_chat_history: updatedProperty.projectChatHistory
        })
        .eq('id', projectId);
    if (error) throw error;
};

export const addMessageToTaskChat = async (projectId: string, taskId: string, message: ChatMessage): Promise<void> => {
    // This is inefficient but necessary without a proper backend function.
    // In a real app, you'd use an RPC function in Supabase to append to the JSONB array.
    const project = await getProjectById(projectId);
    const task = project?.tasks.find(t => t.id === taskId);
    if (!task) return;
    const newHistory = [...task.chatHistory, message];
    const { error } = await supabase.from('tasks').update({ chat_history: newHistory }).eq('id', taskId);
    if (error) throw error;
};

export const addMessageToProjectChat = async (projectId: string, message: ChatMessage): Promise<void> => {
    const project = await getProjectById(projectId);
    if (!project) return;
    const newHistory = [...project.property.projectChatHistory, message];
    const { error } = await supabase.from('projects').update({ project_chat_history: newHistory }).eq('id', projectId);
    if (error) throw error;
};

export const addRoom = async (projectId: string, roomName: string): Promise<void> => {
    if (USE_SERVER_API) {
        logger.info('Adding room via server API', { projectId, roomName });
        await apiCreateRoom(projectId, roomName);
        return;
    }
    
    // Legacy client-side method
    logger.warn('Using legacy client-side room creation');
    const { error } = await supabase.from('rooms').insert({ project_id: projectId, name: roomName, photos: [] });
    if (error) throw error;
}

export const deleteRoom = async (projectId: string, roomId: string): Promise<void> => {
    if (USE_SERVER_API) {
        logger.info('Deleting room via server API', { roomId });
        await apiDeleteRoom(roomId);
        return;
    }
    
    // Legacy client-side method
    logger.warn('Using legacy client-side room deletion');
    const { error } = await supabase.from('rooms').delete().eq('id', roomId);
    if (error) throw error;
}

export const addPhotoToRoom = async (projectId: string, roomId: string, photoUrl: string): Promise<void> => {
    if (USE_SERVER_API) {
        logger.info('Adding photo to room via server API', { roomId });
        await apiAddPhotoToRoom(roomId, photoUrl);
        return;
    }
    
    // Legacy client-side method
    logger.warn('Using legacy client-side photo addition');
    const project = await getProjectById(projectId);
    const room = project?.property.rooms.find(r => r.id === roomId);
    if (!room) return;
    const newPhotos = [...room.photos, photoUrl];
    const { error } = await supabase.from('rooms').update({ photos: newPhotos }).eq('id', roomId);
    if (error) throw error;
}

export const addTask = async (projectId: string, task: Omit<Task, 'id'>): Promise<void> => {
    if (USE_SERVER_API) {
        logger.info('Adding task via server API', { projectId });
        await apiCreateTask(projectId, task as Task);
        return;
    }
    
    // Legacy client-side method
    logger.warn('Using legacy client-side task creation');
    const room = (await getProjectById(projectId))?.property.rooms.find(r => r.name === task.room);
    const { error } = await supabase.from('tasks').insert({
        project_id: projectId,
        room_id: room?.id,
        title: task.title,
        room: task.room,
        status: task.status,
        priority: task.priority,
        chat_history: task.chatHistory,
        guide: task.guide,
        safety: task.safety,
        materials: task.materials,
        tools: task.tools,
        cost: task.cost,
        time: task.time,
        hiring_info: task.hiringInfo,
        has_been_opened: task.hasBeenOpened,
    });
    if (error) throw error;
}

export const updateTask = async (projectId: string, updatedTask: Task): Promise<void> => {
    if (USE_SERVER_API) {
        logger.info('Updating task via server API', { taskId: updatedTask.id });
        await apiUpdateTask(updatedTask.id, updatedTask);
        return;
    }
    
    // Legacy client-side method
    logger.warn('Using legacy client-side task update');
    const { error } = await supabase.from('tasks').update({
        title: updatedTask.title,
        room: updatedTask.room,
        status: updatedTask.status,
        priority: updatedTask.priority,
        chat_history: updatedTask.chatHistory,
        guide: updatedTask.guide,
        safety: updatedTask.safety,
        materials: updatedTask.materials,
        tools: updatedTask.tools,
        cost: updatedTask.cost,
        time: updatedTask.time,
        hiring_info: updatedTask.hiringInfo,
        has_been_opened: updatedTask.hasBeenOpened,
    }).eq('id', updatedTask.id);
    if (error) throw error;
};

export const deleteTask = async (projectId: string, taskId: string): Promise<void> => {
    if (USE_SERVER_API) {
        logger.info('Deleting task via server API', { taskId });
        await apiDeleteTask(taskId);
        return;
    }
    
    // Legacy client-side method
    logger.warn('Using legacy client-side task deletion');
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
}
