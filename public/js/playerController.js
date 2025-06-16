// public/js/playerController.js

export const PlayerController = (() => {
    const keyState = {};
    const player = {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        acceleration: 3000, // Force applied when moving
        damping: 0.98, // Damping factor to simulate friction
        maxSpeed: 400 // Maximum speed clamp
    };

    function onKeyDown(event) {
        keyState[event.code] = true;
    }

    function onKeyUp(event) {
        keyState[event.code] = false;
    }

    return {
        init: () => {
            window.addEventListener('keydown', onKeyDown);
            window.addEventListener('keyup', onKeyUp);
            // Reset state
            player.position = { x: 0, y: 0 };
            player.velocity = { x: 0, y: 0 };
            for (const key in keyState) {
                delete keyState[key];
            }
        },

        getPlayer: () => player,

        update: (deltaTime) => {
            const moveDirection = { x: 0, y: 0 };

            if (keyState['KeyW'] || keyState['ArrowUp']) {
                moveDirection.y = -1;
            }
            if (keyState['KeyS'] || keyState['ArrowDown']) {
                moveDirection.y = 1;
            }
            if (keyState['KeyA'] || keyState['ArrowLeft']) {
                moveDirection.x = -1;
            }
            if (keyState['KeyD'] || keyState['ArrowRight']) {
                moveDirection.x = 1;
            }

            // Normalize direction to prevent faster diagonal movement
            const length = Math.sqrt(moveDirection.x * moveDirection.x + moveDirection.y * moveDirection.y);
            if (length > 0) {
                moveDirection.x /= length;
                moveDirection.y /= length;
            }

            // Apply acceleration based on input
            player.velocity.x += moveDirection.x * player.acceleration * deltaTime;
            player.velocity.y += moveDirection.y * player.acceleration * deltaTime;

            // Apply frame-rate independent damping
            player.velocity.x *= Math.pow(player.damping, deltaTime * 60);
            player.velocity.y *= Math.pow(player.damping, deltaTime * 60);
            
            // Clamp to max speed
            const speed = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.y * player.velocity.y);
            if (speed > player.maxSpeed) {
                player.velocity.x = (player.velocity.x / speed) * player.maxSpeed;
                player.velocity.y = (player.velocity.y / speed) * player.maxSpeed;
            }

            // The renderer will update the mesh position based on this velocity
        },

        dispose: () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        }
    };
})();
