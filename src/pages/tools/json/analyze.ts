export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export type JType = 'null' | 'boolean' | 'number' | 'string' | 'array' | 'object'

export function getType(value: JsonValue): JType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value as JType
}

export function isPrimitive(value: JsonValue): boolean {
  if (Array.isArray(value)) return false
  return value === null || typeof value !== 'object'
}

export function displayValue(value: JsonValue): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}

export interface TypeCount {
  type: JType
  count: number
}

export function analyzeValues(values: JsonValue[]): TypeCount[] {
  const typeCounts = new Map<JType, number>()
  for (const value of values) {
    const type = getType(value)
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
  }
  return Array.from(typeCounts.entries()).map(([type, count]) => ({ type, count }))
}