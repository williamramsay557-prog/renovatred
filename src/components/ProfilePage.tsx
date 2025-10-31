import React, { useState } from 'react';
import { User, Project, UserPreferences } from '../types';
import { Icon } from './Icons';

interface ProfilePageProps {
    user: User;
    projects: Project[];
    allUsers: User[];
    onSetActiveProject: (projectId: string) => void;
    onStartNewProject: () => void;
    onDeleteProject: (projectId: string) => void;
    onAddFriend: (friendId: string) => void;
    onRemoveFriend: (friendId: string) => void;
    onUpdateProfile: (updates: Partial<User>) => void;
}

type TabType = 'overview' | 'settings' | 'preferences' | 'account';

export const ProfilePage: React.FC<ProfilePageProps> = ({ 
    user, 
    projects, 
    allUsers, 
    onSetActiveProject, 
    onStartNewProject, 
    onDeleteProject, 
    onAddFriend, 
    onRemoveFriend,
    onUpdateProfile 
}) => {
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isEditing, setIsEditing] = useState(false);
    const [editedBio, setEditedBio] = useState(user.preferences?.bio || '');
    const [editedLocation, setEditedLocation] = useState(user.preferences?.location || '');
    
    // Get default preferences if not set
    const preferences: UserPreferences = user.preferences || {
        skillLevel: 'intermediate',
        budgetRange: 'moderate',
        measurementUnit: 'metric',
        notifications: {
            email: true,
            taskReminders: true,
            friendActivity: true,
            weeklyDigest: false,
        },
        privacy: {
            profileVisibility: 'public',
            showProjects: true,
            showProgress: true,
        },
    };

    const handleSaveProfile = () => {
        onUpdateProfile({
            preferences: {
                ...preferences,
                bio: editedBio,
                location: editedLocation,
            }
        });
        setIsEditing(false);
    };

    const handlePreferenceUpdate = (updates: Partial<UserPreferences>) => {
        onUpdateProfile({
            preferences: { ...preferences, ...updates }
        });
    };

    const handleNotificationToggle = (key: keyof UserPreferences['notifications']) => {
        handlePreferenceUpdate({
            notifications: {
                ...preferences.notifications,
                [key]: !preferences.notifications[key],
            }
        });
    };

    const handlePrivacyToggle = (key: keyof UserPreferences['privacy'], value: any) => {
        handlePreferenceUpdate({
            privacy: {
                ...preferences.privacy,
                [key]: value,
            }
        });
    };

    const tabs = [
        { id: 'overview' as TabType, label: 'Overview', icon: 'user' },
        { id: 'settings' as TabType, label: 'Settings', icon: 'settings' },
        { id: 'preferences' as TabType, label: 'Preferences', icon: 'star' },
        { id: 'account' as TabType, label: 'Account', icon: 'lock' },
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="space-y-6">
                        {/* Profile Card */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex flex-col sm:flex-row items-center gap-6">
                                <img src={user.avatarUrl} alt={user.name} className="w-32 h-32 rounded-full border-4 border-brand-secondary" />
                                <div className="flex-1 text-center sm:text-left">
                                    <h2 className="text-3xl font-bold text-brand-dark">{user.name}</h2>
                                    {preferences.location && (
                                        <p className="text-gray-600 flex items-center justify-center sm:justify-start gap-1 mt-1">
                                            <Icon name="location" className="w-4 h-4" />
                                            {preferences.location}
                                        </p>
                                    )}
                                    <div className="mt-3 flex items-center justify-center sm:justify-start gap-2">
                                        <span className="px-3 py-1 bg-brand-light text-brand-dark text-sm rounded-full font-medium capitalize">
                                            {preferences.skillLevel} DIYer
                                        </span>
                                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                                            {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
                                        </span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsEditing(!isEditing)}
                                    className="px-4 py-2 border border-brand-secondary text-brand-secondary rounded-md hover:bg-brand-light transition-colors"
                                >
                                    {isEditing ? 'Cancel' : 'Edit Profile'}
                                </button>
                            </div>
                            
                            {isEditing ? (
                                <div className="mt-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                                        <textarea
                                            value={editedBio}
                                            onChange={(e) => setEditedBio(e.target.value)}
                                            placeholder="Tell us about yourself and your DIY journey..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-secondary focus:border-transparent"
                                            rows={4}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                                        <input
                                            type="text"
                                            value={editedLocation}
                                            onChange={(e) => setEditedLocation(e.target.value)}
                                            placeholder="e.g., London, UK"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-secondary focus:border-transparent"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSaveProfile}
                                        className="px-6 py-2 bg-brand-secondary text-white rounded-md hover:bg-brand-primary transition-colors"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            ) : preferences.bio ? (
                                <div className="mt-6">
                                    <p className="text-gray-700">{preferences.bio}</p>
                                </div>
                            ) : null}
                        </div>

                        {/* Friends Section */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-xl font-bold text-brand-dark mb-4 flex items-center gap-2">
                                <Icon name="users" className="w-6 h-6" />
                                Friends ({allUsers.filter(u => user.friendIds.includes(u.id)).length})
                            </h3>
                            <div className="space-y-3">
                                {allUsers.filter(u => user.friendIds.includes(u.id)).map(friend => (
                                    <div key={friend.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md">
                                        <div className="flex items-center gap-3">
                                            <img src={friend.avatarUrl} className="w-10 h-10 rounded-full" alt={friend.name} />
                                            <span className="font-medium">{friend.name}</span>
                                        </div>
                                        <button 
                                            onClick={() => onRemoveFriend(friend.id)} 
                                            className="text-sm text-red-500 hover:underline"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ))}
                                {allUsers.filter(u => user.friendIds.includes(u.id)).length === 0 && (
                                    <p className="text-gray-500 text-center py-4">No friends yet. Add some below!</p>
                                )}
                            </div>
                            
                            <h4 className="font-semibold text-brand-dark mt-6 mb-3">Add Friends</h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {allUsers.filter(u => !user.friendIds.includes(u.id) && u.id !== user.id).map(otherUser => (
                                    <div key={otherUser.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md">
                                        <div className="flex items-center gap-3">
                                            <img src={otherUser.avatarUrl} className="w-10 h-10 rounded-full" alt={otherUser.name} />
                                            <span className="font-medium">{otherUser.name}</span>
                                        </div>
                                        <button 
                                            onClick={() => onAddFriend(otherUser.id)} 
                                            className="text-sm text-brand-secondary hover:underline font-medium"
                                        >
                                            Add
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Projects Section */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-brand-dark flex items-center gap-2">
                                    <Icon name="home" className="w-6 h-6" />
                                    My Projects
                                </h3>
                                <button 
                                    onClick={onStartNewProject} 
                                    className="px-4 py-2 bg-brand-accent text-white rounded-md hover:bg-yellow-500 transition-colors text-sm font-medium"
                                >
                                    New Project
                                </button>
                            </div>
                            <div className="space-y-3">
                                {projects.length > 0 ? projects.map(project => (
                                    <div key={project.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:border-brand-secondary transition-colors">
                                        <div>
                                            <h4 className="text-lg font-semibold">{project.property.name}</h4>
                                            <p className="text-gray-500 text-sm mt-1">
                                                {project.property.rooms.length} rooms • {project.tasks.length} tasks
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => onDeleteProject(project.id)}
                                                className="p-2 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                                                title="Delete project"
                                            >
                                                <Icon name="trash" className="w-5 h-5" />
                                            </button>
                                            <button 
                                                onClick={() => onSetActiveProject(project.id)}
                                                className="px-4 py-2 bg-brand-secondary text-white rounded-md hover:bg-brand-primary transition-colors"
                                            >
                                                Open
                                            </button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-12">
                                        <Icon name="home" className="w-16 h-16 mx-auto text-gray-300" />
                                        <p className="mt-4 text-gray-700">You haven't started a project yet.</p>
                                        <button 
                                            onClick={onStartNewProject}
                                            className="mt-4 px-6 py-2 bg-brand-accent text-white rounded-md hover:bg-yellow-500 transition-colors"
                                        >
                                            Start Your First Project
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );

            case 'settings':
                return (
                    <div className="space-y-6">
                        {/* Notification Settings */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-xl font-bold text-brand-dark mb-4 flex items-center gap-2">
                                <Icon name="bell" className="w-6 h-6" />
                                Notifications
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Email Notifications</p>
                                        <p className="text-sm text-gray-600">Receive updates via email</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={preferences.notifications.email}
                                            onChange={() => handleNotificationToggle('email')}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-secondary"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Task Reminders</p>
                                        <p className="text-sm text-gray-600">Get reminded about incomplete tasks</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={preferences.notifications.taskReminders}
                                            onChange={() => handleNotificationToggle('taskReminders')}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-secondary"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Friend Activity</p>
                                        <p className="text-sm text-gray-600">Updates when friends post projects</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={preferences.notifications.friendActivity}
                                            onChange={() => handleNotificationToggle('friendActivity')}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-secondary"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Weekly Digest</p>
                                        <p className="text-sm text-gray-600">Summary of your projects every week</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={preferences.notifications.weeklyDigest}
                                            onChange={() => handleNotificationToggle('weeklyDigest')}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-secondary"></div>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* Privacy Settings */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-xl font-bold text-brand-dark mb-4 flex items-center gap-2">
                                <Icon name="lock" className="w-6 h-6" />
                                Privacy
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block font-medium mb-2">Profile Visibility</label>
                                    <select 
                                        value={preferences.privacy.profileVisibility}
                                        onChange={(e) => handlePrivacyToggle('profileVisibility', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-secondary focus:border-transparent"
                                    >
                                        <option value="public">Public - Anyone can see</option>
                                        <option value="friends">Friends Only</option>
                                        <option value="private">Private - Only me</option>
                                    </select>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Show Projects</p>
                                        <p className="text-sm text-gray-600">Display your projects on your profile</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={preferences.privacy.showProjects}
                                            onChange={() => handlePrivacyToggle('showProjects', !preferences.privacy.showProjects)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-secondary"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Show Progress</p>
                                        <p className="text-sm text-gray-600">Allow others to see your task completion</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={preferences.privacy.showProgress}
                                            onChange={() => handlePrivacyToggle('showProgress', !preferences.privacy.showProgress)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-light rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-secondary"></div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'preferences':
                return (
                    <div className="space-y-6">
                        {/* DIY Preferences */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-xl font-bold text-brand-dark mb-4 flex items-center gap-2">
                                <Icon name="tool" className="w-6 h-6" />
                                DIY Preferences
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block font-medium mb-2">Skill Level</label>
                                    <select 
                                        value={preferences.skillLevel}
                                        onChange={(e) => handlePreferenceUpdate({ skillLevel: e.target.value as any })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-secondary focus:border-transparent"
                                    >
                                        <option value="beginner">Beginner - Just starting out</option>
                                        <option value="intermediate">Intermediate - Some experience</option>
                                        <option value="advanced">Advanced - Confident DIYer</option>
                                        <option value="professional">Professional - Trade experience</option>
                                    </select>
                                    <p className="text-sm text-gray-600 mt-1">Helps AI provide appropriate guidance</p>
                                </div>
                                <div>
                                    <label className="block font-medium mb-2">Budget Range</label>
                                    <select 
                                        value={preferences.budgetRange}
                                        onChange={(e) => handlePreferenceUpdate({ budgetRange: e.target.value as any })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-secondary focus:border-transparent"
                                    >
                                        <option value="tight">Tight - Budget-conscious</option>
                                        <option value="moderate">Moderate - Standard quality</option>
                                        <option value="flexible">Flexible - Higher quality materials</option>
                                        <option value="unlimited">Unlimited - Premium everything</option>
                                    </select>
                                    <p className="text-sm text-gray-600 mt-1">Influences cost estimates and recommendations</p>
                                </div>
                                <div>
                                    <label className="block font-medium mb-2">Measurement Units</label>
                                    <select 
                                        value={preferences.measurementUnit}
                                        onChange={(e) => handlePreferenceUpdate({ measurementUnit: e.target.value as any })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-secondary focus:border-transparent"
                                    >
                                        <option value="metric">Metric (cm, m, litres)</option>
                                        <option value="imperial">Imperial (inches, feet, gallons)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'account':
                return (
                    <div className="space-y-6">
                        {/* Account Information */}
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h3 className="text-xl font-bold text-brand-dark mb-4 flex items-center gap-2">
                                <Icon name="user" className="w-6 h-6" />
                                Account Information
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                    <p className="text-gray-900">{user.email || 'Not provided'}</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                                    <p className="text-gray-500 text-sm font-mono">{user.id}</p>
                                </div>
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-red-200">
                            <h3 className="text-xl font-bold text-red-600 mb-4">Danger Zone</h3>
                            <div className="space-y-4">
                                <div className="p-4 bg-red-50 rounded-md">
                                    <p className="text-sm text-gray-700 mb-2">
                                        <strong>Delete Account</strong> - Permanently delete your account and all associated data
                                    </p>
                                    <button 
                                        onClick={() => alert('Account deletion is not implemented in this demo')}
                                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
                                    >
                                        Delete My Account
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-brand-dark">Profile & Settings</h1>
                <p className="text-gray-600 mt-1">Manage your account preferences and project settings</p>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-md mb-6">
                <div className="flex border-b overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'border-b-2 border-brand-secondary text-brand-secondary'
                                    : 'text-gray-600 hover:text-brand-dark'
                            }`}
                        >
                            <Icon name={tab.icon as any} className="w-5 h-5" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            {renderTabContent()}
        </div>
    );
};
