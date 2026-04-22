import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Lingoo from './pages/Lingoo'
import CertSearch from './pages/CertSearch'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Admin from './pages/Admin'
import Subscribe from './pages/Subscribe'
import { api } from './lib/api'

export default function App() {
  useEffect(() => {
    api.analytics.visit()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Lingoo />} />
      <Route path="/verify" element={<CertSearch />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/subscribe" element={<Subscribe />} />
    </Routes>
  )
}
