package fetcher

import (
	"hash/fnv"
	"strings"
)

// SessionProfile keeps browser-facing headers internally consistent.
type SessionProfile struct {
	UserAgent               string
	SecCHUA                 string
	SecCHUAPlatform         string
	Accept                  string
	AcceptLanguage          string
	SecFetchDest            string
	SecFetchMode            string
	SecFetchSite            string
	UpgradeInsecureRequests string
}

func defaultProfiles() []SessionProfile {
	return []SessionProfile{
		{
			UserAgent:               "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
			SecCHUA:                 `"Chromium";v="135", "Google Chrome";v="135", "Not.A/Brand";v="24"`,
			SecCHUAPlatform:         `"Windows"`,
			Accept:                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
			AcceptLanguage:          "en-US,en;q=0.9",
			SecFetchDest:            "document",
			SecFetchMode:            "navigate",
			SecFetchSite:            "none",
			UpgradeInsecureRequests: "1",
		},
		{
			UserAgent:               "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
			Accept:                  "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			AcceptLanguage:          "en-US,en;q=0.8",
			SecFetchDest:            "document",
			SecFetchMode:            "navigate",
			SecFetchSite:            "none",
			UpgradeInsecureRequests: "1",
		},
		{
			UserAgent:               "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0",
			Accept:                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
			AcceptLanguage:          "en-US,en;q=0.7",
			SecFetchDest:            "document",
			SecFetchMode:            "navigate",
			SecFetchSite:            "none",
			UpgradeInsecureRequests: "1",
		},
	}
}

func profileFor(profiles []SessionProfile, sessionKey string) SessionProfile {
	resolved := profiles
	if len(resolved) == 0 {
		resolved = defaultProfiles()
	}

	key := strings.TrimSpace(sessionKey)
	if key == "" {
		return resolved[0]
	}

	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(key))
	return resolved[int(hasher.Sum32())%len(resolved)]
}
