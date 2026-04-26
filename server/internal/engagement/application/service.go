package application

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"math"
	"strconv"
	"strings"
	"time"

	engagementdomain "nido/server/internal/engagement/domain"
	ingestiondomain "nido/server/internal/ingestion/domain"
	"nido/server/internal/platform/id"
)

var (
	// ErrInvalidAlertRule indicates that the supplied alert rule is invalid.
	ErrInvalidAlertRule = errors.New("invalid alert rule")
)

const (
	// significantPriceChangeThresholdPct is the minimum percentage change that qualifies
	// as a significant price change for the significant_price_change rule type.
	significantPriceChangeThresholdPct = 2.0
)

// Store defines the persistence contract required by the engagement service.
type Store interface {
	AddBookmark(ctx context.Context, userID, propertyID string, createdAt time.Time) error
	ListBookmarks(ctx context.Context, userID string) ([]engagementdomain.BookmarkedProperty, error)
	RemoveBookmark(ctx context.Context, userID, propertyID string) error
	CreateAlertRule(ctx context.Context, rule engagementdomain.AlertRule) error
	ListAlertRules(ctx context.Context, userID string) ([]engagementdomain.AlertRule, error)
	ListAlertRulesForEvaluation(ctx context.Context) ([]engagementdomain.AlertRule, error)
	DeleteAlertRule(ctx context.Context, userID, ruleID string) error
	CreateNotification(ctx context.Context, notification engagementdomain.Notification) error
	UpdateNotificationDeliveryStatus(ctx context.Context, notificationID, status string) error
	ListNotifications(ctx context.Context, userID string, unreadOnly bool, limit int) ([]engagementdomain.Notification, error)
	SetNotificationReadState(ctx context.Context, userID, notificationID string, readAt *time.Time) error
}

// Publisher emits live transport events.
type Publisher interface {
	Publish(eventType string, data any)
}

// Service owns bookmarks, alert rules, and notifications.
type Service struct {
	logger   *slog.Logger
	store    Store
	notifier Notifier
	events   Publisher
}

// NewService builds a new engagement service.
func NewService(logger *slog.Logger, store Store, notifier Notifier, events Publisher) *Service {
	return &Service{logger: logger, store: store, notifier: notifier, events: events}
}

// CreateBookmark saves one property for the user.
func (s *Service) CreateBookmark(ctx context.Context, userID, propertyID string) error {
	if strings.TrimSpace(propertyID) == "" {
		return fmt.Errorf("property id is required")
	}

	return s.store.AddBookmark(ctx, userID, strings.TrimSpace(propertyID), time.Now().UTC())
}

// ListBookmarks returns the user's saved properties.
func (s *Service) ListBookmarks(ctx context.Context, userID string) ([]engagementdomain.BookmarkedProperty, error) {
	return s.store.ListBookmarks(ctx, userID)
}

// DeleteBookmark removes one saved property.
func (s *Service) DeleteBookmark(ctx context.Context, userID, propertyID string) error {
	return s.store.RemoveBookmark(ctx, userID, propertyID)
}

// CreateAlertRule persists a new alert rule.
func (s *Service) CreateAlertRule(ctx context.Context, input engagementdomain.AlertRule) (engagementdomain.AlertRule, error) {
	input.RuleType = strings.TrimSpace(input.RuleType)
	input.PropertyID = strings.TrimSpace(input.PropertyID)

	if input.RuleType == "" || input.PropertyID == "" {
		return engagementdomain.AlertRule{}, ErrInvalidAlertRule
	}
	if !engagementdomain.IsSupportedRuleType(input.RuleType) {
		return engagementdomain.AlertRule{}, ErrInvalidAlertRule
	}
	if input.RuleType == engagementdomain.RuleTypePriceBelow && input.ThresholdAmount == nil {
		return engagementdomain.AlertRule{}, ErrInvalidAlertRule
	}
	if input.RuleType == engagementdomain.RuleTypePriceAbove && input.ThresholdAmount == nil {
		return engagementdomain.AlertRule{}, ErrInvalidAlertRule
	}

	now := time.Now().UTC()
	input.ID = id.New("rule")
	input.Enabled = true
	input.CreatedAt = now
	input.UpdatedAt = now

	if err := s.store.CreateAlertRule(ctx, input); err != nil {
		return engagementdomain.AlertRule{}, err
	}

	return input, nil
}

// ListAlertRules returns rules for one user.
func (s *Service) ListAlertRules(ctx context.Context, userID string) ([]engagementdomain.AlertRule, error) {
	return s.store.ListAlertRules(ctx, userID)
}

// DeleteAlertRule removes one alert rule.
func (s *Service) DeleteAlertRule(ctx context.Context, userID, ruleID string) error {
	return s.store.DeleteAlertRule(ctx, userID, ruleID)
}

// ListNotifications returns notifications for the user.
func (s *Service) ListNotifications(ctx context.Context, userID string, unreadOnly bool, limit int) ([]engagementdomain.Notification, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	return s.store.ListNotifications(ctx, userID, unreadOnly, limit)
}

// MarkNotificationRead records a read timestamp.
func (s *Service) MarkNotificationRead(ctx context.Context, userID, notificationID string) error {
	now := time.Now().UTC()
	return s.store.SetNotificationReadState(ctx, userID, notificationID, &now)
}

// MarkNotificationUnread clears the read timestamp.
func (s *Service) MarkNotificationUnread(ctx context.Context, userID, notificationID string) error {
	return s.store.SetNotificationReadState(ctx, userID, notificationID, nil)
}

// ProcessPropertyRun evaluates alert rules against a new property snapshot.
func (s *Service) ProcessPropertyRun(ctx context.Context, propertyID string, current, previous ingestiondomain.PropertySnapshot) (int, error) {
	if strings.TrimSpace(propertyID) == "" || !current.IsValid {
		return 0, nil
	}

	rules, err := s.store.ListAlertRulesForEvaluation(ctx)
	if err != nil {
		return 0, err
	}

	currentValues := decodeSnapshotValues(current.Values)
	previousValues := decodeSnapshotValues(previous.Values)
	currentPrice, hasCurrentPrice := extractPriceAmount(currentValues)
	previousPrice, hasPreviousPrice := extractPriceAmount(previousValues)

	created := 0
	for _, rule := range rules {
		if rule.PropertyID != propertyID || !rule.Enabled {
			continue
		}
		if !ruleMatchesSnapshot(rule, currentValues, previousValues, currentPrice, hasCurrentPrice, previousPrice, hasPreviousPrice) {
			continue
		}

		notification, err := buildNotification(rule, currentValues, currentPrice, hasCurrentPrice, previousPrice, hasPreviousPrice)
		if err != nil {
			return created, err
		}

		if err := s.store.CreateNotification(ctx, notification); err != nil {
			return created, err
		}

		status := "delivered"
		if s.notifier != nil {
			if err := s.notifier.Deliver(ctx, notification); err != nil {
				status = "failed"
				if s.logger != nil {
					s.logger.Error("notification delivery failed", "notification_id", notification.ID, "error", err.Error())
				}
			}
		}
		if err := s.store.UpdateNotificationDeliveryStatus(ctx, notification.ID, status); err != nil {
			return created, err
		}
		if s.events != nil {
			s.events.Publish("notification.created", map[string]any{
				"notification_id": notification.ID,
				"user_id":         notification.UserID,
				"property_id":     notification.PropertyID,
				"kind":            notification.Kind,
			})
		}
		created++
	}

	return created, nil
}

func ruleMatchesSnapshot(rule engagementdomain.AlertRule, currentValues, previousValues map[string]string, currentPrice int64, hasCurrentPrice bool, previousPrice int64, hasPreviousPrice bool) bool {
	switch rule.RuleType {
	case engagementdomain.RuleTypePriceDrop:
		return hasCurrentPrice && hasPreviousPrice && currentPrice < previousPrice
	case engagementdomain.RuleTypePriceBelow:
		if !hasCurrentPrice || rule.ThresholdAmount == nil || currentPrice > *rule.ThresholdAmount {
			return false
		}
		return !hasPreviousPrice || previousPrice > *rule.ThresholdAmount
	case engagementdomain.RuleTypePriceAbove:
		if !hasCurrentPrice || rule.ThresholdAmount == nil || currentPrice < *rule.ThresholdAmount {
			return false
		}
		return !hasPreviousPrice || previousPrice < *rule.ThresholdAmount
	case engagementdomain.RuleTypeAnyChange:
		return hasFieldChanges(currentValues, previousValues)
	case engagementdomain.RuleTypeSignificantPriceChange:
		if !hasCurrentPrice || !hasPreviousPrice || previousPrice == 0 {
			return false
		}
		pctChange := math.Abs(float64(currentPrice-previousPrice) / float64(previousPrice) * 100.0)
		return pctChange >= significantPriceChangeThresholdPct
	case engagementdomain.RuleTypeStatusChange:
		return strings.TrimSpace(previousValues["status"]) != "" &&
			strings.TrimSpace(currentValues["status"]) != strings.TrimSpace(previousValues["status"])
	default:
		return false
	}
}

func hasFieldChanges(current, previous map[string]string) bool {
	if len(previous) == 0 {
		return false
	}
	for key, value := range current {
		if previous[key] != value {
			return true
		}
	}
	for key, value := range previous {
		if current[key] != value {
			return true
		}
	}
	return false
}

func buildNotification(rule engagementdomain.AlertRule, currentValues map[string]string, currentPrice int64, hasCurrentPrice bool, previousPrice int64, hasPreviousPrice bool) (engagementdomain.Notification, error) {
	titleValue := firstNonEmpty(currentValues["title"], currentValues["url"], rule.PropertyID)
	body := titleValue
	title := titleValue
	switch rule.RuleType {
	case engagementdomain.RuleTypePriceDrop:
		title = "Price dropped for " + titleValue
		if hasCurrentPrice && hasPreviousPrice {
			body = fmt.Sprintf("%s dropped from %d to %d.", titleValue, previousPrice, currentPrice)
		}
	case engagementdomain.RuleTypePriceBelow:
		title = "Price target reached for " + titleValue
		if hasCurrentPrice {
			body = fmt.Sprintf("%s is now listed at %d.", titleValue, currentPrice)
		}
	case engagementdomain.RuleTypePriceAbove:
		title = "Price ceiling exceeded for " + titleValue
		if hasCurrentPrice {
			body = fmt.Sprintf("%s is now listed at %d.", titleValue, currentPrice)
		}
	case engagementdomain.RuleTypeAnyChange:
		title = "Listing changed for " + titleValue
		body = fmt.Sprintf("%s has new field values.", titleValue)
	case engagementdomain.RuleTypeSignificantPriceChange:
		title = "Significant price change for " + titleValue
		if hasCurrentPrice && hasPreviousPrice && previousPrice != 0 {
			pct := math.Abs(float64(currentPrice-previousPrice) / float64(previousPrice) * 100.0)
			direction := "dropped"
			if currentPrice > previousPrice {
				direction = "increased"
			}
			body = fmt.Sprintf("%s price %s by %.1f%% (from %d to %d).", titleValue, direction, pct, previousPrice, currentPrice)
		}
	case engagementdomain.RuleTypeStatusChange:
		title = "Listing status changed for " + titleValue
		body = fmt.Sprintf("%s has a new availability status.", titleValue)
	default:
		return engagementdomain.Notification{}, fmt.Errorf("unsupported rule type %q", rule.RuleType)
	}

	data, err := json.Marshal(map[string]any{
		"property_id":      rule.PropertyID,
		"threshold_amount": rule.ThresholdAmount,
		"values":           currentValues,
		"previous_amount":  optionalInt64(hasPreviousPrice, previousPrice),
		"price_amount":     optionalInt64(hasCurrentPrice, currentPrice),
	})
	if err != nil {
		return engagementdomain.Notification{}, fmt.Errorf("marshal notification data: %w", err)
	}

	return engagementdomain.Notification{
		ID:             id.New("notif"),
		UserID:         rule.UserID,
		AlertID:        rule.ID,
		PropertyID:     rule.PropertyID,
		Kind:           rule.RuleType,
		Title:          title,
		Body:           body,
		Data:           data,
		DeliveryStatus: "pending",
		CreatedAt:      time.Now().UTC(),
	}, nil
}

func decodeSnapshotValues(values json.RawMessage) map[string]string {
	if len(values) == 0 {
		return map[string]string{}
	}

	decoded := make(map[string]string)
	if err := json.Unmarshal(values, &decoded); err != nil {
		return map[string]string{}
	}
	return decoded
}

func extractPriceAmount(values map[string]string) (int64, bool) {
	raw := strings.TrimSpace(values["price"])
	if raw == "" {
		return 0, false
	}

	var amountBuilder strings.Builder
	for _, char := range raw {
		if char >= '0' && char <= '9' {
			amountBuilder.WriteRune(char)
		}
	}
	if amountBuilder.Len() == 0 {
		return 0, false
	}
	amount, err := strconv.ParseInt(amountBuilder.String(), 10, 64)
	if err != nil {
		return 0, false
	}
	return amount, true
}

func optionalInt64(valid bool, value int64) *int64 {
	if !valid {
		return nil
	}
	return &value
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
