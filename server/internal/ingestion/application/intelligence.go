package application

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	ingestiondomain "nido/server/internal/ingestion/domain"
)

const (
	// agingThresholdHours is how old a snapshot must be before it is considered aging.
	agingThresholdHours = 24
	// staleThresholdHours is how old a snapshot must be before it is considered stale.
	staleThresholdHours = 48
	// dealThesisMaxRunes is the maximum runes (Unicode code points) shown in the deal thesis summary.
	dealThesisMaxRunes = 160
	// significantPriceChangePct is the minimum absolute percentage change to flag as significant.
	significantPriceChangePct = 2.0
)

var areaFieldNames = []string{"area_m2", "area"}

type requiredFieldGroup struct {
	fieldName  string
	candidates []string
}

// requiredFieldGroups are the direct fields analytics and intelligence depend on.
var requiredFieldGroups = []requiredFieldGroup{
	{fieldName: "price", candidates: []string{"price"}},
	{fieldName: "title", candidates: []string{"title"}},
	{fieldName: "location", candidates: []string{"location"}},
	{fieldName: "area", candidates: areaFieldNames},
}

// ComputeChangeSignals derives deterministic intelligence signals by comparing two snapshots.
// Both snapshots may be zero-value (no prior data) — all operations are null-safe.
func ComputeChangeSignals(
	current ingestiondomain.PropertySnapshot,
	previous ingestiondomain.PropertySnapshot,
	property ingestiondomain.Property,
	fields ...[]ingestiondomain.FieldSelector,
) []ingestiondomain.ChangeSignal {
	signals := make([]ingestiondomain.ChangeSignal, 0, 4)

	currentValues := decodeStringValues(current.Values)
	previousValues := decodeStringValues(previous.Values)
	fieldRoles := buildFieldRoleMap(fields...)

	observedAt := current.ObservedAt
	if observedAt.IsZero() {
		observedAt = time.Now().UTC()
	}

	// ── Price change ──────────────────────────────────────────────────────────
	currentPrice, hasCurrentPrice := extractFirstNumericField(currentValues, "price")
	previousPrice, hasPreviousPrice := extractFirstNumericField(previousValues, "price")

	if hasCurrentPrice && hasPreviousPrice && currentPrice != previousPrice {
		delta := currentPrice - previousPrice
		pct := float64(delta) / float64(previousPrice) * 100.0
		rounded := math.Round(pct*10) / 10

		impact := ingestiondomain.ChangeImpactNegative // price increase = bad
		if delta < 0 {
			impact = ingestiondomain.ChangeImpactPositive // price decrease = good
		}

		sig := ingestiondomain.ChangeSignal{
			Field:         "price",
			Label:         fmt.Sprintf("Price changed from %d to %d", previousPrice, currentPrice),
			Previous:      strconv.FormatInt(previousPrice, 10),
			Current:       strconv.FormatInt(currentPrice, 10),
			AbsoluteDelta: &delta,
			PercentDelta:  &rounded,
			ObservedAt:    observedAt,
			Impact:        impact,
			Group:         ingestiondomain.ChangeGroupPricing,
		}
		signals = append(signals, sig)
	}

	// ── €/m² change ───────────────────────────────────────────────────────────
	currentSqm, hasCurrentSqm := extractFirstNumericField(currentValues, areaFieldNames...)
	previousSqm, hasPreviousSqm := extractFirstNumericField(previousValues, areaFieldNames...)

	if hasCurrentPrice && hasCurrentSqm && currentSqm > 0 {
		currentPPM := currentPrice / currentSqm
		if hasPreviousPrice && hasPreviousSqm && previousSqm > 0 {
			previousPPM := previousPrice / previousSqm
			if currentPPM != previousPPM {
				delta := currentPPM - previousPPM
				impact := ingestiondomain.ChangeImpactNegative
				if delta < 0 {
					impact = ingestiondomain.ChangeImpactPositive
				}
				signals = append(signals, ingestiondomain.ChangeSignal{
					Field:         "price_per_sqm",
					Label:         fmt.Sprintf("€/m² changed from %d to %d", previousPPM, currentPPM),
					Previous:      strconv.FormatInt(previousPPM, 10),
					Current:       strconv.FormatInt(currentPPM, 10),
					AbsoluteDelta: &delta,
					ObservedAt:    observedAt,
					Impact:        impact,
					Group:         ingestiondomain.ChangeGroupPricing,
				})
			}
		}
	}

	// ── Status / availability change ─────────────────────────────────────────
	currentStatus := strings.TrimSpace(currentValues["status"])
	previousStatus := strings.TrimSpace(previousValues["status"])
	if previousStatus != "" && currentStatus != previousStatus {
		impact := ingestiondomain.ChangeImpactNeutral
		unavailableKeywords := []string{"sold", "unavailable", "removed", "withdrawn", "expired", "let agreed"}
		for _, kw := range unavailableKeywords {
			if strings.Contains(strings.ToLower(currentStatus), kw) {
				impact = ingestiondomain.ChangeImpactNegative
				break
			}
		}
		signals = append(signals, ingestiondomain.ChangeSignal{
			Field:      "status",
			Label:      fmt.Sprintf("Status changed from %q to %q", previousStatus, currentStatus),
			Previous:   previousStatus,
			Current:    currentStatus,
			ObservedAt: observedAt,
			Impact:     impact,
			Group:      ingestiondomain.ChangeGroupStatus,
		})
	}

	if previous.ID != "" {
		seen := make(map[string]struct{})
		for field, currentValue := range currentValues {
			field = strings.TrimSpace(field)
			if field == "" || field == "price" || field == "status" {
				continue
			}
			previousValue, hadPrevious := previousValues[field]
			if !hadPrevious || strings.TrimSpace(previousValue) == strings.TrimSpace(currentValue) {
				continue
			}
			if _, ok := seen[field]; ok {
				continue
			}
			seen[field] = struct{}{}

			role := roleForField(fieldRoles, field)
			group := ingestiondomain.ChangeGroupDataQuality
			label := fmt.Sprintf("%s changed from %q to %q", humanizeFieldName(field), previousValue, currentValue)
			if role == ingestiondomain.FieldRolePrefill {
				group = ingestiondomain.ChangeGroupListingFacts
				label = "Listing facts changed"
			}

			signals = append(signals, ingestiondomain.ChangeSignal{
				Field:      field,
				Label:      label,
				Previous:   previousValue,
				Current:    currentValue,
				ObservedAt: observedAt,
				Impact:     ingestiondomain.ChangeImpactNeutral,
				Group:      group,
			})
		}
	}

	// ── Property tracking status change ──────────────────────────────────────
	if previous.ID != "" && string(property.Status) != "" {
		if previous.IsValid && !current.IsValid {
			signals = append(signals, ingestiondomain.ChangeSignal{
				Field:      "tracking_status",
				Label:      "Property tracking degraded",
				Previous:   "active",
				Current:    "degraded",
				ObservedAt: observedAt,
				Impact:     ingestiondomain.ChangeImpactNegative,
				Group:      ingestiondomain.ChangeGroupStatus,
			})
		}
	}

	// ── Missing critical fields ───────────────────────────────────────────────
	if current.IsValid {
		for _, group := range requiredFieldGroups {
			if hasAnyFieldValue(currentValues, group.candidates...) {
				continue
			}
			signals = append(signals, ingestiondomain.ChangeSignal{
				Field:      group.fieldName,
				Label:      fmt.Sprintf("Critical field %q is missing", group.fieldName),
				Current:    "",
				ObservedAt: observedAt,
				Impact:     ingestiondomain.ChangeImpactNegative,
				Group:      ingestiondomain.ChangeGroupDataQuality,
			})
		}
	}

	// ── Data freshness ────────────────────────────────────────────────────────
	if !current.ObservedAt.IsZero() {
		age := time.Since(current.ObservedAt)
		if age > staleThresholdHours*time.Hour {
			signals = append(signals, ingestiondomain.ChangeSignal{
				Field:      "freshness",
				Label:      fmt.Sprintf("Data is stale (last seen %.0fh ago)", age.Hours()),
				Current:    current.ObservedAt.UTC().Format(time.RFC3339),
				ObservedAt: observedAt,
				Impact:     ingestiondomain.ChangeImpactNegative,
				Group:      ingestiondomain.ChangeGroupFreshness,
			})
		}
	} else if property.LastRunAt == nil {
		signals = append(signals, ingestiondomain.ChangeSignal{
			Field:      "freshness",
			Label:      "No data collected yet",
			ObservedAt: observedAt,
			Impact:     ingestiondomain.ChangeImpactNegative,
			Group:      ingestiondomain.ChangeGroupFreshness,
		})
	}

	return signals
}

func buildFieldRoleMap(fieldSets ...[]ingestiondomain.FieldSelector) map[string]ingestiondomain.FieldRole {
	roles := make(map[string]ingestiondomain.FieldRole)
	for _, fields := range fieldSets {
		for _, field := range fields {
			name := strings.TrimSpace(field.Name)
			if name == "" {
				continue
			}
			roles[name] = ingestiondomain.NormalizeFieldRole(field.FieldRole, name)
		}
	}
	return roles
}

func roleForField(roles map[string]ingestiondomain.FieldRole, fieldName string) ingestiondomain.FieldRole {
	if role, ok := roles[fieldName]; ok {
		return role
	}
	return ingestiondomain.NormalizeFieldRole("", fieldName)
}

func humanizeFieldName(fieldName string) string {
	words := strings.Fields(strings.ReplaceAll(fieldName, "_", " "))
	if len(words) == 0 {
		return fieldName
	}
	for index, word := range words {
		if len(word) == 0 {
			continue
		}
		words[index] = strings.ToUpper(word[:1]) + word[1:]
	}
	return strings.Join(words, " ")
}

// DeriveDecisionContext builds the acquisition intelligence context for a property.
// All fields are null-safe: missing or unparseable values produce nil pointers.
func DeriveDecisionContext(
	property ingestiondomain.Property,
	currentSnapshot ingestiondomain.PropertySnapshot,
) ingestiondomain.DecisionContext {
	ctx := ingestiondomain.DecisionContext{
		FreshnessStatus: "unknown",
	}

	values := decodeStringValues(currentSnapshot.Values)

	// Current price
	if price, ok := extractFirstNumericField(values, "price"); ok {
		ctx.CurrentPrice = &price
	}

	// Target price from metadata
	if property.Metadata.TargetPrice > 0 {
		tp := property.Metadata.TargetPrice
		ctx.TargetPrice = &tp
	}

	// Price gap
	if ctx.CurrentPrice != nil && ctx.TargetPrice != nil {
		gap := *ctx.CurrentPrice - *ctx.TargetPrice
		ctx.PriceGapAbsolute = &gap
		if *ctx.TargetPrice != 0 {
			pct := float64(gap) / float64(*ctx.TargetPrice) * 100.0
			rounded := math.Round(pct*10) / 10
			ctx.PriceGapPercent = &rounded
		}
	}

	// €/m²
	if ctx.CurrentPrice != nil {
		if sqm, ok := extractFirstNumericField(values, areaFieldNames...); ok && sqm > 0 {
			ppm := *ctx.CurrentPrice / sqm
			ctx.CurrentPricePerSqm = &ppm
		}
	}

	// Metadata fields
	ctx.ExpectedYieldBps = property.Metadata.ExpectedYieldBps
	ctx.Stage = strings.TrimSpace(property.Metadata.BusinessStage)
	ctx.PriorityLevel = strings.TrimSpace(property.Metadata.PriorityLevel)

	// Deal thesis summary (truncated)
	thesis := strings.TrimSpace(property.Metadata.DealThesis)
	if thesis != "" {
		if utf8.RuneCountInString(thesis) > dealThesisMaxRunes {
			runes := []rune(thesis)
			ctx.DealThesisSummary = string(runes[:dealThesisMaxRunes]) + "…"
		} else {
			ctx.DealThesisSummary = thesis
		}
	}

	// Freshness
	if !currentSnapshot.ObservedAt.IsZero() {
		t := currentSnapshot.ObservedAt
		ctx.LastObservedAt = &t
		age := time.Since(t)
		if age > staleThresholdHours*time.Hour {
			ctx.FreshnessStatus = "stale"
		} else if age > agingThresholdHours*time.Hour {
			ctx.FreshnessStatus = "aging"
		} else {
			ctx.FreshnessStatus = "fresh"
		}
	}

	return ctx
}

// BuildLatestChangeSummary returns a short human-readable string describing the most
// recent notable signals (price change, status change).  Returns "" if nothing notable.
func BuildLatestChangeSummary(signals []ingestiondomain.ChangeSignal) string {
	for _, sig := range signals {
		switch sig.Field {
		case "price":
			if sig.PercentDelta != nil && math.Abs(*sig.PercentDelta) >= significantPriceChangePct {
				dir := "↑"
				if *sig.PercentDelta < 0 {
					dir = "↓"
				}
				return fmt.Sprintf("Price %s %.1f%% (%s → %s)", dir, math.Abs(*sig.PercentDelta), sig.Previous, sig.Current)
			}
		case "status":
			return fmt.Sprintf("Status: %q → %q", sig.Previous, sig.Current)
		case "tracking_status":
			return "Property tracking degraded"
		}
	}
	return ""
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func decodeStringValues(raw json.RawMessage) map[string]string {
	if len(raw) == 0 {
		return map[string]string{}
	}
	out := make(map[string]string)
	if err := json.Unmarshal(raw, &out); err != nil {
		return map[string]string{}
	}
	return out
}

func hasAnyFieldValue(values map[string]string, fieldNames ...string) bool {
	for _, name := range fieldNames {
		if strings.TrimSpace(values[name]) != "" {
			return true
		}
	}
	return false
}

// extractFirstNumericField tries each field name in order and returns the first parseable int64.
func extractFirstNumericField(values map[string]string, fieldNames ...string) (int64, bool) {
	for _, name := range fieldNames {
		raw := strings.TrimSpace(values[name])
		if raw == "" {
			continue
		}
		// Strip non-digit characters (handles "€ 250,000" etc.)
		var digits strings.Builder
		for _, ch := range raw {
			if ch >= '0' && ch <= '9' {
				digits.WriteRune(ch)
			}
		}
		if digits.Len() == 0 {
			continue
		}
		if n, err := strconv.ParseInt(digits.String(), 10, 64); err == nil {
			return n, true
		}
	}
	return 0, false
}
