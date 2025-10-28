import React, {useState} from 'react';
import { Property, Task } from '../types';
import { Icon } from './Icons';

const Markdown: React.FC<{ content: string }> = ({ content }) => {
    const renderMarkdown = (text: string) => {
        let html = text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-2 mb-1">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-3 mb-2">$1</h1>');
        
        html = html.replace(/((?:^\* .*(?:\n|$))+)/gm, (match) => {
            const items = match.trim().split('\n').map(item => `<li>${item.substring(2)}</li>`).join('');
            return `<ul class="list-disc list-inside my-2 ml-4">${items}</ul>`;
        });

        html = html.replace(/\n/g, '<br />').replace(/<br \/>(<(h1|h2|ul|li))/g, '$1');

        return { __html: html };
    };

    return <div className="text-sm markdown-content" dangerouslySetInnerHTML={renderMarkdown(content)} />;
};

interface RoomProgressProps {
    property: Property;
    tasks: Task[];
    onAddRoom: (roomName: string) => void;
    onDeleteRoom: (roomId: string) => void;
    onAddPhotoToRoom: (roomId: string, photoDataUrl: string) => void;
}

export const RoomProgress: React.FC<RoomProgressProps> = ({ property, tasks, onAddRoom, onDeleteRoom, onAddPhotoToRoom }) => {
    
    const [isAddingRoom, setIsAddingRoom] = useState(false);
    const [newRoomName, setNewRoomName] = useState("");

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, roomId: string) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert("File is too large. Please upload an image under 5MB.");
                event.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const photoDataUrl = reader.result as string;
                onAddPhotoToRoom(roomId, photoDataUrl);
            };
            reader.readAsDataURL(file);
        }
        event.target.value = '';
    };
    
    const handleSaveNewRoom = () => {
        if(newRoomName.trim()){
            onAddRoom(newRoomName.trim());
            setNewRoomName("");
            setIsAddingRoom(false);
        }
    }

    return (
    <div className="p-4 sm:p-8 h-full overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-brand-dark">Room Progress</h2>
            {!isAddingRoom && (
                <button 
                    onClick={() => setIsAddingRoom(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-secondary text-white rounded-md hover:bg-brand-primary transition-colors"
                >
                    <Icon name="plus" className="w-5 h-5" />
                    <span className="hidden sm:inline">Add Room</span>
                </button>
            )}
        </div>
        
        {isAddingRoom && (
             <div className="bg-white p-4 rounded-lg shadow-md mb-6 flex items-center gap-2">
                 <input 
                    type="text" 
                    value={newRoomName} 
                    onChange={(e) => setNewRoomName(e.target.value)} 
                    placeholder="Enter new room name"
                    className="flex-grow block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveNewRoom()}
                />
                <button onClick={handleSaveNewRoom} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Save</button>
                <button onClick={() => setIsAddingRoom(false)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">Cancel</button>
             </div>
        )}

        <div className="space-y-8">
            {property.rooms.map(room => {
                const roomTasks = tasks.filter(t => t.room === room.name);
                return (
                    <div key={room.id} className="bg-white p-6 rounded-lg shadow-md relative group">
                        <div className="flex justify-between items-start">
                            <h3 className="text-2xl font-semibold text-brand-dark mb-4">{room.name}</h3>
                             <div className="flex items-center gap-2 absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <label htmlFor={`photo-upload-${room.id}`} className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 cursor-pointer" title={`Add photo to ${room.name}`}>
                                    <Icon name="camera" className="w-5 h-5" />
                                </label>
                                <input id={`photo-upload-${room.id}`} type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, room.id)} />
                                <button 
                                    onClick={() => onDeleteRoom(room.id)}
                                    className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600"
                                    title={`Delete ${room.name}`}
                                >
                                    <Icon name="trash" className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {room.aiSummary && <p className="mb-4 text-gray-700 italic"><Markdown content={room.aiSummary} /></p>}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold mb-2">Tasks To Do</h4>
                                <ul className="list-disc list-inside text-sm text-gray-600">{tasks.filter(t=>t.room === room.name && t.status !== 'Complete').map(t=><li key={t.id}>{t.title}</li>)}</ul>
                            </div>
                             <div>
                                <h4 className="font-semibold mb-2">Tasks Complete</h4>
                                <ul className="list-disc list-inside text-sm text-green-600">{tasks.filter(t=>t.room === room.name && t.status === 'Complete').map(t=><li key={t.id}>{t.title}</li>)}</ul>
                            </div>
                        </div>
                        <div className="mt-4">
                           <h4 className="text-lg font-semibold text-brand-dark mb-2">Photo Timeline</h4>
                           {room.photos.length > 0 ? (
                               <div className="flex overflow-x-auto gap-4 p-2 -mx-2">
                                   {room.photos.map((photo, index) => <img key={`${room.id}-photo-${index}`} src={photo} alt={`${room.name} ${index+1}`} className="w-48 h-32 object-cover rounded-lg flex-shrink-0 shadow-sm" />)}
                               </div>
                           ) : (
                               <div className="text-center py-4 bg-gray-50 rounded-lg">
                                   <p className="text-sm text-gray-500">No photos added for this room yet.</p>
                               </div>
                           )}
                        </div>
                    </div>
                );
            })}
        </div>
    </div>
    );
};
