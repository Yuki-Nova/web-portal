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
/** 同句内两列 vs 换行两列之间的额外间距差 */
const GROUP_GAP = 34;

/**
 * 把正文切成「竖排组」：外层是原诗的行，内层是该行按标点断出的短列。
 * 只做展示用切分，不改动任何文字（标点保留在每列末尾）。
 */
export function splitPoemGroups(body) {
  return String(body ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/[*_`>#]/g, '').trim())
    .filter(Boolean)
    .map((line) =>
      line
        .split(/(?<=[，。；：、？！,.!?;])/)
        .map((clause) => clause.trim())
        .filter(Boolean),
    )
    .filter((group) => group.length > 0);
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

  const maxChars = Math.max(1, ...columns.map((c) => [...c.text].length));
  const columnsWidth = columns.reduce((sum, c) => sum + COL_STEP + c.gapBefore, 0);

  const padX = 104;
  const padTop = 140;
  const padBottom = 132;
  const width = Math.max(860, padX * 2 + columnsWidth + 24);
  const height = Math.max(680, padTop + maxChars * CHAR_SIZE * CHAR_LINE + padBottom);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
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
  ctx.font = `600 42px ${FONT_KAI}`;
  ctx.fillText(title, padX - 26, 100);

  // 副信息（日期 · 标签，右上）
  const meta = [date, ...(tags ?? [])].filter(Boolean).join(' · ');
  if (meta) {
    ctx.fillStyle = INK_FAINT;
    ctx.font = `20px ${FONT_KAI}`;
    ctx.textAlign = 'right';
    ctx.fillText(meta, width - (padX - 26), 96);
    ctx.textAlign = 'left';
  }

  // 正文竖排：自右向左逐列
  ctx.font = `${CHAR_SIZE}px ${FONT_KAI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  let cursorX = width - padX;
  columns.forEach((column) => {
    cursorX -= column.gapBefore;
    const cx = cursorX - CHAR_SIZE / 2;
    [...column.text].forEach((ch, charIndex) => {
      const cy = padTop + CHAR_SIZE / 2 + charIndex * CHAR_SIZE * CHAR_LINE;
      ctx.fillText(ch, cx, cy);
    });
    cursorX -= COL_STEP;
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
