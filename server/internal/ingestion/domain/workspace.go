package domain

import "time"

const (
	// WorkflowStateUnreviewed is the default collaboration state.
	WorkflowStateUnreviewed = "unreviewed"
	// WorkflowStateInvestigating means the property is actively being worked.
	WorkflowStateInvestigating = "investigating"
	// WorkflowStateResolved means the workspace closed the operational loop.
	WorkflowStateResolved = "resolved"
)

// PropertyMetadata stores collaboration and business context for a property.
type PropertyMetadata struct {
	PropertyID         string              `json:"property_id"`
	OwnerID            string              `json:"owner_id,omitempty"`
	WorkflowState      string              `json:"workflow_state"`
	Priority           string              `json:"priority"`
	PipelineStage      string              `json:"pipeline_stage"`
	TargetPrice        *float64            `json:"target_price,omitempty"`
	ExpectedYield      *float64            `json:"expected_yield,omitempty"`
	AcquisitionNotes   string              `json:"acquisition_notes,omitempty"`
	DealThesis         string              `json:"deal_thesis,omitempty"`
	ExternalReferences []ExternalReference `json:"external_references,omitempty"`
	Attachments        []Attachment        `json:"attachments,omitempty"`
	CreatedAt          time.Time           `json:"created_at"`
	UpdatedAt          time.Time           `json:"updated_at"`
}

// ExternalReference stores one structured external reference.
type ExternalReference struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// Attachment stores one link-style attachment reference.
type Attachment struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

// PropertyComment is one immutable collaboration entry.
type PropertyComment struct {
	ID         string    `json:"id"`
	PropertyID string    `json:"property_id"`
	UserID     string    `json:"user_id"`
	Body       string    `json:"body"`
	Mentions   []string  `json:"mentions,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// PropertyWatcher stores one subscribed user.
type PropertyWatcher struct {
	PropertyID string    `json:"property_id"`
	UserID     string    `json:"user_id"`
	Channels   []string  `json:"channels,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// AuditLog records one traceable operational change.
type AuditLog struct {
	ID          string    `json:"id"`
	ActorUserID string    `json:"actor_user_id,omitempty"`
	TargetKind  string    `json:"target_kind"`
	TargetID    string    `json:"target_id"`
	Summary     string    `json:"summary"`
	CreatedAt   time.Time `json:"created_at"`
}

// IntegrationConfig stores one workspace integration.
type IntegrationConfig struct {
	ID               string         `json:"id"`
	Kind             string         `json:"kind"`
	Name             string         `json:"name"`
	Target           string         `json:"target"`
	Filters          map[string]any `json:"filters,omitempty"`
	Active           bool           `json:"active"`
	RetryMaxAttempts int            `json:"retry_max_attempts"`
	LastTestStatus   string         `json:"last_test_status,omitempty"`
	LastTestAt       *time.Time     `json:"last_test_at,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
}

// IntegrationDelivery records one visible delivery attempt.
type IntegrationDelivery struct {
	ID            string    `json:"id"`
	IntegrationID string    `json:"integration_id"`
	PropertyID    string    `json:"property_id,omitempty"`
	TriggerKind   string    `json:"trigger_kind"`
	Status        string    `json:"status"`
	AttemptCount  int       `json:"attempt_count"`
	Payload       []byte    `json:"payload,omitempty"`
	ErrorMessage  string    `json:"error_message,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// SchedulerPause stores one active pause rule.
type SchedulerPause struct {
	ID          string    `json:"id"`
	ScopeType   string    `json:"scope_type"`
	ScopeValue  string    `json:"scope_value"`
	ActorUserID string    `json:"actor_user_id,omitempty"`
	Reason      string    `json:"reason,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// MaintenanceWindow stores one maintenance interval.
type MaintenanceWindow struct {
	ID          string    `json:"id"`
	ActorUserID string    `json:"actor_user_id,omitempty"`
	Name        string    `json:"name"`
	StartsAt    time.Time `json:"starts_at"`
	EndsAt      time.Time `json:"ends_at"`
	Reason      string    `json:"reason,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// AnalyticsPoint stores one time-series aggregate point.
type AnalyticsPoint struct {
	Label string  `json:"label"`
	Value float64 `json:"value"`
}

// AnalyticsPropertyStat stores one property-level analytic.
type AnalyticsPropertyStat struct {
	PropertyID string  `json:"property_id"`
	Label      string  `json:"label"`
	Value      float64 `json:"value"`
}

// AnalyticsSourceStat stores one source-level analytic.
type AnalyticsSourceStat struct {
	SourceID string  `json:"source_id,omitempty"`
	Label    string  `json:"label"`
	Value    float64 `json:"value"`
}

// PortfolioAnalytics groups workspace analytics.
type PortfolioAnalytics struct {
	UpdateFrequencySeconds int                     `json:"update_frequency_seconds"`
	PriceChangeTrends      []AnalyticsPoint        `json:"price_change_trends"`
	FailureRateTrends      []AnalyticsPoint        `json:"failure_rate_trends"`
	SourceReliability      []AnalyticsSourceStat   `json:"source_reliability"`
	MostVolatileProperties []AnalyticsPropertyStat `json:"most_volatile_properties"`
	LargestPriceMovers     []AnalyticsPropertyStat `json:"largest_price_movers"`
	AlertVolumeTrends      []AnalyticsPoint        `json:"alert_volume_trends"`
	OperationalRisk        []AnalyticsPropertyStat `json:"operational_risk"`
}

// SystemHealth summarizes workspace operational state.
type SystemHealth struct {
	QueueDepth           int                   `json:"queue_depth"`
	ProcessingThroughput float64               `json:"processing_throughput"`
	RetryRate            float64               `json:"retry_rate"`
	FailureDistribution  []AnalyticsSourceStat `json:"failure_distribution"`
}
