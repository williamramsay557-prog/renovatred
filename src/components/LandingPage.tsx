import React from 'react';
import { Icon } from './Icons';

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  return (
    <div className="min-h-screen bg-brand-primary text-white flex flex-col justify-center items-center p-4 text-center">
      <div className="max-w-3xl">
        <Icon name="wrench" className="mx-auto h-20 w-20 text-brand-accent mb-6" />
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
          Your Renovation, Socialized.
        </h1>
        <p className="mt-6 text-lg max-w-2xl mx-auto text-gray-300">
          Welcome to Renovatr. Plan your projects with powerful AI and share your journey with a community of fellow DIYers.
        </p>
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left">
            <div className="flex items-start">
                <Icon name="robot" className="w-8 h-8 text-brand-secondary flex-shrink-0 mr-3 mt-1"/>
                <div>
                    <h3 className="font-bold">AI-Powered Planning</h3>
                    <p className="text-sm text-gray-400">Get step-by-step guides, material lists, and expert advice tailored to your vision.</p>
                </div>
            </div>
            <div className="flex items-start">
                <Icon name="kanban" className="w-8 h-8 text-brand-secondary flex-shrink-0 mr-3 mt-1"/>
                <div>
                    <h3 className="font-bold">Share Your Progress</h3>
                    <p className="text-sm text-gray-400">Post photo updates to your feed and get feedback and encouragement from friends.</p>
                </div>
            </div>
             <div className="flex items-start">
                <Icon name="camera" className="w-8 h-8 text-brand-secondary flex-shrink-0 mr-3 mt-1"/>
                <div>
                    <h3 className="font-bold">Build Your Vision</h3>
                    <p className="text-sm text-gray-400">Use our intuitive tools to manage tasks, track budgets, and bring your dream home to life.</p>
                </div>
            </div>
        </div>
        <div className="mt-12">
          <button
            onClick={onStart}
            className="px-10 py-4 bg-brand-accent text-brand-dark font-bold text-lg rounded-full hover:bg-yellow-500 transform hover:scale-105 transition-all shadow-lg"
          >
            Join the Community
          </button>
        </div>
      </div>
    </div>
  );
};