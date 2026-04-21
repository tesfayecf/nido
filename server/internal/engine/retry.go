package engine

import (
	"context"
	"math"
	"math/rand"
	"sync"
	"time"
)

// Retryer produces non-linear retry delays for scraping workloads.
type Retryer struct {
	mu   sync.Mutex
	rand *rand.Rand
}

// NewRetryer builds a retry helper with an isolated random source.
func NewRetryer(seed int64) *Retryer {
	if seed == 0 {
		seed = time.Now().UnixNano()
	}

	return &Retryer{rand: rand.New(rand.NewSource(seed))}
}

// Delay returns a gamma-distributed retry delay derived from the supplied base duration.
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

// Sleep waits for the computed delay unless the context is cancelled.
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

func (r *Retryer) uniform() float64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.rand.Float64()
}

func (r *Retryer) normal() float64 {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.rand.NormFloat64()
}
