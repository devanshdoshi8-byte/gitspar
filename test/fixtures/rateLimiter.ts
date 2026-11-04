export function isRateLimitAllowed(requestCount: number, maxAllowed: number): boolean {
  if (requestCount <= maxAllowed) {
    return true;
  }
  return false;
}
