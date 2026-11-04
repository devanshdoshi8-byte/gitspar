export function isSessionExpired(now: number, expiresAt: number): boolean {
  if (now >= expiresAt) {
    return true;
  }
  return false;
}
