export function normalizeConfirmationPhrase(value: string): string {
  return value.trim();
}

export function confirmationPhrasesMatch(value: string, expected: string): boolean {
  return normalizeConfirmationPhrase(value) === normalizeConfirmationPhrase(expected);
}
