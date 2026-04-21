package browser

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"

	platformconfig "home-searcher/server/internal/platform/config"
)

// Renderer executes a server-side browser render for JavaScript-heavy pages.
type Renderer interface {
	Render(ctx context.Context, url string) ([]byte, error)
}

// NewRenderer creates the configured browser renderer.
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

type commandRenderer struct {
	command string
	args    []string
	timeout time.Duration
}

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

type unavailableRenderer struct{}

func (unavailableRenderer) Render(_ context.Context, url string) ([]byte, error) {
	return nil, fmt.Errorf("browser rendering is not configured for %q; set HS_BROWSER_COMMAND to enable it", url)
}