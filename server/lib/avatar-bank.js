const DEFAULT_AVATAR_ID = 'ava-basic-01';

const BASIC_AVATARS = [
  { id:'ava-basic-01', label:'Nika', pack:'basic', age:'teen', gender:'f', skin:'#f2d4bf', hair:'#1e1b1b', accent:'#ff7a59', shirt:'#ffb703' },
  { id:'ava-basic-02', label:'Maks', pack:'basic', age:'adult', gender:'m', skin:'#b67855', hair:'#221f1f', accent:'#4f46e5', shirt:'#93c5fd' },
  { id:'ava-basic-03', label:'Asha', pack:'basic', age:'adult', gender:'f', skin:'#5a3a2e', hair:'#111827', accent:'#ec4899', shirt:'#f9a8d4' },
  { id:'ava-basic-04', label:'Kenji', pack:'basic', age:'adult', gender:'m', skin:'#f0c8a2', hair:'#2f241f', accent:'#14b8a6', shirt:'#99f6e4' },
  { id:'ava-basic-05', label:'Lana', pack:'basic', age:'adult', gender:'f', skin:'#ead0bb', hair:'#b45309', accent:'#f97316', shirt:'#fdba74' },
  { id:'ava-basic-06', label:'Omar', pack:'basic', age:'adult', gender:'m', skin:'#8a5b3b', hair:'#201a17', accent:'#22c55e', shirt:'#86efac' },
  { id:'ava-basic-07', label:'Mila', pack:'basic', age:'adult', gender:'f', skin:'#c88d66', hair:'#4c1d95', accent:'#8b5cf6', shirt:'#c4b5fd' },
  { id:'ava-basic-08', label:'Noah', pack:'basic', age:'teen', gender:'m', skin:'#f2d6c4', hair:'#111827', accent:'#06b6d4', shirt:'#67e8f9' },
  { id:'ava-basic-09', label:'Zuri', pack:'basic', age:'adult', gender:'f', skin:'#4b2d24', hair:'#111111', accent:'#f43f5e', shirt:'#fda4af' },
  { id:'ava-basic-10', label:'Diego', pack:'basic', age:'adult', gender:'m', skin:'#bb7a57', hair:'#1f2937', accent:'#f59e0b', shirt:'#fde68a' },
  { id:'ava-basic-11', label:'Sara', pack:'basic', age:'senior', gender:'f', skin:'#e3c2ac', hair:'#cbd5e1', accent:'#0ea5e9', shirt:'#bfdbfe' },
  { id:'ava-basic-12', label:'Ivo', pack:'basic', age:'senior', gender:'m', skin:'#d6b29a', hair:'#e5e7eb', accent:'#64748b', shirt:'#cbd5e1' },
  { id:'ava-basic-13', label:'Linh', pack:'basic', age:'teen', gender:'f', skin:'#f0c9a9', hair:'#09090b', accent:'#10b981', shirt:'#a7f3d0' },
  { id:'ava-basic-14', label:'Amir', pack:'basic', age:'adult', gender:'m', skin:'#9a6648', hair:'#2a211d', accent:'#ef4444', shirt:'#fca5a5' },
  { id:'ava-basic-15', label:'Tara', pack:'basic', age:'adult', gender:'f', skin:'#f4dcc8', hair:'#92400e', accent:'#84cc16', shirt:'#d9f99d' },
  { id:'ava-basic-16', label:'Joon', pack:'basic', age:'adult', gender:'m', skin:'#dfb48f', hair:'#1f2937', accent:'#3b82f6', shirt:'#93c5fd' },
  { id:'ava-basic-17', label:'Lea', pack:'basic', age:'adult', gender:'f', skin:'#83563d', hair:'#111827', accent:'#e11d48', shirt:'#fecdd3' },
  { id:'ava-basic-18', label:'Pablo', pack:'basic', age:'adult', gender:'m', skin:'#c98762', hair:'#3f3f46', accent:'#22c55e', shirt:'#bbf7d0' },
  { id:'ava-basic-19', label:'Mina', pack:'basic', age:'teen', gender:'f', skin:'#f1d0b6', hair:'#0f172a', accent:'#a855f7', shirt:'#ddd6fe' },
  { id:'ava-basic-20', label:'Ari', pack:'basic', age:'adult', gender:'x', skin:'#b57c57', hair:'#1c1917', accent:'#06b6d4', shirt:'#a5f3fc' },
  { id:'ava-basic-21', label:'Nora', pack:'basic', age:'adult', gender:'f', skin:'#efd3c3', hair:'#7c2d12', accent:'#fb7185', shirt:'#fecdd3' },
  { id:'ava-basic-22', label:'Rami', pack:'basic', age:'adult', gender:'m', skin:'#6e4734', hair:'#111827', accent:'#eab308', shirt:'#fde68a' },
  { id:'ava-basic-23', label:'Yara', pack:'basic', age:'adult', gender:'f', skin:'#a66a49', hair:'#1f2937', accent:'#14b8a6', shirt:'#99f6e4' },
  { id:'ava-basic-24', label:'Mateo', pack:'basic', age:'adult', gender:'m', skin:'#ddb493', hair:'#111111', accent:'#2563eb', shirt:'#bfdbfe' },
  { id:'ava-basic-25', label:'Ena', pack:'basic', age:'senior', gender:'f', skin:'#edcfbb', hair:'#f8fafc', accent:'#f97316', shirt:'#fdba74' },
  { id:'ava-basic-26', label:'Kian', pack:'basic', age:'adult', gender:'m', skin:'#8b5e45', hair:'#201a17', accent:'#84cc16', shirt:'#d9f99d' },
  { id:'ava-basic-27', label:'Sofi', pack:'basic', age:'teen', gender:'f', skin:'#f5ddcd', hair:'#4c1d95', accent:'#ec4899', shirt:'#f9a8d4' },
  { id:'ava-basic-28', label:'Deni', pack:'basic', age:'adult', gender:'x', skin:'#bf8964', hair:'#09090b', accent:'#0ea5e9', shirt:'#bae6fd' },
  { id:'ava-basic-29', label:'Aya', pack:'basic', age:'adult', gender:'f', skin:'#5d392c', hair:'#111111', accent:'#f59e0b', shirt:'#fde68a' },
  { id:'ava-basic-30', label:'Leo', pack:'basic', age:'adult', gender:'m', skin:'#efcfb8', hair:'#1f2937', accent:'#22c55e', shirt:'#bbf7d0' },
].map((avatar, index) => ({ ...avatar, locked_by: 'none', sort_order: index + 1, active: true }));

const PREMIUM_AVATARS = [
  { id:'ava-premium-01', label:'Neon Star', pack:'premium', image_url:'/avatars/premium/ava-premium-01.png', price_gems:20, locked_by:'purchase', sort_order:101, active:true },
  { id:'ava-premium-02', label:'Blue Rebel', pack:'premium', image_url:'/avatars/premium/ava-premium-02.png', price_gems:20, locked_by:'purchase', sort_order:102, active:true },
  { id:'ava-premium-03', label:'Quiz Queen', pack:'premium', image_url:'/avatars/premium/ava-premium-03.png', price_gems:20, locked_by:'purchase', sort_order:103, active:true },
  { id:'ava-premium-04', label:'Teal Ace', pack:'premium', image_url:'/avatars/premium/ava-premium-04.png', price_gems:20, locked_by:'purchase', sort_order:104, active:true },
];

function renderBasicAvatarSvg(avatar) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none">
      <rect width="96" height="96" rx="24" fill="${avatar.accent}"/>
      <circle cx="48" cy="40" r="24" fill="${avatar.skin}"/>
      <path d="M24 39c0-16 12-28 24-28s24 12 24 28v6H24v-6Z" fill="${avatar.hair}"/>
      <circle cx="39" cy="42" r="3.2" fill="#111014"/>
      <circle cx="57" cy="42" r="3.2" fill="#111014"/>
      <path d="M41 54c2 2 4.4 3 7 3s5-1 7-3" stroke="#111014" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M20 96c2-20 14-31 28-31s26 11 28 31H20Z" fill="${avatar.shirt}"/>
      <circle cx="48" cy="56" r="4" fill="${avatar.skin}" opacity=".45"/>
    </svg>
  `.trim();
}

function getBasicAvatarImageUrl(avatar) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderBasicAvatarSvg(avatar))}`;
}

const BASIC_AVATARS_WITH_IMAGES = BASIC_AVATARS.map(avatar => ({ ...avatar, image_url: getBasicAvatarImageUrl(avatar) }));
const AVATAR_LIBRARY = [...BASIC_AVATARS_WITH_IMAGES, ...PREMIUM_AVATARS];
const AVATAR_MAP = Object.fromEntries(AVATAR_LIBRARY.map(avatar => [avatar.id, avatar]));
const BASIC_IDS = BASIC_AVATARS_WITH_IMAGES.map(avatar => avatar.id);

function getAvatarOption(id) {
  return id ? AVATAR_MAP[id] || null : null;
}

function getAvatarCatalog() {
  return {
    basic: BASIC_AVATARS_WITH_IMAGES,
    premium: PREMIUM_AVATARS,
    all: AVATAR_LIBRARY,
  };
}

function getAvatarUrl(id, fallbackUrl = null) {
  return getAvatarOption(id)?.image_url || fallbackUrl || null;
}

module.exports = {
  DEFAULT_AVATAR_ID,
  BASIC_AVATARS: BASIC_AVATARS_WITH_IMAGES,
  PREMIUM_AVATARS,
  AVATAR_LIBRARY,
  BASIC_IDS,
  getAvatarOption,
  getAvatarCatalog,
  getAvatarUrl,
};
