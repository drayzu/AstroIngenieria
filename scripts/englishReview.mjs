// Human-reviewed scientific copy. Slot numbers refer to the extracted authoring
// strings, not DOM positions. Formula coverage is checked against the originals.
export const reviewedArticleCopy = {
  alcubierre: {
    9: 'The quiet interior hides concentrated gradients around it. Components of the metric change there, and the energy–momentum tensor required by Einstein’s equations appears. In the original formulation, suitable observers find negative energy densities in parts of the wall, violating classical energy conditions. [1]',
  },
  antimatter: {
    1: 'Matter and antimatter can convert their mass into other particles. Producing, storing and harnessing that encounter is much harder than writing E = mc².',
    14: 'The relationship between mass and energy explains the fascination. If one gram of antimatter annihilated with one gram of matter, the total mass energy would be approximately 1.8 × 10¹⁴ joules. This is an ideal equivalence calculated using E = mc²; it does not say how much energy an engine could direct, or demonstrate that we can store that amount.',
    24: 'Shielding between the reaction, storage tank and payload absorbs reaction products and heats up. Radiators reject that energy. Magnets, cryogenic systems, vacuum pumps and electrical conversion add mass that E = mc² does not show. The rocket equation still relates exhaust velocity, propellant and change in velocity; a concentrated source does not remove the need to accelerate mass or radiation in the opposite direction. [2]',
  },
  'artificial-gravity': {
    14: 'The basic relationship is a = ω²r. Acceleration a is expressed in m/s², radius r in meters, and angular velocity ω in radians per second. To convert n revolutions per minute: ω = 2πn/60.',
    15: 'For approximately 9.81 m/s² at the floor, a radius of 100 m requires about 3 revolutions per minute; a radius of 1,000 m requires about 0.95. These values assume uniform rotation and do not assess comfort, structure or safety. Doubling the radius reduces the required angular velocity by a factor of the square root of two. [1]',
  },
  'bernal-sphere': {
    12: 'In a = ω²r, r is not always the radius of the sphere. It is the perpendicular distance to the rotation axis. On a sphere of radius R, at a latitude λ measured from the equator, that distance is R cos λ.',
  },
  'bishop-ring': {
    14: 'For an ideal thin ring supporting only its own mass, the characteristic stress scales as σ ≈ ρv². If a = v²/r, then σ ≈ ρar. At fixed acceleration and density, increasing the radius increases the required stress.',
  },
  'chemical-rockets': {
    15: 'The ideal equation is Δv = ve ln(m₀/mf), where ve is effective exhaust velocity, m₀ is initial mass and mf is final mass. For fixed ve, requiring more Δv increases the necessary mass ratio exponentially. The ideal calculation does not include all the losses of a real launch. [1]',
  },
  exoplanets: {
    16: 'In a simple approximation, the relative drop in brightness is (Rp/R★)². The calculation assumes a uniform disk and an uncomplicated transit; actual analysis accounts for the star’s nonuniform brightness and the geometry of the transit.',
  },
  'floating-venus': {
    11: 'The surrounding atmosphere provides CO₂ and compounds that could serve as raw materials after separation and processing. Breathable air needs oxygen and a buffer gas in safe proportions. Obtaining an element from the environment does not mean obtaining a ready mixture: filters, reactors, tanks and continuous analysis turn Venusian resources into usable products.',
    16: 'Static lift is approximated by F = (ρexterior − ρinterior)gV before subtracting the weight of the envelope and payload. Changing altitude changes densities and temperatures, so vertical control is part of the vehicle’s everyday operation.',
  },
  'habitable-zone': {
    13: 'Stellar energy per unit area decreases approximately as L/(4πr²). To maintain the same irradiation when luminosity L changes, distance r varies with its square root. This compares received light; it does not yet calculate surface temperature.',
  },
  'ion-engines': {
    14: 'If the useful jet power is approximately ½ṁve² and F ≈ ṁve, then F ≈ 2ηP/ve for electrical power P and efficiency η. With 1,000 W, η = 0.6 and ve = 30,000 m/s, the idealized result is 0.04 N. This is an example of a balance calculation, not a specification for Dawn.',
  },
  kardashev: {
    10: 'A common popular convention places the types at approximately 10¹⁶, 10²⁶ and 10³⁶ watts. Each step differs by a factor of ten billion. These are indicative orders of magnitude, not universal thresholds or predictions of consumption.',
    11: 'When interpolating between them, K = (log₁₀ P − 6) / 10 can be used, with P expressed in watts. This continuous scale comes from developments after the original classification. Assigning a decimal to a civilization does not automatically improve the quality of the data or turn that score into a measure of well-being.',
  },
  'launch-loop': {
    16: 'With constant acceleration and negligible initial velocity, L = v²/(2a). To reach 8,000 m/s at 3g, the ideal length is about 1,087 km. This is a kinematic example: it excludes the atmosphere, gravity along the trajectory, curvature and losses. It shows why these proposals require enormous distances.',
  },
  'mars-terraforming': {
    7: 'For an order-of-magnitude calculation, an atmosphere at one bar on Mars would require about 4 × 10¹⁸ kilograms of gas. This is obtained by multiplying pressure by the planet’s surface area and dividing by its surface gravity. The figure does not require a design to use one bar; it shows how an everyday pressure implies an extraordinary mass when extended across an entire world.',
  },
  'mass-driver': {
    13: 'A payload of mass m traveling at velocity v carries kinetic energy mv²/2 in the nonrelativistic regime. A receiver that wants to stop it must handle that energy and the associated momentum. Precise launching helps, but it does not make braking disappear.',
  },
  'mckendree-cylinder': {
    7: 'The apparent-weight equation, a = ω²r, allows slower rotation as r increases. But tangential velocity is v = ωr = √(ar), which increases. Slow rotation viewed from afar can coexist with enormous floor speeds relative to an outside observer. Low angular velocity does not mean low structural stress. [2]',
  },
  'microwave-power': {
    11: 'For an ideal circular aperture, the characteristic diffraction angle scales as θ ≈ 1.22 λ/D. At distance R, a transverse scale of the beam is Rθ. This is an optical approximation; an actual system includes beam profiles, turbulence, phase errors and other losses.',
  },
  'oneill-cylinder': {
    11: 'For an ideal cylinder with a radius of 4,000 m, a = ω²r gives an angular velocity of approximately 0.0495 rad/s for 9.81 m/s² at the floor. This is about 0.47 revolutions per minute: just over two minutes per revolution. It is an illustrative calculation of uniform rotation, not the specification of a project ready for construction.',
    12: 'The interior lateral area is A = 2πrL. If that cylinder is 32 km long, its lateral area is about 804 km². Windows, equipment and uninhabitable areas would occupy part of it; geometric area does not automatically mean available land or population capacity. Choosing dimensions also requires assessing structure, atmosphere, lighting and maintenance.',
  },
  radiators: {
    13: 'For an idealized surface radiating toward a much colder environment, P ≈ εσAT⁴. ε is emissivity, σ the Stefan–Boltzmann constant, A the emitting area, and T the absolute temperature in kelvin. An environment that also radiates requires accounting for the energy received.',
  },
  'relativistic-propulsion': {
    8: 'The factor is γ = 1/√(1 − v²/c²). During the uniform segment, Δτ = Δt/γ. Kinetic energy relative to that reference frame is K = (γ − 1)mc². These expressions describe motion and energy; they do not specify an engine capable of producing them.',
    10: 'For one tonne at 0.1c, kinetic energy is approximately 4.5 × 10¹⁷ joules. The calculation uses only the final mass and velocity. An actual mission adds inefficiencies, system mass, possible propellant reserves and the problem of braking. The complete budget can be much larger.',
  },
  ringworld: {
    7: 'Rotation provides the acceleration that makes occupants feel weight against the floor. The basic relationship is a = v²/R: the larger the radius for the same acceleration, the higher the required tangential velocity. The physics of artificial gravity explains the principle, but applying it to a ring around a star creates extreme demands. [2]',
    11: 'In an ideal thin ring loaded mainly by its own rotation, specific stress scales as v², or aR. Maintaining the same gravity while increasing the radius requires ever greater strength per unit density. Loads such as terrain, air and water complicate the design further.',
  },
  'stanford-torus': {
    14: 'For a fixed target acceleration, ω = √(a/r). Increasing the radius allows slower rotation. This can reduce certain Coriolis effects and weight gradients, although human comfort also depends on activities and adaptation. A larger radius brings construction and control requirements of its own. [2]',
  },
  'stellar-engines': {
    9: 'The relationship a = F/M remains revealing. A star’s mass means that a force impressive in human terms produces a very small change per second. The interest lies in sustaining it over astronomical timescales.',
    10: 'As a purely kinematic example, a constant acceleration of 10⁻¹² m/s² would accumulate about thirty meters per second of velocity change in a million years. The deviation from an idealized initial trajectory would be hundreds of astronomical units. The example uses a·t and a·t²/2; an actual galactic trajectory must include the gravitational field and the changing direction of thrust.',
  },
  'stellar-physics': {
    14: 'In a spherical description, dP/dr = −Gm(r)ρ(r)/r². Pressure decreases outward at a rate related to the enclosed mass and density. This equation combines with others describing energy and composition to describe a star; on its own it does not determine the star’s evolution.',
  },
  'stellar-navigation': {
    6: 'The light we observe is also old. A star a hundred light years away is seen as it was a century ago; a model updates its trajectory to the estimated present and then into the future. The destination appears as a distribution narrowed by new measurements, rather than an exact point.',
  },
  sunshades: {
    18: 'A planet intercepts light over an approximate area πR². Reducing irradiation by a fraction f changes incoming power by approximately fSπR², before accounting for reflection and atmospheric response. The formula establishes the scale of the intervention; on its own it does not predict rainfall or the temperature of each region.',
    20: 'The sunshade changes incoming energy; it does not remove greenhouse gases, correct acidification or create water. On Venus it could be an initial cooling stage, but pressure, carbon and surface chemistry would remain to be addressed. On Earth it could offset part of the radiative warming while other consequences of CO₂ persist.',
  },
  'venus-terraforming': {
    17: 'Nitrogen and minor gases are also more than details. A breathable atmosphere is defined by partial pressures, toxicity and chemical stability. Reducing CO₂ to a certain pressure may reveal that other components are missing or present in excess. The goal “one bar” does not specify what a person breathes or how the climate behaves.',
  },
  'reusable-launch': {
    14: 'The data determine the scope of inspection. Pressures, vibration and temperatures identify components that operated outside their intended range. Cameras and nondestructive tests look for erosion, cracks and deformation. Some components are reused as they are; others have limited lifetimes or are replaced on every flight.',
  },
  terraforming: {
    9: 'As an estimate, the mass of an atmosphere is M ≈ 4πR²p/g, with planetary radius R, surface pressure p and gravity g. This follows from distributing the weight of the gas across the surface. The expression estimates the required inventories; it does not say how to obtain them or guarantee a stable climate.',
  },
  'tipo-i': {
    14: 'A watt measures joules per second. Maintaining power P over an interval t implies energy E = Pt. A civilization sustaining 10¹⁶ W for a day transforms approximately 8.64 × 10²⁰ J; the same power sustained for a second tells a very different story.',
  },
  'colonizacion-galactica': {
    25: 'Let us return to the first arrival. After decades of work, a workshop capable of building most of another spacecraft lights up on an airless hillside. In a nearby room, people debate whether to build it. One person points to the star that will pass closest in one hundred and twenty years; another shows the ecosystem discovered beneath the ice at the proposed destination. The galaxy does not expand at that instant. A decision remains open. Only when many similar scenes end in a departure does the frontier that seemed inevitable on the map appear from afar.',
  },
  astroingenieria: {
    1: 'Between an orbital station and a civilization that transforms stars lies a shared question: which parts of our environment could we learn to build?',
    3: 'Astroengineering begins at that edge. It asks what happens when the ability to modify the environment leaves a planet’s surface. At first, there are antennas, laboratories and storage facilities. Farther into the imagination appear cities built inside rotating structures, networks of collectors around a star, or instruments capable of altering trajectories on scales that are hard to grasp.',
    5: 'Changing direction to find solid ground',
    12: 'An illustration can show a perfect ring and hide almost all its difficulty. The mass must reach a suitable orbit. Joints must withstand loads. The energy used ends up producing heat that must be removed. The air needs a strong boundary between pressure and vacuum. If a component fails, someone or something must be able to find and replace it.',
    16: 'An isolated spacecraft can carry all its supplies. A permanent population introduces warehouses, workshops, routes and reserves. The difference resembles that between an expedition and a city, although space adds much more demanding conditions. An orbital depot, for example, changes the fuel needs of the spacecraft that use it; those spacecraft can, in turn, help build new facilities.',
  },
};

// Reviewed word senses in their original paragraphs. Inertia and magnetic
// moments retain "moment"; jet exhaust is distinct from planetary escape speed;
// geological deposits retain "deposits" rather than becoming tanks or depots.
const momentumSlots = {
  'beamed-propulsion': [23], caplan: [29], 'chemical-rockets': [1],
  'dyson-bubble': [2, 9], 'electric-sail': [7], 'hall-thruster': [6],
  'launch-loop': [5], 'magnetic-sail': [14], 'mass-driver': [18],
  'microwave-power': [13], 'orbital-ring': [8], reactionless: [16, 18, 19],
  'solar-electric': [21], 'stellar-technosignatures': [26], tethers: [19, 24],
};
const exhaustSlots = {
  'chemical-rockets': [23], 'interstellar-braking': [13], 'ion-engines': [20],
  'nuclear-thermal': [12], 'solar-electric': [6],
};
const destinationSlots = {
  antimatter: [25], 'asteroid-mining': [17, 19], 'bussard-ramjet': [18],
  'colonizacion-galactica': [2], 'deep-time': [9], 'interstellar-braking': [21],
  'magnetic-sail': [20], 'project-orion': [19], 'relativistic-propulsion': [15],
  'stellar-navigation': [6, 8], worldship: [9, 27],
};
const storageSlots = {
  'asteroid-mining': { 20: 'depots', 21: 'depots' },
  'chemical-rockets': { 1: 'tanks', 4: 'tanks', 13: 'tanks', 18: 'tanks' },
  'floating-venus': { 11: 'tanks' }, 'fuel-depots': { 11: 'depots' },
  'fusion-propulsion': { 19: 'tanks' }, 'life-support': { 2: 'tanks' },
  'nuclear-thermal': { 3: 'tanks', 12: 'tanks', 19: 'tanks' },
  paraterraforming: { 11: 'tanks' }, 'plasma-processing': { 20: 'tanks', 26: 'tanks' },
  'stellar-husbandry': { 11: 'storage reserves' }, 'stellar-physics': { 16: 'fuel reservoirs' },
};
export function reviewArticleTerminology(id, index, text) {
  if (momentumSlots[id]?.includes(index)) text = text.replace(/\bmoment\b/gi, 'momentum');
  if (exhaustSlots[id]?.includes(index)) text = text.replace(/speed of escape|escape speed/gi, 'exhaust velocity');
  if (destinationSlots[id]?.includes(index)) text = text.replace(/\bfate\b/gi, word => word[0] === 'F' ? 'The destination' : 'the destination')
    .replace('stopping the destination', 'braking at the destination').replace('slow down the destination', 'brake at the destination').replace('in the destination', 'at the destination');
  if (storageSlots[id]?.[index]) text = text.replace(/\bdeposits\b/gi, storageSlots[id][index]);
  if (id === 'volatile-import' && index === 14) text = text.replace('at a deposit', 'at a depot');
  if (id === 'matrioshka-brain' && index === 8) text = text.replace('thermal deposits', 'heat reservoirs');
  if (id === 'chemical-rockets' && index === 22) text = text.replace('The chemist', 'Chemical propulsion');
  if (id === 'berserker' && index === 21) text = text.replace('classify it as white', 'classify it as a target');
  return text;
}
