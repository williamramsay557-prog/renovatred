import React, { useState } from 'react';
import { Property, Room } from '../types';
import { Icon } from './Icons';

interface PropertySetupProps {
  onPropertyCreate: (property: Property) => void;
}

export const PropertySetup: React.FC<PropertySetupProps> = ({ onPropertyCreate }) => {
  const [propertyName, setPropertyName] = useState('');
  const [rooms, setRooms] = useState<string[]>([]);
  const [newRoom, setNewRoom] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleAddRoom = () => {
    if (newRoom && !rooms.includes(newRoom)) {
      setRooms([...rooms, newRoom]);
      setNewRoom('');
    }
  };

  const handleRemoveRoom = (roomToRemove: string) => {
    setRooms(rooms.filter(room => room !== roomToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (propertyName && rooms.length > 0 && !isCreating) {
      setIsCreating(true);
      const property: Omit<Property, 'id'> & { id?: string } = {
        name: propertyName,
        rooms: rooms.map((name) => ({ 
          name, 
          photos: [] 
        })) as Room[],
        projectChatHistory: [],
      };
      
      try {
        await onPropertyCreate(property);
      } catch (error) {
        console.error('Failed to create property:', error);
        alert(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsCreating(false);
      }
      // Note: If successful, component will unmount, so we don't need to reset isCreating
    }
  };

  return (
    <div className="min-h-screen bg-brand-primary flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center">
            <Icon name="home" className="mx-auto h-12 w-12 text-brand-secondary" />
            <h1 className="text-3xl font-bold text-brand-dark mt-4">Welcome to Renovatr</h1>
            <p className="text-gray-600 mt-2">Let's set up your renovation project.</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="property-name" className="block text-sm font-medium text-gray-700">
              Project Name or Address
            </label>
            <input
              id="property-name"
              type="text"
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              placeholder="e.g., My Dream Home Project"
              required
              className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Rooms</label>
            <div className="mt-2 space-y-2">
              {rooms.length === 0 && <p className="text-sm text-gray-500 text-center py-2">Add some rooms to get started!</p>}
              {rooms.map(room => (
                <div key={room} className="flex items-center justify-between bg-brand-light p-2 rounded-md">
                  <span className="text-gray-800">{room}</span>
                  <button type="button" onClick={() => handleRemoveRoom(room)} className="text-gray-400 hover:text-red-600">
                    <Icon name="trash" className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddRoom())}
                placeholder="Add a new room"
                className="flex-grow block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary"
              />
              <button type="button" onClick={handleAddRoom} className="px-4 py-2 bg-brand-secondary text-white rounded-md hover:bg-brand-primary transition-colors flex items-center">
                <Icon name="plus" className="w-5 h-5" />
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={!propertyName || rooms.length === 0 || isCreating}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-accent hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isCreating ? (
              <>
                <Icon name="spinner" className="animate-spin w-5 h-5 mr-2" />
                Creating Project...
              </>
            ) : (
              'Start Planning'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
