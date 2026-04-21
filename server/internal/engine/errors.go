package engine

import (
	"errors"
	"fmt"
)

// FailureClass categorizes whether a scraping failure should be retried.
type FailureClass string

const (
	FailureRetryable FailureClass = "retryable"
	FailureFatal     FailureClass = "fatal"
)

// ClassifiedError wraps an error with retry semantics.
type ClassifiedError struct {
	class FailureClass
	err   error
}

// Error returns the wrapped error text.
func (e *ClassifiedError) Error() string {
	if e == nil || e.err == nil {
		return ""
	}

	return e.err.Error()
}

// Unwrap exposes the underlying error.
func (e *ClassifiedError) Unwrap() error {
	if e == nil {
		return nil
	}

	return e.err
}

// FailureClass reports the retry classification of the error.
func (e *ClassifiedError) FailureClass() FailureClass {
	if e == nil {
		return FailureFatal
	}

	return e.class
}

// Retryable marks an error as retryable.
func Retryable(err error) error {
	if err == nil {
		return nil
	}

	return &ClassifiedError{class: FailureRetryable, err: err}
}

// Fatal marks an error as fatal.
func Fatal(err error) error {
	if err == nil {
		return nil
	}

	return &ClassifiedError{class: FailureFatal, err: err}
}

// IsRetryable reports whether the supplied error should be retried.
func IsRetryable(err error) bool {
	var classified interface{ FailureClass() FailureClass }
	if errors.As(err, &classified) {
		return classified.FailureClass() == FailureRetryable
	}

	return false
}

// ClassifyHTTPStatus classifies HTTP status codes into retry buckets.
func ClassifyHTTPStatus(statusCode int) FailureClass {
	switch {
	case statusCode == 408, statusCode == 425, statusCode == 429, statusCode == 503:
		return FailureRetryable
	case statusCode >= 500:
		return FailureRetryable
	default:
		return FailureFatal
	}
}

// WrapHTTPStatus converts an HTTP status into a classified error.
func WrapHTTPStatus(status string, statusCode int) error {
	err := fmt.Errorf("unexpected source status: %s", status)
	if ClassifyHTTPStatus(statusCode) == FailureRetryable {
		return Retryable(err)
	}

	return Fatal(err)
}
