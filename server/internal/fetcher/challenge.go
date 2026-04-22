package fetcher

import (
	"fmt"
	"strings"
)

const challengeScanLimit = 16 * 1024

var antiBotChallengeMarkers = []string{
	"pardon our interruption",
	"just a moment",
	"attention required",
	"verify you are human",
	"security check",
	"captcha",
	"cloudflare ray id",
	"cf-browser-verification",
	"ddos-guard",
	"automated access",
	"access denied",
}

type antiBotChallengeError struct {
	marker string
	via    string
}

func (e *antiBotChallengeError) Error() string {
	if e == nil {
		return "portal returned an anti-bot challenge page"
	}
	if e.marker == "" {
		return fmt.Sprintf("portal returned an anti-bot challenge page via %s", e.via)
	}

	return fmt.Sprintf("portal returned an anti-bot challenge page via %s (matched %q)", e.via, e.marker)
}

func detectAntiBotChallenge(body []byte) string {
	if len(body) == 0 {
		return ""
	}

	scanned := body
	if len(scanned) > challengeScanLimit {
		scanned = scanned[:challengeScanLimit]
	}
	lowered := strings.ToLower(string(scanned))
	for _, marker := range antiBotChallengeMarkers {
		if strings.Contains(lowered, marker) {
			return marker
		}
	}

	return ""
}
