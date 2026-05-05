/**
 * File: internal/ingestion/application/transform_test.go
 *
 * Purpose:
 * Validates the application package behavior covered by transform_test.go.
 *
 * Responsibilities:
 * - Set up deterministic test fixtures
 * - Exercise expected success and failure paths
 * - Protect backend behavior from regressions
 *
 * Inputs:
 * - Function parameters, HTTP payloads, environment settings, or repository data as accepted by this file.
 *
 * Outputs:
 * - Typed Go values, HTTP responses, persisted records, or test assertions produced by this file.
 *
 * Dependencies:
 * - testing
 * - nido/server/internal/ingestion/domain
 *
 * Side Effects:
 * - May perform database, network, filesystem, logging, scheduler, or HTTP response effects through collaborators.
 *
 * Critical Notes:
 * - Keep this documentation synchronized with behavior changes and cross-package contracts.
 */

package application

import (
	"testing"

	ingestiondomain "nido/server/internal/ingestion/domain"
)

/**
 * Purpose:
 * Performs the TestApplyTransformVocabulary operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func TestApplyTransformVocabulary(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		transform string
		input     string
		want      string
		wantErr   bool
	}{
		{name: "noop", transform: "", input: "  Hello  ", want: "Hello"},
		{name: "trim", transform: "trim", input: " Hi ", want: "Hi"},
		{name: "lowercase", transform: "Lowercase", input: " Hello World ", want: "hello world"},
		{name: "uppercase", transform: "UPPERCASE", input: "Hello", want: "HELLO"},
		{name: "integer alias number", transform: "number", input: "$1,200.99", want: "120099"},
		{name: "integer", transform: "integer", input: "€450,000", want: "450000"},
		{name: "decimal european", transform: "decimal", input: "1.234,56 €", want: "1234.56"},
		{name: "decimal us", transform: "decimal", input: "$1,234.56", want: "1234.56"},
		{name: "currency keeps two-decimal price", transform: "currency", input: "$1,200.99", want: "1200.99"},
		{name: "currency thousands only", transform: "currency", input: "€310,000", want: "310000"},
		{name: "currency negative", transform: "currency", input: "-$12.50", want: "-12.50"},
		{name: "currency empty", transform: "currency", input: "", want: ""},
		{name: "unknown errors", transform: "magic", input: "x", wantErr: true},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := applyTransform(tc.input, tc.transform)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got value %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("transform %q over %q: want %q, got %q", tc.transform, tc.input, tc.want, got)
			}
		})
	}
}

/**
 * Purpose:
 * Performs the TestNormalizeConfiguredFieldsRejectsUnknownTransform operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func TestNormalizeConfiguredFieldsRejectsUnknownTransform(t *testing.T) {
	t.Parallel()

	_, err := normalizeConfiguredFields([]ingestiondomain.FieldSelector{
		{
			Name:           "price",
			SelectorType:   ingestiondomain.SelectorTypeCSS,
			SelectorValue:  ".price",
			ExtractionMode: ingestiondomain.ExtractionModeText,
			Transform:      "wat",
		},
	})
	if err == nil {
		t.Fatal("expected unknown transform to be rejected at config time")
	}
}

/**
 * Purpose:
 * Performs the TestExtractNodeValueHonoursTextMode operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func TestExtractNodeValueHonoursTextMode(t *testing.T) {
	t.Parallel()

	body := []byte(`
		<html>
			<body>
				<div class="card">
					<h2>Title</h2>
					<script>var leak = 1;</script>
					<style>.x { color: red }</style>
					<p>Hello   <strong>world</strong>!</p>
				</div>
			</body>
		</html>
	`)

	innerResults := runSingleSelector(t, body, ingestiondomain.FieldSelector{
		Name:           "card",
		SelectorType:   ingestiondomain.SelectorTypeCSS,
		SelectorValue:  ".card",
		ExtractionMode: ingestiondomain.ExtractionModeText,
		TextMode:       ingestiondomain.TextModeInnerText,
	})
	if got := innerResults["card"]; got != "Title Hello world!" {
		t.Fatalf("innerText: want collapsed visible text, got %q", got)
	}

	rawResults := runSingleSelector(t, body, ingestiondomain.FieldSelector{
		Name:           "card",
		SelectorType:   ingestiondomain.SelectorTypeCSS,
		SelectorValue:  ".card",
		ExtractionMode: ingestiondomain.ExtractionModeText,
		TextMode:       ingestiondomain.TextModeTextContent,
	})
	got := rawResults["card"]
	// textContent must include script/style content, so the leak marker is present.
	if got == "" || !contains(got, "leak") || !contains(got, "color: red") {
		t.Fatalf("textContent: expected raw text including <script>/<style>, got %q", got)
	}
}

/**
 * Purpose:
 * Performs the TestSelectFieldValueReportsErrorCodes operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func TestSelectFieldValueReportsErrorCodes(t *testing.T) {
	t.Parallel()

	body := []byte(`<html><body><a class="link">x</a></body></html>`)

	cases := []struct {
		name  string
		field ingestiondomain.FieldSelector
		code  ingestiondomain.PreviewErrorCode
	}{
		{
			name: "no_match",
			field: ingestiondomain.FieldSelector{
				Name:           "missing",
				SelectorType:   ingestiondomain.SelectorTypeCSS,
				SelectorValue:  ".does-not-exist",
				ExtractionMode: ingestiondomain.ExtractionModeText,
			},
			code: ingestiondomain.PreviewErrorCodeNoMatch,
		},
		{
			name: "attribute_missing",
			field: ingestiondomain.FieldSelector{
				Name:           "href",
				SelectorType:   ingestiondomain.SelectorTypeCSS,
				SelectorValue:  ".link",
				ExtractionMode: ingestiondomain.ExtractionModeAttribute,
				Attribute:      "data-not-here",
			},
			code: ingestiondomain.PreviewErrorCodeAttributeMissing,
		},
		{
			name: "selector_invalid",
			field: ingestiondomain.FieldSelector{
				Name:           "bad",
				SelectorType:   ingestiondomain.SelectorTypeXPath,
				SelectorValue:  "//span[contains(@class,'x')]",
				ExtractionMode: ingestiondomain.ExtractionModeText,
			},
			code: ingestiondomain.PreviewErrorCodeSelectorInvalid,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			_, _, fields := applySelectors(body, []ingestiondomain.FieldSelector{tc.field})
			if len(fields) != 1 {
				t.Fatalf("expected one field result, got %d", len(fields))
			}
			if fields[0].Success {
				t.Fatalf("expected failure for %s", tc.name)
			}
			if fields[0].ErrorCode != tc.code {
				t.Fatalf("want error code %q, got %q", tc.code, fields[0].ErrorCode)
			}
		})
	}
}

/**
 * Purpose:
 * Performs the TestSelectFieldValueReportsOKCode operation for this backend package.
 *
 * Parameters:
 * - t *testing.T
 *
 * Returns:
 * - None.
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func TestSelectFieldValueReportsOKCode(t *testing.T) {
	t.Parallel()

	body := []byte(`<html><body><span class="price">€450,000</span></body></html>`)
	_, _, fields := applySelectors(body, []ingestiondomain.FieldSelector{
		{
			Name:           "price",
			SelectorType:   ingestiondomain.SelectorTypeCSS,
			SelectorValue:  ".price",
			ExtractionMode: ingestiondomain.ExtractionModeText,
			Transform:      "currency",
		},
	})
	if len(fields) != 1 || !fields[0].Success {
		t.Fatalf("expected success, got %+v", fields)
	}
	if fields[0].ErrorCode != ingestiondomain.PreviewErrorCodeOK {
		t.Fatalf("want ok error code, got %q", fields[0].ErrorCode)
	}
	if fields[0].Value != "450000" {
		t.Fatalf("want currency-normalised value 450000, got %q", fields[0].Value)
	}
}

/**
 * Purpose:
 * Performs the runSingleSelector operation for this backend package.
 *
 * Parameters:
 * - t *testing.T, body []byte, field ingestiondomain.FieldSelector
 *
 * Returns:
 * - map[string]string
 *
 * Logic Summary:
 * - Validates or normalizes inputs, delegates to package collaborators, and returns typed success or error results.
 *
 * Edge Cases:
 * - Handles empty inputs, missing records, malformed payloads, and dependency failures according to caller contracts.
 *
 * Side Effects:
 * - May read/write external state when invoked collaborators perform I/O.
 */
func runSingleSelector(t *testing.T, body []byte, field ingestiondomain.FieldSelector) map[string]string {
	t.Helper()
	values, failures, fields := applySelectors(body, []ingestiondomain.FieldSelector{field})
	if len(failures) > 0 {
		t.Fatalf("unexpected failures: %v (fields=%+v)", failures, fields)
	}
	return values
}

/**
 * Purpose:
 * Performs the contains operation for this backend package.
 *
 * Parameters:
 * - haystack, needle string
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
 * - May read/write external state when invoked collaborators perform I/O.
 */
func contains(haystack, needle string) bool {
	for i := 0; i+len(needle) <= len(haystack); i++ {
		if haystack[i:i+len(needle)] == needle {
			return true
		}
	}
	return false
}
