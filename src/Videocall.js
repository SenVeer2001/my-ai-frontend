import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { useSearchParams, useNavigate } from "react-router-dom";

const socket = io("https://my-backend-nd2o.onrender.com");

const VideoCall = () => {
  const [stream, setStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [joining, setJoining] = useState(false);
  const myVideoRef = useRef();
  const userVideoRef = useRef();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Get room ID from URL if available
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
        myVideoRef.current.srcObject = currentStream;
      });

    socket.on("user-connected", handleUserConnected);
    socket.on("offer", handleReceiveOffer);
    socket.on("answer", handleReceiveAnswer);
    socket.on("ice-candidate", handleReceiveIceCandidate);
  };

  const handleUserConnected = () => {
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
            <video ref={myVideoRef} autoPlay muted playsInline style={{ width: "40%" }} />
            <video ref={userVideoRef} autoPlay playsInline style={{ width: "40%" }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;
