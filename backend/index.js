import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import { Server } from 'socket.io';
import { createServer } from 'http';
import mqtt from 'mqtt';

const app = express();
const server = createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

const mongoUri = 'mongodb://telemetria:telemetria@69.62.100.180:27017';
await mongoose.connect(mongoUri);
console.log('✅ Conectado ao MongoDB');

let logs = [];
let clients = [];
const mqttClient = mqtt.connect('mqtt://localhost');
mqttClient.on('connect', () => console.log('✅ Conectado ao MQTT'));
mqttClient.on('message', (topic, message) => {
  const msg = { topic, message: message.toString(), timestamp: new Date() };
  logs.unshift(msg);
  if (logs.length > 100) logs.pop();
  io.emit('mqtt_message', msg);
  clients.forEach(({ dbName, collection }) => {
    mongoose.connection.useDb(dbName).collection(collection).insertOne(msg);
  });
});

app.post('/api/connections', (req, res) => {
  const { dbName, collection, topic } = req.body;
  mqttClient.subscribe(topic, () => {
    clients.push({ dbName, collection, topic });
    res.json({ success: true });
  });
});

app.get('/api/logs', (req, res) => {
  res.json(logs);
});

app.get('/api/collections', async (req, res) => {
  const dbs = await mongoose.connection.db.admin().listDatabases();
  const results = [];
  for (const db of dbs.databases) {
    const currentDb = mongoose.connection.useDb(db.name);
    const collections = await currentDb.db.listCollections().toArray();
    const detail = await Promise.all(collections.map(async col => {
      const count = await currentDb.collection(col.name).countDocuments();
      return { collection: col.name, count };
    }));
    results.push({ db: db.name, collections: detail });
  }
  res.json(results);
});

server.listen(3100, () => console.log('🚀 Backend rodando na porta 3100'));