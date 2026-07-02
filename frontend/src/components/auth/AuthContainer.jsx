import React, { useState, useRef, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { manualSignup, manualLogin, googleLogin, forgotPassword, resetPassword } from '../../api';

export default function AuthContainer({ onLoginSuccess }) {
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetCodeHint, setResetCodeHint] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const [pendingGoogleAuthSave, setPendingGoogleAuthSave] = useState(false);
  const [googleAccount, setGoogleAccount] = useState(null);
  const [isCheckingGoogleAccount, setIsCheckingGoogleAccount] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  
  const isGoogleAuthPopupOpenRef = useRef(false);

  // Verification effect for Google Token
  useEffect(() => {
    if (!accessToken) {
      setGoogleAccount(null);
      setIsCheckingGoogleAccount(false);
      return;
    }
    let isCancelled = false;
    async function verifyGoogleAccount() {
      try {
        setIsCheckingGoogleAccount(true);
        const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error("Google token is invalid or expired.");
        const profile = await response.json();
        if (!isCancelled) {
          setGoogleAccount({ email: profile.email || "", name: profile.name || "", picture: profile.picture || "" });
        }
      } catch {
        if (!isCancelled) setGoogleAccount(null);
      } finally {
        if (!isCancelled) setIsCheckingGoogleAccount(false);
      }
    }
    verifyGoogleAccount();
    return () => { isCancelled = true; };
  }, [accessToken]);

  // Handle saving google auth
  useEffect(() => {
    if (!pendingGoogleAuthSave || !googleAccount?.email) return;
    async function persistGoogleUser() {
      setIsAuthLoading(true);
      try {
        const payload = await googleLogin({
          name: googleAccount.name || "Google User",
          email: googleAccount.email,
          avatar: googleAccount.picture || ""
        });
        if (payload.access_token) {
          onLoginSuccess(payload.user, payload.access_token);
        }
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setPendingGoogleAuthSave(false);
        setIsAuthLoading(false);
      }
    }
    persistGoogleUser();
  }, [pendingGoogleAuthSave, googleAccount, onLoginSuccess]);

  const login = useGoogleLogin({
    onSuccess: (tokenResponse) => {
      isGoogleAuthPopupOpenRef.current = false;
      setAccessToken(tokenResponse.access_token);
    },
    onError: () => {
      isGoogleAuthPopupOpenRef.current = false;
      setPendingGoogleAuthSave(false);
      setIsAuthLoading(false);
      setErrorMessage("Google login failed. Please try again.");
    },
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive"
  });

  function handleGoogleAppAuth() {
    setErrorMessage("");
    setPendingGoogleAuthSave(true);
    if (!isGoogleAuthPopupOpenRef.current) {
      isGoogleAuthPopupOpenRef.current = true;
      login();
    }
  }

  async function handleManualAuthSubmit(event) {
    event.preventDefault();
    if (authMode === "forgot") return handleForgotPassword();
    if (authMode === "reset") return handleResetPassword();

    setErrorMessage("");
    setIsAuthLoading(true);
    try {
      const payload = authMode === "signup"
        ? await manualSignup({ name: authName.trim(), email: authEmail.trim(), password: authPassword })
        : await manualLogin({ email: authEmail.trim(), password: authPassword });

      if (payload.access_token) {
        onLoginSuccess(payload.user, payload.access_token);
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleForgotPassword() {
    const email = authEmail.trim();
    if (!email) {
      setErrorMessage("Enter your email to reset password.");
      return;
    }
    setErrorMessage("");
    setIsAuthLoading(true);
    try {
      const payload = await forgotPassword(email);
      setResetCodeHint(payload.reset_token || "");
      setAuthMode("reset");
      setAuthPassword("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!resetToken.trim()) return setErrorMessage("Enter your reset token.");
    if (authPassword.trim().length < 6) return setErrorMessage("Password must be at least 6 characters.");

    setErrorMessage("");
    setIsAuthLoading(true);
    try {
      await resetPassword({ resetToken: resetToken.trim(), newPassword: authPassword });
      setAuthMode("login");
      setAuthPassword("");
      setResetToken("");
      setResetCodeHint("");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsAuthLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="card lg:card-side bg-base-100 shadow-xl max-w-5xl w-full border border-base-300">
        <div className="card-body lg:w-1/2 p-8 md:p-12">
          <div className="flex items-center gap-2 mb-8">
            <img src="/small-logo.png" alt="V2F" className="w-10 h-10 object-contain logo-sound-wave" />
            <span className="font-bold text-xl text-base-content">Voice2Form</span>
          </div>

          <h2 className="card-title text-3xl font-extrabold mb-2">
            {authMode === "signup" ? "Create your account"
              : authMode === "forgot" ? "Forgot password"
                : authMode === "reset" ? "Reset password"
                  : "Get Started Now"}
          </h2>
          <p className="text-base-content/60 mb-6">
            {authMode === "forgot" ? "Enter your email to generate a reset token."
              : authMode === "reset" ? "Enter the reset token and set a new password."
                : "Enter your credentials to access your account."}
          </p>

          {errorMessage && (
            <div className="alert alert-error mb-6 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>{errorMessage}</span>
            </div>
          )}

          {(authMode === "login" || authMode === "signup") && (
            <>
              <button 
                type="button" 
                className="btn btn-outline hover:bg-base-200 hover:text-base-content w-full mb-4 border-base-300 shadow-sm"
                onClick={handleGoogleAppAuth}
                disabled={isAuthLoading || isCheckingGoogleAccount}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {isAuthLoading || isCheckingGoogleAccount ? "Connecting..." : "Log in with Google"}
              </button>

              <div className="divider text-base-content/40 text-sm">or</div>
            </>
          )}

          <form className="space-y-4" onSubmit={handleManualAuthSubmit}>
            {authMode === "signup" && (
              <div className="form-control">
                <label className="label"><span className="label-text font-medium">Name</span></label>
                <input type="text" className="input input-bordered w-full bg-base-100" value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Your full name" required />
              </div>
            )}

            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Email address</span></label>
              <input type="email" className="input input-bordered w-full bg-base-100" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="you@company.com" required={authMode !== "reset"} />
            </div>

            {authMode === "reset" && (
              <div className="form-control">
                <label className="label"><span className="label-text font-medium">Reset Token</span></label>
                <input type="text" className="input input-bordered w-full bg-base-100" value={resetToken} onChange={(e) => setResetToken(e.target.value)} placeholder="Paste reset token" required />
              </div>
            )}

            {authMode !== "forgot" && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Password</span>
                  {authMode === "login" && (
                    <span className="label-text-alt text-primary cursor-pointer hover:underline font-medium" onClick={() => setAuthMode("forgot")}>Forgot password?</span>
                  )}
                </label>
                <input type="password" className="input input-bordered w-full bg-base-100" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder={authMode === "signup" || authMode === "reset" ? "min 6 chars" : "Enter password"} minLength={6} required />
              </div>
            )}

            {resetCodeHint && (
              <div className="text-sm text-info bg-info/10 p-3 rounded-lg border border-info/20">
                <span className="font-semibold">Reset token:</span> {resetCodeHint}
              </div>
            )}

            <button type="submit" className="btn btn-primary w-full shadow-lg" disabled={isAuthLoading}>
              {isAuthLoading ? (
                <><span className="loading loading-spinner"></span> Please wait...</>
              ) : authMode === "signup" ? "Sign Up"
                : authMode === "forgot" ? "Send Reset Token"
                : authMode === "reset" ? "Reset Password"
                : "Login"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-base-content/70">
            {(authMode === "login" || authMode === "signup") && (
              <p>
                {authMode === "signup" ? "Already have an account? " : "Don't have an account? "}
                <button type="button" className="text-primary font-bold hover:underline" onClick={() => {
                  setAuthMode(authMode === "signup" ? "login" : "signup");
                  setErrorMessage("");
                  setResetCodeHint("");
                }}>
                  {authMode === "signup" ? "Log in" : "Sign up"}
                </button>
              </p>
            )}

            {(authMode === "forgot" || authMode === "reset") && (
              <button type="button" className="text-primary font-bold hover:underline" onClick={() => {
                setAuthMode("login");
                setErrorMessage("");
                setResetToken("");
              }}>
                Back to login
              </button>
            )}
          </div>
        </div>
        
        {/* Showcase Panel */}
        <div className="hidden lg:flex flex-col lg:w-1/2 bg-gradient-to-br from-primary to-info text-primary-content p-12 relative overflow-hidden">
          {/* Background decorations */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-black opacity-10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/3"></div>
          
          <div className="relative z-10 h-full flex flex-col justify-center">
            <h2 className="text-4xl font-extrabold mb-4 leading-tight">The simplest way to extract structured data</h2>
            <p className="text-lg opacity-90 mb-12">Transform unstructured voice notes and calls into verified records in seconds.</p>
            
            <div className="glass rounded-2xl p-2 shadow-2xl transform rotate-2 hover:rotate-0 transition-transform duration-500">
              <img src="/mockup.png" alt="Dashboard Mockup" className="rounded-xl w-full h-auto object-cover" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
