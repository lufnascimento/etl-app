import React, { useEffect, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

export default function App() {
  const [connections, setConnections] = useState([]);
  const [form, setForm] = useState({
    name: '',
    host: '',
    username: '',
    password: '',
    topics: '',
    targetCollection: ''
  });

  const fetchConnections = async () => {
    const res = await axios.get('http://localhost:3000/api/connections');
    setConnections(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, topics: form.topics.split(',').map(t => t.trim()) };
    await axios.post('http://localhost:3000/api/connections', payload);
    fetchConnections();
    setForm({ name: '', host: '', username: '', password: '', topics: '', targetCollection: '' });
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    fetchConnections();
    socket.on('mqtt_message', (msg) => {
      console.log('📡 Mensagem recebida:', msg);
    });
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>MQTT ETL Dashboard</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <input name="name" placeholder="Nome" value={form.name} onChange={handleChange} required />
        <input name="host" placeholder="Host MQTT" value={form.host} onChange={handleChange} required />
        <input name="username" placeholder="Usuário" value={form.username} onChange={handleChange} />
        <input name="password" placeholder="Senha" value={form.password} onChange={handleChange} />
        <input name="topics" placeholder="Tópicos (ex: sensores/#)" value={form.topics} onChange={handleChange} required />
        <input name="targetCollection" placeholder="Coleção Mongo" value={form.targetCollection} onChange={handleChange} required />
        <button type="submit">Adicionar Conexão</button>
      </form>

      <ul>
        {connections.map((c) => (
          <li key={c._id}>
            🔌 {c.name} — <code>{c.host}</code> → {c.targetCollection}
          </li>
        ))}
      </ul>
    </div>
  );
}
