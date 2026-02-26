package sharedsdk

import (
	"fmt"
)

// EngineAlertRule defines a rule for triggering engine-related alerts.
type EngineAlertRule struct {
	Name        string
	AlertType   AlertType
	Description string
	Threshold   EngineThreshold
}

// EngineThreshold defines the threshold values for engine alerts.
type EngineThreshold struct {
	MinValue float64
	MaxValue float64
	Unit     string
}

// EngineAlertRules contains all engine alert rules.
var EngineAlertRules = []EngineAlertRule{
	{
		Name:        "HighEngineTemperature",
		AlertType:   EngineAlert,
		Description: "Engine temperature exceeds maximum operating limit",
		Threshold: EngineThreshold{
			MinValue: 0,
			MaxValue: 250, // Celsius
			Unit:     "°C",
		},
	},
	{
		Name:        "LowEngineTemperature",
		AlertType:   EngineAlert,
		Description: "Engine temperature below minimum operating limit",
		Threshold: EngineThreshold{
			MinValue: 40, // Celsius
			MaxValue: 300,
			Unit:     "°C",
		},
	},
	{
		Name:        "HighOilTemperature",
		AlertType:   OilAlert,
		Description: "Oil temperature exceeds maximum operating limit",
		Threshold: EngineThreshold{
			MinValue: 0,
			MaxValue: 120, // Celsius
			Unit:     "°C",
		},
	},
	{
		Name:        "LowOilPressure",
		AlertType:   OilAlert,
		Description: "Oil pressure below minimum operating limit",
		Threshold: EngineThreshold{
			MinValue: 25, // PSI
			MaxValue: 100,
			Unit:     "PSI",
		},
	},
	{
		Name:        "HighOilPressure",
		AlertType:   OilAlert,
		Description: "Oil pressure exceeds maximum operating limit",
		Threshold: EngineThreshold{
			MinValue: 0,
			MaxValue: 100, // PSI
			Unit:     "PSI",
		},
	},
}

// FuelAlertRules contains all fuel alert rules.
var FuelAlertRules = []EngineAlertRule{
	{
		Name:        "LowFuelLevel",
		AlertType:   FuelAlert,
		Description: "Fuel level below minimum safe operating level",
		Threshold: EngineThreshold{
			MinValue: 0,
			MaxValue: 10, // Gallons
			Unit:     "gal",
		},
	},
	{
		Name:        "CriticalFuelLevel",
		AlertType:   FuelAlert,
		Description: "Fuel level critically low - immediate landing required",
		Threshold: EngineThreshold{
			MinValue: 0,
			MaxValue: 5, // Gallons
			Unit:     "gal",
		},
	},
	{
		Name:        "FuelImbalance",
		AlertType:   FuelAlert,
		Description: "Fuel imbalance between tanks exceeds limits",
		Threshold: EngineThreshold{
			MinValue: 0,
			MaxValue: 5, // Gallons difference
			Unit:     "gal",
		},
	},
}

// ElectricalAlertRules contains all electrical system alert rules.
var ElectricalAlertRules = []EngineAlertRule{
	{
		Name:        "LowBatteryVoltage",
		AlertType:   ElectricalAlert,
		Description: "Battery voltage below minimum operating limit",
		Threshold: EngineThreshold{
			MinValue: 10, // Volts
			MaxValue: 16,
			Unit:     "V",
		},
	},
	{
		Name:        "HighBatteryVoltage",
		AlertType:   ElectricalAlert,
		Description: "Battery voltage exceeds maximum operating limit",
		Threshold: EngineThreshold{
			MinValue: 0,
			MaxValue: 16, // Volts
			Unit:     "V",
		},
	},
	{
		Name:        "AlternatorFailure",
		AlertType:   ElectricalAlert,
		Description: "Alternator output below minimum required",
		Threshold: EngineThreshold{
			MinValue: 0,
			MaxValue: 60, // Amps
			Unit:     "A",
		},
	},
}

// CheckEngineAlert evaluates if an engine parameter triggers an alert.
func CheckEngineAlert(ruleName string, value float64) (bool, string) {
	for _, rule := range EngineAlertRules {
		if rule.Name == ruleName {
			if value > rule.Threshold.MaxValue || value < rule.Threshold.MinValue {
				return true, fmt.Sprintf("%s: %.1f %s", rule.Description, value, rule.Threshold.Unit)
			}
		}
	}
	return false, ""
}

// CheckFuelAlert evaluates if a fuel parameter triggers an alert.
func CheckFuelAlert(ruleName string, value float64) (bool, string) {
	for _, rule := range FuelAlertRules {
		if rule.Name == ruleName {
			if value > rule.Threshold.MaxValue || value < rule.Threshold.MinValue {
				return true, fmt.Sprintf("%s: %.1f %s", rule.Description, value, rule.Threshold.Unit)
			}
		}
	}
	return false, ""
}

// CheckElectricalAlert evaluates if an electrical parameter triggers an alert.
func CheckElectricalAlert(ruleName string, value float64) (bool, string) {
	for _, rule := range ElectricalAlertRules {
		if rule.Name == ruleName {
			if value > rule.Threshold.MaxValue || value < rule.Threshold.MinValue {
				return true, fmt.Sprintf("%s: %.1f %s", rule.Description, value, rule.Threshold.Unit)
			}
		}
	}
	return false, ""
}
