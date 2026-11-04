export function calculateTierDiscount(orderTotal: number, isStudent: boolean): number {
  if (orderTotal >= 100) {
    return isStudent ? orderTotal * 0.8 : orderTotal * 0.9;
  }
  return orderTotal;
}
