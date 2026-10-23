package sharedsdk

import "testing"

func TestCheckEngineAlert(t *testing.T) {
    tests := []struct {
        name      string
        ruleName  string
        value     float64
        wantAlert bool
    }{
        {"HighEngineTemperature", "HighEngineTemperature", 260, true},
        {"LowEngineTemperature", "LowEngineTemperature", 30, true},
        {"NormalEngineTemperature", "HighEngineTemperature", 240, false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            gotAlert, _ := CheckEngineAlert(tt.ruleName, tt.value)
            if gotAlert != tt.wantAlert {
                t.Errorf("CheckEngineAlert() = %v, want %v", gotAlert, tt.wantAlert)
            }
        })
    }
}

func TestCheckFuelAlert(t *testing.T) {
    tests := []struct {
        name      string
        ruleName  string
        value     float64
        wantAlert bool
    }{
        {"LowFuelLevel", "LowFuelLevel", 5, true},
        {"CriticalFuelLevel", "CriticalFuelLevel", 4, true},
        {"NormalFuelLevel", "LowFuelLevel", 15, false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            gotAlert, _ := CheckFuelAlert(tt.ruleName, tt.value)
            if gotAlert != tt.wantAlert {
                t.Errorf("CheckFuelAlert() = %v, want %v", gotAlert, tt.wantAlert)
            }
        })
    }
}

func TestCheckElectricalAlert(t *testing.T) {
    tests := []struct {
        name      string
        ruleName  string
        value     float64
        wantAlert bool
    }{
        {"LowBatteryVoltage", "LowBatteryVoltage", 9, true},
        {"HighBatteryVoltage", "HighBatteryVoltage", 17, true},
        {"NormalBatteryVoltage", "LowBatteryVoltage", 12, false},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            gotAlert, _ := CheckElectricalAlert(tt.ruleName, tt.value)
            if gotAlert != tt.wantAlert {
                t.Errorf("CheckElectricalAlert() = %v, want %v", gotAlert, tt.wantAlert)
            }
        })
    }
}
