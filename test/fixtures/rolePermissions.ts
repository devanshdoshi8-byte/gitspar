export function hasPermissionLevel(userLevel: number, requiredLevel: number): boolean {
  if (userLevel >= requiredLevel) {
    return true;
  }
  return false;
}
