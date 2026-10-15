import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LinearHeaderNav } from './components/LinearHeaderNav';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { ProblemsPage } from './pages/ProblemsPage';
import { ProblemWorkspacePage } from './pages/ProblemWorkspacePage';
import { ProfilePage } from './pages/ProfilePage';
import { ContestsPage } from './pages/ContestsPage';
import { AssessmentCreatePage } from './pages/campus/AssessmentCreatePage';
import { CampusCalendarPage } from './pages/campus/CampusCalendarPage';
import { StudentExamArenaPage } from './pages/campus/StudentExamArenaPage';
import { FacultyProctorCockpitPage } from './pages/campus/FacultyProctorCockpitPage';
import { VivaInterviewWorkspacePage } from './pages/campus/VivaInterviewWorkspacePage';
import { CampusLandingPage } from './pages/campus/CampusLandingPage';
import { CampusOnboardingPage } from './pages/campus/CampusOnboardingPage';
import { CampusLoginPage } from './pages/campus/CampusLoginPage';
import { CampusSidebarLayout } from './components/CampusSidebarLayout';
import { CampusPlaceholderWorkspace } from './pages/campus/CampusPlaceholderWorkspace';
import { CampusStudentDashboard } from './pages/campus/CampusStudentDashboard';
import { CampusLabsListPage } from './pages/campus/CampusLabsListPage';
import { CampusLabReviewPage } from './pages/campus/CampusLabReviewPage';
import { CampusLabRoomPage } from './pages/campus/CampusLabRoomPage';
import { CampusAnalyticsPage } from './pages/campus/CampusAnalyticsPage';
import { CampusFacultyDashboard } from './pages/campus/CampusFacultyDashboard';
import { CampusAdminDashboard } from './pages/campus/CampusAdminDashboard';
import { HackathonsPage } from './pages/HackathonsPage';
import { HackathonDetailPage } from './pages/HackathonDetailPage';

export const App: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
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
              <Route path="/hackathons" element={<HackathonsPage />} />
              <Route path="/hackathons/:slug" element={<HackathonDetailPage />} />

              {/* Institutional Public Landing & Provisioning Wizard */}
              <Route path="/campus" element={<CampusLandingPage />} />
              <Route path="/campus/register" element={<CampusOnboardingPage />} />
              <Route path="/campus/login" element={<CampusLoginPage />} />
              <Route path="/campus/:orgSlug/login" element={<CampusLoginPage />} />

              {/* Strict 3-Tier Institutional Workspace Shell */}
              <Route path="/campus/:orgSlug" element={<CampusSidebarLayout />}>
                <Route index element={<Navigate to="student/dashboard" replace />} />
                
                {/* Student Navigation */}
                <Route path="student/dashboard" element={<CampusStudentDashboard />} />
                <Route path="student/labs" element={<CampusLabsListPage />} />
                <Route path="student/labs/completed" element={<CampusLabsListPage />} />
                <Route path="student/labs/:labId/room" element={<CampusLabRoomPage />} />
                <Route path="student/labs/:labId/review" element={<CampusLabReviewPage />} />
                <Route path="student/tests" element={<CampusLabsListPage />} />
                <Route path="student/tests/completed" element={<CampusLabsListPage />} />
                <Route path="student/analytics/:tab" element={<CampusAnalyticsPage />} />

                {/* Faculty Navigation */}
                <Route path="faculty/dashboard" element={<CampusFacultyDashboard />} />
                <Route
                  path="faculty/labs/new"
                  element={<AssessmentCreatePage />}
                />
                <Route
                  path="faculty/cockpit/:id"
                  element={<FacultyProctorCockpitPage />}
                />
                <Route
                  path="faculty/viva/:roomCode"
                  element={<VivaInterviewWorkspacePage />}
                />
                <Route
                  path="faculty/plagiarism"
                  element={
                    <CampusPlaceholderWorkspace
                      title="AST Winnowing Plagiarism Matrix & CLO Assessment"
                      category="Integrity & Outcomes"
                      description="Structural AST token-based plagiarism analysis invariant to identifier renaming, whitespace, and comments."
                    />
                  }
                />

                {/* Org Admin Navigation */}
                <Route path="admin/dashboard" element={<CampusAdminDashboard />} />
                <Route
                  path="admin/roster"
                  element={
                    <CampusPlaceholderWorkspace
                      title="Faculty & Student Roster Management"
                      category="Admin Portal"
                      description="Batch CSV user import and access management across cohorts and departments."
                    />
                  }
                />
                <Route
                  path="admin/audit"
                  element={
                    <CampusPlaceholderWorkspace
                      title="Security & Sandbox Audit Log"
                      category="Admin Portal"
                      description="Linux cgroups resource enforcement and seccomp-bpf syscall violation audits."
                    />
                  }
                />
              </Route>

              {/* Assessment Engine Direct Endpoints */}
              <Route path="/campus/assessments/new" element={<AssessmentCreatePage />} />
              <Route path="/campus/calendar" element={<CampusCalendarPage />} />
              <Route path="/campus/assessments/:id/arena" element={<StudentExamArenaPage />} />
              <Route path="/campus/assessments/:id/cockpit" element={<FacultyProctorCockpitPage />} />
              <Route path="/campus/assessments/:id/proctor" element={<FacultyProctorCockpitPage />} />
              <Route path="/campus/assessments/viva/:room_code" element={<VivaInterviewWorkspacePage />} />
              <Route path="/campus/viva/:room_code" element={<VivaInterviewWorkspacePage />} />

              {/* Legacy /portal routes mapped to identical components */}
              <Route path="/portal/:org_slug/assessments/new" element={<AssessmentCreatePage />} />
              <Route path="/portal/:org_slug/calendar" element={<CampusCalendarPage />} />
              <Route path="/portal/:org_slug/assessments/:id/arena" element={<StudentExamArenaPage />} />
              <Route path="/portal/:org_slug/assessments/:id/cockpit" element={<FacultyProctorCockpitPage />} />
              <Route path="/portal/:org_slug/viva/:room_code" element={<VivaInterviewWorkspacePage />} />
              <Route path="/portal/:org_slug" element={<Navigate to="/campus/vit-chennai/student/dashboard" replace />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
