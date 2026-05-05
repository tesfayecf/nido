/**
 * File: internal/engine/errors.go
 *
 * Purpose:
 * Implements backend behavior for the engine package.
 *
 * Responsibilities:
 * - Provide package-specific backend behavior
 * - Keep dependencies explicit
 * - Return deterministic values to callers
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - errors
 * - fmt
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package engine

import (
	"errors"
	"fmt"
)

/**
 * Purpose:
 * Defines the FailureClass type alias or composite type used by this package and its consumers.
 *
 * Parameters:
 * - None; callers construct or receive this type through package APIs.
 *
 * Returns:
 * - Not applicable; this declaration describes data or behavior shape.
 *
 * Logic Summary:
 * - Centralizes field, method, or contract shape shared across the backend layer.
 *
 * Edge Cases:
 * - Keep field names, JSON tags, and persistence assumptions synchronized with downstream consumers.
 */
type FailureClass string

const (
	FailureRetryable FailureClass = "retryable"
	FailureFatal     FailureClass = "fatal"
)

/**
 * Purpose:
 * Defines the ClassifiedError struct used by this package and its consumers.
 *
 * Parameters:
 * - None; callers construct or receive this type through package APIs.
 *
 * Returns:
 * - Not applicable; this declaration describes data or behavior shape.
 *
 * Logic Summary:
 * - Centralizes field, method, or contract shape shared across the backend layer.
 *
 * Edge Cases:
 * - Keep field names, JSON tags, and persistence assumptions synchronized with downstream consumers.
 */
type ClassifiedError struct {
	class FailureClass
	err   error
}

/**
 * Purpose:
 * Performs the Error operation for this backend package.
 *
 * Parameters:
 * - e *ClassifiedError
 *
 * Returns:
 * - Error() string
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (e *ClassifiedError) Error() string {
	if e == nil || e.err == nil {
		return ""
	}

	return e.err.Error()
}

/**
 * Purpose:
 * Performs the Unwrap operation for this backend package.
 *
 * Parameters:
 * - e *ClassifiedError
 *
 * Returns:
 * - Unwrap() error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (e *ClassifiedError) Unwrap() error {
	if e == nil {
		return nil
	}

	return e.err
}

/**
 * Purpose:
 * Performs the FailureClass operation for this backend package.
 *
 * Parameters:
 * - e *ClassifiedError
 *
 * Returns:
 * - FailureClass() FailureClass
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func (e *ClassifiedError) FailureClass() FailureClass {
	if e == nil {
		return FailureFatal
	}

	return e.class
}

/**
 * Purpose:
 * Performs the Retryable operation for this backend package.
 *
 * Parameters:
 * - err error
 *
 * Returns:
 * - error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func Retryable(err error) error {
	if err == nil {
		return nil
	}

	return &ClassifiedError{class: FailureRetryable, err: err}
}

/**
 * Purpose:
 * Performs the Fatal operation for this backend package.
 *
 * Parameters:
 * - err error
 *
 * Returns:
 * - error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func Fatal(err error) error {
	if err == nil {
		return nil
	}

	return &ClassifiedError{class: FailureFatal, err: err}
}

/**
 * Purpose:
 * Performs the IsRetryable operation for this backend package.
 *
 * Parameters:
 * - err error
 *
 * Returns:
 * - bool
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func IsRetryable(err error) bool {
	var classified interface{ FailureClass() FailureClass }
	if errors.As(err, &classified) {
		return classified.FailureClass() == FailureRetryable
	}

	return false
}

/**
 * Purpose:
 * Performs the ClassifyHTTPStatus operation for this backend package.
 *
 * Parameters:
 * - statusCode int
 *
 * Returns:
 * - FailureClass
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func ClassifyHTTPStatus(statusCode int) FailureClass {
	switch {
	case statusCode == 403, statusCode == 408, statusCode == 425, statusCode == 429, statusCode == 503:
		return FailureRetryable
	case statusCode >= 500:
		return FailureRetryable
	default:
		return FailureFatal
	}
}

/**
 * Purpose:
 * Performs the WrapHTTPStatus operation for this backend package.
 *
 * Parameters:
 * - status string, statusCode int
 *
 * Returns:
 * - error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func WrapHTTPStatus(status string, statusCode int) error {
	err := fmt.Errorf("unexpected source status: %s", status)
	if ClassifyHTTPStatus(statusCode) == FailureRetryable {
		return Retryable(err)
	}

	return Fatal(err)
}
