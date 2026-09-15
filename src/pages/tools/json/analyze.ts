export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export type JType = 'null' | 'boolean' | 'number' | 'string' | 'array' | 'object'

export const MAX_DISTINCT_TRACKED = 200
export const ENUM_MAX_VALUES = 20
export const DISTINCT_DISPLAY_LIMIT = 50
export const FIELD_ENUM_ROW_LIMIT = 5000

export function getType(value: JsonValue): JType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value as JType
}

export function isPrimitive(value: JsonValue): boolean {
  if (Array.isArray(value)) return false
  return value === null || typeof value !== 'object'
}

export function isArrayOfObjects(value: JsonValue[]): value is Array<Record<string, JsonValue>> {
  return value.length > 0 && value.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item))
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

export interface DistinctValue {
  display: string
  raw: JsonValue
  count: number
}

export interface DistinctResult {
  isEnum: boolean
  values: DistinctValue[]
  totalDistinct: number
  truncated: boolean
}

export interface ValueAnalysis {
  typeCounts: TypeCount[]
  distinct: DistinctResult | null
}

export function analyzeValues(values: JsonValue[]): ValueAnalysis {
  const typeCounts = new Map<JType, number>()
  const distinctMap = new Map<string, DistinctValue>()
  let truncated = false
  let allPrimitive = true

  for (const value of values) {
    const type = getType(value)
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)

    if (!isPrimitive(value)) {
      allPrimitive = false
      continue
    }

    const display = displayValue(value)
    const existing = distinctMap.get(display)
    if (existing) {
      existing.count += 1
    } else if (distinctMap.size < MAX_DISTINCT_TRACKED) {
      distinctMap.set(display, { display, raw: value, count: 1 })
    } else {
      truncated = true
    }
  }

  const typeCountsList = Array.from(typeCounts.entries()).map(([type, count]) => ({ type, count }))

  if (!allPrimitive || distinctMap.size === 0) {
    return { typeCounts: typeCountsList, distinct: null }
  }

  const valuesList = Array.from(distinctMap.values())
  return {
    typeCounts: typeCountsList,
    distinct: {
      isEnum: !truncated && valuesList.length <= ENUM_MAX_VALUES,
      values: valuesList,
      totalDistinct: truncated ? MAX_DISTINCT_TRACKED : valuesList.length,
      truncated,
    },
  }
}

export interface FieldStat {
  key: string
  present: number
  typeCounts: TypeCount[]
  distinct: DistinctResult | null
}

export function analyzeFields(rows: Array<Record<string, JsonValue>>): FieldStat[] {
  const keyStats = new Map<
    string,
    { present: number; typeCounts: Map<JType, number>; distinct: Map<string, DistinctValue>; truncated: boolean; allPrimitive: boolean }
  >()

  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      let stat = keyStats.get(key)
      if (!stat) {
        stat = { present: 0, typeCounts: new Map(), distinct: new Map(), truncated: false, allPrimitive: true }
        keyStats.set(key, stat)
      }
      stat.present += 1

      const type = getType(value)
      stat.typeCounts.set(type, (stat.typeCounts.get(type) ?? 0) + 1)

      if (!isPrimitive(value)) {
        stat.allPrimitive = false
        continue
      }

      const display = displayValue(value)
      const existing = stat.distinct.get(display)
      if (existing) {
        existing.count += 1
      } else if (stat.distinct.size < MAX_DISTINCT_TRACKED) {
        stat.distinct.set(display, { display, raw: value, count: 1 })
      } else {
        stat.truncated = true
      }
    }
  }

  const fields: FieldStat[] = []
  for (const [key, stat] of keyStats) {
    const typeCounts = Array.from(stat.typeCounts.entries()).map(([type, count]) => ({ type, count }))
    let distinct: DistinctResult | null = null
    if (stat.allPrimitive && stat.distinct.size > 0) {
      const valuesList = Array.from(stat.distinct.values())
      distinct = {
        isEnum: !stat.truncated && valuesList.length <= ENUM_MAX_VALUES,
        values: valuesList,
        totalDistinct: stat.truncated ? MAX_DISTINCT_TRACKED : valuesList.length,
        truncated: stat.truncated,
      }
    }
    fields.push({ key, present: stat.present, typeCounts, distinct })
  }

  return fields
}

export interface RootStats {
  rootType: JType
  totalNodes: number
  maxDepth: number
  objectCount: number
  arrayCount: number
  primitiveCount: number
  keyCount?: number
  length?: number
  elementAnalysis?: ValueAnalysis
  fieldStats?: FieldStat[]
}

export function analyzeRoot(data: JsonValue): RootStats {
  let totalNodes = 0
  let maxDepth = 0
  let objectCount = 0
  let arrayCount = 0
  let primitiveCount = 0

  function walk(value: JsonValue, depth: number): void {
    totalNodes += 1
    maxDepth = Math.max(maxDepth, depth)
    if (Array.isArray(value)) {
      arrayCount += 1
      for (const item of value) walk(item, depth + 1)
    } else if (value !== null && typeof value === 'object') {
      objectCount += 1
      for (const key of Object.keys(value)) walk(value[key], depth + 1)
    } else {
      primitiveCount += 1
    }
  }
  walk(data, 0)

  const rootType = getType(data)
  const stats: RootStats = { rootType, totalNodes, maxDepth, objectCount, arrayCount, primitiveCount }

  if (Array.isArray(data)) {
    stats.length = data.length
    stats.elementAnalysis = analyzeValues(data)
    if (isArrayOfObjects(data)) {
      stats.fieldStats = analyzeFields(data)
    }
  } else if (data !== null && typeof data === 'object') {
    stats.keyCount = Object.keys(data).length
    stats.fieldStats = analyzeFields([data as Record<string, JsonValue>])
  }

  return stats
}