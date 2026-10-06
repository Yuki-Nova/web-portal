/**
 * 诗词「笺纸卡片」渲染（纯 canvas，零依赖，浏览器端运行）。
 *
 * 版式：宣纸底 + 双层细界格；标题横排居左上；正文**竖排**、自右向左逐列；
 * 同一句内按标点断成短列，原诗的「行」（上阕/下阕、每一联）之间留更宽的列间距；
 * 左下角一枚朱砂小印（与文章页脚同一枚「雪」印），右下角落款。
 *
 * 为什么用 canvas 而不是 SVG：需要一键导出 PNG（下载/写剪贴板），
 * canvas 的 toDataURL/toBlob 是浏览器原生能力，不需要任何依赖或服务端渲染。
 *
 * 字体走系统字体栈（楷体优先），因此**导出结果依赖本机字体**：Windows 上是楷体，
 * macOS 上是 Kaiti SC，都没有时回退宋体/衬线体——版式不会崩，只是字形不同。
 */
const PAPER = '#f9f8f5';
const INK = '#1f2124';
const INK_FAINT = '#9ca3af';
const SEAL = '#a61b29';
const HAIRLINE = '#e8e6e1';
const FONT_KAI = '"Kaiti SC", "KaiTi", "STKaiti", "Noto Serif SC", "Songti SC", serif';
const FONT_SERIF = 'Georgia, "Times New Roman", serif';

const CHAR_SIZE = 58;
const CHAR_LINE = 1.18;
const COL_STEP = 84;
const TITLE_SIZE = 42;
const META_SIZE = 20;
/** 同句内两列 vs 换行两列之间的额外间距差 */
const GROUP_GAP = 34;
/** 每幅最多排多少列，超出换下一幅（避免长调排成两三米宽的窄带） */
const BAND_COLUMNS = 10;
/** 幅与幅之间的纵向间距 */
const BAND_GAP = 62;

/** 把一个「行」按标点断成短列（标点保留在列末尾）。 */
function sliceClauses(line) {
  return line
    .split(/(?<=[，。；：、？！,.!?;])/)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

/** 把若干「行」切成竖排组：外层是原行，内层是该行按标点断出的短列。 */
function toGroups(lines) {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map(sliceClauses)
    .filter((group) => group.length > 0);
}

/**
 * 把 markdown 正文切成「竖排组」：外层是原诗的行，内层是该行按标点断出的短列。
 * 只做展示用切分，不改动任何文字（标点保留在每列末尾）。
 */
export function splitPoemGroups(body) {
  return toGroups(
    String(body ?? '')
      .replace(/[*_`>#]/g, '')
      .split(/\r?\n/),
  );
}

/**
 * 从诗词墙用的 HTML 片段取竖排组。
 *
 * 诗词墙的数据源 `src/data/poetry-wall.json` 里存的是 HTML（`<p>` 分段、`<br>` 断行），
 * 不是 markdown，所以单开一个入口；这里只做最小实体还原，不引入 HTML 解析器。
 */
export function splitGroupsFromHtml(html) {
  const text = String(html ?? '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&amp;/gi, '&');

  return toGroups(text.split(/\r?\n/));
}

/**
 * 渲染卡片并返回 canvas（不插入 DOM，由调用方决定怎么用）。
 * @param {{title: string, groups: string[][], date?: string, tags?: string[], seal?: string, brand?: string}} data
 * @param {{scale?: number}} [options] scale 为像素倍率（导出用 2 = 高清）
 */
export function renderPoemCard(data, options = {}) {
  const scale = options.scale ?? 2;
  const { title = '', groups = [], date = '', tags = [], seal = '雪', brand = 'yukinova.top' } = data;

  // 摊平成列，同时记录每列之前应额外留出的组间距
  const columns = [];
  groups.slice(0, 16).forEach((group, groupIndex) => {
    group.slice(0, 8).forEach((clause, clauseIndex) => {
      columns.push({
        text: clause,
        gapBefore: clauseIndex === 0 && groupIndex > 0 ? GROUP_GAP : 0,
      });
    });
  });
  if (columns.length === 0) columns.push({ text: title || '（无正文）', gapBefore: 0 });

  // 分「幅」：一首长调（如 27 列的《水龙吟》）排成一整条会变成两三米宽的窄带，
  // 既不像笺纸也没法分享。超过 BAND_COLUMNS 列就换下一幅，幅幅自上而下堆叠。
  const bands = [];
  for (let i = 0; i < columns.length; i += BAND_COLUMNS) {
    const slice = columns.slice(i, i + BAND_COLUMNS).map((c, idx) => ({
      ...c,
      // 每幅的第一列不继承组间距（那是上一幅的断点，不是本幅的首列）
      gapBefore: idx === 0 ? 0 : c.gapBefore,
    }));
    bands.push({
      columns: slice,
      width: slice.reduce((sum, c) => sum + COL_STEP + c.gapBefore, 0),
      lines: Math.max(1, ...slice.map((c) => [...c.text].length)),
    });
  }

  const padX = 104;
  const padTop = 140;
  const padBottom = 132;
  const bandsWidth = Math.max(...bands.map((b) => b.width));
  const bandsHeight = bands.reduce((sum, b) => sum + b.lines * CHAR_SIZE * CHAR_LINE, 0);

  // 先建 canvas 只是为了拿 ctx 量字：标题（如「雨后花枝尽伏2024.6.17」）比短诗的正文还宽，
  // 量完后把标题/副信息所需宽度并进卡片宽度，否则宽标题会被裁掉。
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `600 ${TITLE_SIZE}px ${FONT_KAI}`;
  const titleWidth = ctx.measureText(title).width;
  const metaText = [date, ...(tags ?? [])].filter(Boolean).join(' · ');
  ctx.font = `${META_SIZE}px ${FONT_KAI}`;
  const metaWidth = metaText ? ctx.measureText(metaText).width : 0;

  const contentWidth = padX * 2 + Math.max(bandsWidth + 24, titleWidth + metaWidth + 56);
  const width = Math.max(560, contentWidth);
  const height = Math.max(
    620,
    padTop + bandsHeight + (bands.length - 1) * BAND_GAP + padBottom,
  );

  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  ctx.scale(scale, scale);

  // 宣纸底 + 双层界格
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);
  ctx.lineWidth = 1;
  ctx.strokeRect(26, 26, width - 52, height - 52);

  // 标题（横排，左上）
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = INK;
  ctx.font = `600 ${TITLE_SIZE}px ${FONT_KAI}`;
  ctx.fillText(title, padX - 26, 100);

  // 副信息（日期 · 标签，右上）
  if (metaText) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `${META_SIZE}px ${FONT_KAI}`;
    ctx.textAlign = 'right';
    ctx.fillText(metaText, width - (padX - 26), 96);
    ctx.textAlign = 'left';
  }

  // 正文竖排：自右向左逐列，逐幅自上而下
  ctx.font = `${CHAR_SIZE}px ${FONT_KAI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  let bandTop = padTop;
  bands.forEach((band) => {
    let cursorX = width - padX;
    band.columns.forEach((column) => {
      cursorX -= column.gapBefore;
      const cx = cursorX - CHAR_SIZE / 2;
      [...column.text].forEach((ch, charIndex) => {
        const cy = bandTop + CHAR_SIZE / 2 + charIndex * CHAR_SIZE * CHAR_LINE;
        ctx.fillText(ch, cx, cy);
      });
      cursorX -= COL_STEP;
    });
    bandTop += band.lines * CHAR_SIZE * CHAR_LINE + BAND_GAP;
  });

  // 朱砂小印（左下角）
  const sealSize = 76;
  const sealX = padX - 26;
  const sealY = height - padBottom + 26;
  const r = 8;
  ctx.fillStyle = SEAL;
  ctx.beginPath();
  ctx.moveTo(sealX + r, sealY);
  ctx.arcTo(sealX + sealSize, sealY, sealX + sealSize, sealY + sealSize, r);
  ctx.arcTo(sealX + sealSize, sealY + sealSize, sealX, sealY + sealSize, r);
  ctx.arcTo(sealX, sealY + sealSize, sealX, sealY, r);
  ctx.arcTo(sealX, sealY, sealX + sealSize, sealY, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.font = `46px ${FONT_KAI}`;
  ctx.fillText(seal, sealX + sealSize / 2, sealY + sealSize / 2 + 3);

  // 落款（与印同排，向右）
  ctx.fillStyle = INK_FAINT;
  ctx.font = `18px ${FONT_SERIF}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(brand, sealX + sealSize + 18, sealY + sealSize - 12);

  return canvas;
}

/** 导出 PNG Blob（供下载 / 写剪贴板）。 */
export function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob 返回空'));
    }, 'image/png');
  });
}
