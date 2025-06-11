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
  initializeExistingConnections(); // Inicia conexões já salvas no Mongo
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

app.delete('/api/connections/:id', async (req, res) => {
  const { id } = req.params;
  if (mqttConnections[id]) {
    mqttConnections[id].end();
    delete mqttConnections[id];
  }
  await Connection.findByIdAndDelete(id);
  res.json({ message: 'Conexão removida' });
});

function startMQTTClient(config) {
  const client = mqtt.connect(config.host, {
    username: config.username,
    password: config.password
  });

  client.on('connect', () => {
    console.log(`🔌 MQTT conectado: ${config.name}`);
    config.topics.forEach(topic => client.subscribe(topic));
  });

  client.on('error', (err) => {
    console.error(`Erro em ${config.name}:`, err.message);
  });

  client.on('message', async (topic, message) => {
    try {
      const payload = message.toString();
      const parsed = tryParseJSON(payload);
      const collection = mongoose.connection.collection(config.targetCollection);

      await collection.insertOne({
        topic,
        payload: parsed,
        timestamp: new Date()
      });

      io.emit('mqtt_message', {
        connection: config.name,
        topic,
        payload: parsed
      });

    } catch (err) {
      console.error('Erro ao inserir mensagem no Mongo:', err.message);
    }
  });

  mqttConnections[config._id] = client;
}

function tryParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

async function initializeExistingConnections() {
  const configs = await Connection.find();
  configs.forEach(startMQTTClient);
}

httpServer.listen(3000, () => {
  console.log('🚀 Backend rodando em http://localhost:3000');
});
