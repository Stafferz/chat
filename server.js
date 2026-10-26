const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
require('dotenv').config();

const { initVapid } = require('./server/config/vapid');
const uploadRoute = require('./server/routes/upload');
const pushRoute = require('./server/routes/push');
const { registerSockets } = require('./server/sockets');

initVapid();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/upload', uploadRoute);
app.use('/api', pushRoute);

registerSockets(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Сервер запущен на порту ${PORT}`));
