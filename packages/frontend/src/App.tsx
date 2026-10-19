import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { getCampusSession } from './services/campusSession';
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
import { CampusFacultyAnalyticsPage } from './pages/campus/CampusFacultyAnalyticsPage';
import { CampusAdminDashboard } from './pages/campus/CampusAdminDashboard';
import { FacultyProctorCockpitPage } from './pages/campus/FacultyProctorCockpitPage';
import { VivaInterviewWorkspacePage } from './pages/campus/VivaInterviewWorkspacePage';
import { StudentExamArenaPage } from './pages/campus/StudentExamArenaPage';
import { CampusWorkspacePage } from './pages/campus/CampusWorkspacePage';
import { CampusRouteGuard } from './components/CampusRouteGuard';

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
            background: 'var(--bg-canvas)',
            color: 'var(--text-primary)',
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
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
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
                color: 'var(--text-primary)',
                letterSpacing: '-0.022em',
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
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
                  backgroundColor: 'var(--accent-primary)',
                  color: 'var(--accent-primary-fg)',
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
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
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

/**
 * Campus redirect helper for aliased or unmatched campus subpaths.
 *
 * Always navigates to an ABSOLUTE path. A relative `Navigate` target inside the campus
 * splat route resolves against the full matched pathname, which previously produced an
 * unbounded `/student/dashboard/student/dashboard/...` append loop (recursive
 * "Maximum update depth exceeded" renders) on any unmatched campus URL such as
 * `/campus/:orgSlug/org_admin/dashboard`.
 *
 * - With `suffix`, redirects to that absolute campus subpath (used by legacy role-slug aliases).
 * - Without `suffix`, sends unauthenticated visitors to the tenant login page and
 *   authenticated visitors to the dashboard for their own role.
 */
const CampusRedirect: React.FC<{ suffix?: string }> = ({ suffix }) => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const slug = orgSlug || 'vit-chennai';

  if (suffix) {
    return <Navigate to={`/campus/${slug}/${suffix}`} replace />;
  }

  const session = getCampusSession(orgSlug);
  if (!session || !session.token) {
    return <Navigate to={`/campus/${slug}/login`} replace />;
  }

  // Sessions are rehydrated from unvalidated storage JSON, so tolerate the legacy
  // `admin` slug alongside the canonical CampusRole union.
  const rawRole: string = session.role;
  const normalizedRole =
    rawRole === 'faculty' ? 'instructor' : rawRole === 'admin' ? 'org_admin' : rawRole;

  const home =
    normalizedRole === 'org_admin'
      ? 'admin/dashboard'
      : normalizedRole === 'instructor'
      ? 'faculty/dashboard'
      : 'student/dashboard';

  return <Navigate to={`/campus/${slug}/${home}`} replace />;
};

/**
 * Routes that render as permanently dark-surface enterprise portals.
 *
 * The campus and hackathon portals were authored against the dark palette: they pair
 * theme-aware tokens with hardcoded lime accents (#e4f222) and dark panel literals, so they
 * are only legible on a dark canvas. Rather than rewrite every literal, the routes are
 * declared dark-only and the scope below re-establishes the dark token set for everything
 * inside them.
 */
const DARK_PORTAL_ROUTE = /^\/(?:campus|hackathons)(?:\/|$)/;

/**
 * Routed application shell.
 *
 * Renders the same `.app-container` element as before, but pins `data-theme="dark"` on it
 * while a dark-only portal route is active, so every descendant — header/navigation chrome
 * included — resolves the dark token set instead of the document's light one.
 *
 * The scope is applied to the existing container rather than a nested wrapper: that keeps
 * the DOM shape, the shell layout and the `position: relative` containing block identical
 * in both themes, so nothing outside the portals is affected.
 */
const RouteThemeScope: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const isDarkPortal = DARK_PORTAL_ROUTE.test(pathname);

  return (
    <div
      className={isDarkPortal ? 'app-container enforced-dark-surface' : 'app-container'}
      data-theme={isDarkPortal ? 'dark' : undefined}
    >
      {children}
    </div>
  );
};

export const App: React.FC = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <RouteThemeScope>
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
                  <Route index element={<CampusRouteGuard allowedRoles={['student', 'instructor', 'org_admin']}><CampusStudentDashboard /></CampusRouteGuard>} />

                  {/* Student Routes */}
                  <Route path="student/dashboard" element={<CampusRouteGuard allowedRoles={['student', 'instructor', 'org_admin']}><CampusStudentDashboard /></CampusRouteGuard>} />
                  <Route path="student/labs" element={<CampusRouteGuard allowedRoles={['student', 'instructor', 'org_admin']}><CampusLabsListPage /></CampusRouteGuard>} />
                  <Route path="student/labs/completed" element={<CampusRouteGuard allowedRoles={['student', 'instructor', 'org_admin']}><CampusLabsListPage /></CampusRouteGuard>} />
                  <Route path="student/tests" element={<CampusRouteGuard allowedRoles={['student', 'instructor', 'org_admin']}><CampusLabsListPage /></CampusRouteGuard>} />
                  <Route path="student/tests/completed" element={<CampusRouteGuard allowedRoles={['student', 'instructor', 'org_admin']}><CampusLabsListPage /></CampusRouteGuard>} />
                  <Route path="student/tests/:assessmentId" element={<CampusRouteGuard allowedRoles={['student', 'instructor', 'org_admin']}><StudentExamArenaPage /></CampusRouteGuard>} />
                  <Route path="student/labs/:labId/room" element={<CampusRouteGuard allowedRoles={['student', 'instructor', 'org_admin']}><CampusLabRoomPage /></CampusRouteGuard>} />
                  <Route path="student/labs/:labId/review" element={<CampusRouteGuard allowedRoles={['student', 'instructor', 'org_admin']}><CampusLabReviewPage /></CampusRouteGuard>} />
                  <Route path="student/analytics" element={<CampusRouteGuard allowedRoles={['student', 'instructor', 'org_admin']}><CampusAnalyticsPage /></CampusRouteGuard>} />
                  <Route path="student/analytics/:tab" element={<CampusRouteGuard allowedRoles={['student', 'instructor', 'org_admin']}><CampusAnalyticsPage /></CampusRouteGuard>} />
                  <Route path="student/workspace" element={<CampusRouteGuard allowedRoles={['student', 'instructor', 'org_admin']}><CampusWorkspacePage /></CampusRouteGuard>} />

                  {/* Faculty Routes — `/faculty/dashboard`, `/faculty/labs` and
                      `/faculty/plagiarism` share `CampusFacultyDashboard`, which selects its
                      section from the route; `/faculty/analytics` has no aggregation behind it
                      yet and renders its status instead of a second copy of the dashboard. */}
                  <Route path="faculty/dashboard" element={<CampusRouteGuard allowedRoles={['instructor', 'org_admin']}><CampusFacultyDashboard /></CampusRouteGuard>} />
                  <Route path="faculty/labs" element={<CampusRouteGuard allowedRoles={['instructor', 'org_admin']}><CampusFacultyDashboard /></CampusRouteGuard>} />
                  <Route path="faculty/analytics" element={<CampusRouteGuard allowedRoles={['instructor', 'org_admin']}><CampusFacultyAnalyticsPage /></CampusRouteGuard>} />
                  <Route path="faculty/cockpit" element={<CampusRouteGuard allowedRoles={['instructor', 'org_admin']}><FacultyProctorCockpitPage /></CampusRouteGuard>} />
                  <Route path="faculty/cockpit/:assessmentId" element={<CampusRouteGuard allowedRoles={['instructor', 'org_admin']}><FacultyProctorCockpitPage /></CampusRouteGuard>} />
                  <Route path="faculty/viva/:vivaId" element={<CampusRouteGuard allowedRoles={['instructor', 'org_admin']}><VivaInterviewWorkspacePage /></CampusRouteGuard>} />
                  <Route path="faculty/plagiarism" element={<CampusRouteGuard allowedRoles={['instructor', 'org_admin']}><CampusFacultyDashboard /></CampusRouteGuard>} />

                  {/* Admin Routes */}
                  <Route path="admin/dashboard" element={<CampusRouteGuard allowedRoles={['org_admin']}><CampusAdminDashboard /></CampusRouteGuard>} />
                  <Route path="admin/roster" element={<CampusRouteGuard allowedRoles={['org_admin']}><CampusAdminDashboard /></CampusRouteGuard>} />
                  <Route path="admin/audit" element={<CampusRouteGuard allowedRoles={['org_admin']}><CampusAdminDashboard /></CampusRouteGuard>} />

                  {/* Legacy role-slug aliases: /campus/:orgSlug/org_admin/* maps onto the
                      canonical admin/* surfaces used by the campus sidebar navigation. */}
                  <Route path="org_admin/dashboard" element={<CampusRedirect suffix="admin/dashboard" />} />
                  <Route path="org_admin/roster" element={<CampusRedirect suffix="admin/roster" />} />
                  <Route path="org_admin/audit" element={<CampusRedirect suffix="admin/audit" />} />

                  <Route path="*" element={<CampusRedirect />} />
                </Route>

                {/* Legacy Portal Redirects */}
                <Route path="/portal/*" element={<Navigate to="/campus" replace />} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </RouteThemeScope>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
