import { useEffect, useRef, useState } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
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
import HotTopic from './pages/HotTopic'
import AvatarBank from './pages/AvatarBank'
import { api } from './lib/api'
import LoadingScreen from './components/LoadingScreen'
import PageTransition from './components/PageTransition'
import BottomNav from './components/BottomNav'
import { WalletProvider, useWallet } from './context/WalletContext'
import { LoadingOverlayProvider } from './context/LoadingOverlayContext'
import GameInvitePopup from './components/GameInvitePopup'

type PendingInvite = {
  id: string
  notificationId: string
  type: 'kvizopoli' | 'vs'
  fromDisplayName: string
  roomCode?: string
  currentPlayers?: number
  maxPlayers?: number
  challengeId?: string
}

function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const previousPath = useRef(location.pathname)
  const [booting, setBooting] = useState(false)
  const [transitioning, setTransitioning] = useState(false)
  const [inviteQueue, setInviteQueue] = useState<PendingInvite[]>([])
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState('')
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

  useEffect(() => {
    if (!user) {
      setInviteQueue([])
      setInviteError('')
      return
    }

    const isGameplayRoute = (pathname: string) => pathname.startsWith('/quiz') || pathname.startsWith('/kvizopoli')
    const streamUrl = api.notifications.streamUrl()
    if (!streamUrl) return

    const stream = new EventSource(streamUrl)
    const pushInvite = (invite: PendingInvite) => {
      setInviteQueue(current => {
        if (current.some(item => item.id === invite.id || item.notificationId === invite.notificationId)) return current
        return [invite, ...current]
      })
    }

    stream.addEventListener('notification', event => {
      try {
        const notification = JSON.parse((event as MessageEvent).data)
        if (isGameplayRoute(window.location.pathname)) return

        if (notification.type === 'kvizopoli_invite') {
          pushInvite({
            id: notification.id,
            notificationId: notification.id,
            type: 'kvizopoli',
            fromDisplayName: notification.data?.from_display_name || notification.title?.replace(/\s+te poziva.*$/i, '') || 'Igrač',
            roomCode: notification.data?.join_code,
            currentPlayers: notification.data?.current_players,
            maxPlayers: notification.data?.max_players,
          })
        }

        if (notification.type === 'challenge_received' || notification.type === 'challenge_invite') {
          pushInvite({
            id: notification.id,
            notificationId: notification.id,
            type: 'vs',
            fromDisplayName: notification.data?.from_display_name || notification.title?.replace(/\s+te izaziva.*$/i, '') || 'Igrač',
            challengeId: notification.data?.challenge_id,
          })
        }
      } catch {}
    })

    return () => stream.close()
  }, [user])

  const currentInvite = inviteQueue[0] || null

  async function acceptInvite() {
    if (!currentInvite) return
    try {
      setInviteBusy(true)
      setInviteError('')

      if (currentInvite.type === 'kvizopoli') {
        if (!currentInvite.roomCode) throw new Error('Kod sobe nedostaje')
        await api.notifications.markRead(currentInvite.notificationId).catch(() => {})
        window.dispatchEvent(new Event('quizzo.notifications.refresh'))
        setInviteQueue(current => current.filter(item => item.id !== currentInvite.id))
        navigate(`/kvizopoli?code=${encodeURIComponent(currentInvite.roomCode)}`)
        return
      }

      if (!currentInvite.challengeId) throw new Error('Izazov nije dostupan')
      const data = await api.challenges.acceptById(currentInvite.challengeId)
      await api.notifications.markRead(currentInvite.notificationId).catch(() => {})
      window.dispatchEvent(new Event('quizzo.notifications.refresh'))
      setInviteQueue(current => current.filter(item => item.id !== currentInvite.id))
      navigate('/quiz/play', { state: { session: { session_id: data.session_id, questions: data.questions, challenge_id: data.challenge_id, category_id: data.category_id }, returnTo: '/notifications' } })
    } catch (err: any) {
      setInviteError(err.message || 'Pozivnica nije dostupna')
    } finally {
      setInviteBusy(false)
    }
  }

  function dismissInvite() {
    if (!currentInvite) return
    setInviteError('')
    setInviteQueue(current => current.filter(item => item.id !== currentInvite.id))
  }

  const showBottomNav = Boolean(user) && (['/', '/leaderboard', '/challenges', '/profile', '/friends', '/history', '/daily', '/shop', '/categories', '/avatars'].includes(location.pathname) || location.pathname.startsWith('/hot-topics/'))

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
          <Route path="/hot-topics/:slug" element={<HotTopic />} />
          <Route path="/avatars" element={<AvatarBank />} />
        </Routes>
      </div>
      {showBottomNav && <BottomNav />}
      <GameInvitePopup invite={currentInvite} busy={inviteBusy} error={inviteError} onAccept={acceptInvite} onDismiss={dismissInvite} />
      <PageTransition show={transitioning} onDone={() => setTransitioning(false)} />
      {booting && <LoadingScreen full />}
    </div>
  )
}

export default function App() {
  return (
    <WalletProvider>
      <LoadingOverlayProvider>
        <AppShell />
      </LoadingOverlayProvider>
    </WalletProvider>
  )
}
