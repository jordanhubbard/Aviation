"""Aircraft model configuration and characteristics."""

from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class MassProperties:
    """Aircraft mass and inertia properties."""
    empty_weight: float  # lbs
    max_gross_weight: float  # lbs
    cg_range_forward: float  # % MAC
    cg_range_aft: float  # % MAC
    ixx: float  # slug-ft^2 (roll inertia)
    iyy: float  # slug-ft^2 (pitch inertia)
    izz: float  # slug-ft^2 (yaw inertia)
    ixz: float  # slug-ft^2 (cross-coupling inertia)


@dataclass
class AerodynamicCoefficients:
    """Aerodynamic coefficients for the aircraft."""
    cl0: float  # Lift coefficient at zero angle of attack
    cla: float  # Lift coefficient slope (per radian)
    cd0: float  # Drag coefficient at zero lift
    cdi: float  # Induced drag coefficient
    cm0: float  # Pitching moment coefficient at zero alpha
    cma: float  # Pitching moment slope
    cn_beta: float  # Yaw coefficient due to sideslip
    cl_beta: float  # Roll coefficient due to sideslip


@dataclass
class EngineSpecification:
    """Engine specifications."""
    type: str  # 'piston', 'turboprop', 'jet'
    max_power: float  # hp (for piston) or lbf (for turbine)
    max_rpm: float
    fuel_consumption_rate: float  # gal/hr at max power
    propeller_diameter: float  # inches
    propeller_efficiency: float  # 0.0 to 1.0


class AircraftModel:
    """Aircraft model with configuration and characteristics."""

    def __init__(
        self,
        name: str,
        mass_properties: MassProperties,
        aerodynamic_coefficients: AerodynamicCoefficients,
        engine_spec: EngineSpecification,
        wing_area: float,  # sq ft
        wing_span: float,  # ft
        mean_aerodynamic_chord: float,  # ft
    ):
        self.name = name
        self.mass_properties = mass_properties
        self.aerodynamic_coefficients = aerodynamic_coefficients
        self.engine_spec = engine_spec
        self.wing_area = wing_area
        self.wing_span = wing_span
        self.mean_aerodynamic_chord = mean_aerodynamic_chord

    def get_configuration(self) -> Dict:
        """Get aircraft configuration as dictionary."""
        return {
            'name': self.name,
            'wing_area': self.wing_area,
            'wing_span': self.wing_span,
            'mac': self.mean_aerodynamic_chord,
            'empty_weight': self.mass_properties.empty_weight,
            'max_gross_weight': self.mass_properties.max_gross_weight,
            'engine_type': self.engine_spec.type,
            'max_power': self.engine_spec.max_power,
        }


# Predefined aircraft models
CESSNA_172 = AircraftModel(
    name='Cessna 172',
    mass_properties=MassProperties(
        empty_weight=1665,
        max_gross_weight=2450,
        cg_range_forward=35.0,
        cg_range_aft=40.0,
        ixx=948,
        iyy=1346,
        izz=1967,
        ixz=0,
    ),
    aerodynamic_coefficients=AerodynamicCoefficients(
        cl0=0.307,
        cla=0.109,
        cd0=0.027,
        cdi=0.041,
        cm0=-0.04,
        cma=-0.613,
        cn_beta=0.12,
        cl_beta=-0.12,
    ),
    engine_spec=EngineSpecification(
        type='piston',
        max_power=160,
        max_rpm=2700,
        fuel_consumption_rate=8.5,
        propeller_diameter=69,
        propeller_efficiency=0.85,
    ),
    wing_area=174,
    wing_span=36.0,
    mean_aerodynamic_chord=4.9,
)

CESSNA_182 = AircraftModel(
    name='Cessna 182',
    mass_properties=MassProperties(
        empty_weight=1960,
        max_gross_weight=2950,
        cg_range_forward=35.0,
        cg_range_aft=40.0,
        ixx=1346,
        iyy=1824,
        izz=2666,
        ixz=0,
    ),
    aerodynamic_coefficients=AerodynamicCoefficients(
        cl0=0.307,
        cla=0.109,
        cd0=0.027,
        cdi=0.041,
        cm0=-0.04,
        cma=-0.613,
        cn_beta=0.12,
        cl_beta=-0.12,
    ),
    engine_spec=EngineSpecification(
        type='piston',
        max_power=230,
        max_rpm=2700,
        fuel_consumption_rate=12.0,
        propeller_diameter=76,
        propeller_efficiency=0.85,
    ),
    wing_area=174,
    wing_span=36.0,
    mean_aerodynamic_chord=4.9,
)
