package engine

import "testing"

func TestClassifyHTTPStatusTreatsForbiddenAsRetryable(t *testing.T) {
	t.Parallel()

	if got := ClassifyHTTPStatus(403); got != FailureRetryable {
		t.Fatalf("expected forbidden responses to be retryable, got %q", got)
	}
}
