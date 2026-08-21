import subprocess
from pathlib import Path

root = Path(__file__).resolve().parent
for rev in ["e152f0d", "d267962", "4a3c6dc"]:
    data = subprocess.check_output(["git", "show", f"{rev}:index.html"])
    out = root / f"{rev}_index.html"
    out.write_bytes(data)
    title_ok = b"</title>" in data
    has_kaya = "时雨榧".encode("utf-8") in data
    # broken close like ?> or missing quote before width
    broken = b"?</title>" in data or b'alt="' in data and b'? width=' in data
    intro_broken = b'aria-label="' in data and b'?">' in data
    print(rev, "bytes", len(data), "kaya", has_kaya, "title_ok", title_ok, "broken", broken, "intro_broken", intro_broken)
    # print title line as hex around title
    idx = data.find(b"<title>")
    print("  title_snip", data[idx:idx+40])
