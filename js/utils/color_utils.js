// js/utils/color_utils.js

export function hexToRgb(hex) {
    if (!hex || typeof hex !== 'string' || hex.length !== 7 || hex[0] !== '#') {
        console.warn("Invalid hex color format:", hex, "Using default black.");
        return { r: 0, g: 0, b: 0 };
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) {
        console.warn("Failed to parse hex color:", hex, "Using default black.");
        return { r: 0, g: 0, b: 0 };
    }
    return { r, g, b };
}

export function adjustColor(hex, amount) {
    let r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);

    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));

    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
