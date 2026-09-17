// Test Real Socket.io Client Rematch Handshake
const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const io = require('socket.io-client');

const serverPath = path.join(__dirname, '../server/server.js');
const PORT = '9123';
const serverProc = spawn('node', [serverPath], {
  env: { ...process.env, PORT: PORT },
  stdio: 'pipe'
});

serverProc.stdout.on('data', (d) => {
  if (d.toString().includes('Words with Friends')) {
    runClientTest();
  }
});

function runClientTest() {
  console.log('Connecting socket client 1 (Host)...');
  const socket1 = io(`http://localhost:${PORT}`);
  let socket2 = null;

  socket1.on('connect', () => {
    console.log('Client 1 connected. Creating room...');
    socket1.emit('create_room', {
      inviteCode: 'REMATCH-TEST',
      hostName: 'Alice',
      hostPlayerId: 'p_alice'
    });
  });

  socket1.on('room_created', (data) => {
    console.log('Room created:', data.inviteCode);
    assert.strictEqual(data.success, true);

    // Now connect socket 2
    socket2 = io(`http://localhost:${PORT}`);
    socket2.on('connect', () => {
      console.log('Client 2 connected. Joining room...');
      socket2.emit('join_room', {
        inviteCode: 'REMATCH-TEST',
        playerName: 'Bob',
        playerId: 'p_bob'
      });
    });

    socket2.on('room_joined', (joinData) => {
      console.log('Bob joined room! Starting rematch test...');
      assert.strictEqual(joinData.session.players.length, 2);
      assert.strictEqual(joinData.session.currentTurnIndex, 0); // Alice starts first match

      // Now request rematch!
      socket2.emit('request_rematch', {
        inviteCode: 'REMATCH-TEST',
        requesterId: 'p_bob'
      });
    });

    socket1.on('rematch_started', (rematchData) => {
      console.log('Rematch started received by Alice! Requester:', rematchData.requesterName);
      assert.strictEqual(rematchData.requesterName, 'Bob');
      assert.strictEqual(rematchData.session.currentTurnIndex, 1, 'Turn should rotate to Bob (seat 1)');
      assert.strictEqual(rematchData.session.players[0].score, 0, 'Alice score 0');
      assert.strictEqual(rematchData.session.players[1].score, 0, 'Bob score 0');
      assert.strictEqual(rematchData.session.players[0].rack.length, 7, 'Alice rack 7 tiles');
      assert.strictEqual(rematchData.session.players[1].rack.length, 7, 'Bob rack 7 tiles');
      assert.strictEqual(rematchData.session.gameOver, false);
      assert.ok(rematchData.session.stats, 'Stats initialized');

      console.log('Socket rematch test passed with flying colors! 🏆');
      socket1.disconnect();
      if (socket2) socket2.disconnect();
      serverProc.kill();
      process.exit(0);
    });
  });
}

setTimeout(() => {
  console.error('Socket rematch test timed out');
  serverProc.kill();
  process.exit(1);
}, 10000);
