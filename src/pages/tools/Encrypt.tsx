import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toDataURL as qrToDataURL } from 'qrcode'
import LineNumberedTextarea from '../../components/LineNumberedTextarea'

const SOURCE_URL = 'https://github.com/fakeoder/ztools/blob/main/src/pages/tools/Encrypt.tsx'
const PBKDF2_ITERATIONS = 600_000
const ENC_PREFIX = 'ZT1'
const MAX_QR_BYTES = 2900
const IV_BYTES = 12
const SALT_BYTES = 16
const AES_KEY_BYTES = 32

const ALG_TAGS = {
  'aes-kdf': 'AES256GCM-KDF',
  'aes-key': 'AES256GCM',
  rsa: 'RSA-OAEP+AES256GCM',
} as const

type AlgId = keyof typeof ALG_TAGS
type RsaSize = 2048 | 3072 | 4096
type LastOp = 'encrypt' | 'decrypt' | null
type QrState = { label: string; fileName: string; dataUrl: string } | null
type Bytes = Uint8Array<ArrayBuffer>

const ALG_IDS: AlgId[] = ['aes-kdf', 'aes-key', 'rsa']
const RSA_SIZES: RsaSize[] = [2048, 3072, 4096]
const EXPECTED_PARTS: Record<AlgId, number> = { 'aes-kdf': 3, 'aes-key': 2, rsa: 3 }

class EncError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

function subtle(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) throw new EncError('unavailable')
  return globalThis.crypto.subtle
}

function randomBytes(length: number): Bytes {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

function bytesToB64(bytes: Bytes): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

function b64ToBytes(b64: string): Bytes {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToB64u(bytes: Bytes): string {
  return bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64uToBytes(text: string): Bytes {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  return b64ToBytes(padded)
}

function stripWhitespace(text: string): string {
  return text.replace(/\s+/g, '')
}

function pemWrap(der: ArrayBuffer, label: string): string {
  const b64 = bytesToB64(new Uint8Array(der))
  const lines = b64.match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`
}

function pemToDer(pem: string, marker: string): Bytes {
  if (!pem.includes(`-----BEGIN ${marker}-----`)) throw new EncError('invalidKey')
  const body = pem.replace(/-----[^-]+-----/g, '')
  const cleaned = stripWhitespace(body)
  if (cleaned.length === 0) throw new EncError('invalidKey')
  try {
    return b64ToBytes(cleaned)
  } catch {
    throw new EncError('invalidKey')
  }
}

function packEnvelope(algTag: string, parts: Bytes[]): string {
  return [ENC_PREFIX, algTag, ...parts.map(bytesToB64u)].join('.')
}

function parseEnvelope(text: string, expectedTag: string): Bytes[] {
  const cleaned = stripWhitespace(text.trim())
  const segments = cleaned.split('.')
  if (segments.length < 3 || segments[0] !== ENC_PREFIX) throw new EncError('invalidFormat')
  if (segments[1] !== expectedTag) throw new EncError('algMismatch')
  try {
    return segments.slice(2).map(b64uToBytes)
  } catch {
    throw new EncError('invalidFormat')
  }
}

async function deriveAesKey(passphrase: string, salt: Bytes): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey'])
  return subtle().deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function importAesKey(raw: Bytes, usages: KeyUsage[]): Promise<CryptoKey> {
  if (raw.length !== AES_KEY_BYTES) throw new EncError('invalidKey')
  return subtle().importKey('raw', raw, 'AES-GCM', false, usages)
}

async function aesEncrypt(key: CryptoKey, data: Bytes): Promise<{ iv: Bytes; ct: Bytes }> {
  const iv = randomBytes(IV_BYTES)
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, data))
  return { iv, ct }
}

async function aesDecrypt(key: CryptoKey, iv: Bytes, ct: Bytes): Promise<Bytes> {
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, key, ct))
}

async function importPublicKey(pem: string): Promise<CryptoKey> {
  const der = pemToDer(pem, 'PUBLIC KEY')
  try {
    return await subtle().importKey('spki', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
  } catch (e) {
    if (e instanceof EncError) throw e
    throw new EncError('invalidKey')
  }
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const der = pemToDer(pem, 'PRIVATE KEY')
  try {
    return await subtle().importKey('pkcs8', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt'])
  } catch {
    throw new EncError('invalidKey')
  }
}

async function rsaHybridEncrypt(publicPem: string, data: Bytes) {
  const publicKey = await importPublicKey(publicPem)
  const rawKey = randomBytes(AES_KEY_BYTES)
  const aesKey = await importAesKey(rawKey, ['encrypt'])
  const { iv, ct } = await aesEncrypt(aesKey, data)
  const ek = new Uint8Array(await subtle().encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey))
  return { ek, iv, ct }
}

async function rsaHybridDecrypt(privatePem: string, ek: Bytes, iv: Bytes, ct: Bytes): Promise<Bytes> {
  const privateKey = await importPrivateKey(privatePem)
  let rawKey: Bytes
  try {
    rawKey = new Uint8Array(await subtle().decrypt({ name: 'RSA-OAEP' }, privateKey, ek))
  } catch {
    throw new EncError('decryptFailed')
  }
  const aesKey = await importAesKey(rawKey, ['decrypt'])
  return aesDecrypt(aesKey, iv, ct)
}

async function generateRsaKeyPair(size: RsaSize): Promise<{ publicPem: string; privatePem: string }> {
  const pair = (await subtle().generateKey(
    { name: 'RSA-OAEP', modulusLength: size, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  )) as CryptoKeyPair
  const spki = await subtle().exportKey('spki', pair.publicKey)
  const pkcs8 = await subtle().exportKey('pkcs8', pair.privateKey)
  return { publicPem: pemWrap(spki, 'PUBLIC KEY'), privatePem: pemWrap(pkcs8, 'PRIVATE KEY') }
}

async function makeQr(text: string): Promise<string> {
  if (new TextEncoder().encode(text).length > MAX_QR_BYTES) throw new EncError('qrTooLong')
  try {
    return await qrToDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 512,
      color: { dark: '#000000', light: '#ffffff' },
    })
  } catch {
    throw new EncError('qrFailed')
  }
}

function download(content: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function errorCode(e: unknown, op: 'encrypt' | 'decrypt' | 'keygen' | 'qr'): { key: string; msg?: string } {
  if (e instanceof EncError) return { key: e.code }
  if (e instanceof Error) {
    if (e.name === 'OperationError' || e.name === 'DataError') {
      return { key: op === 'decrypt' ? 'decryptFailed' : 'invalidKey' }
    }
    if (e.name === 'SyntaxError') return { key: 'invalidFormat' }
    if (e.name === 'TypeError') return { key: 'invalidKey' }
    return { key: 'unknown', msg: e.message }
  }
  return { key: 'unknown', msg: String(e) }
}

export default function Encrypt() {
  const { t } = useTranslation()

  const [alg, setAlg] = useState<AlgId>('aes-kdf')
  const [passphrase, setPassphrase] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [aesKeyText, setAesKeyText] = useState('')
  const [publicKeyPem, setPublicKeyPem] = useState('')
  const [privateKeyPem, setPrivateKeyPem] = useState('')
  const [keySize, setKeySize] = useState<RsaSize>(3072)

  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [lastOp, setLastOp] = useState<LastOp>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [genBusy, setGenBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState<QrState>(null)

  const toolTags = useMemo(() => t('tools:encrypt.tags', { returnObjects: true }) as string[], [t])

  const showError = (key: string, msg?: string) => {
    setError(msg !== undefined ? t('tools:encrypt.errors.unknown', { msg }) : t(`tools:encrypt.errors.${key}`))
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable
    }
  }

  const openQr = async (text: string, label: string, fileName: string) => {
    setError(null)
    try {
      const dataUrl = await makeQr(text)
      setQr({ label, fileName, dataUrl })
    } catch (e) {
      const { key, msg } = errorCode(e, 'qr')
      showError(key, msg)
    }
  }

  const resetSecrets = () => {
    setInput('')
    setOutput('')
    setLastOp(null)
    setError(null)
    setPassphrase('')
    setAesKeyText('')
    setPublicKeyPem('')
    setPrivateKeyPem('')
    setQr(null)
  }

  const handleEncrypt = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    setQr(null)
    try {
      if (input.length === 0) throw new EncError('emptyInput')
      const data = new TextEncoder().encode(input)
      if (alg === 'aes-kdf') {
        if (passphrase.length === 0) throw new EncError('missingPassphrase')
        const salt = randomBytes(SALT_BYTES)
        const key = await deriveAesKey(passphrase, salt)
        const { iv, ct } = await aesEncrypt(key, data)
        setOutput(packEnvelope(ALG_TAGS[alg], [salt, iv, ct]))
      } else if (alg === 'aes-key') {
        const rawKey = randomBytes(AES_KEY_BYTES)
        const key = await importAesKey(rawKey, ['encrypt'])
        const { iv, ct } = await aesEncrypt(key, data)
        setAesKeyText(bytesToB64(rawKey))
        setOutput(packEnvelope(ALG_TAGS[alg], [iv, ct]))
      } else {
        if (stripWhitespace(publicKeyPem).length === 0) throw new EncError('missingKey')
        const { ek, iv, ct } = await rsaHybridEncrypt(publicKeyPem, data)
        setOutput(packEnvelope(ALG_TAGS[alg], [ek, iv, ct]))
      }
      setLastOp('encrypt')
    } catch (e) {
      const { key, msg } = errorCode(e, 'encrypt')
      showError(key, msg)
    } finally {
      setBusy(false)
    }
  }

  const handleDecrypt = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    setQr(null)
    try {
      if (input.trim().length === 0) throw new EncError('emptyInput')
      const parts = parseEnvelope(input, ALG_TAGS[alg])
      if (parts.length !== EXPECTED_PARTS[alg]) throw new EncError('invalidFormat')
      let plain: Bytes
      if (alg === 'aes-kdf') {
        if (passphrase.length === 0) throw new EncError('missingPassphrase')
        const [salt, iv, ct] = parts
        const key = await deriveAesKey(passphrase, salt)
        plain = await aesDecrypt(key, iv, ct)
      } else if (alg === 'aes-key') {
        const cleaned = stripWhitespace(aesKeyText)
        if (cleaned.length === 0) throw new EncError('missingKey')
        let rawKey: Bytes
        try {
          rawKey = b64ToBytes(cleaned)
        } catch {
          throw new EncError('invalidKey')
        }
        const key = await importAesKey(rawKey, ['decrypt'])
        const [iv, ct] = parts
        plain = await aesDecrypt(key, iv, ct)
      } else {
        if (stripWhitespace(privateKeyPem).length === 0) throw new EncError('missingKey')
        const [ek, iv, ct] = parts
        plain = await rsaHybridDecrypt(privateKeyPem, ek, iv, ct)
      }
      setOutput(new TextDecoder().decode(plain))
      setLastOp('decrypt')
    } catch (e) {
      const { key, msg } = errorCode(e, 'decrypt')
      showError(key, msg)
    } finally {
      setBusy(false)
    }
  }

  const handleGenerate = async () => {
    if (genBusy) return
    setGenBusy(true)
    setError(null)
    try {
      const pair = await generateRsaKeyPair(keySize)
      setPublicKeyPem(pair.publicPem)
      setPrivateKeyPem(pair.privatePem)
    } catch (e) {
      const { key, msg } = errorCode(e, 'keygen')
      showError(key, msg)
    } finally {
      setGenBusy(false)
    }
  }

  const outputLabel =
    lastOp === 'encrypt' ? t('tools:encrypt.outputCiphertext') : lastOp === 'decrypt' ? t('tools:encrypt.outputPlaintext') : ''
  const resultFileName = lastOp === 'encrypt' ? 'ztools-ciphertext.txt' : 'ztools-plaintext.txt'

  return (
    <section className="section tool-page">
      <div className="container">
        <div className="tool-page-head">
          <div className="tool-page-badges">
            {toolTags.map((tag) => (
              <span className="badge" key={tag}>{t(`tools:tags.${tag}`)}</span>
            ))}
          </div>
          <h1>{t('tools:encrypt.name')}</h1>
          <p>{t('tools:encrypt.desc')}</p>
        </div>

        <div className="enc-privacy">
          <LockIcon />
          <span>{t('tools:encrypt.localNote')}</span>
          <a href={SOURCE_URL} target="_blank" rel="noreferrer">
            {t('tools:encrypt.sourceCode')}
          </a>
        </div>

        <div className="enc-layout">
          <div className="enc-panel">
            <div className="enc-panel-title">{t('tools:encrypt.settingsLabel')}</div>

            <div className="enc-field">
              <label className="enc-field-label" htmlFor="enc-alg">{t('tools:encrypt.algoLabel')}</label>
              <select
                id="enc-alg"
                className="enc-select"
                value={alg}
                onChange={(e) => {
                  setAlg(e.target.value as AlgId)
                  setError(null)
                  setQr(null)
                }}
              >
                {ALG_IDS.map((id) => (
                  <option key={id} value={id}>{t(`tools:encrypt.alg.${id}`)}</option>
                ))}
              </select>
              <p className="enc-hint">{t(`tools:encrypt.algHint.${alg}`)}</p>
            </div>

            {alg === 'aes-kdf' && (
              <div className="enc-field">
                <label className="enc-field-label" htmlFor="enc-pass">{t('tools:encrypt.passphraseLabel')}</label>
                <div className="enc-pass-row">
                  <input
                    id="enc-pass"
                    className="enc-text-input"
                    type={showPass ? 'text' : 'password'}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    placeholder={t('tools:encrypt.passphrasePlaceholder')}
                    autoComplete="new-password"
                    spellCheck={false}
                  />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPass((v) => !v)}>
                    {showPass ? t('tools:encrypt.hidePass') : t('tools:encrypt.showPass')}
                  </button>
                </div>
              </div>
            )}

            {alg === 'aes-key' && (
              <div className="enc-field">
                <label className="enc-field-label" htmlFor="enc-aes-key">{t('tools:encrypt.aesKeyLabel')}</label>
                <LineNumberedTextarea
                  id="enc-aes-key"
                  value={aesKeyText}
                  onChange={(e) => setAesKeyText(e.target.value)}
                  placeholder={t('tools:encrypt.aesKeyPlaceholder')}
                  rows={3}
                  spellCheck={false}
                />
                <p className="enc-hint">{t('tools:encrypt.aesKeyHint')}</p>
                {aesKeyText.trim().length > 0 && (
                  <div className="enc-key-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyText(aesKeyText.trim())}>
                      {copied ? t('tools:encrypt.copied') : t('tools:encrypt.copy')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => download(aesKeyText.trim(), 'ztools-aes-key.txt', 'text/plain')}
                    >
                      {t('tools:encrypt.downloadKey')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => openQr(aesKeyText.trim(), t('tools:encrypt.qrKey'), 'ztools-qr-key.png')}
                    >
                      {t('tools:encrypt.qrKey')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {alg === 'rsa' && (
              <>
                <div className="enc-field">
                  <span className="enc-field-label">{t('tools:encrypt.keypairLabel')}</span>
                  <div className="enc-keygen-row">
                    <select
                      className="enc-select"
                      aria-label={t('tools:encrypt.keySizeLabel')}
                      value={keySize}
                      onChange={(e) => setKeySize(Number(e.target.value) as RsaSize)}
                    >
                      {RSA_SIZES.map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                    <button type="button" className="btn btn-primary btn-sm" disabled={genBusy} onClick={handleGenerate}>
                      {genBusy ? t('tools:encrypt.generating') : t('tools:encrypt.generate')}
                    </button>
                  </div>
                </div>

                <div className="enc-field">
                  <label className="enc-field-label" htmlFor="enc-pub">{t('tools:encrypt.publicKeyLabel')}</label>
                  <LineNumberedTextarea
                    id="enc-pub"
                    value={publicKeyPem}
                    onChange={(e) => setPublicKeyPem(e.target.value)}
                    placeholder={t('tools:encrypt.publicKeyPlaceholder')}
                    rows={5}
                    spellCheck={false}
                  />
                  {publicKeyPem.trim().length > 0 && (
                    <div className="enc-key-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyText(publicKeyPem)}>
                        {copied ? t('tools:encrypt.copied') : t('tools:encrypt.copy')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => download(publicKeyPem, 'ztools-public-key.pem', 'application/x-pem-file')}
                      >
                        {t('tools:encrypt.downloadPublic')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openQr(publicKeyPem, t('tools:encrypt.qrPublicKey'), 'ztools-qr-public-key.png')}
                      >
                        {t('tools:encrypt.qrKey')}
                      </button>
                    </div>
                  )}
                </div>

                <div className="enc-field">
                  <label className="enc-field-label" htmlFor="enc-priv">{t('tools:encrypt.privateKeyLabel')}</label>
                  <LineNumberedTextarea
                    id="enc-priv"
                    value={privateKeyPem}
                    onChange={(e) => setPrivateKeyPem(e.target.value)}
                    placeholder={t('tools:encrypt.privateKeyPlaceholder')}
                    rows={6}
                    spellCheck={false}
                  />
                  <p className="enc-warn">{t('tools:encrypt.privateWarn')}</p>
                  {privateKeyPem.trim().length > 0 && (
                    <div className="enc-key-actions">
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyText(privateKeyPem)}>
                        {copied ? t('tools:encrypt.copied') : t('tools:encrypt.copy')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => download(privateKeyPem, 'ztools-private-key.pem', 'application/x-pem-file')}
                      >
                        {t('tools:encrypt.downloadPrivate')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openQr(privateKeyPem, t('tools:encrypt.qrKey'), 'ztools-qr-private-key.png')}
                      >
                        {t('tools:encrypt.qrKey')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="enc-panel">
            <div className="enc-field">
              <label className="enc-field-label" htmlFor="enc-input">{t('tools:encrypt.inputLabel')}</label>
              <LineNumberedTextarea
                id="enc-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('tools:encrypt.inputPlaceholder')}
                rows={8}
                spellCheck={false}
              />
            </div>

            <div className="enc-run">
              <button type="button" className="btn btn-primary" disabled={busy || genBusy} onClick={handleEncrypt}>
                {busy ? t('tools:encrypt.busy') : t('tools:encrypt.encrypt')}
              </button>
              <button type="button" className="btn btn-ghost" disabled={busy || genBusy} onClick={handleDecrypt}>
                {t('tools:encrypt.decrypt')}
              </button>
              <button type="button" className="btn btn-ghost" onClick={resetSecrets}>
                {t('tools:encrypt.clear')}
              </button>
            </div>

            {error && <div className="enc-error" role="alert">{error}</div>}

            <div className="enc-field">
              <div className="enc-output-head">
                <span className="enc-field-label">{outputLabel}</span>
                {output.length > 0 && (
                  <div className="enc-key-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyText(output)}>
                      {copied ? t('tools:encrypt.copied') : t('tools:encrypt.copy')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => download(output, resultFileName, 'text/plain')}
                    >
                      {t('tools:encrypt.downloadResult')}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        openQr(
                          output,
                          lastOp === 'decrypt' ? t('tools:encrypt.qrDecrypt') : t('tools:encrypt.qrEncrypt'),
                          lastOp === 'decrypt' ? 'ztools-qr-plaintext.png' : 'ztools-qr-ciphertext.png',
                        )
                      }
                    >
                      {lastOp === 'decrypt' ? t('tools:encrypt.qrDecrypt') : t('tools:encrypt.qrEncrypt')}
                    </button>
                  </div>
                )}
              </div>
              <LineNumberedTextarea
                value={output}
                onChange={() => undefined}
                readOnly
                placeholder={t('tools:encrypt.outputPlaceholder')}
                rows={8}
                spellCheck={false}
                aria-label={outputLabel || t('tools:encrypt.outputPlaceholder')}
              />
            </div>

            {qr && (
              <div className="enc-qr">
                <img src={qr.dataUrl} alt={qr.label} />
                <span className="enc-qr-title">{qr.label}</span>
                <div className="enc-qr-actions">
                  <a className="btn btn-primary btn-sm" href={qr.dataUrl} download={qr.fileName}>
                    {t('tools:encrypt.qrDownload')}
                  </a>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQr(null)}>
                    {t('tools:encrypt.qrClose')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}
