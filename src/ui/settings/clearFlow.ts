/**
 * "Clear everything" steps. Recording is switched off in a second step, after the activity clear has
 * been rendered, because the activity state updates from a stale copy when both run in one handler.
 */
export type ClearState =
  | { phase: 'idle' }
  | { phase: 'confirming' }
  | { phase: 'clearing'; recordsRemoved: number }
  | { phase: 'cleared'; recordsRemoved: number }

export type ClearAction =
  | { type: 'ask' }
  | { type: 'cancel' }
  | { type: 'confirm'; recordsRemoved: number }
  | { type: 'recordingOff' }

export function clearReducer(state: ClearState, action: ClearAction): ClearState {
  switch (action.type) {
    case 'ask':
      return { phase: 'confirming' }
    case 'cancel':
      return { phase: 'idle' }
    case 'confirm':
      return state.phase === 'confirming' ? { phase: 'clearing', recordsRemoved: action.recordsRemoved } : state
    case 'recordingOff':
      return state.phase === 'clearing' ? { phase: 'cleared', recordsRemoved: state.recordsRemoved } : state
  }
}

/** What was cleared, in plain words. Describes the actions taken, not the state before them. */
export function clearedSummary(recordsRemoved: number): string[] {
  const records = recordsRemoved === 1 ? '1 activity record' : `${recordsRemoved} activity records`
  return [
    'Saved policy removed. The policy is back to Strict.',
    'Settings removed. Placeholder style is back to Labelled.',
    `${records} removed.`,
    'Record activity is off.',
  ]
}
