from PIL import Image
import numpy as np

def stats(path, name):
    im = Image.open(path).convert("RGB")
    a = np.asarray(im, dtype=np.float32)
    y = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]
    small = Image.fromarray(np.clip(y, 0, 255).astype(np.uint8)).resize(
        (max(1, im.width // 8), max(1, im.height // 8)), Image.BILINEAR
    )
    blur = np.asarray(small.resize(im.size, Image.BILINEAR), dtype=np.float32)
    hi = y - blur
    print(
        f"{name}: size={im.size} mean={y.mean():.1f} std={y.std():.1f} "
        f"bright={((hi > 12).mean()):.4f} very={((hi > 28).mean()):.4f}"
    )

stats(r"D:\gamedev\shigure-web\_rain_analysis\ref\r_04.png", "REF")
stats(r"D:\gamedev\shigure-web\_rain_analysis\local\iter0.png", "LOC")
