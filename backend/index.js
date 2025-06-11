import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import mqtt from 'mqtt';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(express.json());

const mqttConnections = {};

const connectionSchema = new mongoose.Schema({
  name: String,
  host: String,
  username: String,
  password: String,
  topics: [String],
  targetCollection: String
});

const Connection = mongoose.model('Connection', connectionSchema);

mongoose.connect(process.env.MONGO_URI).then(() => {
  console.log('✅ Mongo conectado');
});

app.get('/api/connections', async (req, res) => {
  const connections = await Connection.find();
  res.json(connections);
});

app.post('/api/connections', async (req, res) => {
  const config = await Connection.create(req.body);
  startMQTTClient(config);
  res.json(config);
});

function startMQTTClient(config) {
  const client = mqtt.connect(config.host, {
    username: config.username,
    password: config.password
  });

  client.on('connect', () => {
    console.log(`🔌 Conectado: ${config.name}`);
    config.topics.forEach(topic => client.subscribe(topic));
  });

  client.on('message', async (topic, message) => {
    const collection = mongoose.connection.collection(config.targetCollection);
    const payload = message.toString();

    await collection.insertOne({
      topic,
      payload,
      timestamp: new Date()
    });

    io.emit('mqtt_message', { topic, payload, connection: config.name });
  });

  mqttConnections[config._id] = client;
}

httpServer.listen(3000, () => {
  console.log('🚀 Backend rodando em http://localhost:3000');
});
