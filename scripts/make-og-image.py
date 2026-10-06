#!/usr/bin/env python3
"""生成站点默认社交分享图 public/og-default.png（1200×630）。

为什么是 Python：本项目工具链是 Node，但生成一次性静态图没必要引入 JS 图像依赖；
本脚本**不是项目依赖**，只在需要重做这张图时手工跑一次，产物（PNG）才入库。

依赖：Pillow（本机 DSH 自带运行时里有；也可 pip install pillow）
用法：python scripts/make-og-image.py

配色取自 src/styles/tokens.css：宣纸 #f9f8f5、墨 #1f2124、淡墨 #5c6370、
最淡 #9ca3af、朱砂 #a61b29。字体用系统自带的华文楷体 + Georgia。
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover - 仅手工运行
    raise SystemExit("缺少 Pillow：pip install pillow")

W, H = 1200, 630
PAPER = (249, 248, 245)
INK = (31, 33, 36)
INK_MUTED = (92, 99, 112)
INK_FAINT = (156, 163, 175)
SEAL = (166, 27, 41)
HAIRLINE = (232, 230, 225)

FONT_KAI = r"C:\Windows\Fonts\STKAITI.TTF"
FONT_SERIF = r"C:\Windows\Fonts\georgia.ttf"
FONT_MONO = r"C:\Windows\Fonts\consola.ttf"

OUT = Path(__file__).resolve().parent.parent / "public" / "og-default.png"


def load(path: str, size: int, fallback: str) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.truetype(fallback, size)


def main() -> int:
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)

    # 内外两层细边框：仿宣纸上的界格
    d.rectangle([0, 0, W - 1, H - 1], outline=HAIRLINE, width=2)
    d.rectangle([26, 26, W - 27, H - 27], outline=HAIRLINE, width=1)

    # 右下角极淡的「墨」字水印（与文章卡片同款处理）
    watermark = load(FONT_KAI, 300, FONT_KAI)
    d.text((W - 250, H - 300), "墨", font=watermark, fill=(240, 238, 233))

    # 朱砂小印（与文章页脚同一枚「雪」印）
    seal_size, seal_xy = 122, (958, 150)
    d.rounded_rectangle(
        [seal_xy[0], seal_xy[1], seal_xy[0] + seal_size, seal_xy[1] + seal_size],
        radius=10,
        fill=SEAL,
    )
    seal_font = load(FONT_KAI, 74, FONT_KAI)
    d.text(
        (seal_xy[0] + seal_size / 2, seal_xy[1] + seal_size / 2 + 6),
        "雪",
        font=seal_font,
        fill=PAPER,
        anchor="mm",
    )

    # 主标题
    d.text((86, 232), "yuki's stop", font=load(FONT_SERIF, 86, FONT_SERIF), fill=INK)

    # 朱砂短线 + 副标题
    d.rectangle([90, 358, 210, 362], fill=SEAL)
    d.text(
        (86, 396),
        "诗词 · 照片与工具",
        font=load(FONT_KAI, 40, FONT_KAI),
        fill=INK_MUTED,
    )

    # 左下角落款
    d.text((88, H - 88), "yukinova.top", font=load(FONT_MONO, 22, FONT_MONO), fill=INK_FAINT)

    img.save(OUT, "PNG", optimize=True)
    print(f"已生成 {OUT} ({OUT.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
