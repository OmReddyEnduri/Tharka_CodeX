// Identification, not authentication: captured per contest (not globally),
// since a shared lab laptop may host different students across different
// contests. No password - a student could type someone else's roll number;
// accepted tradeoff of the no-auth decision for this trusted lab environment.
export interface Identity {
  name: string;
  rollNumber: string;
}

const key = (contestId: string) => `contest_identity_${contestId}`;

export function getIdentity(contestId: string): Identity | null {
  const raw = localStorage.getItem(key(contestId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setIdentity(contestId: string, identity: Identity): void {
  localStorage.setItem(key(contestId), JSON.stringify(identity));
}
