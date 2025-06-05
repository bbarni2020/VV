function bounceOffWalls(bullet, canvasWidth, canvasHeight, map) {
    if (map) {
        const mapCollision = map.checkBulletCollision(bullet);
        if (mapCollision) {
            return true;
        }
    }
    
    let bounced = false;
    
    if (bullet.position.x <= 0 || bullet.position.x >= canvasWidth) {
        bullet.velocity.x *= -1;
        bounced = true;
    }
    if (bullet.position.y <= 0 || bullet.position.y >= canvasHeight) {
        bullet.velocity.y *= -1;
        bounced = true;
    }
    
    if (bounced) {
        bullet.bounceCount++;
        bullet.hasBounced = true;
    }
    
    return bullet.bounceCount >= bullet.maxBounces;
}

export { bounceOffWalls };