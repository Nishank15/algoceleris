export type CampusRole = 'student' | 'faculty' | 'org_admin';

export interface CampusUserSession {
  role: CampusRole;
  orgSlug: string;
  orgName: string;
  userId: string;
  name: string;
  loginId: string;
  regNumber: string;
  department?: string;
  initials: string;
  token?: string;
  cohortId?: string | null;
  cohortName?: string | null;
}

const STORAGE_KEY = 'algoceleris_campus_session';

export function getCampusSession(targetOrgSlug?: string): CampusUserSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: CampusUserSession = JSON.parse(raw);
      if (parsed && parsed.role && parsed.name) {
        if (targetOrgSlug && parsed.orgSlug.toLowerCase() !== targetOrgSlug.toLowerCase()) {
          return { ...parsed, orgSlug: targetOrgSlug };
        }
        return parsed;
      }
    }
  } catch {
    // ignore parse error
  }
  return null;
}

export function saveCampusSession(session: CampusUserSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage error
  }
}

export function clearCampusSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
