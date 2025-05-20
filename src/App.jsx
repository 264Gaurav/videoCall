import React, { useState } from 'react';
import VideoCall from './components/VideoCall';

export default function App() {
  const [roomID, setRoomID] = useState('');
  const [joined, setJoined] = useState(false);

  const joinRoom = () => {
    if (roomID.trim()) setJoined(true);
  };

  return (
    <div className="app-container">
      {joined ? (
        <VideoCall roomID={roomID} />
      ) : (
        <div className="join-container">
          <h2>Join a Video Call</h2>
          <input
            type="text"
            placeholder="Room ID"
            value={roomID}
            onChange={e => setRoomID(e.target.value)}
          />
          <button onClick={joinRoom}>Join</button>
        </div>
      )}
    </div>
  );
}
