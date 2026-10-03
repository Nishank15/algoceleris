import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface AuthPageProps {
  mode: 'login' | 'signup';
}

export const AuthPage: React.FC<AuthPageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const isLogin = mode === 'login';
  return (
    <main className="page page-center">
      <section className="carbon-card" aria-labelledby="auth-title">
        <h1 id="auth-title" className="card-title">{isLogin ? 'Sign in' : 'Create account'}</h1>
        <form className="card-form" onSubmit={(e) => { e.preventDefault(); navigate('/problems'); }}>
          {!isLogin && <input className="field" id="auth-username" placeholder="Username" autoComplete="username" />}
          <input className="field" id="auth-email" type="email" placeholder="Email" autoComplete="email" />
          <input className="field" id="auth-password" type="password" placeholder="Password" autoComplete={isLogin ? 'current-password' : 'new-password'} />
          <button className="btn btn-secondary" id="auth-submit" type="submit">{isLogin ? 'Sign in' : 'Sign up'}</button>
        </form>
        <button className="btn btn-secondary" id="auth-guest" onClick={() => navigate('/problems')}>Continue as guest</button>
        <p className="card-foot">
          {isLogin ? <>No account? <Link to="/auth/signup">Sign up</Link></> : <>Have an account? <Link to="/auth/login">Sign in</Link></>}
        </p>
      </section>
    </main>
  );
};

export default AuthPage;
