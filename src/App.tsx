import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
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
import { api } from './lib/api'

export default function App() {
  useEffect(() => {
    api.analytics.visit()
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/quiz/:categoryId" element={<QuizPlay />} />
      <Route path="/quiz/play" element={<QuizPlay />} />
      <Route path="/results" element={<QuizResults />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/challenges" element={<Challenges />} />
      <Route path="/daily" element={<DailyQuiz />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/subscribe" element={<Subscribe />} />
      <Route path="/profile" element={<Profile />} />
    </Routes>
  )
}
