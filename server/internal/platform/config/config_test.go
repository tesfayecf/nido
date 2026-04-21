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
			t.Setenv("HS_BROWSER_ARGS", test.raw)

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
		{name: "canonical", envName: "HS_NOTIFICATION_WEBHOOK_URL"},
		{name: "legacy plural", envName: "HS_NOTIFICATIONS_WEBHOOK_URL"},
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