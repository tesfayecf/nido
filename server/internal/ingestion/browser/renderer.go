/**
 * File: internal/ingestion/browser/renderer.go
 *
 * Purpose:
 * Implements backend behavior for the browser package.
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
 * - bytes
 * - context
 * - fmt
 * - os/exec
 * - strings
 * - time
 * - nido/server/internal/platform/config
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package browser

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"

	platformconfig "nido/server/internal/platform/config"
)

/**
 * Purpose:
 * Defines the Renderer interface used by this package and its consumers.
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
type Renderer interface {
	Render(ctx context.Context, url string) ([]byte, error)
}

/**
 * Purpose:
 * Performs the NewRenderer operation for this backend package.
 *
 * Parameters:
 * - cfg platformconfig.BrowserConfig
 *
 * Returns:
 * - Renderer
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
func NewRenderer(cfg platformconfig.BrowserConfig) Renderer {
	if strings.TrimSpace(cfg.Command) == "" {
		return unavailableRenderer{}
	}

	args := cfg.Args
	if len(args) == 0 {
		args = []string{"--headless", "--disable-gpu", "--dump-dom"}
	}

	return &commandRenderer{
		command: cfg.Command,
		args:    args,
		timeout: cfg.Timeout,
	}
}

/**
 * Purpose:
 * Defines the commandRenderer struct used by this package and its consumers.
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
type commandRenderer struct {
	command string
	args    []string
	timeout time.Duration
}

/**
 * Purpose:
 * Performs the Render operation for this backend package.
 *
 * Parameters:
 * - r *commandRenderer
 *
 * Returns:
 * - Render(ctx context.Context, url string) ([]byte, error)
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
func (r *commandRenderer) Render(ctx context.Context, url string) ([]byte, error) {
	timeout := r.timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	renderCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	command := exec.CommandContext(renderCtx, r.command, append(append([]string{}, r.args...), url)...)
	var stderr bytes.Buffer
	command.Stderr = &stderr

	output, err := command.Output()
	if err != nil {
		return nil, fmt.Errorf("render %q with %q: %w (%s)", url, r.command, err, strings.TrimSpace(stderr.String()))
	}

	return output, nil
}

/**
 * Purpose:
 * Defines the unavailableRenderer struct used by this package and its consumers.
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
type unavailableRenderer struct{}

/**
 * Purpose:
 * Performs the Render operation for this backend package.
 *
 * Parameters:
 * - unavailableRenderer
 *
 * Returns:
 * - Render(_ context.Context, url string) ([]byte, error)
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
func (unavailableRenderer) Render(_ context.Context, url string) ([]byte, error) {
	return nil, fmt.Errorf("browser rendering is not configured for %q; set NIDO_BROWSER_COMMAND to enable it", url)
}
