// public/js/utils.js

const MAX_PLACEMENT_ATTEMPTS = 150;

function checkOverlap(rect1, rect2) {
    return !(
        rect1.x + rect1.width < rect2.x ||
        rect2.x + rect2.width < rect1.x ||
        rect1.y + rect1.height < rect2.y ||
        rect2.y + rect2.height < rect1.y
    );
}

export function getNonOverlappingPositionInCircle(circleRadius, objectDiameter, existingRects) {
    let placementRadius = circleRadius - (objectDiameter / 2) - 5;
    if (placementRadius < 0) placementRadius = 0;

    for (let i = 0; i < MAX_PLACEMENT_ATTEMPTS; i++) {
        const angle = Math.random() * 2 * Math.PI;
        const r = Math.sqrt(Math.random()) * placementRadius;
        const centerX = circleRadius + r * Math.cos(angle);
        const centerY = circleRadius + r * Math.sin(angle);
        const x = centerX - (objectDiameter / 2);
        const y = centerY - (objectDiameter / 2);
        const newRect = { x, y, width: objectDiameter, height: objectDiameter };
        if (!existingRects.some(existingRect => checkOverlap(newRect, existingRect))) {
            return { x, y };
        }
    }
    console.warn(`getNonOverlappingPositionInCircle: Could not find non-overlapping position after ${MAX_PLACEMENT_ATTEMPTS} attempts.`);
    return null;
}

export function getDistance(system1, system2) {
    return Math.sqrt(Math.pow(system1.centerX - system2.centerX, 2) + Math.pow(system1.centerY - system2.centerY, 2));
}
