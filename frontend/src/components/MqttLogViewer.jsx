import React from 'react';

function MqttLogViewer({ logs }) {
  if (!logs || logs.length === 0) {
    return <p>No MQTT logs to display. Waiting for messages...</p>;
  }

  return (
    <div style={{ marginTop: '20px' }}>
      <h3>MQTT Message Logs</h3>
      <ul style={{
        listStyleType: 'none',
        padding: '10px',
        maxHeight: '400px', // Keep a decent height
        overflowY: 'auto',
        border: '1px solid #ddd',
        borderRadius: '5px',
        backgroundColor: '#f9f9f9'
      }}>
        {logs.map((log, index) => (
          // Using log.timestamp and index for the key, assuming timestamps can be very close
          // If logs had a unique ID from backend, that would be ideal
          <li
            key={`${log.timestamp}-${index}-${log.topic}`}
            style={{
              marginBottom: '8px',
              padding: '8px',
              borderBottom: '1px solid #eee',
              fontFamily: 'monospace',
              fontSize: '0.9em',
              display: 'flex',
              flexWrap: 'wrap'
            }}
          >
            <span style={{ color: '#007bff', marginRight: '10px', minWidth: '180px' }}>
              [{new Date(log.timestamp).toLocaleString()}]
            </span>
            <strong style={{ color: '#28a745', marginRight: '10px', minWidth: '150px' }}>
              {log.topic}:
            </strong>
            <span style={{ color: '#333', flexGrow: 1 }}>
              {log.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MqttLogViewer;
