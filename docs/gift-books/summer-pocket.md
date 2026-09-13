# 把夏天装进口袋 · 幼儿园毕业纪念样书

独立模块 `/gifts`，作品地址 `/gifts/summer-pocket`。虚构儿童、幼儿园与老师，公开展示样书，不是既有真实客户项目。当前仓库未找到毕业成品，故新作一册。封面 + 5 个完整跨页（10 页正文），赠言及定制入口在阅读器之外。

## 素材与制作

使用内置 image_gen 生成。完整文字直接生成在位图中，网页不覆盖正文。原始 PNG 在 `public/gift-books/summer-pocket/`，包含 cover.png 与 spread-1/2/3/4/5.png。ZIP 提供同一组原图。展示时每张跨页由左右两个 CSS 视窗组成，不裁切或覆盖原图中文字。

统一提示词约束：premium Chinese kindergarten graduation keepsake picture book; flat full-bleed print artwork, no mockup/perspective/borders; gouache watercolor and colored pencil with ivory paper grain; butter yellow, sage, dusty coral, sky blue; same fictional six-year-old black-bob girl in mustard overalls and white tee, blue-striped boy and coral-dress girl; elegant accurate Chinese typography integrated in natural composition, no caption bands or overlay panels. Cover portrait 3:4; spreads landscape 3:2, center 8% clear of important text/faces. 封面作为三个跨页的角色和画风参考。

## 提示词与文字

- 封面：女孩手捧装着叶子、星星、纸船的透明口袋，朋友、花园园门、纸飞机；天空大标题“把夏天装进口袋”，副标题“幼儿园毕业纪念”，底部“STORYBLOOM”。
- 跨页一：左边第一次牵妈妈手进入花园幼儿园，右边绿裙老师蹲下迎接。左上自然留白文字“第一次走进这里，我的手，紧紧拉着妈妈。”右下小路文字“老师蹲下来，把我的小小勇敢，轻轻接住。”
- 跨页二：左边朋友一起搭积木、折纸船、分享小星星；右边树上量身高。左上文字“后来，我学会了分享，也有了最好的朋友。”右下文字“我们把笑声种进院子，把自己，长高了一点点。”
- 跨页三：左边毕业挥手告别老师和朋友，女孩手捧回忆口袋；右边在蓝天和纸飞机下向更大的世界出发。左上文字“毕业这天，我把夏天装进口袋。”右上“再见，幼儿园。”下方“谢谢你们，陪我长大。下一站，我会勇敢出发。”

## 验收边界

原图中文字已逐张目视检查。公共分享使用当前 origin，localhost 提示尚未上线。下载为原图压缩包，不是 PDF 或印刷成品。定制入口沿用 `/custom`，不新增价格、私人联系方式或支付承诺。未发布、不代表真实手机或微信分享卡片验证。


## 本轮扩充

阅读顺序为 spread-1 → spread-2 → spread-4 → spread-5 → spread-3。

- 新跨页四（内置 imagegen，封面作为参考）：same gouache pencil warm ivory paper, bob-haired girl mustard overalls white tee. Left tying shoes on classroom bench, right watering garden flowers. Exact text:「我学会了系鞋带，也学会了说：我来试试！」及「原来，长大就是把小小的事情，认真做好。」自然留白内一体生成文字，无字幕条，3:2 跨页。
- 新跨页五（内置 imagegen，同一封面参考）：left children make pressed-flower thank-you card, right children present card and hug sage-dress teacher. Exact text:「有些谢谢，我想亲手画给你。」及「谢谢老师的每一次拥抱，也谢谢朋友，一直在身旁。」3:2 跨页，中缝避开文字。
- 封面去除旋转；删除放大阅读；书页左右各四层独立堆叠，厚度随阅读位置变化。
