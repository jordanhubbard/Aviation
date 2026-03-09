package sharedsdk

type AlertType int

const (
	EngineFire AlertType = iota
	StallWarning
	TerrainAlert
	TrafficAlert
	LowFuel
	EngineTemperatureHigh
	EngineTemperatureLow
	EnginePressureHigh
	EnginePressureLow
	ElectricalSystemWarning
	GPSSignalLoss
	RAIMFailure
	AltitudeAlertApproaching
	AutopilotDisconnect
	GlideSlopeDeviation
	LocalizerDeviation
	CrossTrackError
	HeadingBugAlert
	AltitudeBugAlert
	NextWaypointAlert
	SystemStatusMessage
	NavigationModeChange
	FlightPlanActivated
	ApproachModeEngaged
	AutopilotEngaged
	AutopilotDisengaged
	WeatherAlert
	WindShearAlert
	MicroburstAlert
	LightningAlert
	TurbulenceAlert
	AirspaceViolationWarning
	RestrictionZoneAlert
	DensityAltitudeAlert
	PerformanceDegradation
	InformationalUpdate
	SystemFailure
	FuelAlert
	OilAlert
	ElectricalAlert
)
