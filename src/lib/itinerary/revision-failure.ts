const unsafeDetail = /traceback|exception|stack|sql|api key|token|authorization|openai|google|provider|database|postgres|internal server/i;

function safeBackendSuggestion(detail?: string) {
  const normalized = detail?.trim() ?? "";
  if (/finalized/i.test(normalized)) return "This itinerary has already been finalized and can no longer be revised.";
  if (/already running|in progress|processing/i.test(normalized)) return "Another revision is already being processed. Wait for it to finish before submitting another change.";
  if (/blank|empty|instruction|specific|unsupported|not supported|invalid/i.test(normalized)) return "Try making your request more specific, such as ‘Add a dog café to Day 3 after the railroad.’";
  if (/place|location|restaurant|attraction|no .*found|couldn’t find|couldn't find|resolve/i.test(normalized)) return "We couldn’t find a suitable place for that request. Try another activity type, location, day, or budget.";
  if (/budget|cost|cheap|expensive/i.test(normalized)) return "We couldn’t satisfy that budget with the current request. Try increasing the budget or asking to replace a specific activity.";
  if (!normalized || /request failed with status [45]\d\d/i.test(normalized) || unsafeDetail.test(normalized)) {
    return "The revision service is temporarily unavailable. Please try again.";
  }
  if (normalized.length <= 160) return `${normalized.replace(/[.!?]+$/, "")}. Try making the request more specific.`;
  return "The revision service is temporarily unavailable. Please try again.";
}

export function revisionFailureMessage(detail?: string) {
  return `Revision couldn’t be applied.\n\n${safeBackendSuggestion(detail)}\n\nYour current itinerary remains unchanged.`;
}
