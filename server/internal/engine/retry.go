/**
 * File: internal/engine/retry.go
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
 * - context
 * - math
 * - math/rand
 * - sync
 * - time
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package engine

import (
	"context"
	"math"
	"math/rand"
	"sync"
	"time"
)

/**
 * Purpose:
 * Defines the Retryer struct used by this package and its consumers.
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
type Retryer struct {
	mu   sync.Mutex
	rand *rand.Rand
}

/**
 * Purpose:
 * Performs the NewRetryer operation for this backend package.
 *
 * Parameters:
 * - seed int64
 *
 * Returns:
 * - *Retryer
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
func NewRetryer(seed int64) *Retryer {
	if seed == 0 {
		seed = time.Now().UnixNano()
	}

	return &Retryer{rand: rand.New(rand.NewSource(seed))}
}

/**
 * Purpose:
 * Performs the Delay operation for this backend package.
 *
 * Parameters:
 * - r *Retryer
 *
 * Returns:
 * - Delay(base time.Duration, attempt int) time.Duration
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
func (r *Retryer) Delay(base time.Duration, attempt int) time.Duration {
	if base <= 0 {
		base = 500 * time.Millisecond
	}
	if attempt <= 0 {
		attempt = 1
	}

	multiplier := sampleGamma(r, 2.2, 0.65)
	delay := float64(base) * float64(attempt) * multiplier
	if delay < float64(50*time.Millisecond) {
		delay = float64(50 * time.Millisecond)
	}

	return time.Duration(delay)
}

/**
 * Purpose:
 * Performs the Sleep operation for this backend package.
 *
 * Parameters:
 * - r *Retryer
 *
 * Returns:
 * - Sleep(ctx context.Context, base time.Duration, attempt int) error
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
func (r *Retryer) Sleep(ctx context.Context, base time.Duration, attempt int) error {
	timer := time.NewTimer(r.Delay(base, attempt))
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

/**
 * Purpose:
 * Performs the sampleGamma operation for this backend package.
 *
 * Parameters:
 * - r *Retryer, shape, scale float64
 *
 * Returns:
 * - float64
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
func sampleGamma(r *Retryer, shape, scale float64) float64 {
	if shape <= 0 || scale <= 0 {
		return 1
	}
	if shape < 1 {
		return sampleGamma(r, shape+1, scale) * math.Pow(r.uniform(), 1/shape)
	}

	d := shape - 1.0/3.0
	c := 1.0 / math.Sqrt(9*d)
	for {
		x := r.normal()
		v := 1 + c*x
		if v <= 0 {
			continue
		}
		v = v * v * v
		u := r.uniform()
		if u < 1-0.0331*x*x*x*x {
			return d * v * scale
		}
		if math.Log(u) < 0.5*x*x+d*(1-v+math.Log(v)) {
			return d * v * scale
		}
	}
}

/**
 * Purpose:
 * Performs the uniform operation for this backend package.
 *
 * Parameters:
 * - r *Retryer
 *
 * Returns:
 * - uniform() float64
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
func (r *Retryer) uniform() float64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.rand.Float64()
}

/**
 * Purpose:
 * Performs the normal operation for this backend package.
 *
 * Parameters:
 * - r *Retryer
 *
 * Returns:
 * - normal() float64
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
func (r *Retryer) normal() float64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.rand.NormFloat64()
}
