package config

import (
	"reflect"
	"testing"
)

func TestLoadParsesBrowserArgsFromCommonFormats(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want []string
	}{
		{
			name: "whitespace separated",
			raw:  "--headless --disable-gpu --dump-dom",
			want: []string{"--headless", "--disable-gpu", "--dump-dom"},
		},
		{
			name: "comma separated",
			raw:  "--headless, --disable-gpu, --dump-dom",
			want: []string{"--headless", "--disable-gpu", "--dump-dom"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("NIDO_BROWSER_ARGS", test.raw)

			cfg, err := Load()
			if err != nil {
				t.Fatalf("load config: %v", err)
			}

			if !reflect.DeepEqual(test.want, cfg.Browser.Args) {
				t.Fatalf("unexpected args: want=%v got=%v", test.want, cfg.Browser.Args)
			}
		})
	}
}

func TestLoadAcceptsNotificationWebhookEnvAliases(t *testing.T) {
	tests := []struct {
		name    string
		envName string
	}{
		{name: "canonical", envName: "NIDO_NOTIFICATION_WEBHOOK_URL"},
		{name: "legacy plural", envName: "NIDO_NOTIFICATIONS_WEBHOOK_URL"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv(test.envName, "http://127.0.0.1:9098/hooks/notifications")

			cfg, err := Load()
			if err != nil {
				t.Fatalf("load config: %v", err)
			}

			if cfg.Notifications.WebhookURL != "http://127.0.0.1:9098/hooks/notifications" {
				t.Fatalf("unexpected webhook url %q", cfg.Notifications.WebhookURL)
			}
		})
	}
}

func TestLoadParsesFetcherMinRequestGap(t *testing.T) {
	t.Setenv("NIDO_FETCHER_MIN_REQUEST_GAP", "1500ms")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load config: %v", err)
	}

	if cfg.Fetcher.MinRequestGap.Milliseconds() != 1500 {
		t.Fatalf("unexpected fetcher min request gap %s", cfg.Fetcher.MinRequestGap)
	}
}

func TestLoadParsesMigrationControlsFromPortableEnvNames(t *testing.T) {
	t.Setenv("AUTO_MIGRATE", "false")
	t.Setenv("MIGRATION_STRATEGY", "manual")
	t.Setenv("NIDO_BACKUP_DIR", "/custom/backups")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("load config: %v", err)
	}

	if cfg.Migration.AutoMigrate {
		t.Fatalf("expected auto migrate to be disabled")
	}
	if cfg.Migration.Strategy != "manual" {
		t.Fatalf("unexpected migration strategy %q", cfg.Migration.Strategy)
	}
	if cfg.Migration.BackupDir != "/custom/backups" {
		t.Fatalf("unexpected backup dir %q", cfg.Migration.BackupDir)
	}
}

func TestLoadRejectsUnsupportedMigrationStrategy(t *testing.T) {
	t.Setenv("MIGRATION_STRATEGY", "unsafe")

	if _, err := Load(); err == nil {
		t.Fatalf("expected unsupported migration strategy error")
	}
}
