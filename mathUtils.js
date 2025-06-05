// mathUtils.js

// --- MATH HELPER FUNCTIONS (QUATERNIONS) ---

/**
 * @returns {Array<number>} Identity quaternion [w, x, y, z]
 */
function quat_identity() {
  return [1, 0, 0, 0];
}

/**
 * Creates a quaternion from an axis and an angle.
 * @param {Array<number>} axis - The axis of rotation [x, y, z].
 * @param {number} angle - The angle of rotation in radians.
 * @returns {Array<number>} The resulting quaternion [w, x, y, z].
 */
function quat_from_axis_angle(axis, angle) {
  const hA = angle * 0.5;
  const s = Math.sin(hA);
  return [Math.cos(hA), axis[0] * s, axis[1] * s, axis[2] * s];
}

/**
 * Multiplies two quaternions.
 * @param {Array<number>} q1 - The first quaternion [w1, x1, y1, z1].
 * @param {Array<number>} q2 - The second quaternion [w2, x2, y2, z2].
 * @returns {Array<number>} The resulting quaternion product.
 */
function quat_multiply(q1, q2) {
  const w1 = q1[0], x1 = q1[1], y1 = q1[2], z1 = q1[3];
  // Corrected: q2[2] for y2 instead of q2[1]
  const w2 = q2[0], x2 = q2[1], y2 = q2[2], z2 = q2[3];

  return [
    w1 * w2 - x1 * x2 - y1 * y2 - z1 * z2,        // w
    w1 * x2 + x1 * w2 + y1 * z2 - z1 * y2,        // x
    w1 * y2 - x1 * z2 + y1 * w2 + z1 * x2,        // y
    w1 * z2 + x1 * y2 - y1 * x2 + z1 * w2         // z
  ];
}

/**
 * Normalizes a quaternion.
 * @param {Array<number>} q - The quaternion to normalize [w, x, y, z].
 * @returns {Array<number>} The normalized quaternion.
 */
function quat_normalize(q) {
  let l = q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3];
  if (l === 0) {
    return [1, 0, 0, 0]; // Return identity if magnitude is zero
  }
  l = 1 / Math.sqrt(l);
  return [q[0] * l, q[1] * l, q[2] * l, q[3] * l];
}

// --- END MATH HELPER FUNCTIONS (QUATERNIONS) ---
