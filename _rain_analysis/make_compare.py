from PIL import Image, ImageDraw, ImageFont
import numpy as np

ref = Image.open(r"D:\gamedev\shigure-web\_rain_analysis\ref\r_04.png").convert("RGB")
loc = Image.open(r"D:\gamedev\shigure-web\_rain_analysis\local\iter2b.png").convert("RGB")

# crop comparable mid regions
rw, rh = ref.size
lw, lh = loc.size
ref_c = ref.crop((0, int(rh * 0.18), rw, int(rh * 0.62))).resize((480, 700), Image.LANCZOS)
loc_c = loc.crop((int(lw * 0.22), int(lh * 0.08), int(lw * 0.78), int(lh * 0.85))).resize((480, 700), Image.LANCZOS)

out = Image.new("RGB", (980, 760), (18, 24, 36))
out.paste(ref_c, (10, 40))
out.paste(loc_c, (500, 40))
d = ImageDraw.Draw(out)
d.text((10, 10), "REF Xiaomi", fill=(220, 235, 255))
d.text((500, 10), "LOCAL heavy", fill=(220, 235, 255))
out.save(r"D:\gamedev\shigure-web\_rain_analysis\local\compare_side.png")
print("wrote compare_side.png")

def hi_stats(im, name):
    a = np.asarray(im, dtype=np.float32)
    y = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]
    small = Image.fromarray(np.clip(y, 0, 255).astype(np.uint8)).resize(
        (max(1, im.width // 10), max(1, im.height // 10)), Image.BILINEAR
    )
    blur = np.asarray(small.resize(im.size, Image.BILINEAR), dtype=np.float32)
    hi = y - blur
    print(f"{name}: mean={y.mean():.1f} bright={(hi>10).mean():.4f} very={(hi>24).mean():.4f} edge={(hi>40).mean():.4f}")

hi_stats(ref_c, "REF_crop")
hi_stats(loc_c, "LOC_crop")
