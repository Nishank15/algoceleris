import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LinearHeaderNav } from './components/LinearHeaderNav';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { ProblemsPage } from './pages/ProblemsPage';
import { ProblemWorkspacePage } from './pages/ProblemWorkspacePage';
import { ProfilePage } from './pages/ProfilePage';
import { ContestsPage } from './pages/ContestsPage';
import { HackathonsPage } from './pages/HackathonsPage';
import { HackathonDetailPage } from './pages/HackathonDetailPage';
import { CampusLandingPage } from './pages/campus/CampusLandingPage';
import { CampusOnboardingPage } from './pages/campus/CampusOnboardingPage';
import { CampusLoginPage } from './pages/campus/CampusLoginPage';
import { CampusSidebarLayout } from './components/CampusSidebarLayout';
import { CampusStudentDashboard } from './pages/campus/CampusStudentDashboard';
import { CampusLabsListPage } from './pages/campus/CampusLabsListPage';
import { CampusLabRoomPage } from './pages/campus/CampusLabRoomPage';
import { CampusLabReviewPage } from './pages/campus/CampusLabReviewPage';
import { CampusAnalyticsPage } from './pages/campus/CampusAnalyticsPage';
import { CampusFacultyDashboard } from './pages/campus/CampusFacultyDashboard';
import { CampusAdminDashboard } from './pages/campus/CampusAdminDashboard';
import { FacultyProctorCockpitPage } from './pages/campus/FacultyProctorCockpitPage';
import { VivaInterviewWorkspacePage } from './pages/campus/VivaInterviewWorkspacePage';
import { StudentExamArenaPage } from './pages/campus/StudentExamArenaPage';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error caught by App ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#08090a',
            color: '#ffffff',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '32px',
              borderRadius: '12px',
              background: '#0f1011',
              border: '1px solid #23252a',
              boxShadow: 'rgba(0, 0, 0, 0.4) 0px 2px 4px 0px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#eb5757',
                boxShadow: '0 0 10px rgba(235, 87, 87, 0.6)',
              }}
            />
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 510,
                margin: 0,
                color: '#ffffff',
                letterSpacing: '-0.022em',
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: '#8a8f98',
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {this.state.error?.message ||
                'An unexpected rendering error occurred. You can safely return to the problems catalog or reload.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/problems';
                }}
                style={{
                  backgroundColor: '#e4f222',
                  color: '#08090a',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 510,
                  cursor: 'pointer',
                  letterSpacing: '-0.011em',
                }}
              >
                Return to Catalog
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                style={{
                  backgroundColor: '#161718',
                  color: '#d0d6e0',
                  border: '1px solid #23252a',
                  padding: '10px 18px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: 510,
                  cursor: 'pointer',
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
};
export const App: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <div className="app-container">
            <LinearHeaderNav />
            <div className="app-content">
              <Routes>
                {/* Public Consumer Platform */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth/login" element={<AuthPage mode="login" />} />
                <Route path="/auth/signup" element={<AuthPage mode="signup" />} />
                <Route path="/problems" element={<ProblemsPage />} />
                <Route path="/problems/:slug" element={<ProblemWorkspacePage />} />
                <Route path="/u/:username" element={<ProfilePage />} />
                <Route path="/contests" element={<ContestsPage />} />

                {/* Hackathons - Production Linear-Native Platform */}
                <Route path="/hackathons" element={<HackathonsPage />} />
                <Route path="/hackathons/:slug" element={<HackathonDetailPage />} />

                {/* Campus Multi-Tenant Platform (Phase 31) */}
                <Route path="/campus" element={<CampusLandingPage />} />
                <Route path="/campus/register" element={<CampusOnboardingPage />} />
                <Route path="/campus/login" element={<Navigate to="/campus" replace />} />
                <Route path="/campus/:orgSlug/login" element={<CampusLoginPage />} />

                {/* Role-Gated Campus Workspace Shell */}
                <Route path="/campus/:orgSlug" element={<CampusSidebarLayout />}>
                  <Route index element={<CampusStudentDashboard />} />

                  {/* Student Routes */}
                  <Route path="student/dashboard" element={<CampusStudentDashboard />} />
                  <Route path="student/labs" element={<CampusLabsListPage />} />
                  <Route path="student/labs/completed" element={<CampusLabsListPage />} />
                  <Route path="student/tests" element={<CampusLabsListPage />} />
                  <Route path="student/tests/completed" element={<CampusLabsListPage />} />
                  <Route path="student/tests/:assessmentId" element={<StudentExamArenaPage />} />
                  <Route path="student/labs/:labId/room" element={<CampusLabRoomPage />} />
                  <Route path="student/labs/:labId/review" element={<CampusLabReviewPage />} />
                  <Route path="student/analytics" element={<CampusAnalyticsPage />} />
                  <Route path="student/analytics/:tab" element={<CampusAnalyticsPage />} />

                  {/* Faculty Routes */}
                  <Route path="faculty/dashboard" element={<CampusFacultyDashboard />} />
                  <Route path="faculty/labs" element={<CampusFacultyDashboard />} />
                  <Route path="faculty/analytics" element={<CampusFacultyDashboard />} />
                  <Route path="faculty/cockpit" element={<FacultyProctorCockpitPage />} />
                  <Route path="faculty/cockpit/:assessmentId" element={<FacultyProctorCockpitPage />} />
                  <Route path="faculty/viva/:vivaId" element={<VivaInterviewWorkspacePage />} />
                  <Route path="faculty/plagiarism" element={<CampusFacultyDashboard />} />

                  {/* Admin Routes */}
                  <Route path="admin/dashboard" element={<CampusAdminDashboard />} />
                  <Route path="admin/roster" element={<CampusAdminDashboard />} />
                  <Route path="admin/audit" element={<CampusAdminDashboard />} />

                  <Route path="*" element={<Navigate to="student/dashboard" replace />} />
                </Route>

                {/* Legacy Portal Redirects */}
                <Route path="/portal/*" element={<Navigate to="/campus" replace />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </div>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
