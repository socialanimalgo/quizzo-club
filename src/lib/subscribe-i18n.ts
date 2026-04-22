export type Lang = 'hr' | 'en' | 'sr' | 'bs' | 'mk'

export interface SubscribeStrings {
  headline: string
  sub: string
  monthlyName: string
  yearlyName: string
  bestValue: string
  save: string
  trialBadge: string
  perMonth: string
  perYear: string
  thenMonthly: string
  thenYearly: string
  cta: string
  features: string[]
  cancel: string
  successTitle: string
  successSub: string
  backToApp: string
  alreadySubbed: string
  manageBtn: string
  notLoggedIn: string
  signUpCta: string
}

export const strings: Record<Lang, SubscribeStrings> = {
  hr: {
    headline: 'Postani Quizzo Pro — Besplatno 30 Dana',
    sub: 'Neograničeni kvizovi, detaljne statistike i ekskluzivni izazovi.',
    monthlyName: 'Mjesečno',
    yearlyName: 'Godišnje',
    bestValue: 'Najisplativije',
    save: 'Uštedi 72%',
    trialBadge: '30 dana besplatno',
    perMonth: '/mj.',
    perYear: '/god.',
    thenMonthly: 'zatim €2,99/mj.',
    thenYearly: 'zatim €9,99/god.',
    cta: 'Počni Besplatno',
    features: [
      'Neograničeni kvizovi svaki dan',
      'Detaljne statistike i napredak',
      'Ekskluzivni Hunter Mode izazovi',
      'Prioritetna podrška',
      'Bez reklama',
    ],
    cancel: 'Otkazi bilo kada. Bez naplate za vrijeme 30-dnevnog probnog razdoblja.',
    successTitle: 'Sve je postavljeno! 🎉',
    successSub: 'Vaše 30-dnevno besplatno probno razdoblje je počelo. Uživajte u kvizovima!',
    backToApp: 'Idi na aplikaciju',
    alreadySubbed: 'Već ste pretplaćeni na Quizzo Pro.',
    manageBtn: 'Upravljanje pretplatom',
    notLoggedIn: 'Stvori besplatni račun za početak probnog razdoblja.',
    signUpCta: 'Stvori račun i počni',
  },
  en: {
    headline: 'Go Quizzo Pro — Free for 30 Days',
    sub: 'Unlimited quizzes, detailed stats, and exclusive challenge modes.',
    monthlyName: 'Monthly',
    yearlyName: 'Yearly',
    bestValue: 'Best Value',
    save: 'Save 72%',
    trialBadge: '30 days free',
    perMonth: '/mo',
    perYear: '/yr',
    thenMonthly: 'then €2.99/month',
    thenYearly: 'then €9.99/year',
    cta: 'Start Free Trial',
    features: [
      'Unlimited quizzes every day',
      'Detailed stats & progress tracking',
      'Exclusive Hunter Mode challenges',
      'Priority support',
      'No ads',
    ],
    cancel: 'Cancel anytime. No charges during your 30-day trial.',
    successTitle: "You're all set! 🎉",
    successSub: 'Your 30-day free trial has started. Enjoy unlimited quizzing!',
    backToApp: 'Go to App',
    alreadySubbed: 'You are already subscribed to Quizzo Pro.',
    manageBtn: 'Manage Subscription',
    notLoggedIn: 'Create a free account to start your trial.',
    signUpCta: 'Create Account & Start Trial',
  },
  sr: {
    headline: 'Postani Quizzo Pro — Besplatno 30 Dana',
    sub: 'Neograničeni kvizovi, detaljne statistike i ekskluzivni izazovi.',
    monthlyName: 'Mesečno',
    yearlyName: 'Godišnje',
    bestValue: 'Najpovoljnije',
    save: 'Uštedi 72%',
    trialBadge: '30 dana besplatno',
    perMonth: '/mes.',
    perYear: '/god.',
    thenMonthly: 'zatim €2,99/mes.',
    thenYearly: 'zatim €9,99/god.',
    cta: 'Počni Besplatno',
    features: [
      'Neograničeni kvizovi svaki dan',
      'Detaljne statistike i napredak',
      'Ekskluzivni Hunter Mode izazovi',
      'Prioritetna podrška',
      'Bez reklama',
    ],
    cancel: 'Otkaži bilo kada. Bez naplate tokom 30-dnevnog probnog perioda.',
    successTitle: 'Sve je podešeno! 🎉',
    successSub: 'Vaš 30-dnevni besplatni probni period je počeo. Uživajte u kvizovima!',
    backToApp: 'Idi na aplikaciju',
    alreadySubbed: 'Već ste pretplaćeni na Quizzo Pro.',
    manageBtn: 'Upravljanje pretplatom',
    notLoggedIn: 'Napravi besplatni nalog za početak probnog perioda.',
    signUpCta: 'Napravi nalog i počni',
  },
  bs: {
    headline: 'Postani Quizzo Pro — Besplatno 30 Dana',
    sub: 'Neograničeni kvizovi, detaljne statistike i ekskluzivni izazovi.',
    monthlyName: 'Mjesečno',
    yearlyName: 'Godišnje',
    bestValue: 'Najisplativije',
    save: 'Uštedi 72%',
    trialBadge: '30 dana besplatno',
    perMonth: '/mj.',
    perYear: '/god.',
    thenMonthly: 'zatim €2,99/mj.',
    thenYearly: 'zatim €9,99/god.',
    cta: 'Počni Besplatno',
    features: [
      'Neograničeni kvizovi svaki dan',
      'Detaljne statistike i napredak',
      'Ekskluzivni Hunter Mode izazovi',
      'Prioritetna podrška',
      'Bez reklama',
    ],
    cancel: 'Otkaži bilo kada. Bez naplate tokom 30-dnevnog probnog perioda.',
    successTitle: 'Sve je postavljeno! 🎉',
    successSub: 'Vaše 30-dnevno besplatno probno razdoblje je počelo. Uživajte u kvizovima!',
    backToApp: 'Idi na aplikaciju',
    alreadySubbed: 'Već ste pretplaćeni na Quizzo Pro.',
    manageBtn: 'Upravljanje pretplatom',
    notLoggedIn: 'Kreiraj besplatni račun za početak probnog perioda.',
    signUpCta: 'Kreiraj račun i počni',
  },
  mk: {
    headline: 'Стани Quizzo Pro — Бесплатно 30 Дена',
    sub: 'Неограничени квизови, детални статистики и ексклузивни предизвици.',
    monthlyName: 'Месечно',
    yearlyName: 'Годишно',
    bestValue: 'Најисплатливо',
    save: 'Заштеди 72%',
    trialBadge: '30 дена бесплатно',
    perMonth: '/мес.',
    perYear: '/год.',
    thenMonthly: 'потоа €2,99/мес.',
    thenYearly: 'потоа €9,99/год.',
    cta: 'Почни Бесплатно',
    features: [
      'Неограничени квизови секој ден',
      'Детални статистики и напредок',
      'Ексклузивни Hunter Mode предизвици',
      'Приоритетна поддршка',
      'Без реклами',
    ],
    cancel: 'Откажи во секое време. Без наплата за времетраење на 30-дневниот пробен период.',
    successTitle: 'Сè е подготвено! 🎉',
    successSub: 'Вашиот 30-дневен бесплатен пробен период започна. Уживајте во квизовите!',
    backToApp: 'Оди на апликација',
    alreadySubbed: 'Веќе сте претплатени на Quizzo Pro.',
    manageBtn: 'Управување со претплата',
    notLoggedIn: 'Создај бесплатна сметка за почеток на пробниот период.',
    signUpCta: 'Создај сметка и почни',
  },
}

const countryToLang: Record<string, Lang> = {
  HR: 'hr',
  RS: 'sr', BA: 'bs', ME: 'hr',
  MK: 'mk',
  SI: 'en', AT: 'en', DE: 'en',
}

export function getLangFromCountry(code: string): Lang {
  return countryToLang[code?.toUpperCase()] ?? 'hr'
}

export const langMeta: Record<Lang, { flag: string; label: string }> = {
  hr: { flag: '🇭🇷', label: 'Hrvatski' },
  en: { flag: '🇬🇧', label: 'English' },
  sr: { flag: '🇷🇸', label: 'Srpski' },
  bs: { flag: '🇧🇦', label: 'Bosanski' },
  mk: { flag: '🇲🇰', label: 'Македонски' },
}
