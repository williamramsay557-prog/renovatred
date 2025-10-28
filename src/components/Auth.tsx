import React, { useState } from 'react';
import { signUp, signIn } from '../services/authService';
import { Icon } from './Icons';

export const Auth: React.FC = () => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isLoginView) {
                const { error } = await signIn(email, password);
                if (error) throw error;
            } else {
                const { error } = await signUp(email, password, fullName);
                if (error) throw error;
                alert('Success! Please check your email for a confirmation link.');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-brand-primary flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
                <div className="text-center">
                    <Icon name="wrench" className="mx-auto h-12 w-12 text-brand-secondary" />
                    <h1 className="text-3xl font-bold text-brand-dark mt-4">Welcome to Renovatr</h1>
                    <p className="text-gray-600 mt-2">{isLoginView ? 'Sign in to continue' : 'Create your account'}</p>
                </div>
                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    
                    {!isLoginView && (
                        <div>
                            <label htmlFor="full-name" className="block text-sm font-medium text-gray-700">Full Name</label>
                            <input
                                id="full-name" type="text" value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="Alex Johnson" required
                                className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary"
                            />
                        </div>
                    )}
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email Address</label>
                        <input
                            id="email" type="email" value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com" required
                            className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary"
                        />
                    </div>
                    <div>
                        <label htmlFor="password"className="block text-sm font-medium text-gray-700">Password</label>
                        <input
                            id="password" type="password" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••" required
                            className="mt-1 block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-secondary focus:border-brand-secondary"
                        />
                    </div>
                    
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-brand-accent hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {loading ? <Icon name="spinner" className="animate-spin w-5 h-5" /> : (isLoginView ? 'Sign In' : 'Sign Up')}
                    </button>

                    <p className="text-center text-sm text-gray-600">
                        {isLoginView ? "Don't have an account?" : 'Already have an account?'}
                        <button type="button" onClick={() => { setIsLoginView(!isLoginView); setError(null); }} className="font-medium text-brand-secondary hover:underline ml-1">
                            {isLoginView ? 'Sign Up' : 'Sign In'}
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
};
