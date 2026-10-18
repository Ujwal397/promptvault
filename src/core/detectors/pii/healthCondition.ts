import type { Detector, RawFinding } from '../../types'
import { makeFinding, matchAll } from '../util'

const VERSION = '1.0.0'
const CONTEXT_WINDOW = 80

/** Common diagnoses and conditions. Matched case-insensitively on word boundaries, longest first. */
const CONDITIONS: readonly string[] = [
  'type 1 diabetes mellitus', 'type 2 diabetes mellitus', 'type 1 diabetes', 'type 2 diabetes', 'type i diabetes',
  'type ii diabetes', 'gestational diabetes', 'diabetes mellitus', 'diabetes', 'prediabetes',
  'hypertension', 'high blood pressure', 'heart failure', 'coronary artery disease', 'heart disease', 'stroke',
  'HIV/AIDS', 'HIV', 'acquired immunodeficiency syndrome',
  'hepatitis A', 'hepatitis B', 'hepatitis C', 'cirrhosis',
  'breast cancer', 'lung cancer', 'prostate cancer', 'colon cancer', 'colorectal cancer', 'skin cancer',
  'pancreatic cancer', 'ovarian cancer', 'cervical cancer', 'liver cancer', 'leukemia', 'leukaemia', 'lymphoma',
  'melanoma', 'cancer',
  'major depressive disorder', 'depression', 'generalized anxiety disorder', 'anxiety disorder', 'panic disorder',
  'bipolar disorder', 'schizophrenia', 'post-traumatic stress disorder', 'PTSD', 'obsessive-compulsive disorder',
  'anorexia nervosa', 'bulimia nervosa', 'ADHD', 'autism spectrum disorder', 'autism',
  'asthma', 'COPD', 'chronic obstructive pulmonary disease', 'cystic fibrosis', 'tuberculosis',
  'epilepsy', 'migraine', 'multiple sclerosis', 'dementia', "Alzheimer's disease", "Alzheimer's", 'Alzheimers',
  "Parkinson's disease", "Parkinson's", 'Parkinsons',
  'pregnancy', 'chronic kidney disease', 'kidney failure', "Crohn's disease", 'ulcerative colitis', 'lupus',
  'rheumatoid arthritis', 'fibromyalgia', 'sickle cell anemia', 'sickle cell disease',
]

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** One alternation, longest first; ASCII apostrophes also match the typographic one. */
const CONDITION_RE = new RegExp(
  '(?<![\\p{L}\\p{N}])(?:' +
    [...CONDITIONS]
      .sort((a, b) => b.length - a.length)
      .map((c) => escapeRe(c).replace(/ /g, '\\s').replace(/'/g, "['\u2019]"))
      .join('|') +
    ')(?![\\p{L}\\p{N}])',
  'giu',
)

const CONTEXT_RE =
  /(?<![\p{L}\p{N}])(?:patient|diagnos(?:ed|is|es)|dx|history of|h\/o|admitted|prescribed|treated for|suffers from|medical record|discharge|symptoms of)(?![\p{L}\p{N}])/iu

/** True if a clinical context word appears within the window before `index`, in the same paragraph. */
function clinicalContextBefore(text: string, index: number): boolean {
  let seg = text.slice(Math.max(0, index - CONTEXT_WINDOW), index)
  const breaks = [...seg.matchAll(/\n[ \t\r]*\n/g)]
  if (breaks.length > 0) {
    const last = breaks[breaks.length - 1]
    seg = seg.slice(last.index + last[0].length)
  }
  return CONTEXT_RE.test(seg)
}

export const healthConditionDetector: Detector = {
  id: 'health.condition',
  version: VERSION,
  category: 'health',
  description: 'Named diagnoses and conditions, reported only next to clinical context words',
  examples: {
    positive: [
      'Patient was diagnosed with type 2 diabetes mellitus',
      'history of hypertension',
      'admitted with tuberculosis',
    ],
    negative: ['a cancer on our codebase', 'the depression of 1929', 'asthma inhalers market report'],
  },
  detect({ text }) {
    const out: RawFinding[] = []
    for (const m of matchAll(CONDITION_RE, text)) {
      if (!clinicalContextBefore(text, m.index)) continue
      out.push(
        makeFinding({
          detectorId: 'health.condition',
          detectorVersion: VERSION,
          category: 'health',
          start: m.index,
          end: m.index + m[0].length,
          severity: 'high',
          confidence: 0.75,
          reasonCode: 'CLINICAL_CONTEXT',
          label: 'Health condition',
          explanation: 'A named diagnosis or condition appears right after a clinical context word such as "patient" or "diagnosed".',
          placeholderType: 'CONDITION',
        }),
      )
    }
    return out
  },
}
