import { MAX_INPUT_CHARS } from '../../core'

/** Reads a local file as text with FileReader. Nothing is uploaded or sent over the network. */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error(`${file.name} could not be read as text.`))
    }
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`))
    reader.readAsText(file)
  })
}

/** Reads an attachment, rejecting content that is not plain text or that exceeds the core input limit. */
export async function readPromptFile(file: File): Promise<string> {
  const text = await readTextFile(file)
  if (text.includes('\u0000')) throw new Error(`${file.name} is not a plain text file.`)
  if (text.length > MAX_INPUT_CHARS) {
    throw new Error(`${file.name} is longer than ${MAX_INPUT_CHARS.toLocaleString('en-US')} characters.`)
  }
  return text
}

/** Adds an attachment below the existing prompt, separated by a blank line. */
export function appendPrompt(current: string, addition: string): string {
  return current.trim() === '' ? addition : `${current}\n\n${addition}`
}
