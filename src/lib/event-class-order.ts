// Generated from parplay/src/tournaments/classOrder.ts; run scripts/sync-event-class-order.cjs.
// Shared sports order for Tournament and League result sections and class chips.
export const EVENT_CLASS_ORDER = [
  "MPO", "FPO",
  "MP40", "FP40", "MP50", "FP50", "MP60",
  "MA1", "FA1", "MA2", "FA2", "MA3", "FA3", "MA4", "FA4",
  "MA40", "FA40", "MA50", "FA50", "MA60", "FA60",
  "MJ18", "FJ18", "MJ15", "FJ15",
  "RPA", "RAH", "RAD", "RAE", "RAF", "RAG",
  "MIX", "MIX-18", "MIX-15",
] as const;

const ranks = new Map<string, number>(EVENT_CLASS_ORDER.map((code, index) => [code, index]));
const compareText = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function compareEventClasses(aCode: string, bCode: string, aId = "", bId = ""): number {
  const a = aCode.trim().toUpperCase();
  const b = bCode.trim().toUpperCase();
  return (ranks.get(a) ?? EVENT_CLASS_ORDER.length) - (ranks.get(b) ?? EVENT_CLASS_ORDER.length)
    || compareText(a, b)
    || compareText(aId, bId);
}
