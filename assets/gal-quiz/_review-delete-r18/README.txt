GAL 问答图片审查文件夹
====================

1. 在此文件夹内浏览并删除 R18 / H 场景图片。
2. 文件名格式：题号__原文件名（如 s3-14__nijimu-shiri.jpg）
3. 删完后在项目根目录执行：
   python _quiz_raw/sync_after_image_review.py

注意：不要删 manifest.json 和本 README。
同一题有多张图时，删掉任意一张 R18 图会移除整道题。
