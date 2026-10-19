import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { getCampusSession } from '../services/campusSession';

interface CampusRouteGuardProps {
  allowedRoles: Array<'student' | 'instructor' | 'org_admin'>;
  children: React.ReactElement;
}

export const CampusRouteGuard: React.FC<CampusRouteGuardProps> = ({ allowedRoles, children }) => {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();
  const session = getCampusSession(orgSlug);

  if (!session || !session.token) {
    return (
      <Navigate
        to={`/campus/${orgSlug || 'vit-chennai'}/login`}
        state={{ from: location }}
        replace
      />
    );
  }

  // Sessions are rehydrated from unvalidated storage JSON, so tolerate the legacy
  // `admin` slug alongside the canonical CampusRole union.
  const rawRole: string = session.role;
  const normalizedRole =
    rawRole === 'faculty'
      ? 'instructor'
      : rawRole === 'admin'
      ? 'org_admin'
      : rawRole;

  if (!allowedRoles.includes(normalizedRole as any)) {
    if (normalizedRole === 'student') {
      return (
        <Navigate
          to={`/campus/${orgSlug || 'vit-chennai'}/student/dashboard`}
          state={{
            accessDenied: true,
            message: 'Access Restricted: You do not have faculty or administrator privileges to view that area.',
          }}
          replace
        />
      );
    }
    if (normalizedRole === 'instructor') {
      return (
        <Navigate
          to={`/campus/${orgSlug || 'vit-chennai'}/faculty/dashboard`}
          state={{
            accessDenied: true,
            message: 'Access Restricted: Administrator privileges required to access that area.',
          }}
          replace
        />
      );
    }
    return <Navigate to={`/campus/${orgSlug || 'vit-chennai'}/login`} replace />;
  }

  return children;
};

export default CampusRouteGuard;
