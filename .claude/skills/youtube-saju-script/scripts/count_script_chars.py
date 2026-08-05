#!/usr/bin/env python3
"""
대본 글자수 검사기 (⑤ 검토 단계용).

화자 라벨("상담사:", "의뢰인:")과 줄바꿈/공백을 제외한 순수 대사 글자수를 센다.
목표: 1,800~2,000자 (5분 분량, 한국어 TTS 기준).

사용법:
    python3 count_script_chars.py script.txt
    echo "상담사: ..." | python3 count_script_chars.py -
"""
import re
import sys


def count(text: str) -> int:
    # 화자 라벨 제거 (줄 맨 앞의 "이름:" 패턴)
    text = re.sub(r"(?m)^\s*(상담사|의뢰인|호스트|내담자)\s*[:：]\s*", "", text)
    # 공백류 전부 제거하고 글자수만 카운트 (한국어 대본 글자수 관행)
    stripped = re.sub(r"\s+", "", text)
    return len(stripped)


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    path = sys.argv[1]
    raw = sys.stdin.read() if path == "-" else open(path, encoding="utf-8").read()
    n = count(raw)
    status = "OK" if 1800 <= n <= 2000 else ("짧음 - 보강 필요" if n < 1800 else "김 - 축약 필요")
    print(f"글자수(공백/라벨 제외): {n}자  [{status}]  목표: 1,800~2,000자")


if __name__ == "__main__":
    main()
