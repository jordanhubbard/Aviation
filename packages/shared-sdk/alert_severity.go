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
    FuelAlert
    OilAlert
    ElectricalAlert
    EngineAlert
    // FuelAlert represents a fuel-related alert.
    FuelAlert
    // OilAlert represents an oil-related alert.
    OilAlert
    // ElectricalAlert represents an electrical system alert.
    ElectricalAlert
)

// GetSeverity returns the severity level for a given alert type.
func GetSeverity(alertType AlertType) AlertSeverity {
    switch alertType {
    case SystemFailure:
    return Warning
case EngineAlert:
    return Caution
case FuelAlert:
    return Caution
case OilAlert:
    return Caution
case ElectricalAlert:
    return Caution
        return Warning
    case PerformanceDegradation:
        return Caution
    case InformationalUpdate:
        return Advisory
    case EngineAlert:
        return Warning
    case FuelAlert:
        return Caution
    case OilAlert:
        return Warning
    case ElectricalAlert:
        return Caution
    default:
        return Advisory
    }
}
