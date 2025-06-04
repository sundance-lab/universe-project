// js/utils/math_utils.js

export function quat_identity() { return [1, 0, 0, 0]; }

export function quat_from_axis_angle(axis, angle) {
    const hA = angle * 0.5;
    const s = Math.sin(hA);
    return [Math.cos(hA), axis[0] * s, axis[1] * s, axis[2] * s];
}

export function quat_multiply(q1, q2) {
    const w1 = q1[0], x1 = q1[1], y1 = q1[2], z1 = q1[3];
    const w2 = q2[0], x2 = q2[1], y2 = q2[2], z2 = q2[3];
    return [
        w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,
        w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,
        w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,
        w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2
    ];
}

export function quat_normalize(q) {
    let l = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
    if (l === 0) return [1, 0, 0, 0]; // Return identity if zero length
    l = 1 / Math.sqrt(l);
    return [q[0] * l, q[1] * l, q[2] * l, q[3] * l];
}

export function getDistance(s1, s2) {
    return Math.sqrt(Math.pow(s1.centerX - s2.centerX, 2) + Math.pow(s1.centerY - s2.centerY, 2));
}

export function checkOverlap(r1, r2) {
    return !(r1.x + r1.width < r2.x ||
             r2.x + r2.width < r1.x ||
             r1.y + r1.height < r2.y ||
             r2.y + r2.height < r1.y);
}
