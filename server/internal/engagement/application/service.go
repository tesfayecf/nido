package application

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	engagementdomain "home-searcher/server/internal/engagement/domain"
	ingestiondomain "home-searcher/server/internal/ingestion/domain"
	"home-searcher/server/internal/platform/id"
)

var (
	// ErrInvalidWatchlist indicates that the supplied watchlist is invalid.
	ErrInvalidWatchlist = errors.New("invalid watchlist")
	// ErrInvalidAlertRule indicates that the supplied alert rule is invalid.
	ErrInvalidAlertRule = errors.New("invalid alert rule")
)

// Store defines the persistence contract required by the engagement service.
type Store interface {
	AddBookmark(ctx context.Context, userID, listingID string, createdAt time.Time) error
	ListBookmarks(ctx context.Context, userID string) ([]engagementdomain.BookmarkedListing, error)
	RemoveBookmark(ctx context.Context, userID, listingID string) error
	CreateWatchlist(ctx context.Context, watchlist engagementdomain.Watchlist) error
	ListWatchlists(ctx context.Context, userID string) ([]engagementdomain.Watchlist, error)
	ListWatchlistsForEvaluation(ctx context.Context) ([]engagementdomain.Watchlist, error)
	DeleteWatchlist(ctx context.Context, userID, watchlistID string) error
	CreateAlertRule(ctx context.Context, rule engagementdomain.AlertRule) error
	ListAlertRules(ctx context.Context, userID string) ([]engagementdomain.AlertRule, error)
	ListAlertRulesForEvaluation(ctx context.Context) ([]engagementdomain.AlertRule, error)
	DeleteAlertRule(ctx context.Context, userID, ruleID string) error
	CreateNotification(ctx context.Context, notification engagementdomain.Notification) error
	UpdateNotificationDeliveryStatus(ctx context.Context, notificationID, status string) error
	ListNotifications(ctx context.Context, userID string, unreadOnly bool, limit int) ([]engagementdomain.Notification, error)
	MarkNotificationRead(ctx context.Context, userID, notificationID string, readAt time.Time) error
}

// Publisher emits live transport events.
type Publisher interface {
	Publish(eventType string, data any)
}

// Service owns bookmarks, watchlists, alert rules, and notifications.
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

// CreateBookmark saves one listing for the user.
func (s *Service) CreateBookmark(ctx context.Context, userID, listingID string) error {
	if strings.TrimSpace(listingID) == "" {
		return fmt.Errorf("listing id is required")
	}

	return s.store.AddBookmark(ctx, userID, listingID, time.Now().UTC())
}

// ListBookmarks returns the user's saved listings.
func (s *Service) ListBookmarks(ctx context.Context, userID string) ([]engagementdomain.BookmarkedListing, error) {
	return s.store.ListBookmarks(ctx, userID)
}

// DeleteBookmark removes one saved listing.
func (s *Service) DeleteBookmark(ctx context.Context, userID, listingID string) error {
	return s.store.RemoveBookmark(ctx, userID, listingID)
}

// CreateWatchlist persists a new watchlist.
func (s *Service) CreateWatchlist(ctx context.Context, input engagementdomain.Watchlist) (engagementdomain.Watchlist, error) {
	if strings.TrimSpace(input.Name) == "" {
		return engagementdomain.Watchlist{}, ErrInvalidWatchlist
	}

	now := time.Now().UTC()
	input.ID = id.New("watch")
	input.CreatedAt = now
	input.UpdatedAt = now

	if err := s.store.CreateWatchlist(ctx, input); err != nil {
		return engagementdomain.Watchlist{}, err
	}

	return input, nil
}

// ListWatchlists returns watchlists for one user.
func (s *Service) ListWatchlists(ctx context.Context, userID string) ([]engagementdomain.Watchlist, error) {
	return s.store.ListWatchlists(ctx, userID)
}

// DeleteWatchlist removes one watchlist.
func (s *Service) DeleteWatchlist(ctx context.Context, userID, watchlistID string) error {
	return s.store.DeleteWatchlist(ctx, userID, watchlistID)
}

// CreateAlertRule persists a new alert rule.
func (s *Service) CreateAlertRule(ctx context.Context, input engagementdomain.AlertRule) (engagementdomain.AlertRule, error) {
	input.RuleType = strings.TrimSpace(input.RuleType)
	input.WatchlistID = strings.TrimSpace(input.WatchlistID)
	input.ListingID = strings.TrimSpace(input.ListingID)

	if input.RuleType == "" {
		return engagementdomain.AlertRule{}, ErrInvalidAlertRule
	}
	if !engagementdomain.IsSupportedRuleType(input.RuleType) {
		return engagementdomain.AlertRule{}, ErrInvalidAlertRule
	}
	if input.RuleType == engagementdomain.RuleTypePriceBelow && input.ThresholdAmount == nil {
		return engagementdomain.AlertRule{}, ErrInvalidAlertRule
	}
	if input.RuleType == engagementdomain.RuleTypeNewListing && input.WatchlistID == "" {
		return engagementdomain.AlertRule{}, ErrInvalidAlertRule
	}
	if input.WatchlistID == "" && input.ListingID == "" {
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
	return s.store.MarkNotificationRead(ctx, userID, notificationID, time.Now().UTC())
}

// ProcessIngestionChanges evaluates alert rules against detected listing changes.
func (s *Service) ProcessIngestionChanges(ctx context.Context, changes []ingestiondomain.ListingChange) (int, error) {
	if len(changes) == 0 {
		return 0, nil
	}

	watchlists, err := s.store.ListWatchlistsForEvaluation(ctx)
	if err != nil {
		return 0, err
	}
	rules, err := s.store.ListAlertRulesForEvaluation(ctx)
	if err != nil {
		return 0, err
	}

	watchlistsByID := make(map[string]engagementdomain.Watchlist, len(watchlists))
	for _, watchlist := range watchlists {
		watchlistsByID[watchlist.ID] = watchlist
	}

	created := 0
	seen := make(map[string]struct{})
	for _, change := range changes {
		for _, rule := range rules {
			watchlist, hasWatchlist := watchlistsByID[rule.WatchlistID]
			if !ruleMatchesChange(rule, watchlist, hasWatchlist, change) {
				continue
			}

			fingerprint := rule.ID + ":" + change.ListingID + ":" + change.URL + ":" + fmt.Sprint(change.PriceAmount)
			if _, ok := seen[fingerprint]; ok {
				continue
			}
			seen[fingerprint] = struct{}{}

			notification, err := buildNotification(rule, watchlist, change)
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
					s.logger.Error("notification delivery failed", "notification_id", notification.ID, "error", err.Error())
				}
			}
			if err := s.store.UpdateNotificationDeliveryStatus(ctx, notification.ID, status); err != nil {
				return created, err
			}

			if s.events != nil {
				s.events.Publish("notification.created", map[string]any{
					"notification_id": notification.ID,
					"user_id":         notification.UserID,
					"listing_id":      notification.ListingID,
					"kind":            notification.Kind,
				})
			}

			created++
		}
	}

	return created, nil
}

func buildNotification(rule engagementdomain.AlertRule, watchlist engagementdomain.Watchlist, change ingestiondomain.ListingChange) (engagementdomain.Notification, error) {
	data, err := json.Marshal(map[string]any{
		"listing_id":       change.ListingID,
		"source_id":        change.SourceID,
		"title":            change.Title,
		"price_amount":     change.PriceAmount,
		"currency":         change.Currency,
		"location":         change.Location,
		"url":              change.URL,
		"previous_amount":  change.PreviousAmount,
		"watchlist_id":     rule.WatchlistID,
		"watchlist_name":   watchlist.Name,
		"threshold_amount": rule.ThresholdAmount,
	})
	if err != nil {
		return engagementdomain.Notification{}, fmt.Errorf("marshal notification data: %w", err)
	}

	title := change.Title
	body := change.Title
	switch rule.RuleType {
	case engagementdomain.RuleTypeNewListing:
		title = "New listing matched " + watchlist.Name
		body = fmt.Sprintf("%s matches your watchlist %q.", change.Title, watchlist.Name)
	case engagementdomain.RuleTypePriceDrop:
		title = "Price dropped for " + change.Title
		if change.PreviousAmount != nil {
			body = fmt.Sprintf("%s dropped from %d to %d %s.", change.Title, *change.PreviousAmount, change.PriceAmount, change.Currency)
		} else {
			body = fmt.Sprintf("%s changed price to %d %s.", change.Title, change.PriceAmount, change.Currency)
		}
	case engagementdomain.RuleTypePriceBelow:
		title = "Price target reached for " + change.Title
		body = fmt.Sprintf("%s is now listed at %d %s.", change.Title, change.PriceAmount, change.Currency)
	default:
		return engagementdomain.Notification{}, fmt.Errorf("unsupported rule type %q", rule.RuleType)
	}

	return engagementdomain.Notification{
		ID:             id.New("notif"),
		UserID:         rule.UserID,
		RuleID:         rule.ID,
		ListingID:      change.ListingID,
		Kind:           rule.RuleType,
		Title:          title,
		Body:           body,
		Data:           data,
		DeliveryStatus: "pending",
		CreatedAt:      time.Now().UTC(),
	}, nil
}

func ruleMatchesChange(rule engagementdomain.AlertRule, watchlist engagementdomain.Watchlist, hasWatchlist bool, change ingestiondomain.ListingChange) bool {
	if strings.TrimSpace(rule.ListingID) != "" && rule.ListingID != change.ListingID {
		return false
	}
	if strings.TrimSpace(rule.WatchlistID) != "" {
		if !hasWatchlist || !matchesWatchlist(watchlist, change) {
			return false
		}
	}

	switch rule.RuleType {
	case engagementdomain.RuleTypeNewListing:
		return change.IsNew
	case engagementdomain.RuleTypePriceDrop:
		return change.PriceChanged && change.PreviousAmount != nil && change.PriceAmount < *change.PreviousAmount
	case engagementdomain.RuleTypePriceBelow:
		return rule.ThresholdAmount != nil && (change.IsNew || change.PriceChanged) && change.PriceAmount <= *rule.ThresholdAmount
	default:
		return false
	}
}

func matchesWatchlist(watchlist engagementdomain.Watchlist, change ingestiondomain.ListingChange) bool {
	if strings.TrimSpace(watchlist.SourceID) != "" && watchlist.SourceID != change.SourceID {
		return false
	}
	if watchlist.MaxPriceAmount != nil && change.PriceAmount > *watchlist.MaxPriceAmount {
		return false
	}
	query := strings.TrimSpace(strings.ToLower(watchlist.Query))
	if query == "" {
		return true
	}

	haystack := strings.ToLower(change.Title + " " + change.Location)
	return strings.Contains(haystack, query)
}
