package application

import (
	"context"
	"errors"
	"testing"
	"time"

	engagementdomain "home-searcher/server/internal/engagement/domain"
)

type engagementStoreStub struct {
	createAlertRuleFn func(ctx context.Context, rule engagementdomain.AlertRule) error
}

func (s engagementStoreStub) AddBookmark(context.Context, string, string, time.Time) error {
	return nil
}

func (s engagementStoreStub) ListBookmarks(context.Context, string) ([]engagementdomain.BookmarkedProperty, error) {
	return nil, nil
}

func (s engagementStoreStub) RemoveBookmark(context.Context, string, string) error {
	return nil
}

func (s engagementStoreStub) CreateAlertRule(ctx context.Context, rule engagementdomain.AlertRule) error {
	if s.createAlertRuleFn != nil {
		return s.createAlertRuleFn(ctx, rule)
	}

	return nil
}

func (s engagementStoreStub) ListAlertRules(context.Context, string) ([]engagementdomain.AlertRule, error) {
	return nil, nil
}

func (s engagementStoreStub) ListAlertRulesForEvaluation(context.Context) ([]engagementdomain.AlertRule, error) {
	return nil, nil
}

func (s engagementStoreStub) DeleteAlertRule(context.Context, string, string) error {
	return nil
}

func (s engagementStoreStub) CreateNotification(context.Context, engagementdomain.Notification) error {
	return nil
}

func (s engagementStoreStub) UpdateNotificationDeliveryStatus(context.Context, string, string) error {
	return nil
}

func (s engagementStoreStub) ListNotifications(context.Context, string, bool, int) ([]engagementdomain.Notification, error) {
	return nil, nil
}

func (s engagementStoreStub) SetNotificationReadState(context.Context, string, string, *time.Time) error {
	return nil
}

func TestCreateAlertRuleRejectsInvalidInputs(t *testing.T) {
	t.Parallel()

	service := NewService(nil, engagementStoreStub{}, nil, nil)

	tests := []struct {
		name  string
		input engagementdomain.AlertRule
	}{
		{
			name:  "unsupported rule type",
			input: engagementdomain.AlertRule{RuleType: "price_spike", PropertyID: "property-1", UserID: "user-1"},
		},
		{
			name:  "price below without threshold",
			input: engagementdomain.AlertRule{RuleType: engagementdomain.RuleTypePriceBelow, PropertyID: "property-1", UserID: "user-1"},
		},
		{
			name:  "no property id",
			input: engagementdomain.AlertRule{RuleType: engagementdomain.RuleTypePriceDrop, UserID: "user-1"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := service.CreateAlertRule(context.Background(), test.input)
			if !errors.Is(err, ErrInvalidAlertRule) {
				t.Fatalf("expected invalid alert rule error, got %v", err)
			}
		})
	}
}

func TestCreateAlertRulePersistsSupportedRuleTypes(t *testing.T) {
	t.Parallel()

	var stored engagementdomain.AlertRule
	service := NewService(nil, engagementStoreStub{
		createAlertRuleFn: func(_ context.Context, rule engagementdomain.AlertRule) error {
			stored = rule
			return nil
		},
	}, nil, nil)

	threshold := int64(250000)
	rule, err := service.CreateAlertRule(context.Background(), engagementdomain.AlertRule{
		PropertyID:      " property-1 ",
		RuleType:        " price_below ",
		ThresholdAmount: &threshold,
		UserID:          "user-1",
	})
	if err != nil {
		t.Fatalf("create alert rule: %v", err)
	}

	if rule.ID == "" || stored.ID == "" {
		t.Fatal("expected rule ids to be generated")
	}
	if rule.RuleType != engagementdomain.RuleTypePriceBelow {
		t.Fatalf("expected normalized rule type, got %q", rule.RuleType)
	}
	if rule.PropertyID != "property-1" {
		t.Fatalf("expected trimmed property id, got %q", rule.PropertyID)
	}
	if !rule.Enabled {
		t.Fatal("expected new rules to be enabled")
	}
	if stored.RuleType != engagementdomain.RuleTypePriceBelow {
		t.Fatalf("expected persisted rule type %q, got %q", engagementdomain.RuleTypePriceBelow, stored.RuleType)
	}
	if stored.ThresholdAmount == nil || *stored.ThresholdAmount != threshold {
		t.Fatalf("expected threshold amount %d, got %+v", threshold, stored.ThresholdAmount)
	}
}

var _ Store = engagementStoreStub{}
