/**
 * File: internal/platform/config/config.go
 *
 * Purpose:
 * Loads and normalizes backend runtime configuration from environment variables.
 *
 * Responsibilities:
 * - Read environment-backed settings
 * - Apply safe defaults
 * - Expose typed configuration to runtime assembly
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - encoding/json
 * - fmt
 * - net/url
 * - os
 * - strconv
 * - strings
 * - time
 *
 * Side Effects:
 * - None beyond in-memory transformations unless called dependencies perform effects.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package config

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

/**
 * Purpose:
 * Defines the Config struct used by this package and its consumers.
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
type Config struct {
	HTTP            HTTPConfig
	Database        DatabaseConfig
	Migration       MigrationConfig
	ObjectStore     ObjectStoreConfig
	BootstrapSource BootstrapSourceConfig
	Scheduler       SchedulerConfig
	Browser         BrowserConfig
	Fetcher         FetcherConfig
	Auth            AuthConfig
	Notifications   NotificationsConfig
}

/**
 * Purpose:
 * Defines the HTTPConfig struct used by this package and its consumers.
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
type HTTPConfig struct {
	Address string
}

/**
 * Purpose:
 * Defines the DatabaseConfig struct used by this package and its consumers.
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
type DatabaseConfig struct {
	Path string
}

/**
 * Purpose:
 * Defines the MigrationConfig struct used by this package and its consumers.
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
type MigrationConfig struct {
	AutoMigrate bool
	Strategy    string
	BackupDir   string
}

/**
 * Purpose:
 * Defines the ObjectStoreConfig struct used by this package and its consumers.
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
type ObjectStoreConfig struct {
	Driver            string
	S3Endpoint        string
	S3Region          string
	S3Bucket          string
	S3KeyPrefix       string
	S3AccessKeyID     string
	S3SecretAccessKey string
}

/**
 * Purpose:
 * Defines the SchedulerConfig struct used by this package and its consumers.
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
type SchedulerConfig struct {
	Enabled         bool
	TickInterval    time.Duration
	LockTTL         time.Duration
	BatchSize       int
	ShutdownTimeout time.Duration
}

/**
 * Purpose:
 * Defines the BrowserConfig struct used by this package and its consumers.
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
type BrowserConfig struct {
	Command string
	Args    []string
	Timeout time.Duration
}

/**
 * Purpose:
 * Defines the FetcherConfig struct used by this package and its consumers.
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
type FetcherConfig struct {
	Timeout         time.Duration
	ProxyProvider   string
	TLSProfile      string
	MinRequestGap   time.Duration
	BreakerInterval time.Duration
	BreakerTimeout  time.Duration
}

/**
 * Purpose:
 * Defines the AuthConfig struct used by this package and its consumers.
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
type AuthConfig struct {
	BootstrapAdminEmail    string
	BootstrapAdminName     string
	BootstrapAdminPassword string
	SessionTTL             time.Duration
}

/**
 * Purpose:
 * Defines the NotificationsConfig struct used by this package and its consumers.
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
type NotificationsConfig struct {
	WebhookURL string
	SMTPHost   string
	SMTPPort   int
	SMTPUser   string
	SMTPPass   string
	SMTPFrom   string
}

/**
 * Purpose:
 * Defines the BootstrapSourceConfig struct used by this package and its consumers.
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
type BootstrapSourceConfig struct {
	ID                      string
	Name                    string
	Kind                    string
	EndpointURL             string
	ConfigJSON              string
	BrowserEnabled          bool
	RateLimitWindowSeconds  int
	RateLimitMaxRequests    int
	RetryMaxAttempts        int
	RetryBackoffMillis      int
	ScheduleIntervalSeconds int
	FreshnessWindowSeconds  int
}

/**
 * Purpose:
 * Performs the Load operation for this backend package.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - (Config, error)
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func Load() (Config, error) {
	cfg := Config{
		HTTP: HTTPConfig{
			Address: envOrDefault("NIDO_HTTP_ADDR", ":8080"),
		},
		Database: DatabaseConfig{
			Path: envOrDefault("NIDO_DATABASE_PATH", "./.sqlite/nido.db"),
		},
		Migration: MigrationConfig{
			AutoMigrate: boolEnvOrDefaultFromAliases(true, "AUTO_MIGRATE", "NIDO_AUTO_MIGRATE"),
			Strategy:    strings.ToLower(envFromAliasesOrDefault("safe-auto", "MIGRATION_STRATEGY", "NIDO_MIGRATION_STRATEGY")),
			BackupDir:   envOrDefault("NIDO_BACKUP_DIR", "/app/backups"),
		},
		ObjectStore: ObjectStoreConfig{
			Driver:            strings.ToLower(envOrDefault("NIDO_OBJECT_STORE_DRIVER", "memory")),
			S3Endpoint:        strings.TrimSpace(os.Getenv("NIDO_S3_ENDPOINT")),
			S3Region:          strings.TrimSpace(os.Getenv("NIDO_S3_REGION")),
			S3Bucket:          strings.TrimSpace(os.Getenv("NIDO_S3_BUCKET")),
			S3KeyPrefix:       strings.TrimSpace(os.Getenv("NIDO_S3_KEY_PREFIX")),
			S3AccessKeyID:     strings.TrimSpace(os.Getenv("NIDO_S3_ACCESS_KEY_ID")),
			S3SecretAccessKey: strings.TrimSpace(os.Getenv("NIDO_S3_SECRET_ACCESS_KEY")),
		},
		BootstrapSource: BootstrapSourceConfig{
			ID:                      envOrDefault("NIDO_BOOTSTRAP_SOURCE_ID", "bootstrap-feed"),
			Name:                    envOrDefault("NIDO_BOOTSTRAP_SOURCE_NAME", "Bootstrap Feed"),
			Kind:                    envOrDefault("NIDO_BOOTSTRAP_SOURCE_KIND", "http-json-feed"),
			EndpointURL:             strings.TrimSpace(os.Getenv("NIDO_BOOTSTRAP_SOURCE_URL")),
			ConfigJSON:              envOrDefault("NIDO_BOOTSTRAP_SOURCE_CONFIG_JSON", "{}"),
			BrowserEnabled:          boolEnvOrDefault("NIDO_BOOTSTRAP_SOURCE_BROWSER_ENABLED", false),
			RateLimitWindowSeconds:  durationSeconds(durationEnvOrDefault("NIDO_BOOTSTRAP_SOURCE_RATE_LIMIT_WINDOW", 0)),
			RateLimitMaxRequests:    intEnvOrDefault("NIDO_BOOTSTRAP_SOURCE_RATE_LIMIT_MAX_REQUESTS", 0),
			RetryMaxAttempts:        intEnvOrDefault("NIDO_BOOTSTRAP_SOURCE_RETRY_MAX_ATTEMPTS", 1),
			RetryBackoffMillis:      durationMillis(durationEnvOrDefault("NIDO_BOOTSTRAP_SOURCE_RETRY_BACKOFF", 500*time.Millisecond)),
			ScheduleIntervalSeconds: durationSeconds(durationEnvOrDefault("NIDO_BOOTSTRAP_SOURCE_SCHEDULE_INTERVAL", 0)),
			FreshnessWindowSeconds:  durationSeconds(durationEnvOrDefault("NIDO_BOOTSTRAP_SOURCE_FRESHNESS_WINDOW", 0)),
		},
		Scheduler: SchedulerConfig{
			Enabled:         boolEnvOrDefault("NIDO_SCHEDULER_ENABLED", true),
			TickInterval:    durationEnvOrDefault("NIDO_SCHEDULER_TICK_INTERVAL", 15*time.Second),
			LockTTL:         durationEnvOrDefault("NIDO_SCHEDULER_LOCK_TTL", 2*time.Minute),
			BatchSize:       intEnvOrDefault("NIDO_SCHEDULER_BATCH_SIZE", 10),
			ShutdownTimeout: durationEnvOrDefault("NIDO_SCHEDULER_SHUTDOWN_TIMEOUT", 30*time.Second),
		},
		Browser: BrowserConfig{
			Command: strings.TrimSpace(os.Getenv("NIDO_BROWSER_COMMAND")),
			Args:    splitArgList(os.Getenv("NIDO_BROWSER_ARGS")),
			Timeout: durationEnvOrDefault("NIDO_BROWSER_TIMEOUT", 30*time.Second),
		},
		Fetcher: FetcherConfig{
			Timeout:         durationEnvOrDefault("NIDO_FETCHER_TIMEOUT", 20*time.Second),
			ProxyProvider:   strings.TrimSpace(os.Getenv("NIDO_FETCHER_PROXY_PROVIDER")),
			TLSProfile:      envOrDefault("NIDO_FETCHER_TLS_PROFILE", "chrome-2026"),
			MinRequestGap:   durationEnvOrDefault("NIDO_FETCHER_MIN_REQUEST_GAP", 750*time.Millisecond),
			BreakerInterval: durationEnvOrDefault("NIDO_FETCHER_BREAKER_INTERVAL", 30*time.Second),
			BreakerTimeout:  durationEnvOrDefault("NIDO_FETCHER_BREAKER_TIMEOUT", 15*time.Second),
		},
		Auth: AuthConfig{
			BootstrapAdminEmail:    envOrDefault("NIDO_BOOTSTRAP_ADMIN_EMAIL", "admin@local"),
			BootstrapAdminName:     envOrDefault("NIDO_BOOTSTRAP_ADMIN_NAME", "Local Admin"),
			BootstrapAdminPassword: envOrDefault("NIDO_BOOTSTRAP_ADMIN_PASSWORD", "dev-password"),
			SessionTTL:             durationEnvOrDefault("NIDO_AUTH_SESSION_TTL", 24*time.Hour),
		},
		Notifications: NotificationsConfig{
			WebhookURL: envFromAliases("NIDO_NOTIFICATION_WEBHOOK_URL", "NIDO_NOTIFICATIONS_WEBHOOK_URL"),
			SMTPHost:   strings.TrimSpace(os.Getenv("NIDO_SMTP_HOST")),
			SMTPPort:   intEnvOrDefault("NIDO_SMTP_PORT", 25),
			SMTPUser:   strings.TrimSpace(os.Getenv("NIDO_SMTP_USER")),
			SMTPPass:   strings.TrimSpace(os.Getenv("NIDO_SMTP_PASS")),
			SMTPFrom:   strings.TrimSpace(os.Getenv("NIDO_SMTP_FROM")),
		},
	}

	if cfg.ObjectStore.Driver == "" {
		cfg.ObjectStore.Driver = "memory"
	}
	if cfg.Migration.Strategy == "" {
		cfg.Migration.Strategy = "safe-auto"
	}
	switch cfg.Migration.Strategy {
	case "safe-auto", "manual":
	default:
		return Config{}, fmt.Errorf("unsupported migration strategy %q", cfg.Migration.Strategy)
	}
	if strings.TrimSpace(cfg.Migration.BackupDir) == "" {
		cfg.Migration.BackupDir = "/app/backups"
	}

	if cfg.ObjectStore.Driver == "s3" {
		if cfg.ObjectStore.S3Endpoint == "" || cfg.ObjectStore.S3Region == "" || cfg.ObjectStore.S3Bucket == "" || cfg.ObjectStore.S3AccessKeyID == "" || cfg.ObjectStore.S3SecretAccessKey == "" {
			return Config{}, fmt.Errorf("object store driver %q requires endpoint, region, bucket, access key, and secret key", cfg.ObjectStore.Driver)
		}
	}

	if cfg.BootstrapSource.EndpointURL != "" {
		if _, err := url.ParseRequestURI(cfg.BootstrapSource.EndpointURL); err != nil {
			return Config{}, fmt.Errorf("invalid bootstrap source URL: %w", err)
		}
	}

	if !json.Valid([]byte(cfg.BootstrapSource.ConfigJSON)) {
		return Config{}, fmt.Errorf("invalid bootstrap source config json")
	}

	if cfg.Scheduler.BatchSize <= 0 {
		cfg.Scheduler.BatchSize = 10
	}
	if cfg.Scheduler.ShutdownTimeout <= 0 {
		cfg.Scheduler.ShutdownTimeout = 30 * time.Second
	}
	if cfg.Browser.Timeout <= 0 {
		cfg.Browser.Timeout = 30 * time.Second
	}
	if cfg.Fetcher.Timeout <= 0 {
		cfg.Fetcher.Timeout = 20 * time.Second
	}
	if cfg.Fetcher.MinRequestGap < 0 {
		cfg.Fetcher.MinRequestGap = 0
	}
	if cfg.Auth.SessionTTL <= 0 {
		cfg.Auth.SessionTTL = 24 * time.Hour
	}

	return cfg, nil
}

/**
 * Purpose:
 * Performs the envOrDefault operation for this backend package.
 *
 * Parameters:
 * - name, fallback string
 *
 * Returns:
 * - string
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func envOrDefault(name, fallback string) string {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}

	return value
}

/**
 * Purpose:
 * Performs the envFromAliases operation for this backend package.
 *
 * Parameters:
 * - names ...string
 *
 * Returns:
 * - string
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func envFromAliases(names ...string) string {
	for _, name := range names {
		value := strings.TrimSpace(os.Getenv(name))
		if value != "" {
			return value
		}
	}

	return ""
}

/**
 * Purpose:
 * Performs the boolEnvOrDefault operation for this backend package.
 *
 * Parameters:
 * - name string, fallback bool
 *
 * Returns:
 * - bool
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func boolEnvOrDefault(name string, fallback bool) bool {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}

	return parsed
}

/**
 * Purpose:
 * Performs the boolEnvOrDefaultFromAliases operation for this backend package.
 *
 * Parameters:
 * - fallback bool, names ...string
 *
 * Returns:
 * - bool
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func boolEnvOrDefaultFromAliases(fallback bool, names ...string) bool {
	for _, name := range names {
		value := strings.TrimSpace(os.Getenv(name))
		if value == "" {
			continue
		}
		parsed, err := strconv.ParseBool(value)
		if err != nil {
			return fallback
		}
		return parsed
	}
	return fallback
}

/**
 * Purpose:
 * Performs the envFromAliasesOrDefault operation for this backend package.
 *
 * Parameters:
 * - fallback string, names ...string
 *
 * Returns:
 * - string
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func envFromAliasesOrDefault(fallback string, names ...string) string {
	value := envFromAliases(names...)
	if value == "" {
		return fallback
	}
	return value
}

/**
 * Purpose:
 * Performs the intEnvOrDefault operation for this backend package.
 *
 * Parameters:
 * - name string, fallback int
 *
 * Returns:
 * - int
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func intEnvOrDefault(name string, fallback int) int {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}

/**
 * Purpose:
 * Performs the durationEnvOrDefault operation for this backend package.
 *
 * Parameters:
 * - name string, fallback time.Duration
 *
 * Returns:
 * - time.Duration
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func durationEnvOrDefault(name string, fallback time.Duration) time.Duration {
	value := strings.TrimSpace(os.Getenv(name))
	if value == "" {
		return fallback
	}

	parsed, err := time.ParseDuration(value)
	if err != nil {
		return fallback
	}

	return parsed
}

/**
 * Purpose:
 * Performs the durationSeconds operation for this backend package.
 *
 * Parameters:
 * - value time.Duration
 *
 * Returns:
 * - int
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func durationSeconds(value time.Duration) int {
	if value <= 0 {
		return 0
	}

	return int(value / time.Second)
}

/**
 * Purpose:
 * Performs the durationMillis operation for this backend package.
 *
 * Parameters:
 * - value time.Duration
 *
 * Returns:
 * - int
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func durationMillis(value time.Duration) int {
	if value <= 0 {
		return 0
	}

	return int(value / time.Millisecond)
}

/**
 * Purpose:
 * Performs the splitArgList operation for this backend package.
 *
 * Parameters:
 * - raw string
 *
 * Returns:
 * - []string
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - None beyond in-memory computation unless caller-provided dependencies have effects.
 */
func splitArgList(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}

	if !strings.Contains(raw, ",") {
		return strings.Fields(raw)
	}

	parts := strings.Split(raw, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			items = append(items, trimmed)
		}
	}

	return items
}
