class Explosion {
    constructor(x, y) {
        this.position = { x: x, y: y };
        this.particles = [];
        this.lifetime = 30;
        this.age = 0;
        
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const speed = 2 + Math.random() * 3;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 2,
                life: 1.0
            });
        }
    }

    update() {
        this.age++;
        
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vx *= 0.9;
            particle.vy *= 0.9;
            particle.life = 1.0 - (this.age / this.lifetime);
            particle.size *= 0.95;
        });
        
        return this.age >= this.lifetime;
    }

    draw(ctx, cameraX = 0, cameraY = 0) {
        this.particles.forEach((particle, index) => {
            if (particle.life > 0) {
                const x = particle.x - cameraX;
                const y = particle.y - cameraY;
                
                const colors = ['#ff4444', '#ffaa00', '#ffff44', '#ffffff'];
                const colorIndex = (index + Math.floor(this.age / 3)) % colors.length;
                
                ctx.fillStyle = colors[colorIndex];
                ctx.globalAlpha = particle.life;
                
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(x, y, particle.size + 1, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = colors[colorIndex];
                ctx.beginPath();
                ctx.arc(x, y, particle.size, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.globalAlpha = 1.0;
            }
        });
    }
}

export default Explosion;
