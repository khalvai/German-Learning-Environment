import "./App.css";
import { HashRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Reading from "./pages/Reading";
import Listening from "./pages/Listening";
import ReadingDetail from "./pages/ReadingDetail";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/reading" element={<Reading />} />
        <Route path="/readings/:id" element={<ReadingDetail />} />
        <Route path="/listening" element={<Listening />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
