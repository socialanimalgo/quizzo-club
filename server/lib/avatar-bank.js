const BASIC_AVATARS = Array.from({ length: 30 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `ava-basic-${number}`,
    pack: 'basic',
    label: `Basic ${number}`,
    image_url: `/avatars/basic/ava-basic-${number}.png`,
    price_gems: 0,
    locked_by: 'none',
    sort_order: index + 1,
    active: true,
  };
});

const PREMIUM_AVATARS = Array.from({ length: 4 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    id: `ava-premium-${number}`,
    pack: 'premium',
    label: `Premium ${number}`,
    image_url: `/avatars/premium/ava-premium-${number}.png`,
    price_gems: 20,
    locked_by: 'purchase',
    sort_order: index + 1,
    active: true,
  };
});

const AVATAR_LIBRARY = [...BASIC_AVATARS, ...PREMIUM_AVATARS];
const AVATAR_MAP = Object.fromEntries(AVATAR_LIBRARY.map(avatar => [avatar.id, avatar]));
const BASIC_IDS = BASIC_AVATARS.map(avatar => avatar.id);

function getAvatarOption(id) {
  return id ? AVATAR_MAP[id] || null : null;
}

function getAvatarCatalog() {
  return {
    basic: BASIC_AVATARS,
    premium: PREMIUM_AVATARS,
    all: AVATAR_LIBRARY,
  };
}

function getAvatarUrl(id, fallbackUrl = null) {
  return getAvatarOption(id)?.image_url || fallbackUrl || null;
}

module.exports = {
  BASIC_AVATARS,
  PREMIUM_AVATARS,
  AVATAR_LIBRARY,
  BASIC_IDS,
  getAvatarOption,
  getAvatarCatalog,
  getAvatarUrl,
};
