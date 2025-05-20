import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';


const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL;

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // Add your TURN server here
    // { urls: 'turn:YOUR_TURN_SERVER', username: 'user', credential: 'pass' }
  ],
};

export default function VideoCall({ roomID }) {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const pcRef = useRef();
  const socketRef = useRef();
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  useEffect(() => {
    socketRef.current = io(SIGNALING_SERVER_URL);
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then(stream => {
        localVideoRef.current.srcObject = stream;
        pcRef.current = new RTCPeerConnection(ICE_SERVERS);

        stream.getTracks().forEach(track => {
          pcRef.current.addTrack(track, stream);
        });

        pcRef.current.onicecandidate = event => {
          if (event.candidate) {
            socketRef.current.emit('signal', {
              to: roomID,
              from: socketRef.current.id,
              data: { candidate: event.candidate },
            });
          }
        };

        pcRef.current.ontrack = event => {
          remoteVideoRef.current.srcObject = event.streams[0];
        };

        socketRef.current.emit('join-room', roomID);

        socketRef.current.on('user-connected', userId => {
          pcRef.current
            .createOffer()
            .then(offer => pcRef.current.setLocalDescription(offer))
            .then(() => {
              socketRef.current.emit('signal', {
                to: userId,
                from: socketRef.current.id,
                data: { sdp: pcRef.current.localDescription },
              });
            });
        });

        socketRef.current.on('signal', async ({ from, data }) => {
          if (data.sdp) {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
            if (data.sdp.type === 'offer') {
              const answer = await pcRef.current.createAnswer();
              await pcRef.current.setLocalDescription(answer);
              socketRef.current.emit('signal', {
                to: from,
                from: socketRef.current.id,
                data: { sdp: pcRef.current.localDescription },
              });
            }
          } else if (data.candidate) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        });
      });

    return () => socketRef.current.disconnect();
  }, [roomID]);

  const toggleMute = () => {
    localVideoRef.current.srcObject.getAudioTracks()[0].enabled = muted;
    setMuted(!muted);
  };

  const toggleVideo = () => {
    localVideoRef.current.srcObject.getVideoTracks()[0].enabled = videoOff;
    setVideoOff(!videoOff);
  };

  return (
    <div className="video-container">
      {/* Remote video of peer 2 */}
      <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
      <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />
      <div className="controls">
        <button onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
        <button onClick={toggleVideo}>{videoOff ? 'Start Video' : 'Stop Video'}</button>
      </div>
    </div>
  );
}
