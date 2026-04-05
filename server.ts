import express from 'express';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import http from 'http';
import path from 'path';

const PORT = 3000;
const WORLD_SIZE = 3000;
const TICK_RATE = 1000 / 30; // 30 FPS
const MAX_FOOD = 300;
const BASE_SPEED = 5;
const TURN_SPEED = 0.15;

interface Point { x: number; y: number; }

interface Player {
  id: string; name: string;
  x: number; y: number;
  angle: number; targetAngle: number;
  speed: number; radius: number;
  body: Point[]; score: number;
  color: string; state: 'playing' | 'dead' | 'spectating';
  deathReason?: string; invincible?: boolean;
  isBoosting?: boolean;
}

interface Food {
  id: string; x: number; y: number;
  value: number; radius: number; color: string;
}

const state = {
  players: new Map<string, Player>(),
  food: new Map<string, Food>(),
  leaderboard: [] as { name: string; score: number }[],
};

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
];

function randomColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }

function randomPosition(): Point {
  return { x: Math.floor(Math.random() * WORLD_SIZE), y: Math.floor(Math.random() * WORLD_SIZE) };
}

function spawnFood(count: number) {
  for (let i = 0; i < count; i++) {
    if (state.food.size >= MAX_FOOD) break;
    const pos = randomPosition();
    const id = Math.random().toString(36).substring(2, 9);
    const isBig = Math.random() > 0.9;
    state.food.set(id, {
      id, x: pos.x, y: pos.y,
      value: isBig ? 50 : 10, radius: isBig ? 8 : 4, color: randomColor(),
    });
  }
}

function resetPlayer(player: Player, name: string) {
  const startPos = randomPosition();
  const startAngle = Math.random() * Math.PI * 2;
  player.name = name; player.x = startPos.x; player.y = startPos.y;
  player.angle = startAngle; player.targetAngle = startAngle;
  player.speed = BASE_SPEED; player.radius = 12; player.body = [];
  for (let i = 0; i < 10; i++) {
    player.body.push({
      x: startPos.x - Math.cos(startAngle) * i * 5,
      y: startPos.y - Math.sin(startAngle) * i * 5
    });
  }
  player.score = 10; player.state = 'playing';
  player.color = randomColor(); player.deathReason = undefined;
}

function updateLeaderboard() {
  state.leaderboard = Array.from(state.players.values())
    .filter(p => p.state === 'playing')
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(p => ({ name: p.name, score: p.score }));
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  io.on('connection', (socket) => {
    state.players.set(socket.id, {
      id: socket.id, name: 'Guest',
      x: 0, y: 0, angle: 0, targetAngle: 0, speed: 0, radius: 10,
      body: [], score: 0, color: '#fff', state: 'spectating',
    });

    socket.emit('init', { id: socket.id, worldSize: WORLD_SIZE });

    socket.on('join', (name: string) => {
      const player = state.players.get(socket.id);
      if (player) resetPlayer(player, name || 'Snake');
    });

    socket.on('input', (data: { angle: number }) => {
      const player = state.players.get(socket.id);
      if (player && player.state === 'playing') player.targetAngle = data.angle;
    });

    socket.on('boost', (isBoosting: boolean) => {
      const player = state.players.get(socket.id);
      if (player && player.state === 'playing') player.isBoosting = isBoosting;
    });

    socket.on('admin:toggleInvincibility', () => {
      const player = state.players.get(socket.id);
      if (player) player.invincible = !player.invincible;
    });

    socket.on('admin:killPlayer', (targetId: string) => {
      const target = state.players.get(targetId);
      if (target && target.state === 'playing') {
        target.state = 'dead'; target.deathReason = 'Killed by Admin!';
        io.to(target.id).emit('gameOver', { score: target.score, reason: target.deathReason });
      }
    });

    socket.on('disconnect', () => {
      const player = state.players.get(socket.id);
      if (player && player.state === 'playing') {
        player.body.forEach((segment, index) => {
          if (index % 5 === 0) {
            const id = Math.random().toString(36).substring(2, 9);
            state.food.set(id, { id, x: segment.x, y: segment.y, value: 20, radius: 6, color: player.color });
          }
        });
      }
      state.players.delete(socket.id);
    });
  });

  setInterval(() => {
    const players = Array.from(state.players.values()).filter(p => p.state === 'playing');
    
    players.forEach(player => {
      let diff = player.targetAngle - player.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      
      if (Math.abs(diff) < TURN_SPEED) player.angle = player.targetAngle;
      else player.angle += Math.sign(diff) * TURN_SPEED;

      let currentSpeed = player.speed;
      if (player.isBoosting && player.score > 20) {
        currentSpeed = BASE_SPEED * 1.8;
        if (Math.random() < 0.3) {
          player.score -= 1;
          const tail = player.body[player.body.length - 1] || { x: player.x, y: player.y };
          const id = Math.random().toString(36).substring(2, 9);
          state.food.set(id, { id, x: tail.x, y: tail.y, value: 1, radius: 3, color: player.color });
        }
      }

      player.x += Math.cos(player.angle) * currentSpeed;
      player.y += Math.sin(player.angle) * currentSpeed;

      if (player.x < 0 || player.x > WORLD_SIZE || player.y < 0 || player.y > WORLD_SIZE) {
        if (player.invincible) {
          player.angle += Math.PI; player.targetAngle = player.angle;
          player.x = Math.max(0, Math.min(WORLD_SIZE, player.x));
          player.y = Math.max(0, Math.min(WORLD_SIZE, player.y));
        } else {
          player.state = 'dead'; player.deathReason = 'Hit the wall!'; return;
        }
      }

      player.body.unshift({ x: player.x, y: player.y });
      player.radius = 12 + Math.floor(player.score / 100);
      const targetLength = 20 + Math.floor(player.score / 10);
      if (player.body.length > targetLength) player.body.pop();

      for (const [id, food] of state.food.entries()) {
        if (Math.hypot(player.x - food.x, player.y - food.y) < player.radius + food.radius) {
          player.score += food.value; state.food.delete(id);
        }
      }
    });

    players.forEach(player => {
      if (player.state !== 'playing') return;
      for (const other of players) {
        if (other.state !== 'playing') continue;
        if (other.id === player.id) continue;
        const startIndex = 0;
        for (let i = startIndex; i < other.body.length; i += 3) {
          if (Math.hypot(player.x - other.body[i].x, player.y - other.body[i].y) < player.radius + other.radius * 0.8) {
            if (!player.invincible) {
              player.state = 'dead';
              player.deathReason = `Killed by ${other.name}!`;
              other.score += Math.floor(player.score / 2);
            }
            break;
          }
        }
        if (player.state === 'dead') break;
      }
    });

    players.forEach(player => {
      if (player.state === 'dead') {
        player.body.forEach((segment, index) => {
          if (index % 5 === 0) {
            const id = Math.random().toString(36).substring(2, 9);
            state.food.set(id, { id, x: segment.x, y: segment.y, value: 20, radius: 6, color: player.color });
          }
        });
        io.to(player.id).emit('gameOver', { score: player.score, reason: player.deathReason });
      }
    });

    if (state.food.size < MAX_FOOD / 2) spawnFood(10);
    updateLeaderboard();

    io.emit('state', {
      players: Array.from(state.players.values()).map(p => ({
        id: p.id, name: p.name, x: p.x, y: p.y, angle: p.angle,
        radius: p.radius, body: p.body, score: p.score,
        color: p.color, state: p.state, invincible: p.invincible,
      })),
      food: Array.from(state.food.values()),
      leaderboard: state.leaderboard,
    });
  }, TICK_RATE);

  spawnFood(MAX_FOOD);
  server.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
