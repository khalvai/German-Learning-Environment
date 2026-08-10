import "./App.css";
import { HashRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Reading from "./pages/Reading";
import Listening from "./pages/Listening";
import ReadingDetail from "./pages/ReadingDetail";
import WritingEditor from "./pages/WritingEditor";
import Writings from "./pages/Writings";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/reading" element={<Reading />} />
        <Route path="/readings/:id" element={<ReadingDetail />} />
        <Route path="/listening" element={<Listening />} />

        <Route path="/writings" element={<Writings />} />
        <Route path="/writing/editor" element={<WritingEditor />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
