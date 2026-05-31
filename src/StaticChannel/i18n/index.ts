type Locale = 'en' | 'zh';

const STR: Record<Locale, Record<string, string>> = {
  en: {
    'hint.drag': 'drag the screen to tune',
    'tuning.in': 'TUNING IN…',
    'tuning.snow': 'NO SIGNAL',
    'tuning.gen_first': 'pulling something in…',
    'tuning.gen_image': 'the picture is coming up…',
    'tuning.retry': 'signal lost · trying again',
    'tuning.error': 'dead air · try another frequency',
    'channel.now': 'NOW PLAYING',
    'save.saved': 'KEPT',
    'save.keep': 'KEEP',
    'wall.title': "tonight's signals",
    'wall.tab_wall': "tonight",
    'wall.tab_mine': "kept",
    'wall.empty_wall': 'nobody else is tuned in',
    'wall.empty_mine': 'no channels kept yet · drag the screen to find one',
    'wall.you': 'YOU',
    'wall.by': 'tuned by',
    'wall.jump': 'jump to {f} MHz',
    'wall.close': 'tap anywhere to close',
    'nav.tv': 'TV',
    'nav.wall': 'WALL',
    'mute.on': 'SOUND ON',
    'mute.off': 'MUTED',
  },
  zh: {
    'hint.drag': '左右拖动屏幕调台',
    'tuning.in': '正在调频…',
    'tuning.snow': '无信号',
    'tuning.gen_first': '正在拉一个频道进来…',
    'tuning.gen_image': '画面就要出来了…',
    'tuning.retry': '信号弱了 · 再试',
    'tuning.error': '一片死寂 · 换个频率',
    'channel.now': '正在播放',
    'save.saved': '已留下',
    'save.keep': '留下',
    'wall.title': '今夜的信号',
    'wall.tab_wall': '今夜',
    'wall.tab_mine': '留下的',
    'wall.empty_wall': '别的电视都没开机',
    'wall.empty_mine': '还没留下频道 · 拖动屏幕找一个',
    'wall.you': '你',
    'wall.by': '调到的人',
    'wall.jump': '跳到 {f} MHz',
    'wall.close': '点任意处关闭',
    'nav.tv': '电视',
    'nav.wall': '收藏',
    'mute.on': '有声',
    'mute.off': '静音',
  },
};

function detectLocale(): Locale {
  try {
    const o = localStorage.getItem('static_channel_locale');
    if (o === 'en' || o === 'zh') return o;
  } catch (_) {}
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let LOCALE: Locale = detectLocale();

export function t(key: string, vars?: { n?: number | string; f?: number | string }): string {
  let s = STR[LOCALE][key];
  if (!s) return key;
  if (vars?.n != null) s = s.replace('{n}', String(vars.n));
  if (vars?.f != null) s = s.replace('{f}', String(vars.f));
  return s;
}
export function locale(): Locale { return LOCALE; }
