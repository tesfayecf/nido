package application

import (
	"encoding/json"
	"testing"
	"time"

	authdomain "home-searcher/server/internal/auth/domain"
	ingestiondomain "home-searcher/server/internal/ingestion/domain"
)

func TestResolveMentionsAcceptsWorkspaceUsers(t *testing.T) {
	t.Parallel()

	mentions, err := resolveMentions("Ping @operator@local and @viewer@local", []authdomain.User{
		{ID: "usr_operator", Email: "operator@local"},
		{ID: "usr_viewer", Email: "viewer@local"},
	})
	if err != nil {
		t.Fatalf("resolveMentions returned error: %v", err)
	}
	if len(mentions) != 2 {
		t.Fatalf("expected 2 mentions, got %d", len(mentions))
	}
	if mentions[0] != "usr_operator" || mentions[1] != "usr_viewer" {
		t.Fatalf("unexpected mentions: %#v", mentions)
	}
}

func TestResolveMentionsRejectsUnknownUsers(t *testing.T) {
	t.Parallel()

	if _, err := resolveMentions("Ping @missing@local", []authdomain.User{{ID: "usr_operator", Email: "operator@local"}}); err == nil {
		t.Fatal("expected error for unresolved mention")
	}
}

func TestComputePriceDeltasReturnsLargestMove(t *testing.T) {
	t.Parallel()

	snapshots := []ingestiondomain.PropertySnapshot{
		{ObservedAt: time.Date(2024, time.January, 1, 12, 0, 0, 0, time.UTC), Values: mustJSON(t, map[string]string{"price": "100000"})},
		{ObservedAt: time.Date(2024, time.January, 2, 12, 0, 0, 0, time.UTC), Values: mustJSON(t, map[string]string{"price": "120000"})},
		{ObservedAt: time.Date(2024, time.January, 3, 12, 0, 0, 0, time.UTC), Values: mustJSON(t, map[string]string{"price": "118000"})},
	}

	points, biggestMove := computePriceDeltas(snapshots, time.Date(2024, time.January, 1, 0, 0, 0, 0, time.UTC))
	if biggestMove != 20000 {
		t.Fatalf("expected biggest move 20000, got %f", biggestMove)
	}
	if len(points) != 2 {
		t.Fatalf("expected 2 trend points, got %d", len(points))
	}
}

func TestRoleGuards(t *testing.T) {
	t.Parallel()

	if canEditWorkspace(authdomain.User{Role: authdomain.RoleViewer}) {
		t.Fatal("viewer must not edit workspace")
	}
	if !canEditWorkspace(authdomain.User{Role: authdomain.RoleOperator}) {
		t.Fatal("operator should edit workspace")
	}
	if !canAdmin(authdomain.User{Role: authdomain.RoleAdmin}) {
		t.Fatal("admin should pass admin guard")
	}
}

func mustJSON(t *testing.T, payload map[string]string) json.RawMessage {
	t.Helper()

	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload: %v", err)
	}
	return encoded
}
