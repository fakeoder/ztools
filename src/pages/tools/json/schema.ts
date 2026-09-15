import { analyzeValues, getType, isPrimitive, type JsonValue } from './analyze'

export type JsonSchema = Record<string, unknown>

export function generateSchema(data: JsonValue): JsonSchema {
  return toSchema(data)
}

function toSchema(value: JsonValue): JsonSchema {
  switch (getType(value)) {
    case 'null':
      return { type: 'null' }
    case 'boolean':
      return { type: 'boolean' }
    case 'number':
      return { type: 'number' }
    case 'string':
      return { type: 'string' }
    case 'array':
      return arraySchema(value as JsonValue[])
    case 'object':
      return objectSchema(value as Record<string, JsonValue>)
  }
}

function objectSchema(obj: Record<string, JsonValue>): JsonSchema {
  const properties: Record<string, JsonSchema> = {}
  for (const [key, value] of Object.entries(obj)) {
    properties[key] = toSchema(value)
  }
  return { type: 'object', properties }
}

function arraySchema(arr: JsonValue[]): JsonSchema {
  const base: JsonSchema = { type: 'array' }
  if (arr.length === 0) {
    base.items = {}
    return base
  }

  const typeCounts = analyzeValues(arr)
  if (typeCounts.length === 1 && isPrimitive(arr[0])) {
    const type = getType(arr[0])
    if (type !== 'array' && type !== 'object') {
      base.items = { type }
      return base
    }
  }

  let merged: JsonSchema | null = null
  for (const item of arr) {
    merged = merged ? mergeSchemas([merged, toSchema(item)]) : toSchema(item)
  }
  base.items = merged ?? {}
  return base
}

function mergeSchemas(schemas: JsonSchema[]): JsonSchema {
  if (schemas.length === 1) return schemas[0]

  const types = new Set<string>()
  const objects: JsonSchema[] = []
  const arrays: JsonSchema[] = []

  for (const schema of schemas) {
    const type = schema.type as string | string[] | undefined
    if (Array.isArray(type)) {
      for (const t of type) types.add(t)
    } else if (type) {
      types.add(type)
    }

    const typeSet = Array.isArray(type) ? new Set(type) : type ? new Set([type]) : new Set<string>()
    if (typeSet.has('object') && schema.properties) objects.push(schema)
    if (typeSet.has('array') && schema.items) arrays.push(schema)
  }

  const typesArr = Array.from(types)
  if (typesArr.length === 0 && objects.length === 0 && arrays.length === 0) {
    return {}
  }
  const result: JsonSchema = typesArr.length === 1 ? { type: typesArr[0] } : { type: typesArr }

  if (objects.length > 0) {
    const properties: Record<string, JsonSchema> = {}
    const presence = new Map<string, number>()
    for (const obj of objects) {
      const props = (obj.properties as Record<string, JsonSchema> | undefined) ?? {}
      for (const [key, propSchema] of Object.entries(props)) {
        presence.set(key, (presence.get(key) ?? 0) + 1)
        properties[key] = properties[key] ? mergeSchemas([properties[key], propSchema]) : propSchema
      }
    }
    result.properties = properties
    const required = Array.from(presence.entries())
      .filter(([, count]) => count === objects.length)
      .map(([key]) => key)
    if (required.length > 0) result.required = required
  }

  if (arrays.length > 0) {
    result.items = mergeSchemas(arrays.map((a) => a.items as JsonSchema))
  }

  return result
}