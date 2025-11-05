import React, { useState, useMemo } from "react";
import { useAuth } from "../hooks/useAuth";

interface ValidationResult {
  score: number;
  label: string;
  checks: {
    length: boolean;
    cases: boolean;
    number: boolean;
    special: boolean;
  };
}

function passwordStrength(pw: string): ValidationResult {
  let score = 0;
  const checks = {
    length: pw.length >= 8,
    cases: /[A-Z]/.test(pw) && /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw)
  };

  if (checks.length) score++;
  if (checks.cases) score++;
  if (checks.number) score++;
  if (checks.special) score++;

  const labels = ['Very weak', 'Weak', 'Okay', 'Good', 'Strong'];
  return {
    score: Math.min(score, 4),
    label: labels[Math.min(score, 4)],
    checks
  };
}

export default function RegisterForm({ onSuccess }: { onSuccess?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const { score, label, checks } = useMemo(() => passwordStrength(password), [password]);
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({
    email: false,
    password: false,
    displayName: false
  });

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);
  const displayNameValid = useMemo(() => !displayName || (displayName.length >= 2 && displayName.length <= 50), [displayName]);

  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    
    // Mark all fields as touched for validation
    setTouched({
      email: true,
      password: true,
      displayName: true
    });

    // Validate all fields
    if (!emailValid) {
      setError('Please enter a valid email address');
      return;
    }
    if (!displayNameValid && displayName.length > 0) {
      setError('Display name must be between 2 and 50 characters');
      return;
    }
    if (score < 2) {
      setError('Please create a stronger password');
      return;
    }
    
    setLoading(true);
    setSuccess(false);
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/auth/register`;
      
      // First check if the API is available
      try {
        const healthCheck = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3002'}/api/health`);
        if (!healthCheck.ok) {
          throw new Error('Unable to connect to the server. Please try again later.');
        }
      } catch (healthError) {
        console.error('API Health check failed:', healthError);
        throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
      }

      // Proceed with registration
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ 
          email, 
          password, 
          displayName: displayName.trim() || undefined // Only send if not empty
        }),
      });

      let data;
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        throw new Error('Unexpected response from server');
      }

      if (!res.ok) {
        // Handle specific error cases
        if (res.status === 409) {
          throw new Error('This email is already registered. Please try logging in instead.');
        }
        if (res.status === 400) {
          throw new Error(data.error || 'Please check your input and try again.');
        }
        if (res.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        throw new Error(data.error || data.message || "Registration failed");
      }

      // If API returned token and user, auto-login
      if (data && data.token && data.user) {
        try { 
          login(data.user, data.token); 
        } catch (loginErr) {
          console.error('Auto-login failed:', loginErr);
          // Don't throw - registration was still successful
        }
      }

      setSuccess(true);
      setEmail("");
      setPassword("");
      setDisplayName("");
      if (onSuccess) onSuccess();
    } catch (e: any) {
      console.error('Registration error:', e);
      setError(e.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleRegister}>
      <h2 className="text-lg font-semibold">Register</h2>
      <div>
        <label className="text-xs text-neutral-600 flex justify-between">
          <span>Email</span>
          {touched.email && !emailValid && <span className="text-red-500">*Required</span>}
        </label>
        <input
          type="email"
          className={`w-full border rounded p-2 text-neutral-800 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-neutral-400 ${
            touched.email && !emailValid ? 'border-red-500' : ''
          }`}
          placeholder="Enter your email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onBlur={() => handleBlur('email')}
          required
          aria-invalid={!emailValid}
        />
        {touched.email && !emailValid && email.length > 0 && (
          <div className="text-xs text-red-600 mt-1">Please enter a valid email address</div>
        )}
      </div>

      <div>
        <label className="text-xs text-neutral-600 flex justify-between">
          <span>Display name (optional)</span>
          {touched.displayName && !displayNameValid && (
            <span className="text-red-500">2-50 characters</span>
          )}
        </label>
        <input
          type="text"
          className={`w-full border rounded p-2 text-neutral-800 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-neutral-400 ${
            touched.displayName && !displayNameValid ? 'border-red-500' : ''
          }`}
          placeholder="How should we call you?"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          onBlur={() => handleBlur('displayName')}
        />
        {touched.displayName && !displayNameValid && displayName.length > 0 && (
          <div className="text-xs text-red-600 mt-1">Display name must be between 2 and 50 characters</div>
        )}
      </div>

      <div>
        <label className="text-xs text-neutral-600">Password</label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            className={`w-full border rounded p-2 pr-10 text-neutral-800 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-neutral-400 ${
              touched.password && score < 2 ? 'border-red-500' : ''
            }`}
            placeholder="Create a strong password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onBlur={() => handleBlur('password')}
            required
            aria-describedby="pw-strength"
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-500 hover:text-neutral-700"
            onClick={() => setShowPassword(v => !v)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        
        <div id="pw-strength" className="mt-2 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-24 h-2 bg-gray-200 rounded overflow-hidden">
              <div 
                style={{ width: `${(score/4)*100}%` }} 
                className={`h-full transition-all duration-300 ${
                  score >= 3 ? 'bg-green-500' : 
                  score === 2 ? 'bg-yellow-400' : 
                  'bg-red-500'
                }`} 
              />
            </div>
            <div className="text-xs text-neutral-600">{label}</div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={`flex items-center gap-1 ${checks.length ? 'text-green-600' : 'text-neutral-500'}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={checks.length ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
              </svg>
              At least 8 characters
            </div>
            <div className={`flex items-center gap-1 ${checks.cases ? 'text-green-600' : 'text-neutral-500'}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={checks.cases ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
              </svg>
              Upper & lowercase
            </div>
            <div className={`flex items-center gap-1 ${checks.number ? 'text-green-600' : 'text-neutral-500'}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={checks.number ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
              </svg>
              At least 1 number
            </div>
            <div className={`flex items-center gap-1 ${checks.special ? 'text-green-600' : 'text-neutral-500'}`}>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={checks.special ? "M5 13l4 4L19 7" : "M6 18L18 6M6 6l12 12"} />
              </svg>
              Special character
            </div>
          </div>
        </div>
      </div>

      <button
        type="submit"
        className="w-full bg-primary-600 text-white rounded py-2 hover:bg-primary-700 disabled:opacity-60"
        disabled={loading}
      >
        {loading ? "Registering..." : "Register"}
      </button>
      {error && <div className="text-red-600">{error}</div>}
      {success && <div className="text-green-600">Registration successful! You are now logged in.</div>}
    </form>
  );
}
