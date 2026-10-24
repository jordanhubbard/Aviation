export function interpolateEnvelope(envelope, weight) {
  const rows = [...envelope].sort((a, b) => a.weight - b.weight);
  if (rows.length < 2 || weight < rows[0].weight || weight > rows.at(-1).weight) return null;
  for (let i = 0; i < rows.length - 1; i++) {
    const low = rows[i], high = rows[i + 1];
    if (weight < low.weight || weight > high.weight) continue;
    if (high.weight <= low.weight || low.forward > low.aft || high.forward > high.aft) return null;
    const ratio = (weight - low.weight) / (high.weight - low.weight);
    return { forward: low.forward + ratio * (high.forward - low.forward),
      aft: low.aft + ratio * (high.aft - low.aft) };
  }
  return null;
}

export function calculateLoad(profile, loading) {
  const values = [profile.emptyWeight, profile.emptyArm, profile.maxGross, profile.fuelArm,
    profile.fuelDensity, loading.fuelGallons, loading.fuelBurnGallons,
    ...profile.stations.map(station => station.arm), ...loading.stationWeights];
  if (values.some(value => !Number.isFinite(value)) || profile.emptyWeight <= 0 || profile.maxGross <= 0
    || profile.fuelDensity <= 0 || loading.fuelGallons < 0 || loading.fuelBurnGallons < 0
    || loading.fuelBurnGallons > loading.fuelGallons || loading.stationWeights.some(weight => weight < 0)
    || profile.stations.length !== loading.stationWeights.length) {
    throw new Error('Enter valid aircraft, station, and fuel values. Fuel burn cannot exceed fuel loaded.');
  }
  const baseWeight = profile.emptyWeight + loading.stationWeights.reduce((sum, weight) => sum + weight, 0);
  const baseMoment = profile.emptyWeight * profile.emptyArm
    + loading.stationWeights.reduce((sum, weight, index) => sum + weight * profile.stations[index].arm, 0);
  const condition = gallons => {
    const weight = baseWeight + gallons * profile.fuelDensity;
    const cg = (baseMoment + gallons * profile.fuelDensity * profile.fuelArm) / weight;
    const limits = interpolateEnvelope(profile.envelope, weight);
    const problems = [];
    if (weight > profile.maxGross) problems.push('Above maximum gross weight');
    if (!limits) problems.push('Weight outside entered CG envelope range');
    else if (cg < limits.forward || cg > limits.aft) problems.push('CG outside entered limits');
    return { weight, cg, limits, problems, withinLimits: problems.length === 0 };
  };
  return { takeoff: condition(loading.fuelGallons), landing: condition(loading.fuelGallons - loading.fuelBurnGallons) };
}
