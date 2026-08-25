GAL 水平测试 — 配图删除文件夹
============================

1. 在此文件夹浏览并删除不想保留的图片。
2. 文件名格式：题号__原文件名（如 s3-14__foo.jpg）
3. 删完后在 shigure-web 目录执行：
   python _quiz_raw/sync_after_image_review.py

规则：同一题任意一张图被删 → 整道题从题库移除。
不要删 manifest.json 和本 README。
