import { syntaxTree } from '@codemirror/language';
import { markdownLanguage } from '@codemirror/lang-markdown';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from '@codemirror/view';
import type { EditorState, Range } from '@codemirror/state';
import { type CompletionContext, type CompletionResult } from '@codemirror/autocomplete';

/**
 * Curated map of ~200 common emoji shortcodes to unicode characters.
 * Follows GitHub / Slack style `:shortcode:` conventions.
 */
export const emojiMap: Record<string, string> = {
  // Smileys & Emotion
  smile: '\u{1F604}',
  laughing: '\u{1F606}',
  blush: '\u{1F60A}',
  smiley: '\u{1F603}',
  grinning: '\u{1F600}',
  grin: '\u{1F601}',
  joy: '\u{1F602}',
  rofl: '\u{1F923}',
  relaxed: '\u263A\uFE0F',
  wink: '\u{1F609}',
  heart_eyes: '\u{1F60D}',
  kissing_heart: '\u{1F618}',
  kissing: '\u{1F617}',
  yum: '\u{1F60B}',
  stuck_out_tongue: '\u{1F61B}',
  stuck_out_tongue_winking_eye: '\u{1F61C}',
  stuck_out_tongue_closed_eyes: '\u{1F61D}',
  sunglasses: '\u{1F60E}',
  star_struck: '\u{1F929}',
  thinking: '\u{1F914}',
  raised_eyebrow: '\u{1F928}',
  neutral_face: '\u{1F610}',
  expressionless: '\u{1F611}',
  unamused: '\u{1F612}',
  rolling_eyes: '\u{1F644}',
  grimacing: '\u{1F62C}',
  lying_face: '\u{1F925}',
  relieved: '\u{1F60C}',
  pensive: '\u{1F614}',
  sleepy: '\u{1F62A}',
  sleeping: '\u{1F634}',
  drooling_face: '\u{1F924}',
  mask: '\u{1F637}',
  hugs: '\u{1F917}',
  shushing_face: '\u{1F92B}',
  zipper_mouth: '\u{1F910}',
  money_mouth: '\u{1F911}',
  nerd: '\u{1F913}',
  confused: '\u{1F615}',
  worried: '\u{1F61F}',
  slightly_frowning_face: '\u{1F641}',
  frowning: '\u2639\uFE0F',
  open_mouth: '\u{1F62E}',
  hushed: '\u{1F62F}',
  astonished: '\u{1F632}',
  flushed: '\u{1F633}',
  pleading_face: '\u{1F97A}',
  cry: '\u{1F622}',
  sob: '\u{1F62D}',
  scream: '\u{1F631}',
  fearful: '\u{1F628}',
  cold_sweat: '\u{1F630}',
  disappointed: '\u{1F61E}',
  sweat: '\u{1F613}',
  angry: '\u{1F620}',
  rage: '\u{1F621}',
  triumph: '\u{1F624}',
  skull: '\u{1F480}',
  poop: '\u{1F4A9}',
  clown: '\u{1F921}',
  ghost: '\u{1F47B}',
  alien: '\u{1F47E}',
  robot: '\u{1F916}',
  smiling_imp: '\u{1F608}',
  imp: '\u{1F47F}',

  // Gestures & People
  wave: '\u{1F44B}',
  raised_hand: '\u270B',
  ok_hand: '\u{1F44C}',
  thumbsup: '\u{1F44D}',
  '+1': '\u{1F44D}',
  thumbsdown: '\u{1F44E}',
  '-1': '\u{1F44E}',
  clap: '\u{1F44F}',
  pray: '\u{1F64F}',
  handshake: '\u{1F91D}',
  point_up: '\u261D\uFE0F',
  point_down: '\u{1F447}',
  point_left: '\u{1F448}',
  point_right: '\u{1F449}',
  muscle: '\u{1F4AA}',
  fist: '\u270A',
  punch: '\u{1F44A}',
  v: '\u270C\uFE0F',
  crossed_fingers: '\u{1F91E}',
  metal: '\u{1F918}',
  eyes: '\u{1F440}',
  brain: '\u{1F9E0}',

  // Hearts & Symbols
  heart: '\u2764\uFE0F',
  orange_heart: '\u{1F9E1}',
  yellow_heart: '\u{1F49B}',
  green_heart: '\u{1F49A}',
  blue_heart: '\u{1F499}',
  purple_heart: '\u{1F49C}',
  black_heart: '\u{1F5A4}',
  broken_heart: '\u{1F494}',
  sparkling_heart: '\u{1F496}',
  heartbeat: '\u{1F493}',
  heartpulse: '\u{1F497}',
  two_hearts: '\u{1F495}',
  revolving_hearts: '\u{1F49E}',
  cupid: '\u{1F498}',
  gift_heart: '\u{1F49D}',
  heart_exclamation: '\u2763\uFE0F',
  '100': '\u{1F4AF}',
  boom: '\u{1F4A5}',
  star: '\u2B50',
  star2: '\u{1F31F}',
  sparkles: '\u2728',
  zap: '\u26A1',
  fire: '\u{1F525}',

  // Nature & Animals
  dog: '\u{1F436}',
  cat: '\u{1F431}',
  mouse: '\u{1F42D}',
  hamster: '\u{1F439}',
  rabbit: '\u{1F430}',
  fox: '\u{1F98A}',
  bear: '\u{1F43B}',
  panda_face: '\u{1F43C}',
  koala: '\u{1F428}',
  lion: '\u{1F981}',
  unicorn: '\u{1F984}',
  bee: '\u{1F41D}',
  butterfly: '\u{1F98B}',
  turtle: '\u{1F422}',
  snake: '\u{1F40D}',
  octopus: '\u{1F419}',
  whale: '\u{1F433}',
  dolphin: '\u{1F42C}',
  bird: '\u{1F426}',
  penguin: '\u{1F427}',
  chicken: '\u{1F414}',
  eagle: '\u{1F985}',

  // Plants
  sunflower: '\u{1F33B}',
  rose: '\u{1F339}',
  tulip: '\u{1F337}',
  cherry_blossom: '\u{1F338}',
  bouquet: '\u{1F490}',
  seedling: '\u{1F331}',
  evergreen_tree: '\u{1F332}',
  deciduous_tree: '\u{1F333}',
  palm_tree: '\u{1F334}',
  cactus: '\u{1F335}',
  herb: '\u{1F33F}',
  four_leaf_clover: '\u{1F340}',
  mushroom: '\u{1F344}',

  // Food & Drink
  apple: '\u{1F34E}',
  green_apple: '\u{1F34F}',
  banana: '\u{1F34C}',
  grapes: '\u{1F347}',
  watermelon: '\u{1F349}',
  strawberry: '\u{1F353}',
  peach: '\u{1F351}',
  cherry: '\u{1F352}',
  avocado: '\u{1F951}',
  pizza: '\u{1F355}',
  hamburger: '\u{1F354}',
  taco: '\u{1F32E}',
  burrito: '\u{1F32F}',
  egg: '\u{1F95A}',
  coffee: '\u2615',
  tea: '\u{1F375}',
  beer: '\u{1F37A}',
  wine_glass: '\u{1F377}',
  cocktail: '\u{1F378}',
  ice_cream: '\u{1F368}',
  cake: '\u{1F370}',
  cookie: '\u{1F36A}',
  chocolate_bar: '\u{1F36B}',
  candy: '\u{1F36C}',
  popcorn: '\u{1F37F}',

  // Objects & Activities
  soccer: '\u26BD',
  basketball: '\u{1F3C0}',
  football: '\u{1F3C8}',
  baseball: '\u26BE',
  tennis: '\u{1F3BE}',
  trophy: '\u{1F3C6}',
  medal: '\u{1F3C5}',
  guitar: '\u{1F3B8}',
  microphone: '\u{1F3A4}',
  headphones: '\u{1F3A7}',
  art: '\u{1F3A8}',
  movie_camera: '\u{1F3A5}',
  video_game: '\u{1F3AE}',
  dart: '\u{1F3AF}',
  dice: '\u{1F3B2}',
  tada: '\u{1F389}',
  confetti_ball: '\u{1F38A}',
  balloon: '\u{1F388}',
  gift: '\u{1F381}',
  ribbon: '\u{1F380}',

  // Travel & Places
  car: '\u{1F697}',
  taxi: '\u{1F695}',
  bus: '\u{1F68C}',
  airplane: '\u2708\uFE0F',
  rocket: '\u{1F680}',
  ship: '\u{1F6A2}',
  bike: '\u{1F6B2}',
  train: '\u{1F686}',
  house: '\u{1F3E0}',
  office: '\u{1F3E2}',
  hospital: '\u{1F3E5}',
  tent: '\u26FA',
  earth_americas: '\u{1F30E}',
  earth_africa: '\u{1F30D}',
  earth_asia: '\u{1F30F}',
  moon: '\u{1F319}',
  full_moon: '\u{1F315}',
  sun: '\u2600\uFE0F',
  rainbow: '\u{1F308}',
  cloud: '\u2601\uFE0F',
  umbrella: '\u2614',
  snowflake: '\u2744\uFE0F',
  snowman: '\u26C4',

  // Tech & Objects
  computer: '\u{1F4BB}',
  keyboard: '\u2328\uFE0F',
  phone: '\u{1F4F1}',
  camera: '\u{1F4F7}',
  bulb: '\u{1F4A1}',
  wrench: '\u{1F527}',
  hammer: '\u{1F528}',
  gear: '\u2699\uFE0F',
  link: '\u{1F517}',
  lock: '\u{1F512}',
  unlock: '\u{1F513}',
  key: '\u{1F511}',
  mag: '\u{1F50D}',
  bell: '\u{1F514}',
  loudspeaker: '\u{1F4E2}',
  mega: '\u{1F4E3}',
  envelope: '\u2709\uFE0F',
  inbox_tray: '\u{1F4E5}',
  outbox_tray: '\u{1F4E4}',
  package: '\u{1F4E6}',
  memo: '\u{1F4DD}',
  pencil: '\u270F\uFE0F',
  book: '\u{1F4D6}',
  bookmark: '\u{1F516}',
  clipboard: '\u{1F4CB}',
  calendar: '\u{1F4C5}',
  chart: '\u{1F4CA}',
  pushpin: '\u{1F4CC}',
  paperclip: '\u{1F4CE}',
  scissors: '\u2702\uFE0F',
  wastebasket: '\u{1F5D1}\uFE0F',
  file_folder: '\u{1F4C1}',

  // Misc symbols
  check: '\u2705',
  x: '\u274C',
  warning: '\u26A0\uFE0F',
  no_entry: '\u26D4',
  question: '\u2753',
  exclamation: '\u2757',
  info: '\u2139\uFE0F',
  arrow_right: '\u27A1\uFE0F',
  arrow_left: '\u2B05\uFE0F',
  arrow_up: '\u2B06\uFE0F',
  arrow_down: '\u2B07\uFE0F',
  recycle: '\u267B\uFE0F',
  white_check_mark: '\u2705',
  heavy_check_mark: '\u2714\uFE0F',
  ballot_box_with_check: '\u2611\uFE0F',
  hourglass: '\u231B',
  clock: '\u{1F570}\uFE0F',
  flag: '\u{1F3F4}',
};

/** Sorted list of shortcode entries for autocomplete. */
const emojiEntries: Array<{ shortcode: string; emoji: string }> = Object.entries(emojiMap)
  .map(([shortcode, emoji]) => ({ shortcode, emoji }))
  .sort((a, b) => a.shortcode.localeCompare(b.shortcode));

/** Regex to match `:shortcode:` patterns. */
const SHORTCODE_RE = /:([a-z0-9_+\-]+):/g;

/** Node names that indicate code context where shortcodes should NOT be replaced. */
const CODE_NODES = new Set([
  'FencedCode',
  'CodeBlock',
  'InlineCode',
  'CodeText',
  'CodeMark',
  'CodeInfo',
]);

/**
 * Check whether a position falls inside a code block or inline code span
 * by walking up the syntax tree.
 */
function isInsideCode(state: EditorState, from: number, to: number): boolean {
  const tree = syntaxTree(state);
  // Check from the start position
  let node = tree.resolveInner(from, 1);
  while (node) {
    if (CODE_NODES.has(node.name)) return true;
    if (!node.parent || node.parent === node) break;
    node = node.parent;
  }
  // Also check from the end position
  node = tree.resolveInner(to, -1);
  while (node) {
    if (CODE_NODES.has(node.name)) return true;
    if (!node.parent || node.parent === node) break;
    node = node.parent;
  }
  return false;
}

/**
 * Widget that renders the emoji character in place of the `:shortcode:` text.
 */
class EmojiWidget extends WidgetType {
  constructor(readonly emoji: string, readonly shortcode: string) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-emoji';
    span.textContent = this.emoji;
    span.setAttribute('title', `:${this.shortcode}:`);
    return span;
  }

  eq(other: EmojiWidget): boolean {
    return this.emoji === other.emoji && this.shortcode === other.shortcode;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Build decorations that replace `:shortcode:` with emoji widgets,
 * except on cursor lines and inside code blocks/spans.
 */
function buildEmojiDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  // Determine which lines the cursor is on (for cursor-reveal)
  const cursorLines = new Set<number>();
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;
    for (let l = startLine; l <= endLine; l++) {
      cursorLines.add(l);
    }
  }

  // Scan the document text for :shortcode: patterns
  const docText = state.doc.toString();
  SHORTCODE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SHORTCODE_RE.exec(docText)) !== null) {
    const shortcode = match[1];
    const emoji = emojiMap[shortcode];
    if (!emoji) continue;

    const from = match.index;
    const to = from + match[0].length;

    // Skip if cursor is on this line
    const line = state.doc.lineAt(from);
    if (cursorLines.has(line.number)) continue;

    // Skip if inside code block or inline code
    if (isInsideCode(state, from, to)) continue;

    decorations.push(
      Decoration.replace({
        widget: new EmojiWidget(emoji, shortcode),
      }).range(from, to),
    );
  }

  return Decoration.set(decorations);
}

/**
 * ViewPlugin that live-previews `:shortcode:` as emoji characters.
 * Reveals raw shortcode text when the cursor is on the same line.
 */
export const emojiDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildEmojiDecorations(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildEmojiDecorations(update.state);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

/**
 * CM6 autocompletion source that triggers after typing `:` and shows
 * matching emoji suggestions with preview.
 */
function emojiCompletionSource(context: CompletionContext): CompletionResult | null {
  // Do not offer completions inside code blocks or inline code
  if (isInsideCode(context.state, context.pos, context.pos)) return null;

  // Match a colon followed by at least 2 characters of the shortcode name
  const word = context.matchBefore(/:[a-z0-9_+\-]{2,}$/);
  if (!word) return null;

  // Extract the partial shortcode (after the colon)
  const query = word.text.slice(1).toLowerCase();

  const options = emojiEntries
    .filter((e) => e.shortcode.includes(query))
    .slice(0, 50)
    .map((e) => ({
      label: `:${e.shortcode}:`,
      displayLabel: `${e.emoji} :${e.shortcode}:`,
      apply: e.emoji,
      type: 'text' as const,
      boost: e.shortcode.startsWith(query) ? 1 : 0,
    }));

  if (options.length === 0) return null;

  return {
    from: word.from,
    options,
    validFor: /^:[a-z0-9_+\-]*$/,
  };
}

/**
 * CM6 autocompletion extension for emoji shortcodes.
 * Registered as markdown language data so it coexists with other completion
 * sources rather than replacing them.
 * Provides suggestions when the user types `:` followed by at least 2 characters.
 */
export const emojiAutocomplete = markdownLanguage.data.of({
  autocomplete: emojiCompletionSource,
});

/**
 * Replace all known `:shortcode:` patterns in a markdown string with their
 * emoji characters. Skips shortcodes inside fenced code blocks and inline code.
 */
export function replaceEmojiShortcodes(markdown: string): string {
  // Protect code blocks and inline code from replacement
  const codeBlocks: Array<{ start: number; end: number }> = [];

  // Find fenced code blocks (```...```)
  const fencedRe = /^(`{3,}|~{3,}).*\n[\s\S]*?^\1\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = fencedRe.exec(markdown)) !== null) {
    codeBlocks.push({ start: m.index, end: m.index + m[0].length });
  }

  // Find inline code (`...`)
  const inlineCodeRe = /`[^`\n]+`/g;
  while ((m = inlineCodeRe.exec(markdown)) !== null) {
    codeBlocks.push({ start: m.index, end: m.index + m[0].length });
  }

  return markdown.replace(SHORTCODE_RE, (match, shortcode, offset) => {
    // Check if this match falls inside any code block
    for (const block of codeBlocks) {
      if (offset >= block.start && offset < block.end) {
        return match;
      }
    }
    return emojiMap[shortcode] ?? match;
  });
}
