// public/js/playerController.js

export const PlayerController = (() => {
    const keyState = {};
    const player = {
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        speed: 200, // Player movement speed
        damping: 0.90 // Slower damping for a bit of slide
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
            player.position = { x: 0, y: 0 };
            player.velocity = { x: 0, y: 0 };
        },

        getPlayer: () => player,

        update: (deltaTime) => {
            const acceleration = { x: 0, y: 0 };

            if (keyState['KeyW'] || keyState['ArrowUp']) {
                acceleration.y = -1;
            }
            if (keyState['KeyS'] || keyState['ArrowDown']) {
                acceleration.y = 1;
            }
            if (keyState['KeyA'] || keyState['ArrowLeft']) {
                acceleration.x = -1;
            }
            if (keyState['KeyD'] || keyState['ArrowRight']) {
                acceleration.x = 1;
            }

            // Apply acceleration
            player.velocity.x += acceleration.x * player.speed * deltaTime;
            player.velocity.y += acceleration.y * player.speed * deltaTime;

            // Apply damping (friction)
            player.velocity.x *= player.damping;
            player.velocity.y *= player.damping;

            // Update position
            player.position.x += player.velocity.x;
            player.position.y += player.velocity.y;
        },

        dispose: () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        }
    };
})();
