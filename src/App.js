import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import VideoCall from "./Videocall";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<VideoCall />} />
      </Routes>
    </Router>
  );
}

export default App;
