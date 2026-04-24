export type HomeCategory = {
  id: string
  icon: string
  name: string
  hue: number
  fallbackCount: number
  progress: number
}

export const CORE_CATEGORIES: HomeCategory[] = [
  { id: 'geography', icon: 'globe', name: 'Geografija', hue: 220, fallbackCount: 72, progress: 84 },
  { id: 'history', icon: 'scroll', name: 'Povijest', hue: 35, fallbackCount: 68, progress: 58 },
  { id: 'sports', icon: 'trophy', name: 'Sport', hue: 150, fallbackCount: 64, progress: 76 },
  { id: 'science', icon: 'atom', name: 'Priroda i Znanost', hue: 280, fallbackCount: 70, progress: 63 },
  { id: 'film_music', icon: 'music', name: 'Film i Glazba', hue: 345, fallbackCount: 66, progress: 47 },
  { id: 'pop_culture', icon: 'mask', name: 'Pop Kultura', hue: 25, fallbackCount: 60, progress: 69 },
]

export const HOT_TOPIC = {
  id: 'beliebers',
  icon: 'music',
  name: 'Belieber Kviz',
  fallbackCount: 12,
  rewardXp: 150,
  image: '/belieber-coachella-anime.png',
}

export const KVIZOPOLI_TOPICS = ['Geo', 'Film', 'Sport', 'Pov', 'Znan', 'Pop']
