# 城市汽车小队 · 全集典藏版

独立礼物绘本 `/gifts/city-motors`，不修改绘本馆源内容。

将 `QICHE_BOOKS` 按原顺序收录全部 26 个故事和 368 页原有插图与中文正文，加一个全新开场跨页，共 370 页。每章页数为偶数，因此目录定位跨页准确。目录含序章及 26 章。图片直接复用 `/library/qiche/<bookId>/<page>.webp`，不生成重复拷贝；正文排在同一纸页下方的暖色文字区，原图完整保留，不裁去车辆细节或把文字盖在人物上。封面也复用原系列第一张图。

全新开场：`public/gift-books/city-motors/opening.png`，内置 imagegen，1536×1024，参考原系列第一张图。提示词：NEW flat full bleed landscape 3:2, same polished warm 3D style and character; An'an black bob yellow star hairclip teal hoodie orange backpack with coral-cardigan mother safely on a park overlook; continuous panorama with bus, taxi, fire station, train and fenced construction site; generous sky negative space, center 8% clear of faces and text, no mockup or captions. LEFT exact「早安，城市！跟着安安，一起出发。」RIGHT exact「每一辆车，都有自己的本领。每一次合作，都让城市更美好。」

原系列 368 张 WebP 已逐张解码成功。合订本按需显示和预解码相邻页，不一次加载全部图片。未上传、未发布、未验证真机或微信分享卡片。

本地验收：类型检查通过，汽车系列 7 项测试通过；目录直达第 26 章第 351 页，逐次翻至 369–370 页后下一页禁用；390px 下长句完整显示且无横向溢出。手机正文采用自然高度纸页布局。
