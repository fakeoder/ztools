import type { DiffOptions } from './types'

export const MAX_SHARE_CHARS = 8000

export interface SharePayload {
  a: string
  b: string
  o: DiffOptions
}

async function toBase64Gzip(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))
  const buf = await new Response(stream).arrayBuffer()
  const u8 = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < u8.length; i += 0x8000) {
    bin += String.fromCharCode(...u8.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

async function fromBase64Gzip(b64: string): Promise<string> {
  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

export async function encodeShare(payload: SharePayload): Promise<{ hash: string; tooLarge: boolean }> {
  const compressed = await toBase64Gzip(JSON.stringify(payload))
  if (compressed.length > MAX_SHARE_CHARS) return { hash: '', tooLarge: true }
  return { hash: compressed, tooLarge: false }
}

export async function decodeShare(hash: string): Promise<SharePayload | null> {
  try {
    const text = await fromBase64Gzip(hash)
    const data = JSON.parse(text) as SharePayload
    if (typeof data.a === 'string' && typeof data.b === 'string' && data.o) return data
    return null
  } catch {
    return null
  }
}