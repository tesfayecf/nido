package application

import (
	"encoding/json"
	"math"
	"testing"
	"time"

	ingestiondomain "nido/server/internal/ingestion/domain"
)

// ── helpers ──────────────────────────────────────────────────────────────────

func makeSnapshot(values map[string]string, valid bool, observedAt time.Time) ingestiondomain.PropertySnapshot {
	raw, _ := json.Marshal(values)
	return ingestiondomain.PropertySnapshot{
		ID:         "snap-test",
		IsValid:    valid,
		ObservedAt: observedAt,
		Values:     json.RawMessage(raw),
	}
}

func findSignal(signals []ingestiondomain.ChangeSignal, field string) (ingestiondomain.ChangeSignal, bool) {
	for _, s := range signals {
		if s.Field == field {
			return s, true
		}
	}
	return ingestiondomain.ChangeSignal{}, false
}

var baseProperty = ingestiondomain.Property{
	ID: "prop-test",
	Metadata: ingestiondomain.PropertyMetadata{
		TargetPrice:      250000,
		ExpectedYieldBps: 450,
		BusinessStage:    "due_diligence",
		PriorityLevel:    "high",
		DealThesis:       "Good location, near transit.",
	},
}

// ── ComputeChangeSignals ──────────────────────────────────────────────────────

func TestComputeChangeSignals_PriceDecrease(t *testing.T) {
	now := time.Now().UTC()
	current := makeSnapshot(map[string]string{"price": "240000", "status": "active"}, true, now)
	previous := makeSnapshot(map[string]string{"price": "260000", "status": "active"}, true, now.Add(-time.Hour))

	signals := ComputeChangeSignals(current, previous, baseProperty)

	sig, ok := findSignal(signals, "price")
	if !ok {
		t.Fatal("expected a price signal")
	}
	if sig.Impact != ingestiondomain.ChangeImpactPositive {
		t.Errorf("expected positive impact for price decrease, got %q", sig.Impact)
	}
	if sig.AbsoluteDelta == nil || *sig.AbsoluteDelta != -20000 {
		t.Errorf("unexpected absolute delta: %v", sig.AbsoluteDelta)
	}
	if sig.PercentDelta == nil {
		t.Fatal("expected percent delta")
	}
	expectedPct := math.Round((-20000.0/260000.0*100.0)*10) / 10
	if *sig.PercentDelta != expectedPct {
		t.Errorf("expected pct delta %f, got %f", expectedPct, *sig.PercentDelta)
	}
}

func TestComputeChangeSignals_PriceIncrease(t *testing.T) {
	now := time.Now().UTC()
	current := makeSnapshot(map[string]string{"price": "280000"}, true, now)
	previous := makeSnapshot(map[string]string{"price": "260000"}, true, now.Add(-time.Hour))

	signals := ComputeChangeSignals(current, previous, baseProperty)

	sig, ok := findSignal(signals, "price")
	if !ok {
		t.Fatal("expected a price signal")
	}
	if sig.Impact != ingestiondomain.ChangeImpactNegative {
		t.Errorf("expected negative impact for price increase, got %q", sig.Impact)
	}
}

func TestComputeChangeSignals_NoPriceSignalWhenUnchanged(t *testing.T) {
	now := time.Now().UTC()
	current := makeSnapshot(map[string]string{"price": "260000"}, true, now)
	previous := makeSnapshot(map[string]string{"price": "260000"}, true, now.Add(-time.Hour))

	signals := ComputeChangeSignals(current, previous, baseProperty)

	if _, ok := findSignal(signals, "price"); ok {
		t.Error("expected no price signal when price is unchanged")
	}
}

func TestComputeChangeSignals_StatusChange(t *testing.T) {
	now := time.Now().UTC()
	current := makeSnapshot(map[string]string{"status": "sold"}, true, now)
	previous := makeSnapshot(map[string]string{"status": "active"}, true, now.Add(-time.Hour))

	signals := ComputeChangeSignals(current, previous, baseProperty)

	sig, ok := findSignal(signals, "status")
	if !ok {
		t.Fatal("expected a status signal")
	}
	if sig.Impact != ingestiondomain.ChangeImpactNegative {
		t.Errorf("expected negative impact for 'sold' status, got %q", sig.Impact)
	}
	if sig.Previous != "active" || sig.Current != "sold" {
		t.Errorf("unexpected status transition: %q → %q", sig.Previous, sig.Current)
	}
}

func TestComputeChangeSignals_NeutralStatusChange(t *testing.T) {
	now := time.Now().UTC()
	current := makeSnapshot(map[string]string{"status": "price reduced"}, true, now)
	previous := makeSnapshot(map[string]string{"status": "active"}, true, now.Add(-time.Hour))

	signals := ComputeChangeSignals(current, previous, baseProperty)

	sig, ok := findSignal(signals, "status")
	if !ok {
		t.Fatal("expected a status signal")
	}
	if sig.Impact != ingestiondomain.ChangeImpactNeutral {
		t.Errorf("expected neutral impact, got %q", sig.Impact)
	}
}

func TestComputeChangeSignals_MissingCriticalFields(t *testing.T) {
	now := time.Now().UTC()
	// Valid snapshot with only a title — price/location/size missing
	current := makeSnapshot(map[string]string{"title": "Nice flat"}, true, now)
	var previous ingestiondomain.PropertySnapshot // zero value

	signals := ComputeChangeSignals(current, previous, baseProperty)

	missingCount := 0
	for _, s := range signals {
		if s.Group == ingestiondomain.ChangeGroupDataQuality {
			missingCount++
		}
	}
	// price, location, size/area/sqm — at minimum price and location should be flagged
	if missingCount == 0 {
		t.Error("expected data quality signals for missing critical fields")
	}
}

func TestComputeChangeSignals_StaleData(t *testing.T) {
	staleTime := time.Now().UTC().Add(-50 * time.Hour) // > 48h threshold
	current := makeSnapshot(map[string]string{"price": "250000"}, true, staleTime)
	var previous ingestiondomain.PropertySnapshot

	signals := ComputeChangeSignals(current, previous, baseProperty)

	if _, ok := findSignal(signals, "freshness"); !ok {
		t.Error("expected freshness signal for stale data")
	}
}

func TestComputeChangeSignals_FreshData_NoFreshnessSignal(t *testing.T) {
	now := time.Now().UTC()
	current := makeSnapshot(map[string]string{"price": "250000", "title": "t", "location": "l", "size": "100"}, true, now)
	previous := makeSnapshot(map[string]string{"price": "250000"}, true, now.Add(-time.Hour))

	signals := ComputeChangeSignals(current, previous, baseProperty)

	if sig, ok := findSignal(signals, "freshness"); ok {
		t.Errorf("unexpected freshness signal: %+v", sig)
	}
}

func TestComputeChangeSignals_NoData_NoCollectedYetSignal(t *testing.T) {
	propWithNoRun := ingestiondomain.Property{ID: "prop-norun"}
	var current, previous ingestiondomain.PropertySnapshot

	signals := ComputeChangeSignals(current, previous, propWithNoRun)

	if _, ok := findSignal(signals, "freshness"); !ok {
		t.Error("expected freshness signal when no data collected yet")
	}
}

func TestComputeChangeSignals_TrackingDegraded(t *testing.T) {
	now := time.Now().UTC()
	current := makeSnapshot(map[string]string{}, false, now)
	current.ID = "snap-current"
	previous := makeSnapshot(map[string]string{}, true, now.Add(-time.Hour))
	previous.ID = "snap-prev"

	prop := ingestiondomain.Property{ID: "prop-test", Status: ingestiondomain.PropertyStatusActive}

	signals := ComputeChangeSignals(current, previous, prop)

	if _, ok := findSignal(signals, "tracking_status"); !ok {
		t.Error("expected tracking_status signal when validity degrades")
	}
}

func TestComputeChangeSignals_CurrencyStrippedPrice(t *testing.T) {
	now := time.Now().UTC()
	current := makeSnapshot(map[string]string{"price": "€ 250,000"}, true, now)
	previous := makeSnapshot(map[string]string{"price": "€ 260,000"}, true, now.Add(-time.Hour))

	signals := ComputeChangeSignals(current, previous, baseProperty)

	sig, ok := findSignal(signals, "price")
	if !ok {
		t.Fatal("expected price signal")
	}
	if *sig.AbsoluteDelta != -10000 {
		t.Errorf("expected -10000 delta, got %d", *sig.AbsoluteDelta)
	}
}

func TestComputeChangeSignals_PrefillChangesAreListingFactUpdates(t *testing.T) {
	now := time.Now().UTC()
	current := makeSnapshot(map[string]string{"location": "Bilbao", "price": "250000"}, true, now)
	previous := makeSnapshot(map[string]string{"location": "Madrid", "price": "250000"}, true, now.Add(-time.Hour))
	previous.ID = "snap-prev"

	signals := ComputeChangeSignals(current, previous, baseProperty, []ingestiondomain.FieldSelector{
		{Name: "location", FieldRole: ingestiondomain.FieldRolePrefill},
	})

	sig, ok := findSignal(signals, "location")
	if !ok {
		t.Fatal("expected location change signal")
	}
	if sig.Group != ingestiondomain.ChangeGroupListingFacts {
		t.Fatalf("expected listing facts group, got %q", sig.Group)
	}
	if sig.Label != "Listing facts changed" {
		t.Fatalf("expected informational label, got %q", sig.Label)
	}
}

func TestComputeChangeSignals_TrackedChangesStayPrimary(t *testing.T) {
	now := time.Now().UTC()
	current := makeSnapshot(map[string]string{"availability": "reserved", "price": "250000"}, true, now)
	previous := makeSnapshot(map[string]string{"availability": "available", "price": "250000"}, true, now.Add(-time.Hour))
	previous.ID = "snap-prev"

	signals := ComputeChangeSignals(current, previous, baseProperty, []ingestiondomain.FieldSelector{
		{Name: "availability", FieldRole: ingestiondomain.FieldRoleTracked},
	})

	sig, ok := findSignal(signals, "availability")
	if !ok {
		t.Fatal("expected availability change signal")
	}
	if sig.Group == ingestiondomain.ChangeGroupListingFacts {
		t.Fatalf("expected tracked field to remain primary, got %q", sig.Group)
	}
}

// ── DeriveDecisionContext ─────────────────────────────────────────────────────

func TestDeriveDecisionContext_PriceGap(t *testing.T) {
	now := time.Now().UTC()
	snap := makeSnapshot(map[string]string{"price": "300000"}, true, now)

	ctx := DeriveDecisionContext(baseProperty, snap)

	if ctx.CurrentPrice == nil || *ctx.CurrentPrice != 300000 {
		t.Fatalf("expected current price 300000, got %v", ctx.CurrentPrice)
	}
	if ctx.TargetPrice == nil || *ctx.TargetPrice != 250000 {
		t.Fatalf("expected target price 250000, got %v", ctx.TargetPrice)
	}
	if ctx.PriceGapAbsolute == nil || *ctx.PriceGapAbsolute != 50000 {
		t.Errorf("expected gap 50000, got %v", ctx.PriceGapAbsolute)
	}
	if ctx.PriceGapPercent == nil {
		t.Fatal("expected gap percent")
	}
	expected := math.Round((50000.0/250000.0*100.0)*10) / 10
	if *ctx.PriceGapPercent != expected {
		t.Errorf("expected gap pct %f, got %f", expected, *ctx.PriceGapPercent)
	}
}

func TestDeriveDecisionContext_NilSafe_NoSnapshot(t *testing.T) {
	var snap ingestiondomain.PropertySnapshot
	ctx := DeriveDecisionContext(baseProperty, snap)

	if ctx.CurrentPrice != nil {
		t.Error("expected nil current price when no snapshot")
	}
	if ctx.PriceGapAbsolute != nil || ctx.PriceGapPercent != nil {
		t.Error("expected nil gap fields when no snapshot")
	}
	if ctx.FreshnessStatus != "unknown" {
		t.Errorf("expected 'unknown' freshness, got %q", ctx.FreshnessStatus)
	}
}

func TestDeriveDecisionContext_FreshnessStale(t *testing.T) {
	stale := time.Now().UTC().Add(-72 * time.Hour)
	snap := makeSnapshot(map[string]string{}, true, stale)

	ctx := DeriveDecisionContext(baseProperty, snap)

	if ctx.FreshnessStatus != "stale" {
		t.Errorf("expected 'stale', got %q", ctx.FreshnessStatus)
	}
}

func TestDeriveDecisionContext_FreshnessFresh(t *testing.T) {
	now := time.Now().UTC()
	snap := makeSnapshot(map[string]string{}, true, now)

	ctx := DeriveDecisionContext(baseProperty, snap)

	if ctx.FreshnessStatus != "fresh" {
		t.Errorf("expected 'fresh', got %q", ctx.FreshnessStatus)
	}
}

func TestDeriveDecisionContext_DealThesisTruncated(t *testing.T) {
	longThesis := make([]rune, 200)
	for i := range longThesis {
		longThesis[i] = 'a'
	}
	prop := ingestiondomain.Property{Metadata: ingestiondomain.PropertyMetadata{DealThesis: string(longThesis)}}
	ctx := DeriveDecisionContext(prop, ingestiondomain.PropertySnapshot{})

	// Should be truncated to dealThesisMaxRunes runes + "…"
	runes := []rune(ctx.DealThesisSummary)
	if len(runes) != dealThesisMaxRunes+1 { // +1 for "…"
		t.Errorf("expected %d runes, got %d", dealThesisMaxRunes+1, len(runes))
	}
}

func TestDeriveDecisionContext_PricePerSqm(t *testing.T) {
	now := time.Now().UTC()
	snap := makeSnapshot(map[string]string{"price": "200000", "size": "100"}, true, now)

	ctx := DeriveDecisionContext(baseProperty, snap)

	if ctx.CurrentPricePerSqm == nil || *ctx.CurrentPricePerSqm != 2000 {
		t.Errorf("expected €/m² 2000, got %v", ctx.CurrentPricePerSqm)
	}
}

// ── BuildLatestChangeSummary ──────────────────────────────────────────────────

func TestBuildLatestChangeSummary_SignificantPriceDecrease(t *testing.T) {
	pct := -5.0
	delta := int64(-10000)
	signals := []ingestiondomain.ChangeSignal{
		{
			Field:         "price",
			Previous:      "200000",
			Current:       "190000",
			AbsoluteDelta: &delta,
			PercentDelta:  &pct,
			Impact:        ingestiondomain.ChangeImpactPositive,
			Group:         ingestiondomain.ChangeGroupPricing,
		},
	}
	summary := BuildLatestChangeSummary(signals)
	if summary == "" {
		t.Error("expected non-empty summary for significant price change")
	}
	t.Log(summary)
}

func TestBuildLatestChangeSummary_SmallPriceChange_NoSummary(t *testing.T) {
	pct := -1.0 // below 2% threshold
	delta := int64(-1000)
	signals := []ingestiondomain.ChangeSignal{
		{
			Field:         "price",
			Previous:      "100000",
			Current:       "99000",
			AbsoluteDelta: &delta,
			PercentDelta:  &pct,
			Group:         ingestiondomain.ChangeGroupPricing,
		},
	}
	summary := BuildLatestChangeSummary(signals)
	if summary != "" {
		t.Errorf("expected empty summary for sub-threshold change, got %q", summary)
	}
}

func TestBuildLatestChangeSummary_StatusChange(t *testing.T) {
	signals := []ingestiondomain.ChangeSignal{
		{Field: "status", Previous: "active", Current: "sold", Group: ingestiondomain.ChangeGroupStatus},
	}
	summary := BuildLatestChangeSummary(signals)
	if summary == "" {
		t.Error("expected non-empty summary for status change")
	}
}

func TestBuildLatestChangeSummary_Empty(t *testing.T) {
	summary := BuildLatestChangeSummary(nil)
	if summary != "" {
		t.Errorf("expected empty summary, got %q", summary)
	}
}
