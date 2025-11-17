import React from 'react';
import { User } from '../../types/user';
import { Link } from 'react-router-dom';

interface WelcomeToastProps {
  user: User;
  isNewUser?: boolean;
  onStartTour?: () => void;
}

export const WelcomeToast: React.FC<WelcomeToastProps> = ({ user, isNewUser, onStartTour }) => {
  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-white text-neutral-800 px-6 py-4 rounded-xl shadow-xl animate-fade-in max-w-md w-full mx-4">
      <div className="flex items-start gap-4">
        {/* User Avatar */}
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 flex-shrink-0">
          {user.displayName ? (
            <span className="text-lg font-semibold">{user.displayName[0].toUpperCase()}</span>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          )}
        </div>
        
        {/* Welcome Message & Actions */}
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">
            {isNewUser ? '' : `W, ${user.displayName || user.email || "User"}!`}
          </h3>
          <p className="text-neutral-600 text-sm mb-2">
            {isNewUser 
              ? "Let's start exploring Bulacan's amazing culinary heritage together!"
              : "Ready to continue your culinary journey?"}
          </p>
          
          {/* Quick Action Buttons */}
          <div className="space-y-3">
            {/* Primary Actions */}
            <div className="flex flex-wrap gap-2">
              <Link
                to="/map"
                className="text-xs px-4 py-2 rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 transition-all hover:scale-105 flex items-center gap-1.5 font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Interactive Map
              </Link>
              <Link
                to="/dishes"
                className="text-xs px-4 py-2 rounded-full bg-primary-50 text-primary-700 hover:bg-primary-100 transition-all hover:scale-105 flex items-center gap-1.5 font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Discover Dishes
              </Link>
            </div>

            {/* Secondary Actions */}
            <div className="flex flex-wrap gap-2">
              <Link
                to="/restaurants"
                className="text-xs px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-all hover:scale-105 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Restaurants
              </Link>
              <Link
                to="/favorites"
                className="text-xs px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-all hover:scale-105 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Favorites
              </Link>
              <Link
                to="/popular"
                className="text-xs px-3 py-1.5 rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-all hover:scale-105 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Popular
              </Link>
            </div>

            {/* Tour Button for New Users */}
            {isNewUser && (
              <button
                onClick={onStartTour}
                className="w-full text-xs px-4 py-2 rounded-full bg-accent-100 text-accent-700 hover:bg-accent-200 transition-all hover:scale-105 flex items-center justify-center gap-1.5 font-medium mt-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Take an Interactive Tour
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};