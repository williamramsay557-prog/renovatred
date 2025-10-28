import React, { useMemo, useState, useEffect } from 'react';
import { Task, TaskStatus, ChecklistItem, MaterialItem, ToolItem, Property, View, Part } from '../types';
import { Icon } from './Icons';
import { ChatWindow } from './ChatWindow';

// Simple Markdown Renderer
const Markdown: React.FC<{ content: string }> = ({ content }) => {
    const renderMarkdown = (text: string) => {
        // Escape HTML to prevent injection
        let escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Process markdown in a specific order
        // Headers
        escapedText = escapedText.replace(/^### (.*$)/gim, '<h3 class="text-md font-semibold mt-1 mb-0.5">$1</h3>');
        escapedText = escapedText.replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-2 mb-1">$1</h2>');
        escapedText = escapedText.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-3 mb-2">$1</h1>');
        
        // Bold and Italic
        escapedText = escapedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        escapedText = escapedText.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Unordered lists
        escapedText = escapedText.replace(/^\s*\n\*/gm, '*'); // handle strange newlines
        escapedText = escapedText.replace(/((?:^\* .*(?:\n|$))+)/gm, (match) => {
            const items = match.trim().split('\n').map(item => `<li>${item.substring(2)}</li>`).join('');
            return `<ul class="list-disc list-inside my-2 ml-4">${items}</ul>`;
        });
        
        // Line breaks
        escapedText = escapedText.replace(/\n/g, '<br />');
        
        // Cleanup: remove <br /> before or after block elements
        escapedText = escapedText.replace(/<br \s*\/?>\s*<(ul|h1|h2|h3|li)/g, '<$1');
        escapedText = escapedText.replace(/<\/(ul|h1|h2|h3|li)>\s*<br \s*\/?>/g, '</$1>');

        return { __html: escapedText };
    };

    return <div className="text-sm markdown-content" dangerouslySetInnerHTML={renderMarkdown(content)} />;
};


// --- HEADER ---
interface HeaderProps {
    propertyName: string;
    currentView: View;
    setView: (view: View) => void;
    totalSpent: number;
    totalEstimated: number;
}
export const Header: React.FC<HeaderProps> = ({ propertyName, currentView, setView, totalSpent, totalEstimated }) => (
    <header className="bg-brand-primary text-white shadow-lg p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <Icon name="wrench" className="w-8 h-8 text-brand-accent" />
            <h1 className="text-2xl font-bold">{propertyName}</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full">
                <Icon name="dollar" className="w-5 h-5 text-green-300"/>
                <span className="text-sm font-medium whitespace-nowrap">£{totalSpent.toFixed(2)} / £{totalEstimated.toFixed(2)}</span>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2">
                <button onClick={() => setView(View.Overview)} title="Overview" className={`p-2 rounded-md transition-colors ${currentView === View.Overview ? 'bg-brand-secondary' : 'hover:bg-brand-secondary/50'}`}><Icon name="overview" className="w-5 h-5" /></button>
                <button onClick={() => setView(View.Dashboard)} title="Task Board" className={`p-2 rounded-md transition-colors ${currentView === View.Dashboard ? 'bg-brand-secondary' : 'hover:bg-brand-secondary/50'}`}><Icon name="kanban" className="w-5 h-5" /></button>
                <button onClick={() => setView(View.RoomProgress)} title="Room Progress" className={`p-2 rounded-md transition-colors ${currentView === View.RoomProgress ? 'bg-brand-secondary' : 'hover:bg-brand-secondary/50'}`}><Icon name="home" className="w-5 h-5" /></button>
                <button onClick={() => setView(View.ProjectChat)} title="Project Chat" className={`p-2 rounded-md transition-colors ${currentView === View.ProjectChat ? 'bg-brand-secondary' : 'hover:bg-brand-secondary/50'}`}><Icon name="chat" className="w-5 h-5" /></button>
            </nav>
        </div>
    </header>
);

// --- TASK CARD ---
interface TaskCardProps { 
    task: Task; 
    onClick: () => void; 
    onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void 
}
const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onDragStart }) => (
  <div 
    onClick={onClick}
    draggable
    onDragStart={(e) => onDragStart(e, task.id)}
    className="bg-white p-4 rounded-lg shadow-md cursor-pointer hover:shadow-xl hover:-translate-y-1 transition-all"
  >
    <h4 className="font-semibold text-brand-dark">{task.title}</h4>
    <p className="text-sm text-gray-500 mt-1">{task.room}</p>
  </div>
);

// --- KANBAN COLUMN ---
interface KanbanColumnProps {
    title: TaskStatus; 
    tasks: Task[]; 
    onTaskClick: (task: Task) => void;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>, status: TaskStatus) => void;
}
export const KanbanColumn: React.FC<KanbanColumnProps> = ({ title, tasks, onTaskClick, onDragStart, onDrop }) => (
  <div 
    onDragOver={(e) => e.preventDefault()}
    onDrop={(e) => onDrop(e, title)}
    className="bg-brand-light rounded-lg p-4 w-full md:w-1/3 flex-shrink-0 flex flex-col"
  >
    <h3 className="font-bold text-lg text-brand-dark mb-4">{title}</h3>
    <div className="space-y-4 overflow-y-auto flex-1 p-1 -m-1">
      {tasks.sort((a,b) => a.priority - b.priority).map(task => (
        <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} onDragStart={onDragStart} />
      ))}
    </div>
  </div>
);

// --- CHECKLIST ---
interface ChecklistProps {
    items: (ChecklistItem | MaterialItem | ToolItem)[]; 
    onToggle: (index: number) => void;
    listType: string;
}
export const Checklist: React.FC<ChecklistProps> = ({ items, onToggle, listType }) => (
    <ul className="space-y-2">
        {items.map((item, index) => (
            <li key={`${listType}-${index}`} className="flex items-center">
                <input
                    type="checkbox"
                    id={`${listType}-item-${index}`}
                    checked={'completed' in item ? item.completed : ('owned' in item ? item.owned : false)}
                    onChange={() => onToggle(index)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-secondary focus:ring-brand-secondary"
                />
                <label htmlFor={`${listType}-item-${index}`} className="ml-3 text-sm text-gray-700 flex-grow">
                    {item.text}
                     {'link' in item && item.link && (
                        <a href={item.link} target="_blank" rel="noopener noreferrer" className="ml-2 text-brand-secondary hover:underline text-xs">(Find online)</a>
                    )}
                </label>
                {'cost' in item && item.cost && <span className="text-xs text-gray-500 ml-2">(est. £{item.cost.toFixed(2)})</span>}
            </li>
        ))}
    </ul>
);

// --- TASK DETAIL MODAL ---
interface TaskDetailModalProps {
    task: Task; 
    onClose: () => void; 
    onUpdateTask: (updatedTask: Task) => void; 
    onSendMessage: (taskId: string, parts: Part[]) => Promise<void>; 
    isChatLoading: boolean;
    isDetailsLoading: boolean;
    onDeleteTask: (taskId: string) => void;
    onPromptToPost: (prompt: string) => void;
    onAddPhotoToRoom: (roomId: string, photoDataUrl: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({ task, onClose, onUpdateTask, onSendMessage, isChatLoading, isDetailsLoading, onDeleteTask, onPromptToPost, onAddPhotoToRoom }) => {
    
    const [showPostPrompt, setShowPostPrompt] = useState<{type: 'start' | 'end'} | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Reset prompt when task changes
        setShowPostPrompt(null);
    }, [task.id]);

    // Prompt user to add a 'before' photo the first time they open a planned task
    useEffect(() => {
        if (task.guide && task.guide.length > 0 && !task.hasBeenOpened) {
            const isNotStarted = (task.guide || []).filter(i => i.completed).length === 0;
            if (isNotStarted) {
                setShowPostPrompt({type: 'start'});
                onUpdateTask({ ...task, hasBeenOpened: true });
            }
        }
    }, [task.id, task.guide, task.hasBeenOpened, onUpdateTask]);

    const handleUpdateChecklist = (section: 'guide' | 'materials' | 'tools', index: number) => {
        const newItems = JSON.parse(JSON.stringify(task[section] || []));
        const item = newItems[index];

        if ('completed' in item) {
             const wasCompleted = item.completed;
             item.completed = !item.completed;
             
             if (item.completed && !wasCompleted && section === 'guide') {
                 const completedCount = newItems.filter((i: ChecklistItem) => i.completed).length;
                 if (completedCount === newItems.length) {
                     setShowPostPrompt({type: 'end'});
                 }
             }
        }
        if ('owned' in item) item.owned = !item.owned;
        
        const updatedTask: Task = { ...task, [section]: newItems };

        if (section === 'guide' && task.guide) {
            const completedCount = newItems.filter((i: ChecklistItem) => i.completed).length;
            const totalCount = newItems.length;
            let newStatus = updatedTask.status;

            if (totalCount > 0) {
                if (completedCount === 0) {
                    newStatus = TaskStatus.ToDo;
                } else if (completedCount === totalCount) {
                    newStatus = TaskStatus.Complete;
                } else {
                    newStatus = TaskStatus.InProgress;
                }
            }

            if (newStatus !== updatedTask.status) {
                updatedTask.status = newStatus;
            }
        }
        
        onUpdateTask(updatedTask);
    };
    
    const handlePhotoForPrompt = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const photoDataUrl = reader.result as string;
                onAddPhotoToRoom(task.room, photoDataUrl);
                const promptText = showPostPrompt?.type === 'start' 
                    ? `Just getting started on '${task.title}' in the ${task.room}. Here's the before shot!`
                    : `Finished '${task.title}' in the ${task.room}! Check out the result.`;
                onPromptToPost(promptText);
                setShowPostPrompt(null);
                onClose();
            };
            reader.readAsDataURL(file);
        }
    };


    const progressText = useMemo(() => {
        if (!task.guide || task.guide.length === 0) return "Plan not generated yet.";
        const total = task.guide.length;
        const completed = task.guide.filter(item => item.completed).length;
        if (completed === 0) return "Not yet started.";
        if (completed === total) return "Task complete!";
        const percentage = (completed / total);
        if (percentage < 0.4) return "Just getting started.";
        if (percentage < 0.8) return "Making good progress.";
        return "Nearly finished!";
    }, [task.guide]);

    const { spent, estimated } = useMemo(() => {
        let spent = 0;
        let estimated = 0;
        task.materials?.forEach(mat => { if(mat.cost) { estimated += mat.cost; if(mat.completed) spent += mat.cost; } });
        task.tools?.forEach(tool => { if(tool.cost && !tool.owned) { estimated += tool.cost; } });
        return { spent, estimated };
    }, [task.materials, task.tools]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex overflow-hidden">
                <div className="w-1/2 lg:w-3/5 p-6 flex flex-col">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-bold text-brand-dark">{task.title}</h2>
                            <p className="text-gray-500 text-lg">{task.room}</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={() => onDeleteTask(task.id)} className="p-2 rounded-full hover:bg-red-100 text-gray-500 hover:text-red-600" title="Delete Task"><Icon name="trash" /></button>
                             <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200" title="Close"><Icon name="close" /></button>
                        </div>
                    </div>
                    
                     {showPostPrompt && (
                        <div className="my-4 p-4 bg-brand-accent/20 border-l-4 border-brand-accent text-yellow-800 rounded-r-lg">
                            <h4 className="font-bold">
                                {showPostPrompt.type === 'start' ? "Let's Get Started!" : "Task Complete!"}
                            </h4>
                            <p className="text-sm">
                                {showPostPrompt.type === 'start' ? "Capture a 'before' photo to track your progress. Add it to your timeline and share it with friends!" : "Great work! Capture the result, add it to your timeline and share the finished product."}
                            </p>
                            <input type="file" ref={fileInputRef} onChange={handlePhotoForPrompt} className="hidden" accept="image/*" />
                            <div className="mt-2 space-x-2">
                                <button onClick={() => fileInputRef.current?.click()} className="text-sm font-semibold bg-brand-accent text-white px-3 py-1 rounded">Add Photo & Post</button>
                                <button onClick={() => setShowPostPrompt(null)} className="text-sm font-semibold text-gray-600">Dismiss</button>
                            </div>
                        </div>
                    )}

                    {task.guide && (
                        <div className="mt-4 p-4 bg-brand-light rounded-lg grid grid-cols-3 gap-4 text-center">
                            <div>
                                <Icon name="check" className="w-6 h-6 mx-auto text-green-600 mb-1" />
                                <span className="text-xs font-semibold text-gray-500 uppercase">Progress</span>
                                <p className="text-sm font-bold text-brand-dark mt-2 h-6 flex items-center justify-center">{progressText}</p>
                            </div>
                            <div>
                                <Icon name="dollar" className="w-6 h-6 mx-auto text-yellow-600 mb-1" />
                                <span className="text-xs font-semibold text-gray-500 uppercase">Cost</span>
                                <p className="text-sm font-bold text-brand-dark mt-2">£{spent.toFixed(2)} / <span className="font-medium text-gray-600">£{estimated.toFixed(2)}</span></p>
                            </div>
                            <div>
                                <Icon name="clock" className="w-6 h-6 mx-auto text-blue-600 mb-1" />
                                <span className="text-xs font-semibold text-gray-500 uppercase">Est. Time</span>
                                <p className="text-sm font-bold text-brand-dark mt-2">{task.time || 'N/A'}</p>
                            </div>
                        </div>
                    )}


                    <div className="mt-6 space-y-6 overflow-y-auto flex-1 pr-2 -mr-2">
                        {isDetailsLoading ? (
                            <div className="flex justify-center items-center h-64">
                                <Icon name="spinner" className="w-12 h-12 text-brand-secondary animate-spin" /><p className="ml-4 text-gray-600">Generating task details...</p>
                            </div>
                        ) : task.guide ? (
                            <>
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Step-by-Step Guide</h3>
                                    <Checklist items={task.guide || []} onToggle={(index) => handleUpdateChecklist('guide', index)} listType="guide" />
                                </div>
                                {task.materials && task.materials.length > 0 && (
                                    <div>
                                        <h3 className="text-xl font-semibold mb-2">Materials</h3>
                                        <Checklist items={task.materials} onToggle={(index) => handleUpdateChecklist('materials', index)} listType="materials" />
                                    </div>
                                )}
                                {task.tools && task.tools.length > 0 && (
                                    <div>
                                        <h3 className="text-xl font-semibold mb-2">Tools</h3>
                                        <Checklist items={task.tools} onToggle={(index) => handleUpdateChecklist('tools', index)} listType="tools" />
                                    </div>
                                )}
                                {task.hiringInfo && (
                                <div>
                                    <h3 className="text-xl font-semibold mb-2">Hiring a Professional</h3>
                                    <div className="text-sm text-gray-700 mb-4 prose">
                                        <Markdown content={task.hiringInfo} />
                                    </div>
                                </div>
                                )}
                            </>
                        ) : <p className="mt-6 text-gray-600 text-center">Answer the assistant's questions in the chat to generate the task plan.</p>}
                    </div>
                </div>
                <div className="w-1/2 lg:w-2/5 border-l h-full">
                    <ChatWindow messages={task.chatHistory} onSendMessage={(parts) => onSendMessage(task.id, parts)} isLoading={isChatLoading} title="Task Assistant" placeholder="Ask about this task..."/>
                </div>
            </div>
        </div>
    );
};


// --- OVERVIEW ---
interface OverviewProps {
    property: Property;
    tasks: Task[];
    summary: string;
}
export const Overview: React.FC<OverviewProps> = ({property, tasks, summary}) => {
    const completed = tasks.filter(t => t.status === TaskStatus.Complete).length;
    const todo = tasks.length - completed;
    return (
        <div className="p-4 sm:p-8 h-full overflow-y-auto">
             <h2 className="text-3xl font-bold text-brand-dark mb-6">Project Overview</h2>
             <div className="bg-white p-6 rounded-lg shadow-md mb-6">
                <h3 className="text-2xl font-semibold text-brand-dark mb-4">AI Summary</h3>
                <p className="text-gray-700 italic">"{summary}"</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-4 rounded-lg shadow"><h4 className="font-bold">Tasks To Do</h4><p className="text-3xl">{todo}</p></div>
                <div className="bg-white p-4 rounded-lg shadow"><h4 className="font-bold">Tasks Completed</h4><p className="text-3xl">{completed}</p></div>
             </div>
        </div>
    )
}