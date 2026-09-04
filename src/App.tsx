import "./App.css";
import { HashRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Listening from "./pages/Listening";
import ReadingDetail from "./pages/ReadingDetail";
import WritingEditor from "./pages/WritingEditor";
import Writings from "./pages/Writings";
import Reading from "./pages/Readings";
import NewReading from "./pages/NewReading";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/reading" element={<Reading />} />
        <Route path="/reading/:id" element={<ReadingDetail />} />
        <Route path="/reading/new" element={<NewReading />} />

        <Route path="/listening" element={<Listening />} />

        <Route path="/writings" element={<Writings />} />
        <Route path="/writings/new" element={<WritingEditor />} />
        <Route path="/writings/:id" element={<WritingEditor />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
