package sharedsdk

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

type alertNormalizationVector struct {
	Input    string              `json:"input"`
	Expected CanonicalAlertLevel `json:"expected"`
	Priority int                 `json:"priority"`
}

type alertOrderingVector struct {
	ID          string                 `json:"id"`
	Input       []AlertLifecycleRecord `json:"input"`
	ExpectedIDs []string               `json:"expectedIds"`
}

type alertReconciliationVector struct {
	ID              string   `json:"id"`
	ActiveIDs       []string `json:"activeIds"`
	AcknowledgedIDs []string `json:"acknowledgedIds"`
	Expected        []string `json:"expected"`
}

type alertHighestVector struct {
	ID                  string                 `json:"id"`
	Alerts              []AlertLifecycleRecord `json:"alerts"`
	IncludeAcknowledged bool                   `json:"includeAcknowledged"`
	Expected            CanonicalAlertLevel    `json:"expected"`
}

type alertConformanceVectors struct {
	Schema              string                      `json:"schema"`
	NormalizationCases  []alertNormalizationVector  `json:"normalizationCases"`
	InvalidLevelCases   []string                    `json:"invalidLevelCases"`
	OrderingCases       []alertOrderingVector       `json:"orderingCases"`
	ReconciliationCases []alertReconciliationVector `json:"reconciliationCases"`
	HighestCases        []alertHighestVector        `json:"highestCases"`
}

func loadAlertConformance(t *testing.T) alertConformanceVectors {
	t.Helper()
	data, err := os.ReadFile("conformance/alerts.json")
	if err != nil {
		t.Fatal(err)
	}
	authorityPath := filepath.Join("..", "..", "..", "..", "aviation-alerts", "acceptance", "vectors.json")
	if authority, authorityErr := os.ReadFile(authorityPath); authorityErr == nil && !bytes.Equal(data, authority) {
		t.Fatal("packaged alerts conformance vectors differ from Component authority")
	}
	var vectors alertConformanceVectors
	if err := json.Unmarshal(data, &vectors); err != nil {
		t.Fatal(err)
	}
	return vectors
}

func TestAlertConformance(t *testing.T) {
	vectors := loadAlertConformance(t)
	if vectors.Schema != "aviation/alerts-acceptance-vectors@1" {
		t.Fatalf("unexpected schema %q", vectors.Schema)
	}
	for _, vector := range vectors.NormalizationCases {
		level, err := NormalizeAlertLevel(vector.Input)
		if err != nil || level != vector.Expected {
			t.Errorf("normalize %q = %q, %v", vector.Input, level, err)
		}
		priority, err := AlertPriority(vector.Input)
		if err != nil || priority != vector.Priority {
			t.Errorf("priority %q = %d, %v", vector.Input, priority, err)
		}
	}
	for _, input := range vectors.InvalidLevelCases {
		_, err := NormalizeAlertLevel(input)
		var lifecycleError *AlertLifecycleError
		if !errors.As(err, &lifecycleError) || lifecycleError.Code != "alert-level-invalid" {
			t.Errorf("normalize %q error = %#v", input, err)
		}
	}
	for _, vector := range vectors.OrderingCases {
		before := append([]AlertLifecycleRecord(nil), vector.Input...)
		ordered, err := OrderAlerts(vector.Input)
		if err != nil {
			t.Errorf("order %s: %v", vector.ID, err)
			continue
		}
		ids := make([]string, len(ordered))
		for index, alert := range ordered {
			ids[index] = alert.ID
		}
		if !reflect.DeepEqual(ids, vector.ExpectedIDs) {
			t.Errorf("order %s = %v", vector.ID, ids)
		}
		if !reflect.DeepEqual(vector.Input, before) {
			t.Errorf("order %s mutated input", vector.ID)
		}
	}
	for _, vector := range vectors.ReconciliationCases {
		actual := ReconcileAcknowledgements(vector.ActiveIDs, vector.AcknowledgedIDs)
		if !reflect.DeepEqual(actual, vector.Expected) {
			t.Errorf("reconcile %s = %v", vector.ID, actual)
		}
	}
	for _, vector := range vectors.HighestCases {
		actual, err := HighestAlertLevel(vector.Alerts, vector.IncludeAcknowledged)
		if err != nil || actual != vector.Expected {
			t.Errorf("highest %s = %q, %v", vector.ID, actual, err)
		}
	}
}
