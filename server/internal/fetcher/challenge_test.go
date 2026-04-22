package fetcher

import "testing"

func TestDetectAntiBotChallengeRecognizesCommonChallengePages(t *testing.T) {
	t.Parallel()

	body := []byte(`<html><head><title>Just a moment...</title></head><body><div>Cloudflare Ray ID: abc123</div></body></html>`)
	if marker := detectAntiBotChallenge(body); marker == "" {
		t.Fatal("expected challenge marker to be detected")
	}
}

func TestDetectAntiBotChallengeIgnoresNormalListingPages(t *testing.T) {
	t.Parallel()

	body := []byte(`<html><head><title>Sunny flat in Girona</title></head><body><span class="price">198.000 €</span></body></html>`)
	if marker := detectAntiBotChallenge(body); marker != "" {
		t.Fatalf("expected normal page to pass, got marker %q", marker)
	}
}
