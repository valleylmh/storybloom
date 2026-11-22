import { breadcrumbs } from "@/lib/seo";
import { toAbsoluteAppUrl } from "@/lib/site-url";
import { getTopicBooks, topicPath, type LibraryTopic } from "./topics";

export function topicStructuredData(topic: LibraryTopic) {
  const books = getTopicBooks(topic);
  const url = toAbsoluteAppUrl(topicPath(topic));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        url,
        name: topic.heading,
        description: topic.description,
        inLanguage: "zh-CN",
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: books.length,
          itemListElement: books.map(({ series, book }, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: book.title,
            url: toAbsoluteAppUrl(`/library/${series.id}/${book.id}`),
          })),
        },
      },
      {
        "@type": "FAQPage",
        url: `${url}#faq`,
        mainEntity: topic.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
      breadcrumbs([
        { name: "首页", path: "/" },
        { name: "绘本馆", path: "/library" },
        { name: "绘本专题", path: "/library/topics" },
        { name: topic.name, path: topicPath(topic) },
      ]),
    ],
  };
}
