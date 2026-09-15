/**
 * Minimal copies of jsondiffpatch's Context / DiffContext classes.
 *
 * jsondiffpatch only re-exports these as types from its package root, but the
 * path-aware array filter needs to construct child diff contexts. Copied from
 * jsondiffpatch (MIT License, (c) Benjamin Eidelman).
 */

import type { Delta } from 'jsondiffpatch'

export abstract class Context<TResult> {
  abstract pipe: string
  result?: TResult
  hasResult?: boolean
  exiting?: boolean
  parent?: this
  childName?: string | number
  root?: this
  options?: unknown
  children?: this[]
  nextAfterChildren?: this | null
  next?: this | null

  setResult(result: TResult): this {
    this.result = result
    this.hasResult = true
    return this
  }

  exit(): this {
    this.exiting = true
    return this
  }

  push(child: this, name?: string | number): this {
    child.parent = this
    if (typeof name !== 'undefined') {
      child.childName = name
    }
    child.root = this.root || this
    child.options = child.options || this.options
    if (!this.children) {
      this.children = [child]
      this.nextAfterChildren = this.next || null
      this.next = child
    } else {
      const last = this.children[this.children.length - 1]
      if (last) last.next = child
      this.children.push(child)
    }
    child.next = this
    return this
  }
}

export class DiffContext extends Context<Delta> {
  left: unknown
  right: unknown
  pipe = 'diff'
  leftType?: string
  rightType?: string
  leftIsArray?: boolean
  rightIsArray?: boolean

  constructor(left: unknown, right: unknown) {
    super()
    this.left = left
    this.right = right
  }

  prepareDeltaResult<T extends Delta>(result: T): T {
    return result
  }

  setResult(result: Delta): this {
    this.prepareDeltaResult(result)
    return super.setResult(result)
  }
}