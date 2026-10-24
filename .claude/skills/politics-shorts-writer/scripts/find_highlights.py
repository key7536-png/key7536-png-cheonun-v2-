#!/usr/bin/env python3
"""쇼츠 링크 → 원본 영상 찾기 → 시청자 반응이 몰린 하이라이트 구간 찾기.

필요: pip install yt-dlp  (그리고 www.youtube.com, *.googlevideo.com 접속 허용)

사용법:
    # 1) 쇼츠의 원본 후보 찾기
    python3 find_highlights.py source "https://youtube.com/shorts/XXXX"

    # 2) 원본 영상의 하이라이트 분석 (영상은 받지 않음, 자막·댓글·다시보기 그래프만)
    python3 find_highlights.py analyze "https://youtube.com/watch?v=YYYY" --out work/

    # 3) 원본 영상 파일 받기 (make_short.py에 넣을 mp4 + 한국어 자막)
    python3 find_highlights.py download "https://youtube.com/watch?v=YYYY" --out work/

analyze 결과: work/highlights.json
  - heatmap: 유튜브 "가장 많이 다시 본 장면" 그래프 (없는 영상도 있음)
  - candidates: 다시보기 + 댓글 시간표시(예: 3:25)를 합쳐 점수가 높은 구간,
                자막 문장 경계에 맞춰 자른 시작/끝, 그 구간의 원문 자막, 관련 댓글
"""
import argparse
import glob
import json
import math
import os
import re
import sys

BIN = 5.0             # 점수 계산 단위(초)
MAX_CANDIDATES = 8
MIN_GAP = 15.0        # 후보끼리 최소 간격(초)
PAD_BEFORE, PAD_AFTER = 6.0, 12.0
MAX_CLIP = 20.0
MIN_SCORE_RATIO = 0.35  # 최고 점수의 35% 미만인 구간은 후보에서 뺀다

TS_RE = re.compile(r"(?<![\d:])(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?![\d:])")
YT_LINK_RE = re.compile(r"(https?://(?:www\.)?(?:youtube\.com/(?:watch\?v=|live/)|youtu\.be/)[\w\-?=&]+)")


def ydl(opts=None):
    try:
        import yt_dlp
    except ImportError:
        raise SystemExit("yt-dlp가 없습니다: pip install yt-dlp")
    base = {"quiet": True, "no_warnings": True}
    base.update(opts or {})
    return yt_dlp.YoutubeDL(base)


# ---------- 분석 로직 (네트워크 없이 테스트 가능) ----------

def comment_timestamps(comments, duration):
    """댓글 속 시간표시를 [(초, 가중치, 댓글)]로 뽑는다. 좋아요가 많을수록 가중치가 크다."""
    out = []
    for c in comments or []:
        text = c.get("text") or ""
        likes = c.get("like_count") or 0
        found = set()
        for h, m, s in TS_RE.findall(text):
            t = int(h or 0) * 3600 + int(m) * 60 + int(s)
            if int(s) < 60 and 0 <= t < duration and t not in found:
                found.add(t)
                out.append((t, 1.0 + math.log1p(likes), c))
    return out


def snap_to_cues(start, end, cues, duration):
    """구간을 자막 문장 경계에 맞춘다 (말 중간에서 끊기지 않게)."""
    starts = [cs for cs, ce, _ in cues if cs <= start]
    ends = [ce for cs, ce, _ in cues if ce >= end]
    s = max(starts) if starts else start
    e = min(ends) if ends else end
    if e - s > MAX_CLIP:
        e = s + MAX_CLIP
        inner = [ce for cs, ce, _ in cues if s < ce <= e]
        if inner:
            e = max(inner)
    return max(0.0, s), min(duration, e)


def analyze(info, cues):
    duration = float(info.get("duration") or 0)
    if duration <= 0:
        raise ValueError("영상 길이를 알 수 없습니다.")
    nbins = int(math.ceil(duration / BIN))

    heat = [0.0] * nbins
    heatmap = info.get("heatmap") or []
    for h in heatmap:
        a, b, v = h["start_time"], h["end_time"], h["value"]
        for i in range(int(a // BIN), min(nbins, int(math.ceil(b / BIN)))):
            heat[i] = max(heat[i], v)

    mentions = comment_timestamps(info.get("comments"), duration)
    cscore = [0.0] * nbins
    for t, w, _ in mentions:
        cscore[min(nbins - 1, int(t // BIN))] += w

    hmax, cmax = max(heat or [0]), max(cscore or [0])
    if hmax == 0 and cmax == 0:
        return {"duration": duration, "has_heatmap": False, "comment_mentions": 0, "candidates": [],
                "note": "다시보기 그래프와 댓글 시간표시가 모두 없습니다. 자막 내용으로 쟁점 구간을 직접 골라야 합니다."}
    hw, cw = (0.6, 0.4) if hmax and cmax else ((1.0, 0.0) if hmax else (0.0, 1.0))
    score = [hw * (heat[i] / hmax if hmax else 0) + cw * (cscore[i] / cmax if cmax else 0) for i in range(nbins)]

    floor = max(score) * MIN_SCORE_RATIO
    picked = []
    for i in sorted(range(nbins), key=lambda i: -score[i]):
        if score[i] < floor or len(picked) >= MAX_CANDIDATES:
            break
        t = i * BIN
        if all(abs(t - p) >= MIN_GAP for p in picked):
            picked.append(t)

    candidates = []
    for t in picked:  # 점수 높은 순
        s, e = snap_to_cues(t - PAD_BEFORE, t + BIN + PAD_AFTER, cues, duration)
        related = sorted([(w, c) for ct, w, c in mentions if s - 2 <= ct <= e + 2], key=lambda x: -x[0])
        b = int(t // BIN)
        candidates.append({
            "start": round(s, 2), "end": round(e, 2), "length": round(e - s, 2),
            "score": round(score[b], 3),
            "replay": round(heat[b], 3),
            "comment_mentions": sum(1 for ct, _, _ in mentions if s - 2 <= ct <= e + 2),
            "transcript": " ".join(text for cs, ce, text in cues if ce > s and cs < e),
            "top_comments": [{"text": c.get("text", "")[:200], "likes": c.get("like_count") or 0}
                             for _, c in related[:3]],
        })
    return {"duration": duration, "has_heatmap": bool(heatmap), "comment_mentions": len(mentions),
            "candidates": candidates}


# ---------- 유튜브 접속 ----------

def cmd_source(url):
    with ydl() as y:
        info = y.extract_info(url, download=False)
    desc = info.get("description") or ""
    links = sorted(set(YT_LINK_RE.findall(desc)))
    query = re.sub(r"#\S+", "", info.get("title") or "").strip()
    found = []
    if query:
        with ydl({"extract_flat": True}) as y:
            res = y.extract_info(f"ytsearch15:{query}", download=False)
        for e in res.get("entries") or []:
            d = e.get("duration") or 0
            if d >= 120 and e.get("id") != info.get("id"):
                found.append({"url": f"https://www.youtube.com/watch?v={e['id']}", "title": e.get("title"),
                              "channel": e.get("channel"), "duration": d,
                              "same_channel": e.get("channel_id") == info.get("channel_id")})
        found.sort(key=lambda x: not x["same_channel"])
    print(json.dumps({
        "short": {"title": info.get("title"), "channel": info.get("channel"),
                  "duration": info.get("duration"), "url": info.get("webpage_url")},
        "links_in_description": links,
        "search_candidates": found[:8],
        "note": "설명란 링크가 가장 확실합니다. 검색 후보는 자막·장면을 비교해 원본이 맞는지 꼭 확인하세요.",
    }, ensure_ascii=False, indent=2))


def subs_opts(out):
    return {"writesubtitles": True, "writeautomaticsub": True, "subtitleslangs": ["ko", "ko-orig"],
            "subtitlesformat": "vtt", "outtmpl": os.path.join(out, "source.%(ext)s")}


def load_cues(out):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from make_short import parse_vtt
    files = sorted(glob.glob(os.path.join(out, "source*.vtt")))
    return (parse_vtt(files[0]), files[0]) if files else ([], None)


def cmd_analyze(url, out):
    os.makedirs(out, exist_ok=True)
    opts = subs_opts(out)
    opts.update({"skip_download": True, "getcomments": True,
                 "extractor_args": {"youtube": {"max_comments": ["800", "all", "0"], "comment_sort": ["top"]}}})
    with ydl(opts) as y:
        info = y.extract_info(url, download=True)
    cues, vtt = load_cues(out)
    result = analyze(info, cues)
    result.update({"title": info.get("title"), "channel": info.get("channel"),
                   "url": info.get("webpage_url"), "subs_file": vtt,
                   "comments_read": len(info.get("comments") or [])})
    path = os.path.join(out, "highlights.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False, indent=2)
    print(f"저장: {path} (후보 {len(result['candidates'])}개, 다시보기 그래프 "
          f"{'있음' if result['has_heatmap'] else '없음'}, 댓글 시간표시 {result['comment_mentions']}개)")


def cmd_download(url, out):
    os.makedirs(out, exist_ok=True)
    opts = subs_opts(out)
    opts.update({"format": "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080]/b",
                 "merge_output_format": "mp4"})
    with ydl(opts) as y:
        y.extract_info(url, download=True)
    print(f"저장: {os.path.join(out, 'source.mp4')}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("command", choices=["source", "analyze", "download"])
    p.add_argument("url")
    p.add_argument("--out", default="work")
    a = p.parse_args()
    {"source": lambda: cmd_source(a.url),
     "analyze": lambda: cmd_analyze(a.url, a.out),
     "download": lambda: cmd_download(a.url, a.out)}[a.command]()
