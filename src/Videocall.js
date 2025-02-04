import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import { useSearchParams, useNavigate } from "react-router-dom";

const socket = io("https://my-backend-2-vqhy.onrender.com");

const VideoCall = () => {
  const [stream, setStream] = useState(null);
  const [peers, setPeers] = useState({});
  const [roomId, setRoomId] = useState("");
  const [joining, setJoining] = useState(false);
  const [users, setUsers] = useState([]);
  const myVideoRef = useRef();
  const videoRefs = useRef({}); // Store video refs dynamically
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
    socket.emit("join-room", room, socket.id);

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((currentStream) => {
      setStream(currentStream);
      if (myVideoRef.current) myVideoRef.current.srcObject = currentStream;
    });

    socket.on("user-list", (userList) => {
      setUsers(userList);
      userList.forEach((userId) => createPeer(userId));
    });

    socket.on("offer", handleReceiveOffer);
    socket.on("answer", handleReceiveAnswer);
    socket.on("ice-candidate", handleReceiveIceCandidate);
  };

  const createPeer = (userId) => {
    if (peers[userId]) return; // Don't create duplicate connections

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
      if (!videoRefs.current[userId]) {
        videoRefs.current[userId] = React.createRef();
      }
      videoRefs.current[userId].current.srcObject = event.streams[0];
    };

    peer.createOffer().then((offer) => {
      peer.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer, userId: socket.id });
    });

    setPeers((prevPeers) => ({
      ...prevPeers,
      [userId]: peer,
    }));
  };

  const handleReceiveOffer = async (data) => {
    if (peers[data.userId]) return;

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
      if (!videoRefs.current[data.userId]) {
        videoRefs.current[data.userId] = React.createRef();
      }
      videoRefs.current[data.userId].current.srcObject = event.streams[0];
    };

    await peer.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    socket.emit("answer", { roomId, answer, userId: socket.id });

    setPeers((prevPeers) => ({
      ...prevPeers,
      [data.userId]: peer,
    }));
  };

  const handleReceiveAnswer = (data) => {
    peers[data.userId]?.setRemoteDescription(new RTCSessionDescription(data.answer));
  };

  const handleReceiveIceCandidate = (data) => {
    peers[data.userId]?.addIceCandidate(new RTCIceCandidate(data.candidate));
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "20px" }}>
            <video ref={myVideoRef} autoPlay muted playsInline style={{ width: "100%" }} />
            {users.map((userId) => (
              <video key={userId} ref={videoRefs.current[userId] = React.createRef()} autoPlay playsInline style={{ width: "100%" }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCall;
