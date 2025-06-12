import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Assuming axios is configured to point to the backend, e.g., http://localhost:3100
// If not, ensure full URLs or proxy is set up in vite.config.js

function ConnectionManager() {
  const [connections, setConnections] = useState([]);
  const [dbName, setDbName] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [mqttTopic, setMqttTopic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  const fetchConnections = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/connections');
      if (response.data && response.data.success) {
        setConnections(response.data.connections || []);
      } else {
        setError(response.data.message || 'Failed to fetch connections.');
        setConnections([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred while fetching connections.');
      setConnections([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const handleAddConnection = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage('');
    try {
      const response = await axios.post('/api/connections', {
        dbName,
        collectionName,
        mqttTopic,
      });
      if (response.data && response.data.success) {
        setSuccessMessage(response.data.message || 'Connection added successfully!');
        fetchConnections(); // Refresh the list
        setDbName('');
        setCollectionName('');
        setMqttTopic('');
      } else {
        setError(response.data.message || 'Failed to add connection.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred while adding the connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteConnection = async (connectionId) => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage('');
    try {
      const response = await axios.delete(`/api/connections/${connectionId}`);
      if (response.data && response.data.success) {
        setSuccessMessage(response.data.message || 'Connection deleted successfully!');
        fetchConnections(); // Refresh the list
      } else {
        setError(response.data.message || 'Failed to delete connection.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred while deleting the connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Connection Management</h2>

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}

      <form onSubmit={handleAddConnection} style={{ marginBottom: '30px', border: '1px solid #ccc', padding: '20px', borderRadius: '5px' }}>
        <h3>Add New Connection</h3>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="dbName" style={{ marginRight: '10px' }}>Database Name:</label>
          <input
            type="text"
            id="dbName"
            value={dbName}
            onChange={(e) => setDbName(e.target.value)}
            required
            style={{ padding: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="collectionName" style={{ marginRight: '10px' }}>Collection Name:</label>
          <input
            type="text"
            id="collectionName"
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            required
            style={{ padding: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="mqttTopic" style={{ marginRight: '10px' }}>MQTT Topic:</label>
          <input
            type="text"
            id="mqttTopic"
            value={mqttTopic}
            onChange={(e) => setMqttTopic(e.target.value)}
            required
            style={{ padding: '5px' }}
          />
        </div>
        <button type="submit" disabled={isLoading} style={{ padding: '8px 15px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
          {isLoading ? 'Adding...' : 'Add Connection'}
        </button>
      </form>

      <h3>Existing Connections</h3>
      {isLoading && <p>Loading connections...</p>}
      {connections.length === 0 && !isLoading && <p>No connections found.</p>}
      <ul style={{ listStyleType: 'none', padding: 0 }}>
        {connections.map((conn) => (
          <li key={conn._id} style={{ border: '1px solid #eee', padding: '15px', marginBottom: '10px', borderRadius: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>DB:</strong> {conn.dbName} <br />
              <strong>Collection:</strong> {conn.collectionName} <br />
              <strong>Topic:</strong> {conn.mqttTopic}
            </div>
            <button
              onClick={() => handleDeleteConnection(conn._id)}
              disabled={isLoading}
              style={{ padding: '5px 10px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ConnectionManager;
