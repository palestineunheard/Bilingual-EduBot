import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { BotIcon, SpinnerIcon } from './icons'; 

const Auth: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSignUp, setIsSignUp] = useState(false);

    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        if (isSignUp && !displayName.trim()) {
            setError("Please enter a display name.");
            setIsLoading(false);
            return;
        }

        try {
            if (isSignUp) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, {
                    displayName: displayName
                });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            // onAuthStateChanged in App.tsx will handle the rest
        } catch (error: any) {
            console.error("Authentication error:", error);
            // Provide more user-friendly error messages
            let friendlyMessage = "An error occurred. Please try again.";
            if (error.code === 'auth/email-already-in-use') {
                friendlyMessage = "This email is already registered. Please sign in or use a different email.";
            } else if (error.code === 'auth/weak-password') {
                friendlyMessage = "Password is too weak. It should be at least 6 characters long.";
            } else if (error.code === 'auth/invalid-email') {
                friendlyMessage = "Please enter a valid email address.";
            } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                friendlyMessage = "Invalid email or password. Please check your credentials and try again.";
            }
            setError(friendlyMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 text-center">
            <div className="w-full max-w-md bg-gray-800/50 border border-gray-700 rounded-2xl shadow-2xl p-8">
                <BotIcon className="w-16 h-16 mx-auto text-teal-400 mb-4" />
                <h1 className="text-3xl font-bold mb-2">{isSignUp ? 'Create an Account' : 'Welcome Back'}</h1>
                <p className="text-gray-400 mb-8">
                    {isSignUp ? 'Join to start your AI-powered learning journey.' : 'Sign in to continue your learning journey.'}
                </p>
                
                {error && <div className="bg-red-800/50 text-red-200 p-3 rounded-lg mb-6">{error}</div>}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    {isSignUp && (
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Display Name"
                            required
                            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    )}
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email Address"
                        required
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        required
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-blue-600 font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-500 transition-colors text-lg"
                    >
                        {isLoading ? <SpinnerIcon /> : (isSignUp ? 'Create Account' : 'Sign In')}
                    </button>
                </form>

                <div className="mt-6">
                    <button onClick={() => setIsSignUp(!isSignUp)} className="text-blue-400 hover:underline">
                        {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Auth;
