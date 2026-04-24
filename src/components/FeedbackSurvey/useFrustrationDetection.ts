export type FrustrationDetectionState = 'closed' | 'open'

export type FrustrationDetectionResult = {
  state: FrustrationDetectionState
  handleTranscriptSelect: () => void
}

export function useFrustrationDetection(
  _messages: unknown[] = [],
  _isLoading = false,
  _hasActivePrompt = false,
  _showSurvey = false,
): FrustrationDetectionResult {
  return {
    state: 'closed',
    handleTranscriptSelect: () => {},
  }
}
