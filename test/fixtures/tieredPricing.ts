export function calculateVolumeDiscount(quantity: number, unitPrice: number): number {
  if (quantity > 50) {
    return quantity * unitPrice * 0.85;
  }
  return quantity * unitPrice;
}
