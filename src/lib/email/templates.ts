import "server-only";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function layout(title: string, content: string) {
  return `<!doctype html><html lang="zh-CN"><body style="margin:0;background:#f7f4ed;color:#302d28;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><div style="max-width:600px;margin:0 auto;padding:40px 20px"><div style="background:#fff;border-radius:20px;padding:32px;border:1px solid #ebe5d9"><div style="font-size:13px;letter-spacing:.12em;color:#8d7453;margin-bottom:18px">STORYBLOOM</div><h1 style="font-size:25px;line-height:1.35;margin:0 0 18px">${escapeHtml(title)}</h1>${content}</div><p style="color:#8a847a;font-size:12px;line-height:1.7;text-align:center;margin-top:18px">StoryBloom · 为每个家庭珍藏独一无二的故事</p></div></body></html>`;
}

function button(label: string, href: string) {
  return `<p style="margin:26px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#405b45;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${escapeHtml(label)}</a></p>`;
}

export function newsletterConfirmationTemplate(input: {
  confirmUrl: string;
  unsubscribeUrl: string;
  locale?: string;
}) {
  if (input.locale?.startsWith("en")) {
    return layout(
      "Confirm your StoryBloom subscription",
      `<p style="line-height:1.8">One more step: confirm that you would like to receive new stories and inspiration from StoryBloom.</p>${button("Confirm subscription", input.confirmUrl)}<p style="font-size:13px;color:#777;line-height:1.7">If you did not request this, you can ignore this email or <a href="${escapeHtml(input.unsubscribeUrl)}">unsubscribe</a>.</p>`,
    );
  }
  return layout(
    "确认订阅 StoryBloom",
    `<p style="line-height:1.8">还差一步：请确认你愿意接收 StoryBloom 的新故事、创作灵感和产品消息。</p>${button("确认订阅", input.confirmUrl)}<p style="font-size:13px;color:#777;line-height:1.7">如果不是你本人提交，可以忽略本邮件或<a href="${escapeHtml(input.unsubscribeUrl)}">取消订阅</a>。</p>`,
  );
}

export function dailyInspirationTemplate(input: {
  issueDate: string;
  theme: string;
  title: string;
  opening: string;
  questions: string[];
  generateUrl: string;
  unsubscribeUrl: string;
  locale?: string;
}) {
  const english = input.locale?.startsWith("en");
  const questionItems = input.questions
    .map(
      (question) =>
        '<li style="margin:0 0 10px;line-height:1.7">' +
        escapeHtml(question) +
        "</li>",
    )
    .join("");
  const content = [
    '<p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;color:#8d7453">',
    escapeHtml(input.issueDate + " · " + input.theme),
    "</p>",
    '<h2 style="font-size:21px;line-height:1.45;margin:0 0 16px">',
    escapeHtml(input.title),
    "</h2>",
    '<p style="line-height:1.85;margin:0 0 22px">',
    escapeHtml(input.opening),
    "</p>",
    '<div style="background:#f7f4ed;border-radius:14px;padding:18px 20px;margin:0 0 10px">',
    '<p style="font-weight:700;margin:0 0 12px">',
    english ? "Talk about it together" : "今天可以和孩子聊聊",
    "</p>",
    '<ul style="padding-left:20px;margin:0">',
    questionItems,
    "</ul>",
    "</div>",
    button(
      english ? "Create a storybook from this idea" : "用这个灵感生成我的绘本",
      input.generateUrl,
    ),
    '<p style="font-size:12px;color:#777;line-height:1.7;margin-top:24px">',
    english
      ? "You are receiving StoryBloom's daily story idea. "
      : "你收到这封邮件，是因为订阅了 StoryBloom 每日绘本灵感。",
    '<a href="' +
      escapeHtml(input.unsubscribeUrl) +
      '">' +
      (english ? "Unsubscribe anytime" : "随时取消订阅") +
      "</a>" + (english ? "." : "。"),
    "</p>",
  ].join("");

  return layout(
    english ? "Today's StoryBloom idea" : "今天的绘本灵感",
    content,
  );
}

export function newsletterWelcomeTemplate(input: {
  unsubscribeUrl: string;
  familyUrl: string;
  locale?: string;
}) {
  if (input.locale?.startsWith("en")) {
    return layout("Welcome to StoryBloom", `<p style="line-height:1.8">Your subscription is confirmed. Create reusable family characters, then turn one sentence into a personal storybook.</p>${button("Create family characters", input.familyUrl)}<p style="font-size:13px;color:#777">You can <a href="${escapeHtml(input.unsubscribeUrl)}">unsubscribe at any time</a>.</p>`);
  }
  return layout("欢迎来到 StoryBloom", `<p style="line-height:1.8">订阅已经确认。现在可以为孩子和家人建立可复用的绘本形象，以后只需一句话，就能生成属于你们的故事。</p>${button("创建家庭角色", input.familyUrl)}<p style="font-size:13px;color:#777">你可以随时<a href="${escapeHtml(input.unsubscribeUrl)}">取消订阅</a>。</p>`);
}
