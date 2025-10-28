import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, FeedPost, Property, Project, Comment } from '../types';
import { Icon } from './Icons';

type AppView = 'feed' | 'profile' | 'project';

// --- GLOBAL NAV ---
interface GlobalNavProps {
    activeView: AppView;
    setView: (view: AppView) => void;
    user: User;
}
export const GlobalNav: React.FC<GlobalNavProps> = ({ activeView, setView, user }) => (
    <header className="bg-white text-brand-dark shadow-md p-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-3">
            <Icon name="wrench" className="w-8 h-8 text-brand-primary" />
            <h1 className="text-2xl font-bold text-brand-primary">Renovatr</h1>
        </div>
        <nav className="flex items-center gap-2 sm:gap-4">
            <button 
                onClick={() => setView('feed')} 
                className={`px-3 py-2 rounded-md transition-colors text-sm font-medium ${activeView === 'feed' ? 'bg-brand-secondary text-white' : 'hover:bg-gray-200'}`}
            >
                Feed
            </button>
            <button 
                onClick={() => setView('project')} 
                className={`px-3 py-2 rounded-md transition-colors text-sm font-medium ${activeView === 'project' ? 'bg-brand-secondary text-white' : 'hover:bg-gray-200'}`}
            >
                My Project
            </button>
            <button 
                onClick={() => setView('profile')} 
                className={`px-3 py-2 rounded-md transition-colors text-sm font-medium ${activeView === 'profile' ? 'bg-brand-secondary text-white' : 'hover:bg-gray-200'}`}
            >
                My Profile
            </button>
        </nav>
        <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-sm font-medium">{user.name}</span>
            <img src={user.avatarUrl} alt="User avatar" className="w-8 h-8 rounded-full"/>
        </div>
    </header>
);

// --- CREATE POST ---
interface CreatePostProps {
    user: User;
    activeProject: Project | undefined;
    onCreatePost: (text: string, imageUrl: string | null) => void;
    onStartProject: () => void;
    initialText?: string | null;
}
const CreatePost: React.FC<CreatePostProps> = ({ user, activeProject, onCreatePost, onStartProject, initialText }) => {
    const [text, setText] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if(initialText) {
            setText(initialText);
        }
    }, [initialText]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };
    
    const handleSubmit = () => {
        if (!activeProject || (!text.trim() && !imagePreview)) return;
        onCreatePost(text, imagePreview);
        setText('');
        setImagePreview(null);
        if(fileInputRef.current) fileInputRef.current.value = "";
    };

    const isDisabled = !activeProject;

    return (
        <div className="bg-white rounded-lg shadow-md p-4 relative">
            {isDisabled && (
                <div className="absolute inset-0 bg-white/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-lg">
                    <p className="font-semibold text-brand-dark">Want to share your progress?</p>
                    <button onClick={onStartProject} className="mt-2 px-4 py-2 bg-brand-accent text-white rounded-md hover:bg-yellow-500 transition-colors text-sm">
                        Start a Project to Post
                    </button>
                </div>
            )}
            <div className="flex items-start gap-3">
                <img src={user.avatarUrl} alt={user.name} className="w-10 h-10 rounded-full" />
                <textarea 
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="What's on your mind?"
                    className="w-full h-24 p-2 border rounded-md focus:ring-brand-secondary focus:border-brand-secondary"
                    disabled={isDisabled}
                />
            </div>
            {imagePreview && (
                <div className="mt-3 relative w-32 h-32">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-md" />
                    <button onClick={() => setImagePreview(null)} className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full p-1">
                        <Icon name="close" className="w-4 h-4" />
                    </button>
                </div>
            )}
            <div className="flex justify-between items-center mt-3">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full text-gray-500 hover:bg-gray-200" disabled={isDisabled}>
                    <Icon name="camera" />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" disabled={isDisabled}/>
                <button onClick={handleSubmit} disabled={isDisabled || (!text.trim() && !imagePreview)} className="px-4 py-2 bg-brand-secondary text-white rounded-md hover:bg-brand-primary disabled:bg-gray-400">Post</button>
            </div>
        </div>
    )
}

// --- POST CARD ---
interface PostCardProps {
    post: FeedPost;
    allUsers: User[];
    currentUser: User;
    onLike: (postId: string) => void;
    onComment: (postId: string, text: string) => void;
}
const PostCard: React.FC<PostCardProps> = ({ post, allUsers, currentUser, onLike, onComment }) => {
    const [commentText, setCommentText] = useState('');
    const hasLiked = post.likedBy.includes(currentUser.id);
    const author = useMemo(() => allUsers.find(u => u.id === post.userId), [allUsers, post.userId]);

    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!commentText.trim()) return;
        onComment(post.id, commentText);
        setCommentText('');
    }
    
    if (!author) return null; // Don't render post if author not found

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-4">
                <div className="flex items-center gap-3">
                    <img src={author.avatarUrl} alt={author.name} className="w-10 h-10 rounded-full" />
                    <div>
                        <p className="font-semibold">{author.name}</p>
                        <p className="text-xs text-gray-500">{new Date(post.timestamp).toLocaleString()}</p>
                    </div>
                </div>
                <p className="mt-3 text-gray-800">{post.text}</p>
            </div>
            {post.imageUrl && <img src={post.imageUrl} alt="Post image" className="w-full h-auto bg-gray-100" />}
             <div className="px-4 pt-3">
                <p className="text-sm text-gray-600">Project: <span className="font-semibold text-brand-secondary">{post.projectName}</span> / Room: <span className="font-semibold text-brand-secondary">{post.roomName}</span></p>
                <div className="flex items-center gap-4 mt-2">
                    <button onClick={() => onLike(post.id)} className={`flex items-center gap-1 text-sm ${hasLiked ? 'text-red-500' : 'text-gray-500'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-1.344-.905 60.46 60.46 0 01-3.033-2.257 4.587 4.587 0 01-2.023-3.419c0-.832.32-1.603.9-2.206l.03-.031c.246-.265.55-.494.885-.693a4.5 4.5 0 012.005-.733l.25-.028A2.25 2.25 0 0112 5.25a2.25 2.25 0 012.23-2.024l.25.028a4.5 4.5 0 012.005.733c.336.199.64.428.885.693l.03.031c.58.603.9 1.374.9 2.206 0 1.353-.758 2.592-1.872 3.285a4.587 4.587 0 01-2.023 3.419 60.459 60.459 0 01-3.033 2.257 15.247 15.247 0 01-1.344.905l-.022.012-.007.003z" /></svg>
                        {post.likedBy.length}
                    </button>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Icon name="chat" className="w-5 h-5" />
                        {post.comments.length}
                    </div>
                </div>
            </div>
            <div className="p-4 border-t mt-3">
                <div className="space-y-3">
                    {post.comments.map((comment) => {
                        const commentAuthor = allUsers.find(u => u.id === comment.userId);
                        if (!commentAuthor) return null;
                        return (
                            <div key={comment.id} className="flex items-start gap-2 text-sm">
                                <img src={commentAuthor.avatarUrl} alt={commentAuthor.name} className="w-6 h-6 rounded-full mt-0.5" />
                                <div className="bg-gray-100 px-3 py-1.5 rounded-lg">
                                    <span className="font-semibold">{commentAuthor.name}</span>
                                    <p className="text-gray-700">{comment.text}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
                <form onSubmit={handleCommentSubmit} className="flex items-center gap-2 mt-4">
                    <img src={currentUser.avatarUrl} alt={currentUser.name} className="w-8 h-8 rounded-full" />
                    <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment..." className="w-full text-sm px-3 py-2 border rounded-full focus:ring-1 focus:ring-brand-secondary"/>
                </form>
            </div>
        </div>
    );
}

// --- FEED PAGE ---
interface FeedPageProps {
    posts: FeedPost[];
    allUsers: User[];
    currentUser: User;
    activeProject: Project | undefined;
    onLikePost: (postId: string) => void;
    onAddComment: (postId: string, text: string) => void;
    onCreatePost: (text: string, imageUrl: string | null) => void;
    onStartProject: () => void;
    postPrompt?: string | null;
}
export const FeedPage: React.FC<FeedPageProps> = ({ posts, allUsers, currentUser, activeProject, onLikePost, onAddComment, onCreatePost, onStartProject, postPrompt }) => (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
        <CreatePost user={currentUser} activeProject={activeProject} onCreatePost={onCreatePost} onStartProject={onStartProject} initialText={postPrompt} />
        {posts.map(post => (
            <PostCard key={post.id} post={post} allUsers={allUsers} currentUser={currentUser} onLike={onLikePost} onComment={onAddComment} />
        ))}
    </div>
);

// --- PROFILE PAGE ---
interface ProfilePageProps {
    user: User;
    projects: Project[];
    allUsers: User[];
    onSetActiveProject: (projectId: string) => void;
    onStartNewProject: () => void;
    onDeleteProject: (projectId: string) => void;
    onAddFriend: (friendId: string) => void;
    onRemoveFriend: (friendId: string) => void;
}
export const ProfilePage: React.FC<ProfilePageProps> = ({ user, projects, allUsers, onSetActiveProject, onStartNewProject, onDeleteProject, onAddFriend, onRemoveFriend }) => (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
             <div className="bg-white rounded-lg shadow-md p-6 flex flex-col items-center text-center">
                <img src={user.avatarUrl} alt={user.name} className="w-24 h-24 rounded-full border-4 border-brand-secondary" />
                <h2 className="text-2xl font-bold text-brand-dark mt-4">{user.name}</h2>
                <p className="text-gray-600">DIY Enthusiast & Home Improver</p>
            </div>
            <div className="mt-8 bg-white rounded-lg shadow-md p-6">
                <h3 className="text-xl font-bold text-brand-dark mb-4">Friends</h3>
                <div className="space-y-3">
                    {allUsers.filter(u => user.friendIds.includes(u.id)).map(friend => (
                        <div key={friend.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <img src={friend.avatarUrl} className="w-8 h-8 rounded-full" />
                                <span className="text-sm font-medium">{friend.name}</span>
                            </div>
                            <button onClick={()=> onRemoveFriend(friend.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                        </div>
                    ))}
                </div>
                 <h4 className="font-semibold text-brand-dark mt-6 mb-2 text-sm">Add Friends</h4>
                 <div className="space-y-3">
                     {allUsers.filter(u => !user.friendIds.includes(u.id) && u.id !== user.id).map(otherUser => (
                        <div key={otherUser.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <img src={otherUser.avatarUrl} className="w-8 h-8 rounded-full" />
                                <span className="text-sm font-medium">{otherUser.name}</span>
                            </div>
                            <button onClick={()=> onAddFriend(otherUser.id)} className="text-xs text-blue-500 hover:underline">Add</button>
                        </div>
                    ))}
                 </div>
            </div>
        </div>
        <div className="md:col-span-2">
            <div className="flex justify-between items-center mb-4">
                 <h3 className="text-2xl font-bold text-brand-dark">My Projects</h3>
                 <button onClick={onStartNewProject} className="px-4 py-2 bg-brand-accent text-white rounded-md hover:bg-yellow-500 transition-colors text-sm font-medium">
                    New Project
                </button>
            </div>
            <div className="space-y-4">
                {projects.length > 0 ? projects.map(project => (
                    <div key={project.id} className="bg-white rounded-lg shadow-md p-4 flex items-center justify-between">
                        <div>
                            <h4 className="text-lg font-semibold">{project.property.name}</h4>
                            <p className="text-gray-500 mt-1 text-sm">{project.property.rooms.length} rooms / {project.tasks.length} tasks</p>
                        </div>
                        <div className="flex items-center gap-2">
                             <button 
                                onClick={() => onDeleteProject(project.id)}
                                className="p-2 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600"
                            >
                                <Icon name="trash" className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => onSetActiveProject(project.id)}
                                className="px-4 py-2 bg-brand-secondary text-white rounded-md hover:bg-brand-primary transition-colors text-sm"
                            >
                                Open
                            </button>
                        </div>
                    </div>
                )) : (
                    <div className="text-center bg-white rounded-lg shadow-md p-8">
                        <Icon name="home" className="w-12 h-12 mx-auto text-gray-300" />
                        <p className="mt-4 text-gray-700">You haven't started a project yet.</p>
                    </div>
                )}
            </div>
        </div>
    </div>
);