package sharedsdk

// AlertSeverity represents the severity level of an alert.
type AlertSeverity int

const (
    // Warning indicates a potential issue that requires attention but is not immediately critical.
    Warning AlertSeverity = iota
    // Caution signals a condition that could lead to a problem if not addressed.
    Caution
    // Advisory provides information that may be useful but does not require immediate action.
    Advisory
)

// AlertType represents different types of alerts.
type AlertType int

const (
    // SystemFailure represents a system failure alert.
    SystemFailure AlertType = iota
    // PerformanceDegradation represents a performance degradation alert.
    PerformanceDegradation
    // InformationalUpdate represents an informational update alert.
    InformationalUpdate
    // EngineAlert represents an engine-related alert.
    EngineAlert
    // FuelAlert represents a fuel-related alert.
    FuelAlert
    // OilAlert represents an oil-related alert.
    OilAlert
    // ElectricalAlert represents an electrical system alert.
    ElectricalAlert
    // TerrainAlert500ft represents terrain alert at 500ft (TAWS).
    TerrainAlert500ft
    // TerrainAlert300ft represents terrain alert at 300ft (TAWS).
    TerrainAlert300ft
    // TerrainAlert100ft represents terrain alert at 100ft (TAWS).
    TerrainAlert100ft
    // AltitudePreselect represents altitude preselect alert.
    AltitudePreselect
    // AltitudeCapture represents altitude capture alert.
    AltitudeCapture
    // AutopilotDisconnect represents autopilot disconnect alert.
    AutopilotDisconnect
    // StallWarning represents stall warning alert.
    StallWarning
    // OverspeedWarning represents overspeed warning alert.
    OverspeedWarning
    // GPSSignalLoss represents GPS signal loss alert.
    GPSSignalLoss
    // RAIMFailure represents RAIM failure alert.
    RAIMFailure
)

// GetSeverity returns the severity level for a given alert type.
func GetSeverity(alertType AlertType) AlertSeverity {
    switch alertType {
    case SystemFailure:
        return Warning
    case EngineAlert:
        return Warning
    case StallWarning:
        return Warning
    case OverspeedWarning:
        return Warning
    case TerrainAlert100ft:
        return Warning
    case TerrainAlert300ft:
        return Warning
    case AutopilotDisconnect:
        return Warning
    case FuelAlert:
        return Caution
    case OilAlert:
        return Caution
    case ElectricalAlert:
        return Caution
    case PerformanceDegradation:
        return Caution
    case TerrainAlert500ft:
        return Caution
    case AltitudePreselect:
        return Caution
    case GPSSignalLoss:
        return Caution
    case RAIMFailure:
        return Caution
    case InformationalUpdate:
        return Advisory
    case AltitudeCapture:
        return Advisory
    default:
        return Advisory
    }
}
