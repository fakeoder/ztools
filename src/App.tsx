import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import Home from './pages/Home'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import ToolPlaceholder from './pages/ToolPlaceholder'
import JsonFormat from './pages/tools/JsonFormat'
import JsonDiff from './pages/tools/JsonDiff'
import TextDiff from './pages/tools/TextDiff'
import Favicon from './pages/tools/Favicon'
import Markdown from './pages/tools/Markdown'
import Encrypt from './pages/tools/Encrypt'
import NotFound from './pages/NotFound'

export default function App() {
  const { i18n } = useTranslation()

  useEffect(() => {
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  return (
    <div className="app">
      <Navbar />
      <ScrollToTop />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/json_format" element={<JsonFormat />} />
          <Route path="/json_diff" element={<JsonDiff />} />
          <Route path="/text_diff" element={<TextDiff />} />
          <Route path="/favicon" element={<Favicon />} />
          <Route path="/markdown" element={<Markdown />} />
          <Route path="/encrypt" element={<Encrypt />} />
          <Route path="/:toolId" element={<ToolPlaceholder />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}