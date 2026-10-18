import { validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import type { Detector, RawFinding } from '../../types'
import { hasLabelBefore, makeFinding, matchAll } from '../util'
import { DETECTOR_VERSION, fake, HEX } from './helpers'

const WORDS = new Set<string>(wordlist)
const VALID_SIZES = [24, 21, 18, 15, 12] as const
/** Hard cap on checksum verifications per detect() call; beyond it, in-list windows are reported unverified. */
const MAX_VALIDATIONS = 200
const WORD_RE = /(?<![A-Za-z])[A-Za-z]{3,8}(?![A-Za-z])/g
/** Separators between words: whitespace, commas, at most one newline, and list numbering such as "2." */
const GAP_RE = /^(?:[ \t,\r\n]|\d{1,2}[.):]?)+$/

interface Word {
  start: number
  end: number
  /** Lower-cased word, as used for wordlist lookup and checksum validation. */
  text: string
}

function isSeparator(gap: string): boolean {
  if (!GAP_RE.test(gap) || !/[ \t,\r\n]/.test(gap)) return false
  return (gap.match(/\n/g)?.length ?? 0) <= 1
}

/** Runs of consecutive BIP39 words joined by plain separators (spaces, tabs, commas, a newline, list numbers). */
function findRuns(text: string): Word[][] {
  const runs: Word[][] = []
  let current: Word[] = []
  const flush = () => {
    if (current.length >= 12) runs.push(current)
    current = []
  }
  for (const m of matchAll(WORD_RE, text)) {
    const lower = m[0].toLowerCase()
    const word: Word = { start: m.index, end: m.index + m[0].length, text: lower }
    const prev = current[current.length - 1]
    if (prev && !isSeparator(text.slice(prev.end, word.start))) flush()
    if (WORDS.has(lower)) current.push(word)
    else flush()
  }
  flush()
  return runs
}

function mnemonicOf(words: Word[]): string {
  return words.map((w) => w.text).join(' ')
}

function seedFinding(words: Word[], valid: boolean, confidence: number): RawFinding {
  return makeFinding({
    detectorId: 'crypto.bip39-seed',
    detectorVersion: DETECTOR_VERSION,
    category: 'crypto_seed',
    start: words[0].start,
    end: words[words.length - 1].end,
    severity: 'critical',
    confidence,
    reasonCode: valid ? 'BIP39_CHECKSUM_VALID' : 'BIP39_WORDS_ONLY',
    label: 'Recovery seed phrase',
    explanation: valid
      ? `${words.length} consecutive BIP39 words whose checksum is consistent with a mnemonic.`
      : `${words.length} consecutive BIP39 wordlist words; the checksum did not validate, so this may be a typo or ordinary text.`,
    placeholderType: 'SEED_PHRASE',
  })
}

/** Reports checksum-valid windows first, otherwise the run itself when its length is a valid size. */
function findingsForRun(run: Word[], budget: { left: number }): RawFinding[] {
  const out: RawFinding[] = []
  let i = 0
  while (i + 12 <= run.length) {
    if (budget.left <= 0) {
      // Validation budget spent: report remaining in-list windows of a valid length without a checksum.
      const size = VALID_SIZES.find((s) => i + s <= run.length) ?? 12
      out.push(seedFinding(run.slice(i, i + size), false, 0.75))
      i += size
      // Cover a short tail with a final overlapping 12-word window so no trailing words stay unflagged.
      if (i < run.length && run.length - i < 12) out.push(seedFinding(run.slice(run.length - 12), false, 0.75))
      continue
    }
    let found: number | undefined
    for (const s of VALID_SIZES) {
      if (i + s > run.length || budget.left <= 0) continue
      budget.left--
      if (validateMnemonic(mnemonicOf(run.slice(i, i + s)), wordlist)) {
        found = s
        break
      }
    }
    if (found) {
      out.push(seedFinding(run.slice(i, i + found), true, 0.97))
      i += found
    } else {
      i += 1
    }
  }
  if (out.length === 0 && (VALID_SIZES as readonly number[]).includes(run.length)) {
    out.push(seedFinding(run, false, 0.75))
  }
  return out
}

export const bip39Detector: Detector = {
  id: 'crypto.bip39-seed',
  version: DETECTOR_VERSION,
  category: 'crypto_seed',
  description: 'Runs of 12/15/18/21/24 lowercase BIP39 words (checksum-validated when possible)',
  examples: {
    positive: [
      'seed: abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      'abandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon\nabandon',
      'legal winner thank year wave sausage worth useful legal winner thank yellow',
    ],
    negative: [
      'the quick brown fox jumps over the lazy dog while it rains today',
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon',
      'abandon, abandon, abandon abandon and abandon abandon abandon abandon abandon abandon abandon about',
    ],
  },
  detect({ text }) {
    const budget = { left: MAX_VALIDATIONS }
    return findRuns(text).flatMap((run) => findingsForRun(run, budget))
  },
}

const ETH_RE = /(?<![0-9A-Za-z])(?:0x)?[0-9a-fA-F]{64}(?![0-9A-Za-z])/g
const ETH_LABELS = ['private key', 'private_key', 'privatekey', 'private-key', 'privkey', 'priv_key', 'wallet key', 'wallet_key', 'walletkey']

export const ethPrivateKeyDetector: Detector = {
  id: 'crypto.eth-private-key',
  version: DETECTOR_VERSION,
  category: 'crypto_seed',
  description: '64-hex-character wallet private key next to a private key label',
  examples: {
    positive: ['private key: 0x' + fake(64, 80, HEX), 'WALLET_KEY=' + fake(64, 81, HEX), 'privKey = "' + fake(64, 82, HEX) + '"'],
    negative: [
      'sha256: ' + fake(64, 83, HEX),
      'commit ' + fake(64, 84, HEX),
      'private key: ' + fake(60, 85, HEX),
      'private key location is /etc/ssl/' + fake(64, 86, HEX).slice(0, 10),
    ],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(ETH_RE, text)) {
      if (!hasLabelBefore(text, m.index, ETH_LABELS, 30)) continue
      out.push(
        makeFinding({
          detectorId: 'crypto.eth-private-key',
          detectorVersion: DETECTOR_VERSION,
          category: 'crypto_seed',
          start: m.index,
          end: m.index + m[0].length,
          severity: 'critical',
          confidence: 0.8,
          reasonCode: 'LABEL_CONTEXT',
          label: 'Wallet private key',
          explanation: 'A 64-character hex value follows a private key label.',
          placeholderType: 'WALLET_KEY',
        }),
      )
    }
    return out
  },
}

export const CRYPTO_DETECTORS: Detector[] = [bip39Detector, ethPrivateKeyDetector]
