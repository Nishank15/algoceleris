export type CampusRole = 'student' | 'faculty' | 'org_admin';

export interface CampusUserSession {
  role: CampusRole;
  orgSlug: string;
  orgName: string;
  name: string;
  loginId: string;
  regNumber: string;
  department: string;
  initials: string;
  token?: string;
}

const STORAGE_KEY = 'algoceleris_campus_session';

export const DEMO_CAMPUS_ACCOUNTS: Record<CampusRole, CampusUserSession> = {
  student: {
    role: 'student',
    orgSlug: 'vit-chennai',
    orgName: 'Vellore Institute of Technology, Chennai',
    name: 'NISHANK CHHIPA',
    loginId: 'nishank.chhipa2025@vitstudent.ac.in',
    regNumber: '25BCE1642',
    department: 'Computer Science & Engineering',
    initials: 'NC',
  },
  faculty: {
    role: 'faculty',
    orgSlug: 'vit-chennai',
    orgName: 'Vellore Institute of Technology, Chennai',
    name: 'Dr. SARAVANAN P',
    loginId: 'saravanan.p@vit.ac.in',
    regNumber: 'FAC-7819',
    department: 'School of Computer Science (SCOPE)',
    initials: 'SP',
  },
  org_admin: {
    role: 'org_admin',
    orgSlug: 'vit-chennai',
    orgName: 'Vellore Institute of Technology, Chennai',
    name: 'Dean CSE Office',
    loginId: 'dean.cse@vit.ac.in',
    regNumber: 'ADMIN-01',
    department: 'Office of Academic Affairs & Labs',
    initials: 'DC',
  },
};

export function getCampusSession(defaultOrgSlug = 'vit-chennai'): CampusUserSession {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.role && parsed.name) {
        return parsed;
      }
    }
  } catch {
    // ignore parse error
  }
  // Default to student demo session
  const fallback = { ...DEMO_CAMPUS_ACCOUNTS.student, orgSlug: defaultOrgSlug };
  saveCampusSession(fallback);
  return fallback;
}

export function saveCampusSession(session: CampusUserSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // ignore storage error
  }
}

export function clearCampusSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
