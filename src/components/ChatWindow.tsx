import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Part } from '../types';
import { Icon } from './Icons';

// Helper to extract text from a Part array
const getTextFromParts = (parts: Part[]): string => {
    return parts
        .map(part => part.text || '')
        .join(' ');
};

const getImageFromParts = (parts: Part[]): string | undefined => {
    const imagePart = parts.find(part => part.inlineData);
    if (imagePart && imagePart.inlineData) {
        return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
    }
    return undefined;
};

// Simple Markdown Renderer
const Markdown: React.FC<{ content: string }> = ({ content }) => {
    const renderMarkdown = () => {
        let html = content
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^## (.*$)/gim, '<h2 class="text-lg font-semibold mt-2 mb-1">$1</h2>')
            .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold mt-3 mb-2">$1</h1>');
        
        // Handle lists
        html = html.replace(/((?:^\* .*(?:\n|$))+)/gm, (match) => {
            const items = match.trim().split('\n').map(item => `<li>${item.substring(2)}</li>`).join('');
            return `<ul class="list-disc list-inside my-2 ml-4">${items}</ul>`;
        });

        html = html.replace(/\n/g, '<br />').replace(/<br \/>(<(h1|h2|ul|li))/g, '$1'); // prevent double line breaks before block elements

        return { __html: html };
    };

    return <div className="text-sm markdown-content" dangerouslySetInnerHTML={renderMarkdown()} />;
};

interface ChatWindowProps {
  messages: ChatMessage[];
  onSendMessage: (parts: Part[]) => Promise<void>;
  isLoading: boolean;
  title: string;
  placeholder: string;
  onAddTask?: (title: string, room: string) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage, isLoading, title, placeholder, onAddTask }) => {
  const [input, setInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [clickedSuggestions, setClickedSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert("File is too large. Please upload an image under 5MB.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.onerror = () => {
        console.error("Error reading file");
        alert("Sorry, there was an error reading that file. Please try again.");
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !imagePreview) return;

      const parts: Part[] = [];
      if (input.trim()) {
        parts.push({ text: input.trim() });
      }
      if (imagePreview) {
         const mimeType = imagePreview.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/)?.[1] || 'image/jpeg';
         const base64Data = imagePreview.split(',')[1];
         parts.push({ inlineData: { mimeType, data: base64Data } });
      }

      // Clear state before awaiting the async call for better UX
      setInput('');
      setImagePreview(null);
      if(fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await onSendMessage(parts);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md">
      <div className="p-4 border-b">
        <h3 className="text-lg font-semibold text-brand-dark flex items-center gap-2">
          <Icon name="chat" className="w-6 h-6 text-brand-secondary" />
          {title}
        </h3>
      </div>
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        <div className="space-y-4">
          {messages.map((msg, index) => {
            const msgText = getTextFromParts(msg.parts);
            const msgImage = getImageFromParts(msg.parts);
            
            return (
                <div key={index} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'model' && 
                    <div className="p-2 bg-gray-200 rounded-full mb-2 self-start flex-shrink-0">
                      <Icon name="robot" className="w-5 h-5 text-brand-primary"/>
                    </div>
                  }
                  <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl flex flex-col transition-all duration-300 ${
                      msg.role === 'user'
                          ? 'bg-brand-secondary text-white rounded-br-none'
                          : 'bg-brand-light text-brand-dark rounded-bl-none'
                      }`}
                  >
                      {msgImage && <img src={msgImage} alt="User upload" className="rounded-lg mb-2 max-h-48 w-full object-cover" />}
                      {msgText && <Markdown content={msgText} />}
                      {msg.suggestions && onAddTask && (
                        <div className="mt-2 pt-2 border-t border-gray-300/50 space-y-3">
                            <p className="text-sm font-semibold">Suggested Tasks:</p>
                            {msg.suggestions.map((suggestion, sIndex) => {
                                const suggestionKey = `${index}-${sIndex}`;
                                const hasBeenClicked = clickedSuggestions.includes(suggestionKey);
                                return (
                                    <div key={suggestionKey}>
                                        <div className="bg-white/20 p-2 rounded-md">
                                            <p className="font-bold">{suggestion.title}</p>
                                            <p className="text-xs">{suggestion.room}</p>
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.preventDefault();
                                                onAddTask(suggestion.title, suggestion.room);
                                                setClickedSuggestions(prev => [...prev, suggestionKey]);
                                            }}
                                            disabled={hasBeenClicked}
                                            className={`mt-2 w-full text-sm font-bold py-2 px-3 rounded-md transition-colors flex items-center justify-center ${
                                                hasBeenClicked 
                                                  ? 'bg-green-100 text-green-700 cursor-default' 
                                                  : 'bg-brand-accent text-white hover:bg-yellow-500'
                                            }`}
                                        >
                                            {hasBeenClicked ? (
                                                <><Icon name="check" className="w-5 h-5 mr-2" /> Added</>
                                            ) : (
                                                'Add to Task Board'
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                      )}
                  </div>
                </div>
            )
          })}
          {isLoading && (
            <div className="flex items-end gap-2 justify-start">
               <div className="p-2 bg-gray-200 rounded-full mb-2 self-start flex-shrink-0">
                  <Icon name="robot" className="w-5 h-5 text-brand-primary"/>
               </div>
               <div className="max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl bg-brand-light text-brand-dark rounded-bl-none">
                 <div className="flex items-center space-x-1.5">
                    <span className="text-sm text-gray-500">Typing</span>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                 </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="p-4 border-t bg-white">
        {imagePreview && (
          <div className="relative mb-2 w-24 h-24">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-md" />
            <button onClick={() => {
              setImagePreview(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }} className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full p-1">
              <Icon name="close" className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-200"
            aria-label="Attach file"
          >
            <Icon name="paperclip" className="w-6 h-6" />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept="image/*"
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
            placeholder={placeholder}
            className="flex-1 w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-secondary"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !imagePreview)}
            className="p-2 rounded-full text-white bg-brand-secondary hover:bg-brand-primary disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            <Icon name="send" className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};
