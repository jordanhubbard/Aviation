export class VORReceiver {
    constructor() {}
    getRadial() { return { radial: 0 }; }
    getCDIDeviation() { return { deviation: 0 }; }
    getToFromFlag() { return { toFrom: 'TO' as const }; }
}

export class ILSReceiver {
    constructor() {}
    getLocalizerDeviation() { return { deviation: 0 }; }
    getGlideslopeDeviation() { return { deviation: 0 }; }
}

export class ADFReceiver {
    constructor() {}
    getBearing() { return { bearing: 0 }; }
}

export class DMEReceiver {
    constructor() {}
    getDistance() { return { distance: 0 }; }
    getGroundspeed() { return { groundspeed: 0 }; }
    getTimeToStation() { return { timeToStation: 0 }; }
}
