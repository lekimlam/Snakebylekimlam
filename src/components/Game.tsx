import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Trophy, Users, Skull, Play, LogOut, Shield, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, logout, updateHighScore } from '../firebase';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';

interface Point {
  x: number;
  y: number;
}

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  radius: number;
  body: Point[];
  score: number;
  color: string;
  state: 'playing' | 'dead' | 'spectating';
  invincible?: boolean;
}

interface Food {
  id: string;
  x: number;
  y: number;
  value: number;
  radius: number;
  color: string;
}

interface GameState {
  players: Player[];
  food: Food[];
  leaderboard: { name: string; score: number }[];
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState<{ score: number; reason: string } | null>(null);
  const [worldSize, setWorldSize] = useState(3000);
  const [myId, setMyId] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [displayName, setDisplayName] = useState('');
  
  const navigate = useNavigate();

  // Camera state
  const cameraRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      navigate('/login');
      return;
    }

    // Fetch user data
    const fetchUserData = async () => {
      try {
        const publicRef = doc(db, 'users_public', user.uid);
        const publicSnap = await getDoc(publicRef);
        if (publicSnap.exists()) {
          setDisplayName(publicSnap.data().displayName);
        } else {
          setDisplayName(user.displayName || 'Anonymous');
        }

        const privateRef = doc(db, 'users_private', user.uid);
        const privateSnap = await getDoc(privateRef);
        if (privateSnap.exists()) {
          const role = privateSnap.data().role;
          if (role === 'admin' || user.email === 'lekimlam16052015@gmail.com') {
            setIsAdmin(true);
          }
        } else if (user.email === 'lekimlam16052015@gmail.com') {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error("Error fetching user data", error);
      }
    };
    fetchUserData();

    // Connect to the same host
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('init', (data) => {
      setMyId(data.id);
      setWorldSize(data.worldSize);
    });

    newSocket.on('state', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('gameOver', async (data) => {
      setIsPlaying(false);
      setGameOver(data);
      // Update high score in Firebase
      if (user) {
        await updateHighScore(user.uid, data.score);
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [navigate]);

  // Handle pointer input for continuous turning
  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (!socket || !isPlaying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const dx = clientX - rect.left - centerX;
    const dy = clientY - rect.top - centerY;
    
    const angle = Math.atan2(dy, dx);
    socket.emit('input', { angle });
  }, [socket, isPlaying]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handlePointerMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleMouseDown = () => { if (socket && isPlaying) socket.emit('boost', true); };
    const handleMouseUp = () => { if (socket && isPlaying) socket.emit('boost', false); };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        if (socket && isPlaying) socket.emit('boost', true);
      } else if (e.touches.length === 2 && isAdmin) {
        setShowAdminMenu(prev => !prev);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        if (socket && isPlaying) socket.emit('boost', false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'm' && isAdmin) {
        setShowAdminMenu(prev => !prev);
      }
      if (e.key === ' ' || e.key === 'Shift') {
        if (socket && isPlaying) socket.emit('boost', true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Shift') {
        if (socket && isPlaying) socket.emit('boost', false);
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handlePointerMove, isAdmin, socket, isPlaying]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resize
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resizeCanvas);
    if (canvas.width !== window.innerWidth) resizeCanvas();

    // Find my player to center camera
    const me = gameState.players.find(p => p.id === myId);
    if (me && me.state === 'playing') {
      // Smooth camera follow
      const targetX = me.x - canvas.width / 2;
      const targetY = me.y - canvas.height / 2;
      cameraRef.current.x += (targetX - cameraRef.current.x) * 0.1;
      cameraRef.current.y += (targetY - cameraRef.current.y) * 0.1;
    }

    const { x: camX, y: camY } = cameraRef.current;

    // Clear canvas
    ctx.fillStyle = '#111827'; // gray-900
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camX, -camY);

    // Draw grid background
    ctx.strokeStyle = '#1f2937'; // gray-800
    ctx.lineWidth = 1;
    const gridSize = 50;
    const startCol = Math.floor(camX / gridSize);
    const endCol = startCol + (canvas.width / gridSize) + 1;
    const startRow = Math.floor(camY / gridSize);
    const endRow = startRow + (canvas.height / gridSize) + 1;

    for (let x = startCol; x <= endCol; x++) {
      if (x * gridSize >= 0 && x * gridSize <= worldSize) {
        ctx.beginPath();
        ctx.moveTo(x * gridSize, Math.max(0, camY));
        ctx.lineTo(x * gridSize, Math.min(worldSize, camY + canvas.height));
        ctx.stroke();
      }
    }
    for (let y = startRow; y <= endRow; y++) {
      if (y * gridSize >= 0 && y * gridSize <= worldSize) {
        ctx.beginPath();
        ctx.moveTo(Math.max(0, camX), y * gridSize);
        ctx.lineTo(Math.min(worldSize, camX + canvas.width), y * gridSize);
        ctx.stroke();
      }
    }

    // Draw borders
    ctx.strokeStyle = '#ef4444'; // red-500
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, worldSize, worldSize);

    // Draw food
    const time = Date.now();
    gameState.food.forEach(f => {
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 10 + Math.sin(time / 200 + f.x) * 5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius + Math.sin(time / 200 + f.y) * 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    });

    // Draw players
    gameState.players.forEach(player => {
      if (player.state !== 'playing') return;

      ctx.fillStyle = player.color;
      ctx.shadowColor = player.invincible ? 'white' : player.color;
      ctx.shadowBlur = player.invincible ? 15 : 5;

      // Draw body segments (from tail to head)
      for (let i = player.body.length - 1; i >= 0; i--) {
        const segment = player.body[i];
        // Taper the tail slightly
        const segmentRadius = Math.max(player.radius * 0.5, player.radius * (1 - (i / player.body.length) * 0.5));
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, segmentRadius, 0, Math.PI * 2);
        ctx.fillStyle = player.color;
        ctx.fill();
        
        // Add stripes
        if (i % 2 === 0) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
          ctx.fill();
        }

        if (player.invincible) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }

      // Draw head
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
      ctx.fill();
      if (player.invincible) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      
      // Draw eyes
      ctx.fillStyle = 'white';
      ctx.shadowBlur = 0;
      const eyeOffset = player.radius * 0.5;
      const eyeRadius = player.radius * 0.3;
      
      // Left eye
      ctx.beginPath();
      ctx.arc(
        player.x + Math.cos(player.angle - 0.5) * eyeOffset,
        player.y + Math.sin(player.angle - 0.5) * eyeOffset,
        eyeRadius, 0, Math.PI * 2
      );
      ctx.fill();
      
      // Right eye
      ctx.beginPath();
      ctx.arc(
        player.x + Math.cos(player.angle + 0.5) * eyeOffset,
        player.y + Math.sin(player.angle + 0.5) * eyeOffset,
        eyeRadius, 0, Math.PI * 2
      );
      ctx.fill();

      // Pupils
      ctx.fillStyle = 'black';
      ctx.beginPath();
      ctx.arc(
        player.x + Math.cos(player.angle - 0.5) * eyeOffset + Math.cos(player.angle) * (eyeRadius * 0.3),
        player.y + Math.sin(player.angle - 0.5) * eyeOffset + Math.sin(player.angle) * (eyeRadius * 0.3),
        eyeRadius * 0.5, 0, Math.PI * 2
      );
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(
        player.x + Math.cos(player.angle + 0.5) * eyeOffset + Math.cos(player.angle) * (eyeRadius * 0.3),
        player.y + Math.sin(player.angle + 0.5) * eyeOffset + Math.sin(player.angle) * (eyeRadius * 0.3),
        eyeRadius * 0.5, 0, Math.PI * 2
      );
      ctx.fill();

      // Draw name tag
      ctx.fillStyle = 'white';
      ctx.font = '12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        player.name,
        player.x,
        player.y - player.radius - 10
      );
    });

    ctx.restore();

    // --- Draw Circular Minimap ---
    if (me && me.state === 'playing') {
      const minimapRadius = 70;
      const padding = 20;
      const mapCenterX = canvas.width - minimapRadius - padding;
      const mapCenterY = canvas.height - minimapRadius - padding;

      ctx.save();
      
      // Draw minimap background
      ctx.beginPath();
      ctx.arc(mapCenterX, mapCenterY, minimapRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(17, 24, 39, 0.8)'; // gray-900 with opacity
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)'; // Emerald border
      ctx.stroke();

      // Clip to circle
      ctx.clip();

      const scale = (minimapRadius * 2) / worldSize;

      // Draw radar grid/crosshairs
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mapCenterX - minimapRadius, mapCenterY);
      ctx.lineTo(mapCenterX + minimapRadius, mapCenterY);
      ctx.moveTo(mapCenterX, mapCenterY - minimapRadius);
      ctx.lineTo(mapCenterX, mapCenterY + minimapRadius);
      ctx.stroke();

      // Draw players on minimap
      gameState.players.forEach(player => {
        if (player.state !== 'playing') return;
        
        const isMe = player.id === myId;
        // Map world coordinates to minimap coordinates
        const minimapPlayerX = mapCenterX + (player.x - worldSize/2) * scale;
        const minimapPlayerY = mapCenterY + (player.y - worldSize/2) * scale;

        ctx.fillStyle = isMe ? '#10b981' : player.color;
        ctx.beginPath();
        ctx.arc(minimapPlayerX, minimapPlayerY, isMe ? 4 : 2, 0, Math.PI * 2);
        ctx.fill();
        
        if (isMe) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      });

      ctx.restore();
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [gameState, myId, worldSize]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket) return;
    socket.emit('join', displayName || 'Anonymous');
    setIsPlaying(true);
    setGameOver(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleInvincibility = () => {
    if (socket && isAdmin) {
      socket.emit('admin:toggleInvincibility');
    }
  };

  const killPlayer = (targetId: string) => {
    if (socket && isAdmin) {
      socket.emit('admin:killPlayer', targetId);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-gray-900 text-white font-sans touch-none">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-6">
        
        {/* Top Bar */}
        <div className="flex justify-between items-start pointer-events-auto">
          {/* Leaderboard */}
          <div className="bg-gray-800/80 backdrop-blur-md border border-gray-700 rounded-xl p-4 w-64 shadow-2xl">
            <div className="flex items-center gap-2 mb-3 text-yellow-400 font-bold">
              <Trophy size={20} />
              <h2>Leaderboard</h2>
            </div>
            <div className="space-y-2">
              {gameState?.leaderboard.map((entry, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 w-4">{i + 1}.</span>
                    <span className="truncate max-w-[120px] font-medium">{entry.name}</span>
                  </div>
                  <span className="text-emerald-400 font-mono">{entry.score}</span>
                </div>
              ))}
              {(!gameState?.leaderboard || gameState.leaderboard.length === 0) && (
                <div className="text-gray-500 text-sm italic">No players yet</div>
              )}
            </div>
          </div>

          {/* Stats & Controls */}
          <div className="flex flex-col gap-4 items-end">
            <div className="bg-gray-800/80 backdrop-blur-md border border-gray-700 rounded-xl p-4 shadow-2xl flex items-center gap-4">
              <div className="flex items-center gap-2 text-gray-300">
                <Users size={20} />
                <span className="font-mono">{gameState?.players.filter(p => p.state === 'playing').length || 0}</span>
              </div>
              {isPlaying && (
                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="font-bold">Score:</span>
                  <span className="font-mono text-lg">
                    {gameState?.players.find(p => p.id === myId)?.score || 0}
                  </span>
                </div>
              )}
            </div>

            {/* Admin & Logout Buttons */}
            <div className="flex gap-2">
              {isAdmin && (
                <button 
                  onClick={() => navigate('/admin')}
                  className="bg-purple-600/80 hover:bg-purple-600 backdrop-blur-md border border-purple-500 rounded-xl px-4 py-2 shadow-2xl flex items-center gap-2 transition-colors font-medium text-sm"
                >
                  <Shield size={16} /> Admin Panel
                </button>
              )}
              <button 
                onClick={handleLogout}
                className="bg-gray-800/80 hover:bg-red-500/80 backdrop-blur-md border border-gray-700 hover:border-red-500 rounded-xl px-4 py-2 shadow-2xl flex items-center gap-2 transition-colors font-medium text-sm"
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Admin Menu */}
      <AnimatePresence>
        {isAdmin && showAdminMenu && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-gray-900 border border-purple-500/30 rounded-xl shadow-2xl z-50 pointer-events-auto overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-gray-800/50 p-4 flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-2 text-purple-400">
                <ShieldAlert size={18} />
                <h3 className="font-bold tracking-wide uppercase text-sm">Admin Control</h3>
              </div>
              <button onClick={() => setShowAdminMenu(false)} className="text-gray-500 hover:text-white text-xs bg-gray-800 px-2 py-1 rounded transition-colors">
                Close (M)
              </button>
            </div>
            
            <div className="p-4 space-y-5">
              {/* Section 1: Player Cheats */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Player Cheats</h4>
                
                <div className="flex items-center justify-between bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                  <div>
                    <div className="text-sm font-medium text-white">God Mode</div>
                    <div className="text-xs text-gray-400">Pass through walls & snakes</div>
                  </div>
                  <button 
                    onClick={toggleInvincibility}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                      gameState?.players.find(p => p.id === myId)?.invincible ? 'bg-purple-500' : 'bg-gray-600'
                    }`}
                  >
                    <span 
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        gameState?.players.find(p => p.id === myId)?.invincible ? 'translate-x-6' : 'translate-x-1'
                      }`} 
                    />
                  </button>
                </div>
              </div>
              
              {/* Section 2: Server Controls */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Server Controls</h4>
                
                <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden">
                  <div className="px-3 py-2 bg-gray-800 border-b border-gray-700/50 text-xs text-gray-400">
                    Active Players
                  </div>
                  <div className="max-h-40 overflow-y-auto p-2 space-y-1">
                    {gameState?.players.filter(p => p.id !== myId && p.state === 'playing').map(player => (
                      <div key={player.id} className="flex items-center justify-between hover:bg-gray-700/30 p-2 rounded-md transition-colors">
                        <span className="text-sm truncate max-w-[120px] text-gray-200">{player.name}</span>
                        <button
                          onClick={() => killPlayer(player.id)}
                          className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-3 py-1 rounded text-xs font-medium transition-colors border border-red-500/20 hover:border-red-500"
                        >
                          Kill
                        </button>
                      </div>
                    ))}
                    {(!gameState?.players || gameState.players.filter(p => p.id !== myId && p.state === 'playing').length === 0) && (
                      <div className="p-3 text-center text-xs text-gray-500 italic">
                        No other players online
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join / Game Over Screen */}
      <AnimatePresence>
        {(!isPlaying || gameOver) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-gray-800 border border-gray-700 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center"
            >
              {gameOver ? (
                <>
                  <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Skull size={32} />
                  </div>
                  <h2 className="text-3xl font-bold mb-2">Game Over!</h2>
                  <p className="text-gray-400 mb-6">{gameOver.reason}</p>
                  <div className="bg-gray-900 rounded-xl p-4 mb-8">
                    <div className="text-sm text-gray-500 mb-1">Final Score</div>
                    <div className="text-4xl font-mono text-emerald-400">{gameOver.score}</div>
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    SNAKE.IO
                  </h1>
                  <p className="text-gray-400 mb-8">Welcome back, <span className="text-emerald-400 font-bold">{displayName || 'Player'}</span>!</p>
                </>
              )}

              <form onSubmit={handleJoin} className="space-y-4">
                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Play size={20} fill="currentColor" />
                  {gameOver ? 'Play Again' : 'Play Now'}
                </button>
              </form>

              <div className="mt-6 text-sm text-gray-500 flex justify-center gap-4">
                <span className="flex items-center gap-1">Move your mouse or drag to steer</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
