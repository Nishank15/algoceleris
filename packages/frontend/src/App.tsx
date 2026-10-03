import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { LinearHeaderNav } from './components/LinearHeaderNav';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { ProblemsPage } from './pages/ProblemsPage';
import { ProblemWorkspacePage } from './pages/ProblemWorkspacePage';
import { ProfilePage } from './pages/ProfilePage';
import { ContestsPage } from './pages/ContestsPage';

export const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <div className="app-container">
        <LinearHeaderNav />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/login" element={<AuthPage mode="login" />} />
          <Route path="/auth/signup" element={<AuthPage mode="signup" />} />
          <Route path="/problems" element={<ProblemsPage />} />
          <Route path="/problems/:slug" element={<ProblemWorkspacePage />} />
          <Route path="/u/:username" element={<ProfilePage />} />
          <Route path="/contests" element={<ContestsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  </BrowserRouter>
  </AuthProvider>
);

export default App;
