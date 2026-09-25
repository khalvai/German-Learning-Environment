import "./App.css";
import { HashRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Listening from "./pages/Listening";
import NewListening from "./pages/NewListening";
import ListeningDetail from "./pages/ListeningDetail";
import Speaking from "./pages/Speaking";
import Grammar from "./pages/Grammar";
import GrammarPractice from "./pages/GrammarPractice";
import ReadingDetail from "./pages/ReadingDetail";
import WritingEditor from "./pages/writing/WritingEditor";
import Writings from "./pages/writing/Writings";
import WritingTopics from "./pages/writing/WritingTopics";
import NewTopic from "./pages/NewTopic";
import Readings from "./pages/Readings";
import NewReading from "./pages/NewReading";
import MistakesIndex from "./pages/writing/mistakes/MistakesIndex";
import MistakeReview from "./pages/writing/mistakes/MistakeReview";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/reading" element={<Readings />} />
        <Route path="/reading/:id" element={<ReadingDetail />} />
        <Route path="/reading/new" element={<NewReading />} />

        <Route path="/listening" element={<Listening />} />
        <Route path="/listening/new" element={<NewListening />} />
        <Route path="/listening/:id" element={<ListeningDetail />} />
        <Route path="/speaking" element={<Speaking />} />
        <Route path="/grammar" element={<Grammar />} />
        <Route path="/grammar/practice" element={<GrammarPractice />} />

        <Route path="/writings" element={<Writings />} />
        <Route path="/writings/mistakes" element={<MistakesIndex />} />
        <Route path="/writings/mistakes/:slug" element={<MistakeReview />} />
        <Route path="/writings/topics" element={<WritingTopics />} />
        <Route path="/writings/topics/new" element={<NewTopic />} />
        <Route path="/writings/new" element={<WritingEditor />} />
        <Route path="/writings/:id" element={<WritingEditor />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
