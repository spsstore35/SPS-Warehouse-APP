import React, { useState } from 'react';
import { User, Role } from '../types/inventory';
import {
  Warehouse,
  Mail,
  Lock,
  User as UserIcon,
  ArrowRight,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Package,
  Eye,
  EyeOff,
  Phone,
  AtSign,
} from 'lucide-react';

interface AuthScreensProps {
  onLogin: (user: User) => void;
}

export const AuthScreens: React.FC<AuthScreensProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  // Login form state
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [pendingAccountInfo, setPendingAccountInfo] = useState<User | null>(null);

  // Sign up form state
  const [signUpName, setSignUpName] = useState('');
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [signUpRole, setSignUpRole] = useState<Role>('worker');
  const [signUpError, setSignUpError] = useState('');
  const [signUpSuccess, setSignUpSuccess] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setPendingAccountInfo(null);
    setIsSubmitting(true);

    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier || !password) {
      setLoginError('Please enter your email, phone number, or username and password.');
      setIsSubmitting(false);
      return;
    }

    // Authenticate strictly against live Supabase profiles table (Email, Phone, or Username)
    try {
      const { lookupProfileForLogin } = await import('../services/supabaseService');
      const profile = await lookupProfileForLogin(cleanIdentifier);

      if (!profile) {
        setLoginError('No account found with this email, phone number, or username.');
        setIsSubmitting(false);
        return;
      }

      const {
        verifyPassword,
        hashPassword,
        normalizeRole,
        getPublicUserEmail,
      } = await import('../utils/security');
      if (profile.status === 'pending') {
        setPendingAccountInfo({
          id: profile.id,
          name: profile.full_name,
          email: getPublicUserEmail(profile.email),
          username: profile.username || undefined,
          phone: profile.phone || undefined,
          role: profile.role,
          status: 'pending',
          requestedRole: profile.requested_role,
        });
        setIsSubmitting(false);
        return;
      }

      if (profile.status === 'rejected') {
        setLoginError('Your account request was declined by the administrator.');
        setIsSubmitting(false);
        return;
      }

      const isMatch = await verifyPassword(password, profile.password_hash);
      if (!isMatch) {
        setLoginError('Invalid credentials. Please check your password.');
        setIsSubmitting(false);
        return;
      }

      // Auto-upgrade legacy plain text or null passwords to secure SHA-256 hash in Supabase
      if (profile.password_hash === password || !profile.password_hash) {
        const { supabase } = await import('../services/supabaseClient');
        const newSecureHash = await hashPassword(password);
        await supabase
          .from('profiles')
          .update({ password_hash: newSecureHash })
          .eq('id', profile.id);
      }

      const normalizedRole: Role = normalizeRole(profile.role || profile.requested_role);
      const normalizedReqRole: Role = normalizeRole(profile.requested_role || profile.role);

      const resolvedTeams = Array.isArray(profile.assigned_teams) ? profile.assigned_teams : [];
      const resolvedFare2 = Array.isArray(profile.assigned_fare2) ? profile.assigned_fare2 : [];

      const userObj: User = {
        id: profile.id,
        name: profile.full_name || 'Staff User',
        email: getPublicUserEmail(profile.email),
        username: profile.username || undefined,
        phone: profile.phone || undefined,
        role: normalizedRole,
        status: profile.status,
        requestedRole: normalizedReqRole,
        employeeId: profile.employee_id,
        avatarColor: profile.avatar_color,
        assignedTeams: resolvedTeams,
        assignedFare2: resolvedFare2,
      };
      onLogin(userObj);
    } catch (err: any) {
      setLoginError(err?.message || 'Unable to connect to the database. Please try again.');
    }
    setIsSubmitting(false);
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignUpError('');
    setSignUpSuccess(null);
    setIsSubmitting(true);

    if (!signUpName.trim()) {
      setSignUpError('Please enter your full name');
      setIsSubmitting(false);
      return;
    }

    const cleanEmail = signUpEmail.trim().toLowerCase();
    const cleanUserInput = signUpUsername.trim().replace(/^@+/, '');
    const cleanPhoneInput = signUpPhone.trim();

    if (!cleanEmail && !cleanUserInput && !cleanPhoneInput) {
      setSignUpError('Please enter at least one: Email, Username, or Phone Number.');
      setIsSubmitting(false);
      return;
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setSignUpError('Please enter a valid email address or leave Email empty.');
      setIsSubmitting(false);
      return;
    }

    if (cleanUserInput) {
      if (cleanUserInput.length < 3 || !/^[a-zA-Z0-9._-]+$/.test(cleanUserInput)) {
        setSignUpError('Username must be at least 3 characters (letters, numbers, ".", "_", or "-").');
        setIsSubmitting(false);
        return;
      }
    }

    if (cleanPhoneInput && cleanPhoneInput.replace(/\D/g, '').length < 6) {
      setSignUpError('Please enter a valid phone number.');
      setIsSubmitting(false);
      return;
    }

    if (!signUpPassword || signUpPassword.length < 4) {
      setSignUpError('Password must be at least 4 characters');
      setIsSubmitting(false);
      return;
    }

    // Insert strictly into Supabase profiles
    try {
      const { registerUserInDb } = await import('../services/supabaseService');
      const newUser = await registerUserInDb({
        name: signUpName,
        email: cleanEmail || undefined,
        username: cleanUserInput || undefined,
        phone: cleanPhoneInput || undefined,
        password: signUpPassword,
        requestedRole: signUpRole,
      });

      setSignUpSuccess(newUser);
      setSignUpName('');
      setSignUpUsername('');
      setSignUpPhone('');
      setSignUpEmail('');
      setSignUpPassword('');
    } catch (err: any) {
      if (err?.message?.includes('duplicate key') || err?.message?.includes('profiles_email_key')) {
        setSignUpError('An account with this email already exists.');
      } else {
        setSignUpError(err?.message || 'Registration failed. Check database connection.');
      }
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="w-full max-w-md mx-auto text-center mb-6 sm:mb-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-slate-200 shadow-md mb-3 p-1 overflow-hidden">
          <img
            src="/sps-logo.png"
            alt="Saint Paul Scouts"
            className="w-full h-full object-contain"
          />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
          SPS Warehouse
        </h1>
        <p className="text-xs text-slate-500 font-semibold mt-1">
          Saint Paul Scouts • مجموعة القديس بولس الكشفية
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-2xl shadow-xl p-6 sm:p-8">
        {/* Toggle between Sign In and Sign Up */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setLoginError('');
              setPendingAccountInfo(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setSignUpError('');
              setSignUpSuccess(null);
            }}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              mode === 'signup'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Request New Account
          </button>
        </div>

        {/* 1. UNIFIED LOGIN FORM */}
        {mode === 'login' && (
          <div>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-900">Sign in to your account</h2>
            </div>

            {/* Pending Account Notice if user tries to log into pending account */}
            {pendingAccountInfo && (
              <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold mb-1 text-amber-800">
                  <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                  <span>Account Pending Admin Approval</span>
                </div>
                <p className="leading-relaxed">
                  Your registration for <strong>{pendingAccountInfo.name}</strong> ({pendingAccountInfo.requestedRole || pendingAccountInfo.role}) has been recorded.
                  An active Admin must approve your registration before you can access the system.
                </p>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Email, Mobile Number, or Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    {identifier.includes('@') ? (
                      <Mail className="w-4 h-4" />
                    ) : /^\+?[\d\s\-()]{4,}$/.test(identifier.trim()) ? (
                      <Phone className="w-4 h-4" />
                    ) : (
                      <AtSign className="w-4 h-4" />
                    )}
                  </div>
                  <input
                    type="text"
                    autoComplete="username"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Email, Mobile Number, or Username"
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-10 pr-11 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors focus:outline-none"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-sm transition-all min-h-[46px]"
              >
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* 2. SIGN UP / REGISTRATION FORM WITH PENDING STATUS */}
        {mode === 'signup' && (
          <div>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-slate-900">Request New Staff Account</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Create your account. As requested, new accounts are placed in <strong>Pending Status</strong> until the warehouse Admin approves them.
              </p>
            </div>

            {signUpSuccess ? (
              <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-center space-y-3 animate-in fade-in">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-sm font-bold text-amber-900">
                  Registration Received — Pending Approval
                </h3>
                <p className="text-xs text-amber-800 leading-relaxed font-medium">
                  Welcome <strong>{signUpSuccess.name}</strong>! Your account request for{' '}
                  <strong>
                    {signUpSuccess.requestedRole === 'admin'
                      ? 'Warehouse Admin'
                      : signUpSuccess.requestedRole === 'leader'
                      ? 'Scout Leader (Read-Only)'
                      : 'Staff'}
                  </strong>{' '}
                  has been submitted.
                </p>
                <div className="p-3 bg-white/80 rounded-xl border border-amber-200 text-left text-xs text-slate-700 space-y-1">
                  {signUpSuccess.email && <div><strong>Email:</strong> {signUpSuccess.email}</div>}
                  {signUpSuccess.username && <div><strong>Username:</strong> @{signUpSuccess.username}</div>}
                  {signUpSuccess.phone && <div><strong>Phone:</strong> {signUpSuccess.phone}</div>}
                  <div><strong>Status:</strong> <span className="font-bold text-amber-800">Pending Admin Approval</span></div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setIdentifier(signUpSuccess.username || signUpSuccess.phone || signUpSuccess.email || '');
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-sm"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignUpSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Full Name *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <UserIcon className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={signUpName}
                      onChange={(e) => setSignUpName(e.target.value)}
                      placeholder="e.g. Myriam Joseph"
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium">
                  Enter <strong>at least one</strong> contact method below — Phone Number, Username, or Email (email is optional if using phone or username).
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <AtSign className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={signUpUsername}
                        onChange={(e) => setSignUpUsername(e.target.value)}
                        placeholder="e.g. myriam_j"
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                      Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        value={signUpPhone}
                        onChange={(e) => setSignUpPhone(e.target.value)}
                        placeholder="e.g. 01012345678"
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Email Address <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={signUpEmail}
                      onChange={(e) => setSignUpEmail(e.target.value)}
                      placeholder="Optional if phone or username entered"
                      className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">
                    Password *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showSignUpPassword ? 'text' : 'password'}
                      required
                      value={signUpPassword}
                      onChange={(e) => setSignUpPassword(e.target.value)}
                      placeholder="Create a password"
                      className="w-full pl-10 pr-11 py-2 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignUpPassword((prev) => !prev)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 transition-colors focus:outline-none"
                      aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                      title={showSignUpPassword ? 'Hide password' : 'Show password'}
                    >
                      {showSignUpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Role Choice */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Requested Role / Position:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSignUpRole('admin')}
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        signUpRole === 'admin'
                          ? 'border-amber-500 bg-amber-50 text-amber-950 font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Admin</span>
                      </div>
                      <div className="text-[11px] font-normal text-slate-500 mt-1">
                        Team admin controls
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSignUpRole('worker')}
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        signUpRole === 'worker'
                          ? 'border-sky-500 bg-sky-50 text-sky-950 font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>Staff</span>
                      </div>
                      <div className="text-[11px] font-normal text-slate-500 mt-1">
                        Orders &amp; stock counts
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSignUpRole('leader')}
                      className={`p-3 rounded-xl border text-left text-xs transition-all ${
                        signUpRole === 'leader'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-bold shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Scout Leader</span>
                      </div>
                      <div className="text-[11px] font-normal text-slate-500 mt-1">
                        View items &amp; prices
                      </div>
                    </button>
                  </div>
                </div>

                {/* Pending Approval Warning */}
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    New accounts require approval from the Warehouse Admin before you can log in.
                  </span>
                </div>

                {signUpError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>{signUpError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm shadow-sm transition-all min-h-[46px]"
                >
                  <span>Register Account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-sm font-bold text-slate-700 tracking-wide">
        Made by Tony Mohab
      </div>
    </div>
  );
};
