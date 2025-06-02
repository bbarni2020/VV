const input = (() => {
    const keys = {};

    window.addEventListener('keydown', (event) => {
        keys[event.code] = true;
    });

    window.addEventListener('keyup', (event) => {
        keys[event.code] = false;
    });

    const isKeyPressed = (key) => {
        return keys[key] === true;
    };

    return {
        isKeyPressed,
    };
})();

export default input;