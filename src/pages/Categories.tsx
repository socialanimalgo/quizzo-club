import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import { api } from '../lib/api'
import { CORE_CATEGORIES } from '../data/categories'

export default function Categories() {
  const navigate = useNavigate()
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    api.quiz.categories().then(result => {
      const counts: Record<string, number> = {}
      result.categories.forEach((category: any) => {
        counts[category.id] = category.question_count || 0
      })
      setQuestionCounts(counts)
    }).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)' }}>
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4 pb-6">
        <button onClick={() => navigate('/')} className="btn btn-sm mb-4">
          <Icon name="back" className="w-4 h-4" />
          Natrag
        </button>

        <div className="btl btl-lg sh-6 p-5 relative overflow-hidden mb-4" style={{ background: 'var(--accent)', color: 'var(--ink)' }}>
          <div className="absolute inset-0 grid-dots opacity-25" />
          <div className="relative">
            <div className="chip" style={{ background: 'var(--ink)', color: '#fff' }}>06 CAT.</div>
            <h1 className="font-display text-[38px] leading-[0.92] mt-3">Kvizovi po kategorijama</h1>
            <div className="font-mono text-[11px] font-bold uppercase tracking-widest opacity-70 mt-3">
              Odaberi temu i kreni igrati
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {CORE_CATEGORIES.map((category, index) => {
            const questionCount = questionCounts[category.id] || category.fallbackCount
            return (
              <button
                key={category.id}
                onClick={() => navigate(`/quiz/${category.id}`)}
                className="btl sh-4 flex items-center gap-3 p-3 text-left anim-slideup"
                style={{ animationDelay: `${index * 0.04}s`, background: '#fff' }}
              >
                <span
                  className="shrink-0 w-12 h-12 btl btl-sm grid place-items-center"
                  style={{ background: `oklch(0.9 0.1 ${category.hue})`, boxShadow: '2px 2px 0 0 var(--line)' }}
                >
                  <Icon name={category.icon} className="w-6 h-6" stroke={2.3} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-display text-[17px] leading-tight truncate">{category.name}</div>
                  <div className="font-mono text-[10px] font-bold opacity-60 tabular uppercase tracking-wider">
                    {String(questionCount).padStart(3, '0')} Q · {String(category.progress).padStart(2, '0')}% PROGRESS
                  </div>
                  <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,.08)' }}>
                    <div
                      className="h-full anim-fill"
                      style={{
                        width: `${category.progress}%`,
                        background: `oklch(0.55 0.2 ${category.hue})`,
                        animationDelay: `${index * 0.04}s`,
                      }}
                    />
                  </div>
                </div>
                <div
                  className="shrink-0 w-10 h-10 btl btl-sm grid place-items-center"
                  style={{ background: 'var(--ink)', color: '#fff', boxShadow: '2px 2px 0 0 var(--accent)' }}
                >
                  <Icon name="play" className="w-3 h-3" stroke={0} />
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
