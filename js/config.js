// js/config.js

// Planet Generation Defaults
export const DEFAULT_MIN_TERRAIN_HEIGHT = 0.0;
export const DEFAULT_MAX_TERRAIN_HEIGHT = 10.0;
export const DEFAULT_OCEAN_HEIGHT_LEVEL = 2.0;

// Universe/Galaxy/Solar System Generation Defaults
export const DEFAULT_NUM_GALAXIES = 3;
export const DEFAULT_MIN_SS_COUNT_CONST = 200;
export const DEFAULT_MAX_SS_COUNT_CONST = 300;
export const DEFAULT_MAX_PLANET_DISTANCE_MULTIPLIER = 1.0;
export const DEFAULT_MIN_PLANETS_PER_SYSTEM = 0;
export const DEFAULT_MAX_PLANETS_PER_SYSTEM = 3;
export const DEFAULT_SHOW_PLANET_ORBITS = false;
export const DEFAULT_PLANET_AXIAL_SPEED = 0.01; // Base axial rotation speed for planets

// Scaling and UI Constants
export const GALAXY_ICON_SIZE = 60;
export const SOLAR_SYSTEM_BASE_ICON_SIZE = 2.5;
export const SUN_ICON_SIZE = 60;
export const BASE_MAX_PLANET_DISTANCE_FACTOR = 25; // Used to calculate MAX_PLANET_DISTANCE
export const MIN_PLANET_SIZE = 5;
export const MAX_PLANET_SIZE = 15;
export const MIN_ORBITAL_SEPARATION = 20;

// Generation Constraints
export const MAX_PLACEMENT_ATTEMPTS = 150;
export const MAX_CONNECTIONS_PER_SYSTEM = 3;
export const MAX_NEIGHBOR_CANDIDATES_FOR_ADDITIONAL_CONNECTIONS = 5;
export const MAX_EUCLIDEAN_CONNECTION_DISTANCE_PERCENT = 0.07; // e.g., 7% of galaxy diameter
export const MAX_FORCED_CONNECTION_DISTANCE_PERCENT = 0.20; // e.g., 20% of galaxy diameter

// UI View Constants
export const GALAXY_VIEW_MIN_ZOOM = 1.0;
export const GALAXY_VIEW_MAX_ZOOM = 5.0;
export const SOLAR_SYSTEM_VIEW_MIN_ZOOM = 0.05;
export const SOLAR_SYSTEM_VIEW_MAX_ZOOM = 10.0;
export const ZOOM_STEP = 0.2;
export const PLANET_ROTATION_SENSITIVITY = 0.75; // For interactive 3D planet rotation

// Color Schemes
export const FIXED_COLORS = {
    universeBg: "#100520",
    galaxyIconFill: "#7f00ff",
    galaxyIconBorder: "#da70d6",
    solarSystemBaseColor: "#ffd700",
    sunFill: "#FFD700",
    sunBorder: "#FFA500",
    connectionLine: "rgba(255, 255, 255, 0.3)"
};

// Planet orbital speed range (rad per Perlin unit - effectively controlling max angular speed)
export const MIN_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.005;
export const MAX_ROTATION_SPEED_RAD_PER_PERLIN_UNIT = 0.01;
