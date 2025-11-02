import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

const AuthPanel: React.FC = () => {
  const [tab, setTab] = useState<'login'|'register'>('login');
  const [message, setMessage] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const switchTab = (newTab: 'login' | 'register') => {
    if (tab === newTab) return;
    setIsTransitioning(true);
    setTimeout(() => {
      setTab(newTab);
      setIsTransitioning(false);
    }, 150);
  };

  return (
    <div>
      <div className="flex gap-2 mb-6 justify-center">
        <button
          onClick={() => switchTab('login')}
          className={`px-4 py-2 rounded-full transition-all duration-200 ease-out relative ${
            tab === 'login' 
              ? 'bg-primary-600 text-white shadow-md scale-105' 
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Sign In
        </button>
        <button
          onClick={() => switchTab('register')}
          className={`px-4 py-2 rounded-full transition-all duration-200 ease-out relative ${
            tab === 'register' 
              ? 'bg-primary-600 text-white shadow-md scale-105' 
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          Register
        </button>
      </div>
      <div className={`transition-all duration-150 ease-out ${
        isTransitioning ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'
      }`}>
        {tab === 'login' ? (
          <LoginForm onLogin={() => { 
            setMessage('Welcome back!');
          }} />
        ) : (
          <RegisterForm onSuccess={() => { 
            switchTab('login');
            setMessage('Registration successful — please login');
          }} />
        )}
      </div>
      {message && (
        <div className="mt-3 text-sm text-green-600 animate-fade-in">
          {message}
        </div>
      )}
    </div>
  );
};

export default AuthPanel;
