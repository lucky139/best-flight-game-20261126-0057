// Sky Courier: Ember Isles — tuning, missions and palette.
// One clear job: every number the game balances lives here, so the
// physics, world and renderer all read the same constants.

export const CONFIG = {
  // Canvas is laid out for 1280x720 and scales to the window.
  viewWidth: 1280,
  viewHeight: 720,
  horizonY: 300, // screen y of the horizon at the reference size
  focal: 520, // perspective focal length in pixels at the reference size

  // The Kestrel, a small single-prop courier plane.
  plane: {
    maxSpeed: 96, // m/s at full throttle
    cruiseSpeed: 62,
    minFlySpeed: 27, // below this the wing stops flying and she sinks
    accel: 14, // m/s^2 toward the throttle's target speed
    climbRate: 26, // m/s at full pull
    sinkRate: 9, // m/s at full push, plus stall sink
    rollRate: 1.9, // rad/s of bank at full stick
    maxBank: 1.05, // rad of bank
    turnRate: 0.55, // rad/s of heading change at full bank
    fuelBurnIdle: 0.16, // % per second
    fuelBurnFull: 0.85, // % per second at full throttle
    fuelCapacity: 100,
    damagePerClip: 14, // hitting a ring's rim
    damagePerScrape: 30, // brushing terrain
  },

  // The world the plane flies over.
  world: {
    seaLevel: 0,
    hillAmp: 26,
    mountainAmp: 210,
    mountainThreshold: 0.62, // noise above this grows peaks
    viewDistance: 1100, // m of terrain drawn ahead
    stripStepNear: 14,
    stripStepFar: 90,
  },

  rings: {
    radius: 15, // m, the hoop the plane must pass through
    scoreRadius: 12, // m from centre counts as clean
    spacing: 340, // m between rings along the course
    firstAt: 420, // m ahead of the start line
  },

  runways: {
    width: 26,
    length: 320,
    landSpeedMax: 58, // m/s, faster than this on touchdown is a crash
    landSinkMax: 7, // m/s of descent allowed at touchdown
    alignMax: 11, // m off centreline allowed
  },

  scoring: {
    ring: 100,
    ringSpeedBonus: 40, // extra when passing a ring fast
    landing: 250,
    miss: -25,
    timeBonusPerSecond: 4, // left on the clock at mission end
  },
};

// The three sorties. Each names its rings, its runways and its weather,
// so missions.js can run any of them from this table alone.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    blurb: 'Thread 12 sky rings over the Ember Isles. Fast and clean wins.',
    ringCount: 12,
    runways: [],
    fuelStart: 100,
    wind: 0.0,
    parSeconds: 150,
    goal: 'Fly through all 12 rings, then land on the home strip.',
  },
  {
    id: 'island-hop',
    name: 'Island Hop',
    blurb: 'Land on three island strips. Each touchdown refuels the Kestrel.',
    ringCount: 6,
    runways: [2600, 5400, 8200],
    fuelStart: 100,
    wind: 0.25,
    parSeconds: 300,
    goal: 'Land on all three island runways. Bonus rings pay 100 each.',
  },
  {
    id: 'storm-courier',
    name: 'Storm Courier',
    blurb: 'A cargo run in gusty weather with a tight fuel load. No mistakes.',
    ringCount: 8,
    runways: [6200],
    fuelStart: 72,
    wind: 1.0,
    parSeconds: 210,
    goal: 'Fly 8 rings through the gusts, then put her down on the far strip.',
  },
];

// One palette for sky, sea, land and the plane, so the whole game
// reads as a single painted style.
export const PALETTE = {
  skyTop: '#2f6fb4',
  skyMid: '#7fb2dd',
  skyHorizon: '#f6d9a8',
  sun: '#ffd98a',
  sunCore: '#fff3c4',
  seaDeep: '#14506e',
  seaShallow: '#2e7d9b',
  sand: '#d9c08a',
  grass: '#5d8f4a',
  grassDark: '#47703a',
  forest: '#2f5d33',
  rock: '#8a7f72',
  snow: '#e8eef2',
  cloud: '#ffffff',
  runway: '#3c4148',
  runwayLine: '#f2f2e8',
  ring: '#ffcf3f',
  ringGlow: '#ff9d2e',
  hudInk: '#f4f7fa',
  hudDim: '#b9cbd8',
  hudAmber: '#ffc53d',
  hudRed: '#ff5d4d',
  hudPanel: 'rgba(10, 26, 40, 0.62)',
  planeBody: '#e8543f',
  planeWing: '#f2ede2',
  planeTrim: '#274b63',
  planeGlass: '#9fd4e8',
};

export const PLANE_NAME = 'Kestrel';
export const GAME_NAME = 'Sky Courier';
export const GAME_SUBTITLE = 'Ember Isles';
