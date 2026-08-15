import type { Metadata } from "next";
import Link from "next/link";
import styles from "../privacy/TrustDocument.module.css";

export const metadata: Metadata = {
  title: "儿童与家庭数据说明 | StoryBloom",
  description:
    "面向家长与监护人说明 StoryBloom 中儿童故事、成长照片、家庭角色、声音、云端档案和公开分享的边界。",
};

export default function ChildFamilyDataPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.topbar} aria-label="页面导航">
        <Link className={styles.brand} href="/">
          StoryBloom
        </Link>
        <Link className={styles.backLink} href="/privacy">
          查看完整隐私与数据说明 →
        </Link>
      </nav>

      <header className={styles.hero}>
        <p className={styles.eyebrow}>CHILD &amp; FAMILY DATA</p>
        <h1>孩子是故事的主角，不是行为画像</h1>
        <p className={styles.lead}>
          涉及真实成长经历、照片、声音和家庭关系的功能，应由家长或监护人决定是否使用。
          StoryBloom 不把登录当作同意，也不应根据儿童内容推断心理状态、能力标签或长期性格档案。
        </p>
        <p className={styles.updated}>面向家长与监护人 · 基于当前代码更新：2026 年 8 月 15 日</p>
      </header>

      <div className={styles.principles} aria-label="家庭资料原则">
        <article className={styles.principle}>
          <span>1</span>
          <h2>家长决定</h2>
          <p>照片、声音和私有云资料必须由成年人主动选择，不能因为孩子完成创作或账户登录而静默上传。</p>
        </article>
        <article className={styles.principle}>
          <span>2</span>
          <h2>只用必要资料</h2>
          <p>优先使用昵称和最少细节，不需要填写学校、地址、证件、健康或固定行程信息。</p>
        </article>
        <article className={styles.principle}>
          <span>3</span>
          <h2>随时带走或删除</h2>
          <p>本机编辑清理、云端导出删除和隐私控制是基础能力，不与付费状态绑定。</p>
        </article>
      </div>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="本页目录">
          <strong>给家长的目录</strong>
          <a href="#roles">谁来操作</a>
          <a href="#flows">五条数据路径</a>
          <a href="#photos">照片</a>
          <a href="#voice">声音</a>
          <a href="#cloud">私有云</a>
          <a href="#sharing">公开分享</a>
          <a href="#limits">明确不做</a>
          <a href="#checklist">家长检查清单</a>
        </nav>

        <div className={styles.content}>
          <section className={styles.section} id="roles">
            <h2>谁应该操作这些功能</h2>
            <p>
              普通绘本可以由家庭共同创作；涉及真实儿童资料时，应由家长、法定监护人或得到明确授权的成年人负责输入、确认、分享和删除。
              StoryBloom 当前不是面向儿童的开放式 AI 聊天工具，也不应替代家长对事实和内容的判断。
            </p>
            <div className={styles.callout}>
              <strong>登录只是身份验证</strong>
              <p>
                登录可以让系统识别账户，但不会自动订阅邮件、上传本机绘本、导入成长记录，
                也不会自动同意照片或声音处理。
              </p>
            </div>
          </section>

          <section className={styles.section} id="flows">
            <h2>五条数据路径要分开理解</h2>
            <ol>
              <li>
                <strong>匿名故事创作：</strong>名字或昵称、想法和选项发送到服务器及配置的 AI 服务生成绘本；不要求登录。
              </li>
              <li>
                <strong>成长记录：</strong>日期、家长备注、现场照片和生成后的绘本可保存在当前浏览器；现场照片不随成长草稿发送给故事生成接口。
              </li>
              <li>
                <strong>家庭角色：</strong>需要登录。真实照片只有在明确确认本人或监护人授权后才上传到家庭私有空间。
              </li>
              <li>
                <strong>家庭声音：</strong>需要单独录音、授权和上传；当前流程把样本交给阿里云百炼创建私有声音标识。
              </li>
              <li>
                <strong>私有云档案：</strong>需要登录后逐项选择导入或保存，本机副本与云端副本保持分离。
              </li>
            </ol>
            <p>
              “本机保存”描述的是家庭档案副本保存在哪里，并不表示 AI 生成过程完全离线。故事文字和必要场景信息仍会联网处理。
            </p>
          </section>

          <section className={styles.section} id="photos">
            <h2>儿童和家庭照片</h2>
            <h3>成长现场照片</h3>
            <p>
              成长记录支持添加现场照片。当前前端会压缩并转为 WebP Data URL，和记录一起保存在浏览器；
              它们用于家庭回看，不会被加入故事生成请求。只有家长在账户页明确选择导入并勾选授权确认后，
              才会把所选照片上传到家庭私有云端。
            </p>
            <h3>家庭角色照片</h3>
            <p>
              角色照片是单独的登录流程。用户必须确认自己是照片中的本人或其监护人、已经获得明确授权，
              才能保存至私有空间。若随后主动把该角色用于绘本，相关照片或生成的卡通参考可能交给配置的图片服务处理。
            </p>
            <div className={styles.warning}>
              <strong>请避免上传这些内容</strong>
              <p>
                身份证件、校牌、住址门牌、医疗文件、裸露或私密场景，以及包含未获授权第三人的照片。
                上传前应裁掉不需要的背景和可识别信息。
              </p>
            </div>
          </section>

          <section className={styles.section} id="voice">
            <h2>真实声音与家庭旁白</h2>
            <p>
              家庭声音复刻与普通浏览器朗读是两条不同流程。复刻流程要求录制 10–60 秒声音，
              明确确认这是本人声音或已取得声音本人／监护人的授权，然后把样本保存到私有空间并发送给阿里云百炼创建 voice_id。
            </p>
            <ul>
              <li>登录不会启动录音或上传声音。</li>
              <li>家庭声音只在用户主动选择相应家庭角色旁白时使用。</li>
              <li>删除会清理 StoryBloom 管理的样本和绑定记录，并尝试清理外部声音资源；外部清理可能异步完成。</li>
              <li>普通绘本预览仍可使用浏览器 SpeechSynthesis，不需要创建真实声音副本。</li>
            </ul>
          </section>

          <section className={styles.section} id="cloud">
            <h2>私有云不是默认目的地</h2>
            <p>
              当前设备和私有云是两个明确的数据源。登录后发现本机资料时，导入界面默认不勾选任何项目；
              家长可以只选择希望跨设备查看的绘本或成长记录。导入完成后，本机副本仍会保留，
              一侧删除不会被描述为另一侧也已删除。
            </p>
            <div className={styles.warning}>
              <strong>基础验收已完成，仍保留两设备终验</strong>
              <p>
                当前 StoryBloom 站点已完成 migration、RLS、私有 Storage、双账户隔离、可恢复导入及合成记录双写验收。
                同一账户两台真实设备的完整导入、查看、导出和删除流程仍需最终确认；其他自托管部署也必须独立验收。
              </p>
            </div>
          </section>

          <section className={styles.section} id="sharing">
            <h2>公开分享需要再次判断</h2>
            <p>
              私有云和公开分享不是一回事。只有家长主动创建分享链接，绘本快照才会进入公开分享存储；
              分享页虽然禁止搜索引擎收录，但任何拿到链接的人都能打开和转发。
            </p>
            <ul>
              <li>分享内容包括标题、孩子名字或昵称、绘本文字和页面图片。</li>
              <li>当前链接没有自动过期，也不要求查看者登录。</li>
              <li>匿名分享依赖创建浏览器保存的删除凭据；清理浏览器可能丢失凭据，但不会自动撤销链接。</li>
              <li>撤销链接不能删除别人已经保存、截图或再次发布的副本。</li>
            </ul>
            <p>分享前请改用昵称，逐页检查文字和图片，并删除学校、住址、行程、健康情况等不必要信息。</p>
          </section>

          <section className={styles.section} id="limits">
            <h2>StoryBloom 明确不应做什么</h2>
            <ul>
              <li>不根据故事、成长记录或照片给孩子建立心理、能力、性格或风险评分。</li>
              <li>不把登录、阅读、创作或订阅视为照片和真实声音的处理同意。</li>
              <li>不在家长未选择的情况下，把本机成长记录静默合并到云端。</li>
              <li>不让 AI 自动判定真实家庭事实；家长输入和确认应当优先。</li>
              <li>不把隐私控制、导出和删除作为付费权益。</li>
            </ul>
            <p>
              当前访问分析默认关闭，并只在明确允许后记录公开内容页；家庭、成长、创作、账户、登录和分享页面不会记录或发送访问事件。
              从公开页站内跳转时，已加载的 Vercel 脚本文件可能暂时保留，但自动追踪和事件过滤仍会阻止敏感页记录；Microsoft Clarity 会话回放也已暂停。
              仍需继续评估的是免费额度所使用的部分设备／浏览器散列信号。
            </p>
          </section>

          <section className={styles.section} id="checklist">
            <h2>家长使用前检查清单</h2>
            <ol>
              <li>优先使用孩子昵称，只写完成故事需要的事实。</li>
              <li>确认照片和声音中的每个人都已授权，尤其是其他儿童。</li>
              <li>成长记录保存在本机时，定期检查浏览器空间，并从成长书架下载 ZIP 作为自己的备份。</li>
              <li>启用私有云前，确认当前部署已经完成迁移、权限，并了解其跨设备验收状态。</li>
              <li>把分享链接视为可转发的公开链接，发布前逐页检查。</li>
              <li>不再需要时，分别检查本机、私有云、公开分享和家庭声音资源是否都已处理。</li>
            </ol>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} href="/me/settings">
                管理数据与删除
              </Link>
              <Link className={styles.secondaryAction} href="/privacy">
                查看完整隐私说明
              </Link>
            </div>
          </section>
        </div>
      </div>

      <aside className={styles.statusNote}>
        <strong>这不是法律合规认证</strong>
        <p>
          家庭数据要求会随使用地区、部署者和第三方服务配置而不同。部署者需要自行完成适用法律评估、
          供应商配置、敏感页面分析隔离和生产安全验收。
        </p>
      </aside>
    </main>
  );
}
