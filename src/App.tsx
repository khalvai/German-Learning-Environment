import "./App.css";
import { HashRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Listening from "./pages/Listening";
import Speaking from "./pages/Speaking";
import Grammar from "./pages/Grammar";
import ReadingDetail from "./pages/ReadingDetail";
import WritingEditor from "./pages/WritingEditor";
import Writings from "./pages/Writings";
import MistakesIndex from "./pages/MistakesIndex";
import MistakeReview from "./pages/MistakeReview";
import Readings from "./pages/Readings";
import NewReading from "./pages/NewReading";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/reading" element={<Readings />} />
        <Route path="/reading/:id" element={<ReadingDetail />} />
        <Route path="/reading/new" element={<NewReading />} />

        <Route path="/listening" element={<Listening />} />
        <Route path="/speaking" element={<Speaking />} />
        <Route path="/grammar" element={<Grammar />} />

        <Route path="/writings" element={<Writings />} />
        <Route path="/writings/mistakes" element={<MistakesIndex />} />
        <Route path="/writings/mistakes/:slug" element={<MistakeReview />} />
        <Route path="/writings/new" element={<WritingEditor />} />
        <Route path="/writings/:id" element={<WritingEditor />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
