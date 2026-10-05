import { Problem, Difficulty } from '../types';
import { GuestSubmissionItem } from './api';

const SOLVED_STORAGE_KEY = 'cloud_judge_solved_problems';
const ATTEMPTED_STORAGE_KEY = 'cloud_judge_attempted_problems';
const GUEST_SUBMISSIONS_STORAGE_KEY = 'cloud_judge_guest_submissions';

export function getGuestSubmissions(): GuestSubmissionItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(GUEST_SUBMISSIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function recordGuestSubmission(item: GuestSubmissionItem): void {
  if (typeof window === 'undefined') return;
  const current = getGuestSubmissions();
  const updated = [item, ...current].slice(0, 50);
  try {
    localStorage.setItem(GUEST_SUBMISSIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to store guest submission in localStorage:', err);
  }
}

export function clearGuestSubmissions(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GUEST_SUBMISSIONS_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getSolvedProblemIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SOLVED_STORAGE_KEY);
    if (!raw) return new Set(['two-sum']); // default two-sum as solved demo for fresh users
    return new Set(JSON.parse(raw));
  } catch {
    return new Set(['two-sum']);
  }
}

export function getAttemptedProblemIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(ATTEMPTED_STORAGE_KEY);
    if (!raw) return new Set(['longest-substring']);
    return new Set(JSON.parse(raw));
  } catch {
    return new Set(['longest-substring']);
  }
}

export function markProblemSolved(problemId: string): void {
  if (typeof window === 'undefined') return;
  const solved = getSolvedProblemIds();
  solved.add(problemId);
  localStorage.setItem(SOLVED_STORAGE_KEY, JSON.stringify(Array.from(solved)));
}

export function markProblemAttempted(problemId: string): void {
  if (typeof window === 'undefined') return;
  const attempted = getAttemptedProblemIds();
  attempted.add(problemId);
  localStorage.setItem(ATTEMPTED_STORAGE_KEY, JSON.stringify(Array.from(attempted)));
}

export function getProblemSolvedStatus(
  problemId: string,
  solvedSet?: Set<string>,
  attemptedSet?: Set<string>
): 'solved' | 'attempted' | 'unsolved' {
  const solved = solvedSet || getSolvedProblemIds();
  if (solved.has(problemId)) return 'solved';
  const attempted = attemptedSet || getAttemptedProblemIds();
  if (attempted.has(problemId)) return 'attempted';
  return 'unsolved';
}

export function getAllTopics(problems: Problem[]): string[] {
  const tagCounts = new Map<string, number>();
  for (const p of problems) {
    for (const tag of p.tags || []) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    }
  }
  // Sort topics by frequency descending
  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
}

export function filterProblems(
  problems: Problem[],
  query: string,
  difficulty: Difficulty | 'All' | null,
  tag: string | null
): Problem[] {
  const cleanQuery = query.trim().toLowerCase();

  return problems.filter((p) => {
    // 1. Difficulty filter
    if (difficulty && difficulty !== 'All' && p.difficulty !== difficulty) {
      return false;
    }

    // 2. Tag filter
    if (tag && tag !== 'All Topics' && !(p.tags || []).includes(tag)) {
      return false;
    }

    // 3. Search query match
    if (cleanQuery) {
      const matchTitle = p.title.toLowerCase().includes(cleanQuery);
      const matchId = p.id.toLowerCase().includes(cleanQuery);
      const matchTag = (p.tags || []).some((t) => t.toLowerCase().includes(cleanQuery));
      if (!matchTitle && !matchId && !matchTag) {
        return false;
      }
    }

    return true;
  });
}
