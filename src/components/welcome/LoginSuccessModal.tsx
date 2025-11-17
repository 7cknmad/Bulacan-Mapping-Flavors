import React from 'react';

interface LoginSuccessModalProps {
  displayName?: string;
  isNewUser?: boolean;
}

const LoginSuccessModal: React.FC<LoginSuccessModalProps> = ({ displayName, isNewUser }) => {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-primary-700/80 via-primary-500/80 to-accent-400/80 animate-fade-in">
      <div className="relative flex flex-col items-center justify-center bg-white rounded-3xl shadow-2xl px-10 py-14 text-center w-full max-w-lg sm:max-w-xl md:max-w-2xl border-4 border-primary-600 animate-pop-in mx-auto" style={{margin: '0 auto'}}>
        {/* Confetti burst */}
        <div className="absolute inset-0 pointer-events-none">
          <svg className="absolute left-0 top-0 w-32 h-32 text-accent-400 opacity-60 animate-confetti-burst" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" />
          </svg>
          <svg className="absolute right-0 top-0 w-24 h-24 text-primary-400 opacity-50 animate-confetti-burst" viewBox="0 0 100 100" fill="none">
            <rect x="20" y="20" width="60" height="60" stroke="currentColor" strokeWidth="8" />
          </svg>
          <svg className="absolute left-0 bottom-0 w-20 h-20 text-accent-300 opacity-40 animate-confetti-burst" viewBox="0 0 100 100" fill="none">
            <polygon points="50,10 90,90 10,90" stroke="currentColor" strokeWidth="8" />
          </svg>
        </div>
        <h2 className="text-4xl font-extrabold mb-4 text-primary-700 drop-shadow-lg animate-bounce-in">
          {isNewUser ? '🎉 Welcome!' : '👋 Welcome back!'}
        </h2>
        <p className="text-neutral-800 mb-6 text-2xl font-semibold animate-fade-in">
          {displayName ? `Hello, ${displayName}!` : 'Hello!'}
        </p>
        <div className="flex flex-col items-center gap-4 mt-2">
          <span className="text-primary-600 font-bold text-lg animate-pulse">Redirecting to Interactive Map...</span>
          <svg className="w-12 h-12 text-accent-400 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="6" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <div className="absolute -top-8 left-1/2 -translate-x-1/2">
          <svg className="w-24 h-24 text-accent-300 animate-confetti-burst" viewBox="0 0 100 100" fill="none">
            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" />
          </svg>
        </div>
      </div>
      <style>{`
        @keyframes pop-in { 0% { transform: scale(0.7); opacity: 0; } 80% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); } }
        .animate-pop-in { animation: pop-in 0.7s cubic-bezier(.17,.67,.83,.67); }
        @keyframes bounce-in { 0% { transform: translateY(-40px); opacity: 0; } 80% { transform: translateY(10px); opacity: 1; } 100% { transform: translateY(0); } }
        .animate-bounce-in { animation: bounce-in 0.7s cubic-bezier(.17,.67,.83,.67); }
        @keyframes confetti-burst { 0% { opacity: 0; transform: scale(0.7) rotate(-20deg); } 80% { opacity: 0.7; transform: scale(1.1) rotate(10deg); } 100% { opacity: 0.5; transform: scale(1) rotate(0deg); } }
        .animate-confetti-burst { animation: confetti-burst 1.2s cubic-bezier(.17,.67,.83,.67); }
        @keyframes spin-slow { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 2.2s linear infinite; }
      `}</style>
    </div>
  );
};

export default LoginSuccessModal;