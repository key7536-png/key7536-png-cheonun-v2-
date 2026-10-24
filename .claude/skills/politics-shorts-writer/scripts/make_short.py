#!/usr/bin/env python3
"""도파민 정치 템플릿으로 세로 쇼츠(1080x1920 mp4)를 만든다.

사용법:
    python3 make_short.py spec.json

spec.json 예시:
{
  "source": "original.mp4",            # 원본 영상 파일
  "output": "short.mp4",
  "title": ["첫째 줄 제목", "둘째 줄 강조"],  # 상단 제목 1~2줄
  "credit": "원본: ○○○ 채널",           # 원본 출처 표시 (필수)
  "segments": [                         # 원본에서 쓸 구간(초), 적힌 순서대로 이어 붙인다
    {"start": 83.2, "end": 95.0},
    {"start": 410.5, "end": 428.0}
  ],
  "captions": [                         # 완성본 시간 기준 자막 (없으면 source_subs로 자동 생성)
    {"start": 0.0, "end": 2.4, "text": "정부 설명에서 빠진 게 있습니다", "highlight": "빠진 게"}
  ],
  "source_subs": "original.ko.vtt",     # 선택: 원본 자막. captions가 없을 때 구간에 맞춰 자동 변환
  "voiceover": "narration.mp3",         # 선택: 해설 음성. 넣으면 원본 소리를 줄여서 섞는다
  "original_volume": 0.35,              # 선택: voiceover가 있을 때 원본 소리 크기
  "cut_marker": true,                   # 선택: 구간이 바뀔 때 "편집" 표시 (기본 true)
  "max_seconds": 60                     # 선택: 최대 길이 (기본 60)
}
"""
import json
import os
import re
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
FONTS = os.path.join(ASSETS, "fonts")
LOGO = os.path.join(ASSETS, "logo.png")
TITLE_FONT = os.path.join(FONTS, "BlackHanSans-Regular.ttf")
BODY_FONT = os.path.join(FONTS, "NanumGothic-ExtraBold.ttf")

W, H = 1080, 1920
CHANNEL_NAME = ("도파민", "정치")

# 로고 색에 맞춘 팔레트
LIME = (212, 255, 58)
PINK = (255, 46, 154)
YELLOW = (255, 230, 0)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
GRAY = (170, 170, 170)

# 영상 칸: 가로 영상은 16:9 칸, 세로 영상은 큰 칸
WIDE_SLOT = (0, 560, 1080, 608)       # x, y, w, h
TALL_SLOT = (140, 520, 800, 1000)


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-3000:])
        raise SystemExit(f"명령 실패: {' '.join(cmd[:3])} ...")
    return r.stdout


def probe(path):
    out = run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height",
               "-of", "json", path])
    streams = json.loads(out)["streams"]
    v = next(s for s in streams if s["codec_type"] == "video")
    has_audio = any(s["codec_type"] == "audio" for s in streams)
    return v["width"], v["height"], has_audio


def fit_font(path, text, max_w, size, min_size=48):
    while size > min_size:
        f = ImageFont.truetype(path, size)
        if f.getlength(text) <= max_w:
            return f
        size -= 4
    return ImageFont.truetype(path, min_size)


def build_frame(spec, slot, png_path):
    """비디오를 뺀 나머지(로고·채널명·제목·테두리·출처)를 한 장의 PNG로 그린다."""
    img = Image.new("RGBA", (W, H), BLACK + (255,))
    d = ImageDraw.Draw(img)

    # 로고 + 채널명
    logo = Image.open(LOGO).convert("RGBA").resize((130, 130), Image.LANCZOS)
    img.alpha_composite(logo, (40, 36))
    f = ImageFont.truetype(TITLE_FONT, 74)
    x = 190
    for word, color in zip(CHANNEL_NAME, (LIME, WHITE)):
        d.text((x, 62), word, font=f, fill=color, stroke_width=5, stroke_fill=PINK)
        x += f.getlength(word) + 22

    # 상단 제목 (1~2줄, 둘째 줄은 노란색 강조)
    lines = [t for t in spec.get("title", []) if t][:2]
    y = 210 if len(lines) == 2 else 260
    for i, line in enumerate(lines):
        font = fit_font(TITLE_FONT, line, W - 80, 108)
        tw = font.getlength(line)
        color = YELLOW if (i == 1 or len(lines) == 1) else WHITE
        d.text(((W - tw) / 2, y), line, font=font, fill=color, stroke_width=8, stroke_fill=BLACK)
        y += 132

    # 영상 칸 위아래 핑크 라인
    sx, sy, sw, sh = slot
    d.rectangle([0, sy - 10, W, sy - 1], fill=PINK)
    d.rectangle([0, sy + sh, W, sy + sh + 9], fill=PINK)

    # 원본 출처
    credit = spec.get("credit", "").strip()
    if credit:
        cf = ImageFont.truetype(BODY_FONT, 30)
        cw = cf.getlength(credit)
        d.text((W - cw - 30, sy + sh + 20), credit, font=cf, fill=GRAY)

    img.save(png_path)


def ass_time(t):
    t = max(0.0, t)
    h = int(t // 3600)
    m = int(t % 3600 // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def ass_escape(text):
    return text.replace("\\", "＼").replace("{", "(").replace("}", ")").replace("\n", "\\N")


def build_ass(captions, cut_times, slot, ass_path):
    sx, sy, sw, sh = slot
    # 자막은 영상 칸 바로 아래(세로 영상은 영상 위), 유튜브 하단 설명·버튼에 가리지 않는 높이까지만
    caption_bottom = H - min(sy + sh + 250, 1420)
    marker_y = sy + 24
    head = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,NanumGothicExtraBold,72,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,7,2,2,60,60,{caption_bottom},1
Style: Marker,NanumGothicExtraBold,34,&H00FFFFFF,&H00FFFFFF,&H009A2EFF,&H00000000,1,0,0,0,100,100,0,0,3,10,0,9,40,40,{marker_y},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    rows = []
    for c in captions:
        text = ass_escape(c["text"])
        hl = c.get("highlight")
        if hl and hl in c["text"]:
            text = text.replace(ass_escape(hl), "{\\c&H00E6FF&}" + ass_escape(hl) + "{\\c&HFFFFFF&}", 1)
        rows.append(f"Dialogue: 0,{ass_time(c['start'])},{ass_time(c['end'])},Caption,,0,0,0,,{text}")
    for t in cut_times:
        rows.append(f"Dialogue: 1,{ass_time(t)},{ass_time(t + 1.2)},Marker,,0,0,0,,✂ 편집")
    with open(ass_path, "w", encoding="utf-8") as fh:
        fh.write(head + "\n".join(rows) + "\n")


def parse_vtt(path):
    """VTT 자막을 [(start, end, text)]로 읽는다. 유튜브 자동자막의 겹치는 줄은 정리한다."""
    def secs(ts):
        parts = ts.replace(",", ".").split(":")
        parts = [float(p) for p in parts]
        while len(parts) < 3:
            parts.insert(0, 0.0)
        return parts[0] * 3600 + parts[1] * 60 + parts[2]

    cues, seen = [], set()
    with open(path, encoding="utf-8") as fh:
        blocks = fh.read().split("\n\n")
    for b in blocks:
        m = re.search(r"([\d:.,]+)\s*-->\s*([\d:.,]+)", b)
        if not m:
            continue
        body = b[m.end():].split("\n", 1)[1] if "\n" in b[m.end():] else ""
        lines = [re.sub(r"<[^>]+>", "", l).strip() for l in body.split("\n")]
        lines = [l for l in lines if l and l not in seen]
        if not lines:
            continue
        seen.update(lines)
        cues.append((secs(m.group(1)), secs(m.group(2)), " ".join(lines)))
    return cues


def captions_from_subs(cues, segments):
    """원본 자막을 잘라 붙인 구간의 시간축(완성본 기준)으로 옮긴다."""
    out, offset = [], 0.0
    for seg in segments:
        s, e = seg["start"], seg["end"]
        for cs, ce, text in cues:
            if ce <= s or cs >= e:
                continue
            out.append({"start": offset + max(cs, s) - s, "end": offset + min(ce, e) - s, "text": text})
        offset += e - s
    return out


def render(spec):
    src = spec["source"]
    segs = spec["segments"]
    if not segs:
        raise SystemExit("segments가 비어 있습니다.")
    if not spec.get("credit", "").strip():
        raise SystemExit("credit(원본 출처)을 꼭 적어 주세요.")
    total = sum(s["end"] - s["start"] for s in segs)
    max_s = spec.get("max_seconds", 60)
    if total > max_s:
        raise SystemExit(f"구간 합계 {total:.1f}초가 최대 {max_s}초를 넘습니다. 구간을 줄여 주세요.")

    vw, vh, has_audio = probe(src)
    slot = WIDE_SLOT if vw >= vh else TALL_SLOT
    sx, sy, sw, sh = slot

    captions = spec.get("captions")
    if not captions and spec.get("source_subs"):
        captions = captions_from_subs(parse_vtt(spec["source_subs"]), segs)
    captions = captions or []

    cut_times, acc = [], 0.0
    for s in segs[:-1]:
        acc += s["end"] - s["start"]
        cut_times.append(acc)
    if not spec.get("cut_marker", True):
        cut_times = []

    with tempfile.TemporaryDirectory() as tmp:
        frame = os.path.join(tmp, "frame.png")
        ass = os.path.join(tmp, "captions.ass")
        build_frame(spec, slot, frame)
        build_ass(captions, cut_times, slot, ass)

        parts, labels = [], []
        for i, s in enumerate(segs):
            parts.append(f"[0:v]trim={s['start']}:{s['end']},setpts=PTS-STARTPTS,"
                         f"scale={sw}:{sh}:force_original_aspect_ratio=decrease,"
                         f"pad={sw}:{sh}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30[v{i}]")
            if has_audio:
                parts.append(f"[0:a]atrim={s['start']}:{s['end']},asetpts=PTS-STARTPTS,"
                             f"aresample=48000,aformat=channel_layouts=stereo[a{i}]")
            else:
                parts.append(f"anullsrc=r=48000:cl=stereo,atrim=0:{s['end'] - s['start']}[a{i}]")
            labels.append(f"[v{i}][a{i}]")
        parts.append(f"{''.join(labels)}concat=n={len(segs)}:v=1:a=1[cv][ca]")
        parts.append(f"[1:v][cv]overlay={sx}:{sy}:shortest=1[base]")
        ass_arg = ass.replace(":", "\\:")
        fonts_arg = FONTS.replace(":", "\\:")
        parts.append(f"[base]subtitles=filename='{ass_arg}':fontsdir='{fonts_arg}'[outv]")

        inputs = ["-i", src, "-loop", "1", "-framerate", "30", "-i", frame]
        voice = spec.get("voiceover")
        if voice:
            inputs += ["-i", voice]
            vol = spec.get("original_volume", 0.35)
            parts.append(f"[ca]volume={vol}[bg];[bg][2:a]amix=inputs=2:duration=first:normalize=0[outa]")
            amap = "[outa]"
        else:
            amap = "[ca]"

        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *inputs,
               "-filter_complex", ";".join(parts),
               "-map", "[outv]", "-map", amap,
               "-t", f"{total:.3f}",
               "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
               "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart",
               spec.get("output", "short.mp4")]
        run(cmd)
    print(f"완성: {spec.get('output', 'short.mp4')} ({total:.1f}초, 구간 {len(segs)}개, 자막 {len(captions)}줄)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    with open(sys.argv[1], encoding="utf-8") as fh:
        render(json.load(fh))
