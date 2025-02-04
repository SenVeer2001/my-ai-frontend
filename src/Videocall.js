import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { useSearchParams, useNavigate } from "react-router-dom";

const socket = io("http://localhost:5000");

const VideoCall = () => {
  const [stream, setStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joining, setJoining] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [userJoined, setUserJoined] = useState(false);
  const myVideoRef = useRef();
  const userVideoRef = useRef();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const roomFromURL = searchParams.get("room");
    if (roomFromURL) {
      setRoomId(roomFromURL);
      joinRoom(roomFromURL);
    }
  }, []);

  const generateRoomId = () => {
    const newRoomId = Math.random().toString(36).substr(2, 9);
    setRoomId(newRoomId);
    navigate(`?room=${newRoomId}`);
  };

  const joinRoom = (room) => {
    if (!room) return alert("Please enter a valid Room ID");
    setJoining(true);
    socket.emit("join-room", room);
    
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideoRef.current) myVideoRef.current.srcObject = currentStream;
      });

    socket.on("user-connected", handleUserConnected);
    socket.on("offer", handleReceiveOffer);
    socket.on("answer", handleReceiveAnswer);
    socket.on("ice-candidate", handleReceiveIceCandidate);
  };

  const handleUserConnected = () => {
    setUserJoined(true);
    const peer = createPeer();
    setPeerConnection(peer);
  };

  const createPeer = () => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    stream?.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { roomId, candidate: event.candidate });
      }
    };

    peer.ontrack = (event) => {
      userVideoRef.current.srcObject = event.streams[0];
    };

    peer.createOffer().then((offer) => {
      peer.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    });

    return peer;
  };

  const handleReceiveOffer = async (data) => {
    setUserJoined(true);
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    setPeerConnection(peer);
    stream?.getTracks().forEach((track) => peer.addTrack(track, stream));

    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", { roomId, candidate: event.candidate });
      }
    };

    peer.ontrack = (event) => {
      userVideoRef.current.srcObject = event.streams[0];
    };

    await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", { roomId, answer });
  };

  const handleReceiveAnswer = (data) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  };

  const handleReceiveIceCandidate = (data) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  };

  // Toggle Microphone
  const toggleMic = () => {
    stream?.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setMicMuted(!micMuted);
  };

  // Toggle Video
  const toggleVideo = () => {
    stream?.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setVideoOff(!videoOff);
  };

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h2>React WebRTC Video Call</h2>

      {!joining ? (
        <div>
          <button onClick={generateRoomId}>Start a New Call</button>
          <p>Or Join an Existing Call:</p>
          <input 
            type="text" 
            placeholder="Enter Room ID" 
            value={roomId} 
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={() => joinRoom(roomId)}>Join</button>
        </div>
      ) : (
        <div>
          <p>Share this Room ID: <strong>{roomId}</strong></p>
          <button onClick={() => navigator.clipboard.writeText(window.location.href)}>Copy Link</button>
          <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "20px" }}>
            <video ref={myVideoRef} autoPlay muted playsInline style={{ width: "40%", display: videoOff ? "none" : "block" }} />
            {userJoined ? (
              <video ref={userVideoRef} autoPlay playsInline style={{ width: "40%" }} />
            ) : (
              <p>Waiting for another user to join...</p>
            )}
          </div>

          {/* Control Buttons */}
          <div style={{ marginTop: "20px" }}>
            <button onClick={toggleMic} style={{ marginRight: "10px" }}>
              {micMuted ? "🎤 Unmute" : "🔇 Mute"}
            </button>
            <button onClick={toggleVideo}>
              {videoOff ? "📹 Turn On" : "📷 Turn Off"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;
