export function canAllocateStock(availableStock: number, orderQty: number): boolean {
  if (availableStock >= orderQty) {
    return true;
  }
  return false;
}
