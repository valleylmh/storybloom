import Link from "next/link";
import CustomContactPanel from "@/components/custom/CustomContactPanel";
import CustomIcon, { type CustomIconName } from "@/components/custom/CustomIcon";
import CustomSampleGallery from "@/components/custom/CustomSampleGallery";
import {
  CUSTOM_ORDER_PLATFORMS,
  hasCustomOrderUrl,
  type CustomOrderPlatform,
} from "@/lib/custom-order";
import { CUSTOM_BOOKS } from "@/lib/custom-books";

export const metadata = {
  title: "定制礼物版 | StoryBloom",
  description:
    "为孩子定制一本写着名字、家人、宠物和祝福的专属儿童绘本，支持小红书和闲鱼下单咨询。",
};

const packages = [
  {
    name: "电子纪念版",
    originalPrice: "79",
    salePrice: "19",
    fit: "适合先做一份可分享的礼物电子档",
    icon: "pdf",
    items: ["12 页绘本", "PDF文件", "基础封面"],
  },
  {
    name: "生日礼物版",
    originalPrice: "129",
    salePrice: "69",
    fit: "适合生日、入园和家庭纪念",
    featured: true,
    icon: "gift",
    items: ["12 页绘本", "高清 PDF", "祝福页元素"],
  },
  {
    name: "精装送礼版",
    originalPrice: "179",
    salePrice: "119",
    fit: "适合直接送出实体礼物",
    icon: "print",
    items: ["12 页绘本", "精装打印", "顺丰包邮"],
  },
] satisfies Array<{
  name: string;
  originalPrice: string;
  salePrice: string;
  fit: string;
  featured?: boolean;
  icon: CustomIconName;
  items: string[];
}>;

const heroStats = [
  { value: "8", label: "页公开演示" },
  { value: "PDF", label: "高清交付" },
  { value: "24-72h", label: "交付预期" },
];

const valueHighlights = [
  {
    icon: "pencil",
    title: "写进真实小事",
    detail: "把生日、入园、宠物和家人祝福写成孩子能读懂的故事。",
  },
  {
    icon: "palette",
    title: "统一主角画风",
    detail: "围绕同一个孩子做角色、服装和关键画面的统一。",
  },
  {
    icon: "package",
    title: "做成可送成品",
    detail: "交付高清 PDF，可按需要加做精装打印和包邮。",
  },
] satisfies Array<{
  icon: CustomIconName;
  title: string;
  detail: string;
}>;

const comparisonRows = [
  {
    icon: "book",
    label: "故事内容",
    free: "8 页自动生成，适合快速预览",
    custom: "12 页人工整理，围绕送礼场景展开",
  },
  {
    icon: "family",
    label: "人物细节",
    free: "孩子名字 + 基础年龄主题",
    custom: "可加入性格、家人、宠物和祝福语",
  },
  {
    icon: "images",
    label: "画面一致性",
    free: "按模型结果逐页生成",
    custom: "人工统一角色、画风和关键页面表现",
  },
  {
    icon: "pdf",
    label: "交付形式",
    free: "网页阅读、朗读、PNG 分享图",
    custom: "高清 PDF，可选精装打印和顺丰发货",
  },
] satisfies Array<{
  icon: CustomIconName;
  label: string;
  free: string;
  custom: string;
}>;

const flowSteps = [
  {
    icon: "chat",
    title: "发来孩子信息",
    detail: "名字、年龄、送礼场景和想写进去的人或宠物。",
  },
  {
    icon: "sparkle",
    title: "确定故事方向",
    detail: "整理性格、兴趣、祝福语，定下主题和画风关键词。",
  },
  {
    icon: "cards",
    title: "生成 12 页初稿",
    detail: "完成故事分镜、页面文案和首轮插图预览。",
  },
  {
    icon: "seal",
    title: "人工精修成品",
    detail: "按套餐调整表达、画面提示和 PDF 排版细节。",
  },
  {
    icon: "package",
    title: "交付或加印",
    detail: "发送电子档；加印版安排精装打印和顺丰发货。",
  },
] satisfies Array<{
  icon: CustomIconName;
  title: string;
  detail: string;
}>;

const trustItems = [
  { icon: "clock", label: "24-72 小时交付" },
  { icon: "check", label: "按套餐支持修改" },
  { icon: "shield", label: "不公开儿童信息" },
  { icon: "chat", label: "链接未上线前可咨询" },
] satisfies Array<{ icon: CustomIconName; label: string }>;

function OrderButton({ platform }: { platform: CustomOrderPlatform }) {
  if (!hasCustomOrderUrl(platform)) {
    return (
      <span className="custom-order-link custom-order-link-disabled">
        {platform.pendingLabel}
      </span>
    );
  }

  return (
    <a
      className={`custom-order-link custom-order-link-${platform.id}`}
      href={platform.url}
      target="_blank"
      rel="noreferrer"
    >
      {platform.actionLabel}
    </a>
  );
}

export default function CustomOrderPage() {
  const activeOrderPlatforms = CUSTOM_ORDER_PLATFORMS.filter(hasCustomOrderUrl);

  return (
    <main className="custom-page">
      <nav className="custom-topbar" aria-label="页面导航">
        <Link href="/" className="back-btn">
          ← 返回免费生成器
        </Link>
        {activeOrderPlatforms.length > 0 ? (
          <div className="custom-topbar-actions">
            {activeOrderPlatforms.map((platform) => (
              <OrderButton key={platform.id} platform={platform} />
            ))}
          </div>
        ) : null}
      </nav>

      <section className="custom-hero">
        <div className="custom-hero-copy">
          <p className="custom-hero-kicker">定制礼物版</p>
          <h1>把孩子的小事，做成专属绘本</h1>
          <p>
            把名字、家人、宠物和祝福写进 12 页故事，交付高清 PDF 或精装书。
          </p>
          <div className="custom-hero-prompt">
            <CustomIcon name="gift" />
            <strong>发来孩子名字 + 送礼场景，我先帮你判断适合做哪一版。</strong>
          </div>
          <div className="custom-hero-stats" aria-label="定制交付摘要">
            {heroStats.map((item) => (
              <span key={item.label}>
                <strong>{item.value}</strong>
                {item.label}
              </span>
            ))}
          </div>
          {activeOrderPlatforms.length > 0 ? (
            <div className="custom-hero-actions">
              {activeOrderPlatforms.map((platform) => (
                <OrderButton key={platform.id} platform={platform} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="custom-hero-preview" aria-label="公开绘本示例">
          {CUSTOM_BOOKS.map((sample) => (
            <img
              key={sample.storyId}
              src={sample.customMeta.coverImage}
              alt={sample.customMeta.title}
            />
          ))}
        </div>
      </section>

      <section className="custom-section custom-showcase-section">
        <div className="custom-section-header">
          <h2>先看两本公开演示</h2>
          <p>演示内容来自仓库内的 AI 生成样例，不包含真实儿童照片或客户资料。</p>
        </div>
        <CustomSampleGallery />
      </section>

      <section className="custom-section custom-value-section">
        <div className="custom-section-header">
          <h2>名字只是开始</h2>
          <p>真正让人愿意定制的是：这本书像是在写我们家。</p>
        </div>
        <div className="custom-value-grid">
          {valueHighlights.map((item) => (
            <article key={item.title} className="custom-value-card">
              <CustomIcon name={item.icon} />
              <div>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="custom-section">
        <div className="custom-section-header">
          <h2>定制套餐</h2>
          <p>三档都含 12 页定制绘本，按送礼强度和交付形式选择。</p>
        </div>
        <div className="custom-package-grid">
          {packages.map((item) => (
            <article
              key={item.name}
              className={`custom-package ${item.featured ? "custom-package-featured" : ""}`}
            >
              <div className="custom-package-head">
                <CustomIcon name={item.icon} />
                <h3>{item.name}</h3>
              </div>
              <div className="custom-price">
                <span>¥</span>
                {item.salePrice}
                <del>¥{item.originalPrice}</del>
                <em>促销价</em>
              </div>
              <p>{item.fit}</p>
              <ul>
                {item.items.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <CustomContactPanel platforms={activeOrderPlatforms} />
      </section>

      <section className="custom-section custom-compare-section">
        <div className="custom-section-header">
          <h2>免费版负责灵感，定制版负责成品</h2>
          <p>不用读表格，主要差别集中在内容、人物、画面和交付。</p>
        </div>
        <div className="custom-compare-split" aria-label="免费版和定制版对比">
          {comparisonRows.map((row) => (
            <div className="custom-compare-item" key={row.label}>
              <CustomIcon name={row.icon} />
              <strong>{row.label}</strong>
              <span>{row.free}</span>
              <span>{row.custom}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="custom-section custom-flow-section">
        <div className="custom-section-header">
          <h2>定制流程</h2>
          <p>从一句需求到 12 页绘本成品，每一步都对应一个可确认的交付物。</p>
        </div>
        <div className="custom-flow-board">
          <div className="custom-flow-brief">
            <CustomIcon name="book" />
            <strong>信息收集 → 主题确认 → 初稿预览 → 精修交付</strong>
            <p>你只需要补齐素材，其余故事整理、分镜和排版由我们完成。</p>
            <div className="custom-flow-deliverables" aria-label="交付内容">
              <span>12 页故事</span>
              <span>高清 PDF</span>
              <span>可选精装</span>
            </div>
          </div>
          <ol className="custom-flow">
            {flowSteps.map((item) => (
              <li key={item.title}>
                <span className="custom-flow-index">
                  <CustomIcon name={item.icon} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="custom-section custom-trust-section">
        <div>
          <h2>隐私与交付说明</h2>
          <p>
            不强制上传孩子照片，也不会公开孩子信息。若你提供真实照片或家庭信息，
            只用于本次定制沟通和交付。
          </p>
        </div>
        <div className="custom-trust-list">
          {trustItems.map((item) => (
            <span key={item.label}>
              <CustomIcon name={item.icon} />
              {item.label}
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}
