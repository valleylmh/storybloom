import type { Metadata } from "next";
import Link from "next/link";
import styles from "./TrustDocument.module.css";

export const metadata: Metadata = {
  title: "隐私与数据说明 | StoryBloom",
  description:
    "了解 StoryBloom 如何处理本机资料、可选私有云、AI 生成、分析工具与公开分享。",
};

const DATA_ROWS = [
  {
    data: "创作输入",
    examples: "名字或昵称、故事想法、年龄段、语言、风格及你主动填写的个性化细节",
    use: "生成故事、插图与朗读内容",
    location: "发送到 StoryBloom 服务器，并由当前部署配置的 AI 服务处理",
  },
  {
    data: "当前设备资料",
    examples: "最近绘本、成长记录、成长照片、朗读缓存、偏好和分享删除凭据",
    use: "在本浏览器继续阅读、编辑或清理",
    location: "浏览器的 IndexedDB、localStorage 或缓存；不会因登录自动上传",
  },
  {
    data: "账户资料",
    examples: "登录邮箱、账户标识、保存与同步偏好",
    use: "登录、读取本人云端档案和执行账户控制",
    location: "当前部署配置的 Supabase 认证、数据库与私有存储",
  },
  {
    data: "主动选择的私有云资料",
    examples: "孩子档案、家庭角色、绘本、成长记录、照片和家庭声音元数据",
    use: "跨设备查看、家庭角色复用、导出和删除",
    location: "只有在相应功能中主动保存或逐项导入后，才进入私有云空间",
  },
  {
    data: "防滥用信号",
    examples: "IP，以及浏览器端由随机 ID 和部分浏览器／设备特征生成的散列标识",
    use: "限制免费生成频率、阻止自动化滥用",
    location: "服务器会再组合散列后用于限流；不用于建立孩子画像",
  },
  {
    data: "邮件与客服内容",
    examples: "你主动订阅的邮箱、确认状态，以及主动发给在线客服的消息",
    use: "发送已确认订阅的邮件，或回复支持请求",
    location: "邮件服务和客服服务；登录本身不会触发订阅或打开客服",
  },
] as const;

const PROCESSORS = [
  ["Supabase", "登录、数据库、私有文件存储和公开分享存储；是否启用取决于部署配置。"],
  ["已配置的 AI 服务", "处理故事、插图或朗读请求。文本和图片供应商会随部署配置及故障切换策略变化。"],
  ["阿里云百炼", "仅在用户明确进入家庭声音复刻流程并同意后，处理声音样本和私有 voice_id。"],
  ["Vercel Analytics", "当前代码在站点级加载，用于基础访问统计。"],
  ["Microsoft Clarity", "仅在部署者配置项目 ID 时加载；当前代码仍是站点级会话体验分析。"],
  ["Tawk.to", "只有用户主动打开在线客服后才加载，处理用户在客服窗口中提交的内容。"],
  ["Resend", "处理主动提交并完成确认的每日灵感邮件订阅与投递。"],
  ["Upstash / Cloudflare Turnstile", "在启用时用于请求限流、验证码与防滥用校验。"],
] as const;

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <nav className={styles.topbar} aria-label="页面导航">
        <Link className={styles.brand} href="/">
          StoryBloom
        </Link>
        <Link className={styles.backLink} href="/child-family-data">
          查看儿童与家庭数据说明 →
        </Link>
      </nav>

      <header className={styles.hero}>
        <p className={styles.eyebrow}>PRIVACY &amp; DATA</p>
        <h1>先说清楚，资料会去哪里</h1>
        <p className={styles.lead}>
          StoryBloom 支持匿名创作。登录不等于同意上传，本机资料和私有云副本分开管理。
          但“保存在本机”不代表生成过程完全离线：你提交的创作文字会经 StoryBloom
          服务器和当前配置的 AI 服务处理。
        </p>
        <p className={styles.updated}>基于当前代码更新：2026 年 8 月 12 日</p>
      </header>

      <div className={styles.principles} aria-label="核心隐私原则">
        <article className={styles.principle}>
          <span>1</span>
          <h2>匿名优先</h2>
          <p>不登录也能开始普通绘本创作；需要账户的家庭资料不会因此成为创作前提。</p>
        </article>
        <article className={styles.principle}>
          <span>2</span>
          <h2>上传要由你触发</h2>
          <p>登录不会搬走本机资料。照片进入私有云前，还需要本人或监护人的明确确认。</p>
        </article>
        <article className={styles.principle}>
          <span>3</span>
          <h2>控制不收费</h2>
          <p>本机清理、云端导出与删除入口不与订阅或生成额度绑定。</p>
        </article>
      </div>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="本页目录">
          <strong>本页目录</strong>
          <a href="#scope">说明范围</a>
          <a href="#data">收集与用途</a>
          <a href="#storage">本机与云端</a>
          <a href="#ai">AI 处理</a>
          <a href="#analytics">分析与客服</a>
          <a href="#sharing">公开分享</a>
          <a href="#providers">服务处理方</a>
          <a href="#controls">导出与删除</a>
        </nav>

        <div className={styles.content}>
          <section className={styles.section} id="scope">
            <h2>这份说明覆盖什么</h2>
            <p>
              这是依据当前 StoryBloom 开源代码整理的产品数据说明，用来解释不同功能的数据流和已知边界。
              它不是法律意见、合规认证或对所有第三方服务留存策略的保证。
            </p>
            <div className={styles.warning}>
              <strong>部署状态需要单独核实</strong>
              <p>
                仓库已经包含可选私有云档案、导入、导出和删除代码，但不能据此声称数据库迁移、RLS、
                Storage 策略及真实跨设备流程已在每个生产部署完成验证。
              </p>
            </div>
          </section>

          <section className={styles.section} id="data">
            <h2>会处理哪些资料</h2>
            <p>
              实际处理内容取决于你使用的功能。普通创作、成长记录、家庭角色、家庭声音、邮件订阅和公开分享是彼此独立的操作。
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>资料类别</th>
                    <th>示例</th>
                    <th>用途</th>
                    <th>保存或处理位置</th>
                  </tr>
                </thead>
                <tbody>
                  {DATA_ROWS.map((row) => (
                    <tr key={row.data}>
                      <td>{row.data}</td>
                      <td>{row.examples}</td>
                      <td>{row.use}</td>
                      <td>{row.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.section} id="storage">
            <h2>本机资料与私有云是两份副本</h2>
            <h3>当前设备</h3>
            <p>
              最近绘本、成长记录和成长照片可以保存在当前浏览器中。清理浏览器、切换设备、无痕模式或浏览器存储失败，
              都可能让这些本机资料无法恢复；本机保存不等于服务器备份。
            </p>
            <h3>私有云档案</h3>
            <p>
              登录后，系统仍不会自动上传既有本机内容。导入界面默认不选中任何项目，用户可以逐项选择；
              导入后本机副本继续保留，本机和云端也可以分别删除。
            </p>
            <div className={styles.callout}>
              <strong>照片有更严格的门槛</strong>
              <p>
                家庭角色照片或成长照片进入私有云前，界面要求确认自己是照片中的本人或其监护人、已获得明确授权，
                并同意相应用途。登录状态本身不代替这项确认。
              </p>
            </div>
          </section>

          <section className={styles.section} id="ai">
            <h2>AI 生成并不是完全离线</h2>
            <ul>
              <li>故事想法、名字或昵称、年龄段、语言和你主动填写的细节会发送给服务器及当前配置的文本生成服务。</li>
              <li>页面场景描述会发送给当前配置的图片生成服务；供应商可能随部署设置和故障切换而变化。</li>
              <li>成长记录中的现场照片用于本机记录，不会随成长记录草稿进入故事生成接口。</li>
              <li>家庭角色照片是另一条私有流程：只有明确授权并主动上传、选择角色时，才可能作为绘图参考交给配置的图片服务处理。</li>
              <li>家庭声音复刻需要单独录音和授权，声音样本会发送至阿里云百炼创建家庭私有 voice_id。</li>
            </ul>
            <p>
              请尽量使用昵称，并只填写生成故事真正需要的信息。不要在故事提示中加入证件号码、住址、学校班级、医疗记录或其他不必要的敏感资料。
            </p>
          </section>

          <section className={styles.section} id="analytics">
            <h2>分析、防滥用与客服</h2>
            <h3>访问分析</h3>
            <p>
              当前代码在站点级加载 Vercel Analytics；部署者配置 Microsoft Clarity 项目 ID 后，也会在站点级加载会话体验分析。
              应用代码没有把故事正文作为自定义分析事件主动上报，但当前代码尚未对成长记录、家庭角色等敏感页面单独停用分析脚本，
              因此不能声称这些页面已完成分析隔离。
            </p>
            <h3>防滥用</h3>
            <p>
              免费生成会使用 IP 和浏览器散列标识进行限流，并可在生产环境要求 Cloudflare Turnstile。
              当前浏览器散列由随机浏览器 ID、User-Agent、语言、屏幕尺寸、色深、时区和 CPU 并发数等信号生成；
              它用于额度和滥用控制，不用于推断孩子性格、能力或兴趣画像。
            </p>
            <h3>在线客服</h3>
            <p>
              Tawk.to 不会在页面打开时自动加载；只有用户主动打开在线客服后才加载。
              请不要在客服消息中发送儿童真实照片、声音样本、登录链接、访问令牌或其他不必要的私密资料。
            </p>
          </section>

          <section className={styles.section} id="sharing">
            <h2>“不被搜索”不等于“私密”</h2>
            <p>
              创建公开分享后，StoryBloom 会保存分享所需的标题、孩子名字或昵称、绘本文字和页面图片。
              分享页设置为不让搜索引擎收录，但任何获得链接的人仍可直接打开、复制和转发。
            </p>
            <ul>
              <li>当前分享链接没有自动到期时间，也不要求接收者登录。</li>
              <li>匿名分享的删除凭据保存在创建分享的浏览器中；清除本机数据可能同时丢失这项凭据，但不会让已发布链接自动下线。</li>
              <li>登录后创建的分享可以与账户关联，并在删除云端档案时一并清理。</li>
              <li>删除分享无法收回他人已经截图、下载或再次转发的副本。</li>
            </ul>
            <div className={styles.warning}>
              <strong>分享前先检查</strong>
              <p>建议使用昵称，移除学校、住址、固定行程和医疗信息，并把分享链接当作一条可能被继续转发的公开链接。</p>
            </div>
          </section>

          <section className={styles.section} id="providers">
            <h2>可能参与处理的服务</h2>
            <p>只有在对应功能被启用或用户主动使用时，相关服务才会参与。不同自托管部署可能更换或停用这些服务。</p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>服务</th>
                    <th>当前代码中的用途与边界</th>
                  </tr>
                </thead>
                <tbody>
                  {PROCESSORS.map(([name, purpose]) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td>{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.section} id="controls">
            <h2>查看、导出与删除</h2>
            <ul>
              <li>未登录用户可以在成长书架查看本机成长档案保存字段与用途，并在浏览器内导出 ZIP；导出不会上传本机资料。</li>
              <li>本机成长档案可以设置保留期限偏好并预览到期内容，但不会自动删除；删除到期内容或全部档案需要再次确认。</li>
              <li>当前设备的普通绘本、成长记录、照片缓存和相关凭据仍可分别查看或清理。</li>
              <li>登录用户可以在“数据与隐私”中导出可读取的云端账户资料和文件，并可删除单个孩子档案或全部云端档案。</li>
              <li>本机清理与云端删除是两项独立操作；退出登录也不会删除任一处资料。</li>
              <li>这些数据控制入口不收费，也不应被订阅状态或剩余生成次数阻挡。</li>
            </ul>
            <p>
              StoryBloom 管理范围内的删除不能保证同步删除第三方已经依法或按其配置保留的安全日志，
              也不能删除分享接收者自行保存的副本。家庭声音等外部服务资源的清理还可能需要异步完成。
            </p>
            <div className={styles.actions}>
              <Link className={styles.primaryAction} href="/growth">
                管理本机成长档案
              </Link>
              <Link className={styles.secondaryAction} href="/me/settings">
                打开数据与隐私设置
              </Link>
              <Link className={styles.secondaryAction} href="/child-family-data">
                阅读儿童与家庭数据说明
              </Link>
            </div>
          </section>
        </div>
      </div>

      <aside className={styles.statusNote}>
        <strong>关于后续更新</strong>
        <p>
          当数据流、第三方服务、分析范围或云端部署状态发生实质变化时，这份说明应随代码一起更新；
          在完成生产验证前，不会把“已有实现”写成“已上线并验证”。
        </p>
      </aside>
    </main>
  );
}
