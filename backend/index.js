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

// Define Mongoose Schema and Model for Connections
const ConnectionSchema = new mongoose.Schema({
  dbName: { type: String, required: true },
  collectionName: { type: String, required: true },
  mqttTopic: { type: String, required: true, unique: true },
});

const Connection = mongoose.model('Connection', ConnectionSchema);

let logs = [];
let clients = []; // This will store objects like { _id, dbName, collectionName, topic }
const mqttClient = mqtt.connect('mqtt://localhost');

mqttClient.on('connect', async () => {
  console.log('✅ Conectado ao MQTT');
  // Load existing connections from MongoDB
  try {
    const savedConnections = await Connection.find({});
    savedConnections.forEach(conn => {
      clients.push({
        _id: conn._id.toString(), // Store ID for later use (e.g., deletion)
        dbName: conn.dbName,
        collectionName: conn.collectionName,
        topic: conn.mqttTopic, // Ensure 'topic' field is used consistently
      });
      mqttClient.subscribe(conn.mqttTopic, (err) => {
        if (err) {
          console.error(`Error subscribing to ${conn.mqttTopic}:`, err);
        } else {
          console.log(`Subscribed to ${conn.mqttTopic}`);
        }
      });
    });
  } catch (error) {
    console.error('Error loading connections from MongoDB:', error);
  }
});

// GET /api/connections - Retrieve all saved connections
app.get('/api/connections', async (req, res) => {
  try {
    const connections = await Connection.find({});
    res.json({ success: true, connections });
  } catch (error) {
    console.error('Error in GET /api/connections:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve connections.', error: error.message });
  }
});

mqttClient.on('message', (topic, message) => {
  const msg = { topic, message: message.toString(), timestamp: new Date() };
  logs.unshift(msg);
  if (logs.length > 100) logs.pop();
  io.emit('mqtt_message', msg);
  // Ensure this uses collectionName and topic from the clients array
  clients.forEach(client => {
    // Only insert if the message topic matches the client's subscribed topic
    if (client.topic === topic) {
      mongoose.connection.useDb(client.dbName).collection(client.collectionName).insertOne(msg)
        .catch(err => console.error(`Error inserting message into ${client.dbName}.${client.collectionName}:`, err));
    }
  });
});

app.post('/api/connections', async (req, res) => {
  const { dbName, collectionName, mqttTopic } = req.body;

  if (!dbName || !collectionName || !mqttTopic) {
    return res.status(400).json({ success: false, message: 'Missing required fields: dbName, collectionName, mqttTopic' });
  }

  try {
    // Check if a connection with the same mqttTopic already exists
    const existingConnection = await Connection.findOne({ mqttTopic });
    if (existingConnection) {
      return res.status(409).json({ success: false, message: `Connection with MQTT topic '${mqttTopic}' already exists.` });
    }

    // Create and save a new Connection document
    const newConnection = new Connection({ dbName, collectionName, mqttTopic });
    const savedConnection = await newConnection.save();

    // Add to in-memory clients array
    clients.push({
      _id: savedConnection._id.toString(),
      dbName: savedConnection.dbName,
      collectionName: savedConnection.collectionName,
      topic: savedConnection.mqttTopic,
    });

    // Subscribe MQTT client
    mqttClient.subscribe(savedConnection.mqttTopic, (err) => {
      if (err) {
        console.error(`Error subscribing to ${savedConnection.mqttTopic} after POST:`, err);
        // Note: The connection is saved to DB, but subscription failed.
        // Depending on desired behavior, you might want to "undo" the save or mark it as inactive.
        // For now, we'll just log the error and return success as the resource was created.
        return res.status(500).json({ 
          success: false, 
          message: 'Connection saved, but failed to subscribe to MQTT topic.',
          error: err.message,
          connection: savedConnection 
        });
      }
      console.log(`Subscribed to ${savedConnection.mqttTopic} after POST`);
      res.status(201).json({ success: true, message: 'Connection created and subscribed successfully.', connection: savedConnection });
    });

  } catch (error) {
    console.error('Error in POST /api/connections:', error);
    if (error.code === 11000) { // Duplicate key error (though we check findOne first, this is a safeguard)
        return res.status(409).json({ success: false, message: `Connection with MQTT topic '${mqttTopic}' already exists.`, error: error.message });
    }
    res.status(500).json({ success: false, message: 'Failed to create connection.', error: error.message });
  }
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

// DELETE /api/connections/:id - Delete a connection
app.delete('/api/connections/:id', async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid ID format.' });
  }

  try {
    const deletedConnection = await Connection.findByIdAndDelete(id);

    if (!deletedConnection) {
      return res.status(404).json({ success: false, message: 'Connection not found.' });
    }

    // Remove from in-memory clients array
    const clientIndex = clients.findIndex(client => client._id === id);
    if (clientIndex > -1) {
      clients.splice(clientIndex, 1);
    } else {
      // This might happen if the clients array is not perfectly in sync,
      // or if a connection was in DB but not loaded into clients (e.g., an error on startup).
      console.warn(`Connection with ID ${id} deleted from DB, but not found in in-memory clients array.`);
    }

    // Unsubscribe MQTT client
    const { mqttTopic } = deletedConnection;
    mqttClient.unsubscribe(mqttTopic, (err) => {
      if (err) {
        console.error(`Error unsubscribing from ${mqttTopic} after DELETE:`, err);
        // The resource was deleted from DB. We'll still return success, but log the unsubscribe error.
        return res.json({ 
          success: true, 
          message: 'Connection deleted successfully, but failed to unsubscribe from MQTT topic.', 
          error: err.message,
          deletedConnection 
        });
      }
      console.log(`Unsubscribed from ${mqttTopic} after DELETE`);
      res.json({ success: true, message: 'Connection deleted and unsubscribed successfully.', deletedConnection });
    });

  } catch (error) {
    console.error('Error in DELETE /api/connections/:id:', error);
    res.status(500).json({ success: false, message: 'Failed to delete connection.', error: error.message });
  }
});

server.listen(3100, () => console.log('🚀 Backend rodando na porta 3100'));
