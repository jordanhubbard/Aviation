package sharedsdk

import (
	"fmt"
	"sort"
	"strings"
)

// CanonicalAlertLevel is a provider-neutral alert severity.
type CanonicalAlertLevel string

const (
	AlertLevelNormal   CanonicalAlertLevel = "normal"
	AlertLevelAdvisory CanonicalAlertLevel = "advisory"
	AlertLevelCaution  CanonicalAlertLevel = "caution"
	AlertLevelWarning  CanonicalAlertLevel = "warning"
)

// AlertLifecycleRecord is the portable portion of an active application alert.
type AlertLifecycleRecord struct {
	ID           string `json:"id"`
	Level        string `json:"level"`
	Acknowledged bool   `json:"acknowledged"`
}

// AlertLifecycleError reports a stable portable validation code.
type AlertLifecycleError struct {
	Code    string
	Message string
}

func (err *AlertLifecycleError) Error() string { return err.Message }

var alertLevelAliases = map[string]CanonicalAlertLevel{
	"normal": AlertLevelNormal, "ok": AlertLevelNormal, "debug": AlertLevelNormal,
	"advisory": AlertLevelAdvisory, "info": AlertLevelAdvisory,
	"caution": AlertLevelCaution, "warning": AlertLevelWarning, "critical": AlertLevelWarning,
}

var canonicalAlertPriority = map[CanonicalAlertLevel]int{
	AlertLevelNormal: 0, AlertLevelAdvisory: 1, AlertLevelCaution: 2, AlertLevelWarning: 3,
}

// NormalizeAlertLevel normalizes a canonical level or supported application alias.
func NormalizeAlertLevel(level string) (CanonicalAlertLevel, error) {
	value, ok := alertLevelAliases[strings.ToLower(strings.TrimSpace(level))]
	if !ok {
		return "", &AlertLifecycleError{
			Code: "alert-level-invalid", Message: fmt.Sprintf("unsupported alert level: %s", level),
		}
	}
	return value, nil
}

// AlertPriority returns the portable ascending priority for a level.
func AlertPriority(level string) (int, error) {
	normalized, err := NormalizeAlertLevel(level)
	if err != nil {
		return 0, err
	}
	return canonicalAlertPriority[normalized], nil
}

// OrderAlerts returns a stable lifecycle-ordered copy.
func OrderAlerts(alerts []AlertLifecycleRecord) ([]AlertLifecycleRecord, error) {
	result := append([]AlertLifecycleRecord(nil), alerts...)
	priorities := make(map[int]int, len(result))
	for index, alert := range result {
		priority, err := AlertPriority(alert.Level)
		if err != nil {
			return nil, err
		}
		priorities[index] = priority
	}
	type rankedAlert struct {
		alert    AlertLifecycleRecord
		priority int
	}
	ranked := make([]rankedAlert, len(result))
	for index, alert := range result {
		ranked[index] = rankedAlert{alert: alert, priority: priorities[index]}
	}
	sort.SliceStable(ranked, func(left, right int) bool {
		if ranked[left].alert.Acknowledged != ranked[right].alert.Acknowledged {
			return !ranked[left].alert.Acknowledged
		}
		return ranked[left].priority > ranked[right].priority
	})
	for index := range ranked {
		result[index] = ranked[index].alert
	}
	return result, nil
}

// ReconcileAcknowledgements retains active acknowledgements once, in source order.
func ReconcileAcknowledgements(activeIDs, acknowledgedIDs []string) []string {
	active := make(map[string]struct{}, len(activeIDs))
	for _, id := range activeIDs {
		active[id] = struct{}{}
	}
	seen := make(map[string]struct{}, len(acknowledgedIDs))
	result := make([]string, 0, len(acknowledgedIDs))
	for _, id := range acknowledgedIDs {
		_, isActive := active[id]
		_, wasSeen := seen[id]
		if isActive && !wasSeen {
			result = append(result, id)
			seen[id] = struct{}{}
		}
	}
	return result
}

// HighestAlertLevel returns the highest severity in scope, or normal when empty.
func HighestAlertLevel(alerts []AlertLifecycleRecord, includeAcknowledged bool) (CanonicalAlertLevel, error) {
	highest := AlertLevelNormal
	highestPriority := canonicalAlertPriority[highest]
	for _, alert := range alerts {
		level, err := NormalizeAlertLevel(alert.Level)
		if err != nil {
			return "", err
		}
		if !includeAcknowledged && alert.Acknowledged {
			continue
		}
		if priority := canonicalAlertPriority[level]; priority > highestPriority {
			highest, highestPriority = level, priority
		}
	}
	return highest, nil
}
