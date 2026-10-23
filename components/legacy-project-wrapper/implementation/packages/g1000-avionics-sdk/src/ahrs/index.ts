export class AHRS {
    constructor() {}
    getPitchAndRoll() { return { pitch: 0, roll: 0 }; }
    getYaw() { return { yaw: 0 }; }
    getTurnRate() { return { turnRate: 0 }; }
    getSlipSkid() { return { slipSkid: 0 }; }
    getMagneticHeading() { return { heading: 0, variation: 0 }; }
}

export class ADC {
    constructor() {}
    getIndicatedAirspeed() { return { ias: 0 }; }
    getTrueAirspeed() { return { tas: 0 }; }
    getMachNumber() { return { mach: 0 }; }
    getPressureAltitude() { return { pressureAlt: 0 }; }
    getDensityAltitude() { return { densityAlt: 0 }; }
    getVerticalSpeed() { return { vs: 0 }; }
    getOutsideAirTemperature() { return { oat: 0 }; }
}
