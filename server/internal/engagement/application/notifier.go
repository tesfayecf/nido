/**
 * File: internal/engagement/application/notifier.go
 *
 * Purpose:
 * Coordinates application-level backend use cases, validation, and persistence boundaries.
 *
 * Responsibilities:
 * - Apply business rules
 * - Coordinate repositories and domain models
 * - Return typed results for transport layers
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
 * - encoding/json
 * - fmt
 * - log/slog
 * - net/http
 * - strings
 * - time
 * - nido/server/internal/engagement/domain
 * - nido/server/internal/platform/config
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

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

/**
 * Purpose:
 * Defines the Notifier interface used by this package and its consumers.
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
type Notifier interface {
	Deliver(ctx context.Context, notification engagementdomain.Notification) error
}

/**
 * Purpose:
 * Performs the NewNotifier operation for this backend package.
 *
 * Parameters:
 * - logger *slog.Logger, cfg platformconfig.NotificationsConfig
 *
 * Returns:
 * - Notifier
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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

/**
 * Purpose:
 * Defines the multiNotifier struct used by this package and its consumers.
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
type multiNotifier struct {
	notifiers []Notifier
}

/**
 * Purpose:
 * Performs the Deliver operation for this backend package.
 *
 * Parameters:
 * - n multiNotifier
 *
 * Returns:
 * - Deliver(ctx context.Context, notification engagementdomain.Notification) error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (n multiNotifier) Deliver(ctx context.Context, notification engagementdomain.Notification) error {
	for _, notifier := range n.notifiers {
		if err := notifier.Deliver(ctx, notification); err != nil {
			return err
		}
	}

	return nil
}

/**
 * Purpose:
 * Defines the logNotifier struct used by this package and its consumers.
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
type logNotifier struct {
	logger *slog.Logger
}

/**
 * Purpose:
 * Performs the Deliver operation for this backend package.
 *
 * Parameters:
 * - n logNotifier
 *
 * Returns:
 * - Deliver(_ context.Context, notification engagementdomain.Notification) error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func (n logNotifier) Deliver(_ context.Context, notification engagementdomain.Notification) error {
	n.logger.Info("notification delivered", "notification_id", notification.ID, "user_id", notification.UserID, "kind", notification.Kind)
	return nil
}

/**
 * Purpose:
 * Defines the webhookNotifier struct used by this package and its consumers.
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
type webhookNotifier struct {
	client *http.Client
	url    string
}

/**
 * Purpose:
 * Performs the Deliver operation for this backend package.
 *
 * Parameters:
 * - n *webhookNotifier
 *
 * Returns:
 * - Deliver(ctx context.Context, notification engagementdomain.Notification) error
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
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
