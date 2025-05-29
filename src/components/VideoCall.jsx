import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL;
const ICE_SERVERS = { iceServers: [
  { urls: import.meta.env.VITE_STUN_URL },
  ...(import.meta.env.VITE_TURN_URL ? [{
    urls: import.meta.env.VITE_TURN_URL,
    username: import.meta.env.VITE_TURN_USERNAME,
    credential: import.meta.env.VITE_TURN_CREDENTIAL,
  }] : []),
]};

export default function VideoCall({ roomID }) {
  const localRef = useRef();
  const remoteRef = useRef();
  const pc = useRef();
  const socket = useRef();

  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    console.log('Connecting to signaling server...');
    socket.current = io(SIGNALING_SERVER_URL);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        console.log('Got user media stream', stream);
        localRef.current.srcObject = stream;

        pc.current = new RTCPeerConnection(ICE_SERVERS);
        console.log('RTCPeerConnection created', pc.current);

        // Add local tracks to peer connection
        stream.getTracks().forEach(track => {
          pc.current.addTrack(track, stream);
          console.log('Added local track', track);
        });

        // Log and emit ICE candidates
        pc.current.onicecandidate = e => {
          if (e.candidate) {
            console.log('Local ICE candidate generated', e.candidate);
            socket.current.emit('signal', { to: roomID, from: socket.current.id, data: { candidate: e.candidate } });
          }
        };

        // Log remote track events
        pc.current.ontrack = e => {
          console.log('Remote track received', e.streams[0]);
          remoteRef.current.srcObject = e.streams[0];
        };

        // Join room
        socket.current.emit('join-room', roomID);

        // When a new user connects, create and send an offer
        socket.current.on('user-connected', id => {
          console.log(`User connected: ${id}. Creating offer...`);
          pc.current.createOffer()
            .then(offer => {
              console.log('Offer created', offer);
              return pc.current.setLocalDescription(offer);
            })
            .then(() => {
              console.log('Local SDP set', pc.current.localDescription);
              socket.current.emit('signal', { to: id, from: socket.current.id, data: { sdp: pc.current.localDescription } });
            })
            .catch(err => console.error('Error creating or sending offer', err));
        });

        // Handle incoming signals (SDP or ICE)
        socket.current.on('signal', async ({ from, data }) => {
          console.log(`Signal received from ${from}`, data);
          if (from === socket.current.id) return;

          if (data.sdp) {
            console.log('Setting remote SDP', data.sdp);
            await pc.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
            console.log('Remote SDP applied');

            if (data.sdp.type === 'offer') {
              console.log('Received offer, creating answer...');
              const answer = await pc.current.createAnswer();
              console.log('Answer created', answer);
              await pc.current.setLocalDescription(answer);
              console.log('Local SDP (answer) set', pc.current.localDescription);
              socket.current.emit('signal', { to: from, from: socket.current.id, data: { sdp: pc.current.localDescription } });
            }
          } else if (data.candidate) {
            console.log('Adding ICE candidate from remote', data.candidate);
            try {
              await pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
              console.log('Remote ICE candidate added');
            } catch (err) {
              console.error('Error adding received ICE candidate', err);
            }
          }
        });
      })
      .catch(err => console.error('Error getting user media', err));

    return () => {
      console.log('Disconnecting socket and closing peer connection');
      socket.current.disconnect();
      if (pc.current) pc.current.close();
    };
  }, [roomID]);

  const toggleMute = () => {
    const audioTrack = localRef.current.srcObject.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    console.log(audioTrack.enabled ? 'Audio unmuted' : 'Audio muted');
    setMuted(!muted);
  };

  const toggleVideo = () => {
    const videoTrack = localRef.current.srcObject.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    console.log(videoTrack.enabled ? 'Video started' : 'Video stopped');
    setVideoOff(!videoOff);
  };

  const toggleShare = async () => {
    if (!sharing) {
      console.log('Starting screen share...');
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = stream.getVideoTracks()[0];
      const sender = pc.current.getSenders().find(s => s.track.kind === 'video');
      sender.replaceTrack(screenTrack);
      screenTrack.onended = () => {
        console.log('Screen share ended, reverting to camera');
        toggleShare();
      };
      setSharing(true);
    } else {
      console.log('Stopping screen share, reverting to camera');
      const cameraTrack = localRef.current.srcObject.getVideoTracks()[0];
      const sender = pc.current.getSenders().find(s => s.track.kind === 'video');
      sender.replaceTrack(cameraTrack);
      setSharing(false);
    }
  };

  return (
    <div className="video-container">
      <video ref={remoteRef} autoPlay playsInline className="remote-video" />
      <video ref={localRef} autoPlay muted playsInline className="local-video" />
      <div className="controls">
        <button onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
        <button onClick={toggleVideo}>{videoOff ? 'Start Video' : 'Stop Video'}</button>
        <button onClick={toggleShare}>{sharing ? 'Stop Share' : 'Share Screen'}</button>
      </div>
    </div>
  );
}




















// import React, { useRef, useEffect, useState } from 'react';
// import io from 'socket.io-client';

// const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL;
// const ICE_SERVERS = { iceServers: [
//   { urls: import.meta.env.VITE_STUN_URL },
//   ...(import.meta.env.VITE_TURN_URL?[{
//     urls: import.meta.env.VITE_TURN_URL,
//     username: import.meta.env.VITE_TURN_USERNAME,
//     credential: import.meta.env.VITE_TURN_CREDENTIAL,
//   }]:[]),
// ]};

// export default function VideoCall({ roomID }) {
//   const localRef=useRef(), remoteRef=useRef(), pc=useRef(), socket=useRef();
//   const [muted,setMuted]=useState(false),[videoOff,setVideoOff]=useState(false),
//         [sharing,setSharing]=useState(false);

//   useEffect(()=>{
//     socket.current=io(SIGNALING_SERVER_URL);
//     navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(stream=>{
//       localRef.current.srcObject=stream;
//       pc.current=new RTCPeerConnection(ICE_SERVERS);
//       stream.getTracks().forEach(t=>pc.current.addTrack(t,stream));
//       pc.current.onicecandidate=e=>e.candidate&&socket.current.emit('signal',{to:roomID,from:socket.current.id,data:{candidate:e.candidate}});
//       pc.current.ontrack=e=>{remoteRef.current.srcObject=e.streams[0];};
//       socket.current.emit('join-room',roomID);
//       socket.current.on('user-connected',id=>{pc.current.createOffer().then(o=>pc.current.setLocalDescription(o)).then(()=>socket.current.emit('signal',{to:id,from:socket.current.id,data:{sdp:pc.current.localDescription}}));});
//       socket.current.on('signal',async({from,data})=>{
//         if(from===socket.current.id) return;
//         if(data.sdp){
//           await pc.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
//           if(data.sdp.type==='offer'){
//             const ans=await pc.current.createAnswer();
//             await pc.current.setLocalDescription(ans);
//             socket.current.emit('signal',{to:from,from:socket.current.id,data:{sdp:pc.current.localDescription}});
//           }
//         } else if(data.candidate) await pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
//       });
//     });
//     return ()=>socket.current.disconnect();
//   },[roomID]);

//   const toggleMute=()=>{const audio=localRef.current.srcObject.getAudioTracks()[0];audio.enabled=!audio.enabled;setMuted(!muted);};
//   const toggleVideo=()=>{const vid=localRef.current.srcObject.getVideoTracks()[0];vid.enabled=!vid.enabled;setVideoOff(!videoOff);};
//   const toggleShare=async()=>{
//     if(!sharing){
//       const stream=await navigator.mediaDevices.getDisplayMedia({video:true});
//       const track=stream.getVideoTracks()[0];
//       pc.current.getSenders().find(s=>s.track.kind==='video').replaceTrack(track);
//       track.onended=()=>toggleShare();
//       setSharing(true);
//     } else {
//       const track=localRef.current.srcObject.getVideoTracks()[0];
//       pc.current.getSenders().find(s=>s.track.kind==='video').replaceTrack(track);
//       setSharing(false);
//     }
//   };

//   return (
//     <div className="video-container">
//       <video ref={remoteRef} autoPlay playsInline className="remote-video" />
//       <video ref={localRef} autoPlay muted playsInline className="local-video" />
//       <div className="controls">
//         <button onClick={toggleMute}>{muted?'Unmute':'Mute'}</button>
//         <button onClick={toggleVideo}>{videoOff?'Start Video':'Stop Video'}</button>
//         <button onClick={toggleShare}>{sharing?'Stop Share':'Share Screen'}</button>
//       </div>
//     </div>
//   );
// }
























// import React, { useRef, useEffect, useState } from 'react';
// import io from 'socket.io-client';

// const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL;

// const ICE_SERVERS = {
//   iceServers: [
//     { urls: import.meta.env.VITE_STUN_URL },
//     ...(import.meta.env.VITE_TURN_URL ? [{
//       urls: import.meta.env.VITE_TURN_URL,
//       username: import.meta.env.VITE_TURN_USERNAME,
//       credential: import.meta.env.VITE_TURN_CREDENTIAL,
//     }] : []),
//   ],
// };

// export default function VideoCall({ roomID }) {
//   const localVideoRef = useRef();
//   const remoteVideoRef = useRef();
//   const pcRef = useRef();
//   const socketRef = useRef();
//   const [muted, setMuted] = useState(false);
//   const [videoOff, setVideoOff] = useState(false);

//   useEffect(() => {
//     socketRef.current = io(SIGNALING_SERVER_URL);
//     navigator.mediaDevices
//       .getUserMedia({ video: true, audio: true })
//       .then(stream => {
//         localVideoRef.current.srcObject = stream;
//         pcRef.current = new RTCPeerConnection(ICE_SERVERS);

//         stream.getTracks().forEach(track => {
//           pcRef.current.addTrack(track, stream);
//         });

//         pcRef.current.onicecandidate = event => {
//           if (event.candidate) {
//             socketRef.current.emit('signal', {
//               to: roomID,
//               from: socketRef.current.id,
//               data: { candidate: event.candidate },
//             });
//           }
//         };

//         pcRef.current.ontrack = event => {
//           remoteVideoRef.current.srcObject = event.streams[0];
//         };

//         socketRef.current.emit('join-room', roomID);

//         socketRef.current.on('user-connected', userId => {
//           pcRef.current
//             .createOffer()
//             .then(offer => pcRef.current.setLocalDescription(offer))
//             .then(() => {
//               socketRef.current.emit('signal', {
//                 to: userId,
//                 from: socketRef.current.id,
//                 data: { sdp: pcRef.current.localDescription },
//               });
//             });
//         });

//         socketRef.current.on('signal', async ({ from, data }) => {
//           if (data.sdp) {
//             await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
//             if (data.sdp.type === 'offer') {
//               const answer = await pcRef.current.createAnswer();
//               await pcRef.current.setLocalDescription(answer);
//               socketRef.current.emit('signal', {
//                 to: from,
//                 from: socketRef.current.id,
//                 data: { sdp: pcRef.current.localDescription },
//               });
//             }
//           } else if (data.candidate) {
//             await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
//           }
//         });
//       });

//     return () => socketRef.current.disconnect();
//   }, [roomID]);

//   const toggleMute = () => {
//     localVideoRef.current.srcObject.getAudioTracks()[0].enabled = muted;
//     setMuted(!muted);
//   };

//   const toggleVideo = () => {
//     localVideoRef.current.srcObject.getVideoTracks()[0].enabled = videoOff;
//     setVideoOff(!videoOff);
//   };

//   return (
//     <div className="video-container">
//       {/* Remote video of peer 2 */}
//       <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
//       {/* Local video (self-view) */}
//       <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />
//       <div className="controls">
//         <button onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
//         <button onClick={toggleVideo}>{videoOff ? 'Start Video' : 'Stop Video'}</button>
//       </div>
//     </div>
//   );
// }





















// import React, { useRef, useEffect, useState } from 'react';
// import io from 'socket.io-client';


// const SIGNALING_SERVER_URL = import.meta.env.VITE_SIGNALING_SERVER_URL;

// const ICE_SERVERS = {
//   iceServers: [
//     { urls: 'stun:stun.l.google.com:19302' },
//     // Add your TURN server here
//     // { urls: 'turn:YOUR_TURN_SERVER', username: 'user', credential: 'pass' }
//   ],
// };

// export default function VideoCall({ roomID }) {
//   const localVideoRef = useRef();
//   const remoteVideoRef = useRef();
//   const pcRef = useRef();
//   const socketRef = useRef();
//   const [muted, setMuted] = useState(false);
//   const [videoOff, setVideoOff] = useState(false);

//   useEffect(() => {
//     socketRef.current = io(SIGNALING_SERVER_URL);
//     navigator.mediaDevices
//       .getUserMedia({ video: true, audio: true })
//       .then(stream => {
//         localVideoRef.current.srcObject = stream;
//         pcRef.current = new RTCPeerConnection(ICE_SERVERS);

//         stream.getTracks().forEach(track => {
//           pcRef.current.addTrack(track, stream);
//         });

//         pcRef.current.onicecandidate = event => {
//           if (event.candidate) {
//             socketRef.current.emit('signal', {
//               to: roomID,
//               from: socketRef.current.id,
//               data: { candidate: event.candidate },
//             });
//           }
//         };

//         pcRef.current.ontrack = event => {
//           remoteVideoRef.current.srcObject = event.streams[0];
//         };

//         socketRef.current.emit('join-room', roomID);

//         socketRef.current.on('user-connected', userId => {
//           pcRef.current
//             .createOffer()
//             .then(offer => pcRef.current.setLocalDescription(offer))
//             .then(() => {
//               socketRef.current.emit('signal', {
//                 to: userId,
//                 from: socketRef.current.id,
//                 data: { sdp: pcRef.current.localDescription },
//               });
//             });
//         });

//         socketRef.current.on('signal', async ({ from, data }) => {
//           if (data.sdp) {
//             await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
//             if (data.sdp.type === 'offer') {
//               const answer = await pcRef.current.createAnswer();
//               await pcRef.current.setLocalDescription(answer);
//               socketRef.current.emit('signal', {
//                 to: from,
//                 from: socketRef.current.id,
//                 data: { sdp: pcRef.current.localDescription },
//               });
//             }
//           } else if (data.candidate) {
//             await pcRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
//           }
//         });
//       });

//     return () => socketRef.current.disconnect();
//   }, [roomID]);

//   const toggleMute = () => {
//     localVideoRef.current.srcObject.getAudioTracks()[0].enabled = muted;
//     setMuted(!muted);
//   };

//   const toggleVideo = () => {
//     localVideoRef.current.srcObject.getVideoTracks()[0].enabled = videoOff;
//     setVideoOff(!videoOff);
//   };

//   return (
//     <div className="video-container">
//       {/* Remote video of peer 2 */}
//       <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
//       <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />
//       <div className="controls">
//         <button onClick={toggleMute}>{muted ? 'Unmute' : 'Mute'}</button>
//         <button onClick={toggleVideo}>{videoOff ? 'Start Video' : 'Stop Video'}</button>
//       </div>
//     </div>
//   );
// }
