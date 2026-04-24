import { useEffect, useRef, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Admin from './pages/Admin'
import Subscribe from './pages/Subscribe'
import QuizPlay from './pages/QuizPlay'
import QuizResults from './pages/QuizResults'
import Leaderboard from './pages/Leaderboard'
import Challenges from './pages/Challenges'
import DailyQuiz from './pages/DailyQuiz'
import Profile from './pages/Profile'
import Friends from './pages/Friends'
import History from './pages/History'
import Notifications from './pages/Notifications'
import Shop from './pages/Shop'
import Categories from './pages/Categories'
import Kvizopoli from './pages/Kvizopoli'
import { api } from './lib/api'
import LoadingScreen from './components/LoadingScreen'
import PageTransition from './components/PageTransition'
import BottomNav from './components/BottomNav'
import { WalletProvider, useWallet } from './context/WalletContext'

function AppShell() {
  const location = useLocation()
  const previousPath = useRef(location.pathname)
  const [booting, setBooting] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const { user } = useWallet()

  useEffect(() => {
    api.analytics.visit()
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem('quizzo.booted')) return

    sessionStorage.setItem('quizzo.booted', '1')
    setBooting(true)
    const timer = window.setTimeout(() => setBooting(false), 1800)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (location.pathname === previousPath.current) return
    previousPath.current = location.pathname
    setTransitioning(true)
  }, [location.pathname])

  const showBottomNav = Boolean(user) && ['/', '/leaderboard', '/challenges', '/profile', '/friends', '/history', '/daily', '/shop', '/categories'].includes(location.pathname)

  return (
    <div className="min-h-screen overflow-hidden">
      <div key={location.pathname} className="min-h-screen anim-screenIn">
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/quiz/:categoryId" element={<QuizPlay />} />
          <Route path="/quiz/play" element={<QuizPlay />} />
          <Route path="/quiz/daily-play" element={<QuizPlay />} />
          <Route path="/results" element={<QuizResults />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/daily" element={<DailyQuiz />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/history" element={<History />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/kvizopoli" element={<Kvizopoli />} />
        </Routes>
      </div>
      {showBottomNav && <BottomNav />}
      <PageTransition show={transitioning} onDone={() => setTransitioning(false)} />
      {booting && <LoadingScreen full />}
    </div>
  )
}

export default function App() {
  return (
    <WalletProvider>
      <AppShell />
    </WalletProvider>
  )
}
