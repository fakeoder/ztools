/**
 * Path-aware array diff filter for jsondiffpatch.
 *
 * Adapted from jsondiffpatch (MIT License, (c) Benjamin Eidelman).
 * The only behavioural change vs. the upstream `arrays` filter is that the
 * object hash is resolved per-array-path, so identity keys can be configured
 * per JSON path instead of globally.
 */

import type { Delta } from 'jsondiffpatch'
import { DiffContext } from './diffcontext'
import { escapePointerSeg } from './pointer'

interface MatchContext {
  objectHash?: (item: object, index?: number) => string | undefined
  matchByPosition?: boolean
  hashCache1?: (string | undefined)[]
  hashCache2?: (string | undefined)[]
}

type MatchFn = (a: unknown[], b: unknown[], i1: number, i2: number, ctx: MatchContext) => boolean

interface Subsequence {
  sequence: unknown[]
  indices1: number[]
  indices2: number[]
}

interface LengthMatrix {
  [i: number]: number[]
  match?: MatchFn
}

const defaultMatch: MatchFn = (array1, array2, index1, index2) => array1[index1] === array2[index2]

function lengthMatrix(array1: unknown[], array2: unknown[], match: MatchFn, context: MatchContext): LengthMatrix {
  const len1 = array1.length
  const len2 = array2.length
  const matrix: LengthMatrix = new Array(len1 + 1)
  for (let x = 0; x < len1 + 1; x++) {
    matrix[x] = new Array(len2 + 1).fill(0)
  }
  matrix.match = match
  for (let x = 1; x < len1 + 1; x++) {
    const rowX = matrix[x]
    const rowBefore = matrix[x - 1]
    if (!rowX || !rowBefore) throw new Error('LCS matrix row is undefined')
    for (let y = 1; y < len2 + 1; y++) {
      if (match(array1, array2, x - 1, y - 1, context)) {
        rowX[y] = (rowBefore[y - 1] ?? 0) + 1
      } else {
        rowX[y] = Math.max(rowBefore[y] ?? 0, rowX[y - 1] ?? 0)
      }
    }
  }
  return matrix
}

function backtrack(matrix: LengthMatrix, array1: unknown[], array2: unknown[], context: MatchContext): Subsequence {
  let index1 = array1.length
  let index2 = array2.length
  const subsequence: Subsequence = { sequence: [], indices1: [], indices2: [] }
  while (index1 !== 0 && index2 !== 0) {
    const match = matrix.match
    if (!match) throw new Error('LCS matrix match function is undefined')
    const sameLetter = match(array1, array2, index1 - 1, index2 - 1, context)
    if (sameLetter) {
      subsequence.sequence.unshift(array1[index1 - 1])
      subsequence.indices1.unshift(index1 - 1)
      subsequence.indices2.unshift(index2 - 1)
      --index1
      --index2
    } else {
      const valueAbove = matrix[index1]?.[index2 - 1]
      const valueLeft = matrix[index1 - 1]?.[index2]
      if (valueAbove === undefined || valueLeft === undefined) {
        throw new Error('LCS matrix value is undefined')
      }
      if (valueAbove > valueLeft) {
        --index2
      } else {
        --index1
      }
    }
  }
  return subsequence
}

function lcsGet(
  array1: unknown[],
  array2: unknown[],
  match?: MatchFn,
  context?: MatchContext,
): Subsequence {
  const innerContext: MatchContext = context || {}
  const matrix = lengthMatrix(array1, array2, match || defaultMatch, innerContext)
  return backtrack(matrix, array1, array2, innerContext)
}

function arraysHaveMatchByRef(array1: unknown[], array2: unknown[], len1: number, len2: number) {
  for (let index1 = 0; index1 < len1; index1++) {
    const val1 = array1[index1]
    for (let index2 = 0; index2 < len2; index2++) {
      const val2 = array2[index2]
      if (index1 !== index2 && val1 === val2) {
        return true
      }
    }
  }
  return false
}

function pathOf(context: DiffContext): string {
  const parts: (string | number)[] = []
  let c: DiffContext | undefined = context
  while (c) {
    if (c.childName !== undefined) parts.unshift(c.childName)
    c = c.parent
  }
  return parts.length === 0 ? '' : '/' + parts.map((s) => escapePointerSeg(String(s))).join('/')
}

const ARRAY_MOVE = 3

export function createPathAwareArrayFilter(
  globalObjectHash: (item: object, index?: number) => string | undefined,
  resolveField: (path: string) => string | undefined,
): { (context: unknown): void; filterName: string } {
  const matchItems: MatchFn = (array1, array2, index1, index2, context) => {
    const value1 = array1[index1]
    const value2 = array2[index2]
    if (value1 === value2) {
      return true
    }
    if (typeof value1 !== 'object' || typeof value2 !== 'object' || value1 === null || value2 === null) {
      return false
    }
    const objectHash = context.objectHash
    if (!objectHash) {
      return context.matchByPosition === true && index1 === index2
    }
    context.hashCache1 = context.hashCache1 || []
    let hash1 = context.hashCache1[index1]
    if (typeof hash1 === 'undefined') {
      context.hashCache1[index1] = hash1 = objectHash(value1 as object, index1)
    }
    if (typeof hash1 === 'undefined') {
      return false
    }
    context.hashCache2 = context.hashCache2 || []
    let hash2 = context.hashCache2[index2]
    if (typeof hash2 === 'undefined') {
      context.hashCache2[index2] = hash2 = objectHash(value2 as object, index2)
    }
    if (typeof hash2 === 'undefined') {
      return false
    }
    return hash1 === hash2
  }

  const arraysDiffFilter = (raw: unknown) => {
    const context = raw as DiffContext
    if (!context.leftIsArray) {
      return
    }
    const left = context.left as unknown[]
    const right = context.right as unknown[]
    const arrPath = pathOf(context)
    const field = resolveField(arrPath)
    const pathHash = (item: object, index?: number): string | undefined => {
      if (field) {
        const v = (item as Record<string, unknown>)[field]
        if (v === undefined || v === null) return undefined
        const t = typeof v
        if (t === 'string' || t === 'number') return `${field}:${String(v)}`
        return undefined
      }
      return globalObjectHash(item, index)
    }
    const matchContext: MatchContext = {
      objectHash: pathHash,
      matchByPosition: (context.options as { matchByPosition?: boolean } | undefined)?.matchByPosition,
    }

    let commonHead = 0
    let commonTail = 0
    let index: number
    let index1: number
    let index2: number

    const len1 = left.length
    const len2 = right.length

    if (len1 > 0 && len2 > 0 && !matchContext.objectHash && typeof matchContext.matchByPosition !== 'boolean') {
      matchContext.matchByPosition = !arraysHaveMatchByRef(left, right, len1, len2)
    }

    while (
      commonHead < len1 &&
      commonHead < len2 &&
      matchItems(left, right, commonHead, commonHead, matchContext)
    ) {
      index = commonHead
      const child = new DiffContext(left[index], right[index])
      context.push(child, index)
      commonHead++
    }

    while (
      commonTail + commonHead < len1 &&
      commonTail + commonHead < len2 &&
      matchItems(left, right, len1 - 1 - commonTail, len2 - 1 - commonTail, matchContext)
    ) {
      index1 = len1 - 1 - commonTail
      index2 = len2 - 1 - commonTail
      const child = new DiffContext(left[index1], right[index2])
      context.push(child, index2)
      commonTail++
    }

    let result: Record<string, unknown> | undefined
    if (commonHead + commonTail === len1) {
      if (len1 === len2) {
        context.setResult(undefined).exit()
        return
      }
      result = result || { _t: 'a' }
      for (index = commonHead; index < len2 - commonTail; index++) {
        result[index] = [right[index]] as Delta
        context.prepareDeltaResult(result[index] as Delta)
      }
      context.setResult(result as unknown as Delta).exit()
      return
    }

    if (commonHead + commonTail === len2) {
      result = result || { _t: 'a' }
      for (index = commonHead; index < len1 - commonTail; index++) {
        const key = `_${index}`
        result[key] = [left[index], 0, 0] as Delta
        context.prepareDeltaResult(result[key] as Delta)
      }
      context.setResult(result as unknown as Delta).exit()
      return
    }

    matchContext.hashCache1 = undefined
    matchContext.hashCache2 = undefined

    const trimmed1 = left.slice(commonHead, len1 - commonTail)
    const trimmed2 = right.slice(commonHead, len2 - commonTail)
    const seq = lcsGet(trimmed1, trimmed2, matchItems, matchContext)

    const removedItems: number[] = []
    result = result || { _t: 'a' }
    for (index = commonHead; index < len1 - commonTail; index++) {
      if (seq.indices1.indexOf(index - commonHead) < 0) {
        const key = `_${index}`
        result[key] = [left[index], 0, 0] as Delta
        context.prepareDeltaResult(result[key] as Delta)
        removedItems.push(index)
      }
    }

    const options = context.options as {
      arrays?: { detectMove?: boolean; includeValueOnMove?: boolean }
    }
    let detectMove = true
    if (options?.arrays && options.arrays.detectMove === false) {
      detectMove = false
    }
    let includeValueOnMove = false
    if (options?.arrays?.includeValueOnMove) {
      includeValueOnMove = true
    }

    const removedItemsLength = removedItems.length
    for (index = commonHead; index < len2 - commonTail; index++) {
      const indexOnArray2 = seq.indices2.indexOf(index - commonHead)
      if (indexOnArray2 < 0) {
        let isMove = false
        if (detectMove && removedItemsLength > 0) {
          for (let removeItemIndex1 = 0; removeItemIndex1 < removedItemsLength; removeItemIndex1++) {
            index1 = removedItems[removeItemIndex1]
            const resultItem = result[`_${index1}`]
            if (
              index1 !== undefined &&
              resultItem &&
              matchItems(trimmed1, trimmed2, index1 - commonHead, index - commonHead, matchContext)
            ) {
              const arr = resultItem as unknown[]
              arr.splice(1, 2, index, ARRAY_MOVE)
              if (!includeValueOnMove) {
                arr[0] = ''
              }
              index2 = index
              const child = new DiffContext(left[index1], right[index2])
              context.push(child, index2)
              removedItems.splice(removeItemIndex1, 1)
              isMove = true
              break
            }
          }
        }
        if (!isMove) {
          result[index] = [right[index]] as Delta
          context.prepareDeltaResult(result[index] as Delta)
        }
      } else {
        index1 = seq.indices1[indexOnArray2] + commonHead
        index2 = seq.indices2[indexOnArray2] + commonHead
        const child = new DiffContext(left[index1], right[index2])
        context.push(child, index2)
      }
    }

    context.setResult(result as unknown as Delta).exit()
  }
  arraysDiffFilter.filterName = 'arrays'
  return arraysDiffFilter
}