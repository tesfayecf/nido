package application

import (
	"encoding/json"
	"testing"
	"time"

	ingestiondomain "home-searcher/server/internal/ingestion/domain"
)

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

func TestValidWorkflowState(t *testing.T) {
	t.Parallel()

	if !validWorkflowState(ingestiondomain.WorkflowStateInvestigating) {
		t.Fatal("expected investigating workflow state to be valid")
	}
	if validWorkflowState("assigned") {
		t.Fatal("expected multi-user workflow state to be invalid")
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
