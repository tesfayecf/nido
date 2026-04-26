package application

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	engagementdomain "nido/server/internal/engagement/domain"
	platformconfig "nido/server/internal/platform/config"
)

// Notifier delivers notifications to optional outbound channels.
type Notifier interface {
	Deliver(ctx context.Context, notification engagementdomain.Notification) error
}

// NewNotifier builds the default notifier chain.
func NewNotifier(logger *slog.Logger, cfg platformconfig.NotificationsConfig) Notifier {
	notifiers := []Notifier{logNotifier{logger: logger}}
	if strings.TrimSpace(cfg.WebhookURL) != "" {
		notifiers = append(notifiers, &webhookNotifier{
			client: &http.Client{Timeout: 10 * time.Second},
			url:    cfg.WebhookURL,
		})
	}

	return multiNotifier{notifiers: notifiers}
}

type multiNotifier struct {
	notifiers []Notifier
}

func (n multiNotifier) Deliver(ctx context.Context, notification engagementdomain.Notification) error {
	for _, notifier := range n.notifiers {
		if err := notifier.Deliver(ctx, notification); err != nil {
			return err
		}
	}

	return nil
}

type logNotifier struct {
	logger *slog.Logger
}

func (n logNotifier) Deliver(_ context.Context, notification engagementdomain.Notification) error {
	n.logger.Info("notification delivered", "notification_id", notification.ID, "user_id", notification.UserID, "kind", notification.Kind)
	return nil
}

type webhookNotifier struct {
	client *http.Client
	url    string
}

func (n *webhookNotifier) Deliver(ctx context.Context, notification engagementdomain.Notification) error {
	payload, err := json.Marshal(notification)
	if err != nil {
		return fmt.Errorf("marshal notification payload: %w", err)
	}

	request, err := http.NewRequestWithContext(ctx, http.MethodPost, n.url, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("build notification webhook request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := n.client.Do(request)
	if err != nil {
		return fmt.Errorf("send notification webhook: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("notification webhook returned %s", response.Status)
	}

	return nil
}
