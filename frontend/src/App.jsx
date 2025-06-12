import React, { useEffect, useState } from 'react';
import axios from 'axios'; // Base URL is set in main.jsx (assuming it will be)
import { io } from 'socket.io-client';
import ConnectionManager from './components/ConnectionManager'; // Import the new component

export default function App() {
  const [logs, setLogs] = useState([]);
  const [collections, setCollections] = useState([]);
  // Socket URL should be absolute, not affected by axios base URL
  const socket = io('http://69.62.100.180:3100');

  useEffect(() => {
    // Fetch initial data using relative paths if axios default baseURL is set
    axios.get('/api/collections').then(res => {
      if(res.data && Array.isArray(res.data.collections)) { // Basic check
         setCollections(res.data.collections); // Assuming API returns { collections: [] }
      } else if (Array.isArray(res.data)) { // Fallback if API returns array directly
         setCollections(res.data);
      } else {
        console.error("Unexpected format for collections:", res.data);
        setCollections([]);
      }
    }).catch(err => {
        console.error("Error fetching collections:", err);
        setCollections([]);
    });

    axios.get('/api/logs').then(res => {
      if(res.data && Array.isArray(res.data)) { // Logs is expected to be an array
        setLogs(res.data);
      } else {
        console.error("Unexpected format for logs:", res.data);
        setLogs([]);
      }
    }).catch(err => {
      console.error("Error fetching logs:", err);
      setLogs([]);
    });

    const handleNewMessage = (msg) => {
      setLogs(prev => [msg, ...prev.slice(0, 99)]); // Keep only the last 100 logs
    };

    socket.on('mqtt_message', handleNewMessage);

    // Cleanup socket listener on component unmount
    return () => {
      socket.off('mqtt_message', handleNewMessage);
    };
  }, [socket]); // Added socket to dependency array

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>📦 ETL Manager</h1>

      <ConnectionManager />

      <h2 style={{marginTop: '2rem'}}>📁 Bancos e Coleções</h2>
      {collections.length > 0 ? (
        collections.map(db => ( // Assuming structure { db: name, collections: [] }
          <div key={db.db}> {/* If db objects have unique IDs, use them */}
            <strong>{db.db}</strong>
            <ul>
              {db.collections.map(c => (
                <li key={c.collection}>{c.collection} — {c.count} documentos</li>
              ))}
            </ul>
          </div>
        ))
      ) : (
        <p>No database collections to display or error fetching them.</p>
      )}

      <h2 style={{marginTop: '2rem'}}>📋 Últimos Logs do MQTT</h2>
      <ul style={{ listStyleType: 'none', padding: '10px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '5px' }}>
        {logs.length > 0 ? (
          logs.map((l, i) => (
            <li key={`${l.timestamp}-${i}`} style={{ marginBottom: '5px', fontSize: '0.9em', borderBottom: '1px dashed #f0f0f0', paddingBottom: '5px' }}>
              <span style={{ color: '#888' }}>[{new Date(l.timestamp).toLocaleString()}]</span> <strong>{l.topic}</strong>: {l.message}
            </li>
          ))
        ) : (
          <p>No MQTT logs to display or error fetching them.</p>
        )}
      </ul>
    </div>
  );
}