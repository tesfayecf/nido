package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWritePaginatedJSONReturnsStableOffsetWindow(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/items?page=2&pageSize=2", nil)
	recorder := httptest.NewRecorder()

	WritePaginatedJSON(recorder, request, http.StatusOK, []int{1, 2, 3, 4, 5}, nil)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recorder.Code)
	}
	var payload struct {
		Data       []int      `json:"data"`
		Items      []int      `json:"items"`
		Count      int        `json:"count"`
		Pagination Pagination `json:"pagination"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload.Count != 2 || payload.Data[0] != 3 || payload.Data[1] != 4 {
		t.Fatalf("unexpected data window: %+v", payload)
	}
	if payload.Items[0] != payload.Data[0] {
		t.Fatalf("expected legacy items to match data: %+v", payload)
	}
	if payload.Pagination.Total != 5 || payload.Pagination.Page != 2 || !payload.Pagination.HasNext || !payload.Pagination.HasPrevious {
		t.Fatalf("unexpected pagination metadata: %+v", payload.Pagination)
	}
}

func TestWritePaginatedJSONRejectsOversizedPage(t *testing.T) {
	request := httptest.NewRequest(http.MethodGet, "/items?pageSize=101", nil)
	recorder := httptest.NewRecorder()

	WritePaginatedJSON(recorder, request, http.StatusOK, []int{1, 2, 3}, nil)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", recorder.Code)
	}
}

func TestWritePaginatedJSONSupportsCursorAndConditionalGET(t *testing.T) {
	first := httptest.NewRecorder()
	WritePaginatedJSON(first, httptest.NewRequest(http.MethodGet, "/items?limit=2", nil), http.StatusOK, []int{1, 2, 3}, nil)

	var firstPayload struct {
		Data       []int      `json:"data"`
		Pagination Pagination `json:"pagination"`
	}
	if err := json.NewDecoder(first.Body).Decode(&firstPayload); err != nil {
		t.Fatalf("decode first response: %v", err)
	}
	if firstPayload.Pagination.NextCursor == "" {
		t.Fatalf("expected next cursor: %+v", firstPayload.Pagination)
	}

	second := httptest.NewRecorder()
	WritePaginatedJSON(second, httptest.NewRequest(http.MethodGet, "/items?cursor="+firstPayload.Pagination.NextCursor+"&limit=2", nil), http.StatusOK, []int{1, 2, 3}, nil)
	var secondPayload struct {
		Data       []int      `json:"data"`
		Pagination Pagination `json:"pagination"`
	}
	if err := json.NewDecoder(second.Body).Decode(&secondPayload); err != nil {
		t.Fatalf("decode second response: %v", err)
	}
	if len(secondPayload.Data) != 1 || secondPayload.Data[0] != 3 || !secondPayload.Pagination.HasPrevious {
		t.Fatalf("unexpected cursor page: %+v", secondPayload)
	}

	conditionalRequest := httptest.NewRequest(http.MethodGet, "/items?limit=2", nil)
	conditionalRequest.Header.Set("If-None-Match", first.Header().Get("ETag"))
	conditional := httptest.NewRecorder()
	WritePaginatedJSON(conditional, conditionalRequest, http.StatusOK, []int{1, 2, 3}, nil)
	if conditional.Code != http.StatusNotModified {
		t.Fatalf("expected 304, got %d", conditional.Code)
	}
}
