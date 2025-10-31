import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Project, Task, FeedPost, ChatMessage, View, TaskStatus, User, Property, Part } from './types';
import * as projectService from './services/projectService';
import * as authService from './services/authService';
import { generateTaskDetails, getTaskChatResponse, getProjectChatResponse, generateProjectSummary, generateGuidingTaskIntroduction, generateVisionStatement } from './services/geminiService';
import { PropertySetup } from './components/PropertySetup';
import { Auth } from './components/Auth';
import { GlobalNav, FeedPage } from './components/SocialComponents';
import { ProfilePage } from './components/ProfilePage';
import { Header, KanbanColumn, TaskDetailModal, Overview } from './components/AppComponents';
import { RoomProgress } from './components/RoomProgress';
import { ChatWindow } from './components/ChatWindow';
import { Icon } from './components/Icons';
import { ErrorBoundary } from './components/ErrorBoundary';

type AppView = 'setup' | 'main';
type MainView = 'feed' | 'profile' | 'project';

const AppContent: React.FC = () => {
    // Top-level application state
    const [appView, setAppView] = useState<AppView>('main');
    const [mainView, setMainView] = useState<MainView>('project');
    const [session, setSession] = useState<authService.Session | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    
    // User-specific data
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);

    const [isLoading, setIsLoading] = useState(true);

    // Project-specific state
    const [currentProjectView, setCurrentProjectView] = useState<View>(View.ProjectChat);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isTaskChatLoading, setIsTaskChatLoading] = useState(false);
    const [isTaskDetailsLoading, setIsTaskDetailsLoading] = useState(false);
    const [isProjectChatLoading, setIsProjectChatLoading] = useState(false);
    const [projectSummary, setProjectSummary] = useState('');

    const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);

    // -- AUTH & DATA MANAGEMENT --
    useEffect(() => {
        authService.getSession().then(({ data: { session } }) => {
            setSession(session);
            setIsLoading(false);
        });

        const { data: { subscription } } = authService.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchDataForUser = useCallback(async (userId: string) => {
        setIsLoading(true);
        const [user, userProjects, userFeed, allUsersData] = await Promise.all([
            authService.getCurrentUser(),
            projectService.getProjectsForUser(userId),
            projectService.getFeedForUser(userId),
            projectService.getAllUsers(),
        ]);
        setCurrentUser(user);
        setProjects(userProjects);
        setFeedPosts(userFeed);
        setAllUsers(allUsersData);
        if (userProjects.length > 0) {
            setActiveProjectId(currentId => currentId || userProjects[0].id);
            setAppView('main');
        } else {
             setAppView('setup');
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (session?.user) {
            fetchDataForUser(session.user.id);
        } else {
            setCurrentUser(null);
            setProjects([]);
            setFeedPosts([]);
            setAllUsers([]);
            setIsLoading(false);
        }
    }, [session, fetchDataForUser]);
    

    useEffect(() => {
        if (activeProject) {
            const debounceSummary = setTimeout(() => {
                generateProjectSummary(activeProject.property, activeProject.tasks).then(setProjectSummary);
            }, 1500);
            return () => clearTimeout(debounceSummary);
        }
    }, [activeProject]);
    
     useEffect(() => {
        if (activeProject?.property && activeProject.property.projectChatHistory.length > 1) {
            const debounceVision = setTimeout(() => {
                generateVisionStatement(activeProject.property.projectChatHistory).then(vision => {
                    if (activeProject.property.visionStatement !== vision) {
                        projectService.updateProperty(activeProject.id, { ...activeProject.property, visionStatement: vision });
                    }
                });
            }, 2000);
            return () => clearTimeout(debounceVision);
        }
    }, [activeProject]);

    useEffect(() => {
        if (selectedTask && activeProject) {
            const updatedTask = activeProject.tasks.find(t => t.id === selectedTask.id);
            if (updatedTask && JSON.stringify(updatedTask) !== JSON.stringify(selectedTask)) {
                setSelectedTask(updatedTask);
            }
        }
    }, [activeProject, selectedTask]);

    // -- PROJECT HANDLERS --
    const handleProjectCreate = async (newPropertyData: Property) => {
        if (!currentUser) return;
        const initializedProperty: Property = {
            ...newPropertyData,
            projectChatHistory: [{ role: 'model', parts: [{ text: "Hi! I'm your project assistant. Let's dream a little! What kind of feeling are you hoping to create in this space?" }] }]
        };
        const newProject = await projectService.createProject(currentUser.id, initializedProperty);
        setProjects(prev => [...prev, newProject]);
        setActiveProjectId(newProject.id);
        setAppView('main'); 
        setMainView('project'); 
    };

    const handleDeleteProject = async (projectId: string) => {
        if (window.confirm("Are you sure you want to delete this project? This cannot be undone.")) {
            await projectService.deleteProject(projectId);
            setProjects(projects.filter(p => p.id !== projectId));
            if (activeProjectId === projectId) {
                setActiveProjectId(projects.length > 1 ? projects.find(p => p.id !== projectId)!.id : null);
            }
        }
    }

    // -- TASK HANDLERS --
    const handleAddTask = async (title: string, room: string) => {
        if (!activeProject) return;
        const introductoryMessage = await generateGuidingTaskIntroduction(title, room, activeProject.property);
        const newTask: Omit<Task, 'id'> = {
            title, room, status: TaskStatus.ToDo,
            priority: activeProject.tasks.filter(t => t.status === TaskStatus.ToDo).length,
            chatHistory: [introductoryMessage]
        };
        await projectService.addTask(activeProject.id, newTask);
        if (currentUser) await fetchDataForUser(currentUser.id);
    };

    const handleUpdateTask = async (updatedTask: Task) => {
        if (!activeProject) return;
        await projectService.updateTask(activeProject.id, updatedTask);
        if (currentUser) await fetchDataForUser(currentUser.id);
    };
    
    const handleDeleteTask = async (taskId: string) => {
        if (!activeProject) return;
        if (window.confirm("Are you sure you want to delete this task?")) {
            await projectService.deleteTask(activeProject.id, taskId);
            setSelectedTask(null);
            if (currentUser) await fetchDataForUser(currentUser.id);
        }
    };
    
    const handleTaskDrag = async (e: React.DragEvent<HTMLDivElement>, status: TaskStatus) => {
        if (!activeProject) return;
        e.preventDefault();
        const taskId = e.dataTransfer.getData("taskId");
        const taskToMove = activeProject.tasks.find(t => t.id === taskId);
        if (taskToMove && taskToMove.status !== status) {
            await handleUpdateTask({ ...taskToMove, status });
        }
    };

    // -- ROOM HANDLERS --
    const handleAddRoom = async (roomName: string) => {
        if (roomName && activeProject) {
            await projectService.addRoom(activeProject.id, roomName);
            if (currentUser) await fetchDataForUser(currentUser.id);
        }
    }

    const handleDeleteRoom = async (roomId: string) => {
        if (window.confirm("Are you sure you want to delete this room and all its tasks? This cannot be undone.") && activeProject) {
            await projectService.deleteRoom(activeProject.id, roomId);
            if (currentUser) await fetchDataForUser(currentUser.id);
        }
    }
    
    const handleAddPhotoToRoom = async (roomId: string, photoDataUrl: string) => {
        if (activeProject) {
            const imageUrl = await projectService.uploadImage(photoDataUrl, `room_${roomId}_${Date.now()}`);
            await projectService.addPhotoToRoom(activeProject.id, roomId, imageUrl);
            if (currentUser) await fetchDataForUser(currentUser.id);
        }
    };

    // -- GEMINI & BACKEND API HANDLERS --
    const handleTaskSendMessage = async (taskId: string, parts: Part[]) => {
        if (!activeProject || !currentUser) return;

        // Handle image uploads before creating message
        const processedParts = await Promise.all(parts.map(async part => {
            if (part.inlineData) {
                const imageUrl = await projectService.uploadImage(
                    `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    `task_${taskId}_${Date.now()}`
                );
                // Return a text part with the URL, as Gemini can handle image URLs
                return { text: `Image uploaded: ${imageUrl}` };
            }
            return part;
        }));
        
        const userMessage: ChatMessage = { role: 'user', parts: processedParts };

        // Optimistic UI update
        const taskForUI = activeProject.tasks.find(t => t.id === taskId)!;
        const updatedTaskForUI = { ...taskForUI, chatHistory: [...taskForUI.chatHistory, userMessage] };
        setSelectedTask(updatedTaskForUI);
        setProjects(projects.map(p => p.id === activeProjectId ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? updatedTaskForUI : t) } : p));
        
        await projectService.addMessageToTaskChat(activeProject.id, taskId, userMessage);
        setIsTaskChatLoading(true);

        try {
            const freshProject = await projectService.getProjectById(activeProject.id);
            if (!freshProject) throw new Error("Project not found");
            const freshTask = freshProject.tasks.find(t => t.id === taskId)!;
            const modelResponse = await getTaskChatResponse(freshTask, freshTask.chatHistory, freshProject.property);
            
            let responseText = (modelResponse.parts[0] as {text: string}).text;

            if (responseText.includes('[GENERATE_PLAN]')) {
                responseText = responseText.replace('[GENERATE_PLAN]', '').trim();
                modelResponse.parts = [{text: responseText}];
                await projectService.addMessageToTaskChat(activeProject.id, taskId, modelResponse);
                const projectForPlan = await projectService.getProjectById(activeProject.id);
                const taskForPlan = projectForPlan!.tasks.find(t=>t.id === taskId)!;
                await handleGenerateTaskDetails(taskForPlan);

            } else if (responseText.includes('[UPDATE_PLAN]')) {
                const commandRegex = /\[UPDATE_PLAN\]\s*({[\s\S]*?})/;
                const match = responseText.match(commandRegex);
                if (match && match[1]) {
                    try {
                        const planUpdate = JSON.parse(match[1]);
                        const projectForUpdate = await projectService.getProjectById(activeProject.id);
                        const taskToUpdate = projectForUpdate!.tasks.find(t=>t.id === taskId)!;
                        await handleUpdateTask({ ...taskToUpdate, ...planUpdate });
                    } catch (e) { console.error("Failed to parse plan update JSON", e); }
                }
                responseText = responseText.replace(commandRegex, '').trim();
                modelResponse.parts = [{text: responseText}];
                await projectService.addMessageToTaskChat(activeProject.id, taskId, modelResponse);

            } else {
                await projectService.addMessageToTaskChat(activeProject.id, taskId, modelResponse);
            }
            
            // Seamlessly update only this project in state (no full refresh)
            const updatedProject = await projectService.getProjectById(activeProject.id);
            if (updatedProject) {
                setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
                const updatedTask = updatedProject.tasks.find(t => t.id === taskId);
                if (updatedTask) setSelectedTask(updatedTask);
            }
        } catch (error) {
            console.error(error);
            const errorMessage: ChatMessage = { role: 'model', parts: [{ text: "Sorry, I couldn't get a response. Please try again." }] };
            await projectService.addMessageToTaskChat(activeProject.id, taskId, errorMessage);
            
            // Update state with error message
            const updatedProject = await projectService.getProjectById(activeProject.id);
            if (updatedProject) {
                setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
                const updatedTask = updatedProject.tasks.find(t => t.id === taskId);
                if (updatedTask) setSelectedTask(updatedTask);
            }
        } finally {
            setIsTaskChatLoading(false);
        }
    };
    
    const handleProjectSendMessage = async (parts: Part[]) => {
        if (!activeProject || !currentUser) return;
        
         const processedParts = await Promise.all(parts.map(async part => {
            if (part.inlineData) {
                const imageUrl = await projectService.uploadImage(
                    `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                    `project_${activeProject.id}_${Date.now()}`
                );
                return { text: `Image uploaded: ${imageUrl}` };
            }
            return part;
        }));

        const userMessage: ChatMessage = { role: 'user', parts: processedParts };
        
        // Optimistic update
        const updatedHistory = [...activeProject.property.projectChatHistory, userMessage];
        setProjects(projects.map(p => p.id === activeProjectId ? { ...p, property: {...p.property, projectChatHistory: updatedHistory} } : p));
        setIsProjectChatLoading(true);

        await projectService.addMessageToProjectChat(activeProject.id, userMessage);
        
        try {
             const freshProject = await projectService.getProjectById(activeProject.id);
            if (!freshProject) throw new Error("Project not found");
            const modelResponse = await getProjectChatResponse(freshProject.property.projectChatHistory, freshProject.property, freshProject.tasks);

            const responseText = (modelResponse.parts[0] as {text: string}).text;
            const suggestionRegex = /\[SUGGEST_TASK:(.*?})\]/g;
            const suggestions = [];
            const cleanText = responseText.replace(suggestionRegex, (match, json) => {
                try {
                    suggestions.push(JSON.parse(json));
                } catch (e) { console.error("Failed to parse task suggestion", e) }
                return ''; // Remove from text
            }).trim();

            const finalModelResponse: ChatMessage = { role: 'model', parts: [{ text: cleanText }] };
            if (suggestions.length > 0) finalModelResponse.suggestions = suggestions;
            await projectService.addMessageToProjectChat(activeProject.id, finalModelResponse);
            
            // Seamlessly update only this project in state (no full refresh)
            const updatedProject = await projectService.getProjectById(activeProject.id);
            if (updatedProject) {
                setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
            }
        } catch (error) {
            console.error(error);
            const errorMessage: ChatMessage = { role: 'model', parts: [{ text: "Sorry, I couldn't get a response. Please try again." }] };
            await projectService.addMessageToProjectChat(activeProject.id, errorMessage);
            
            // Update state with error message
            const updatedProject = await projectService.getProjectById(activeProject.id);
            if (updatedProject) {
                setProjects(projects.map(p => p.id === updatedProject.id ? updatedProject : p));
            }
        } finally {
            setIsProjectChatLoading(false);
        }
    };

    const handleGenerateTaskDetails = async (task: Task) => {
        if (!activeProject) return;
        setIsTaskDetailsLoading(true);
        try {
            const details = await generateTaskDetails(task, activeProject.property);
            await handleUpdateTask({ ...task, ...details });
        } catch (error) {
            console.error("Failed to generate task details", error);
        } finally {
            setIsTaskDetailsLoading(false);
        }
    };
    
    // --- SOCIAL & FRIEND HANDLERS ---
    const [postPrompt, setPostPrompt] = useState<string | null>(null);
    const handleCreatePost = async (text: string, imageDataUrl: string | null) => {
        if (!activeProject || !currentUser) return;
        
        let imageUrl: string | undefined = undefined;
        if (imageDataUrl) {
            imageUrl = await projectService.uploadImage(imageDataUrl, `post_${currentUser.id}_${Date.now()}`);
        }

        const newPost: Omit<FeedPost, 'id' | 'likedBy' | 'comments'> = {
            projectId: activeProject.id,
            userId: currentUser.id,
            timestamp: new Date().toISOString(),
            text,
            imageUrl: imageUrl,
            roomName: activeProject.property.rooms[0]?.name || 'General',
            projectName: activeProject.property.name,
        };
        await projectService.addPost(newPost);
        if (currentUser) await fetchDataForUser(currentUser.id);
        setMainView('feed');
        setPostPrompt(null);
    };

    const handleLikePost = async (postId: string) => {
        if (!currentUser) return;
        const post = feedPosts.find(p => p.id === postId);
        const hasLiked = post?.likedBy.includes(currentUser.id);

        if (hasLiked) {
            await projectService.unlikePost(postId, currentUser.id);
        } else {
            await projectService.likePost(postId, currentUser.id);
        }
        if (currentUser) await fetchDataForUser(currentUser.id);
    };

    const handleAddComment = async (postId: string, text: string) => {
        if (!currentUser) return;
        await projectService.addCommentToPost(postId, currentUser.id, text);
        if (currentUser) await fetchDataForUser(currentUser.id);
    };

    const handleAddFriend = async (friendId: string) => {
        if(!currentUser) return;
        await projectService.addFriend(currentUser.id, friendId);
        if (currentUser) await fetchDataForUser(currentUser.id);
    }
    const handleRemoveFriend = async (friendId: string) => {
        if(!currentUser) return;
        await projectService.removeFriend(currentUser.id, friendId);
        if (currentUser) await fetchDataForUser(currentUser.id);
    }
    
    const handleUpdateProfile = async (updates: Partial<User>) => {
        if (!currentUser) return;
        const updatedUser = await authService.updateUserProfile(currentUser.id, updates);
        if (updatedUser && currentUser) {
            setCurrentUser({ ...currentUser, ...updatedUser });
        }
    };

    // -- RENDER LOGIC --
    const { totalSpent, totalEstimated } = useMemo(() => {
        let spent = 0; let estimated = 0;
        if (activeProject) {
            activeProject.tasks.forEach(task => {
                task.materials?.forEach(mat => { if(mat.cost) { estimated += mat.cost; if(mat.completed) spent += mat.cost; } });
                task.tools?.forEach(tool => { if(tool.cost && !tool.owned) { estimated += tool.cost; } });
            });
        }
        return { totalSpent: spent, totalEstimated: estimated };
    }, [activeProject]);
    
    if (isLoading) {
        return <div className="min-h-screen bg-brand-primary flex items-center justify-center"><Icon name="spinner" className="w-12 h-12 text-white animate-spin" /></div>;
    }
    
    if (!session) {
        return <Auth />;
    }
    
    if (appView === 'setup') return <PropertySetup onPropertyCreate={handleProjectCreate} />;

    const renderProjectView = () => {
        if (!activeProject) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <Icon name="home" className="w-24 h-24 text-gray-300 mb-4" />
                    <h2 className="text-2xl font-bold text-brand-dark">No Project Selected</h2>
                    <p className="text-gray-600 mt-2">Create your first project to get started!</p>
                     <button onClick={() => setAppView('setup')} className="mt-4 px-6 py-2 bg-brand-accent text-white rounded-md hover:bg-yellow-500 transition-colors">Create a Project</button>
                </div>
            )
        }
        
        const taskStatusesToDisplay = [TaskStatus.ToDo, TaskStatus.InProgress, TaskStatus.Complete];
        return (
            <>
              {currentProjectView === View.Dashboard && (
                    <div className="flex gap-4 p-4 h-full overflow-x-auto">
                        {taskStatusesToDisplay.map(status => (
                            <KanbanColumn
                                key={status}
                                title={status}
                                tasks={activeProject.tasks.filter(t => t.status === status)}
                                onTaskClick={(task) => setSelectedTask(task)}
                                onDragStart={(e, taskId) => e.dataTransfer.setData("taskId", taskId)}
                                onDrop={handleTaskDrag}
                            />
                        ))}
                    </div>
              )}
              {currentProjectView === View.Overview && <Overview property={activeProject.property} tasks={activeProject.tasks} summary={projectSummary} />}
              {currentProjectView === View.RoomProgress && <RoomProgress property={activeProject.property} tasks={activeProject.tasks} onAddRoom={handleAddRoom} onDeleteRoom={handleDeleteRoom} onAddPhotoToRoom={handleAddPhotoToRoom} />}
              {currentProjectView === View.ProjectChat && <div className="p-4 h-full"><ChatWindow messages={activeProject.property.projectChatHistory} onSendMessage={handleProjectSendMessage} isLoading={isProjectChatLoading} title="Project Vision Assistant" placeholder="Ask about your project..." onAddTask={handleAddTask} /></div>}
            </>
        )
    };

    if (!currentUser) {
       return <div className="min-h-screen bg-brand-primary flex items-center justify-center"><Icon name="spinner" className="w-12 h-12 text-white animate-spin" /></div>;
    }

    return (
        <div className="h-screen w-screen bg-gray-100 flex flex-col">
            <GlobalNav activeView={mainView} setView={setMainView} user={currentUser} />
            <main className="flex-1 overflow-hidden">
                {mainView === 'feed' && <FeedPage posts={feedPosts} allUsers={allUsers} currentUser={currentUser} activeProject={activeProject} onCreatePost={handleCreatePost} onLikePost={handleLikePost} onAddComment={handleAddComment} postPrompt={postPrompt} onStartProject={() => setAppView('setup')} />}
                {mainView === 'profile' && <ProfilePage user={currentUser} projects={projects} allUsers={allUsers} onSetActiveProject={setActiveProjectId} onStartNewProject={() => setAppView('setup')} onDeleteProject={handleDeleteProject} onAddFriend={handleAddFriend} onRemoveFriend={handleRemoveFriend} onUpdateProfile={handleUpdateProfile} />}
                {mainView === 'project' && (
                    <div className="flex flex-col h-full">
                        {activeProject ? (
                            <>
                            <Header 
                                propertyName={activeProject.property.name} 
                                currentView={currentProjectView} 
                                setView={setCurrentProjectView}
                                totalSpent={totalSpent}
                                totalEstimated={totalEstimated}
                            />
                            <div className="flex-1 overflow-y-auto bg-gray-200">
                                {renderProjectView()}
                            </div>
                            </>
                        ) : renderProjectView() }
                    </div>
                )}
            </main>
            {selectedTask && activeProject && (
                <TaskDetailModal 
                    task={selectedTask} 
                    onClose={() => setSelectedTask(null)}
                    onUpdateTask={handleUpdateTask}
                    onSendMessage={handleTaskSendMessage}
                    isChatLoading={isTaskChatLoading}
                    isDetailsLoading={isTaskDetailsLoading}
                    onDeleteTask={handleDeleteTask}
                    onPromptToPost={(promptText) => {
                        setPostPrompt(promptText);
                        setMainView('feed');
                    }}
                    onAddPhotoToRoom={handleAddPhotoToRoom}
                />
            )}
        </div>
    );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;