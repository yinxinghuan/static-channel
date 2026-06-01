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
    'tuning.extending': 'staying on the air…',
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
    'ticker.empty': 'nothing on the wire yet · be the first',
    'ticker.added': 'added to {f}',
    'ticker.new_pill': '{n} new',
    'ticker.open_wall': 'open wall',
    'stay.placeholder': 'what plays next?',
    'stay.send': 'STAY ON AIR',
    'stay.sending': 'on air…',
    'stay.disabled_no_signal': 'tune in first',
    'segments.count': '{n} segments',
    'segments.count_one': '1 segment',
    'segments.latest_by': 'latest · {who}',
    'broadcast.no_signal_yet': 'first to tune in here',
  },
  zh: {
    'hint.drag': '左右拖动屏幕调台',
    'tuning.in': '正在调频…',
    'tuning.snow': '无信号',
    'tuning.gen_first': '正在拉一个频道进来…',
    'tuning.gen_image': '画面就要出来了…',
    'tuning.retry': '信号弱了 · 再试',
    'tuning.error': '一片死寂 · 换个频率',
    'tuning.extending': '正在续播…',
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
    'ticker.empty': '线路上还没动静 · 你来做第一个',
    'ticker.added': '续到了 {f}',
    'ticker.new_pill': '{n} 条新',
    'ticker.open_wall': '打开收藏',
    'stay.placeholder': '接下来播什么？',
    'stay.send': '接着播',
    'stay.sending': '直播中…',
    'stay.disabled_no_signal': '先调进信号',
    'segments.count': '{n} 段',
    'segments.count_one': '1 段',
    'segments.latest_by': '最新 · {who}',
    'broadcast.no_signal_yet': '这条线还没人调到过',
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

export function t(key: string, vars?: { n?: number | string; f?: number | string; who?: string }): string {
  let s = STR[LOCALE][key];
  if (!s) return key;
  if (vars?.n != null) s = s.replace('{n}', String(vars.n));
  if (vars?.f != null) s = s.replace('{f}', String(vars.f));
  if (vars?.who != null) s = s.replace('{who}', String(vars.who));
  return s;
}
export function locale(): Locale { return LOCALE; }
