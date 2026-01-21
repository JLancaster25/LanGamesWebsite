// server.js
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });
let host = null;

wss.on('connection', ws => {
  ws.on('message', msg => {
    const data = JSON.parse(msg);

    if (data.type === 'host') {
      host = ws;
      return;
    }

    // Relay host state to all players
    if (data.type === 'state' && ws === host) {
      wss.clients.forEach(c => c !== ws && c.send(msg));
    }

    // Relay player bingo claim to host
    if (data.type === 'claim' && host) {
      host.send(msg);
    }
  });

  ws.on('close', () => {
    if (ws === host) host = null;
  });
});

console.log('Bingo WebSocket running on ws://localhost:8080');
