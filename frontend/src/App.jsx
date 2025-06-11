import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

export default function App() {
  const [connections, setConnections] = useState([]);
  const [logs, setLogs] = useState([]);
  const [collections, setCollections] = useState([]);
  const socket = io('http://69.62.100.180:3100');

  useEffect(() => {
    axios.get('http://69.62.100.180:3100/api/collections').then(res => setCollections(res.data));
    axios.get('http://69.62.100.180:3100/api/logs').then(res => setLogs(res.data));
    socket.on('mqtt_message', msg => setLogs(prev => [msg, ...prev.slice(0, 99)]));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>📦 ETL Manager</h1>

      <h2>📁 Bancos e Coleções</h2>
      {collections.map(db => (
        <div key={db.db}>
          <strong>{db.db}</strong>
          <ul>
            {db.collections.map(c => (
              <li key={c.collection}>{c.collection} — {c.count} documentos</li>
            ))}
          </ul>
        </div>
      ))}

      <h2>📋 Últimos Logs do MQTT</h2>
      <ul>
        {logs.map((l, i) => (
          <li key={i}>
            [{new Date(l.timestamp).toLocaleString()}] <strong>{l.topic}</strong>: {l.message}
          </li>
        ))}
      </ul>
    </div>
  );
}