#!/usr/bin/env python3
"""Record an animated flowchart HTML to MP4, frame by frame (deterministic).

usage (needs playwright; uv fetches it on the fly):
  uv run --with playwright python record.py flow.html out.mp4 [--fps 30] [--scale 1]
  uv run --with playwright python record.py flow.html --stills 0.2,0.5,0.95 --stills-dir shots/

Audio: if the page was built with a BGM (window.SPEC.bgm), it is repeated (seamless loop
files) or looped on its beat-aligned loop points, faded out at the end and muxed in. --no-audio skips it.
--stills takes fractions of the total duration and writes PNGs instead of a video.
Browser: $CHROME, else /usr/bin/google-chrome if present, else Playwright's own Chromium.
"""
import argparse, os, shutil, subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

W, H = 1080, 1440


def chrome_path():
    for p in (os.environ.get("CHROME"), "/usr/bin/google-chrome"):
        if p and Path(p).exists():
            return p
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("out", nargs="?")
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--scale", type=float, default=1, help="device pixel ratio; 2 gives 2160x2880")
    ap.add_argument("--stills")
    ap.add_argument("--stills-dir", default="stills")
    ap.add_argument("--no-audio", action="store_true")
    a = ap.parse_args()
    if not a.out and not a.stills:
        sys.exit("give an output .mp4 or --stills")

    url = Path(a.html).resolve().as_uri() + "?record=1"
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=chrome_path())
        page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=a.scale)
        page.goto(url)
        page.wait_for_function("window.__ready === true")
        page.evaluate("document.fonts.ready")
        total = page.evaluate("window.__duration")
        bgm = None if a.no_audio else page.evaluate("window.SPEC.bgm || null")
        layout = page.evaluate("window.__layout")
        print(f"duration {total:.1f}s, layout {layout}", file=sys.stderr)

        if a.stills:
            d = Path(a.stills_dir); d.mkdir(parents=True, exist_ok=True)
            for f in a.stills.split(","):
                t = float(f) * total
                page.evaluate(f"window.__render({t})")
                out = d / f"t{t:05.1f}.png"
                page.screenshot(path=str(out))
                print(out)
            browser.close()
            return

        ffmpeg = shutil.which("ffmpeg") or sys.exit("ffmpeg not found")
        n = int(total * a.fps)
        silent = a.out if not bgm else str(Path(a.out).with_suffix(".silent.mp4"))
        proc = subprocess.Popen([ffmpeg, "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(a.fps),
                                 "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p",
                                 "-crf", "18", "-preset", "medium", "-movflags", "+faststart", silent],
                                stdin=subprocess.PIPE)
        for i in range(n):
            page.evaluate(f"window.__render({i / a.fps})")
            proc.stdin.write(page.screenshot(type="jpeg", quality=95))
            if i % (a.fps * 5) == 0:
                print(f"frame {i}/{n}", file=sys.stderr)
        proc.stdin.close()
        proc.wait()
        browser.close()
    if bgm:
        mux(ffmpeg, silent, bgm, n / a.fps, a.out)
        Path(silent).unlink()
    print(a.out)


def mux(ffmpeg, video, bgm, dur, out, xf=0.4, fade_out=1.6):
    """Lay the BGM under the video. Copies after the first restart at loop_in and are
    placed every (loop_out - loop_in) seconds, so the beat grid stays continuous."""
    lin, lout = bgm.get("loop_in"), bgm.get("loop_out")
    parts, labels = [], []
    if not bgm.get("seamless") and lin is not None and lout is not None and lout < dur:
        body = lout - lin
        copies = 1 + int((dur - lout) // body) + 1
        for i in range(copies):
            start = 0 if i == 0 else lin - xf
            end = lout + xf
            delay = 0 if i == 0 else lout + (i - 1) * body - xf
            f = f"[1:a]atrim={start:.3f}:{end:.3f},asetpts=PTS-STARTPTS"
            if i:
                f += f",afade=t=in:d={xf}"
            f += f",afade=t=out:st={end - start - xf:.3f}:d={xf},adelay={int(delay * 1000)}|{int(delay * 1000)}[a{i}]"
            parts.append(f); labels.append(f"[a{i}]")
        parts.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0[mix]")
        src = "[mix]"
    else:
        src = "[1:a]"
    parts.append(f"{src}atrim=0:{dur:.3f},afade=t=out:st={max(0, dur - fade_out):.3f}:d={fade_out},"
                 "loudnorm=I=-16:TP=-1.5:LRA=11[aout]")
    # seamless loop files are just repeated back to back
    loop = ["-stream_loop", "-1"] if bgm.get("seamless") else []
    subprocess.run([ffmpeg, "-v", "error", "-y", "-i", video, *loop, "-i", bgm["file"], "-filter_complex", ";".join(parts),
                    "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", out],
                   check=True)


if __name__ == "__main__":
    main()
